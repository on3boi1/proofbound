import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
}
export function readConfig(): RuntimeConfig {
  const mode=process.env.PROOFBOUND_MODE??"local", providerMode=process.env.PROOFBOUND_PROVIDER??"fixture";
  if (!(["local","testnet"] as string[]).includes(mode)) throw new Error("PROOFBOUND_MODE must be local or testnet.");
  if (!(["fixture","live"] as string[]).includes(providerMode)) throw new Error("PROOFBOUND_PROVIDER must be fixture or live.");
  if (mode==="testnet"&&!process.env.NEAR_CONTRACT_ID?.endsWith(".testnet")) throw new Error("Testnet requires a named .testnet NEAR_CONTRACT_ID.");
  const origin=process.env.PROOFBOUND_WEB_ORIGIN??"http://127.0.0.1:3000";
  new URL(origin);
  return {mode:mode as Mode,providerMode:providerMode as ProviderMode,host:process.env.PROOFBOUND_HOST??"127.0.0.1",port:Number(process.env.PROOFBOUND_PORT??3001),origin,dbPath:process.env.PROOFBOUND_DB_PATH??resolve(repoRoot,".data",`proofbound-${mode}.sqlite`),contractId:process.env.NEAR_CONTRACT_ID??null,rpcUrl:process.env.NEAR_RPC_URL??"https://rpc.testnet.near.org",allowChainWrites:process.env.PROOFBOUND_ALLOW_CHAIN_WRITES==="1",model:process.env.NEAR_AI_MODEL??"Qwen/Qwen3-VL-30B-A3B-Instruct",maxLiveRequests:Number(process.env.PROOFBOUND_MAX_LIVE_REQUESTS??10),maxLiveTokens:Number(process.env.PROOFBOUND_MAX_LIVE_TOKENS??80000),jobTimeoutMs:Number(process.env.PROOFBOUND_JOB_TIMEOUT_MS??90000)};
}
