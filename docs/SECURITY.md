# Security

The model receives approved sources and job instructions. It has no signing keys or financial tools. The contract enforces current ownership, executor and verifier roles, deposits, work caps, deadlines, configuration versions and replay protection. Wallet confirmation matches the actual finalized transaction to the operation.

Both NFT transfer paths reject active jobs. The receiver callback path freezes operations until resolution. Transfer revokes previous management rights, clears old permissions and requires reactivation. Private reports remain available only to their original participants.

The server verifies one-time NEP-413 signatures and checks the current FullAccess key against finalized RPC state. Runtime signer keys must have finite FunctionCall allowance and limited methods. Withdrawals debit before transfer and restore once on callback failure. The account's full-access key retains contract upgrade authority.

The worker and inference provider process inputs offchain. Use public research data in the prototype. The centrally operated verifier is a trust boundary. Verification proves evidence integrity and selected checks, while report claims still require judgment. Reputation can be manipulated through collusion and Sybil accounts despite duplicate and self-hiring controls.

The public demo uses an HTTPS Cloudflare Pages Function with an allowlist of finalized NEAR testnet views. Public mode is fixed at build time. The deployed bundle has no worker connection, database or signing credentials. Meteor supplies the public testnet account for roster viewing. Authenticated sessions, transaction intents and inference are offline on the hosted demo. In the separate worker deployment, Next.js authenticates to the worker with a server-only token. The worker checks the origin, rate limits and signed wallet session. [Public deployment checks](evidence/cloudflare-frontend-deployment.json)
