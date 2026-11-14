# Build status

As of November 14, 2026, 10:53 UTC. Deadline is 23:59 UTC, or November 15, 00:59 Lagos time. Reserve 21:59–23:59 UTC for demo and submission review.

The build continues the work saved by Astra and three coding agents on `codex/proofbound-hackathon`, based on `7ae2207`. Main implementation resumed after the prior interruption. The original ignored `.env.local` was preserved.

| Area | Status and evidence |
|---|---|
| NEAR contract | Implemented. 29 host tests passed. Release WASM compiled. Deployment approval requested for the reviewed artifact on the existing development account. |
| Pricing and metering | Tested locally. 0.02 NEAR job storage, 0.01 default service, integer calculations matched to the accepted quote and captured sources. |
| Mint to settlement | Tested through HTTP with live queue, three customer sessions, conserved escrow, real resource reservations, 90/10 service split and 20% Earn-to-Refill. Accounting in this test is local simulation. |
| Ownership and security | Contract tests and local integration passed. Active obligations block transfer. The former owner loses management rights and keeps earnings. The buyer reactivates. |
| Inference | Fixture mode exercised in app and tests. One real NEAR AI research job succeeded and passed all checks. See `docs/evidence/live-research.json`. |
| Frontend | Production build passed. Premium Framer-informed design retained. Browser mint, activation and private job verified. Desktop, 390px and 820px review completed for the report. |
| Testnet | Read-only query confirmed 10 testnet NEAR and an empty target contract account. Deployment, restricted service accounts, live wallet flow and testnet settlement evidence remain pending. |
| Public release | GitHub push, hosting, X video and submission are pending user decisions. |

See [TEST_RESULTS.md](TEST_RESULTS.md), [DEMO_EVIDENCE.md](DEMO_EVIDENCE.md) and [TESTNET_REVIEW.md](TESTNET_REVIEW.md).
