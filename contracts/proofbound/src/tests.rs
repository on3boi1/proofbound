use super::*;
use near_sdk::{
    test_utils::{get_created_receipts, get_logs, VMContextBuilder},
    testing_env, VMContext,
};
use std::panic::{catch_unwind, AssertUnwindSafe};

const NOW: u64 = 1_000_000 * SECOND;
const DEADLINE: u64 = NOW + 3600 * SECOND;
fn account(value: &str) -> AccountId {
    value.parse().unwrap()
}
fn hash(byte: char) -> String {
    byte.to_string().repeat(64)
}
fn context(who: &str, deposit: u128, timestamp: u64) -> VMContext {
    let mut c = VMContextBuilder::new();
    c.current_account_id(account("proofbound.testnet"))
        .signer_account_id(account(who))
        .predecessor_account_id(account(who))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(10_000))
        .block_timestamp(timestamp)
        .prepaid_gas(Gas::from_tgas(300));
    c.build()
}
fn call(who: &str, deposit: u128) {
    testing_env!(context(who, deposit, NOW));
}
fn callback(result: PromiseResult) {
    testing_env!(
        context("proofbound.testnet", 0, NOW),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        HashMap::default(),
        vec![result]
    );
}
fn setup() -> Proofbound {
    call("admin.testnet", 0);
    Proofbound::new(
        account("admin.testnet"),
        account("executor.testnet"),
        account("verifier.testnet"),
        account("treasury.testnet"),
        None,
    )
}
fn mint(c: &mut Proofbound) -> Agent {
    call("alice.testnet", c.mint_total());
    c.mint_agent("Atlas".into(), hash('a'))
}
fn activate(c: &mut Proofbound, token: &str, reinvest: u16) -> Agent {
    call("alice.testnet", 1);
    c.configure_agent(
        token.into(),
        OperatingMode::Hybrid,
        true,
        3,
        8000,
        U128(NEAR / 100),
        reinvest,
        hash('b'),
    )
}
fn active() -> (Proofbound, TokenId) {
    let mut c = setup();
    let id = mint(&mut c).token_id;
    activate(&mut c, &id, 0);
    (c, id)
}
fn job(c: &mut Proofbound, id: &str, token: &str, who: &str, kind: JobKind, fuel: u64) -> Job {
    let q = c.quote_job(token.into(), kind.clone(), fuel);
    call(who, q.total_deposit.0);
    c.submit_job(
        id.into(),
        token.into(),
        hash('c'),
        kind,
        fuel,
        U64(DEADLINE),
        q.config_version,
    )
}
fn submit_output(c: &mut Proofbound, id: &str, output: char) {
    call("executor.testnet", 0);
    c.start_job(id.into());
    call("executor.testnet", 0);
    c.submit_result(id.into(), hash(output), hash('e'));
}
fn verify(c: &mut Proofbound, id: &str, fuel: u64, output: char) -> Settlement {
    call("verifier.testnet", 0);
    c.verify_job(id.into(), true, fuel, hash(output), hash('e'), None)
}
fn rejects(f: impl FnOnce()) {
    assert!(catch_unwind(AssertUnwindSafe(f)).is_err());
}

#[test]
fn authorized_executor_starting_a_missing_job_panics_before_changing_state() {
    let (mut contract, token) = active();
    let job_id = "proofbound-permission-probe-20261114".to_string();
    let before = contract.get_agent(token.clone()).unwrap();
    call("executor.testnet", 0);
    let panic = catch_unwind(AssertUnwindSafe(|| contract.start_job(job_id.clone())))
        .expect_err("the probe job must be absent");
    let message = panic
        .downcast_ref::<String>()
        .map(String::as_str)
        .or_else(|| panic.downcast_ref::<&str>().copied());
    assert_eq!(message, Some("Unknown job"));
    assert!(contract.get_job(job_id).is_none());
    let after = contract.get_agent(token).unwrap();
    assert_eq!(before.active_jobs, after.active_jobs);
    assert_eq!(before.reserved_fuel, after.reserved_fuel);
    assert_eq!(before.available_fuel, after.available_fuel);
}

#[test]
fn repeated_mints_have_unique_nft_identities_and_no_collection_cap() {
    let mut c = setup();
    for n in 1..=128 {
        let a = mint(&mut c);
        assert_eq!(a.token_id, n.to_string());
        assert_eq!(
            c.nft_token(a.token_id).unwrap().owner_id,
            account("alice.testnet")
        );
    }
    assert_eq!(c.nft_total_supply().0, 128);
    assert_eq!(c.nft_supply_for_owner(account("alice.testnet")).0, 128);
    assert_eq!(c.nft_tokens(None, Some(500)).len(), 100);
    assert_eq!(
        c.nft_tokens_for_owner(account("alice.testnet"), Some(U128(100)), Some(50))
            .len(),
        28
    );
}

#[test]
fn mint_allocates_backed_fuel_and_zero_reputation() {
    let mut c = setup();
    let a = mint(&mut c);
    assert_eq!(a.available_fuel, 100_000);
    assert_eq!(a.reserved_fuel, 0);
    assert_eq!(a.lifetime, Performance::default());
    assert_eq!(a.config_version, 1);
    assert_eq!(a.ownership_epoch, 1);
    assert!(!a.active);
    assert_eq!(
        c.get_balance(account("treasury.testnet")).claimable.0,
        NEAR / 100
    );
    assert_eq!(c.mint_total(), 16 * NEAR / 100);
    assert!(get_logs()
        .iter()
        .any(|l| l.contains("\"event\":\"nft_mint\"")));
}

#[test]
fn mint_requires_exact_funding_and_valid_commitment() {
    let mut c = setup();
    call("alice.testnet", 1);
    rejects(|| {
        c.mint_agent("Atlas".into(), hash('a'));
    });
    call("alice.testnet", c.mint_total());
    rejects(|| {
        c.mint_agent("Atlas".into(), "prompt text is not a hash".into());
    });
    rejects(|| {
        c.mint_agent(" ".into(), hash('a'));
    });
    assert_eq!(c.nft_total_supply().0, 0);
}

#[test]
fn top_up_is_funded_integer_owner_only_and_rejects_fractional_units() {
    let (mut c, t) = active();
    let price = c.pricing.fuel_unit_price.0;
    call("alice.testnet", price * 1234);
    let a = c.fuel_top_up(t.clone());
    assert_eq!(a.available_fuel, 101_234);
    call("mallory.testnet", price);
    rejects(|| {
        c.fuel_top_up(t.clone());
    });
    call("alice.testnet", price + 1);
    rejects(|| {
        c.fuel_top_up(t.clone());
    });
    call("alice.testnet", 0);
    rejects(|| {
        c.fuel_top_up(t.clone());
    });
}

#[test]
fn three_jobs_reserve_fuel_once_and_fourth_is_rejected() {
    let (mut c, t) = active();
    for id in ["personal1", "personal2", "personal3"] {
        job(&mut c, id, &t, "alice.testnet", JobKind::Private, 8000);
    }
    let a = c.agent(&t);
    assert_eq!(a.available_fuel, 76_000);
    assert_eq!(a.reserved_fuel, 24_000);
    assert_eq!(a.active_jobs, 3);
    rejects(|| {
        job(
            &mut c,
            "fourth",
            &t,
            "alice.testnet",
            JobKind::Private,
            8000,
        );
    });
    rejects(|| {
        job(
            &mut c,
            "personal1",
            &t,
            "alice.testnet",
            JobKind::Private,
            8000,
        );
    });
}

#[test]
fn fuel_overdraft_and_cap_bypass_are_rejected() {
    let (mut c, t) = active();
    call("alice.testnet", 1);
    c.configure_agent(
        t.clone(),
        OperatingMode::Hybrid,
        true,
        3,
        100_000,
        U128(NEAR / 100),
        0,
        hash('b'),
    );
    job(
        &mut c,
        "budget",
        &t,
        "alice.testnet",
        JobKind::Private,
        99_999,
    );
    rejects(|| {
        job(
            &mut c,
            "overdraft",
            &t,
            "alice.testnet",
            JobKind::Private,
            2,
        );
    });
    rejects(|| {
        c.quote_job(t.clone(), JobKind::Private, 100_001);
    });
    assert_eq!(c.agent(&t).available_fuel, 1);
}

#[test]
fn private_success_charges_actual_usage_and_releases_unused_reservation() {
    let (mut c, t) = active();
    job(
        &mut c,
        "personal",
        &t,
        "alice.testnet",
        JobKind::Private,
        8000,
    );
    submit_output(&mut c, "personal", 'd');
    let r = verify(&mut c, "personal", 3210, 'd');
    let a = c.agent(&t);
    assert_eq!(a.available_fuel, 96_790);
    assert_eq!(a.reserved_fuel, 0);
    assert_eq!(a.active_jobs, 0);
    assert_eq!(r.compute_charge.0, c.fuel_cost(3210));
    assert_eq!(r.owner_share.0, 0);
    assert!(!r.reputation_awarded);
    assert_eq!(a.lifetime.completed_personal, 1);
}

#[test]
fn paid_success_reconciles_service_split_compute_refund_and_claimable_earnings() {
    let (mut c, t) = active();
    let j = job(
        &mut c,
        "paid",
        &t,
        "bob.testnet",
        JobKind::Marketplace,
        8000,
    );
    assert_eq!(c.agent(&t).available_fuel, 100_000);
    assert_eq!(c.agent(&t).reserved_fuel, 0);
    submit_output(&mut c, "paid", 'd');
    let r = verify(&mut c, "paid", 3000, 'd');
    assert_eq!(r.owner_share.0, 9 * NEAR / 1000);
    assert_eq!(r.platform_share.0, NEAR / 1000);
    assert_eq!(r.compute_charge.0, 3 * NEAR / 1000);
    assert_eq!(r.customer_refund.0, 5 * NEAR / 1000);
    assert_eq!(
        r.owner_share.0 + r.platform_share.0 + r.compute_charge.0 + r.customer_refund.0,
        j.service_fee.0 + j.compute_allowance.0
    );
    assert_eq!(
        c.get_balance(account("bob.testnet")).claimable.0,
        r.customer_refund.0
    );
    assert_eq!(
        c.get_balance(account("alice.testnet")).claimable.0,
        r.owner_share.0
    );
    assert_eq!(
        c.get_balance(account("treasury.testnet")).claimable.0,
        NEAR / 100 + r.platform_share.0 + r.compute_charge.0
    );
    assert!(r.reputation_awarded);
}

#[test]
fn earned_refill_is_backed_by_the_owner_share_and_uses_acceptance_policy() {
    let (mut c, t) = active();
    activate(&mut c, &t, 2000);
    job(
        &mut c,
        "reinvest",
        &t,
        "bob.testnet",
        JobKind::Marketplace,
        8000,
    );
    activate(&mut c, &t, 8000); // Does not rewrite existing job's agreed economics.
    submit_output(&mut c, "reinvest", 'd');
    let r = verify(&mut c, "reinvest", 1000, 'd');
    assert_eq!(r.reinvested.0, 18 * NEAR / 10000);
    assert_eq!(r.owner_claimable.0, 72 * NEAR / 10000);
    assert_eq!(r.owner_claimable.0 + r.reinvested.0, r.owner_share.0);
    assert_eq!(c.agent(&t).available_fuel, 101_800);
    assert_eq!(c.agent(&t).lifetime.completed_paid, 1);
    assert_eq!(c.agent(&t).configuration_performance.completed_paid, 0);
}

#[test]
fn settlement_and_result_retries_cannot_pay_twice() {
    let (mut c, t) = active();
    job(
        &mut c,
        "retry",
        &t,
        "bob.testnet",
        JobKind::Marketplace,
        8000,
    );
    submit_output(&mut c, "retry", 'd');
    call("executor.testnet", 0);
    c.submit_result("retry".into(), hash('d'), hash('e'));
    let first = verify(&mut c, "retry", 1000, 'd');
    let before = c.get_balance(account("alice.testnet")).claimable.0;
    let replay = verify(&mut c, "retry", 1000, 'd');
    assert_eq!(first, replay);
    assert_eq!(c.get_balance(account("alice.testnet")).claimable.0, before);
    assert_eq!(c.agent(&t).lifetime.completed_paid, 1);
    assert_eq!(c.agent(&t).active_jobs, 0);
    rejects(|| {
        verify(&mut c, "retry", 2000, 'd');
    });
}

#[test]
fn executor_cannot_award_itself_verification_or_redirect_money() {
    let (mut c, t) = active();
    job(
        &mut c,
        "permission",
        &t,
        "bob.testnet",
        JobKind::Marketplace,
        8000,
    );
    submit_output(&mut c, "permission", 'd');
    call("executor.testnet", 0);
    rejects(|| {
        c.verify_job("permission".into(), true, 1000, hash('d'), hash('e'), None);
    });
    assert_eq!(c.get_balance(account("executor.testnet")).claimable.0, 0);
    assert!(c.job("permission").settlement.is_none());
}

#[test]
fn invalid_commitment_and_usage_overrun_cannot_settle() {
    let (mut c, t) = active();
    job(
        &mut c,
        "integrity",
        &t,
        "bob.testnet",
        JobKind::Marketplace,
        8000,
    );
    submit_output(&mut c, "integrity", 'd');
    rejects(|| {
        verify(&mut c, "integrity", 1000, 'f');
    });
    rejects(|| {
        verify(&mut c, "integrity", 8001, 'd');
    });
    assert!(c.job("integrity").settlement.is_none());
}

#[test]
fn public_failure_refunds_service_and_compute_while_storage_is_retained() {
    let (mut c, t) = active();
    let j = job(
        &mut c,
        "failed",
        &t,
        "bob.testnet",
        JobKind::Marketplace,
        8000,
    );
    call("verifier.testnet", 0);
    let r = c.verify_job(
        "failed".into(),
        false,
        1500,
        hash('d'),
        hash('e'),
        Some("source_unavailable".into()),
    );
    assert_eq!(r.actual_fuel, 1500);
    assert_eq!(r.charged_fuel, 0);
    assert_eq!(r.compute_charge.0, 0);
    assert_eq!(r.customer_refund.0, j.service_fee.0 + j.compute_allowance.0);
    assert_eq!(c.job("failed").status, JobStatus::Refunded);
    assert!(!r.reputation_awarded);
    assert_eq!(c.agent(&t).lifetime.failed_paid, 1);
    assert_eq!(c.agent(&t).lifetime.completed_paid, 0);
}

#[test]
fn private_failure_restores_all_fuel_without_charging_operator_costs_to_owner() {
    let (mut c, t) = active();
    job(
        &mut c,
        "failedprivate",
        &t,
        "alice.testnet",
        JobKind::Private,
        8000,
    );
    call("verifier.testnet", 0);
    c.verify_job(
        "failedprivate".into(),
        false,
        1500,
        hash('d'),
        hash('e'),
        None,
    );
    assert_eq!(c.agent(&t).available_fuel, 100_000);
    assert_eq!(c.agent(&t).reserved_fuel, 0);
    assert_eq!(c.job("failedprivate").status, JobStatus::Failed);
}

#[test]
fn queued_customer_can_cancel_but_other_accounts_cannot() {
    let (mut c, t) = active();
    let j = job(
        &mut c,
        "cancel",
        &t,
        "bob.testnet",
        JobKind::Marketplace,
        8000,
    );
    call("mallory.testnet", 1);
    rejects(|| {
        c.cancel_job("cancel".into());
    });
    call("bob.testnet", 1);
    let r = c.cancel_job("cancel".into());
    assert_eq!(r.outcome, "cancelled");
    assert_eq!(r.customer_refund.0, j.service_fee.0 + j.compute_allowance.0);
    assert_eq!(c.agent(&t).active_jobs, 0);
}

#[test]
fn started_job_cannot_be_cancelled_and_expiry_is_permissionless() {
    let (mut c, t) = active();
    job(
        &mut c,
        "expire",
        &t,
        "bob.testnet",
        JobKind::Marketplace,
        8000,
    );
    call("executor.testnet", 0);
    c.start_job("expire".into());
    call("bob.testnet", 1);
    rejects(|| {
        c.cancel_job("expire".into());
    });
    call("anyone.testnet", 0);
    rejects(|| {
        c.expire_job("expire".into());
    });
    testing_env!(context("anyone.testnet", 0, DEADLINE + 1));
    let r = c.expire_job("expire".into());
    assert_eq!(r.outcome, "expired");
    let replay = c.expire_job("expire".into());
    assert_eq!(r, replay);
}

#[test]
fn stale_quote_wrong_mode_paused_agent_and_self_hiring_fail() {
    let (mut c, t) = active();
    let q = c.quote_job(t.clone(), JobKind::Marketplace, 8000);
    activate(&mut c, &t, 0);
    call("bob.testnet", q.total_deposit.0);
    rejects(|| {
        c.submit_job(
            "stale".into(),
            t.clone(),
            hash('c'),
            JobKind::Marketplace,
            8000,
            U64(DEADLINE),
            q.config_version,
        );
    });
    rejects(|| {
        job(
            &mut c,
            "self",
            &t,
            "alice.testnet",
            JobKind::Marketplace,
            8000,
        );
    });
    call("alice.testnet", 1);
    c.configure_agent(
        t.clone(),
        OperatingMode::Private,
        false,
        3,
        8000,
        U128(NEAR / 100),
        0,
        hash('b'),
    );
    rejects(|| {
        job(
            &mut c,
            "paused",
            &t,
            "alice.testnet",
            JobKind::Private,
            8000,
        );
    });
    call("alice.testnet", 1);
    c.configure_agent(
        t.clone(),
        OperatingMode::Private,
        true,
        3,
        8000,
        U128(NEAR / 100),
        0,
        hash('b'),
    );
    rejects(|| {
        job(
            &mut c,
            "notlisted",
            &t,
            "bob.testnet",
            JobKind::Marketplace,
            8000,
        );
    });
}

#[test]
fn paused_agent_finishes_accepted_jobs_without_accepting_new_ones() {
    let (mut c, t) = active();
    job(
        &mut c,
        "accepted",
        &t,
        "bob.testnet",
        JobKind::Marketplace,
        8000,
    );
    call("alice.testnet", 1);
    c.configure_agent(
        t.clone(),
        OperatingMode::Private,
        false,
        3,
        8000,
        U128(NEAR / 100),
        0,
        hash('b'),
    );
    submit_output(&mut c, "accepted", 'd');
    verify(&mut c, "accepted", 1000, 'd');
    assert_eq!(c.job("accepted").status, JobStatus::Completed);
}

#[test]
fn duplicate_deliverables_pay_contractual_service_but_do_not_multiply_reputation() {
    let (mut c, t) = active();
    for (id, who) in [("one", "bob.testnet"), ("two", "carol.testnet")] {
        job(&mut c, id, &t, who, JobKind::Marketplace, 8000);
        submit_output(&mut c, id, 'd');
        verify(&mut c, id, 1000, 'd');
    }
    assert_eq!(c.agent(&t).lifetime.completed_paid, 2);
    assert_eq!(c.agent(&t).lifetime.reputation_events, 1);
    assert!(!c.job("two").settlement.unwrap().reputation_awarded);
}

#[test]
fn all_nft_transfer_routes_reject_active_paid_and_private_jobs() {
    for kind in [JobKind::Private, JobKind::Marketplace] {
        let (mut c, t) = active();
        let who = if kind == JobKind::Private {
            "alice.testnet"
        } else {
            "bob.testnet"
        };
        job(&mut c, "obligation", &t, who, kind, 8000);
        call("alice.testnet", 1);
        rejects(|| {
            c.nft_transfer(account("buyer.testnet"), t.clone(), None, None);
        });
        rejects(|| {
            c.nft_transfer_call(
                account("receiver.testnet"),
                t.clone(),
                None,
                None,
                "".into(),
            );
        });
        assert_eq!(c.nft_token(t).unwrap().owner_id, account("alice.testnet"));
        // The second loop requires isolated storage rather than retaining the first contract.
        near_sdk::mock::with_mocked_blockchain(|b| {
            b.take_storage();
        });
    }
}

#[test]
fn transfer_preserves_history_fuel_and_old_earnings_but_revokes_old_owner() {
    let (mut c, t) = active();
    activate(&mut c, &t, 2000);
    job(
        &mut c,
        "proven",
        &t,
        "bob.testnet",
        JobKind::Marketplace,
        8000,
    );
    submit_output(&mut c, "proven", 'd');
    verify(&mut c, "proven", 1000, 'd');
    let a = c.agent(&t);
    let earned = c.get_balance(account("alice.testnet")).claimable.0;
    call("alice.testnet", 1);
    c.nft_transfer(account("buyer.testnet"), t.clone(), None, None);
    let transferred = c.agent(&t);
    assert_eq!(transferred.owner_id, account("buyer.testnet"));
    assert_eq!(transferred.ownership_epoch, a.ownership_epoch + 1);
    assert_eq!(transferred.available_fuel, a.available_fuel);
    assert_eq!(transferred.lifetime, a.lifetime);
    assert_eq!(transferred.epoch_performance, Performance::default());
    assert!(!transferred.active);
    assert_eq!(transferred.reinvest_bps, 0);
    assert_eq!(transferred.config_hash, hash('0'));
    assert_eq!(c.get_balance(account("alice.testnet")).claimable.0, earned);
    rejects(|| {
        c.configure_agent(
            t.clone(),
            OperatingMode::Hybrid,
            true,
            3,
            8000,
            U128(NEAR / 100),
            0,
            hash('f'),
        );
    });
    call("buyer.testnet", 1);
    c.configure_agent(
        t.clone(),
        OperatingMode::Private,
        true,
        3,
        8000,
        U128(NEAR / 100),
        0,
        hash('f'),
    );
    job(
        &mut c,
        "buyerjob",
        &t,
        "buyer.testnet",
        JobKind::Private,
        8000,
    );
}

#[test]
fn transfer_call_freezes_receiver_until_successful_resolution() {
    let (mut c, t) = active();
    call("alice.testnet", 1);
    c.nft_transfer_call(
        account("receiver.testnet"),
        t.clone(),
        None,
        None,
        "".into(),
    );
    assert!(c.agent(&t).transfer_pending);
    assert!(!c.agent(&t).active);
    call("receiver.testnet", 1);
    rejects(|| {
        c.configure_agent(
            t.clone(),
            OperatingMode::Hybrid,
            true,
            3,
            8000,
            U128(NEAR / 100),
            0,
            hash('f'),
        );
    });
    rejects(|| {
        c.nft_transfer(account("mallory.testnet"), t.clone(), None, None);
    });
    callback(PromiseResult::Successful(b"false".to_vec()));
    assert!(c.nft_resolve_transfer(
        account("alice.testnet"),
        account("receiver.testnet"),
        t.clone(),
        None
    ));
    assert!(!c.agent(&t).transfer_pending);
    assert!(!c.agent(&t).active);
    assert_eq!(c.agent(&t).owner_id, account("receiver.testnet"));
}

#[test]
fn failed_transfer_receiver_returns_nft_without_restoring_old_authority() {
    let (mut c, t) = active();
    call("alice.testnet", 1);
    c.nft_transfer_call(
        account("receiver.testnet"),
        t.clone(),
        None,
        None,
        "".into(),
    );
    callback(PromiseResult::Failed);
    assert!(!c.nft_resolve_transfer(
        account("alice.testnet"),
        account("receiver.testnet"),
        t.clone(),
        None
    ));
    let a = c.agent(&t);
    assert_eq!(a.owner_id, account("alice.testnet"));
    assert_eq!(a.ownership_epoch, 3);
    assert!(!a.active);
    assert!(!a.transfer_pending);
    assert_eq!(a.reinvest_bps, 0);
}

#[test]
fn unauthorized_transfers_and_resolver_spoofing_fail() {
    let (mut c, t) = active();
    call("mallory.testnet", 1);
    rejects(|| {
        c.nft_transfer(account("mallory.testnet"), t.clone(), None, None);
    });
    rejects(|| {
        c.nft_resolve_transfer(
            account("mallory.testnet"),
            account("alice.testnet"),
            t.clone(),
            None,
        );
    });
    call("alice.testnet", 1);
    rejects(|| {
        c.nft_transfer(account("buyer.testnet"), t.clone(), Some(0), None);
    });
    assert_eq!(c.agent(&t).owner_id, account("alice.testnet"));
}

#[test]
fn pull_withdrawal_debits_before_transfer_and_restores_on_failure_once() {
    let (mut c, t) = active();
    job(
        &mut c,
        "earned",
        &t,
        "bob.testnet",
        JobKind::Marketplace,
        8000,
    );
    submit_output(&mut c, "earned", 'd');
    verify(&mut c, "earned", 1000, 'd');
    let earned = c.get_balance(account("alice.testnet")).claimable.0;
    call("alice.testnet", 1);
    let promise = c.withdraw();
    drop(promise);
    let b = c.get_balance(account("alice.testnet"));
    assert_eq!(b.claimable.0, 0);
    assert_eq!(b.pending.0, earned);
    assert!(get_created_receipts()
        .iter()
        .any(|r| r.receiver_id == account("alice.testnet")));
    rejects(|| {
        c.withdraw();
    });
    callback(PromiseResult::Failed);
    assert!(!c.on_withdraw(account("alice.testnet"), 1));
    assert_eq!(c.get_balance(account("alice.testnet")).claimable.0, earned);
    assert!(!c.on_withdraw(account("alice.testnet"), 1));
    assert_eq!(c.get_balance(account("alice.testnet")).claimable.0, earned);
}

#[test]
fn successful_withdrawal_and_spoofed_callbacks_cannot_restore_paid_money() {
    let mut c = setup();
    mint(&mut c);
    let balance = c.get_balance(account("treasury.testnet")).claimable.0;
    call("treasury.testnet", 1);
    drop(c.withdraw());
    call("mallory.testnet", 0);
    rejects(|| {
        c.on_withdraw(account("treasury.testnet"), 1);
    });
    callback(PromiseResult::Successful(vec![]));
    assert!(!c.on_withdraw(account("treasury.testnet"), 999));
    assert_eq!(
        c.get_balance(account("treasury.testnet")).pending.0,
        balance
    );
    assert!(c.on_withdraw(account("treasury.testnet"), 1));
    let b = c.get_balance(account("treasury.testnet"));
    assert_eq!(b.claimable.0, 0);
    assert_eq!(b.pending.0, 0);
}

#[test]
fn exact_integer_rounding_never_creates_money() {
    let (mut c, t) = active();
    call("alice.testnet", 1);
    c.configure_agent(
        t.clone(),
        OperatingMode::Hybrid,
        true,
        3,
        8000,
        U128(NEAR / 100 + 7),
        3333,
        hash('b'),
    );
    let j = job(
        &mut c,
        "rounding",
        &t,
        "bob.testnet",
        JobKind::Marketplace,
        8000,
    );
    submit_output(&mut c, "rounding", 'd');
    let r = verify(&mut c, "rounding", 1234, 'd');
    assert_eq!(
        r.owner_claimable.0
            + r.reinvested.0
            + r.platform_share.0
            + r.compute_charge.0
            + r.customer_refund.0,
        j.service_fee.0 + j.compute_allowance.0
    );
    assert_eq!(r.reinvested.0 % c.pricing.fuel_unit_price.0, 0);
    assert_eq!(r.platform_share.0, j.service_fee.0 / 10);
}

#[test]
fn separation_of_executor_verifier_roles_is_required() {
    call("admin.testnet", 0);
    rejects(|| {
        Proofbound::new(
            account("admin.testnet"),
            account("same.testnet"),
            account("same.testnet"),
            account("treasury.testnet"),
            None,
        );
    });
}

#[test]
fn longest_supported_records_fit_the_disclosed_storage_fee() {
    let mut c = setup();
    let owner = format!("{}.testnet", "a".repeat(56));
    call(&owner, c.mint_total());
    let a = c.mint_agent("A".repeat(64), hash('a'));
    call(&owner, 1);
    c.configure_agent(
        a.token_id.clone(),
        OperatingMode::Hybrid,
        true,
        3,
        8000,
        U128(NEAR / 100),
        0,
        hash('b'),
    );
    let customer = format!("{}.testnet", "b".repeat(56));
    let id = "j".repeat(64);
    let before = env::storage_usage();
    job(
        &mut c,
        &id,
        &a.token_id,
        &customer,
        JobKind::Marketplace,
        8000,
    );
    submit_output(&mut c, &id, 'd');
    verify(&mut c, &id, 1234, 'd');
    let actual_bytes = env::storage_usage().saturating_sub(before);
    assert!(
        actual_bytes as u128 * env::storage_byte_cost().as_yoctonear()
            <= c.pricing.job_storage_fee.0
    );
}
