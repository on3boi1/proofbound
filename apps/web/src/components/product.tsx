"use client";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, Fingerprint, Fuel, Globe2, Plus, Search, ShieldCheck, SlidersHorizontal, Wallet, Workflow } from "lucide-react";
import { useState } from "react";
import { formatNear } from "@proofbound/shared";
import { useApp } from "./provider";
import { Shell } from "./shell";
import { AgentCard, Badge, Button, EmptyState, ErrorState, JobTable, LinkButton, LoadingState, Notice, PageHeading, SectionHeading, Stat } from "./ui";
import { MintView } from "./views/mint";
import { AgentView } from "./views/agent";
import { JobsView, JobDetailView } from "./views/jobs";
import { FuelView, PassportView, SecurityView } from "./views/management";
import { DemoView } from "./views/demo";
import { number } from "@/lib/api";

export function SignInNotice() {
  const { data, connect, walletBusy } = useApp();
  if (data?.runtime.readOnly) return <EmptyState icon={<Wallet size={26}/>} title="This site is read-only" description="Browse agent ownership, Fuel and evidence from NEAR testnet. Account management and job execution require the separate execution worker." action={<LinkButton href="/explore">Explore Agents <ArrowRight size={16}/></LinkButton>}/>;
  return <EmptyState icon={<Wallet size={26}/>} title={data?.runtime.mode === "local" ? "Choose your demo identity" : "Connect your NEAR wallet"} description={data?.runtime.mode === "local" ? "Use owner.local to mint your first agent. The local demo is reproducible and does not spend tokens." : "Prove ownership with a signed message. Your private key stays in your wallet."} action={<Button onClick={() => void connect()} loading={walletBusy}>{data?.runtime.mode === "local" ? "Continue as owner.local" : "Connect wallet"}<ArrowRight size={16}/></Button>}/>;
}

export function ProductPage({ route }: { route: string[] }) {
  const { data, loading, error, refresh } = useApp();
  let content;
  if (loading) content = <LoadingState/>;
  else if (!data) content = <ErrorState message={error || "Could not connect to the agent worker."} retry={() => void refresh()}/>;
  else if (route[0] === "dashboard") content = <Dashboard/>;
  else if (route[0] === "explore") content = <Explore/>;
  else if (route[0] === "mint") content = <MintView/>;
  else if (route[0] === "workspace" && route[1]) content = <AgentView id={route[1]} workspace/>;
  else if (route[0] === "agents" && route[1]) content = <AgentView id={route[1]}/>;
  else if (route[0] === "jobs") content = route[1] ? <JobDetailView id={route[1]}/> : <JobsView/>;
  else if (route[0] === "proof" && route[1]) content = <JobDetailView id={route[1]} publicProof/>;
  else if (route[0] === "fuel") content = <FuelView/>;
  else if (route[0] === "passport") content = <PassportView id={route[1]}/>;
  else if (route[0] === "security") content = <SecurityView id={route[1]}/>;
  else if (route[0] === "demo") content = <DemoView/>;
  else content = <EmptyState title="This page doesn’t exist" description="Return to your agents or explore the marketplace." action={<LinkButton href="/dashboard">Go to My Agents <ArrowRight size={16}/></LinkButton>}/>;
  return <Shell>{content}</Shell>;
}

function Dashboard() {
  const { data, walletAccount } = useApp(); if (!data) return null;
  if (data.runtime.readOnly) {
    const agents = data.agents.filter(agent => agent.ownerId === walletAccount);
    return <><PageHeading eyebrow="NEAR TESTNET" title="My Agents" description="View the public agent identities owned by your connected wallet."/>{!walletAccount ? <EmptyState icon={<Wallet size={26}/>} title="Connect a testnet wallet" description="Use the wallet button to view your agent roster."/> : agents.length ? <div className="agent-grid">{agents.map(agent => <AgentCard key={agent.id} agent={agent} browseOnly/>)}</div> : <EmptyState title="No agents found" description="This wallet has no agents in the current testnet listing." action={<LinkButton href="/explore">Explore Agents <ArrowRight size={16}/></LinkButton>}/>}</>;
  }
  const owned = data.agents.filter(a => a.ownerId === data.session?.accountId);
  const total = (key: "fuelAvailable" | "verifiedJobs" | "activeJobs") => owned.reduce((sum,a) => sum+a[key],0);
  return <><PageHeading eyebrow="YOUR INTELLIGENCE, AT WORK" title="My Agents" description="A workspace for what you own — and the proof you’re building." action={<LinkButton href="/mint"><Plus size={17}/>Mint an Agent</LinkButton>}/>
    {!data.session ? <SignInNotice/> : <><div className="stats-grid"><Stat label="Owned agents" value={number(owned.length)} detail="Persistent, transferable identities"/><Stat label="Verified work" value={number(total("verifiedJobs"))} detail="Completed and checked jobs"/><Stat label="Available Fuel" value={number(total("fuelAvailable"))} detail="Prepaid operating credits"/><Stat label="Claimable balance" value={<>{formatNear(data.balance)} <span>Ⓝ</span></>} detail={data.runtime.mode === "local" ? "Simulated NEAR balance" : "Testnet NEAR balance"} accent/></div>
    <section className="workspace-section"><SectionHeading title="Your agent roster" description={`${owned.length} ${owned.length === 1 ? "agent" : "agents"} · ${total("activeJobs")} active ${total("activeJobs") === 1 ? "job" : "jobs"}`} action={<Badge tone="green" dot>{data.runtime.workerRunning ? "Worker online" : "Worker offline"}</Badge>}/>{owned.length ? <div className="agent-grid">{owned.map(a => <AgentCard key={a.id} agent={a} owned/>)}<Link className="mint-tile" href="/mint"><span><Plus size={26}/></span><h3>Put your next idea to work.</h3><p>Mint a new Research Agent with its own identity, permissions, and history.</p><strong>Mint an Agent <ArrowUpRight size={16}/></strong></Link></div> : <div className="first-agent"><div><span className="eyebrow">A CLEAN SLATE. A WORLD OF POSSIBILITY.</span><h2>Your first agent<br/>starts with <em>you.</em></h2><p>Give it a name, a purpose, and a set of boundaries. Its reputation begins with the work it actually does.</p><LinkButton href="/mint">Mint an Agent <ArrowUpRight size={17}/></LinkButton></div><div className="first-agent-art"><Fingerprint size={100} strokeWidth={.65}/><span>OWNERSHIP / WORK / EVIDENCE</span></div></div>}</section>
    <section className="workspace-section"><SectionHeading title="Recent work" description="Recorded outcomes, with the evidence to match." action={<Link href="/jobs" className="text-link">All jobs <ArrowUpRight size={15}/></Link>}/><div className="panel"><JobTable jobs={data.jobs.slice(0,5)}/></div></section></>}
    <div className="inline-callout"><ShieldCheck size={22}/><div><strong>Start with boundaries. Build with confidence.</strong><p>Agents use approved tools and individual budgets. The model never chooses where a payout goes.</p></div><Link href="/security" className="text-link">Review permissions <ArrowUpRight size={16}/></Link></div>
  </>;
}

function Explore() {
  const { data } = useApp(); const [query,setQuery]=useState(""); const [tool,setTool]=useState("all"); const [available,setAvailable]=useState(false);
  if (!data) return null;
  const agents = data.agents.filter(a => a.mode !== "private" && a.active).filter(a => `${a.name} ${a.specialization} ${a.ownerId}`.toLowerCase().includes(query.toLowerCase())).filter(a => tool === "all" || a.allowedTools.includes(tool as never)).filter(a => !available || a.activeJobs < a.maxConcurrent);
  return <><PageHeading eyebrow="THE AGENT MARKETPLACE" title="Find intelligence. Hire capability." description="Research agents with clear prices, bounded permissions, and evidence you can inspect." action={<LinkButton href="/mint" secondary><Plus size={16}/>Mint your own</LinkButton>}/><div className="market-intro"><div><span className="eyebrow">AVAILABLE SPECIALIZATION</span><h2>Research, with receipts.</h2><p>NEAR ecosystem research, network analysis, and source-backed calculations. Hire an agent for a single job. No NFT required.</p></div><div className="market-seal"><Globe2 size={30}/><span>RESEARCH<br/>NEAR ECOSYSTEM</span></div></div>
    {data.runtime.readOnly && <Notice>Browse active testnet listings and inspect their Passports. Hiring is currently offline.</Notice>}
    <div className="filter-bar"><label className="search-field"><Search size={18}/><span className="sr-only">Search agents</span><input placeholder="Search agents or owners…" value={query} onChange={e=>setQuery(e.target.value)}/></label>{!data.runtime.readOnly && <><label className="filter-select"><SlidersHorizontal size={16}/><span className="sr-only">Capability filter</span><select value={tool} onChange={e=>setTool(e.target.value)}><option value="all">All capabilities</option><option value="near-rpc">Network data</option><option value="near-docs">Documentation</option><option value="calculator">Calculations</option></select></label><label className="check-inline"><input type="checkbox" checked={available} onChange={e=>setAvailable(e.target.checked)}/>Available now</label></>}</div>
    <div className="results-header"><span>{agents.length} {agents.length === 1 ? "agent" : "agents"} listed</span><Badge>{data.runtime.mode === "local" ? "Local demo agents" : "Finalized testnet agents"}</Badge></div>
    {agents.length ? <div className="agent-grid">{agents.map(a=><AgentCard key={a.id} agent={a} browseOnly={data.runtime.readOnly}/>)}</div> : <div className="panel"><EmptyState icon={<Search size={28}/>} title={query || tool !== "all" ? "No agents match your filters" : "The marketplace is ready for its first agent"} description={query || tool !== "all" ? "Try a different search or capability." : "Mint a Research Agent, activate it, and choose Hybrid or Marketplace mode to list it here."} action={query || tool !== "all" ? <Button className="button-secondary" onClick={()=>{setQuery("");setTool("all");setAvailable(false);}}>Clear filters</Button> : <LinkButton href="/mint">Mint an Agent <ArrowUpRight size={16}/></LinkButton>}/></div>}
    <section className="coming-next"><div className="eyebrow">ON THE ROADMAP</div><div><span>DeFi Agent</span><span>Security Agent</span><span>Business Operations</span></div><p>Future specializations. Research is the supported capability in this prototype.</p></section><Notice>Newly minted agents start with zero verified jobs. Template capabilities are separate from each agent’s personal work history.</Notice>
  </>;
}
