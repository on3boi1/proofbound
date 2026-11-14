# Demo evidence

| Evidence | Observed result |
|---|---|
| Local browser | Signed in as `owner.local`, minted Atlas #1 with 100,000 Fuel, activated it, submitted private job `e8ff3443-f4c7-499a-8413-543685e60ec6`, saw completed report and seven passing checks. |
| [Local HTTP lifecycle](evidence/local-lifecycle.json) | Three authenticated customer jobs ran concurrently. Transfer failed while they were active. All three settlements reconciled, refilled 1,800 Fuel each, and left old-owner earnings intact after transfer. |
| Responsive browser | Landing and completed report inspected on desktop, 390px phone and 820px tablet. Adjusted the execution steps and mobile sidebar behavior. Verified that both primary landing actions fit on a 623px-tall desktop viewport. |
| Provider | [Live research receipt](evidence/live-research.json) captures one completed bounded NEAR AI research job with 1,631 tokens, source and output hashes, and passing verification. |
| Contract | 29 tests passed. The release artifact and hash are in [TESTNET_REVIEW.md](TESTNET_REVIEW.md). |
| [Finalized testnet deployment](evidence/testnet-deployment.json) | The dedicated contract was created, funded with 4.25 testnet NEAR, deployed and initialized. Recorded fee is 0.011949535241688 testnet NEAR. Initial NFT supply is zero. No testnet lifecycle transactions have run. |
| [Finalized testnet service setup](evidence/testnet-service-setup.json) | Both role accounts received 0.20 testnet NEAR and have the verified recovery and bounded service keys. Combined fees were 0.014271039756661 testnet NEAR. These receipts cover account setup. |
| [Testnet permission probes](evidence/testnet-restricted-key-probes.json) | The executor key's forbidden `get_config` was rejected at admission. Its allowed `start_job` reached the contract and failed with a WASM trap on the nonexistent probe ID. No job was created. |
| Meteor handoff | Chrome displayed Meteor in the testnet selector and reached the wallet approval screen. The customer must finish the message signature before claiming a connected session. |
| Public demo post | Pending human recording and publication. |
