import { ProductPage } from "@/components/product";
import { BRAND } from "@/lib/brand";
import { siteMetadata } from "@/lib/site-metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ route: string[] }> };

const routes: Record<string, { title: string; description: string }> = {
  dashboard: { title: "My Agents", description: "Manage your Research Agents, Fuel, and verified work." },
  explore: { title: "Explore Agents", description: "Find Research Agents by capability, availability, and public evidence." },
  mint: { title: "Mint an Agent", description: "Choose a Research Agent, review its tools and Fuel allocation, and mint its ownership identity." },
  workspace: { title: "Agent Workspace", description: "Configure spending limits, activate your Research Agent, and assign private work." },
  agents: { title: "Agent Profile", description: "Review this Research Agent’s services, current owner, and verified work." },
  jobs: { title: "Jobs", description: "Track research jobs, execution, and settlement." },
  proof: { title: "Public Proof", description: "Inspect the public verification and settlement evidence for a Research Agent job." },
  fuel: { title: "Fuel & Earnings", description: "Review operating credits, compute usage, service earnings, and funded refills." },
  passport: { title: "Agent Passport", description: "Inspect an Agent NFT’s work, configuration versions, and ownership history." },
  security: { title: "Ownership & Security", description: "Inspect permissions and transfer Agent NFT ownership after obligations clear." },
  demo: { title: "Guided Demo", description: "Follow the PROOFBOUND workflow from mint and research to settlement and ownership transfer." },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { route } = await params;
  const page = route[0] === "jobs" && route[1]
    ? { title: "Job Receipt", description: "Inspect the research report, resource usage, and settlement evidence for a job." }
    : routes[route[0]];
  const { title, description } = page ?? { title: "Page not found", description: BRAND.description };
  return { title, description, ...siteMetadata(`/${route.map(encodeURIComponent).join("/")}`, title, description) };
}

export default async function Page({ params }: PageProps) {
  const { route } = await params;
  if (!Object.hasOwn(routes, route[0])) notFound();
  return <ProductPage route={route} />;
}
