# Proposed testnet mint-to-settlement run

The dedicated contract is deployed at `contract.proofbound-dev-2026.testnet`. The service setup transactions and the single approved mint of Atlas NFT #1 are final. [Deployment evidence](evidence/testnet-deployment.json) · [Service setup evidence](evidence/testnet-service-setup.json) · [Atlas mint](evidence/testnet-atlas-mint.json)

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

The operator supplied `proofbound.testnet` as the independently controlled Meteor customer wallet. Finalized block **277680701** shows **0.50 testnet NEAR**, zero locked balance, and one FullAccess key distinct from the developer's. It has enough for the reviewed 0.038 NEAR paid escrow and the wallet call's current upfront gas estimate. The former CLI customer proposal is retired. In Chrome, the local production app showed Meteor on the testnet selector and reached **Continue in Meteor Web**. Wallet-side approval and an off-chain NEP-413 signature from the customer are still required to verify a completed app session. [Wallet and balance evidence](evidence/testnet-restricted-key-probes.json)

## Restricted-key enforcement calls verified

Both approved calls used the executor FunctionCall key on `exec.proofbound-dev-2026.testnet`, receiver `contract.proofbound-dev-2026.testnet`, **20 Tgas** and **0 NEAR** attached per call. The job was absent before and after the probes.

| Order | Call | Observed evidence |
|---|---|---|
| 1 | `get_config({})` | RPC returned `MethodNameMismatch` before inclusion. Hash lookup returned `UNKNOWN_TRANSACTION`. Executor nonce, allowance and balance were unchanged. Fee was zero. |
| 2 | `start_job({"job_id":"proofbound-permission-probe-20261114"})` | NEAR admitted the transaction and ran the contract receipt. The finalized receipt failed with `WebAssembly trap: An unreachable opcode was executed`. It did not expose the expected `Unknown job` message. The job stayed absent. [Explorer](https://testnet.nearblocks.io/txns/23Gr4L5v8s87LXLdvXpgwg2QYjwWRPHZ26gUnWiqcm6u) |

The combined fee was **0.0001834312719716 testnet NEAR** against a **0.005** ceiling. The executor now has **0.1998165687280284** testnet NEAR and **0.0498165687280284** remaining key allowance. These results establish method allowlist enforcement. Successful execution of a real queued job remains to be verified. [RPC receipts](evidence/testnet-restricted-key-probes.json)

The Rust regression test catches `Unknown job` after the executor passes the role check and verifies that the existing agent's job count and Fuel are unchanged. The byte-identical release WASM, with the finalized contract `STATE` record, reviewed executor predecessor and probe arguments, reproduced an `unreachable` trap after reading the missing job key. No write host call ran. The release uses `panic = "abort"`. The live receipt establishes a finalized failure and the missing-job readback establishes the state outcome. It does not expose a human-readable contract error.

## Stage 2: Approve the test run

The owner is `proofbound-dev-2026.testnet`. The proposed customer and transfer recipient is `proofbound.testnet`. Every call targets `contract.proofbound-dev-2026.testnet` on testnet. Use one private research job and one paid marketplace job, with at most one live model request per job. The owner authenticated to the local production app with an off-chain NEP-413 signature through the existing keychain. The worker confirmed the finalized mint, and Chrome showed Atlas under My Agents with 100,000 Fuel and paused execution. The customer still needs to approve the NEP-413 message in Meteor. Keep worker writes disabled pending lifecycle approval.

| Order | Signing account | Method on the deployed contract | Attached testnet NEAR |
|---|---|---|---:|
| 1 (finalized) | Owner wallet | `mint_agent({"name":"Atlas","config_hash":"2df70bff0010a8e7b8a626599c7b8d5bb205498fe9f6c669f24b20c7508e090c"})` | 0.16 |
| 2 | Owner wallet | `configure_agent` with `token_id:"1"`, `mode:"hybrid"`, `active:true`, `max_concurrent:3`, `max_fuel_per_job:8000`, `service_fee:"10000000000000000000000"`, `reinvest_bps:2000`, `config_hash:"36cc9c4e4f07d10c2c5463e3dec7c82adc29e5dc6ee88c3e5e69fffee63f94fb"` | 1 yoctoNEAR |
| 3 | Owner wallet | `submit_job` for private research, using the finalized configuration version, reviewed request hash and quote deadline | 0.02 |
| 4–6 | Executor, executor, verifier | `start_job`, `submit_result`, `verify_job` for the private job in order | 0 each |
| 7 | Customer wallet | `submit_job` for one paid marketplace hire, using the finalized configuration version, reviewed request hash and quote deadline | 0.038 |
| 8–10 | Executor, executor, verifier | `start_job`, `submit_result`, `verify_job` for the marketplace job in order | 0 each |
| 11 | Owner wallet | `nft_transfer` with `token_id:"1"`, `receiver_id:"proofbound.testnet"`, `approval_id:null`, and `memo:null` after both jobs settle and all reservations clear | 1 yoctoNEAR |

The finalized mint uses the default Atlas instructions from the web form, with `near-rpc`, `near-docs`, and `calculator`. The mint cost **0.0004591484751126 testnet NEAR** in fees. The worker staged the activation action against the actual token and its stored configuration. Activation uses **100 Tgas**, changes the configuration to Hybrid, and makes Atlas publicly discoverable. It does not submit a job. Review jobs individually after activation.

| Transaction | Exact argument fields to review once upstream state exists |
|---|---|
| Private escrow | `submit_job({job_id,token_id,request_hash,kind:"private",max_fuel:8000,deadline_ns,expected_config_version})` with focus `ecosystem` and topic “Explain NEAR NFT ownership and the controls that bound Atlas’s research.” |
| Marketplace escrow | Same fields with `kind:"marketplace"`, focus `economics` and topic “Explain the Atlas research fee, the maximum Fuel charge and the unused compute refund for this quote.” |
| Executor calls, once per queued job | `start_job({job_id})` then `submit_result({job_id,output_hash,evidence_hash})`, using hashes from the actual report and evidence. |
| Verifier call, once per job | `verify_job({job_id,accepted,actual_fuel,output_hash,evidence_hash,failure_code})`, using the verifier result and actual metering. On success `failure_code:null`. |
| Optional withdrawal after separately reviewed settlement | `withdraw({})`, owner signer, **1 yoctoNEAR** attached and **100 Tgas**. It withdraws the owner's entire claimable balance. Confirm its exact amount with `get_balance` before approval, then verify the transfer and callback receipts. |

Job IDs bind to the requesting account and a request key. Job escrow commitments bind to the final configuration and the live ten-minute quote deadline. Result hashes and Fuel come from execution. Generate and review these values at the relevant stage. The remaining four wallet calls and six service calls attach **0.058 testnet NEAR plus 2 yoctoNEAR** across both wallets. The previously proposed **0.08 testnet NEAR** combined fee ceiling can cover the remaining flow, excluding withdrawal. Refresh fees and check the remaining service allowances after each call.

The worker attaches **30 Tgas** for service calls and stages **100 Tgas** for wallet calls. Testnet's minimum gas purchase price of 1 billion yoctoNEAR per gas would charge more than 0.10 NEAR up front at 100 Tgas, exceeding the service allowance. The 30 Tgas limit fits the installed 0.05 NEAR allowance at the observed parameters. Transaction execution within this limit remains to be verified live. Check current gas purchase costs, allowances and wallet balances before approval. The customer quote contains 0.01 service, 0.008 maximum compute and 0.02 storage. Review each transaction's dynamic token ID, hashes, deadline and exact quote before signing. Use real result and evidence commitments and report the measured Fuel and actual verification outcome. If research or verification fails, the existing refund path uses the same verifier method with a failed outcome. Stop on an ambiguous onchain result and reconcile before signing anything further.

Expected successful receipt: 0.009 owner gross, 0.001 platform service share, 0.0018 funded refill (1,800 Fuel), 0.0072 claimable owner share under normal headroom, and a refund of unused compute. Actual compute and refund depend on measured Fuel. The verifier must use actual results. A successful contract settlement only supports a live inference claim when the provider receipt shows an actual NEAR AI call.

Capture finalized transaction hashes, balances, `nft_token`, `get_agent`, `get_job`, output/evidence hashes and provider usage. Settlement and Earn-to-Refill are recorded by the same successful `verify_job` call. Verify customer settings denial, retained history and Fuel after transfer, and old-owner denial using readbacks and the app's pre-sign checks. This run requires separate approval after setup. Withdrawal, buyer reactivation, extra jobs and public release are separate decisions.

## Read-only preview

Use a dedicated local testnet worker with `PROOFBOUND_ALLOW_CHAIN_WRITES=0`, `PROOFBOUND_MODE=testnet`, and `NEAR_CONTRACT_ID=contract.proofbound-dev-2026.testnet`. Keep `PROOFBOUND_PROVIDER=fixture` for a network-only preview. The frontend can display testnet reads while paid submission waits for the executor and verifier.

For a separately approved Vercel preview, use `apps/web` as the Next.js project root and allow shared workspace files from the repository root. Set server-only `PROOFBOUND_WORKER_URL` to the preview's reachable HTTPS worker endpoint. Run the persistent SQLite worker outside Vercel with its own database and set `PROOFBOUND_WEB_ORIGIN` to the exact preview origin. Keep writes disabled for the preview and keep signing and provider credentials on the worker. Smoke-test bootstrap, branded routes, icons and the status badge before publishing any preview URL. [Vercel monorepo setup](https://vercel.com/docs/monorepos)
