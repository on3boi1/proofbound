# Build status

As of November 14, 2026. The documented deadline is 23:59 UTC, or November 15, 00:59 Lagos time. Reserve 21:59–23:59 UTC for demo and submission review.

The build continues the work saved by Astra and three coding agents on `codex/proofbound-hackathon`, based on `7ae2207`. Main implementation resumed after the prior interruption. The original ignored `.env.local` was preserved.

| Area | Status and evidence |
|---|---|
| NEAR contract | 29 host tests passed. Release WASM deployed and initialized on `contract.proofbound-dev-2026.testnet`. Downloaded onchain bytes match the reviewed artifact. |
| Pricing and metering | Tested locally. 0.02 NEAR job storage, 0.01 default service, integer calculations matched to the accepted quote and captured sources. |
| Mint to settlement | Tested through HTTP with live queue, three customer sessions, conserved escrow, real resource reservations, 90/10 service split and 20% Earn-to-Refill. Accounting in this test is local simulation. A generated receipt is in `docs/evidence/local-lifecycle.json`. |
| Ownership and security | Contract tests and local integration passed. Active obligations block transfer. The former owner loses management rights and keeps earnings. The buyer reactivates. |
| Inference | Fixture mode exercised in app and tests. One real NEAR AI research job succeeded and passed all checks. See `docs/evidence/live-research.json`. |
| Frontend | Production build passed. Browser mint, activation and private report verified in the local demo. Testnet bootstrap reads the deployed pricing and reports execution disabled. Testnet demo and job views now explain the missing worker authorization. Chrome confirmed app icon links and the browser title. Native light/dark tab-strip inspection remains pending. |
| Testnet | [Contract deployment](evidence/testnet-deployment.json) and [both service accounts](evidence/testnet-service-setup.json) finalized. Each service received 0.20 testnet NEAR. The two setup fees total 0.014271039756661 testnet NEAR. Finalized reads verified the exact recovery and restricted keys. The customer account is absent. [Permission probes and lifecycle writes](TESTNET_LIFECYCLE_REVIEW.md) await approval. |
| Public release | Vercel preview settings and worker separation are documented in the [lifecycle review](TESTNET_LIFECYCLE_REVIEW.md#read-only-preview). Hosting, GitHub push, X video and submission remain pending. |

See [TEST_RESULTS.md](TEST_RESULTS.md), [DEMO_EVIDENCE.md](DEMO_EVIDENCE.md) and [TESTNET_REVIEW.md](TESTNET_REVIEW.md).
