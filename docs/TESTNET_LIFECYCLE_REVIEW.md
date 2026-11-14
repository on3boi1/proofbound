# Proposed testnet mint-to-settlement run

The dedicated contract is deployed at `contract.proofbound-dev-2026.testnet` with an initial NFT supply of zero. The two separately approved service setup transactions are also final. [Deployment evidence](evidence/testnet-deployment.json) · [Service setup evidence](evidence/testnet-service-setup.json)

## Stage 1: Service account setup verified

The signer was `proofbound-dev-2026.testnet` with its existing FullAccess keychain public key `ed25519:FNjvjHjhvV252B3uQm844fjPHDRBFRz8tah8cLWGLi72`. Both destinations were absent at preflight block **277677538**. Each finalized receipt contained `CreateAccount`, a **0.20 testnet NEAR** transfer, `AddKey` for the recovery key, and `AddKey` for the restricted service key.

| Receiver | Finalized transaction | Actual testnet NEAR fee | Total balance | Storage reserve |
|---|---|---:|---:|---:|
| `exec.proofbound-dev-2026.testnet` | [HJeTtHt5bGubBzQGnYRS1XT8U2giXEEhibYRnmusDphk](https://testnet.nearblocks.io/txns/HJeTtHt5bGubBzQGnYRS1XT8U2giXEEhibYRnmusDphk) | 0.0071355521242104 | 0.20 | 0.00355 |
| `verify.proofbound-dev-2026.testnet` | [UHD3DWioXsSVrycs2JznPgSk9qCQ37LqjoD3BMFujaW](https://testnet.nearblocks.io/txns/UHD3DWioXsSVrycs2JznPgSk9qCQ37LqjoD3BMFujaW) | 0.0071354876324506 | 0.20 | 0.00339 |

| Online service | Ed25519 public key | Exact method allowlist |
|---|---|---|
| Executor | `ed25519:GNRAPM1j3a3tu4wvzNTzJWPWDYANVGRwYJREhEwKDa8X` | `start_job`, `submit_result` |
| Verifier | `ed25519:Ey3AjZr3wjecLKfc7t54L1d6nUXdKCyTNSce9BV9VfX2` | `verify_job` |

Each service key is scoped to `contract.proofbound-dev-2026.testnet`, has a **0.05 testnet NEAR** gas allowance from its funded balance, and can make single zero-deposit calls on its allowlist. A compromised executor can start jobs or post result commitments within contract rules. A compromised verifier can accept or reject work within the contract's settlement rules. The recovery key can revoke either worker key with a separately approved transaction. Keep it in the existing NEAR CLI keychain. [NEAR access keys](https://docs.near.org/protocol/accounts-contracts/access-keys)

The two independently generated online credentials are stored in a Windows DPAPI `CurrentUser` bundle in the operator's local profile outside Git. The bundle decrypted back to the original in-memory payload and the file ACL grants access to the current Windows user. Local storage ties access to that user and machine. When live worker writes are separately approved, load the two credentials only into that worker process. [Windows DPAPI](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata)

Total fees were **0.014271039756661 testnet NEAR**, within the **0.02** ceiling. The earlier static estimate omitted the protocol account creation charge. Independent reads at finalized block **277677678** confirmed both exact key lists, both balances, the deployed code hash, configured roles, and the absence of the customer account. The parent balance is **5.323779425001651** testnet NEAR, including **0.00182** reserved for storage. The contract balance is **4.25** testnet NEAR. [NEAR gas pricing and account creation charge](https://github.com/near/nearcore/blob/master/docs/architecture/how/gas.md#gas-price)

## Browser wallet for the customer

Use a separately controlled named `.testnet` wallet. Meteor's NEAR Connect integration advertises both testnet and message signing. In the wallet, select NEAR Testnet and use an independent named account. Provide only its public account ID for a finalized balance and key check. To provision `customer.proofbound-dev-2026.testnet` instead, provide only the wallet's independent Ed25519 public key and review the exact creation batch before signing. The reviewed owner wallet and customer must be distinct. [Meteor Wallet](https://docs.meteorwallet.app/) · [NEAR Connect manifest](https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/manifest.json)

## Approve restricted-key enforcement calls

The contract exports the reviewed nonpayable methods and checks the executor or verifier predecessor before touching jobs. Both proposals use only the installed executor FunctionCall key on `exec.proofbound-dev-2026.testnet`, receiver `contract.proofbound-dev-2026.testnet`, **20 Tgas** and **0 NEAR** attached per call. Recheck that the probe job ID is absent immediately before signing.

| Order | Call | Expected evidence |
|---|---|---|
| 1 | `get_config({})` | NEAR rejects the method outside the key's allowlist before receipt execution. Record the RPC error and check that nonce, allowance and balance did not move. |
| 2 | `start_job({"job_id":"proofbound-permission-probe-20261114"})` | NEAR admits the allowed method and the contract returns `Unknown job` in a finalized failed receipt. This checks authorization and leaves job state untouched. The first successful call can be the real queued job's `start_job`. |

At block **277677878**, the allowed call required **0.020919271699719** testnet NEAR up front and could burn up to **0.0021199014339642** at the observed gas price. The forbidden call should incur no fee. Proposed combined fee ceiling is **0.005 testnet NEAR**. Neither call has run. [NEAR access-key checks](https://github.com/near/nearcore/blob/master/runtime/runtime/src/verifier.rs)

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

The worker attaches **30 Tgas** for service calls and stages **100 Tgas** for wallet calls. Testnet's minimum gas purchase price of 1 billion yoctoNEAR per gas would charge more than 0.10 NEAR up front at 100 Tgas, exceeding the service allowance. The 30 Tgas limit fits the installed 0.05 NEAR allowance at the observed parameters. Transaction execution within this limit remains to be verified live. Check current gas purchase costs, allowances and wallet balances before approval. The customer quote contains 0.01 service, 0.008 maximum compute and 0.02 storage. Review each transaction's dynamic token ID, hashes, deadline and exact quote before signing. Use real result and evidence commitments and report the measured Fuel and actual verification outcome. If research or verification fails, the existing refund path uses the same verifier method with a failed outcome. Stop on an ambiguous onchain result and reconcile before signing anything further.

Expected successful receipt: 0.009 owner gross, 0.001 platform service share, 0.0018 funded refill (1,800 Fuel), 0.0072 claimable owner share under normal headroom, and a refund of unused compute. Actual compute and refund depend on measured Fuel. The verifier must use actual results. A successful contract settlement only supports a live inference claim when the provider receipt shows an actual NEAR AI call.

Capture finalized transaction hashes, balances, `nft_token`, `get_agent`, `get_job`, output/evidence hashes and provider usage. Settlement and Earn-to-Refill are recorded by the same successful `verify_job` call. Verify customer settings denial, retained history and Fuel after transfer, and old-owner denial using readbacks and the app's pre-sign checks. This run requires separate approval after setup. Withdrawal, buyer reactivation, extra jobs and public release are separate decisions.

## Read-only preview

Use a dedicated local testnet worker with `PROOFBOUND_ALLOW_CHAIN_WRITES=0`, `PROOFBOUND_MODE=testnet`, and `NEAR_CONTRACT_ID=contract.proofbound-dev-2026.testnet`. Keep `PROOFBOUND_PROVIDER=fixture` for a network-only preview. The frontend can display testnet reads while paid submission waits for the executor and verifier.

For a separately approved Vercel preview, use `apps/web` as the Next.js project root and allow shared workspace files from the repository root. Set server-only `PROOFBOUND_WORKER_URL` to the preview's reachable HTTPS worker endpoint. Run the persistent SQLite worker outside Vercel with its own database and set `PROOFBOUND_WEB_ORIGIN` to the exact preview origin. Keep writes disabled for the preview and keep signing and provider credentials on the worker. Smoke-test bootstrap, branded routes, icons and the status badge before publishing any preview URL. [Vercel monorepo setup](https://vercel.com/docs/monorepos)
