# Proposed testnet mint-to-settlement run

The dedicated contract is deployed at `contract.proofbound-dev-2026.testnet`. Its initial NFT supply is zero, and the configured executor and verifier accounts do not exist. The deployment authorization covered only the finalized creation, funding, code installation and initialization batch. [Deployment evidence](evidence/testnet-deployment.json)

## Stage 1: Approve account and key setup

All three proposed batches use testnet. The signer is `proofbound-dev-2026.testnet` with its existing FullAccess keychain public key `ed25519:FNjvjHjhvV252B3uQm844fjPHDRBFRz8tah8cLWGLi72`. Every batch begins with `CreateAccount`. Recheck the destinations, parent key and fees immediately before signing and stop if a destination already exists. Fund **0.60 testnet NEAR in total**, divided as follows.

| Receiver | Ordered actions after `CreateAccount` | Scheduled gas | Est. testnet NEAR fee |
|---|---|---:|---:|
| `exec.proofbound-dev-2026.testnet` | Transfer 0.20 NEAR, add parent `FullAccess` recovery key, add executor `FunctionCall` key below | 8.555521242104 Tgas | 0.0008555521242104 |
| `verify.proofbound-dev-2026.testnet` | Transfer 0.20 NEAR, add parent `FullAccess` recovery key, add verifier `FunctionCall` key below | 8.554876324506 Tgas | 0.0008554876324506 |
| `customer.proofbound-dev-2026.testnet` | Transfer 0.20 NEAR, add the existing parent key as the customer's sole `FullAccess` key for a CLI-controlled test account | 8.349895375 Tgas | 0.0008349895375 |

| Online service | Ed25519 public key | Exact method allowlist |
|---|---|---|
| Executor | `ed25519:GNRAPM1j3a3tu4wvzNTzJWPWDYANVGRwYJREhEwKDa8X` | `start_job`, `submit_result` |
| Verifier | `ed25519:Ey3AjZr3wjecLKfc7t54L1d6nUXdKCyTNSce9BV9VfX2` | `verify_job` |

Each service key is scoped to `contract.proofbound-dev-2026.testnet`, has a **0.05 testnet NEAR** gas allowance from its funded balance, and can make single zero-deposit calls on its allowlist. A compromised executor can start jobs or post result commitments within contract rules. A compromised verifier can accept or reject work within the contract's settlement rules. The recovery key can revoke either worker key with a separately approved transaction. Keep it in the existing NEAR CLI keychain. [NEAR access keys](https://docs.near.org/protocol/accounts-contracts/access-keys)

The two independently generated online credentials are stored in a Windows DPAPI `CurrentUser` bundle in the operator's local profile outside Git. The bundle decrypted back to the original in-memory payload and the file ACL grants access to the current Windows user. Local storage ties access to that user and machine. When live worker writes are separately approved, load the two credentials only into that worker process. [Windows DPAPI](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata)

The exact customer batch above uses the existing keychain only. Reuse increases the accounts exposed by an admin-key compromise and gives no separate browser wallet credential. For the browser demo, use an independently controlled NEP-413-compatible testnet wallet public key as the customer's sole `FullAccess` key. Supply only its public key, then review the updated customer batch before signing. Keep the shared admin credential in the keychain.

At finalized block **277653134**, all three destinations returned `UNKNOWN_ACCOUNT`. The parent had **5.738050464758312** testnet NEAR including **0.00182** in storage reserve. All three unsigned Borsh transactions were independently decoded and verified. At **100,000,000 yoctoNEAR per gas unit**, total estimated fees are **0.002546029294161 testnet NEAR**. The requested fee ceiling is **0.02 testnet NEAR** for all setup fees, for a maximum parent debit of **0.62 testnet NEAR** with all three batches. Refresh nonce, recent block hash and fee estimate if approved. [NEAR runtime fees](https://github.com/near/nearcore/blob/master/docs/RuntimeSpec/Fees/Fees.md)

The downloaded testnet WASM matched the reviewed release hash and exports all three service methods. The reviewed methods are nonpayable and require their configured predecessor IDs. The worker sends zero-deposit calls and checks the live access key and role before signing. All 29 contract tests passed, including role separation and settlement safeguards. Live key installation and live method calls still require separate approval.

## Stage 2: Approve the test run

Use the branded local interface in testnet mode, connected to the deployed contract. Review a funded owner wallet and a separate customer wallet, then verify each identity with NEP-413 before the first mutation. The contract permits either the parent or another reviewed account to mint. Keep the parent admin key in its current protected store. Enable service signing only after the two keys have been verified onchain and the lifecycle actions are approved. The proposed run has one private research job and one paid marketplace job, with at most one live model request per job.

| Order | Signing account | Method on the deployed contract | Attached testnet NEAR |
|---|---|---|---:|
| 1 | Owner wallet | `mint_agent` with name Atlas and the reviewable configuration commitment | 0.16 |
| 2 | Owner wallet | `configure_agent` for the minted token, activate it in Hybrid mode, cap it at 8,000 Fuel/job and three concurrent jobs, set service fee to 0.01 testnet NEAR, set Earn-to-Refill to 2,000 basis points | 1 yoctoNEAR |
| 3 | Owner wallet | `submit_job` for private research, using the finalized configuration version, reviewed request hash and quote deadline | 0.02 |
| 4–6 | Executor, executor, verifier | `start_job`, `submit_result`, `verify_job` for the private job in order | 0 each |
| 7 | Customer wallet | `submit_job` for one paid marketplace hire, using the finalized configuration version, reviewed request hash and quote deadline | 0.038 |
| 8–10 | Executor, executor, verifier | `start_job`, `submit_result`, `verify_job` for the marketplace job in order | 0 each |
| 11 | Owner wallet | `nft_transfer` to the reviewed buyer after both jobs settle and all reservations clear | 1 yoctoNEAR |

The worker attaches 100 Tgas per call. At the setup review's gas price, every 100 Tgas represents 0.01 testnet NEAR in prepaid execution gas, plus receipt and action fees. Obtain a separate lifecycle fee ceiling from fresh values before approval. The customer quote contains 0.01 service, 0.008 maximum compute and 0.02 storage. Review each transaction's dynamic token ID, hashes, deadline and exact quote before signing. Use the real result and evidence commitments for each `submit_result`, then measured Fuel and a truthful acceptance outcome for each `verify_job`. If research or verification fails, the existing refund path uses the same verifier method with a failed outcome. Stop on an ambiguous onchain result and reconcile before signing anything further.

Expected successful receipt: 0.009 owner gross, 0.001 platform service share, 0.0018 funded refill (1,800 Fuel), 0.0072 claimable owner share under normal headroom, and a refund of unused compute. Actual compute and refund depend on measured Fuel. The verifier must use actual results. A successful contract settlement only supports a live inference claim when the provider receipt shows an actual NEAR AI call.

Capture finalized transaction hashes, balances, `nft_token`, `get_agent`, `get_job`, output/evidence hashes and provider usage. Settlement and Earn-to-Refill are recorded by the same successful `verify_job` call. Verify customer settings denial, retained history and Fuel after transfer, and old-owner denial using readbacks and the app's pre-sign checks. This run requires separate approval after setup. Withdrawal, buyer reactivation, extra jobs and public release are separate decisions.

## Read-only preview

Use a dedicated local testnet worker with `PROOFBOUND_ALLOW_CHAIN_WRITES=0`, `PROOFBOUND_MODE=testnet`, and `NEAR_CONTRACT_ID=contract.proofbound-dev-2026.testnet`. Keep `PROOFBOUND_PROVIDER=fixture` for a network-only preview. The frontend can display testnet reads while paid submission waits for the executor and verifier.

For a separately approved Vercel preview, use `apps/web` as the Next.js project root and allow shared workspace files from the repository root. Set server-only `PROOFBOUND_WORKER_URL` to the preview's reachable HTTPS worker endpoint. Run the persistent SQLite worker outside Vercel with its own database and set `PROOFBOUND_WEB_ORIGIN` to the exact preview origin. Keep writes disabled for the preview and keep signing and provider credentials on the worker. Smoke-test bootstrap, branded routes, icons and the status badge before publishing any preview URL. [Vercel monorepo setup](https://vercel.com/docs/monorepos)
