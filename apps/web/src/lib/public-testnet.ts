import { ECONOMICS, type Agent, type Bootstrap, type PassportEvent } from "@proofbound/shared";
import { isPublicWorkerRoute } from "@proofbound/shared/worker-api";

const contractId = "contract.proofbound-dev-2026.testnet";
const rpcEndpoints = ["https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"];
// Finalized Atlas receipts recorded in docs/evidence and independently checked on testnet.
const atlasEvents: PassportEvent[] = [
  {
    id: "atlas-activation", agentId: "1", kind: "configuration", timestamp: "2026-11-14T16:41:54.131Z",
    configVersion: 2, ownershipEpoch: 1, detail: "Atlas activated in Hybrid mode. The owner set a limit of three concurrent jobs and 20% Earn-to-Refill.",
    evidenceHash: "36cc9c4e4f07d10c2c5463e3dec7c82adc29e5dc6ee88c3e5e69fffee63f94fb", jobId: null,
    transactionHash: "GB6GqYERprss2pKhYWfjAWXrwqWLcArTkK7XqKy2QvVR",
  },
  {
    id: "atlas-mint", agentId: "1", kind: "mint", timestamp: "2026-11-14T16:24:36.950Z",
    configVersion: 1, ownershipEpoch: 1, detail: "Atlas #1 minted to proofbound-dev-2026.testnet with 100,000 Fuel.",
    evidenceHash: "2df70bff0010a8e7b8a626599c7b8d5bb205498fe9f6c669f24b20c7508e090c", jobId: null,
    transactionHash: "HcdKs9anEs93H8Vw1Pyqaf5gck7rvdB2qmYXsa28djJn",
  },
];

interface ChainAgent {
  token_id: string; owner_id: string; name: string; config_hash: string;
  config_version: number; ownership_epoch: number; mode: Agent["mode"];
  active: boolean; transfer_pending: boolean; max_concurrent: number;
  max_fuel_per_job: number; service_fee: string; reinvest_bps: number;
  available_fuel: number; reserved_fuel: number; active_jobs: number;
  lifetime: { completed_personal: number; completed_paid: number; failed_personal: number; failed_paid: number; reputation_events: number };
  lifetime_service_revenue: string; created_at_ns: string;
}

interface ContractConfig {
  mint_total: string;
  platform_fee_bps: number;
  pricing: { fuel_unit_price: string; initial_fuel: number; mint_storage_fee: string; mint_platform_fee: string; job_storage_fee: string; default_service_fee: string };
}

async function view<T>(method: "list_agents" | "get_agent" | "get_config", args: Record<string, string | number>): Promise<T> {
  const body = JSON.stringify({
    jsonrpc: "2.0", id: "proofbound", method: "query",
    params: {
      request_type: "call_function", finality: "final", account_id: contractId,
      method_name: method, args_base64: btoa(JSON.stringify(args)),
    },
  });
  for (const url of rpcEndpoints) {
    try {
      const response = await fetch(url, {
        method: "POST", headers: { "content-type": "application/json" }, body,
        signal: AbortSignal.timeout(5000), redirect: "manual",
      });
      if (!response.ok) continue;
      const rpc = await response.json() as { result?: { result?: number[] } };
      if (rpc.result?.result) return JSON.parse(new TextDecoder().decode(Uint8Array.from(rpc.result.result))) as T;
    } catch {
      // Continue to the next public testnet provider.
    }
  }
  throw new Error("Testnet contract read failed");
}

function toAgent(chain: ChainAgent): Agent {
  const createdAt = new Date(Number(BigInt(chain.created_at_ns) / 1000000n)).toISOString();
  return {
    id: chain.token_id, tokenId: chain.token_id, name: chain.name, ownerId: chain.owner_id,
    specialization: "Research", templateId: "near-research-v1", configVersion: chain.config_version,
    configHash: chain.config_hash, ownershipEpoch: chain.ownership_epoch,
    instructions: "", allowedTools: [], mode: chain.mode, active: chain.active && !chain.transfer_pending,
    maxConcurrent: chain.max_concurrent, maxFuelPerJob: chain.max_fuel_per_job,
    serviceFee: chain.service_fee, reinvestBps: chain.reinvest_bps, fuelAvailable: chain.available_fuel,
    fuelReserved: chain.reserved_fuel, activeJobs: chain.active_jobs,
    verifiedJobs: chain.lifetime.completed_personal + chain.lifetime.completed_paid,
    paidVerifiedJobs: chain.lifetime.reputation_events, privateVerifiedJobs: chain.lifetime.completed_personal,
    failedJobs: chain.lifetime.failed_personal + chain.lifetime.failed_paid,
    lifetimeEarnings: chain.lifetime_service_revenue, createdAt, updatedAt: createdAt, network: "testnet", example: false,
  };
}

async function bootstrap(): Promise<Bootstrap> {
  const [agents, config] = await Promise.all([
    view<ChainAgent[]>("list_agents", { from_index: "0", limit: 100 }),
    view<ContractConfig>("get_config", {}),
  ]);
  return {
    runtime: {
      mode: "testnet", providerMode: "fixture", contractId, network: "testnet", readOnly: true,
      liveEnabled: false, workerRunning: false, activeExecutions: 0, peakConcurrency: 0,
      disclaimer: "Public agent data comes from finalized NEAR testnet state. Agent execution and transactions are offline on this site.",
    },
    session: null, agents: agents.map(toAgent), jobs: [], ledger: [], balance: "0", localAccounts: [],
    economics: {
      ...ECONOMICS, fuelUnitPrice: config.pricing.fuel_unit_price, initialFuel: config.pricing.initial_fuel,
      mintStorage: config.pricing.mint_storage_fee, mintPlatform: config.pricing.mint_platform_fee,
      mintCompute: (BigInt(config.pricing.fuel_unit_price) * BigInt(config.pricing.initial_fuel)).toString(),
      mintTotal: config.mint_total, jobStorage: config.pricing.job_storage_fee,
      defaultServiceFee: config.pricing.default_service_fee, platformBps: config.platform_fee_bps,
    },
  };
}

const uncached = { "Cache-Control": "no-store" };
const publicRead = { "Cache-Control": "public, max-age=10, s-maxage=30" };

function rejected(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: uncached });
}

export async function servePublicTestnet(method: string, pathname: string) {
  if (method !== "GET") {
    return isPublicWorkerRoute(method, pathname)
      ? rejected(503, "WORKER_UNAVAILABLE", "Agent execution and transactions are offline on this read-only site.")
      : rejected(404, "NOT_FOUND", "No route matches this request.");
  }

  try {
    if (pathname === "/api/bootstrap") {
      return Response.json(await bootstrap(), { headers: publicRead });
    }
    const match = /^\/api\/(agents|passport)\/(\d{1,20})$/.exec(pathname);
    if (match) {
      const chain = await view<ChainAgent | null>("get_agent", { token_id: match[2] });
      if (!chain) return rejected(404, "NOT_FOUND", "Agent not found on NEAR testnet.");
      const agent = toAgent(chain);
      const events = agent.id === "1" ? atlasEvents : [];
      const body = match[1] === "passport" ? { agent, events, jobs: [] } : { agent, jobs: [], passport: events, ledger: [] };
      return Response.json(body, { headers: publicRead });
    }
    return rejected(404, "NOT_FOUND", "No public data is available for this route.");
  } catch {
    return rejected(503, "RPC_UNAVAILABLE", "NEAR testnet data is temporarily unavailable. Please retry.");
  }
}
