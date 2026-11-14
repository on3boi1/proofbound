import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ECONOMICS, LOCAL_ACCOUNTS, type JobKind } from "@proofbound/shared";
import { MAX_WORKER_BODY_BYTES } from "@proofbound/shared/worker-api";
import { Auth } from "./auth.ts";
import { Chain } from "./chain.ts";
import { loadLocalEnvironment, readConfig, type RuntimeConfig } from "./config.ts";
import { Core } from "./core.ts";
import { AppError, boundedText, invariant } from "./errors.ts";
import { createProxyAccess } from "./proxy-access.ts";
import { assertCreditDemoAvailable } from "./research.ts";
import { Store } from "./store.ts";
import { Worker, type ExecutableProvider } from "./worker.ts";

const COOKIE = "proofbound_session";

async function bodyOf(request: IncomingMessage): Promise<Record<string, unknown>> {
  invariant(request.headers["content-type"]?.split(";")[0] === "application/json", "JSON_REQUIRED", "Send a JSON request.", 415);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    invariant(size <= MAX_WORKER_BODY_BYTES, "BODY_TOO_LARGE", "Request body exceeds 16 KiB.", 413);
    chunks.push(bytes);
  }
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AppError("INVALID_JSON", "Request body is not valid JSON."); }
  invariant(value && typeof value === "object" && !Array.isArray(value), "INVALID_INPUT", "Send a JSON object.");
  return value as Record<string, unknown>;
}

export async function startService(config: RuntimeConfig, provider?: ExecutableProvider) {
  const store = new Store(config.dbPath);
  const core = new Core(store, config);
  const chain = new Chain(core);
  const auth = new Auth(store, config, (account, key) => chain.accessKey(account, key));
  const worker = new Worker(core, provider, chain);
  const live = config.mode === "testnet";
  const origin = new URL(config.origin).origin;
  const proxyAccess = config.proxyToken ? createProxyAccess(config.proxyToken) : null;
  const runtime = () => core.runtime(worker.running, worker.activeExecutions);
  const cookie = (token: string, seconds: number) =>
    `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${seconds}${origin.startsWith("https:") ? "; Secure" : ""}`;

  async function route(req: IncomingMessage, res: ServerResponse) {
    const method = req.method ?? "GET";
    const { pathname, searchParams } = new URL(req.url ?? "/", origin);
    proxyAccess?.check(req, method, pathname, origin);
    const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const token = req.headers.cookie?.match(/(?:^|;\s*)proofbound_session=([\w-]+)/)?.[1] ?? null;
    const session = auth.session(token);
    const account = () => {
      invariant(session, "SIGN_IN_REQUIRED", "Connect an account to continue.", 401);
      return session.accountId;
    };
    if (method !== "GET") invariant(req.headers.origin === origin, "ORIGIN_DENIED", "This request must come from the configured application origin.", 403);
    // Public browsing and wallet login remain available while demo transactions are disabled.
    if (proxyAccess && method !== "GET" && !["/api/auth/challenge", "/api/auth/verify", "/api/session", "/api/jobs/quote"].includes(pathname)) {
      const actor = account();
      invariant(config.demoAccounts?.has(actor), "DEMO_ACCOUNT_REQUIRED", "This testnet action is available to the designated demo wallets.", 403);
      invariant(config.allowChainWrites || pathname === "/api/transactions/confirm", "CHAIN_WRITES_DISABLED",
        "Testnet transactions are paused on this demo.", 503);
      proxyAccess.limitAccount(actor);
    }

    if (method === "GET" && pathname === "/api/health") return { runtime: runtime() };
    if (method === "GET" && pathname === "/api/bootstrap") {
      let economics = ECONOMICS;
      if (live) {
        const c = await chain.contractConfig();
        economics = {
          ...ECONOMICS,
          fuelUnitPrice: c.pricing.fuel_unit_price, initialFuel: c.pricing.initial_fuel,
          mintStorage: c.pricing.mint_storage_fee, mintPlatform: c.pricing.mint_platform_fee,
          mintCompute: (BigInt(c.pricing.fuel_unit_price) * BigInt(c.pricing.initial_fuel)).toString(),
          mintTotal: c.mint_total, jobStorage: c.pricing.job_storage_fee,
          defaultServiceFee: c.pricing.default_service_fee, platformBps: c.platform_fee_bps,
        };
        await chain.refreshAgents();
      }
      const id = session?.accountId;
      return {
        runtime: runtime(), session, agents: core.listAgents(id), jobs: id ? core.jobsFor(id) : [],
        ledger: id ? store.list<{ accountId: string }>("ledger").filter(entry => entry.accountId === id).reverse() : [],
        balance: id ? live ? await chain.balance(id) : core.account(id).claimable : "0",
        economics, localAccounts: live ? [] : LOCAL_ACCOUNTS,
      };
    }
    if (method === "POST" && pathname === "/api/session/local") {
      core.assertLocal();
      const id = boundedText((await bodyOf(req)).accountId, 2, 64, "Account");
      core.ensureLocalAccount(id);
      auth.revoke(token);
      const created = auth.createSession(id);
      res.setHeader("Set-Cookie", cookie(created.token, 28800));
      return { session: created.session };
    }
    if (method === "DELETE" && pathname === "/api/session") {
      auth.revoke(token);
      res.setHeader("Set-Cookie", cookie("", 0));
      return { ok: true };
    }
    if (method === "POST" && pathname === "/api/auth/challenge") return auth.challenge(await bodyOf(req));
    if (method === "POST" && pathname === "/api/auth/verify") {
      const created = await auth.verify(await bodyOf(req));
      auth.revoke(token);
      res.setHeader("Set-Cookie", cookie(created.token, 28800));
      return { session: created.session };
    }
    if (method === "POST" && pathname === "/api/transactions/confirm") {
      invariant(live, "LOCAL_MODE", "Transaction confirmation requires testnet mode.");
      const id = account();
      const body = await bodyOf(req);
      return chain.confirm(id, boundedText(body.operationId, 1, 64, "Operation"), boundedText(body.transactionHash, 32, 64, "Transaction hash"));
    }
    if (parts[0] === "api" && parts[1] === "agents") {
      const [, , id, action] = parts;
      if (method === "GET" && !id) {
        if (live) await chain.refreshAgents();
        const owned = searchParams.get("owned") === "true";
        const agents = core.listAgents(owned ? account() : null, owned);
        return { agents };
      }
      if (method === "POST" && !id) {
        const actor = account();
        const body = await bodyOf(req);
        return live ? chain.mint(actor, body) : { agent: core.mint(actor, body) };
      }
      if (method === "GET" && id && !action) {
        if (live) await chain.refreshAgent(id);
        return core.detail(id, session?.accountId);
      }
      if (method === "PATCH" && id && !action) {
        const actor = account();
        const body = await bodyOf(req);
        return live ? chain.configure(id, actor, body) : { agent: core.configure(id, actor, body) };
      }
      if (method === "POST" && id && action) {
        const actor = account();
        const body = await bodyOf(req);
        if (action === "topup") return live ? chain.topup(id, actor, String(body.amount)) : { agent: core.topup(id, actor, body.amount) };
        if (action === "transfer") return live ? chain.transfer(id, actor, String(body.receiverId)) : { agent: core.transfer(id, actor, body.receiverId) };
        if (action === "security-check") {
          if (live) await chain.owned(id, actor);
          return core.securityCheck(id, actor, body.action);
        }
      }
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "passport" && parts.length === 3) {
      if (live) await chain.refreshAgent(parts[2]);
      return core.passport(parts[2], session?.accountId);
    }
    if (method === "POST" && pathname === "/api/jobs/quote") {
      const actor = account();
      const body = await bodyOf(req);
      const id = boundedText(body.agentId, 1, 64, "Agent ID");
      invariant(body.kind === "private" || body.kind === "marketplace", "INVALID_INPUT", "Choose an available job type.");
      const a = live ? await chain.refreshAgent(id) : core.agent(id);
      invariant(body.kind === "private" ? a.ownerId === actor : a.mode !== "private" && a.ownerId !== actor, "JOB_NOT_ALLOWED", "This account cannot quote this job.", 403);
      return { quote: live ? await chain.quote(id, body.kind, body.fuelBudget as number | undefined) : core.quote(id, body.kind as JobKind, body.fuelBudget as number | undefined) };
    }
    if (method === "POST" && pathname === "/api/jobs") {
      const actor = account();
      const body = await bodyOf(req);
      if (live) {
        invariant(worker.canExecute, "WORKER_NOT_AUTHORIZED", "The operator has not enabled testnet execution. Escrow funding is unavailable.", 503);
        if (config.creditDemo) assertCreditDemoAvailable(store, config, Number(body.fuelBudget ?? ECONOMICS.defaultFuelBudget));
        return chain.submit(actor, body);
      }
      return { job: core.submit(actor, body) };
    }
    if (method === "GET" && pathname === "/api/jobs") return { jobs: core.jobsFor(account()) };
    if (parts[0] === "api" && parts[1] === "jobs" && parts[2]) {
      if (method === "GET" && parts.length === 4 && parts[3] === "proof") {
        const job = core.job(parts[2]);
        invariant(job.settlement || job.verification, "NOT_FOUND", "Public evidence is available once verification or settlement is recorded.", 404);
        return { job: core.visibleJob(job, null, true) };
      }
      const actor = account();
      const id = parts[2];
      if (method === "GET" && parts.length === 3) {
        const stored = core.getJob(id, actor);
        if (live && !stored.settlement && Date.parse(stored.deadline) < Date.now()) await chain.refreshJob(id);
        return { job: core.getJob(id, actor) };
      }
      if (method === "POST" && parts.length === 4 && parts[3] === "cancel") {
        return live ? chain.cancel(id, actor) : { job: core.cancel(id, actor) };
      }
      if (method === "POST" && parts.length === 4 && parts[3] === "expire") {
        invariant(live, "LOCAL_MODE", "The local worker releases expired reservations automatically.");
        return chain.expire(id, actor);
      }
    }
    if (method === "POST" && pathname === "/api/withdraw") {
      const actor = account();
      return live ? chain.withdraw(actor) : core.withdraw(actor);
    }
    throw new AppError("NOT_FOUND", "No route matches this request.", 404);
  }

  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try { res.end(JSON.stringify(await route(req, res))); }
    catch (error) {
      const known = error instanceof AppError;
      res.statusCode = known ? error.status : 500;
      res.end(JSON.stringify({ error: { code: known ? error.code : "INTERNAL_ERROR", message: known ? error.message : "The worker could not complete this request." } }));
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  await worker.start();
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.port, config.host, () => resolve());
    });
  } catch (error) {
    await worker.stop();
    store.close();
    throw error;
  }
  const close = async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await worker.stop();
    store.close();
  };
  return { server, worker, core, close };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  loadLocalEnvironment();
  const config = readConfig();
  const service = await startService(config);
  console.log(`PROOFBOUND worker listening at http://${config.host}:${config.port} (${config.mode}/${config.providerMode})`);
  const stop = () => { void service.close().then(() => process.exit(0), () => process.exit(1)); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
