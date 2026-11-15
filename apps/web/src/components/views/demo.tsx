"use client";

import { ArrowRight, Fingerprint, Fuel, ShieldCheck, Workflow } from "lucide-react";
import { useApp } from "../provider";
import { LinkButton, Notice, PageHeading } from "../ui";

export function DemoView() {
  const { data } = useApp();
  const active = data?.agents.find(agent => agent.ownerId === data.session?.accountId);
  const fixture = data?.runtime.providerMode === "fixture";
  const local = data?.runtime.mode === "local";
  const waitingForWorker = data?.runtime.mode === "testnet" && !data.runtime.workerRunning;
  if (data?.runtime.readOnly) return <>
    <PageHeading eyebrow="NEAR TESTNET DEMO" title="From mint to proof" description="Inspect Atlas’s onchain identity and the finalized transactions that created and activated it." />
    <Notice>Agent execution and wallet transactions require the separate worker. This site displays public testnet data and recorded evidence.</Notice>
    <div className="demo-steps">
      <section className="panel demo-step"><div className="demo-step-mark"><Fingerprint size={23}/></div><div><h2>Meet Atlas #1</h2><p>See the current owner, operating mode and available Fuel.</p></div><LinkButton href="/agents/1" secondary>View Atlas <ArrowRight size={16}/></LinkButton></section>
      <section className="panel demo-step"><div className="demo-step-mark"><ShieldCheck size={23}/></div><div><h2>Inspect the Agent Passport</h2><p>Open the verified mint and activation receipts on NEAR testnet.</p></div><LinkButton href="/passport/1" secondary>View Passport <ArrowRight size={16}/></LinkButton></section>
    </div>
  </>;
  const steps = [
    { title: "Mint Atlas", action: "Mint an Agent", detail: "Choose the Research specialization. Review storage, initial Fuel, and the platform allocation before minting.", href: "/mint", icon: Fingerprint },
    { title: "Activate and run a research job", action: active ? "Open workspace" : "View My Agents", detail: "Open the workspace, enable the approved tools, and activate the agent. Ask it to explain NEAR NFT ownership and the job’s execution cap.", href: active ? `/workspace/${active.id}` : "/dashboard", icon: Workflow },
    { title: "Hire Atlas and inspect settlement", action: "Explore Agents", detail: local ? "Set Hybrid mode and 20% Earn-to-Refill. Switch to customer-one.local, find Atlas, review the quote, and fund the research job." : "Set Hybrid mode and 20% Earn-to-Refill. Connect a separate funded testnet customer wallet and hire Atlas from Explore Agents.", href: "/explore", icon: Fuel },
    { title: "Check permissions and transfer ownership", action: "Review ownership", detail: local ? "Try the payout redirection probe. After all jobs settle, transfer to buyer.local and switch to that identity to reactivate." : "Review the security policy. After all jobs settle, transfer the NFT to a different testnet account and reconnect as the new owner to reactivate.", href: active ? `/security/${active.id}` : "/security", icon: ShieldCheck },
  ];
  return <>
    <PageHeading eyebrow="GUIDED DEMO" title="From mint to proof" description="Follow the same workflow the application uses for research, receipts, and ownership." />
    <Notice>{local ? "Local demo uses simulated balances and identities." : "NEAR testnet requires a funded wallet and approved execution worker."} {fixture ? "Reports use deterministic fixtures." : "Research calls NEAR AI with a bounded execution budget."}</Notice>
    {waitingForWorker && <Notice tone="warning">Testnet contract reads are available. Job submission needs an authorized executor and verifier.</Notice>}
    <div className="demo-steps">{steps.map((step, index) => <section className="panel demo-step" key={step.href + step.title}>
      <div className="demo-step-mark"><step.icon size={23} /><span className="mono">{String(index + 1).padStart(2, "0")}</span></div>
      <div><h2>{step.title}</h2><p>{step.detail}</p></div>
      <LinkButton href={step.href} secondary>{step.action} <ArrowRight size={16} /></LinkButton>
    </section>)}</div>
  </>;
}
