# Build status

As of November 14, 2026. The documented deadline is 23:59 UTC, or November 15, 00:59 Lagos time. Reserve 21:59–23:59 UTC for demo and submission review.

The build continues the work saved by Astra and three coding agents on `codex/proofbound-hackathon`, based on `7ae2207`. Main implementation resumed after the prior interruption. The original ignored `.env.local` was preserved.

| Area | Status and evidence |
|---|---|
| NEAR contract | Implemented. 29 host tests passed. Release WASM compiled. Deployment approval requested for the reviewed artifact on the existing development account. |
| Pricing and metering | Tested locally. 0.02 NEAR job storage, 0.01 default service, integer calculations matched to the accepted quote and captured sources. |
| Mint to settlement | Tested through HTTP with live queue, three customer sessions, conserved escrow, real resource reservations, 90/10 service split and 20% Earn-to-Refill. Accounting in this test is local simulation. A generated receipt is in `docs/evidence/local-lifecycle.json`. |
| Ownership and security | Contract tests and local integration passed. Active obligations block transfer. The former owner loses management rights and keeps earnings. The buyer reactivates. |
| Inference | Fixture mode exercised in app and tests. One real NEAR AI research job succeeded and passed all checks. See `docs/evidence/live-research.json`. |
| Frontend | Production build passed. Browser mint, activation and private report verified in the local demo. Added a shared logo and browser assets, route metadata, and refinements to guided demo and account loading. Chrome confirmed app icon links and the browser title. Native light/dark tab-strip inspection remains pending. |
| Testnet | At finalized block 277650642 the funding parent held 10 testnet NEAR and the contract subaccount did not exist. All 29 tests passed again, the release WASM hash matched, and the five-action unsigned deployment to the dedicated child was decoded and verified. Deployment approval, service accounts, wallet flow and onchain settlement evidence remain pending. |
| Public release | GitHub push, hosting, X video and submission are pending user decisions. |

See [TEST_RESULTS.md](TEST_RESULTS.md), [DEMO_EVIDENCE.md](DEMO_EVIDENCE.md) and [TESTNET_REVIEW.md](TESTNET_REVIEW.md).
