# PROOFBOUND

I built PROOFBOUND to answer a question about handing over an AI agent. What should the next owner get? An Agent NFT on NEAR carries the right to manage the agent, its unspent Fuel and its public work record. The separate worker runs source-backed research and checks the evidence. The contract records Fuel, escrow and settlement and enforces the owner and service permissions.

[Watch the official NEAR Hackathon demo on X](https://x.com/on3boi_1/status/2121754200661262588) · [Browse the hackathon branch](https://github.com/on3boi1/proofbound/tree/codex/proofbound-hackathon) · [Review the original hackathon commit](https://github.com/on3boi1/proofbound/tree/be6a2193daa01c998647660741ef4418d6e34e72)

The implementation and run instructions are on `codex/proofbound-hackathon`. GitHub opens the initial `main` branch by default.

Requires Node.js 24 and npm 11. The default demo uses SQLite, simulated identities and balances, and deterministic research fixtures.

```sh
npm ci
npm test
npm run dev
```

1. Open `http://127.0.0.1:3000/demo` and select `owner.local`.
2. Mint Atlas and see 100,000 Fuel and zero completed jobs.
3. Activate Atlas, assign a personal research question, and open the report and ProofGuarantee checks.
4. Configure Hybrid mode and 20% Earn-to-Refill. Switch to a customer identity and hire Atlas from Explore Agents.
5. Inspect earnings and the Agent Passport as the owner. Run the payout redirection probe. After the jobs finish, transfer to `buyer.local` and reactivate as the buyer.

The HTTP test runs this lifecycle with three concurrent customers and checks every escrowed amount and Fuel unit. See [DEMO.md](docs/DEMO.md).

Atlas #1 is minted and active on NEAR testnet at `contract.proofbound-dev-2026.testnet`. The receipts show the initial 100,000 Fuel, ownership, and Hybrid activation with a 20% Earn-to-Refill setting. [Mint receipt](https://testnet.nearblocks.io/txns/HcdKs9anEs93H8Vw1Pyqaf5gck7rvdB2qmYXsa28djJn) · [Activation receipt](https://testnet.nearblocks.io/txns/GB6GqYERprss2pKhYWfjAWXrwqWLcArTkK7XqKy2QvVR) · [Tests and evidence](docs/TEST_RESULTS.md)

Fuel is prepaid compute credit. Each job reserves a fixed budget and records actual usage. The local workflow reproduces marketplace escrow, the 90/10 service fee split and an optional conversion of the owner's share into Fuel. The verification receipt records source and output hashes, reproducible calculations and budget checks. Transfer revokes the previous owner's operating authority while preserving the public work record. Paid settlement, refill and transfer have local evidence. One real NEAR AI research run used local accounting. [Demo evidence](docs/DEMO_EVIDENCE.md)

The [public PROOFBOUND demo](https://tryproofbound.pages.dev/) runs on Cloudflare Pages Free and reads finalized NEAR testnet data directly. Browse [Atlas #1](https://tryproofbound.pages.dev/agents/1) and its [Agent Passport](https://tryproofbound.pages.dev/passport/1). Connect a testnet wallet to view its public roster. Research execution, hiring, job reports and wallet transactions require the separate execution worker and are unavailable on the public site. Use the local steps above to reproduce the full workflow. [Deployment evidence](docs/evidence/cloudflare-frontend-deployment.json)

For contract tests and WASM, install Rust with the `wasm32-unknown-unknown` target. On Windows, install the Visual Studio C++ Build Tools, Windows SDK and CMake/Ninja.

```sh
npm run test:contract
npm run build:contract
```

On Linux and macOS, these scripts use `cargo` directly. Install the platform compiler, CMake and NASM as required by the host dependencies.

Copy settings individually from [.env.example](.env.example) into the ignored root `.env.local`. With a NEAR AI key, `node --import tsx scripts/research-smoke.ts --live` runs one capped end-to-end live inference with local accounting. [Verified live run](docs/evidence/live-research.json)

The Next.js app is in `apps/web`, the persistent Node worker in `apps/worker`, the contract in `contracts/proofbound`, and API types in `packages/shared`. See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [CONTRACT_API.md](docs/CONTRACT_API.md), and [RUNTIME_API.md](docs/RUNTIME_API.md).

Build the standard Next.js frontend with `npm run typecheck && npm run build`. To reproduce the hosted build locally, run `npm run pages:build --workspace @proofbound/web` then `npm run pages:preview --workspace @proofbound/web -- --ip 127.0.0.1`. The preview needs outbound access to public NEAR testnet RPC. See the [release runbook](docs/RELEASE_REVIEW.md) for Pages configuration and the separate authenticated worker.

Agent Economy covers hiring and escrow. NFTs That Do Something covers the transfer of operating rights and history. AI Security & Defense covers role restrictions, budgets and replay protection. Autonomous Business covers revenue settlement and Earn-to-Refill. See [BUILD_STATUS.md](docs/BUILD_STATUS.md) for verified scope.

The repository began at commit `7ae2207` with a description, MIT license, and ignore rules. The implementation is on `codex/proofbound-hackathon`. AI coding assistance was used. Dependencies include Next.js, React, NEAR Connect, near-api-js, near-sdk, near-contract-standards, Lucide and open fonts. Framer informed the visual review. The interface uses original code and graphics. [Hackathon changes](https://github.com/on3boi1/proofbound/compare/main...codex/proofbound-hackathon) · [Design research](docs/DESIGN_RESEARCH.md)
