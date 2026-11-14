"use client";

import { ArrowRight, Fingerprint, Fuel, ShieldCheck, Workflow } from "lucide-react";
import { useApp } from "../provider";
import { LinkButton, Notice, PageHeading } from "../ui";

export function DemoView() {
  const { data } = useApp();
  const active = data?.agents.find(agent => agent.ownerId === data.session?.accountId);
  const fixture = data?.runtime.providerMode === "fixture";
  const local = data?.runtime.mode === "local";
  const steps = [
    { title: "Mint Atlas", detail: "Choose the Research specialization. Review storage, initial Fuel, and the platform allocation before minting.", href: "/mint", icon: Fingerprint },
    { title: "Activate and run a research job", detail: "Open the workspace, enable the approved tools, and activate the agent. Ask it to explain NEAR NFT ownership and the job’s execution cap.", href: active ? `/workspace/${active.id}` : "/dashboard", icon: Workflow },
    { title: "Hire Atlas and inspect settlement", detail: local ? "Set Hybrid mode and 20% Earn-to-Refill. Switch to customer-one.local, find Atlas, review the quote, and fund the research job." : "Set Hybrid mode and 20% Earn-to-Refill. Connect a separate funded testnet customer wallet and hire Atlas from Explore Agents.", href: "/explore", icon: Fuel },
    { title: "Check permissions and transfer ownership", detail: local ? "Try the payout redirection probe. After all jobs settle, transfer to buyer.local and switch to that identity to reactivate." : "Review the security policy. After all jobs settle, transfer the NFT to a different testnet account and reconnect as the new owner to reactivate.", href: active ? `/security/${active.id}` : "/security", icon: ShieldCheck },
  ];
  return <>
    <PageHeading eyebrow="GUIDED DEMO" title="From mint to proof" description="Follow the same workflow the application uses for research, receipts, and ownership." />
    <Notice>{local ? "Local demo uses simulated balances and identities." : "NEAR testnet requires a funded wallet and approved execution worker."} {fixture ? "Reports use deterministic fixtures." : "Research calls NEAR AI with a bounded execution budget."}</Notice>
    <div className="demo-steps">{steps.map((step, index) => <section className="panel demo-step" key={step.href + step.title}>
      <div className="demo-step-mark"><step.icon size={23} /><span className="mono">{String(index + 1).padStart(2, "0")}</span></div>
      <div><h2>{step.title}</h2><p>{step.detail}</p></div>
      <LinkButton href={step.href} secondary>Open step <ArrowRight size={16} /></LinkButton>
    </section>)}</div>
  </>;
}
