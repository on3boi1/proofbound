# Testnet deployment review

Deploy to the dedicated `contract.proofbound-dev-2026.testnet` subaccount. The parent `proofbound-dev-2026.testnet` creates, funds, and initializes it in one testnet transaction. This replaces the earlier proposal to deploy directly to the parent.

At finalized testnet block **277650642** (`CahQiWt3eKoHizQzqxfeS6gRDYNoqHWt8zAMrZ5rdqMz`, protocol 88), the parent held 10 testnet NEAR, used 182 bytes of storage, and had no contract code. The prospective contract, executor, and verifier account queries each returned `UNKNOWN_ACCOUNT`. The parent's single onchain key is `FullAccess`. A public-key-only NEAR CLI keychain lookup returned that same key, with no signature or private key output.

| Item | Proposed value |
|---|---|
| Signer | `proofbound-dev-2026.testnet`, using the existing NEAR CLI keychain |
| Receiver and contract account | `contract.proofbound-dev-2026.testnet` |
| Existing signer and proposed child admin key | `ed25519:FNjvjHjhvV252B3uQm844fjPHDRBFRz8tah8cLWGLi72` |
| Build artifact | `contracts/proofbound/target/wasm32-unknown-unknown/release/proofbound.wasm` |
| Size | 395,854 bytes |
| SHA-256 | `d3997e9541156038fad7d9418444badd295a48242b2df21b9d485ca15e82c3c2` |
| Expected NEAR code hash | `FEzmypQteUoXXFZ2UAme6nZ8HhtTxAsKjCCA9xGRFWuP` |
| Action 1 | `CreateAccount` at the receiver above |
| Action 2 | `Transfer` exactly **4.25 testnet NEAR** from the parent to the new account |
| Action 3 | `AddKey` with `FullAccess` on the new account, using the verified existing public key above |
| Action 4 | `DeployContract` with the reviewed WASM bytes |
| Action 5 | `FunctionCall` to `new` with `scripts/testnet-init.json`, **100 Tgas** and **0 NEAR attached** |
| Gas estimate | About **54.15 Tgas** in scheduled receipt and action fees, plus initialization execution. Including the entire 100 Tgas call allowance, approximately **0.01542 testnet NEAR** at the observed 0.0001 NEAR/Tgas. Use **0.02 testnet NEAR** as the fee budget and recheck current pricing before signing. |
| Storage and headroom | 3.95854 testnet NEAR for 395,854 code bytes at 0.00001 NEAR/byte. Budget approximately **4 testnet NEAR** held in the child's balance for code, account, key and initial state. Roughly **0.25 testnet NEAR** of the transfer is headroom. At the fee budget the parent retains about **5.73 testnet NEAR** before accounting for its existing storage reserve. |

The pricing estimate uses the non-self-receiver send fees and the execution fees for the five actions and their receipt, including the WASM and call argument bytes, plus the full prepaid call allowance. It does not predict actual gas burn or a future gas price. The 4.25 NEAR is a balance transfer, distinct from transaction fees. [NEAR RPC protocol configuration](https://docs.near.org/api/rpc/protocol)

Exact initialization arguments:

```json
{
  "owner_id": "proofbound-dev-2026.testnet",
  "executor_id": "exec.proofbound-dev-2026.testnet",
  "verifier_id": "verify.proofbound-dev-2026.testnet",
  "treasury_id": "proofbound-dev-2026.testnet",
  "config": null
}
```

The five actions execute as one batch. `CreateAccount` comes first and fails if the child exists, before code deployment can run. Failed receipt actions roll back account state, although gas may still be charged. The parent has no code, configuration, or access-key change in the batch. Its balance funds the child and fees, and its signing nonce advances. [NEAR account creation and permissions](https://github.com/near/nearcore/blob/master/runtime/runtime/src/actions.rs) · [NEAR receipt rollback](https://github.com/near/nearcore/blob/master/runtime/runtime/src/lib.rs)

Reuse of the existing testnet credential avoids a second full-access secret. Control of the child comes from the installed key, independently of the account name. That key can upgrade the child contract and spend its funds; compromise of the key affects both accounts. The worker must never receive this key. Executor and verifier account creation and restricted keys are separate from this approval. [NEAR access keys](https://docs.near.org/protocol/accounts-contracts/access-keys)

`npm run test:contract` passed **29/29** tests. `npm run build:contract` succeeded, and the output matches the previously reviewed SHA-256 exactly. A NEAR CLI `sign-later` construction was decoded independently with near-api-js and matched the action order, signer, receiver, amount, key permission, artifact, gas, deposit and all 222 initialization bytes (SHA-256 `455eb1cdfcc2b81caeeecca4d7ccbfa0980c7acd79b90bf1923a449b82770f2e` in the reviewed checkout). The unsigned sample is under ignored `.data/`. Its nonce and block hash are for review only.

## Reviewed command

The final `send` signs and broadcasts. Use it only after explicit approval of the five actions. Immediately before signing, recheck the pinned WASM and initialization arguments, sufficient parent balance, current FullAccess permission, reasonable gas pricing, and an `UNKNOWN_ACCOUNT` response for the child. Stop on any mismatch. Sign with a fresh nonce and block hash.

```powershell
near transaction construct-transaction proofbound-dev-2026.testnet receiver-id contract.proofbound-dev-2026.testnet add-action create-account add-action transfer '4.25 NEAR' add-action add-key grant-full-access use-manually-provided-public-key ed25519:FNjvjHjhvV252B3uQm844fjPHDRBFRz8tah8cLWGLi72 add-action deploy-contract use-file contracts/proofbound/target/wasm32-unknown-unknown/release/proofbound.wasm without-init-call add-action function-call new file-args scripts/testnet-init.json prepaid-gas '100 Tgas' attached-deposit '0 NEAR' skip network-config testnet sign-with-keychain --signer-public-key ed25519:FNjvjHjhvV252B3uQm844fjPHDRBFRz8tah8cLWGLi72 send --wait-until final
```

## After deployment

1. Confirm the batch reached final success. Verify the child's deployed code hash, its single expected `FullAccess` key, `get_config`, `nft_metadata`, and zero initial NFT supply. Save the actual receipt. After an ambiguous result, reconcile the transaction and account state before retrying.
2. Separately authorize and fund the role accounts. The executor key must allow only `start_job,submit_result`, and the verifier key only `verify_job`. Each key must name the deployed child as receiver and have a finite allowance. Store only those restricted keys in the ignored worker environment.
3. Start the worker using `PROOFBOUND_MODE=testnet`, `NEAR_CONTRACT_ID=contract.proofbound-dev-2026.testnet`, and the role settings listed in `.env.example`. Enable `PROOFBOUND_ALLOW_CHAIN_WRITES=1` once the role operations are authorized.
4. Connect a named testnet wallet supporting NEP-413. Record finalized mint and activation receipts. Use a separate customer for one authorized paid job. Check the executor and verifier receipts and reconcile Fuel, owner share, platform share, customer refund and reinvestment against the app.
5. After obligations clear, transfer the NFT with approval. Verify current ownership, retained work hashes, prior-owner denial and buyer reactivation. Use these actual receipts in the demo.
