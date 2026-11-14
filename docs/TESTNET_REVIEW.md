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
