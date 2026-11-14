# Testnet deployment review

Target is the existing development account `proofbound-dev-2026.testnet`. A read-only query at final block 277646206 confirmed 10 testnet NEAR and no contract code. Deployment and initialization form one transaction on the `testnet` network. The signer is that same account's existing NEAR CLI keychain credential.

| Item | Proposed value |
|---|---|
| Build artifact | `contracts/proofbound/target/wasm32-unknown-unknown/release/proofbound.wasm` |
| Size | 395,854 bytes |
| SHA-256 | `d3997e9541156038fad7d9418444badd295a48242b2df21b9d485ca15e82c3c2` |
| Initialization | `new` with `scripts/testnet-init.json` |
| Attached deposit | 0 NEAR |
| Initialization gas cap | 100 Tgas, plus deploy transaction costs |
| Storage | About 4 testnet NEAR remains reserved for deployed code, subject to network storage accounting |
| Roles | Executor `exec.proofbound-dev-2026.testnet`, verifier `verify.proofbound-dev-2026.testnet`, treasury and contract operator `proofbound-dev-2026.testnet` |

The transaction makes code and initialized state observable on NEAR testnet. The operator retains the account's full-access key and upgrade authority. The two service role accounts and restricted keys require a separate setup step before paid jobs execute. Deployment approval covers only the transaction described above. Customer jobs, role setup, transfers, hosting and GitHub require their own authorized scope.

Before signing, recheck the artifact hash and confirm the target still has no contract code. After deployment, verify the finalized transaction and call `get_config`, `nft_metadata` and `nft_total_supply`. Save the actual receipt before reporting success.

## Reviewed command

The final `send` signs and broadcasts. Use it only after the deployment described above is explicitly approved.

```powershell
near contract deploy proofbound-dev-2026.testnet use-file contracts/proofbound/target/wasm32-unknown-unknown/release/proofbound.wasm with-init-call new file-args scripts/testnet-init.json prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
```

## After deployment

1. Configure the two testnet role accounts. The executor key must allow only `start_job,submit_result`, and the verifier key only `verify_job`. Each key must name the deployed contract as receiver and have a finite allowance. Store only those restricted keys in the ignored local environment. Full-access role keys stay with the account operator. Estimate role funding and approve it separately.
2. Start the worker using `PROOFBOUND_MODE=testnet`, `NEAR_CONTRACT_ID=proofbound-dev-2026.testnet`, and the role settings listed in `.env.example`. Enable `PROOFBOUND_ALLOW_CHAIN_WRITES=1` only once the exact role operations are authorized. Choose fixture inference for the first funded run if isolating transaction behavior.
3. Use a named testnet wallet that supports NEP-413 message signing and transaction signing. Connect as the owner, mint, configure and activate. Record finalized mint and activation receipts.
4. Use a separate funded testnet customer to quote and submit a paid job. Verify that the executor and verifier receipts succeeded and that the contract reports the same settlement amounts as the app. Capture Fuel, owner share, platform share, customer refund and reinvestment.
5. Transfer after active work clears. Read the new owner and retained work hash from the contract. Check previous-owner denial and reactivate under the receiving wallet. Record actual transaction links before including any testnet claim in the demo.
