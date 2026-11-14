import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isWorkerProxyToken } from "@proofbound/shared/worker-api";
import type { Mode, ProviderMode } from "../../../packages/shared/src/index.ts";
export const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
export function loadLocalEnvironment(): void {
  const file=resolve(repoRoot,".env.local");
  if (existsSync(file)) process.loadEnvFile(file);
}
export interface RuntimeConfig {
  mode: Mode; providerMode: ProviderMode; host: string; port: number; origin: string; dbPath: string;
  contractId: string | null; rpcUrl: string; allowChainWrites: boolean; model: string;
  maxLiveRequests: number; maxLiveTokens: number; jobTimeoutMs: number;
  proxyToken?: string; demoAccounts?: ReadonlySet<string>; creditDemo?: boolean;
}
export function readConfig(): RuntimeConfig {
  const mode=process.env.PROOFBOUND_MODE??"local", providerMode=process.env.PROOFBOUND_PROVIDER??"fixture";
  if (!(["local","testnet"] as string[]).includes(mode)) throw new Error("PROOFBOUND_MODE must be local or testnet.");
  if (!(["fixture","live"] as string[]).includes(providerMode)) throw new Error("PROOFBOUND_PROVIDER must be fixture or live.");
  if (mode==="testnet"&&!process.env.NEAR_CONTRACT_ID?.endsWith(".testnet")) throw new Error("Testnet requires a named .testnet NEAR_CONTRACT_ID.");
  const origin = new URL(process.env.PROOFBOUND_WEB_ORIGIN ?? "http://127.0.0.1:3000").origin;
  const host = process.env.PROOFBOUND_HOST ?? "127.0.0.1";
  const proxyToken = process.env.PROOFBOUND_WORKER_PROXY_TOKEN || undefined;
  const allowChainWrites = process.env.PROOFBOUND_ALLOW_CHAIN_WRITES === "1";
  const creditDemo = process.env.PROOFBOUND_CREDIT_DEMO === "1";
  const demoAccounts = new Set((process.env.PROOFBOUND_DEMO_ACCOUNTS ?? "").split(",").map(account => account.trim()).filter(Boolean));
  const maxLiveRequests = Number(process.env.PROOFBOUND_MAX_LIVE_REQUESTS ?? 10);
  const maxLiveTokens = Number(process.env.PROOFBOUND_MAX_LIVE_TOKENS ?? 80000);
  if (proxyToken !== undefined) {
    if (!isWorkerProxyToken(proxyToken) || mode !== "testnet" || host !== "127.0.0.1") {
      throw new Error("Tunneled workers require a 64-digit hex proxy token, testnet mode, and a loopback listener.");
    }
    if ([...demoAccounts].some(account => !/^[a-z0-9._-]+\.testnet$/.test(account) || account.length > 64)) {
      throw new Error("Demo accounts must be named NEAR testnet accounts.");
    }
    if (allowChainWrites && (demoAccounts.size === 0 || providerMode !== "live" || !creditDemo || !process.env.NEAR_AI_API_KEY)) {
      throw new Error("Tunneled job execution requires named demo accounts, live inference, and a confirmed credit-only key.");
    }
  }
  for (const limit of [maxLiveRequests, maxLiveTokens]) {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new Error("Live inference limits must be nonnegative integers.");
  }
  return {mode:mode as Mode,providerMode:providerMode as ProviderMode,host,port:Number(process.env.PROOFBOUND_PORT??3001),origin,dbPath:process.env.PROOFBOUND_DB_PATH??resolve(repoRoot,".data",`proofbound-${mode}.sqlite`),contractId:process.env.NEAR_CONTRACT_ID??null,rpcUrl:process.env.NEAR_RPC_URL??"https://rpc.testnet.near.org",allowChainWrites,model:process.env.NEAR_AI_MODEL??"Qwen/Qwen3-VL-30B-A3B-Instruct",maxLiveRequests,maxLiveTokens,jobTimeoutMs:Number(process.env.PROOFBOUND_JOB_TIMEOUT_MS??90000),proxyToken,demoAccounts,creditDemo};
}
