# Build status

As of November 14, 2026. The documented deadline is 23:59 UTC, or November 15, 00:59 Lagos time. Reserve 21:59–23:59 UTC for demo and submission review.

The build continues the work saved by Astra and three coding agents on `codex/proofbound-hackathon`, based on `7ae2207`. Main implementation resumed after the prior interruption. The original ignored `.env.local` was preserved.

| Area | Status and evidence |
|---|---|
| NEAR contract | 30 host tests passed, including the exact missing-job panic regression. Release WASM deployed and initialized on `contract.proofbound-dev-2026.testnet`. Downloaded onchain bytes match the reviewed artifact. |
| Pricing and metering | Tested locally. 0.02 NEAR job storage, 0.01 default service, integer calculations matched to the accepted quote and captured sources. |
| Mint to settlement | Tested through HTTP with live queue, three customer sessions, conserved escrow, real resource reservations, 90/10 service split and 20% Earn-to-Refill. Accounting in this test is local simulation. A generated receipt is in `docs/evidence/local-lifecycle.json`. |
| Ownership and security | Contract tests and local integration passed. Active obligations block transfer. The former owner loses management rights and keeps earnings. The buyer reactivates. |
| Inference | Fixture mode exercised in app and tests. One real NEAR AI research job succeeded and passed all checks. See `docs/evidence/live-research.json`. |
| Frontend | Production build passed. Chrome confirmed Atlas #1 with 100,000 Fuel and paused execution in the testnet owner workspace and My Agents. The local demo additionally covers activation and private reports. Chrome reached the testnet Meteor Web handoff. The customer NEP-413 session awaits wallet-side approval. Native light/dark tab-strip inspection remains pending. |
| Testnet | [Atlas NFT #1](evidence/testnet-atlas-mint.json) finalized with 100,000 available Fuel and zero reserved. [Contract deployment](evidence/testnet-deployment.json), [service accounts](evidence/testnet-service-setup.json) and [permission probe evidence](evidence/testnet-restricted-key-probes.json) are verified. The allowed probe trapped on the missing-job panic path reproduced with the exact deployed WASM. [Activation and remaining lifecycle writes](TESTNET_LIFECYCLE_REVIEW.md#stage-2-approve-the-test-run) await approval. |
| Public release | GitHub, Vercel and persistent worker settings are ready for [release review](RELEASE_REVIEW.md). Push, hosting, the human's X demo and submission remain pending. |

See [TEST_RESULTS.md](TEST_RESULTS.md), [DEMO_EVIDENCE.md](DEMO_EVIDENCE.md) and [TESTNET_REVIEW.md](TESTNET_REVIEW.md).
