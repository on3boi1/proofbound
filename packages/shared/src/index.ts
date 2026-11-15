/** Public transport types. All NEAR values are integer yoctoNEAR strings. */
export type Mode = "local" | "testnet";
export type ProviderMode = "fixture" | "live";
export type OperatingMode = "private" | "marketplace" | "hybrid";
export type JobKind = "private" | "marketplace";
export type JobStatus = "queued" | "running" | "submitted" | "verifying" | "completed" | "failed" | "cancelled" | "expired" | "refunded";
export type ToolId = "near-rpc" | "near-docs" | "calculator";
export const TOOLS: { id: ToolId; name: string; description: string }[] = [
  { id: "near-rpc", name: "NEAR public RPC", description: "Read finalized testnet network data. No transaction access." },
  { id: "near-docs", name: "NEAR documentation", description: "Read the approved official documentation snapshot." },
  { id: "calculator", name: "Bounded calculator", description: "Validate deterministic arithmetic over source data." },
];
export const LOCAL_ACCOUNTS = ["owner.local", "customer-one.local", "customer-two.local", "customer-three.local", "buyer.local"] as const;
export const ACCEPTANCE_CRITERIA = ["Structured report with summary, findings, and uncertainties", "Every finding references an approved source identifier", "Source content and report hashes match the execution evidence", "Numeric calculations reproduce from source values", "Provider usage stays within the agreed Fuel budget"];
export const ECONOMICS = {
  fuelUnitPrice: "1000000000000000000", initialFuel: 100000,
  mintStorage: "50000000000000000000000", mintCompute: "100000000000000000000000", mintPlatform: "10000000000000000000000",
  mintTotal: "160000000000000000000000", jobStorage: "20000000000000000000000",
  defaultServiceFee: "10000000000000000000000", defaultFuelBudget: 8000,
  platformBps: 1000, maxConcurrency: 3,
};
export interface AgentConfig {
  instructions: string; allowedTools: ToolId[]; mode: OperatingMode; active: boolean;
  maxConcurrent: number; maxFuelPerJob: number; serviceFee: string; reinvestBps: number;
}
export interface Agent extends AgentConfig {
  id: string; tokenId: string; name: string; ownerId: string; specialization: "Research"; templateId: "near-research-v1";
  configVersion: number; configHash: string; ownershipEpoch: number; fuelAvailable: number; fuelReserved: number;
  activeJobs: number; verifiedJobs: number; paidVerifiedJobs: number; privateVerifiedJobs: number; failedJobs: number;
  lifetimeEarnings: string; createdAt: string; updatedAt: string; network: Mode; example: boolean;
}
export interface ResearchInput { topic: string; focus: "ecosystem" | "network" | "economics"; }
export interface SourceEvidence { id: string; title: string; url: string; retrievedAt: string; content: string; sha256: string; fixture: boolean; }
export interface Finding { title: string; detail: string; sourceIds: string[]; }
export interface Calculation { label: string; operation: "add" | "subtract" | "multiply" | "divide"; operands: string[]; result: string; sourceIds: string[]; }
export interface ResearchReport { title: string; summary: string; findings: Finding[]; uncertainties: string[]; calculations: Calculation[]; sourceIds: string[]; }
export interface ResourceReceipt {
  provider: "fixture" | "near-ai"; model: string; requestId: string; inputTokens: number; outputTokens: number;
  totalTokens: number; fuelUsed: number; measurement: "fixture-token-estimate" | "provider-reported";
  estimatedCostUsd: string | null; costNote: string; startedAt: string; endedAt: string;
}
export interface VerificationCheck { name: string; passed: boolean; detail: string; }
export interface Verification { version: "proofguarantee-v1"; accepted: boolean; checks: VerificationCheck[]; outputHash: string; evidenceHash: string; verifiedAt: string; trust: string; }
export interface Settlement {
  serviceFee: string; ownerGross: string; ownerClaimable: string; platformFee: string; computeCharged: string;
  customerRefund: string; reinvested: string; fuelAdded: number; storageCharged: string; settledAt: string;
  network: Mode; transactionHash: string | null;
}
export interface Job {
  id: string; agentId: string; agentName: string; customerId: string; ownerAtSubmission: string; kind: JobKind;
  input?: ResearchInput; title: string; configVersion: number; ownershipEpoch: number; configHash: string;
  requestHash: string; status: JobStatus; fuelBudget: number; fuelUsed: number; serviceFee: string; computeAllowance: string;
  deposit: string; createdAt: string; updatedAt: string; deadline: string; startedAt: string | null; completedAt: string | null;
  attempts: number; providerMode: ProviderMode; report?: ResearchReport; sources?: SourceEvidence[]; resourceReceipt?: ResourceReceipt;
  verification?: Verification; settlement?: Settlement; error?: string; publicEvidence: boolean; reputationEligible: boolean;
  network: Mode; transactionHash: string | null;
}
export interface LedgerEntry { id: string; agentId: string | null; jobId: string | null; accountId: string; kind: string; amount: string; fuelDelta: number; timestamp: string; network: Mode; transactionHash: string | null; note: string; }
export interface PassportEvent { id: string; agentId: string; kind: "mint" | "configuration" | "ownership" | "job" | "security"; timestamp: string; configVersion: number; ownershipEpoch: number; detail: string; evidenceHash: string | null; jobId: string | null; transactionHash?: string; }
export interface Session { accountId: string; mode: Mode; expiresAt: string; }
export interface RuntimeInfo { mode: Mode; providerMode: ProviderMode; contractId: string | null; network: "local" | "testnet"; liveEnabled: boolean; workerRunning: boolean; activeExecutions: number; peakConcurrency: number; disclaimer: string; readOnly?: boolean; }
export interface Bootstrap { runtime: RuntimeInfo; session: Session | null; agents: Agent[]; jobs: Job[]; ledger: LedgerEntry[]; balance: string; economics: typeof ECONOMICS; localAccounts: readonly string[]; }
export interface JobQuote { serviceFee: string; computeAllowance: string; storageFee: string; totalDeposit: string; fuelBudget: number; acceptanceCriteria: string[]; refundTerms: string; deadline: string; }
export interface TransactionIntent { receiverId: string; actions: { type: "FunctionCall"; params: { methodName: string; args: Record<string, unknown>; gas: string; deposit: string; }; }[]; description: string; }
export function formatNear(yocto: string, precision = 4): string {
  const n = BigInt(yocto || "0"), sign = n < 0n ? "-" : "", abs = n < 0n ? -n : n;
  const whole = abs / 10n ** 24n, frac = (abs % 10n ** 24n).toString().padStart(24, "0").slice(0, precision).replace(/0+$/, "");
  return sign + whole.toString() + (frac ? "." + frac : "");
}
export function parseNear(value: string): string {
  if (!/^\d+(\.\d{1,24})?$/.test(value)) throw new Error("Enter a positive NEAR amount with at most 24 decimal places.");
  const [whole, fraction = ""] = value.split(".");
  return (BigInt(whole) * 10n ** 24n + BigInt(fraction.padEnd(24, "0"))).toString();
}
