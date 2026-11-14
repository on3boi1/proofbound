//! PROOFBOUND: testnet Agent NFTs, bounded job escrow, and funded Fuel accounting.
//! The executor and deterministic verifier are trusted services with distinct identities.
//! Confidential inputs and model output stay offchain; only commitments are stored here.

use near_contract_standards::non_fungible_token::{
    core::{NonFungibleTokenCore, NonFungibleTokenResolver},
    enumeration::NonFungibleTokenEnumeration,
    events::NftMint,
    metadata::{
        NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
    },
    NonFungibleToken, Token, TokenId,
};
use near_sdk::{
    assert_one_yocto,
    collections::{LookupMap, UnorderedMap},
    env, ext_contract,
    json_types::{U128, U64},
    near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue, PromiseResult,
};
use std::collections::HashMap;

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
const MAX_FUEL: u64 = 1_000_000_000_000;
const MAX_JOB_FUEL: u64 = 100_000;
const MAX_PAGE: u64 = 100;
const SECOND: u64 = 1_000_000_000;

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct PricingConfig {
    pub fuel_unit_price: U128,
    pub initial_fuel: u64,
    pub mint_storage_fee: U128,
    pub mint_platform_fee: U128,
    pub job_storage_fee: U128,
    pub default_service_fee: U128,
}

impl Default for PricingConfig {
    fn default() -> Self {
        Self {
            fuel_unit_price: U128(NEAR / 1_000_000),
            initial_fuel: 100_000,
            mint_storage_fee: U128(NEAR / 20),
            mint_platform_fee: U128(NEAR / 100),
            job_storage_fee: U128(NEAR / 50),
            default_service_fee: U128(NEAR / 100),
        }
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OperatingMode {
    Private,
    Marketplace,
    Hybrid,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobKind {
    Private,
    Marketplace,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Submitted,
    Completed,
    Failed,
    Cancelled,
    Expired,
    Refunded,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Performance {
    pub completed_personal: u64,
    pub completed_paid: u64,
    pub failed_personal: u64,
    pub failed_paid: u64,
    pub reputation_events: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Agent {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub name: String,
    pub specialization: String,
    pub template_id: String,
    pub config_hash: String,
    pub config_version: u64,
    pub ownership_epoch: u64,
    pub mode: OperatingMode,
    pub active: bool,
    pub transfer_pending: bool,
    pub max_concurrent: u32,
    pub max_fuel_per_job: u64,
    pub service_fee: U128,
    pub reinvest_bps: u16,
    pub available_fuel: u64,
    pub reserved_fuel: u64,
    pub active_jobs: u32,
    pub lifetime: Performance,
    pub configuration_performance: Performance,
    pub epoch_performance: Performance,
    pub lifetime_service_revenue: U128,
    pub created_at_ns: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Settlement {
    pub accepted: bool,
    pub outcome: String,
    pub actual_fuel: u64,
    pub charged_fuel: u64,
    pub owner_share: U128,
    pub platform_share: U128,
    pub compute_charge: U128,
    pub customer_refund: U128,
    pub reinvested: U128,
    pub owner_claimable: U128,
    pub reputation_awarded: bool,
    pub output_hash: String,
    pub evidence_hash: String,
    pub settled_at_ns: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Job {
    pub job_id: String,
    pub token_id: TokenId,
    pub customer_id: AccountId,
    pub owner_id: AccountId,
    pub kind: JobKind,
    pub status: JobStatus,
    pub request_hash: String,
    pub config_hash: String,
    pub config_version: u64,
    pub ownership_epoch: u64,
    pub max_fuel: u64,
    pub service_fee: U128,
    pub compute_allowance: U128,
    pub storage_fee: U128,
    pub reinvest_bps: u16,
    pub created_at_ns: U64,
    pub deadline_ns: U64,
    pub output_hash: Option<String>,
    pub evidence_hash: Option<String>,
    pub settlement: Option<Settlement>,
}

#[near(serializers = [json])]
pub struct ContractConfig {
    pub owner_id: AccountId,
    pub executor_id: AccountId,
    pub verifier_id: AccountId,
    pub treasury_id: AccountId,
    pub pricing: PricingConfig,
    pub mint_total: U128,
    pub platform_fee_bps: u16,
    pub network_policy: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
struct PendingWithdrawal {
    nonce: u64,
    amount: U128,
}

#[near(serializers = [json])]
pub struct BalanceView {
    pub account_id: AccountId,
    pub claimable: U128,
    pub pending: U128,
}

#[near(serializers = [json])]
pub struct Quote {
    pub service_fee: U128,
    pub max_compute: U128,
    pub storage_fee: U128,
    pub total_deposit: U128,
    pub max_fuel: u64,
    pub config_version: u64,
    pub refund_terms: String,
}

#[ext_contract(ext_self)]
trait WithdrawCallback {
    fn on_withdraw(&mut self, account_id: AccountId, nonce: u64) -> bool;
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Proofbound {
    owner_id: AccountId,
    executor_id: AccountId,
    verifier_id: AccountId,
    treasury_id: AccountId,
    pricing: PricingConfig,
    tokens: NonFungibleToken,
    agents: UnorderedMap<TokenId, Agent>,
    jobs: UnorderedMap<String, Job>,
    balances: LookupMap<AccountId, u128>,
    pending_withdrawals: LookupMap<AccountId, PendingWithdrawal>,
    reputation_outputs: LookupMap<String, bool>,
    reputation_customers: LookupMap<String, bool>,
    next_token_id: u64,
    withdrawal_nonce: u64,
}

#[near]
impl Proofbound {
    #[init]
    pub fn new(
        owner_id: AccountId,
        executor_id: AccountId,
        verifier_id: AccountId,
        treasury_id: AccountId,
        config: Option<PricingConfig>,
    ) -> Self {
        assert_ne!(
            executor_id, verifier_id,
            "Executor and verifier identities must differ"
        );
        let pricing = config.unwrap_or_default();
        assert!(
            pricing.fuel_unit_price.0 > 0 && pricing.fuel_unit_price.0 <= NEAR,
            "Invalid Fuel unit price"
        );
        assert!(
            pricing.initial_fuel > 0 && pricing.initial_fuel <= MAX_FUEL,
            "Invalid initial Fuel"
        );
        assert!(
            pricing.mint_storage_fee.0 >= NEAR / 20,
            "Mint storage reserve too small"
        );
        assert!(
            pricing.job_storage_fee.0 >= NEAR / 50,
            "Job storage reserve too small"
        );
        let _ = pricing
            .fuel_unit_price
            .0
            .checked_mul(pricing.initial_fuel as u128)
            .and_then(|v| v.checked_add(pricing.mint_storage_fee.0))
            .and_then(|v| v.checked_add(pricing.mint_platform_fee.0))
            .expect("Price overflow");
        Self {
            tokens: NonFungibleToken::new(
                b"t".to_vec(),
                owner_id.clone(),
                Some(b"m".to_vec()),
                Some(b"e".to_vec()),
                None::<Vec<u8>>,
            ),
            owner_id,
            executor_id,
            verifier_id,
            treasury_id,
            pricing,
            agents: UnorderedMap::new(b"a"),
            jobs: UnorderedMap::new(b"j"),
            balances: LookupMap::new(b"b"),
            pending_withdrawals: LookupMap::new(b"w"),
            reputation_outputs: LookupMap::new(b"r"),
            reputation_customers: LookupMap::new(b"u"),
            next_token_id: 1,
            withdrawal_nonce: 0,
        }
    }

    pub fn get_config(&self) -> ContractConfig {
        ContractConfig {
            owner_id: self.owner_id.clone(),
            executor_id: self.executor_id.clone(),
            verifier_id: self.verifier_id.clone(),
            treasury_id: self.treasury_id.clone(),
            pricing: self.pricing.clone(),
            mint_total: U128(self.mint_total()),
            platform_fee_bps: 1000,
            network_policy: "Testnet prototype; Fuel is subsidized operating credit, not a token"
                .into(),
        }
    }

    #[payable]
    pub fn mint_agent(&mut self, name: String, config_hash: String) -> Agent {
        assert!(
            !name.trim().is_empty() && name.len() <= 64,
            "Name must be 1-64 UTF-8 bytes"
        );
        assert_hash(&config_hash);
        assert_eq!(
            env::attached_deposit().as_yoctonear(),
            self.mint_total(),
            "Attach exact mint quote"
        );
        let storage_before = env::storage_usage();
        let token_id = self.next_token_id.to_string();
        self.next_token_id = self
            .next_token_id
            .checked_add(1)
            .expect("Identity counter exhausted");
        let owner_id = env::predecessor_account_id();
        let agent = Agent {
            token_id: token_id.clone(),
            owner_id: owner_id.clone(),
            name: name.clone(),
            specialization: "research".into(),
            template_id: "research-v1".into(),
            config_hash,
            config_version: 1,
            ownership_epoch: 1,
            mode: OperatingMode::Private,
            active: false,
            transfer_pending: false,
            max_concurrent: 3,
            max_fuel_per_job: 8000,
            service_fee: self.pricing.default_service_fee,
            reinvest_bps: 0,
            available_fuel: self.pricing.initial_fuel,
            reserved_fuel: 0,
            active_jobs: 0,
            lifetime: Performance::default(),
            configuration_performance: Performance::default(),
            epoch_performance: Performance::default(),
            lifetime_service_revenue: U128(0),
            created_at_ns: U64(env::block_timestamp()),
        };
        self.tokens.internal_mint_with_refund(token_id.clone(), owner_id.clone(), Some(TokenMetadata {
            title: Some(name), description: Some("PROOFBOUND Research Agent. Ownership controls activation and bounded work. Testnet.".into()),
            copies: Some(1), issued_at: Some((env::block_timestamp() / 1_000_000).to_string()),
            extra: Some("{\"specialization\":\"research\",\"template\":\"research-v1\"}".into()),
            ..TokenMetadata::default()
        }), None);
        self.agents.insert(&token_id, &agent);
        self.credit(&self.treasury_id.clone(), self.pricing.mint_platform_fee.0);
        self.assert_storage_budget(storage_before, self.pricing.mint_storage_fee.0, 0);
        NftMint {
            owner_id: &owner_id,
            token_ids: &[&token_id],
            memo: Some("Agent identity minted"),
        }
        .emit();
        event(
            "agent_minted",
            near_sdk::serde_json::json!({"agent": agent}),
        );
        agent
    }

    #[payable]
    pub fn configure_agent(
        &mut self,
        token_id: TokenId,
        mode: OperatingMode,
        active: bool,
        max_concurrent: u32,
        max_fuel_per_job: u64,
        service_fee: U128,
        reinvest_bps: u16,
        config_hash: String,
    ) -> Agent {
        assert_one_yocto();
        let mut agent = self.owned_agent(&token_id);
        assert!(!agent.transfer_pending, "Transfer pending");
        assert!((1..=3).contains(&max_concurrent), "Capacity must be 1-3");
        assert!(
            (1..=MAX_JOB_FUEL).contains(&max_fuel_per_job),
            "Invalid execution cap"
        );
        assert!(
            service_fee.0 > 0 && service_fee.0 <= 100 * NEAR,
            "Invalid service fee"
        );
        assert!(reinvest_bps <= 10_000, "Invalid reinvest percentage");
        assert_hash(&config_hash);
        // Accepted jobs retain the exact config, price, and reinvestment policy at acceptance.
        agent.config_version = agent
            .config_version
            .checked_add(1)
            .expect("Version overflow");
        agent.config_hash = config_hash;
        agent.mode = mode;
        agent.active = active;
        agent.max_concurrent = max_concurrent;
        agent.max_fuel_per_job = max_fuel_per_job;
        agent.service_fee = service_fee;
        agent.reinvest_bps = reinvest_bps;
        agent.configuration_performance = Performance::default();
        self.agents.insert(&token_id, &agent);
        event(
            "agent_configured",
            near_sdk::serde_json::json!({"agent": agent}),
        );
        agent
    }

    #[payable]
    pub fn fuel_top_up(&mut self, token_id: TokenId) -> Agent {
        let mut agent = self.owned_agent(&token_id);
        assert!(!agent.transfer_pending, "Transfer pending");
        let amount = env::attached_deposit().as_yoctonear();
        assert!(
            amount > 0 && amount % self.pricing.fuel_unit_price.0 == 0,
            "Top-up must be a positive whole Fuel allocation"
        );
        let units =
            u64::try_from(amount / self.pricing.fuel_unit_price.0).expect("Top-up too large");
        agent.available_fuel = agent
            .available_fuel
            .checked_add(units)
            .expect("Fuel overflow");
        assert!(
            agent
                .available_fuel
                .checked_add(agent.reserved_fuel)
                .unwrap()
                <= MAX_FUEL,
            "Fuel capacity exceeded"
        );
        self.agents.insert(&token_id, &agent);
        event(
            "fuel_top_up",
            near_sdk::serde_json::json!({"token_id":token_id,"owner_id":agent.owner_id,"fuel":units,"funding":U128(amount)}),
        );
        agent
    }

    pub fn quote_job(&self, token_id: TokenId, kind: JobKind, max_fuel: u64) -> Quote {
        let agent = self.agent(&token_id);
        assert!(
            (1..=agent.max_fuel_per_job).contains(&max_fuel),
            "Execution cap exceeded"
        );
        let service = if kind == JobKind::Marketplace {
            agent.service_fee.0
        } else {
            0
        };
        let compute = if kind == JobKind::Marketplace {
            self.fuel_cost(max_fuel)
        } else {
            0
        };
        Quote { service_fee: U128(service), max_compute: U128(compute), storage_fee: self.pricing.job_storage_fee,
            total_deposit: U128(service.checked_add(compute).unwrap().checked_add(self.pricing.job_storage_fee.0).unwrap()),
            max_fuel, config_version: agent.config_version,
            refund_terms: "Evidence storage is retained. Failure/cancellation/expiry refunds all service and execution escrow; successful work refunds unused execution allowance. Refunds are claimable by the customer.".into() }
    }

    #[payable]
    pub fn submit_job(
        &mut self,
        job_id: String,
        token_id: TokenId,
        request_hash: String,
        kind: JobKind,
        max_fuel: u64,
        deadline_ns: U64,
        expected_config_version: u64,
    ) -> Job {
        assert!(
            !job_id.is_empty()
                && job_id.len() <= 64
                && job_id
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_'),
            "Invalid job ID"
        );
        assert!(self.jobs.get(&job_id).is_none(), "Job ID already exists");
        assert_hash(&request_hash);
        let mut agent = self.agent(&token_id);
        assert!(
            agent.active && !agent.transfer_pending,
            "Agent is not accepting jobs"
        );
        assert!(
            agent.active_jobs < agent.max_concurrent,
            "Agent capacity reached"
        );
        assert_eq!(
            agent.config_version, expected_config_version,
            "Configuration changed; obtain a new quote"
        );
        let customer_id = env::predecessor_account_id();
        match kind {
            JobKind::Private => {
                assert_eq!(
                    customer_id, agent.owner_id,
                    "Only current owner can assign personal jobs"
                );
                assert!(
                    agent.mode != OperatingMode::Marketplace,
                    "Personal work is disabled"
                );
                assert!(
                    agent.available_fuel >= max_fuel,
                    "Insufficient available Fuel"
                );
            }
            JobKind::Marketplace => {
                assert_ne!(
                    customer_id, agent.owner_id,
                    "Self-hiring is not permitted; use a personal job"
                );
                assert!(
                    agent.mode != OperatingMode::Private,
                    "Marketplace is disabled"
                );
            }
        }
        let now = env::block_timestamp();
        assert!(
            deadline_ns.0 >= now.saturating_add(60 * SECOND)
                && deadline_ns.0 <= now.saturating_add(7 * 86400 * SECOND),
            "Deadline must be 1 minute to 7 days ahead"
        );
        let quote = self.quote_job(token_id.clone(), kind.clone(), max_fuel);
        assert_eq!(
            env::attached_deposit().as_yoctonear(),
            quote.total_deposit.0,
            "Attach exact job quote"
        );
        let storage_before = env::storage_usage();
        if kind == JobKind::Private {
            agent.available_fuel -= max_fuel;
            agent.reserved_fuel = agent
                .reserved_fuel
                .checked_add(max_fuel)
                .expect("Fuel overflow");
        }
        agent.active_jobs += 1;
        let job = Job {
            job_id: job_id.clone(),
            token_id: token_id.clone(),
            customer_id,
            owner_id: agent.owner_id.clone(),
            kind,
            status: JobStatus::Queued,
            request_hash,
            config_hash: agent.config_hash.clone(),
            config_version: agent.config_version,
            ownership_epoch: agent.ownership_epoch,
            max_fuel,
            service_fee: quote.service_fee,
            compute_allowance: quote.max_compute,
            storage_fee: quote.storage_fee,
            reinvest_bps: agent.reinvest_bps,
            created_at_ns: U64(now),
            deadline_ns,
            output_hash: None,
            evidence_hash: None,
            settlement: None,
        };
        self.agents.insert(&token_id, &agent);
        self.jobs.insert(&job_id, &job);
        // Reserve room for result commitments, settlement, reputation key, and balance indexes.
        self.assert_storage_budget(storage_before, self.pricing.job_storage_fee.0, 900);
        event("job_queued", near_sdk::serde_json::json!({"job":job}));
        job
    }

    pub fn start_job(&mut self, job_id: String) -> Job {
        self.assert_executor();
        let mut job = self.job(&job_id);
        if job.status == JobStatus::Running {
            return job;
        }
        assert_eq!(job.status, JobStatus::Queued, "Job is not queued");
        assert!(
            env::block_timestamp() <= job.deadline_ns.0,
            "Job has expired"
        );
        job.status = JobStatus::Running;
        self.jobs.insert(&job_id, &job);
        event(
            "job_running",
            near_sdk::serde_json::json!({"job_id":job_id}),
        );
        job
    }

    pub fn submit_result(
        &mut self,
        job_id: String,
        output_hash: String,
        evidence_hash: String,
    ) -> Job {
        self.assert_executor();
        assert_hash(&output_hash);
        assert_hash(&evidence_hash);
        let mut job = self.job(&job_id);
        if job.status == JobStatus::Submitted {
            assert_eq!(job.output_hash, Some(output_hash), "Result replay differs");
            assert_eq!(
                job.evidence_hash,
                Some(evidence_hash),
                "Evidence replay differs"
            );
            return job;
        }
        assert_eq!(job.status, JobStatus::Running, "Job is not running");
        assert!(
            env::block_timestamp() <= job.deadline_ns.0,
            "Job has expired"
        );
        job.status = JobStatus::Submitted;
        job.output_hash = Some(output_hash);
        job.evidence_hash = Some(evidence_hash);
        self.jobs.insert(&job_id, &job);
        event(
            "job_submitted",
            near_sdk::serde_json::json!({"job_id":job_id,"output_hash":job.output_hash,"evidence_hash":job.evidence_hash}),
        );
        job
    }

    pub fn verify_job(
        &mut self,
        job_id: String,
        accepted: bool,
        actual_fuel: u64,
        output_hash: String,
        evidence_hash: String,
        failure_code: Option<String>,
    ) -> Settlement {
        assert_eq!(
            env::predecessor_account_id(),
            self.verifier_id,
            "Only authorized verifier may settle"
        );
        let job = self.job(&job_id);
        if let Some(receipt) = job.settlement {
            assert_eq!(receipt.accepted, accepted, "Settlement replay differs");
            assert_eq!(receipt.actual_fuel, actual_fuel, "Usage replay differs");
            assert_eq!(receipt.output_hash, output_hash, "Output replay differs");
            assert_eq!(
                receipt.evidence_hash, evidence_hash,
                "Evidence replay differs"
            );
            return receipt;
        }
        assert_hash(&output_hash);
        assert_hash(&evidence_hash);
        assert!(
            actual_fuel <= job.max_fuel,
            "Measured usage exceeds authorized cap"
        );
        if accepted {
            assert_eq!(
                job.status,
                JobStatus::Submitted,
                "Submit committed output before verification"
            );
            assert_eq!(
                job.output_hash,
                Some(output_hash.clone()),
                "Output commitment mismatch"
            );
            assert_eq!(
                job.evidence_hash,
                Some(evidence_hash.clone()),
                "Evidence commitment mismatch"
            );
            assert!(
                env::block_timestamp() <= job.deadline_ns.0,
                "Expired work cannot settle successfully"
            );
        }
        let reason = if accepted {
            "completed".to_string()
        } else {
            failure_code.unwrap_or_else(|| "verification_failed".into())
        };
        assert!(reason.len() <= 64, "Failure code too long");
        self.settle(
            job,
            accepted,
            actual_fuel,
            output_hash,
            evidence_hash,
            reason,
        )
    }

    #[payable]
    pub fn cancel_job(&mut self, job_id: String) -> Settlement {
        assert_one_yocto();
        let job = self.job(&job_id);
        assert_eq!(
            env::predecessor_account_id(),
            job.customer_id,
            "Only customer can cancel"
        );
        assert_eq!(
            job.status,
            JobStatus::Queued,
            "Only queued jobs may be cancelled"
        );
        self.settle(
            job,
            false,
            0,
            String::new(),
            String::new(),
            "cancelled".into(),
        )
    }

    pub fn expire_job(&mut self, job_id: String) -> Settlement {
        let job = self.job(&job_id);
        if let Some(receipt) = job.settlement {
            return receipt;
        }
        assert!(
            env::block_timestamp() > job.deadline_ns.0,
            "Job deadline has not elapsed"
        );
        self.settle(
            job,
            false,
            0,
            String::new(),
            String::new(),
            "expired".into(),
        )
    }

    #[payable]
    pub fn withdraw(&mut self) -> Promise {
        assert_one_yocto();
        let account_id = env::predecessor_account_id();
        assert!(
            self.pending_withdrawals.get(&account_id).is_none(),
            "Withdrawal already pending"
        );
        let amount = self.balances.get(&account_id).unwrap_or(0);
        assert!(amount > 0, "No claimable balance");
        self.balances.insert(&account_id, &0);
        self.withdrawal_nonce = self
            .withdrawal_nonce
            .checked_add(1)
            .expect("Withdrawal nonce overflow");
        self.pending_withdrawals.insert(
            &account_id,
            &PendingWithdrawal {
                nonce: self.withdrawal_nonce,
                amount: U128(amount),
            },
        );
        event(
            "withdrawal_started",
            near_sdk::serde_json::json!({"account_id":account_id,"amount":U128(amount),"nonce":self.withdrawal_nonce}),
        );
        Promise::new(account_id.clone())
            .transfer(NearToken::from_yoctonear(amount))
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(12))
                    .on_withdraw(account_id, self.withdrawal_nonce),
            )
    }

    #[private]
    pub fn on_withdraw(&mut self, account_id: AccountId, nonce: u64) -> bool {
        assert_eq!(
            env::predecessor_account_id(),
            env::current_account_id(),
            "Private callback"
        );
        let Some(pending) = self.pending_withdrawals.get(&account_id) else {
            return false;
        };
        if pending.nonce != nonce {
            return false;
        }
        let success = matches!(env::promise_result(0), PromiseResult::Successful(_));
        self.pending_withdrawals.remove(&account_id);
        if !success {
            self.credit(&account_id, pending.amount.0);
        }
        event(
            "withdrawal_resolved",
            near_sdk::serde_json::json!({"account_id":account_id,"amount":pending.amount,"nonce":nonce,"success":success}),
        );
        success
    }

    pub fn get_agent(&self, token_id: TokenId) -> Option<Agent> {
        self.agents.get(&token_id)
    }
    pub fn get_job(&self, job_id: String) -> Option<Job> {
        self.jobs.get(&job_id)
    }
    pub fn get_balance(&self, account_id: AccountId) -> BalanceView {
        BalanceView {
            claimable: U128(self.balances.get(&account_id).unwrap_or(0)),
            pending: self
                .pending_withdrawals
                .get(&account_id)
                .map(|p| p.amount)
                .unwrap_or(U128(0)),
            account_id,
        }
    }
    pub fn list_agents(&self, from_index: Option<U64>, limit: Option<u64>) -> Vec<Agent> {
        self.agents
            .values_as_vector()
            .iter()
            .skip(from_index.unwrap_or(U64(0)).0 as usize)
            .take(limit.unwrap_or(50).min(MAX_PAGE) as usize)
            .collect()
    }
    pub fn list_jobs(&self, from_index: Option<U64>, limit: Option<u64>) -> Vec<Job> {
        self.jobs
            .values_as_vector()
            .iter()
            .skip(from_index.unwrap_or(U64(0)).0 as usize)
            .take(limit.unwrap_or(50).min(MAX_PAGE) as usize)
            .collect()
    }
}

impl Proofbound {
    fn mint_total(&self) -> u128 {
        self.fuel_cost(self.pricing.initial_fuel)
            .checked_add(self.pricing.mint_storage_fee.0)
            .unwrap()
            .checked_add(self.pricing.mint_platform_fee.0)
            .unwrap()
    }
    fn fuel_cost(&self, units: u64) -> u128 {
        self.pricing
            .fuel_unit_price
            .0
            .checked_mul(units as u128)
            .expect("Fuel cost overflow")
    }
    fn agent(&self, id: &str) -> Agent {
        self.agents.get(&id.to_string()).expect("Unknown Agent NFT")
    }
    fn job(&self, id: &str) -> Job {
        self.jobs.get(&id.to_string()).expect("Unknown job")
    }
    fn owned_agent(&self, id: &str) -> Agent {
        let agent = self.agent(id);
        assert_eq!(
            env::predecessor_account_id(),
            agent.owner_id,
            "Only current NFT owner is authorized"
        );
        agent
    }
    fn assert_executor(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.executor_id,
            "Only authorized executor"
        );
    }
    fn credit(&mut self, id: &AccountId, amount: u128) {
        if amount > 0 {
            self.balances.insert(
                id,
                &self
                    .balances
                    .get(id)
                    .unwrap_or(0)
                    .checked_add(amount)
                    .expect("Balance overflow"),
            );
        }
    }
    fn assert_storage_budget(&self, before: u64, reserve: u128, future_bytes: u64) {
        let cost = (env::storage_usage().saturating_sub(before) + future_bytes) as u128
            * env::storage_byte_cost().as_yoctonear();
        assert!(cost <= reserve, "Storage reserve insufficient");
    }
    fn settle(
        &mut self,
        mut job: Job,
        accepted: bool,
        actual_fuel: u64,
        output_hash: String,
        evidence_hash: String,
        outcome: String,
    ) -> Settlement {
        assert!(job.settlement.is_none(), "Job already settled");
        let mut agent = self.agent(&job.token_id);
        assert_eq!(
            agent.owner_id, job.owner_id,
            "Ownership changed with an active obligation"
        );
        assert!(actual_fuel <= job.max_fuel, "Execution cap exceeded");
        let charged_fuel = if accepted { actual_fuel } else { 0 };
        let compute_charge = self.fuel_cost(charged_fuel);
        let (mut owner_share, mut platform_share, mut customer_refund, mut reinvested) =
            (0, 0, 0, 0);
        if job.kind == JobKind::Private {
            agent.reserved_fuel = agent
                .reserved_fuel
                .checked_sub(job.max_fuel)
                .expect("Fuel reservation invariant");
            agent.available_fuel = agent
                .available_fuel
                .checked_add(job.max_fuel - charged_fuel)
                .expect("Fuel overflow");
        } else if accepted {
            platform_share = job.service_fee.0 / 10;
            owner_share = job.service_fee.0 - platform_share;
            customer_refund = job.compute_allowance.0 - compute_charge;
            let desired = owner_share
                .checked_mul(job.reinvest_bps as u128)
                .expect("Reinvest overflow")
                / 10_000;
            let fuel_room = MAX_FUEL - agent.available_fuel - agent.reserved_fuel;
            let reinvest_units =
                (desired / self.pricing.fuel_unit_price.0).min(fuel_room as u128) as u64;
            reinvested = self.fuel_cost(reinvest_units);
            agent.available_fuel += reinvest_units;
            self.credit(&job.owner_id, owner_share - reinvested);
            agent.lifetime_service_revenue.0 = agent
                .lifetime_service_revenue
                .0
                .checked_add(owner_share)
                .expect("Revenue overflow");
        } else {
            customer_refund = job
                .service_fee
                .0
                .checked_add(job.compute_allowance.0)
                .unwrap();
        }
        self.credit(&job.customer_id, customer_refund);
        self.credit(
            &self.treasury_id.clone(),
            platform_share.checked_add(compute_charge).unwrap(),
        );
        let customer_key = format!("{}:{}:{}", job.token_id, job.ownership_epoch, job.customer_id);
        let reputation_awarded = accepted
            && job.kind == JobKind::Marketplace
            && self.reputation_outputs.get(&output_hash).is_none()
            && self.reputation_customers.get(&customer_key).is_none();
        if accepted && job.kind == JobKind::Marketplace {
            self.reputation_outputs.insert(&output_hash, &true);
        }
        if reputation_awarded {
            self.reputation_customers.insert(&customer_key, &true);
        }
        // Customer cancellation before execution is a neutral outcome, not failed work.
        if outcome != "cancelled" {
            update_performance(&mut agent.lifetime, &job.kind, accepted, reputation_awarded);
        }
        if agent.config_version == job.config_version && outcome != "cancelled" {
            update_performance(
                &mut agent.configuration_performance,
                &job.kind,
                accepted,
                reputation_awarded,
            );
        }
        if agent.ownership_epoch == job.ownership_epoch && outcome != "cancelled" {
            update_performance(
                &mut agent.epoch_performance,
                &job.kind,
                accepted,
                reputation_awarded,
            );
        }
        agent.active_jobs = agent
            .active_jobs
            .checked_sub(1)
            .expect("Active-job invariant");
        let receipt = Settlement {
            accepted,
            outcome: outcome.clone(),
            actual_fuel,
            charged_fuel,
            owner_share: U128(owner_share),
            platform_share: U128(platform_share),
            compute_charge: U128(compute_charge),
            customer_refund: U128(customer_refund),
            reinvested: U128(reinvested),
            owner_claimable: U128(owner_share - reinvested),
            reputation_awarded,
            output_hash,
            evidence_hash,
            settled_at_ns: U64(env::block_timestamp()),
        };
        job.status = if accepted {
            JobStatus::Completed
        } else if job.kind == JobKind::Marketplace {
            JobStatus::Refunded
        } else if outcome == "expired" {
            JobStatus::Expired
        } else if outcome == "cancelled" {
            JobStatus::Cancelled
        } else {
            JobStatus::Failed
        };
        job.settlement = Some(receipt.clone());
        self.agents.insert(&job.token_id, &agent);
        self.jobs.insert(&job.job_id, &job);
        event(
            "job_settled",
            near_sdk::serde_json::json!({"job_id":job.job_id,"token_id":job.token_id,"owner_id":job.owner_id,"customer_id":job.customer_id,"config_version":job.config_version,"ownership_epoch":job.ownership_epoch,"receipt":receipt}),
        );
        receipt
    }
    fn prepare_transfer(&self, token_id: &TokenId, approval_id: Option<u64>) -> Agent {
        assert!(
            approval_id.is_none(),
            "Delegated NFT transfer approvals are not supported"
        );
        let agent = self.owned_agent(token_id);
        assert!(!agent.transfer_pending, "Transfer already pending");
        assert_eq!(
            agent.active_jobs, 0,
            "Resolve all active jobs before transferring ownership"
        );
        assert_eq!(
            agent.reserved_fuel, 0,
            "Resolve Fuel reservations before transfer"
        );
        agent
    }
    fn ownership_changed(&mut self, mut agent: Agent, new_owner: AccountId, pending: bool) {
        let previous_owner = agent.owner_id.clone();
        agent.owner_id = new_owner;
        agent.ownership_epoch = agent
            .ownership_epoch
            .checked_add(1)
            .expect("Ownership epoch overflow");
        agent.config_version = agent
            .config_version
            .checked_add(1)
            .expect("Config version overflow");
        agent.config_hash = "0".repeat(64); // Old private configuration is deliberately not inherited.
        agent.active = false;
        agent.mode = OperatingMode::Private;
        agent.reinvest_bps = 0;
        agent.max_fuel_per_job = 8000;
        agent.max_concurrent = 3;
        agent.service_fee = self.pricing.default_service_fee;
        agent.transfer_pending = pending;
        agent.configuration_performance = Performance::default();
        agent.epoch_performance = Performance::default();
        self.agents.insert(&agent.token_id, &agent);
        event(
            "ownership_changed",
            near_sdk::serde_json::json!({"token_id":agent.token_id,"previous_owner":previous_owner,"owner_id":agent.owner_id,"ownership_epoch":agent.ownership_epoch,"config_version":agent.config_version,"reactivation_required":true,"transfer_pending":pending}),
        );
    }
}

#[near]
impl NonFungibleTokenCore for Proofbound {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        assert_one_yocto();
        assert!(
            memo.as_ref().map_or(true, |s| s.len() <= 256),
            "Memo too long"
        );
        let agent = self.prepare_transfer(&token_id, approval_id);
        self.tokens
            .nft_transfer(receiver_id.clone(), token_id, approval_id, memo);
        self.ownership_changed(agent, receiver_id, false);
    }
    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        assert_one_yocto();
        assert!(
            msg.len() <= 1024 && memo.as_ref().map_or(true, |s| s.len() <= 256),
            "Transfer message too long"
        );
        let agent = self.prepare_transfer(&token_id, approval_id);
        // Freeze management and work until the NEP-171 receiver callback resolves.
        let promise =
            self.tokens
                .nft_transfer_call(receiver_id.clone(), token_id, approval_id, memo, msg);
        self.ownership_changed(agent, receiver_id, true);
        promise
    }
    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

#[near]
impl NonFungibleTokenResolver for Proofbound {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        assert_eq!(
            env::predecessor_account_id(),
            env::current_account_id(),
            "Private callback"
        );
        let retained = self.tokens.nft_resolve_transfer(
            previous_owner_id,
            receiver_id,
            token_id.clone(),
            approved_account_ids,
        );
        let owner = self
            .tokens
            .nft_token(token_id.clone())
            .expect("NFT missing")
            .owner_id;
        let mut agent = self.agent(&token_id);
        if agent.owner_id != owner {
            self.ownership_changed(agent, owner, false);
        } else {
            agent.transfer_pending = false;
            self.agents.insert(&token_id, &agent);
        }
        event(
            "ownership_transfer_resolved",
            near_sdk::serde_json::json!({"token_id":token_id,"retained_by_receiver":retained}),
        );
        retained
    }
}

#[near]
impl NonFungibleTokenEnumeration for Proofbound {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }
    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens
            .nft_tokens(from_index, Some(limit.unwrap_or(50).min(MAX_PAGE)))
    }
    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }
    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens.nft_tokens_for_owner(
            account_id,
            from_index,
            Some(limit.unwrap_or(50).min(MAX_PAGE)),
        )
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for Proofbound {
    fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.into(),
            name: "PROOFBOUND Agents".into(),
            symbol: "PROOFBOUND".into(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }
}

fn assert_hash(value: &str) {
    assert!(
        value.len() == 64
            && value
                .bytes()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c)),
        "Expected lowercase SHA-256 hex commitment"
    );
}
fn update_performance(p: &mut Performance, kind: &JobKind, accepted: bool, rep: bool) {
    match (kind, accepted) {
        (JobKind::Private, true) => p.completed_personal += 1,
        (JobKind::Private, false) => p.failed_personal += 1,
        (JobKind::Marketplace, true) => p.completed_paid += 1,
        (JobKind::Marketplace, false) => p.failed_paid += 1,
    }
    if rep {
        p.reputation_events += 1;
    }
}
fn event(name: &str, data: near_sdk::serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        near_sdk::serde_json::json!({"standard":"proofbound","version":"1.0.0","event":name,"data":[data]})
    ));
}

#[cfg(test)]
mod tests;
