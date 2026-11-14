# Demo evidence

| Evidence | Observed result |
|---|---|
| Local browser | Signed in as `owner.local`, minted Atlas #1 with 100,000 Fuel, activated it, submitted private job `e8ff3443-f4c7-499a-8413-543685e60ec6`, saw completed report and seven passing checks. |
| [Local HTTP lifecycle](evidence/local-lifecycle.json) | Three authenticated customer jobs ran concurrently. Transfer failed while they were active. All three settlements reconciled, refilled 1,800 Fuel each, and left old-owner earnings intact after transfer. |
| Responsive browser | Completed report inspected on desktop, 390px phone and 820px tablet. Adjusted the execution steps and checked mobile sidebar behavior and width again. |
| Provider | [Live research receipt](evidence/live-research.json) captures one completed bounded NEAR AI research job with 1,631 tokens, source and output hashes, and passing verification. |
| Contract | 29 tests passed. The release artifact and hash are in [TESTNET_REVIEW.md](TESTNET_REVIEW.md). |
| Testnet transactions | Pending approval and deployment. |
| Public demo post | Pending human recording and publication. |
