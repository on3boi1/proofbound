# Runtime API

The persistent Node 24 service listens on `127.0.0.1:3001`. The Next.js app proxies `/api/*` to it. JSON is UTF-8. Money is a decimal **integer yoctoNEAR string**; Fuel is an integer. Types live in `packages/shared/src/index.ts`. Errors are `{error:{code,message}}` with appropriate HTTP status. Mutations require an authenticated session, same-origin request, and JSON content type. Cookies are HttpOnly, SameSite=Lax. Local accounts are explicitly simulated and never authenticate a testnet user.

## Local frontend contract

| Method | Path | Body / response |
|---|---|---|
| GET | `/api/health` | runtime health |
| GET | `/api/bootstrap` | `Bootstrap`: runtime/session, visible agents/jobs/ledger, claimable balance, pricing |
| POST | `/api/session/local` | `{accountId:"owner.local"}`; sets cookie, returns `{session}`. Only local mode. Allowed accounts in Bootstrap. |
| DELETE | `/api/session` | clears session |
| GET | `/api/agents` | `{agents}` public marketplace agents; `?owned=true` current owner's agents |
| POST | `/api/agents` | `{name, instructions?, allowedTools?, mode?}` -> `{agent}`. Local simulated mint; testnet returns transaction intent. |
| GET | `/api/agents/:id` | `{agent, jobs, passport, ledger}`. Private instructions/results/ledger redacted for unauthorized callers. |
| PATCH | `/api/agents/:id` | partial `AgentConfig`; creates immutable config version |
| POST | `/api/agents/:id/topup` | `{amount:"100000000000000000000000"}` (0.1 testnet NEAR => 100,000 Fuel) |
| POST | `/api/agents/:id/transfer` | `{receiverId:"buyer.local"}`; blocks unresolved jobs, revokes config, increments ownership epoch |
| POST | `/api/agents/:id/security-check` | `{action:"redirect-payout"}`; records actual policy denial, returns denied result |
| POST | `/api/jobs/quote` | `{agentId,kind:"private"|"marketplace",fuelBudget?:8000}` -> `{quote}` |
| POST | `/api/jobs` | `{agentId,kind,input:{topic,focus:"ecosystem"|"network"|"economics"},fuelBudget?:8000,idempotencyKey}` -> `{job}`. Commits reservation atomically. |
| GET | `/api/jobs` | `{jobs}` authorized jobs only |
| GET | `/api/jobs/:id` | `{job}`; only original customer/owner, not a subsequent NFT owner |
| GET | `/api/jobs/:id/proof` | `{job}`; public redacted verification and settlement, without input, report or captured source content |
| POST | `/api/jobs/:id/cancel` | `{}`; queued only, eligible deposit refund |
| POST | `/api/withdraw` | `{}`; local ledger withdrawal; testnet intent |
| GET | `/api/passport/:id` | `{agent,events,jobs}` public hashes and redacted job history |

Local mode starts with no agents or fabricated jobs. Users select `owner.local`, mint, activate, then run real fixture execution through the same queue, verifier, and accounting service. Customer identities are `customer-one.local`, `customer-two.local`, `customer-three.local`; transfer target `buyer.local`. All accounts are demonstrations. There are no live blockchain receipts in this mode.

## Testnet integration

`PROOFBOUND_MODE=testnet` disables local identities and all local financial mutations. NEP-413 signs server-issued nonces; verification checks the Ed25519 signature and current FullAccess key on testnet RPC. Agent ownership is rechecked against finalized contract state. Financial actions return wallet transaction intents. A transaction hash alone never authorizes execution: the chain job's customer, request hash, config version and reservation must match before work starts. Final settlement is performed by the configured trusted verifier only, through an explicit signer adapter; the language model has no key or financial tool.

Testnet endpoints and operational signer setup will be documented as the contract integration is finalized. No secret belongs in a browser environment variable. There is no automatic public deployment or blockchain signing during development.

## Pricing and verification

Default mint quote is 0.05 NEAR storage + 0.10 prepaid compute + 0.01 platform = 0.16 testnet NEAR. One Fuel unit maps to 10^18 yoctoNEAR (0.000001 NEAR). Initial allowance is 100,000 Fuel. Job storage is 0.02 NEAR. The default service fee is 0.01 NEAR. The contract supplies the authoritative testnet quote. The owner receives 90% of the service fee and the platform receives 10%, with compute accounted separately. Failed jobs refund service and compute escrow. The operator covers failed inference from its provider credits.

Reports include source snapshots, SHA-256 content/output/evidence hashes, numeric calculations and a deterministic verification receipt. Verification checks structure, source membership, source hashes, arithmetic, usage caps and retrieval age. It does not prove factual truth or prediction quality. Trusted operator settlement is not trustless.
