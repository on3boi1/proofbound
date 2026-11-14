import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadLocalEnvironment, readConfig } from "../apps/worker/src/config.ts";
import { Core, type StoredJob } from "../apps/worker/src/core.ts";
import { ResearchProvider } from "../apps/worker/src/research.ts";
import { Store } from "../apps/worker/src/store.ts";
import { verifyReport } from "../apps/worker/src/verifier.ts";

const live = process.argv.includes("--live");
if (live) loadLocalEnvironment();
const config = {
  ...readConfig(), mode: "local" as const, providerMode: live ? "live" as const : "fixture" as const,
  contractId: null, dbPath: ":memory:", allowChainWrites: false, maxLiveRequests: 1, maxLiveTokens: 8000,
};
const store = new Store(config.dbPath);
try {
  const core = new Core(store, config);
  const agent = core.mint("owner.local", { name: "Atlas research check" });
  core.configure(agent.id, "owner.local", { active: true });
  const submitted = core.submit("owner.local", {
    agentId: agent.id, kind: "private", idempotencyKey: randomUUID(),
    input: { topic: "Explain NEAR NFT ownership and how a bounded agent accounts for Fuel.", focus: "network" },
  });
  const [job] = core.claimJobs();
  assert(job && job.id === submitted.id);
  const { report, sources, receipt } = await new ResearchProvider(config, store).execute(job, AbortSignal.timeout(config.jobTimeoutMs));
  const verification = verifyReport(job, report, sources, receipt);
  assert(verification.accepted, JSON.stringify(verification.checks.filter(check => !check.passed)));
  const completed = core.settle(job.id, report, sources, receipt, verification);
  assert.equal(completed.status, "completed");
  assert.equal(core.agent(agent.id).fuelAvailable, 100000 - receipt.fuelUsed);
  const evidence = {
    checkedAt: new Date().toISOString(), scope: "Research runtime and local ledger with no blockchain writes.",
    provider: receipt.provider, model: receipt.model, requestId: receipt.requestId, totalTokens: receipt.totalTokens,
    estimatedCostUsd: receipt.estimatedCostUsd, checks: verification.checks, jobId: job.id, outputHash: verification.outputHash,
    evidenceHash: verification.evidenceHash, sources: sources.map(({ id, title, url, sha256 }) => ({ id, title, url, sha256 })),
  };
  if (process.argv.includes("--evidence")) {
    mkdirSync("docs/evidence", { recursive: true });
    writeFileSync(`docs/evidence/${live ? "live" : "fixture"}-research.json`, JSON.stringify(evidence, null, 2) + "\n");
  }
  console.log(JSON.stringify(evidence, null, 2));
} finally { store.close(); }
