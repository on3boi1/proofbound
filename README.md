# PROOFBOUND

Mint a Research Agent NFT, run research with a Fuel budget, hire out the agent, and transfer its operating rights while preserving its public work history. NEAR holds ownership, escrow, Fuel and settlement. A separate worker runs research and checks evidence.

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

For contract tests and WASM, install Rust with the `wasm32-unknown-unknown` target. On Windows, install the Visual Studio C++ Build Tools, Windows SDK and CMake/Ninja.

```sh
npm run test:contract
npm run build:contract
```

On Linux and macOS, these scripts use `cargo` directly. Install the platform compiler, CMake and NASM as required by the host dependencies.

Copy settings individually from [.env.example](.env.example) into the ignored root `.env.local`. With a NEAR AI key, `node --import tsx scripts/research-smoke.ts --live` runs one capped end-to-end live inference with local accounting. [Verified live run](docs/evidence/live-research.json)

The Next.js app is in `apps/web`, the persistent Node worker in `apps/worker`, the contract in `contracts/proofbound`, and API types in `packages/shared`. See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [CONTRACT_API.md](docs/CONTRACT_API.md), and [RUNTIME_API.md](docs/RUNTIME_API.md).

Agent Economy covers hiring and escrow. NFTs That Do Something covers the transfer of operating rights and history. AI Security & Defense covers role restrictions, budgets and replay protection. Autonomous Business covers revenue settlement and Earn-to-Refill. See [BUILD_STATUS.md](docs/BUILD_STATUS.md) for verified scope.

The repository began at commit `7ae2207` with a description, MIT license, and ignore rules. The implementation is on `codex/proofbound-hackathon`. AI coding assistance was used. Dependencies include Next.js, React, NEAR Connect, near-api-js, near-sdk, near-contract-standards, Lucide and open fonts. Framer informed the visual review. The interface uses original code and graphics. [Design research](docs/DESIGN_RESEARCH.md)
