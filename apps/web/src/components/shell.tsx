"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownToLine, ArrowUpRight, BookOpen, Compass, Fingerprint, Fuel, LayoutGrid, LogOut, Menu, Plus, ShieldCheck, Sparkles, Wallet, Workflow, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useApp } from "./provider";
import { Badge, Brand, Button, ErrorState, Mark } from "./ui";

const nav = [
  { href: "/dashboard", label: "My Agents", icon: LayoutGrid },
  { href: "/explore", label: "Explore Agents", icon: Compass },
  { href: "/jobs", label: "Jobs", icon: Workflow },
  { href: "/fuel", label: "Fuel & Earnings", icon: Fuel },
  { href: "/passport", label: "Agent Passport", icon: Fingerprint },
  { href: "/security", label: "Ownership & Security", icon: ShieldCheck },
];

export function AccountControl() {
  const { data, connect, disconnect, walletBusy, loading, refresh } = useApp();
  if (!data) return loading
    ? <span className="account-placeholder" role="status">Checking connection…</span>
    : <Button className="button-secondary button-small" onClick={() => void refresh()}>Retry connection</Button>;
  if (data?.runtime.mode === "local") return <div className="account-control"><span className="account-indicator" /><label className="sr-only" htmlFor="demo-account">Demo identity</label><select id="demo-account" value={data.session?.accountId || ""} onChange={e => e.target.value ? void connect(e.target.value) : void disconnect()} disabled={walletBusy}><option value="">Choose demo identity</option>{data.localAccounts.map(account => <option key={account} value={account}>{account}</option>)}</select>{data.session && <button className="icon-button" onClick={() => void disconnect()} aria-label="Sign out of demo identity"><LogOut size={16} /></button>}</div>;
  return data?.session ? <div className="account-control"><Wallet size={16} /><span>{data.session.accountId}</span><button className="icon-button" onClick={() => void disconnect()} aria-label="Disconnect wallet"><LogOut size={16} /></button></div> : <Button className="button-small" onClick={() => void connect()} loading={walletBusy}><Wallet size={16} />Connect wallet</Button>;
}

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  return <header className="marketing-header"><Brand /><nav className={open ? "marketing-nav open" : "marketing-nav"} aria-label="Main navigation"><Link href="/explore" onClick={() => setOpen(false)}>Explore Agents</Link><a href="/#how-it-works" onClick={() => setOpen(false)}>How it works</a><Link href="/demo" onClick={() => setOpen(false)}>Try the demo <ArrowUpRight size={14} /></Link></nav><Link className="button button-dark button-small desktop-wallet" href="/dashboard">Open app <ArrowUpRight size={15} /></Link><button className="mobile-menu-button icon-button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></header>;
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { data, error, refresh } = useApp();
  const [open, setOpen] = useState(false);
  const title = nav.find(n => path.startsWith(n.href))?.label || (path.startsWith("/mint") ? "Mint an Agent" : path.startsWith("/workspace") ? "Agent Workspace" : path.startsWith("/agents") ? "Agent Profile" : "Guided Demo");
  return <div className="app-shell">
    {open && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); document.getElementById("workspace-menu")?.focus(); } }}><div className="sidebar-brand"><Brand /><button className="icon-button mobile-menu-button" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20}/></button></div><div className="sidebar-label">WORKSPACE</div><nav id="workspace-navigation" aria-label="Workspace navigation">{nav.map(item => <Link href={item.href} onClick={() => setOpen(false)} key={item.href} className={`nav-item ${path.startsWith(item.href) ? "active" : ""}`} aria-current={path.startsWith(item.href) ? "page" : undefined}><item.icon size={19} strokeWidth={1.7} /><span>{item.label}</span>{item.href === "/jobs" && !!data?.jobs.filter(j => ["queued", "running", "submitted", "verifying"].includes(j.status)).length && <span className="nav-count">{data.jobs.filter(j => ["queued", "running", "submitted", "verifying"].includes(j.status)).length}</span>}</Link>)}</nav><Link className="sidebar-mint" href="/mint" onClick={() => setOpen(false)}><Plus size={18} />Mint an Agent <ArrowUpRight size={16} /></Link><div className="sidebar-bottom"><Link href="/demo" className={`demo-card ${path === "/demo" ? "selected" : ""}`} onClick={() => setOpen(false)}><div className="demo-card-icon"><BookOpen size={19} /><ArrowUpRight size={16} /></div><strong>Guided demo</strong><p>Mint, run a job, and transfer ownership.</p></Link><div className="sidebar-footer"><span className="status-dot" />NEAR testnet prototype <span className="mono">v0.1</span></div></div></aside>
    <div className="app-content"><header className="topbar"><div className="topbar-location"><button id="workspace-menu" className="icon-button mobile-menu-button" aria-label="Open navigation" aria-expanded={open} aria-controls="workspace-navigation" onClick={() => setOpen(true)}><Menu size={20} /></button><span className="topbar-project">Workspace</span><span className="muted">/</span><span>{title}</span></div><div className="topbar-right">{data && <Badge tone={data.runtime.mode === "testnet" ? "green" : "amber"} dot>{data.runtime.mode === "testnet" ? "NEAR testnet" : "Local demo"}</Badge>}<AccountControl /></div></header>
      {data && <div className="mode-strip"><span>{data.runtime.mode === "testnet" ? <><span className="status-dot" />Testnet accounting · {data.runtime.providerMode === "live" ? "Live NEAR AI inference" : "Deterministic fixture inference"}</> : <><Sparkles size={13} />Local demo · Simulated balances and identities · No blockchain transactions</>}</span><Link href="/demo">About this mode <ArrowUpRight size={13}/></Link></div>}
      <main id="main" className="workspace-main">{error && data && <ErrorState message={error} retry={() => void refresh()} />}{children}</main>
      <footer className="app-footer"><span>PROOFBOUND · Mint intelligence. Build proof. Own the business.</span><a href="https://github.com/on3boi1/proofbound" target="_blank" rel="noreferrer">Open source <ArrowUpRight size={13}/></a></footer>
    </div>
  </div>;
}
