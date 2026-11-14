import { randomUUID } from "node:crypto";
import { ACCEPTANCE_CRITERIA, ECONOMICS, type Agent, type AgentConfig, type JobKind, type JobQuote, type JobStatus, type Settlement, type TransactionIntent } from "../../../packages/shared/src/index.ts";
import type { RuntimeConfig } from "./config.ts";
import { AppError, boundedText, invariant } from "./errors.ts";
import { canonical, hashObject } from "./hash.ts";
import { Core, defaultAgentConfig, type StoredJob, validateConfig, validateInput } from "./core.ts";

export interface ChainAgent {token_id:string;owner_id:string;name:string;config_hash:string;config_version:number;ownership_epoch:number;mode:Agent["mode"];active:boolean;max_concurrent:number;max_fuel_per_job:number;service_fee:string;reinvest_bps:number;available_fuel:number;reserved_fuel:number;active_jobs:number;lifetime:{completed_personal:number;completed_paid:number;failed_personal:number;failed_paid:number;reputation_events:number};lifetime_service_revenue:string;created_at_ns:string;transfer_pending:boolean;}
export interface ChainJob {job_id:string;token_id:string;customer_id:string;owner_id:string;kind:JobKind;status:JobStatus;request_hash:string;config_hash:string;config_version:number;ownership_epoch:number;max_fuel:number;service_fee:string;compute_allowance:string;storage_fee:string;reinvest_bps:number;created_at_ns:string;deadline_ns:string;output_hash:string|null;evidence_hash:string|null;settlement:null|{accepted:boolean;outcome:string;actual_fuel:number;charged_fuel:number;owner_share:string;platform_share:string;compute_charge:string;customer_refund:string;reinvested:string;owner_claimable:string;reputation_awarded:boolean;output_hash:string;evidence_hash:string;settled_at_ns:string};}
interface ContractConfig {executor_id:string;verifier_id:string;treasury_id:string;mint_total:string;pricing:{fuel_unit_price:string;initial_fuel:number;mint_storage_fee:string;mint_platform_fee:string;job_storage_fee:string;default_service_fee:string};platform_fee_bps:number;}
interface PendingOperation {id:string;accountId:string;intent:TransactionIntent;kind:string;agentId?:string;config?:AgentConfig;job?:StoredJob;createdAt:number;confirmedHash?:string;result?:unknown;requestFingerprint?:string;}
const nsDate=(value:string)=>new Date(Number(BigInt(value)/1000000n)).toISOString();
const configurationKey = (tokenId: string, epoch: number, hash: string) => `${tokenId}:${epoch}:${hash}`;
export class Chain {
  private signing=Promise.resolve();
  private confirming=Promise.resolve();
  constructor(readonly core:Core){}
  get config():RuntimeConfig{return this.core.config;}
  async rpc<T>(method:string,params:unknown):Promise<T>{
    let response:Response;try{response=await fetch(this.config.rpcUrl,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:randomUUID(),method,params}),signal:AbortSignal.timeout(20000),redirect:"error"});}catch{throw new AppError("RPC_UNAVAILABLE","NEAR testnet RPC is unavailable.",503);}
    invariant(response.ok,"RPC_UNAVAILABLE",`NEAR testnet RPC returned HTTP ${response.status}.`,503);const data=await response.json() as {result:T;error?:unknown};invariant(!data.error,"RPC_ERROR","NEAR RPC could not complete the requested view. Check the network and contract configuration.",502);return data.result;
  }
  async view<T>(method_name:string,args:Record<string,unknown>):Promise<T>{invariant(this.config.contractId,"CONTRACT_NOT_CONFIGURED","Set the deployed testnet contract ID.",503);const r=await this.rpc<{result:number[]}>("query",{request_type:"call_function",finality:"final",account_id:this.config.contractId,method_name,args_base64:Buffer.from(JSON.stringify(args)).toString("base64")});return JSON.parse(Buffer.from(r.result).toString());}
  async accessKey(accountId:string,publicKey:string){return this.rpc<{permission:unknown}>("query",{request_type:"view_access_key",finality:"final",account_id:accountId,public_key:publicKey});}
  async contractConfig(){return this.view<ContractConfig>("get_config",{});}
  mapAgent(a:ChainAgent):Agent{
    const local=this.core.store.get<AgentConfig>("config-hash",configurationKey(a.token_id,a.ownership_epoch,a.config_hash)),defaults=defaultAgentConfig();
    return{...defaults,...local,id:a.token_id,tokenId:a.token_id,name:a.name,ownerId:a.owner_id,specialization:"Research",templateId:"near-research-v1",configVersion:a.config_version,configHash:a.config_hash,ownershipEpoch:a.ownership_epoch,mode:a.mode,active:a.active&&!a.transfer_pending,maxConcurrent:a.max_concurrent,maxFuelPerJob:a.max_fuel_per_job,serviceFee:a.service_fee,reinvestBps:a.reinvest_bps,fuelAvailable:a.available_fuel,fuelReserved:a.reserved_fuel,activeJobs:a.active_jobs,verifiedJobs:a.lifetime.completed_personal+a.lifetime.completed_paid,paidVerifiedJobs:a.lifetime.reputation_events,privateVerifiedJobs:a.lifetime.completed_personal,failedJobs:a.lifetime.failed_personal+a.lifetime.failed_paid,lifetimeEarnings:a.lifetime_service_revenue,createdAt:nsDate(a.created_at_ns),updatedAt:new Date().toISOString(),network:"testnet",example:false,instructions:local?.instructions??"Configuration is not available on this worker. The current owner must save approved instructions before execution."};
  }
  async refreshAgent(id:string):Promise<Agent>{const a=await this.view<ChainAgent|null>("get_agent",{token_id:id});invariant(a,"NOT_FOUND","Agent not found on the configured contract.",404);const mapped=this.mapAgent(a);this.core.store.put("agent",id,mapped);return mapped;}
  async refreshAgents():Promise<Agent[]>{const agents:Agent[]=[];for(let from=0;from<10000;from+=100){const page=await this.view<ChainAgent[]>("list_agents",{from_index:String(from),limit:100});for(const a of page){const mapped=this.mapAgent(a);this.core.store.put("agent",a.token_id,mapped);agents.push(mapped);}if(page.length<100)break;}return agents;}
  async owned(id:string,accountId:string):Promise<Agent>{const a=await this.refreshAgent(id);invariant(a.ownerId===accountId,"NOT_OWNER","Only the current NFT owner can perform this action.",403);return a;}
  async balance(accountId:string):Promise<string>{const b=await this.view<{claimable:string}>("get_balance",{account_id:accountId});return b.claimable;}
  async quote(id:string,kind:JobKind,fuelBudget?:number):Promise<JobQuote>{
    const a=await this.refreshAgent(id),max_fuel=fuelBudget??Math.min(a.maxFuelPerJob,8000);invariant(Number.isSafeInteger(max_fuel)&&max_fuel>=1000&&max_fuel<=a.maxFuelPerJob,"INVALID_BUDGET","Execution allowance must fit the agent's Fuel cap.");
    const q=await this.view<{service_fee:string;max_compute:string;storage_fee:string;total_deposit:string;max_fuel:number;refund_terms:string}>("quote_job",{token_id:id,kind,max_fuel});
    return{serviceFee:q.service_fee,computeAllowance:q.max_compute,storageFee:q.storage_fee,totalDeposit:q.total_deposit,fuelBudget:q.max_fuel,acceptanceCriteria:ACCEPTANCE_CRITERIA,refundTerms:q.refund_terms,deadline:new Date(Date.now()+10*60*1000).toISOString()};
  }
  private stage(accountId:string,kind:string,methodName:string,args:Record<string,unknown>,deposit:string,description:string,extra:Partial<PendingOperation>={}){
    const id=randomUUID(),intent:TransactionIntent={receiverId:this.config.contractId!,actions:[{type:"FunctionCall",params:{methodName,args,gas:"100000000000000",deposit}}],description};
    const op:PendingOperation={id,accountId,intent,kind,createdAt:Date.now(),...extra};this.core.store.put("operation",id,op);return{transactionIntent:intent,operationId:id};
  }
  async mint(accountId:string,body:Record<string,unknown>){
    const name=boundedText(body.name,2,48,"Agent name"),pricing=await this.contractConfig(),config=validateConfig({...defaultAgentConfig(),serviceFee:pricing.pricing.default_service_fee,...(body.instructions?{instructions:body.instructions as string}:{}),...(body.allowedTools?{allowedTools:body.allowedTools as AgentConfig["allowedTools"]}:{})});
    return this.stage(accountId,"mint","mint_agent",{name,config_hash:hashObject(config)},pricing.mint_total,"Mint an Agent NFT on NEAR testnet with the displayed storage, compute and platform allocation.",{config});
  }
  async configure(id:string,accountId:string,patch:Record<string,unknown>){
    const a=await this.owned(id,accountId);invariant(Object.keys(patch).every(k=>["instructions","allowedTools","mode","active","maxConcurrent","maxFuelPerJob","serviceFee","reinvestBps"].includes(k)),"FORBIDDEN_FIELD","Unsupported configuration field.",403);
    const validated=validateConfig({...a,...patch}),config:AgentConfig={instructions:validated.instructions,allowedTools:validated.allowedTools,mode:validated.mode,active:validated.active,maxConcurrent:validated.maxConcurrent,maxFuelPerJob:validated.maxFuelPerJob,serviceFee:validated.serviceFee,reinvestBps:validated.reinvestBps};
    return this.stage(accountId,"configure","configure_agent",{token_id:id,mode:config.mode,active:config.active,max_concurrent:config.maxConcurrent,max_fuel_per_job:config.maxFuelPerJob,service_fee:config.serviceFee,reinvest_bps:config.reinvestBps,config_hash:hashObject(config)},"1","Update the agent's versioned configuration and permissions.",{agentId:id,config});
  }
  async topup(id:string,accountId:string,amount:string){await this.owned(id,accountId);invariant(/^\d{1,39}$/.test(amount)&&BigInt(amount)>0n&&BigInt(amount)<=10n**24n,"INVALID_AMOUNT","Top-up must be positive and no more than 1 testnet NEAR.");const pricing=await this.contractConfig();invariant(BigInt(amount)%BigInt(pricing.pricing.fuel_unit_price)===0n,"INVALID_AMOUNT","Top-up must fund whole Fuel units.");return this.stage(accountId,"topup","fuel_top_up",{token_id:id},amount,"Fund additional agent Fuel on NEAR testnet.",{agentId:id});}
  async transfer(id:string,accountId:string,receiverId:string){const a=await this.owned(id,accountId);invariant(/^[a-z\d._-]+\.testnet$/.test(receiverId)&&receiverId!==accountId,"INVALID_RECEIVER","Choose a different named NEAR testnet account.");invariant(a.activeJobs===0&&a.fuelReserved===0,"ACTIVE_OBLIGATIONS","Resolve all jobs before transferring the NFT.",409);return this.stage(accountId,"transfer","nft_transfer",{token_id:id,receiver_id:receiverId,approval_id:null,memo:null},"1","Transfer NFT control. The recipient must reactivate; old instructions and permissions are revoked.",{agentId:id});}
  async submit(accountId:string,body:Record<string,unknown>){
    const agentId=boundedText(body.agentId,1,64,"Agent"),input=validateInput(body.input),kind=body.kind as JobKind,key=boundedText(body.idempotencyKey,8,100,"Request key");
    const requestKey=hashObject([accountId,key]);
    const fingerprint=hashObject({agentId,input,kind,fuelBudget:body.fuelBudget??null});
    const previous=()=>{
      const opId=this.core.store.get<string>("job-operation",requestKey);
      if(!opId) return null;
      const pending=this.core.store.get<PendingOperation>("operation",opId);
      if(!pending) return null;
      invariant(pending.requestFingerprint===fingerprint,"IDEMPOTENCY_CONFLICT","This request key was used for a different job.",409);
      if(pending.confirmedHash) return {job:this.core.getJob(pending.job!.id,accountId)};
      return {transactionIntent:pending.intent,operationId:pending.id};
    };
    const prior=previous();
    if(prior) return prior;
    const a=await this.refreshAgent(agentId);
    const config=this.core.store.get<AgentConfig>("config-hash",configurationKey(a.tokenId,a.ownershipEpoch,a.configHash));
    invariant(config,"CONFIGURATION_UNAVAILABLE","The current owner must save this agent's approved configuration on this worker before submitting work.",409);
    invariant(a.active,"AGENT_PAUSED","Activate the agent before submitting work.",409);invariant(kind==="private"?a.ownerId===accountId&&a.mode!=="marketplace":kind==="marketplace"&&a.mode!=="private"&&a.ownerId!==accountId,"JOB_NOT_ALLOWED","This account or operating mode does not permit the requested job.",403);
    const q=await this.quote(agentId,kind,body.fuelBudget as number|undefined),id=`j-${requestKey.slice(0,56)}`,date=new Date().toISOString();
    const requestHash=hashObject({input,configHash:a.configHash,configVersion:a.configVersion,fuelBudget:q.fuelBudget,kind,deadline:q.deadline});
    const job:StoredJob={id,agentId,agentName:a.name,customerId:accountId,ownerAtSubmission:a.ownerId,kind,input,title:input.topic,configVersion:a.configVersion,ownershipEpoch:a.ownershipEpoch,configHash:a.configHash,requestHash,status:"queued",fuelBudget:q.fuelBudget,fuelUsed:0,serviceFee:q.serviceFee,computeAllowance:q.computeAllowance,deposit:q.totalDeposit,createdAt:date,updatedAt:date,deadline:q.deadline,startedAt:null,completedAt:null,attempts:0,providerMode:this.config.providerMode,publicEvidence:kind==="marketplace",reputationEligible:false,network:"testnet",transactionHash:null,configSnapshot:config,idempotencyKey:key};
    const pricing=await this.contractConfig();
    job.pricing={fuelUnitPrice:pricing.pricing.fuel_unit_price,storageFee:q.storageFee,platformBps:pricing.platform_fee_bps};
    return this.core.store.transaction(()=>{
      const retry=previous();
      if(retry) return retry;
      const operation=this.stage(accountId,"job","submit_job",{job_id:id,token_id:agentId,request_hash:requestHash,kind,max_fuel:q.fuelBudget,deadline_ns:(BigInt(Date.parse(q.deadline))*1000000n).toString(),expected_config_version:a.configVersion},q.totalDeposit,"Fund the quoted job escrow and reserve its execution allowance.",{agentId,job,requestFingerprint:fingerprint});
      this.core.store.put("job-operation",requestKey,operation.operationId);
      return operation;
    });
  }
  async cancel(id:string,accountId:string){const job=await this.view<ChainJob|null>("get_job",{job_id:id});invariant(job&&job.customer_id===accountId,"NOT_CUSTOMER","Only this job's customer may cancel.",403);invariant(job.status==="queued","ALREADY_STARTED","Only a queued job can be cancelled.",409);return this.stage(accountId,"cancel","cancel_job",{job_id:id},"1","Cancel this queued job and claim the eligible service/compute refund.",{agentId:job.token_id});}
  async expire(id: string, accountId: string) {
    const job = this.core.getJob(id, accountId);
    const finalized = await this.view<ChainJob | null>("get_job", { job_id: id });
    invariant(finalized && !finalized.settlement && Date.parse(job.deadline) < Date.now(), "NOT_EXPIRED", "Only an unsettled job past its deadline can be expired.", 409);
    return this.stage(accountId, "expire", "expire_job", { job_id: id }, "0", "Expire the unpaid obligation and return eligible escrow.", { agentId: job.agentId });
  }
  withdraw(accountId:string){return this.stage(accountId,"withdraw","withdraw",{},"1","Withdraw only your claimable earnings/refunds to your own account.");}
  async confirm(accountId:string,operationId:string,transactionHash:string){
    // One receipt may confirm only one staged operation.
    const previous=this.confirming;
    let release!:()=>void;
    this.confirming=new Promise<void>(resolve=>{release=resolve;});
    await previous;
    try{return await this.confirmOperation(accountId,operationId,transactionHash);}finally{release();}
  }
  private async confirmOperation(accountId:string,operationId:string,transactionHash:string){
    const op=this.core.store.get<PendingOperation>("operation",operationId);invariant(op&&op.accountId===accountId,"UNKNOWN_OPERATION","Transaction operation not found for this session.",404);if(op.confirmedHash){invariant(op.confirmedHash===transactionHash,"REPLAY_CONFLICT","This operation was confirmed with a different transaction.",409);return op.result;}
    invariant(/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(transactionHash),"INVALID_TRANSACTION","A valid NEAR transaction hash is required.");
    const outcome=await this.rpc<any>("tx",{tx_hash:transactionHash,sender_account_id:accountId,wait_until:"FINAL"});
    invariant(outcome.transaction?.signer_id===accountId&&outcome.transaction?.receiver_id===this.config.contractId,"TX_MISMATCH","Transaction signer or contract differs from this operation.",403);
    invariant(outcome.status&&typeof outcome.status==="object"&&"SuccessValue"in outcome.status&&!(outcome.receipts_outcome??[]).some((r:any)=>r.outcome?.status?.Failure),"TX_FAILED","The transaction did not complete successfully.",409);
    const action=outcome.transaction.actions?.[0]?.FunctionCall,expected=op.intent.actions[0].params;
    invariant(outcome.transaction.actions?.length===1&&action?.method_name===expected.methodName&&String(action.deposit)===expected.deposit&&canonical(JSON.parse(Buffer.from(action.args,"base64").toString()))===canonical(expected.args),"TX_MISMATCH","Confirmed transaction actions do not match the reviewed operation.",403);
    const used=this.core.store.get<string>("transaction-used",transactionHash);invariant(!used||used===operationId,"TX_REPLAY","This transaction already confirmed another operation.",409);
    let result:unknown;
    if(op.kind==="mint"){
      const returned=JSON.parse(Buffer.from(outcome.status.SuccessValue,"base64").toString()) as ChainAgent;
      const finalized=await this.view<ChainAgent|null>("get_agent",{token_id:returned.token_id});
      invariant(finalized&&finalized.owner_id===accountId&&finalized.config_hash===hashObject(op.config),"CHAIN_MISMATCH","Finalized minted agent differs from the reviewed configuration.",409);
      this.core.store.put("config-hash",configurationKey(finalized.token_id,finalized.ownership_epoch,finalized.config_hash),op.config);
      const agent=this.mapAgent(finalized);this.core.store.put("agent",agent.id,agent);
      this.core.event(agent,"mint","Agent NFT mint confirmed on NEAR testnet.",agent.configHash);result={agent};
    }else if(op.kind==="job"){
      const job=op.job!;await this.assertReservation(job);job.transactionHash=transactionHash;this.core.store.put("job",job.id,job);await this.refreshAgent(job.agentId);result={job:this.core.visibleJob(job,accountId)};
    }else if(op.kind==="withdraw"){
      const receiptLines=(outcome.receipts_outcome??[]).flatMap((receipt:{outcome?:{logs?:string[]}})=>receipt.outcome?.logs??[]);
      const withdrawals=receiptLines.filter((line:string)=>line.startsWith("EVENT_JSON:")).map((line:string)=>{
        try{return JSON.parse(line.slice(11)) as {standard?:string;event?:string;data?:{account_id?:string;amount?:string;success?:boolean}[]};}catch{return null;}
      });
      const resolved=withdrawals.find((event:typeof withdrawals[number])=>event?.standard==="proofbound"&&event.event==="withdrawal_resolved"&&event.data?.[0]?.account_id===accountId)?.data?.[0];
      invariant(resolved?.success&&resolved.amount,"WITHDRAWAL_UNCONFIRMED","The withdrawal callback has not confirmed a payout. Check the finalized balance.",409);
      result={balance:await this.balance(accountId),withdrawn:resolved.amount,transactionHash};
    }
    else{
      let agent=await this.refreshAgent(op.agentId!);
      if(op.kind==="configure"){
        invariant(agent.ownerId===accountId&&agent.configHash===hashObject(op.config),"CHAIN_MISMATCH","Finalized configuration commitment differs from the reviewed update.",409);
        this.core.store.put("config-hash",configurationKey(agent.tokenId,agent.ownershipEpoch,agent.configHash),op.config);
        agent=await this.refreshAgent(agent.id);
      }
      if(op.kind==="cancel"||op.kind==="expire"){
        const jobId=String(expected.args.job_id);
        this.core.store.put("settlement-tx",jobId,transactionHash);
        await this.refreshJob(jobId);
      }
      this.core.event(agent,op.kind==="transfer"?"ownership":"configuration",`${op.kind} confirmed on NEAR testnet.`);
      result={agent};
    }
    this.core.store.transaction(()=>{this.core.store.put("transaction-used",transactionHash,operationId);this.core.store.put("operation",operationId,{...op,confirmedHash:transactionHash,result});});return result;
  }
  async assertReservation(job:StoredJob):Promise<ChainJob>{
    const chain=await this.view<ChainJob|null>("get_job",{job_id:job.id});
    const storageFee=job.pricing?.storageFee??(BigInt(job.deposit)-BigInt(job.serviceFee)-BigInt(job.computeAllowance)).toString();
    invariant(chain&&chain.customer_id===job.customerId&&chain.owner_id===job.ownerAtSubmission&&chain.token_id===job.agentId&&chain.kind===job.kind&&chain.request_hash===job.requestHash&&chain.config_hash===job.configHash&&chain.config_version===job.configVersion&&chain.ownership_epoch===job.ownershipEpoch&&chain.max_fuel===job.fuelBudget&&chain.service_fee===job.serviceFee&&chain.compute_allowance===job.computeAllowance&&chain.reinvest_bps===job.configSnapshot.reinvestBps&&chain.storage_fee===storageFee&&chain.deadline_ns===(BigInt(Date.parse(job.deadline))*1000000n).toString(),"RESERVATION_MISMATCH","Finalized onchain job does not match the authorized request and budget.",409);
    return chain;
  }
  async refreshJob(id:string):Promise<StoredJob>{const job=this.core.job(id),chain=await this.assertReservation(job);job.status=chain.status;job.updatedAt=new Date().toISOString();if(chain.settlement){const s=chain.settlement;job.fuelUsed=s.actual_fuel;job.reputationEligible=s.reputation_awarded;job.completedAt=nsDate(s.settled_at_ns);job.settlement={serviceFee:chain.service_fee,ownerGross:s.owner_share,ownerClaimable:s.owner_claimable,platformFee:s.platform_share,computeCharged:s.compute_charge,customerRefund:s.customer_refund,reinvested:s.reinvested,fuelAdded:Number(BigInt(s.reinvested)/BigInt((await this.contractConfig()).pricing.fuel_unit_price)),storageCharged:chain.storage_fee,settledAt:nsDate(s.settled_at_ns),network:"testnet",transactionHash:this.core.store.get<string>("settlement-tx",id)};}this.core.store.put("job",id,job);await this.refreshAgent(job.agentId);return job;}
  async roleCall(role:"executor"|"verifier",methodName:string,args:Record<string,unknown>):Promise<string>{
    invariant(this.config.mode==="testnet"&&this.config.allowChainWrites,"CHAIN_WRITES_DISABLED","Blockchain writes are disabled until explicit operator approval.",503);
    const allowed=role==="executor"?["start_job","submit_result"]:["verify_job"];invariant(allowed.includes(methodName),"SIGNER_POLICY","Service signer cannot perform that operation.",403);
    const roleName=role.toUpperCase(),accountId=process.env[`NEAR_${roleName}_ACCOUNT_ID`],key=process.env[`NEAR_${roleName}_PRIVATE_KEY`];invariant(accountId?.endsWith(".testnet")&&key,"SIGNER_NOT_CONFIGURED",`${role} signer is not configured.`,503);
    const settings=await this.contractConfig();invariant(accountId===settings[`${role}_id`],"SIGNER_MISMATCH","Service account differs from the contract-authorized role.",503);
    const {Account,JsonRpcProvider,KeyPair}=await import("near-api-js"),pair=KeyPair.fromString(key as `ed25519:${string}`),access=await this.accessKey(accountId,pair.getPublicKey().toString()) as {permission:any};
    const permission=access.permission?.FunctionCall;
    invariant(permission&&permission.receiver_id===this.config.contractId&&Array.isArray(permission.method_names)&&permission.method_names.length>0&&permission.method_names.every((m:string)=>allowed.includes(m))&&permission.method_names.includes(methodName)&&permission.allowance!==null,"UNRESTRICTED_SIGNER","Runtime refuses FullAccess or unrestricted service keys. Use a capped FunctionCall key scoped to this contract and role's methods.",503);
    const status=await this.rpc<{chain_id:string}>("status",[]);invariant(status.chain_id==="testnet","WRONG_NETWORK","Runtime signing is restricted to NEAR testnet.",503);
    // Serialize nonce allocation across worker jobs; model context never sees the signer.
    let release!:()=>void;const previous=this.signing;this.signing=new Promise<void>(r=>{release=r;});await previous;
    try{const account=new Account(accountId,new JsonRpcProvider({url:this.config.rpcUrl}),key as `ed25519:${string}`),result=await account.callFunction({contractId:this.config.contractId!,methodName,args,gas:100000000000000n,deposit:0n});const tx=(result as any).transaction?.hash;invariant(tx,"TX_RECEIPT","Service transaction returned no verifiable transaction hash.",502);const final=await this.rpc<any>("tx",{tx_hash:tx,sender_account_id:accountId,wait_until:"FINAL"});invariant(final.status&&"SuccessValue"in final.status,"TX_FAILED","Service transaction did not complete successfully.",502);return tx;}
    catch(error){if(error instanceof AppError)throw error;throw new AppError("SIGNER_FAILED","Service signing failed. Inspect the testnet receipt; credentials are never included in this response.",502);}finally{release();}
  }
}
