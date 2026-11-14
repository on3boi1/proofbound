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
| Testnet write path | Deployment approval pending. Live wallet signing and testnet settlement are unverified. |
| Final deployment safety review | 29 contract tests passed on rerun. Release hash remained `d3997e9541156038fad7d9418444badd295a48242b2df21b9d485ca15e82c3c2`. Verified the keychain's public key against finalized testnet permissions and decoded an unsigned five-action batch. The new contract account did not exist at the reviewed block. |

Commands are listed in [README.md](../README.md). On the managed Windows host, the HTTP test required loopback permission. The default sandbox denied the connection before any integration assertions ran.
