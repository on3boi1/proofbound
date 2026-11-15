import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { WORKER_PROXY_HEADER } from "@proofbound/shared/worker-api";
import { GET, POST } from "../apps/web/src/app/api/[...path]/route.ts";
import { readConfig } from "../apps/worker/src/config.ts";
import { startService } from "../apps/worker/src/index.ts";
import { assertCreditDemoAvailable } from "../apps/worker/src/research.ts";
import { Store } from "../apps/worker/src/store.ts";

test("the public API requires its trusted proxy, limits traffic and reports an offline worker", async () => {
  const origin = "http://127.0.0.1:4320";
  const token = randomBytes(32).toString("hex");
  const config = {
    ...readConfig(), origin, proxyToken: token, mode: "testnet" as const,
    providerMode: "fixture" as const, contractId: "contract.proofbound-dev-2026.testnet",
    host: "127.0.0.1", port: 0, dbPath: ":memory:", allowChainWrites: false,
  };
  const service = await startService(config);
  let closed = false;
  const names = ["PROOFBOUND_WORKER_URL", "PROOFBOUND_WEB_ORIGIN", "PROOFBOUND_WORKER_PROXY_TOKEN", "VERCEL"] as const;
  const saved = names.map(name => [name, process.env[name]] as const);
  try {
    const address = service.server.address();
    assert(address && typeof address === "object");
    const worker = `http://127.0.0.1:${address.port}`;
    process.env.PROOFBOUND_WORKER_URL = worker;
    process.env.PROOFBOUND_WEB_ORIGIN = origin;
    process.env.PROOFBOUND_WORKER_PROXY_TOKEN = token;
    delete process.env.VERCEL;
    const payload = JSON.stringify({ accountId: "proofbound.testnet" });
    const context = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });
    const frontendRequest = (path: string, init: RequestInit) => {
      const url = new URL(origin + "/api/" + path);
      return Object.assign(new Request(url, init), { nextUrl: url }) as Parameters<typeof GET>[0];
    };
    const direct = await fetch(worker + "/api/auth/challenge", {
      method: "POST", headers: { origin, "content-type": "application/json" }, body: payload,
    });
    assert.equal(direct.status, 401);
    assert.equal((await direct.json()).error.code, "PROXY_AUTH_REQUIRED");
    assert.equal((await fetch(worker + "/api/health", { headers: { [WORKER_PROXY_HEADER]: token } })).status, 404);

    const challenge = (requestOrigin = origin, body = payload) => POST(frontendRequest("auth/challenge", {
      method: "POST",
      headers: { host: new URL(origin).host, origin: requestOrigin, "content-type": "application/json", [WORKER_PROXY_HEADER]: "browser-value" },
      body,
    }), context("auth/challenge"));
    assert.equal((await challenge("https://other.example")).status, 403);
    assert.equal((await challenge(origin, "a".repeat(16385))).status, 413);
    const first = await challenge();
    assert.equal(first.status, 200);
    const proof = await first.json();
    assert.equal(proof.recipient, new URL(origin).host);
    assert.equal(proof.nonce.length, 32);
    assert(!JSON.stringify(proof).includes(token));
    for (let count = 1; count < 16; count++) assert.equal((await challenge()).status, 200);
    assert.equal((await challenge()).status, 429);

    const publicGet = (path: string) => GET(frontendRequest(path, {
      headers: { host: new URL(origin).host },
    }), context(path));
    assert.equal((await publicGet("health")).status, 404);
    await service.close();
    closed = true;
    const offline = await publicGet("bootstrap");
    assert.equal(offline.status, 503);
    assert.equal(offline.headers.get("cache-control"), "no-store");
    assert.equal((await offline.json()).error.code, "WORKER_UNAVAILABLE");
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    if (!closed) await service.close();
  }
});

test("the credit demo refuses further escrow after its persistent budget or credits are exhausted", () => {
  const config = { ...readConfig(), maxLiveRequests: 2, maxLiveTokens: 16000 };
  const store = new Store(":memory:");
  const budget = "near-ai:hackathon-credit-demo";
  try {
    assert.doesNotThrow(() => assertCreditDemoAvailable(store, config, 8000));
    store.put("provider-budget", budget, { requests: 1, reservedTokens: 8000, exhausted: true });
    assert.throws(() => assertCreditDemoAvailable(store, config, 8000), { code: "PROVIDER_CREDITS_EXHAUSTED" });
    store.put("provider-budget", budget, { requests: 2, reservedTokens: 16000 });
    assert.throws(() => assertCreditDemoAvailable(store, config, 8000), { code: "PROVIDER_BUDGET" });
  } finally {
    store.close();
  }
});

test("the hosted testnet gateway blocks writes and reads only the fixed finalized contract", async t => {
  const previousMode = process.env.PROOFBOUND_PUBLIC_TESTNET;
  process.env.PROOFBOUND_PUBLIC_TESTNET = "1";
  t.after(() => {
    if (previousMode === undefined) delete process.env.PROOFBOUND_PUBLIC_TESTNET;
    else process.env.PROOFBOUND_PUBLIC_TESTNET = previousMode;
  });
  const rpc = t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    const call = JSON.parse(String(options.body));
    assert.equal(call.method, "query");
    assert.deepEqual(call.params, {
      request_type: "call_function", finality: "final",
      account_id: "contract.proofbound-dev-2026.testnet", method_name: "get_agent",
      args_base64: btoa('{"token_id":"1"}'),
    });
    if (url === "https://test.rpc.fastnear.com") return new Response(null, { status: 503 });
    assert.equal(url, "https://rpc.testnet.near.org");
    return Response.json({ result: { result: Array.from(new TextEncoder().encode("null")) } });
  });
  const route = (handler: typeof GET, method: string, path: string) => {
    const url = new URL("https://demo.example/api/" + path + "?receiver=other.testnet");
    return handler(Object.assign(new Request(url, { method }), { nextUrl: url }) as Parameters<typeof GET>[0], {
      params: Promise.resolve({ path: path.split("/") }),
    });
  };
  assert.equal((await route(POST, "POST", "jobs")).status, 503);
  assert.equal((await route(GET, "GET", "health")).status, 404);
  assert.equal(rpc.mock.callCount(), 0);
  assert.equal((await route(GET, "GET", "agents/1")).status, 404);
  assert.equal(rpc.mock.callCount(), 2);
});
