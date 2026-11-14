# PROOFBOUND contract API

Contract source: `contracts/proofbound`. SDK and standards pinned to 5.30.2. This document describes implemented code; deployment and live receipts require separate approval. All NEAR amounts are decimal **yoctoNEAR strings** (`U128`); nanosecond timestamps and pagination cursors are decimal strings (`U64`). Fuel, version, epoch, basis points, and capacity are JSON integers, bounded to safe ranges.

## Roles and initialization

`new({owner_id, executor_id, verifier_id, treasury_id, config: null})` initializes once. Executor and verifier must be **different accounts**. The executor advances work and commits results; only the verifier settles. Agent ownership is independent of these service roles. An agent model is never given either service signing key. There is no admin sweep, payout redirection, or unbounded model transaction method.

Defaults returned by `get_config({})`:

| Field | Value |
|---|---|
| `pricing.fuel_unit_price` | `1000000000000000000` (0.000001 testnet NEAR/Fuel) |
| `pricing.initial_fuel` | 100000 |
| `pricing.mint_storage_fee` | `50000000000000000000000` (0.05) |
| `pricing.mint_platform_fee` | `10000000000000000000000` (0.01) |
| `pricing.job_storage_fee` | `20000000000000000000000` (0.02) |
| `pricing.default_service_fee` | `10000000000000000000000` (0.01) |
| `mint_total` | `160000000000000000000000` (0.16) |
| `platform_fee_bps` | 1000 |

Configuration can be supplied at initialization. The deployed pricing does not change, so old Fuel remains backed at its original conversion. Fuel is an internal unit, never a token. Real inference comes from an externally funded provider; testnet NEAR allocations are prototype accounting.

## Owner methods

- `mint_agent({name, config_hash})`: attach exactly `get_config.mint_total`; returns `Agent`. `name` is 1–64 UTF-8 bytes; all hashes are lowercase 64-character SHA-256 hex. Generated token IDs are ascending decimal strings, with no collection cap. The new agent is inactive, private, configuration 1, ownership epoch 1, zero work history, 100000 available Fuel. The user explicitly activates with `configure_agent`.
- `configure_agent({token_id, mode, active, max_concurrent, max_fuel_per_job, service_fee, reinvest_bps, config_hash})`: attach **1 yoctoNEAR**. Modes: `private`, `marketplace`, `hybrid`; concurrency 1–3; per-job Fuel 1–100000 (default 8000); fee positive and at most 100 NEAR; reinvest 0–10000 basis points. Each accepted change increments config version and resets current-configuration counters. Already accepted jobs retain their snapshots. The hash commits the offchain private instructions and approved tools; neither is published onchain.
- `fuel_top_up({token_id})`: owner attaches a positive exact multiple of `fuel_unit_price`. Funded Fuel increases; available + reserved Fuel is bounded at 1e12 units for arithmetic safety, not NFT supply. Returns `Agent`.
- `nft_transfer({receiver_id, token_id, approval_id:null, memo:null})`: attach **1 yoctoNEAR**. Only the current owner can transfer. All unresolved jobs and Fuel reservations must be cleared. Transfer preserves lifetime work and Fuel, increments ownership epoch/configuration, clears configuration commitment/reinvestment, and leaves the buyer inactive in private mode. Former earnings remain with the old owner's balance.
- `nft_transfer_call({receiver_id, token_id, approval_id:null, memo:null, msg})`: same guard; standard receiver/resolver flow. Management/work/transfers stay frozen until resolution. A returned NFT also requires reactivation. Receiver hooks cannot bypass active-job guards.
- NFT approval/delegated-operator extension is deliberately absent. Standard core, metadata, enumeration and events are implemented.

## Jobs and quotes

`quote_job({token_id, kind, max_fuel})` returns `{service_fee,max_compute,storage_fee,total_deposit,max_fuel,config_version,refund_terms}`. `kind` is `private` or `marketplace`. Private work reserves agent Fuel and charges only persistent evidence storage. Paid work charges service + maximum execution allowance + evidence storage. Show all three before signing. Storage is retained; service and unused/failed compute funds become pull-refund balances.

`submit_job({job_id,token_id,request_hash,kind,max_fuel,deadline_ns,expected_config_version})`: attach exactly quoted total. ID must be unique, 1–64 ASCII alphanumeric, `_` or `-`. Deadline is 1 minute to 7 days ahead. The caller is the customer; private work requires the current owner; public self-hiring is rejected. Configuration must match the quote and mode must allow the job. Capacity counts all unresolved jobs. A paused agent rejects new work but accepted work continues.

The runtime commits a canonical preimage containing request, config hash/version, budget, kind, and deadline into `request_hash`, validates the finalized chain record before execution, and keeps private inputs/results offchain. The contract verifies commitment equality, not plaintext semantics.

Execution methods attach **zero** NEAR:

1. Executor: `start_job({job_id})`: queued → running; retry is idempotent for running.
2. Executor: `submit_result({job_id,output_hash,evidence_hash})`: running → submitted; identical retry is idempotent.
3. Verifier: `verify_job({job_id,accepted,actual_fuel,output_hash,evidence_hash,failure_code:null})`: accepted work must match submitted commitments and finish before deadline. Failure is permitted before submission. Usage cannot exceed the quote. An identical terminal receipt is returned on retry; differing claims fail.

`cancel_job({job_id})`: customer only, queued only, **1 yoctoNEAR**. `expire_job({job_id})`: anyone, zero deposit, after deadline; terminal retry returns receipt. Paid failure/cancel/expiry ends as `refunded` with explicit `settlement.outcome`. Private failures end `failed`, `cancelled` or `expired`. Verification's intermediate work runs offchain; there is no fictitious onchain progress percentage.

`Settlement` fields: `accepted`, `outcome`, `actual_fuel`, `charged_fuel`, `owner_share`, `platform_share`, `compute_charge`, `customer_refund`, `reinvested`, `owner_claimable`, `reputation_awarded`, `output_hash`, `evidence_hash`, `settled_at_ns`.

Success splits service fee 90/10 (platform rounds down, owner gets remainder). Compute is separately charged at actual units; unused paid allowance is credited to the customer. Earn-to-Refill uses the **accepted job's** reinvest setting, converts only whole funded units, and credits rounding remainder to the owner. On failure charged Fuel is zero: private reservations are released, public service and compute are fully refundable. Already incurred failed inference expenses are paid by the operator's bounded offchain provider budget; they never become undisclosed customer debt.

## Views and withdrawals

- `get_agent({token_id})` / `get_job({job_id})`: object or null. See Rust `Agent` and `Job` for exact returned fields. Agent lifetime, current-configuration and current-epoch counters are separate. Paid duplicate output hashes cannot receive a second reputation event; completed paid volume is still visible. Account separation is not full Sybil resistance.
- `list_agents({from_index:"0",limit:50})` and `list_jobs(...)`: insertion order, maximum page 100.
- `get_balance({account_id})`: `{account_id,claimable,pending}`. This includes earned funds and refunds; per-job receipts identify their provenance.
- `withdraw({})`: attach **1 yoctoNEAR**; sends only the caller's claimable balance to that caller. Balance is deducted before transfer. One pending withdrawal per account. Private nonce-checked callback restores credit on transfer failure and ignores duplicate callbacks.
- `nft_token({token_id})`, `nft_total_supply({})`, `nft_tokens({from_index:"0",limit:50})`, `nft_supply_for_owner({account_id})`, `nft_tokens_for_owner({account_id,from_index:"0",limit:50})`, `nft_metadata({})` follow NEP-171/177/181.

NEP-297 `proofbound` events include mint, config, top-up, job lifecycle, settlement, ownership changes and withdrawals. Standard NFT mint/transfer events are emitted by the standards implementation. Configuration and ownership chronology is in immutable event receipts; only current state and job-specific snapshots occupy contract storage. Persistent evidence storage is funded by disclosed fees. The centralized verifier is trusted for offchain correctness; the contract independently enforces authorization, caps, balances, destinations and transfer restrictions.

References: [NEAR NFT standard](https://docs.near.org/primitives/nft/standard), [NEAR SDK](https://docs.rs/near-sdk/5.30.2/near_sdk/), [NEAR contract standards](https://docs.rs/near-contract-standards/5.30.2/near_contract_standards/), [private callbacks](https://docs.near.org/smart-contracts/security/cross-contract-calls/callbacks), [balance deduction](https://docs.near.org/smart-contracts/security/cross-contract-calls/reentrancy).
