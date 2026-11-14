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
| Browser branding | Production build and the existing application tests passed. Chrome showed the updated app mark and resolved the browser title and icon links. All icon and manifest routes responded with HTTP 200 and expected media types. ICO has 16, 32 and 48px frames. PNG artwork was inspected at 16 and 32px on light and dark backgrounds. Native Chrome tab-strip inspection was blocked by the browser URL safety check. |
| Testnet deployment | Final success for the approved five-action batch `CG8mECzSAW8ST2PmKyZExHrCjBmtmK9X6NpAWr9rW1Dz`. Independently verified roles, initialization, code hash, fresh NFT supply, admin key and balances. Actual fee was 0.011949535241688 testnet NEAR against the 0.02 budget. [RPC evidence](evidence/testnet-deployment.json) |
| Testnet application reads | Local worker bootstrap returned the deployed contract address, zero agents, zero simulated identities, the 0.16 NEAR mint price, and the 0.02 NEAR job storage fee. Execution remained disabled. Production frontend build and both existing app tests passed. |
| Testnet mint and work | Pending role provisioning and specific transaction approval. The deployed contract's initial NFT supply is zero. |
| Final deployment safety review | 29 contract tests passed on rerun. Release hash remained `d3997e9541156038fad7d9418444badd295a48242b2df21b9d485ca15e82c3c2`. Verified the keychain's public key against finalized testnet permissions and decoded an unsigned five-action batch. The new contract account did not exist at the reviewed block. |
| Local service credential review | Two distinct Ed25519 keypairs passed public-key derivation and Windows DPAPI CurrentUser round-trip verification. Verified the owner-only file ACL and scanned Git-visible files for exact private key material without emitting it. |
| Testnet account setup preflight | Three unsigned batches encoded and decoded with exact transfer amounts, public keys and permissions. At finalized block 277653134 all proposed destinations returned `UNKNOWN_ACCOUNT` and the downloaded WASM matched the reviewed hash. The executor and verifier method exports are present, and 29 host tests passed on rerun. Scheduled testnet fees total 0.002546029294161 NEAR at the observed price. Live key grants and calls await approval. [Batch details](TESTNET_LIFECYCLE_REVIEW.md#stage-1-approve-account-and-key-setup) |
| Local production preview | Next.js production build passed. Landing, demo, marketplace, favicon, SVG, Apple icon and manifest returned HTTP 200. The production frontend proxy returned the real testnet contract and zero agents, with the worker disabled. The two existing app tests also passed. |

Commands are listed in [README.md](../README.md). On the managed Windows host, the HTTP test required loopback permission. The default sandbox denied the connection before any integration assertions ran.
