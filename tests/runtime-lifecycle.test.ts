import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { ECONOMICS, type Agent, type Bootstrap, type Job, type JobQuote } from "@proofbound/shared";
import { startService } from "../apps/worker/src/index.ts";
import { readConfig } from "../apps/worker/src/config.ts";
import { ResearchProvider } from "../apps/worker/src/research.ts";
import { verifyReport } from "../apps/worker/src/verifier.ts";
import { sha256 } from "../apps/worker/src/hash.ts";

test("HTTP lifecycle conserves Fuel and escrow across three concurrent jobs and ownership transfer", async () => {
  const config = { ...readConfig(), mode: "local" as const, providerMode: "fixture" as const, host: "127.0.0.1", port: 0, dbPath: ":memory:", contractId: null };
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started: string[] = [];
  const service = await startService(config, {
    async execute(job, signal) {
      if (job.kind === "marketplace") {
        started.push(job.id);
        await gate;
      }
      return new ResearchProvider(config, service.core.store).execute(job, signal);
    },
  });
  try {
    const address = service.server.address();
    assert(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}/api`;
    const client = () => {
      let cookie = "";
      return async <T>(path: string, method = "GET", body?: unknown, expected = 200): Promise<T> => {
        const response = await fetch(base + path, { method, headers: { origin: config.origin, cookie, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        const result = await response.json() as T;
        assert.equal(response.status, expected, JSON.stringify(result));
        if (response.headers.has("set-cookie")) cookie = response.headers.get("set-cookie")!.split(";")[0];
        return result;
      };
    };
    const owner = client(), buyer = client(), customers = [client(), client(), client()];
    await owner("/session/local", "POST", { accountId: "owner.local" });
    await buyer("/session/local", "POST", { accountId: "buyer.local" });
    await Promise.all(customers.map((c, i) => c("/session/local", "POST", { accountId: ["customer-one.local", "customer-two.local", "customer-three.local"][i] })));
    const { agent } = await owner<{agent: Agent}>("/agents", "POST", { name: "Atlas" });
    assert.equal(agent.fuelAvailable, 100000);
    assert.equal(agent.verifiedJobs, 0);
    const path = `/agents/${agent.id}`;
    await owner(path, "PATCH", { active: true, mode: "hybrid", reinvestBps: 2000 });
    await owner(path + "/topup", "POST", { amount: ECONOMICS.mintCompute });
    const makeBody = (kind: Job["kind"], topic: string) => ({ agentId: agent.id, kind, input: { topic, focus: "network" }, fuelBudget: 8000, idempotencyKey: randomUUID() });
    const body = makeBody("private", "Inspect NEAR ownership and private job limits");
    const { job: personal } = await owner<{job: Job}>("/jobs", "POST", body);
    assert.equal((await owner<{job: Job}>("/jobs", "POST", body)).job.id, personal.id);
    await service.worker.idle();
    const detail = (await owner<{job: Job}>(`/jobs/${personal.id}`)).job;
    assert.equal(detail.status, "completed");
    assert(detail.report && detail.sources && detail.resourceReceipt && detail.verification?.accepted);
    const manipulated = structuredClone(detail.report);
    manipulated.calculations[0].operands[1] = "1";
    manipulated.calculations[0].result = String(detail.fuelBudget);
    const bogusSources = detail.sources.map(source => {
      if (source.id !== "fuel-policy") return source;
      const policy = JSON.parse(source.content);
      const content = JSON.stringify({ ...policy, fuel_unit_price_yocto: "1" });
      return { ...source, content, sha256: sha256(content) };
    });
    assert.equal(verifyReport(detail, manipulated, bogusSources, detail.resourceReceipt).accepted, false);
    assert.equal((await owner<{agent: Agent}>(path)).agent.fuelAvailable, 200000 - detail.fuelUsed);
    const { quote } = await customers[0]<{quote: JobQuote}>("/jobs/quote", "POST", { agentId: agent.id, kind: "marketplace" });
    assert.equal(quote.storageFee, ECONOMICS.jobStorage);
    assert.equal(quote.serviceFee, ECONOMICS.defaultServiceFee);
    const paid = await Promise.all(customers.map((c, i) => c<{job: Job}>("/jobs", "POST", makeBody("marketplace", `Explain NEAR research scenario ${i + 1} and its risks`))));
    await service.worker.tick();
    assert.equal(new Set(started).size, 3);
    assert.equal(service.worker.activeExecutions, 3);
    await owner(path + "/transfer", "POST", { receiverId: "buyer.local" }, 409);
    await customers[1](`/jobs/${paid[0].job.id}`, "GET", undefined, 403);
    release();
    await service.worker.idle();
    const receipts: Job[] = [];
    for (let i = 0; i < customers.length; i++) {
      const { job } = await customers[i]<{job: Job}>(`/jobs/${paid[i].job.id}`);
      assert.equal(job.status, "completed");
      receipts.push(job);
      const s = job.settlement!;
      assert.equal(BigInt(s.ownerClaimable) + BigInt(s.reinvested) + BigInt(s.platformFee) + BigInt(s.computeCharged) + BigInt(s.customerRefund) + BigInt(s.storageCharged), BigInt(job.deposit));
      assert.equal(s.platformFee, "1000000000000000000000");
      assert.equal(s.fuelAdded, 1800);
      assert.equal(job.transactionHash, null);
    }
    const completed = await owner<{agent: Agent}>(path);
    const ownerBootstrap = await owner<Bootstrap>("/bootstrap");
    assert.equal(completed.agent.verifiedJobs, 4);
    assert.equal(completed.agent.paidVerifiedJobs, 3);
    assert.equal(completed.agent.fuelReserved, 0);
    assert.equal(completed.agent.fuelAvailable, 200000 - detail.fuelUsed + 5400);
    assert.equal(ownerBootstrap.ledger.filter(e => e.agentId === agent.id).reduce((sum, e) => sum + e.fuelDelta, 0), completed.agent.fuelAvailable);
    assert.equal(ownerBootstrap.balance, "21600000000000000000000");
    const earningsMovements = ownerBootstrap.ledger.filter(e => e.agentId === agent.id && ["owner_earnings", "earn_to_refill"].includes(e.kind));
    assert.equal(earningsMovements.reduce((sum, entry) => sum + BigInt(entry.amount), 0n), BigInt(ownerBootstrap.balance));
    const denial = await owner<{allowed: boolean; code: string}>(path + "/security-check", "POST", { action: "redirect-payout" });
    assert.deepEqual([denial.allowed, denial.code], [false, "TOOL_NOT_ALLOWED"]);
    const transfer = await owner<{agent: Agent}>(path + "/transfer", "POST", { receiverId: "buyer.local" });
    assert.equal(transfer.agent.ownershipEpoch, 2);
    assert.equal(transfer.agent.active, false);
    assert.equal(transfer.agent.fuelAvailable, completed.agent.fuelAvailable);
    assert.equal(transfer.agent.verifiedJobs, 4);
    await owner(path, "PATCH", { active: true }, 403);
    await buyer(`/jobs/${personal.id}`, "GET", undefined, 403);
    const passport = await client()<{agent: Agent; jobs: Job[]}>(`/passport/${agent.id}`);
    assert.equal(passport.agent.ownerId, "buyer.local");
    assert.equal(passport.jobs.length, 4);
    assert(passport.jobs.every(job => !job.report && !job.input && job.verification?.evidenceHash));
    const { job: publicProof } = await client()<{job: Job}>(`/jobs/${personal.id}/proof`);
    assert.equal(publicProof.verification?.evidenceHash, detail.verification.evidenceHash);
    assert.equal(publicProof.report, undefined);
    assert.equal(publicProof.sources, undefined);
    await buyer(path, "PATCH", { active: true });
    assert.equal((await buyer<{agent: Agent}>(path)).agent.active, true);
    assert.equal((await owner<Bootstrap>("/bootstrap")).balance, ownerBootstrap.balance);
    if (process.env.PROOFBOUND_WRITE_DEMO_EVIDENCE === "1") {
      const output = {
        recordedAt: new Date().toISOString(), scope: "Local HTTP integration, deterministic research and simulated balances",
        agent: { tokenId: agent.tokenId, initialFuel: agent.fuelAvailable, finalFuel: transfer.agent.fuelAvailable, newOwner: transfer.agent.ownerId, ownershipEpoch: transfer.agent.ownershipEpoch },
        privateJob: { id: detail.id, fuel: detail.fuelUsed, evidenceHash: detail.verification.evidenceHash },
        concurrency: { observedInFlight: started.length, jobIds: started, activeTransferDenied: true },
        settlements: receipts.map(job => ({ jobId: job.id, customer: job.customerId, deposit: job.deposit, evidenceHash: job.verification?.evidenceHash, settlement: job.settlement })),
        claimableAfterTransfer: ownerBootstrap.balance, payoutRedirectionDenied: true, formerOwnerDenied: true, buyerReactivated: true,
      };
      mkdirSync("docs/evidence", { recursive: true });
      writeFileSync("docs/evidence/local-lifecycle.json", JSON.stringify(output, null, 2) + "\n");
    }
  } finally {
    release();
    await service.close();
  }
});
