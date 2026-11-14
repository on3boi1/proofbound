# Test results

November 14, 2026.

| Check | Result |
|---|---|
| Windows contract host tests using MSVC, CMake/Ninja and bundled assembly | 29 passed. Checked mint and NFT ownership, Fuel reservations and caps, payment splits, reinvestment, refunds, replay, unauthorized settlement, NFT transfer callbacks and withdrawals. |
| Release WASM build | Passed. 395,854 bytes. Artifact SHA-256 recorded in TESTNET_REVIEW.md. |
| Worker TypeScript and Next.js production build | Passed. |
| HTTP integration | Passed. Local lifecycle exercises separate clients, three concurrent paid jobs, source operand tampering, escrow and Fuel reconciliation, forbidden action, transfer and buyer activation. |
| Wallet authentication unit test | Passed. Real Ed25519 signature verifies the challenge. Altered recipient, non-FullAccess key and replay are rejected. |
| Live Research Agent | Passed with seven deterministic verification checks using the configured NEAR AI key. The request used 1,631 tokens. |
| Browser | Local mint, activation, quote, job completion and evidence views checked in Chrome. Desktop, phone and tablet review covered the report. |
| Testnet write path | Deployment approval pending. Live wallet signing and testnet settlement are unverified. |

Commands are listed in [README.md](../README.md). On the managed Windows host, the HTTP test required loopback permission. The default sandbox denied the connection before any integration assertions ran.
