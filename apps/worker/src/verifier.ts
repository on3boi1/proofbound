import { ECONOMICS, type Calculation, type Job, type ResearchReport, type ResourceReceipt, type SourceEvidence, type Verification, type VerificationCheck } from "../../../packages/shared/src/index.ts";
import { hashObject, sha256 } from "./hash.ts";

export function calculate(c: Calculation): string {
  if (c.operands.length!==2 || !c.operands.every(v=>/^-?\d{1,39}$/.test(v))) throw new Error("Exactly two integer operands required.");
  const [a,b]=c.operands.map(BigInt);
  switch(c.operation) {
    case "add": return (a+b).toString(); case "subtract": return (a-b).toString();
    case "multiply": return (a*b).toString(); case "divide": if (!b || a%b!==0n) throw new Error("Only exact integer division supported."); return (a/b).toString();
    default: throw new Error("Unsupported operation.");
  }
}
/** A deterministic verifier outside the model context. A pass verifies bounded evidence, not truth. */
export function verifyReport(job: Pick<Job,"fuelBudget"|"providerMode"|"serviceFee"> & { pricing?: { fuelUnitPrice: string; storageFee: string; platformBps: number } }, report: ResearchReport, sources: SourceEvidence[], usage: ResourceReceipt, now = Date.now()): Verification {
  const checks: VerificationCheck[]=[];
  const add=(name:string,passed:boolean,detail:string)=>checks.push({name,passed,detail});
  const ids=new Set(sources.map(s=>s.id));
  const text=(v:unknown)=>typeof v==="string" && v.trim().length>0;
  add("Required deliverables", text(report?.title)&&text(report?.summary)&&Array.isArray(report?.findings)&&report.findings.length>=2&&report.findings.every(f=>text(f.title)&&text(f.detail))&&Array.isArray(report?.uncertainties)&&report.uncertainties.length>0&&report.uncertainties.every(text), "Report includes a title, summary, at least two findings, and explicit uncertainties.");
  add("Approved citations", sources.length>0&&Array.isArray(report?.sourceIds)&&report.sourceIds.length>0&&report.sourceIds.every(id=>ids.has(id))&&Array.isArray(report?.findings)&&report.findings.every(f=>Array.isArray(f.sourceIds)&&f.sourceIds.length>0&&f.sourceIds.every(id=>ids.has(id))), "All citations resolve to source snapshots fetched by the approved tools.");
  add("Evidence integrity", ids.size===sources.length&&sources.every(s=>sha256(s.content)===s.sha256), "Every source content hash matches its captured bytes.");
  add("Source freshness", sources.every(s=>s.fixture ? job.providerMode==="fixture" : Number.isFinite(Date.parse(s.retrievedAt))&&Math.abs(now-Date.parse(s.retrievedAt))<=15*60*1000), job.providerMode==="fixture" ? "Fixture snapshots are intentionally historical, explicitly labeled, and not live data." : "Live source snapshots were retrieved within 15 minutes.");
  let numeric=Array.isArray(report?.calculations)&&report.calculations.length>0;
  try {
    const policy=JSON.parse(sources.find(s=>s.id==="fuel-policy")?.content??"null");
    const expectedPrice=job.pricing?.fuelUnitPrice??ECONOMICS.fuelUnitPrice;
    numeric=numeric&&policy?.fuel_unit_price_yocto===expectedPrice&&policy.service_fee_yocto===job.serviceFee
      &&policy.job_storage_fee_yocto===(job.pricing?.storageFee??ECONOMICS.jobStorage)
      &&policy.platform_basis_points===(job.pricing?.platformBps??ECONOMICS.platformBps)
      &&report.calculations.some(c=>c.label==="Maximum execution allowance (yoctoNEAR)");
    const bound=(c:Calculation)=>{
      if(c.sourceIds.length!==1||c.sourceIds[0]!=="fuel-policy")return false;
      if(c.label==="Maximum execution allowance (yoctoNEAR)")return c.operation==="multiply"&&c.operands[0]===String(policy.job_fuel_budget)&&c.operands[1]===policy.fuel_unit_price_yocto&&policy.job_fuel_budget===job.fuelBudget;
      if(c.label==="Platform share of service fee (yoctoNEAR, exact for this quote)")return c.operation==="divide"&&c.operands[0]===policy.service_fee_yocto&&c.operands[1]==="10"&&policy.platform_basis_points===1000;
      return false;
    };
    numeric=numeric&&report.calculations.every(c=>calculate(c)===c.result&&bound(c));
  } catch { numeric=false; }
  add("Numerical consistency", numeric, "Each integer operation reproduces exactly and its operands match fields in the captured accounting policy. Prose claims are not mathematically certified.");
  add("Execution allowance", Number.isSafeInteger(usage.fuelUsed)&&usage.fuelUsed>0&&usage.fuelUsed<=job.fuelBudget&&usage.totalTokens===usage.inputTokens+usage.outputTokens&&usage.totalTokens===usage.fuelUsed, "Metered tokens are positive, reconcile, and remain within the reserved Fuel cap.");
  add("Provider labeling", job.providerMode==="fixture" ? usage.provider==="fixture"&&usage.measurement==="fixture-token-estimate"&&sources.every(s=>s.fixture) : usage.provider==="near-ai"&&usage.measurement==="provider-reported"&&sources.every(s=>!s.fixture), "Fixture execution and live provider usage cannot be presented interchangeably.");
  return {version:"proofguarantee-v1",accepted:checks.every(c=>c.passed),checks,outputHash:hashObject(report),evidenceHash:hashObject({sources,usage}),verifiedAt:new Date(now).toISOString(),trust:"Deterministic checks operated by a trusted verifier. This is not a trustless proof or a guarantee of factual truth."};
}
