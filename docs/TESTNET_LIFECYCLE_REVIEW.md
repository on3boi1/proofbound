# Proposed testnet mint-to-settlement run

The dedicated contract is deployed at `contract.proofbound-dev-2026.testnet`. Its initial NFT supply is zero, and the configured executor and verifier accounts do not exist. The deployment authorization covered only the finalized creation, funding, code installation and initialization batch. [Deployment evidence](evidence/testnet-deployment.json)

## Stage 1: Approve account and key setup

Each proposed batch is signed by `proofbound-dev-2026.testnet` using its verified existing keychain key. Every batch begins with `CreateAccount` and stops if its receiver exists. Recheck all three accounts and estimate fees again immediately before signing. Fund **0.60 testnet NEAR in total**, divided as follows.

| Receiver | Ordered actions | Transfer |
|---|---|---:|
| `exec.proofbound-dev-2026.testnet` | Create account, transfer, add the parent's reviewed FullAccess public key for admin recovery, add a new executor FunctionCall key | 0.20 testnet NEAR |
| `verify.proofbound-dev-2026.testnet` | Create account, transfer, add the parent's reviewed FullAccess public key for admin recovery, add a separate verifier FunctionCall key | 0.20 testnet NEAR |
| `customer.proofbound-dev-2026.testnet` | Create account, transfer, add an operator-controlled FullAccess public key for the customer wallet | 0.20 testnet NEAR |

Both service keys have receiver `contract.proofbound-dev-2026.testnet` and a finite allowance of **0.05 testnet NEAR each**. The executor methods are exactly `start_job,submit_result`. The verifier method is exactly `verify_job`. Allowance limits gas from the funded service balances. It does not add another transfer or permit a deposit or arbitrary payment. Only the restricted private keys belong in the local worker. The admin key remains in the existing keychain. The independently generated service public keys and the customer wallet public key must be recorded in the final action review before signing. No keys were generated or added in the deployment verification turn.

At finalized block 277652142 the proposed customer account returned `UNKNOWN_ACCOUNT`. Scheduled receipt and action fees for the three setup batches are roughly 0.00255 testnet NEAR at the observed gas price. Allocate up to **0.02 testnet NEAR total** for all three setup fees. If a fresh estimate exceeds the budget or any destination exists, stop and reconcile. The customer is a separate test account controlled by the operator. It demonstrates account separation. [NEAR RPC gas pricing](https://docs.near.org/api/rpc/gas)

## Stage 2: Approve the test run

Use the branded local interface in testnet mode, connected to the deployed contract. Verify wallet identity with NEP-413 before the first mutation. Allow one marketplace job and at most one live model request. Do not enable worker writes until the two keys have been verified onchain and the following actions are approved.

| Order | Signing account | Method on the deployed contract | Attached testnet NEAR |
|---|---|---|---:|
| 1 | Parent wallet | `mint_agent` with name Atlas and the reviewable configuration commitment | 0.16 |
| 2 | Parent wallet | `configure_agent` for the minted token, activate it in Hybrid mode, cap it at 8,000 Fuel/job and three concurrent jobs, set service fee to 0.01 testnet NEAR, set Earn-to-Refill to 2,000 basis points | 1 yoctoNEAR |
| 3 | Customer wallet | `submit_job` for one bounded NEAR research brief, using the finalized configuration version, reviewed request hash and quote deadline | 0.038 |
| 4 | Restricted executor | `start_job` for the funded job | 0 |
| 5 | Restricted executor | `submit_result` for the same job, with the observed output and evidence hashes | 0 |
| 6 | Restricted verifier | `verify_job` for the same job, with acceptance outcome, measured Fuel and matching evidence | 0 |

Use a 100 Tgas allowance per call, as implemented in the worker, and provisionally budget **0.07 testnet NEAR total** for gas across the six calls. Recompute from live gas prices before signing. The customer quote contains 0.01 service, 0.008 maximum compute and 0.02 storage. Generate and inspect each transaction's dynamic token ID, hashes, deadline and exact quote before signing. Turn off signing after the approved job reaches a terminal state. If research or verification fails, the existing refund path uses the same verifier method with a failed outcome. Stop on an ambiguous onchain result and reconcile before signing anything further.

Expected successful receipt: 0.009 owner gross, 0.001 platform service share, 0.0018 funded refill (1,800 Fuel), 0.0072 claimable owner share under normal headroom, and a refund of unused compute. Actual compute and refund depend on measured Fuel. The verifier must use actual results. A successful contract settlement only supports a live inference claim when the provider receipt shows an actual NEAR AI call.

Capture finalized transaction hashes, balances, `nft_token`, `get_agent`, `get_job`, output/evidence hashes and the provider usage. Verify one customer cannot edit the owner's settings. NFT transfer, withdrawal, extra jobs, further account actions and public release are separate decisions. For a later transfer proof, use a reviewed receiving account, verify old-owner denial, and approve buyer reactivation separately.

## Read-only preview

Use a dedicated local testnet worker with `PROOFBOUND_ALLOW_CHAIN_WRITES=0`, `PROOFBOUND_MODE=testnet`, and `NEAR_CONTRACT_ID=contract.proofbound-dev-2026.testnet`. Keep `PROOFBOUND_PROVIDER=fixture` for a network-only preview. The frontend can display testnet reads while paid submission waits for the executor and verifier.
