import { AppError } from "./errors.ts";
import { Core, TERMINAL, type StoredJob } from "./core.ts";
import { Chain } from "./chain.ts";
import { ResearchProvider, type ResearchExecution } from "./research.ts";
import { verifyReport } from "./verifier.ts";

export interface ExecutableProvider {execute(job:StoredJob,signal:AbortSignal):Promise<ResearchExecution>;}
export class Worker {
  private timer:NodeJS.Timeout|null=null;
  private readonly inflight=new Map<string,Promise<void>>();
  private stopped=false;
  private tickBusy=false;
  private readonly controllers=new Map<string,AbortController>();
  constructor(readonly core:Core,readonly provider:ExecutableProvider=new ResearchProvider(core.config,core.store),readonly chain=new Chain(core)){}
  get activeExecutions(){return this.inflight.size;}
  get running(){return this.timer!==null&&this.canExecute;}
  get canExecute(){return this.core.config.mode==="local"||(this.core.config.allowChainWrites&&!!process.env.NEAR_EXECUTOR_PRIVATE_KEY&&!!process.env.NEAR_VERIFIER_PRIVATE_KEY);}
  async start():Promise<void>{this.stopped=false;if(this.core.config.mode==="local")this.core.recover();else if(this.canExecute)await this.recoverLive();this.timer=setInterval(()=>{void this.tick();},250);this.timer.unref();await this.tick();}
  async stop():Promise<void>{this.stopped=true;if(this.timer){clearInterval(this.timer);this.timer=null;}for(const c of this.controllers.values())c.abort();await Promise.allSettled(this.inflight.values());}
  async tick():Promise<void>{
    if(this.stopped||this.tickBusy||!this.canExecute)return;this.tickBusy=true;
    try{
      const jobs=this.core.claimJobs(6);
      for(const job of jobs){const p=this.run(job).finally(()=>{this.inflight.delete(job.id);this.controllers.delete(job.id);});this.inflight.set(job.id,p);}
    }finally{this.tickBusy=false;}
  }
  async idle(timeoutMs=10000):Promise<void>{const deadline=Date.now()+timeoutMs;while(Date.now()<deadline){await this.tick();if(this.inflight.size===0&&!this.core.store.list<StoredJob>("job").some(j=>j.status==="queued"))return;await new Promise(r=>setTimeout(r,10));}throw new Error("Worker did not become idle before the test deadline.");}
  private async recoverLive():Promise<void>{
    for(const job of this.core.store.list<StoredJob>("job")){
      if(TERMINAL.has(job.status)||job.status==="queued")continue;
      try{const refreshed=await this.chain.refreshJob(job.id);if(TERMINAL.has(refreshed.status))continue;
        // Do not repeat an unknown charged inference call after a crash. Refund conservatively.
        const tx=await this.chain.roleCall("verifier","verify_job",{job_id:job.id,accepted:false,actual_fuel:0,output_hash:refreshed.verification?.outputHash??"0".repeat(64),evidence_hash:refreshed.verification?.evidenceHash??"0".repeat(64),failure_code:"WORKER_RESTART"});this.core.store.put("settlement-tx",job.id,tx);await this.chain.refreshJob(job.id);
      }catch{this.core.updateExecution(job.id,{error:"Recovery is pending an authorized onchain refund. No inference is repeated automatically."});}
    }
  }
  private async run(job:StoredJob):Promise<void>{
    const controller=new AbortController();this.controllers.set(job.id,controller);
    const timeout=setTimeout(()=>controller.abort(),this.core.config.jobTimeoutMs);
    try{
      if(this.core.config.mode==="testnet"){
        const reserved=await this.chain.assertReservation(job);
        if(TERMINAL.has(reserved.status)){await this.chain.refreshJob(job.id);return;}
        await this.chain.roleCall("executor","start_job",{job_id:job.id});
      }
      const execution=await this.provider.execute(job,controller.signal);
      this.core.updateExecution(job.id,{status:"submitted",report:execution.report,sources:execution.sources,resourceReceipt:execution.receipt});
      const verification=verifyReport(job,execution.report,execution.sources,execution.receipt);
      this.core.updateExecution(job.id,{status:"verifying",verification});
      if(this.core.config.mode==="local")this.core.settle(job.id,execution.report,execution.sources,execution.receipt,verification);
      else{
        await this.chain.roleCall("executor","submit_result",{job_id:job.id,output_hash:verification.outputHash,evidence_hash:verification.evidenceHash});
        const tx=await this.chain.roleCall("verifier","verify_job",{job_id:job.id,accepted:verification.accepted,actual_fuel:execution.receipt.fuelUsed,output_hash:verification.outputHash,evidence_hash:verification.evidenceHash,failure_code:verification.accepted?null:"VERIFICATION_FAILED"});
        this.core.store.put("settlement-tx",job.id,tx);const finished=await this.chain.refreshJob(job.id);this.core.event(this.core.agent(job.agentId),"job",`Onchain ${finished.status} research settlement.`,verification.evidenceHash,job.id);
      }
    }catch(error){
      const reason=controller.signal.aborted?"Execution timed out or the worker stopped. The job did not earn successful reputation.":error instanceof AppError?error.message:"Research execution failed. No provider credentials or private server error details are exposed.";
      if(this.core.config.mode==="local")this.core.fail(job.id,reason,"failed");
      else{
        this.core.updateExecution(job.id,{error:reason});
        try{const current=await this.chain.refreshJob(job.id);if(!TERMINAL.has(current.status)){const tx=await this.chain.roleCall("verifier","verify_job",{job_id:job.id,accepted:false,actual_fuel:Math.min(current.resourceReceipt?.fuelUsed??0,current.fuelBudget),output_hash:current.verification?.outputHash??"0".repeat(64),evidence_hash:current.verification?.evidenceHash??"0".repeat(64),failure_code:"EXECUTION_FAILED"});this.core.store.put("settlement-tx",job.id,tx);await this.chain.refreshJob(job.id);}}
        catch{this.core.updateExecution(job.id,{error:reason+" Onchain refund remains pending. The customer can expire the job after its deadline."});}
      }
    }finally{clearTimeout(timeout);}
  }
}
