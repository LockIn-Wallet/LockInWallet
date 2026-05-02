use anchor_lang::prelude::*;

pub const PRECISION: u128 = 1_000_000_000_000; // 1e12 for reward-per-share math
pub const MAX_VAULT_NAME_LENGTH: usize = 32;
pub const MAX_VAULT_DESCRIPTION_LENGTH: usize = 256;
pub const MAX_BPS: u16 = 10_000;
pub const MAX_PENALTY_BPS: u16 = 5_000; // 50% max penalty

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum VaultType {
    Personal,
    Community,
}

impl Default for VaultType {
    fn default() -> Self {
        VaultType::Personal
    }
}

/// A vault holds a single token type with withdrawal limits.
/// Limits can be fixed amounts (lamports) or percentage-based (bps of balance).
/// Personal vaults: single member, mutable rules.
/// Community vaults: multiple members, immutable rules, penalty redistribution.
#[account]
#[derive(Default)]
pub struct Vault {
    pub creator: Pubkey,
    pub vault_type: VaultType,
    /// SPL token mint. Pubkey::default() means native SOL vault.
    pub token_mint: Pubkey,
    pub name: String,
    pub description: String,
    /// Daily withdrawal limit. Interpretation depends on `limits_are_percentage`.
    /// Fixed mode: amount in lamports/smallest-unit. Percentage mode: basis points (e.g. 500 = 5%).
    pub daily_limit: u64,
    /// Weekly withdrawal limit (same interpretation as daily_limit).
    pub weekly_limit: u64,
    /// Monthly withdrawal limit (same interpretation as daily_limit).
    pub monthly_limit: u64,
    /// When true, daily/weekly/monthly_limit are basis points of member balance.
    /// When false, they are fixed amounts in lamports/smallest-unit.
    pub limits_are_percentage: bool,
    /// Penalty rate for instant withdrawals beyond limits (always basis points)
    pub penalty_rate_bps: u16,
    /// Creator-chosen nonce to allow multiple vaults per creator
    pub vault_nonce: u64,
    pub member_count: u32,
    /// Sum of all member balances (excluding penalty pool)
    pub total_balance: u64,
    /// Accumulated penalty per share, scaled by PRECISION (reward-per-share pattern)
    pub accumulated_penalty_per_share: u128,
    pub is_active: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl Vault {
    pub const INIT_SPACE: usize = 8  // discriminator
        + 32  // creator
        + 1   // vault_type
        + 32  // token_mint
        + (4 + MAX_VAULT_NAME_LENGTH)        // name
        + (4 + MAX_VAULT_DESCRIPTION_LENGTH)  // description
        + 8   // daily_limit
        + 8   // weekly_limit
        + 8   // monthly_limit
        + 1   // limits_are_percentage
        + 2   // penalty_rate_bps
        + 8   // vault_nonce
        + 4   // member_count
        + 8   // total_balance
        + 16  // accumulated_penalty_per_share
        + 1   // is_active
        + 8   // created_at
        + 8   // updated_at
        + 1;  // bump

    pub fn is_sol_vault(&self) -> bool {
        self.token_mint == Pubkey::default()
    }

    /// Calculate the effective limit for a given member balance.
    /// In percentage mode: balance * limit_value / 10000.
    /// In fixed mode: returns the limit directly.
    pub fn effective_limit(&self, limit_value: u64, balance: u64) -> u64 {
        if limit_value == 0 {
            return 0;
        }
        if self.limits_are_percentage {
            if balance == 0 { return 0; }
            ((balance as u128) * (limit_value as u128) / (MAX_BPS as u128)) as u64
        } else {
            limit_value
        }
    }

    /// Record penalty into the reward-per-share accumulator.
    /// Only meaningful for community vaults where total_balance > 0.
    pub fn record_penalty(&mut self, penalty_amount: u64) {
        if self.total_balance > 0 {
            self.accumulated_penalty_per_share = self.accumulated_penalty_per_share
                .checked_add(
                    (penalty_amount as u128)
                        .checked_mul(PRECISION)
                        .unwrap_or(0)
                        / (self.total_balance as u128)
                )
                .unwrap_or(self.accumulated_penalty_per_share);
        }
    }
}

/// Per-member state within a vault.
#[account]
#[derive(Default)]
pub struct VaultMember {
    pub vault: Pubkey,
    pub member: Pubkey,
    pub balance: u64,
    pub daily_spent: u64,
    pub daily_last_reset: i64,
    pub weekly_spent: u64,
    pub weekly_last_reset: i64,
    pub monthly_spent: u64,
    pub monthly_last_reset: i64,
    /// Reward-per-share debt for penalty redistribution
    pub penalty_debt: u128,
    /// Accumulated but unclaimed penalty rewards
    pub unclaimed_penalties: u64,
    pub joined_at: i64,
    pub bump: u8,
}

impl VaultMember {
    pub const INIT_SPACE: usize = 8  // discriminator
        + 32  // vault
        + 32  // member
        + 8   // balance
        + 8   // daily_spent
        + 8   // daily_last_reset
        + 8   // weekly_spent
        + 8   // weekly_last_reset
        + 8   // monthly_spent
        + 8   // monthly_last_reset
        + 16  // penalty_debt
        + 8   // unclaimed_penalties
        + 8   // joined_at
        + 1;  // bump

    pub const DAILY_DURATION: i64 = 86_400;
    pub const WEEKLY_DURATION: i64 = 604_800;
    pub const MONTHLY_DURATION: i64 = 2_592_000;

    /// Settle pending penalty rewards based on current accumulator.
    pub fn settle_penalties(&mut self, accumulated: u128) {
        let pending = (self.balance as u128)
            .checked_mul(accumulated)
            .unwrap_or(0)
            / PRECISION;
        let debt = self.penalty_debt.min(pending);
        let reward = ((pending - debt) as u64).min(u64::MAX);
        self.unclaimed_penalties = self.unclaimed_penalties.saturating_add(reward);
        self.penalty_debt = (self.balance as u128)
            .checked_mul(accumulated)
            .unwrap_or(0)
            / PRECISION;
    }

    /// Snapshot debt after a balance change.
    pub fn snapshot_debt(&mut self, accumulated: u128) {
        self.penalty_debt = (self.balance as u128)
            .checked_mul(accumulated)
            .unwrap_or(0)
            / PRECISION;
    }

    /// Reset period if expired, then check if withdrawal fits within limit.
    pub fn check_and_update_limits(
        &mut self,
        amount: u64,
        balance: u64,
        vault: &Vault,
        current_time: i64,
    ) -> Result<()> {
        // Daily
        if vault.daily_limit > 0 {
            if current_time >= self.daily_last_reset + Self::DAILY_DURATION {
                self.daily_spent = 0;
                self.daily_last_reset = current_time;
            }
            let max = vault.effective_limit(vault.daily_limit, balance);
            require!(
                self.daily_spent.checked_add(amount).unwrap_or(u64::MAX) <= max,
                crate::error::ErrorCode::SpendingLimitExceeded
            );
        }

        // Weekly
        if vault.weekly_limit > 0 {
            if current_time >= self.weekly_last_reset + Self::WEEKLY_DURATION {
                self.weekly_spent = 0;
                self.weekly_last_reset = current_time;
            }
            let max = vault.effective_limit(vault.weekly_limit, balance);
            require!(
                self.weekly_spent.checked_add(amount).unwrap_or(u64::MAX) <= max,
                crate::error::ErrorCode::SpendingLimitExceeded
            );
        }

        // Monthly
        if vault.monthly_limit > 0 {
            if current_time >= self.monthly_last_reset + Self::MONTHLY_DURATION {
                self.monthly_spent = 0;
                self.monthly_last_reset = current_time;
            }
            let max = vault.effective_limit(vault.monthly_limit, balance);
            require!(
                self.monthly_spent.checked_add(amount).unwrap_or(u64::MAX) <= max,
                crate::error::ErrorCode::SpendingLimitExceeded
            );
        }

        // All checks passed — update spent counters
        if vault.daily_limit > 0 {
            self.daily_spent = self.daily_spent.saturating_add(amount);
        }
        if vault.weekly_limit > 0 {
            self.weekly_spent = self.weekly_spent.saturating_add(amount);
        }
        if vault.monthly_limit > 0 {
            self.monthly_spent = self.monthly_spent.saturating_add(amount);
        }

        Ok(())
    }
}

/// An approved withdrawal destination for a vault member.
/// PDA seeds: ["withdrawal_dest", vault, member, destination]
#[account]
#[derive(Default)]
pub struct WithdrawalDestination {
    pub vault: Pubkey,
    pub member: Pubkey,
    pub destination: Pubkey,
    pub title: String,
    pub added_at: i64,
    pub bump: u8,
}

impl WithdrawalDestination {
    pub const MAX_TITLE_LENGTH: usize = 64;
    pub const INIT_SPACE: usize = 8  // discriminator
        + 32  // vault
        + 32  // member
        + 32  // destination
        + (4 + Self::MAX_TITLE_LENGTH)  // title
        + 8   // added_at
        + 1;  // bump
}

/// A pending request to add a withdrawal destination (timelock).
/// PDA seeds: ["pending_dest", vault, member, destination]
#[account]
#[derive(Default)]
pub struct PendingDestinationRequest {
    pub vault: Pubkey,
    pub member: Pubkey,
    pub destination: Pubkey,
    pub title: String,
    pub execute_after: i64,
    pub created_at: i64,
    pub bump: u8,
}

impl PendingDestinationRequest {
    pub const INIT_SPACE: usize = 8  // discriminator
        + 32  // vault
        + 32  // member
        + 32  // destination
        + (4 + WithdrawalDestination::MAX_TITLE_LENGTH)  // title
        + 8   // execute_after
        + 8   // created_at
        + 1;  // bump
}

/// A pending proposal to change vault rules (timelock).
/// Only one active per vault. PDA seeds: ["rule_proposal", vault]
#[account]
#[derive(Default)]
pub struct RuleChangeProposal {
    pub vault: Pubkey,
    pub proposer: Pubkey,
    pub new_daily_limit: Option<u64>,
    pub new_weekly_limit: Option<u64>,
    pub new_monthly_limit: Option<u64>,
    pub new_limits_are_percentage: Option<bool>,
    pub new_penalty_rate_bps: Option<u16>,
    pub execute_after: i64,
    pub created_at: i64,
    pub bump: u8,
}

impl RuleChangeProposal {
    pub const INIT_SPACE: usize = 8  // discriminator
        + 32  // vault
        + 32  // proposer
        + 9   // new_daily_limit (Option<u64>)
        + 9   // new_weekly_limit
        + 9   // new_monthly_limit
        + 2   // new_limits_are_percentage (Option<bool>)
        + 3   // new_penalty_rate_bps (Option<u16>)
        + 8   // execute_after
        + 8   // created_at
        + 1;  // bump
}

/// A bypass request to withdraw above limits after a timelock.
/// One active per vault+member. PDA seeds: ["bypass_request", vault, member]
#[account]
#[derive(Default)]
pub struct BypassRequest {
    pub vault: Pubkey,
    pub member: Pubkey,
    pub amount: u64,
    pub is_sol: bool,
    pub token_mint: Pubkey,
    pub execute_after: i64,
    pub created_at: i64,
    pub bump: u8,
}

impl BypassRequest {
    pub const INIT_SPACE: usize = 8  // discriminator
        + 32  // vault
        + 32  // member
        + 8   // amount
        + 1   // is_sol
        + 32  // token_mint
        + 8   // execute_after
        + 8   // created_at
        + 1;  // bump
}

/// Global program configuration.
#[account]
#[derive(Default)]
pub struct ProgramConfig {
    pub treasury_address: Pubkey,
    pub default_penalty_rate_bps: u16,
    pub admin: Pubkey,
    pub bump: u8,
    pub created_at: i64,
    pub updated_at: i64,
}

impl ProgramConfig {
    pub const INIT_SPACE: usize = 8  // discriminator
        + 32  // treasury_address
        + 2   // default_penalty_rate_bps
        + 32  // admin
        + 1   // bump
        + 8   // created_at
        + 8;  // updated_at
}
