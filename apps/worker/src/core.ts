import { randomUUID } from "node:crypto";
import { ACCEPTANCE_CRITERIA, ECONOMICS, LOCAL_ACCOUNTS, TOOLS, type Agent, type AgentConfig, type Bootstrap, type Job, type JobKind, type JobQuote, type LedgerEntry, type PassportEvent, type ResearchInput, type ResearchReport, type ResourceReceipt, type RuntimeInfo, type Settlement, type SourceEvidence, type Verification } from "../../../packages/shared/src/index.ts";
import { Store } from "./store.ts";
import { AppError, amount, boundedInteger, boundedText, invariant } from "./errors.ts";
import { hashObject } from "./hash.ts";
import type { RuntimeConfig } from "./config.ts";
import { assertToolAllowed } from "./research.ts";

export const TERMINAL = new Set(["completed","failed","cancelled","expired","refunded"]);
export interface StoredJob extends Job { configSnapshot: AgentConfig; idempotencyKey: string; input: ResearchInput; pricing?: { fuelUnitPrice: string; storageFee: string; platformBps: number }; }
export interface AccountBalance { claimable: string; wallet: string; }
export const defaultAgentConfig = (): AgentConfig => ({ instructions:"Research NEAR using approved sources. Separate observed facts, calculations, and uncertainty. Never execute financial actions.",allowedTools:["near-rpc","near-docs","calculator"],mode:"private",active:false,maxConcurrent:3,maxFuelPerJob:8000,serviceFee:ECONOMICS.defaultServiceFee,reinvestBps:0 });
const now=()=>new Date().toISOString();
export function validateConfig(input: AgentConfig): AgentConfig {
  const instructions=boundedText(input.instructions,1,1500,"Instructions");
  invariant(Array.isArray(input.allowedTools)&&input.allowedTools.length<=3&&input.allowedTools.every(t=>TOOLS.some(allowed=>allowed.id===t))&&new Set(input.allowedTools).size===input.allowedTools.length,"UNAPPROVED_TOOL","Only listed read-only tools are allowed.");
  invariant(input.allowedTools.includes("calculator")&&input.allowedTools.includes("near-docs"),"REQUIRED_TOOL","Research requires the documentation and calculator tools.");
  invariant(["private","marketplace","hybrid"].includes(input.mode),"INVALID_MODE","Unknown operating mode.");
  invariant(typeof input.active==="boolean","INVALID_INPUT","Active must be true or false.");
  const maxConcurrent=boundedInteger(input.maxConcurrent,1,3,"Concurrent capacity"), maxFuelPerJob=boundedInteger(input.maxFuelPerJob,1000,20000,"Fuel cap"), reinvestBps=boundedInteger(input.reinvestBps,0,10000,"Reinvestment percentage in basis points");
  const fee=amount(input.serviceFee,"Service fee"); invariant(fee>0n&&fee<=10n**24n,"INVALID_PRICE","Service fee must be positive and at most 1 testnet NEAR.");
  return {...input,instructions,maxConcurrent,maxFuelPerJob,reinvestBps,allowedTools:[...input.allowedTools].sort(),serviceFee:fee.toString()};
}
export function validateInput(input: unknown): ResearchInput {
  invariant(input&&typeof input==="object","INVALID_INPUT","A structured research request is required.");
  const r=input as Record<string,unknown>, topic=boundedText(r.topic,8,600,"Research topic");
  invariant(["ecosystem","network","economics"].includes(String(r.focus)),"UNSUPPORTED_TASK","Choose ecosystem, network, or economics research.");
  return {topic,focus:r.focus as ResearchInput["focus"]};
}
export class Core {
  peakConcurrency=0;
  constructor(readonly store: Store, readonly config: RuntimeConfig) {}
  assertLocal(): void { invariant(this.config.mode==="local","CHAIN_REQUIRED","This action requires a confirmed NEAR testnet transaction.",409); }
  account(id:string): AccountBalance { return this.store.get<AccountBalance>("balance",id)??{claimable:"0",wallet:LOCAL_ACCOUNTS.includes(id as typeof LOCAL_ACCOUNTS[number])?(100n*10n**24n).toString():"0"}; }
  ensureLocalAccount(id:string): void { invariant(LOCAL_ACCOUNTS.includes(id as typeof LOCAL_ACCOUNTS[number]),"INVALID_ACCOUNT","Choose a documented local demonstration account."); }
  debitWallet(id:string,n:bigint): void { const b=this.account(id); invariant(BigInt(b.wallet)>=n,"INSUFFICIENT_BALANCE","The local demonstration wallet has insufficient funds."); this.store.put("balance",id,{...b,wallet:(BigInt(b.wallet)-n).toString()}); }
  credit(id:string,n:bigint): void { const b=this.account(id); this.store.put("balance",id,{...b,claimable:(BigInt(b.claimable)+n).toString()}); }
  agent(id:string): Agent { const a=this.store.get<Agent>("agent",id); invariant(a,"NOT_FOUND","Agent not found.",404); return a; }
  owned(id:string,accountId:string): Agent { const a=this.agent(id); invariant(a.ownerId===accountId,"NOT_OWNER","Only the current NFT owner can perform this action.",403); return a; }
  job(id:string): StoredJob { const j=this.store.get<StoredJob>("job",id); invariant(j,"NOT_FOUND","Job not found.",404); return j; }
  ledger(accountId:string,kind:string,amountValue:bigint,fuelDelta=0,agentId:string|null=null,jobId:string|null=null,note=""): LedgerEntry {
    const entry:LedgerEntry={id:randomUUID(),agentId,jobId,accountId,kind,amount:amountValue.toString(),fuelDelta,timestamp:now(),network:this.config.mode,transactionHash:null,note}; this.store.put("ledger",entry.id,entry); return entry;
  }
  event(a:Agent,kind:PassportEvent["kind"],detail:string,evidenceHash:string|null=null,jobId:string|null=null): void {
    const e:PassportEvent={id:randomUUID(),agentId:a.id,kind,timestamp:now(),configVersion:a.configVersion,ownershipEpoch:a.ownershipEpoch,detail,evidenceHash,jobId};this.store.put("event",e.id,e);
  }
  listAgents(accountId?:string|null,owned=false): Agent[] { return this.store.list<Agent>("agent").filter(a=>owned ? a.ownerId===accountId : a.ownerId===accountId||a.mode!=="private").map(a=>this.publicAgent(a,accountId)); }
  publicAgent(a:Agent,accountId?:string|null): Agent { return a.ownerId===accountId ? a : {...a,instructions:"Private owner configuration",fuelAvailable:0,fuelReserved:0}; }
  publicJob(job:Job): Job {
    const {input,report,sources,resourceReceipt,error,...safe}=job;
    return {...safe,title:job.kind==="private"?"Private research job":"Research service",verification:job.verification?{...job.verification,checks:job.verification.checks.map(c=>({...c}))}:undefined};
  }
  visibleJob(job:StoredJob,accountId?:string|null,publicOnly=false): Job {
    const {configSnapshot,idempotencyKey,pricing,...clean}=job;
    if (!publicOnly&&(job.customerId===accountId||job.ownerAtSubmission===accountId)) return clean;
    return this.publicJob(clean);
  }
  jobsFor(accountId:string): Job[] { return this.store.list<StoredJob>("job").filter(j=>j.customerId===accountId||j.ownerAtSubmission===accountId).map(j=>this.visibleJob(j,accountId)).reverse(); }
  getJob(id:string,accountId:string): Job { const j=this.job(id); invariant(j.customerId===accountId||j.ownerAtSubmission===accountId,"JOB_PRIVATE","This job belongs to another customer or ownership epoch.",403);return this.visibleJob(j,accountId); }
  detail(id:string,accountId?:string|null) {
    const a=this.agent(id); invariant(a.mode!=="private"||a.ownerId===accountId,"NOT_FOUND","Agent not publicly listed.",404);
    return {agent:this.publicAgent(a,accountId),jobs:this.store.list<StoredJob>("job").filter(j=>j.agentId===id).map(j=>this.visibleJob(j,accountId)).reverse(),passport:this.store.list<PassportEvent>("event").filter(e=>e.agentId===id).reverse(),ledger:a.ownerId===accountId?this.store.list<LedgerEntry>("ledger").filter(l=>l.agentId===id&&l.accountId===accountId).reverse():[]};
  }
  passport(id: string, accountId?: string | null) {
    const agent = this.agent(id);
    return {
      agent: this.publicAgent(agent, accountId),
      events: this.store.list<PassportEvent>("event").filter(event => event.agentId === id).reverse(),
      jobs: this.store.list<StoredJob>("job").filter(job => job.agentId === id && TERMINAL.has(job.status))
        .map(job => this.visibleJob(job, accountId, true)).reverse(),
    };
  }
  mint(accountId:string,input:Record<string,unknown>): Agent {
    this.assertLocal(); this.ensureLocalAccount(accountId);
    const name=boundedText(input.name,2,48,"Agent name"), config=validateConfig({...defaultAgentConfig(),...(input.instructions?{instructions:input.instructions as string}:{}),...(input.allowedTools?{allowedTools:input.allowedTools as AgentConfig["allowedTools"]}:{}),...(input.mode?{mode:input.mode as AgentConfig["mode"]}:{})});
    return this.store.transaction(()=>{
      this.debitWallet(accountId,BigInt(ECONOMICS.mintTotal));const id=String(this.store.next("agent")),date=now();
      const a:Agent={...config,id,tokenId:id,name,ownerId:accountId,specialization:"Research",templateId:"near-research-v1",configVersion:1,configHash:hashObject(config),ownershipEpoch:1,fuelAvailable:ECONOMICS.initialFuel,fuelReserved:0,activeJobs:0,verifiedJobs:0,paidVerifiedJobs:0,privateVerifiedJobs:0,failedJobs:0,lifetimeEarnings:"0",createdAt:date,updatedAt:date,network:"local",example:false};
      this.store.put("agent",id,a);this.store.put("config",`${id}:1`,config);this.event(a,"mint","Minted Research Agent with 100,000 prepaid Fuel. Local ledger; no blockchain transaction.",a.configHash);
      this.ledger(accountId,"mint",-BigInt(ECONOMICS.mintTotal),ECONOMICS.initialFuel,id,null,"0.05 storage + 0.10 compute + 0.01 platform, simulated NEAR.");
      this.credit("platform.local",BigInt(ECONOMICS.mintPlatform));
      this.ledger("platform.local","mint_platform_fee",BigInt(ECONOMICS.mintPlatform),0,id);
      return a;
    });
  }
  configure(id:string,accountId:string,patch:Record<string,unknown>): Agent {
    this.assertLocal();
    const allowed=["instructions","allowedTools","mode","active","maxConcurrent","maxFuelPerJob","serviceFee","reinvestBps"];
    invariant(Object.keys(patch).every(k=>allowed.includes(k)),"FORBIDDEN_FIELD","Ownership, earnings, permissions, and balances cannot be overwritten.",403);
    return this.store.transaction(()=>{
      const a=this.owned(id,accountId),c=validateConfig({...defaultAgentConfig(),...a,...patch});
      const snapshot:AgentConfig={instructions:c.instructions,allowedTools:c.allowedTools,mode:c.mode,active:c.active,maxConcurrent:c.maxConcurrent,maxFuelPerJob:c.maxFuelPerJob,serviceFee:c.serviceFee,reinvestBps:c.reinvestBps};
      const updated={...a,...snapshot,configVersion:a.configVersion+1,configHash:hashObject(snapshot),updatedAt:now()};
      this.store.put("agent",id,updated);this.store.put("config",`${id}:${updated.configVersion}`,snapshot);this.event(updated,"configuration",`Configuration v${updated.configVersion}: ${updated.mode}, ${updated.active?"active":"paused"}.`,updated.configHash);return updated;
    });
  }
  topup(id:string,accountId:string,value:unknown): Agent {
    this.assertLocal();const n=amount(value);invariant(n>0n&&n<=10n**24n&&n%BigInt(ECONOMICS.fuelUnitPrice)===0n,"INVALID_AMOUNT","Top-up must be a positive whole number of Fuel units, at most 1 testnet NEAR.");
    return this.store.transaction(()=>{const a=this.owned(id,accountId),fuel=Number(n/BigInt(ECONOMICS.fuelUnitPrice));invariant(a.fuelAvailable+a.fuelReserved+fuel<=1e12,"FUEL_LIMIT","Total Fuel cannot exceed the contract's safe integer bound.");this.debitWallet(accountId,n);a.fuelAvailable+=fuel;a.updatedAt=now();this.store.put("agent",id,a);this.ledger(accountId,"fuel_topup",-n,fuel,id,null,"Direct funded Fuel allocation, local simulation.");return a;});
  }
  transfer(id:string,accountId:string,receiverId:unknown): Agent {
    this.assertLocal();const receiver=boundedText(receiverId,2,64,"New owner");this.ensureLocalAccount(receiver);
    return this.store.transaction(()=>{
      const a=this.owned(id,accountId);invariant(receiver!==accountId,"SAME_OWNER","Choose a different owner.");invariant(a.activeJobs===0&&!this.store.list<StoredJob>("job").some(j=>j.agentId===id&&!TERMINAL.has(j.status)),"ACTIVE_OBLIGATIONS","Resolve every active job before transferring ownership.",409);
      const clean={...defaultAgentConfig(),active:false,mode:"private" as const,reinvestBps:0};
      const transferred:Agent={...a,...clean,ownerId:receiver,ownershipEpoch:a.ownershipEpoch+1,configVersion:a.configVersion+1,configHash:hashObject(clean),updatedAt:now()};
      this.store.put("agent",id,transferred);this.store.put("config",`${id}:${transferred.configVersion}`,clean);this.event(transferred,"ownership",`Transferred from ${accountId} to ${receiver}. Permissions revoked; buyer activation required.`);return transferred;
    });
  }
  quote(id:string,kind:JobKind,fuelBudget?:number): JobQuote {
    const a=this.agent(id);invariant(kind==="private"||kind==="marketplace","INVALID_INPUT","Unknown job kind.");
    const fuel=boundedInteger(fuelBudget??Math.min(a.maxFuelPerJob,ECONOMICS.defaultFuelBudget),1000,a.maxFuelPerJob,"Fuel budget"),service=kind==="marketplace"?BigInt(a.serviceFee):0n,compute=kind==="marketplace"?BigInt(fuel)*BigInt(ECONOMICS.fuelUnitPrice):0n;
    return {serviceFee:service.toString(),computeAllowance:compute.toString(),storageFee:ECONOMICS.jobStorage,totalDeposit:(service+compute+BigInt(ECONOMICS.jobStorage)).toString(),fuelBudget:fuel,acceptanceCriteria:ACCEPTANCE_CRITERIA,refundTerms:"On failure or eligible cancellation: full service and compute allowance refunded; 0.02 NEAR persistent storage is retained. Failed provider usage is borne by the operator. Unused successful compute allowance is refunded.",deadline:new Date(Date.now()+10*60*1000).toISOString()};
  }
  submit(accountId:string,body:Record<string,unknown>): Job {
    this.assertLocal();const input=validateInput(body.input),agentId=boundedText(body.agentId,1,64,"Agent ID"),key=boundedText(body.idempotencyKey,8,100,"Idempotency key"),kind=body.kind as JobKind;
    const payloadHash=hashObject({agentId,kind,input,fuelBudget:body.fuelBudget??null});
    return this.store.transaction(()=>{
      const keyId=hashObject([accountId,key]),prior=this.store.get<{jobId:string;payloadHash:string}>("idempotency",keyId);
      if(prior){invariant(prior.payloadHash===payloadHash,"IDEMPOTENCY_CONFLICT","The same request key was used for different job details.",409);return this.visibleJob(this.job(prior.jobId),accountId);}
      const a=this.agent(agentId);invariant(a.active,"AGENT_PAUSED","Activate this agent before assigning new work.",409);
      invariant(a.activeJobs<a.maxConcurrent,"CAPACITY_REACHED","This agent has reached its concurrent job capacity.",409);
      if(kind==="private"){invariant(a.ownerId===accountId,"NOT_OWNER","Only the current owner can submit private work.",403);invariant(a.mode!=="marketplace","MODE_RESTRICTED","This agent currently accepts marketplace work only.");}
      else {invariant(kind==="marketplace"&&a.mode!=="private","MODE_RESTRICTED","This agent is not accepting marketplace jobs.");invariant(a.ownerId!==accountId,"SELF_HIRE","Self-hiring is disabled. Submit a private job instead.");}
      const quote=this.quote(agentId,kind,body.fuelBudget as number|undefined);
      if(kind==="private"){invariant(a.fuelAvailable>=quote.fuelBudget,"INSUFFICIENT_FUEL","Top up Fuel before reserving this job.",409);a.fuelAvailable-=quote.fuelBudget;a.fuelReserved+=quote.fuelBudget;}
      this.debitWallet(accountId,BigInt(quote.totalDeposit));a.activeJobs++;a.updatedAt=now();
      const id=randomUUID(),date=now(),configSnapshot=this.store.get<AgentConfig>("config",`${a.id}:${a.configVersion}`)!;
      const j:StoredJob={id,agentId,agentName:a.name,customerId:accountId,ownerAtSubmission:a.ownerId,kind,input,title:input.topic,configVersion:a.configVersion,ownershipEpoch:a.ownershipEpoch,configHash:a.configHash,requestHash:hashObject({input,configHash:a.configHash,fuelBudget:quote.fuelBudget,kind,deadline:quote.deadline}),status:"queued",fuelBudget:quote.fuelBudget,fuelUsed:0,serviceFee:quote.serviceFee,computeAllowance:quote.computeAllowance,deposit:quote.totalDeposit,createdAt:date,updatedAt:date,deadline:quote.deadline,startedAt:null,completedAt:null,attempts:0,providerMode:this.config.providerMode,publicEvidence:kind==="marketplace",reputationEligible:false,network:"local",transactionHash:null,configSnapshot,idempotencyKey:key};
      this.store.put("agent",a.id,a);this.store.put("job",id,j);this.store.put("idempotency",keyId,{jobId:id,payloadHash});this.ledger(accountId,"job_reserved",-BigInt(quote.totalDeposit),0,a.id,id,kind==="private"?`${quote.fuelBudget} Fuel moved from available to reserved; total Fuel unchanged. Storage charged.`:"Service and compute deposited into isolated local escrow; storage charged.");return this.visibleJob(j,accountId);
    });
  }
  claimJobs(globalLimit=6): StoredJob[] {
    return this.store.transaction(()=>{
      const jobs=this.store.list<StoredJob>("job"),running=jobs.filter(j=>["running","submitted","verifying"].includes(j.status));let slots=globalLimit-running.length;
      const selected:StoredJob[]=[];
      for(const j of jobs.filter(j=>j.status==="queued")){
        if(slots<=0) break;if(this.config.mode==="local"&&Date.parse(j.deadline)<=Date.now()){this.failInside(j,"expired","Execution deadline passed.");continue;}
        const a=this.agent(j.agentId),already=running.filter(x=>x.agentId===j.agentId).length+selected.filter(x=>x.agentId===j.agentId).length;
        if(already>=a.maxConcurrent)continue;
        j.status="running";j.attempts++;j.startedAt=now();j.updatedAt=now();this.store.put("job",j.id,j);selected.push(j);slots--;
      }
      this.peakConcurrency=Math.max(this.peakConcurrency,running.length+selected.length);this.store.put("meta","peakConcurrency",this.peakConcurrency);return selected;
    });
  }
  updateExecution(id:string,patch:Partial<StoredJob>): void { this.store.transaction(()=>{const j=this.job(id);if(TERMINAL.has(j.status))return;this.store.put("job",id,{...j,...patch,updatedAt:now()});}); }
  settle(id:string,report:ResearchReport,sources:SourceEvidence[],receipt:ResourceReceipt,verification:Verification): Job {
    this.assertLocal();return this.store.transaction(()=>{
      const j=this.job(id);if(TERMINAL.has(j.status))return this.visibleJob(j,j.customerId);
      invariant(["running","submitted","verifying"].includes(j.status),"INVALID_STATE","Job has not started.",409);
      j.report=report;j.sources=sources;j.resourceReceipt=receipt;j.verification=verification;j.fuelUsed=receipt.fuelUsed;
      if(!verification.accepted){this.failInside(j,j.kind==="marketplace"?"refunded":"failed","ProofGuarantee rejected the report.");return this.visibleJob(j,j.customerId);}
      invariant(receipt.fuelUsed<=j.fuelBudget,"BUDGET_EXCEEDED","Execution exceeded the reserved budget.");
      const a=this.agent(j.agentId),service=BigInt(j.serviceFee),platform=service*1000n/10000n,ownerGross=service-platform,compute=BigInt(receipt.fuelUsed)*BigInt(ECONOMICS.fuelUnitPrice),reinvestRequested=ownerGross*BigInt(j.configSnapshot.reinvestBps)/10000n;
      // Only whole Fuel units are allocated. Remainder remains claimable by the owner.
      const fuelAdded=Math.min(Number(reinvestRequested/BigInt(ECONOMICS.fuelUnitPrice)),1e12-a.fuelAvailable-a.fuelReserved),reinvest=BigInt(fuelAdded)*BigInt(ECONOMICS.fuelUnitPrice),refund=j.kind==="marketplace"?BigInt(j.computeAllowance)-compute:0n;
      if(j.kind==="private"){a.fuelReserved-=j.fuelBudget;a.fuelAvailable+=j.fuelBudget-receipt.fuelUsed;}
      invariant(a.fuelAvailable+a.fuelReserved+fuelAdded<=1e12,"FUEL_LIMIT","Earn-to-Refill exceeds the contract Fuel bound.");a.fuelAvailable+=fuelAdded;a.activeJobs--;a.verifiedJobs++;a.lifetimeEarnings=(BigInt(a.lifetimeEarnings)+ownerGross).toString();a.updatedAt=now();
      if(j.kind==="private")a.privateVerifiedJobs++;
      const previous=this.store.list<StoredJob>("job").filter(x=>x.id!==id&&x.reputationEligible);
      const duplicate=previous.some(x=>x.verification?.outputHash===verification.outputHash);
      const repeatedCustomer=previous.some(x=>x.agentId===j.agentId&&x.customerId===j.customerId&&x.ownershipEpoch===j.ownershipEpoch);
      j.reputationEligible=j.kind==="marketplace"&&j.customerId!==j.ownerAtSubmission&&!duplicate&&!repeatedCustomer;
      if(j.reputationEligible)a.paidVerifiedJobs++;
      const settlement:Settlement={serviceFee:j.serviceFee,ownerGross:ownerGross.toString(),ownerClaimable:(ownerGross-reinvest).toString(),platformFee:platform.toString(),computeCharged:compute.toString(),customerRefund:refund.toString(),reinvested:reinvest.toString(),fuelAdded,storageCharged:ECONOMICS.jobStorage,settledAt:now(),network:"local",transactionHash:null};
      this.credit(j.ownerAtSubmission,ownerGross-reinvest);this.credit("platform.local",platform+compute);this.credit(j.customerId,refund);
      j.status="completed";j.completedAt=now();j.updatedAt=now();j.settlement=settlement;
      this.store.put("agent",a.id,a);this.store.put("job",id,j);
      this.ledger(j.ownerAtSubmission,"owner_earnings",ownerGross,0,a.id,id,"90% service allocation before funded Earn-to-Refill.");
      this.ledger("platform.local","platform_fee",platform,0,a.id,id,"10% of service fee only.");
      this.ledger("platform.local","compute_usage",compute,0,a.id,id,"Provider externally subsidized; integer testnet compute accounting.");
      if(refund>0n)this.ledger(j.customerId,"unused_compute_refund",refund,0,a.id,id);
      if(reinvest>0n)this.ledger(j.ownerAtSubmission,"earn_to_refill",-reinvest,fuelAdded,a.id,id,"Earned service funds allocated to prepaid compute.");
      if(j.kind==="private")this.ledger(j.customerId,"fuel_consumed",0n,-receipt.fuelUsed,a.id,id,"Unused reservation released.");
      this.event(a,"job",`Verified ${j.kind} research job. ${j.reputationEligible?"Eligible independent customer evidence.":"Excluded from independent-customer score (private, repeated customer, or duplicate output)."}`,verification.evidenceHash,j.id);
      return this.visibleJob(j,j.customerId);
    });
  }
  private failInside(j:StoredJob,status:"failed"|"cancelled"|"expired"|"refunded",reason:string): void {
    if(TERMINAL.has(j.status))return;
    const a=this.agent(j.agentId);a.activeJobs--;a.failedJobs+=status==="cancelled"?0:1;
    if(j.kind==="private"){a.fuelReserved-=j.fuelBudget;a.fuelAvailable+=j.fuelBudget;}
    const refund=BigInt(j.serviceFee)+BigInt(j.computeAllowance);this.credit(j.customerId,refund);
    j.status=j.kind==="marketplace"?"refunded":status==="refunded"?"failed":status;j.error=reason;j.updatedAt=now();j.completedAt=now();j.reputationEligible=false;
    j.settlement={serviceFee:j.serviceFee,ownerGross:"0",ownerClaimable:"0",platformFee:"0",computeCharged:"0",customerRefund:refund.toString(),reinvested:"0",fuelAdded:0,storageCharged:ECONOMICS.jobStorage,settledAt:now(),network:this.config.mode,transactionHash:null};
    this.store.put("agent",a.id,{...a,updatedAt:now()});this.store.put("job",j.id,j);this.ledger(j.customerId,status+"_refund",refund,0,a.id,j.id,`Full service/compute refund; ${j.kind==="private"?j.fuelBudget:0} reserved Fuel released. Total Fuel unchanged. Storage retained; failed provider cost is operator risk.`);this.event(a,"job",`${status}: research job did not earn successful reputation.`,j.verification?.evidenceHash??null,j.id);
  }
  fail(id:string,reason:string,status:"failed"|"expired"|"refunded"="failed"):void { this.assertLocal();this.store.transaction(()=>this.failInside(this.job(id),status,reason)); }
  cancel(id:string,accountId:string): Job { this.assertLocal();return this.store.transaction(()=>{const j=this.job(id);invariant(j.customerId===accountId,"NOT_CUSTOMER","Only the customer may cancel.",403);invariant(j.status==="queued","ALREADY_STARTED","Only queued jobs can be cancelled.",409);this.failInside(j,"cancelled","Cancelled before execution by the customer.");return this.visibleJob(j,accountId);}); }
  recover(): number { let count=0;this.store.transaction(()=>{for(const j of this.store.list<StoredJob>("job")){if(["running","submitted","verifying"].includes(j.status)){if(this.config.mode==="local"){this.failInside(j,"refunded","Worker restarted during execution. Reservation refunded; submit a new job to retry.");count++;}}}});return count; }
  withdraw(accountId:string):{balance:string;withdrawn:string} { this.assertLocal();return this.store.transaction(()=>{const b=this.account(accountId),n=BigInt(b.claimable);invariant(n>0n,"NOTHING_TO_WITHDRAW","No claimable balance.");this.store.put("balance",accountId,{claimable:"0",wallet:(BigInt(b.wallet)+n).toString()});this.ledger(accountId,"withdrawal",-n,0,null,null,"Claimable local balance returned to the simulated wallet.");return{balance:"0",withdrawn:n.toString()};}); }
  securityCheck(id:string,accountId:string,action:unknown):{allowed:false;code:string;message:string;enforcement:string;eventId:string} {
    const a=this.owned(id,accountId);invariant(["redirect-payout","override-budget","read-other-job","arbitrary-transaction"].includes(String(action)),"INVALID_INPUT","Choose a supported security probe.");
    const tool=String(action);let denied=false;try{assertToolAllowed(a.allowedTools,tool);}catch(error){if(error instanceof AppError&&error.code==="TOOL_NOT_ALLOWED")denied=true;else throw error;}invariant(denied,"INVALID_PROBE","Probe must exercise a denied financial action.");
    this.event(a,"security",`Denied runtime tool request: ${tool}. The model has no financial capability.`);return{allowed:false,code:"TOOL_NOT_ALLOWED",message:`${tool} is not an approved tool. Payout destinations and budget limits come from authenticated ledger/contract state.`,enforcement:this.config.mode==="local"?"Local runtime policy; corresponding onchain financial restrictions are tested separately.":"Runtime tool allowlist; onchain funds additionally require contract authorization.",eventId:this.store.list<PassportEvent>("event").at(-1)!.id};
  }
  runtime(workerRunning:boolean,activeExecutions:number): RuntimeInfo { return{mode:this.config.mode,providerMode:this.config.providerMode,contractId:this.config.contractId,network:this.config.mode,liveEnabled:!!process.env.NEAR_AI_API_KEY,workerRunning,activeExecutions,peakConcurrency:this.peakConcurrency,disclaimer:this.config.mode==="local"?"Local demonstration ledger. No blockchain transactions or real money. Fixture reports are labeled. Testnet economics are subsidized.":"NEAR testnet only. Testnet credits have no monetary value. Provider usage is externally funded; verifier is a trusted operator."}; }
}
