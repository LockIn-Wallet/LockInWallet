use anchor_lang::prelude::*;

declare_id!("9j511uJuYwoFRFiU1h5wy2oi1Xc8n1FdoK91QxoXHRh2");

pub mod state;
pub mod instructions;
pub mod error;
pub mod constants;

pub use state::*;
pub use instructions::*;

#[program]
pub mod savings_core {
    use super::*;

    // ========== PROGRAM CONFIG ==========

    pub fn initialize_program_config(
        ctx: Context<InitializeProgramConfig>,
        default_penalty_rate_bps: u16,
    ) -> Result<()> {
        instructions::initialize_program_config(ctx, default_penalty_rate_bps)
    }

    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        new_treasury: Option<Pubkey>,
        new_penalty_rate_bps: Option<u16>,
    ) -> Result<()> {
        instructions::update_program_config(ctx, new_treasury, new_penalty_rate_bps)
    }

    // ========== VAULT CREATION ==========

    pub fn create_vault(
        ctx: Context<CreateVault>,
        name: String,
        vault_nonce: u64,
        description: String,
        vault_type: VaultType,
        daily_limit: u64,
        weekly_limit: u64,
        monthly_limit: u64,
        penalty_rate_bps: u16,
        limits_are_percentage: bool,
    ) -> Result<()> {
        instructions::create_vault(
            ctx, name, vault_nonce, description, vault_type,
            daily_limit, weekly_limit, monthly_limit,
            penalty_rate_bps, limits_are_percentage,
        )
    }

    pub fn create_spl_vault(
        ctx: Context<CreateSplVault>,
        name: String,
        vault_nonce: u64,
        description: String,
        vault_type: VaultType,
        daily_limit: u64,
        weekly_limit: u64,
        monthly_limit: u64,
        penalty_rate_bps: u16,
        limits_are_percentage: bool,
    ) -> Result<()> {
        instructions::create_spl_vault(
            ctx, name, vault_nonce, description, vault_type,
            daily_limit, weekly_limit, monthly_limit,
            penalty_rate_bps, limits_are_percentage,
        )
    }

    // ========== MEMBERSHIP ==========

    pub fn join_vault(ctx: Context<JoinVault>) -> Result<()> {
        instructions::join_vault(ctx)
    }

    pub fn leave_vault(ctx: Context<LeaveVault>) -> Result<()> {
        instructions::leave_vault(ctx)
    }

    // ========== DEPOSITS ==========

    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        instructions::deposit_sol(ctx, amount)
    }

    pub fn deposit_spl(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
        instructions::deposit_spl(ctx, amount)
    }

    // ========== WITHDRAWALS (within limits) ==========

    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        instructions::withdraw_sol(ctx, amount)
    }

    pub fn withdraw_spl(ctx: Context<WithdrawSpl>, amount: u64) -> Result<()> {
        instructions::withdraw_spl(ctx, amount)
    }

    // ========== PENALTY WITHDRAWALS (bypass limits) ==========

    pub fn withdraw_sol_with_penalty(ctx: Context<WithdrawSolWithPenalty>, amount: u64) -> Result<()> {
        instructions::withdraw_sol_with_penalty(ctx, amount)
    }

    pub fn withdraw_spl_with_penalty(ctx: Context<WithdrawSplWithPenalty>, amount: u64) -> Result<()> {
        instructions::withdraw_spl_with_penalty(ctx, amount)
    }

    // ========== PENALTY REWARDS ==========

    pub fn claim_penalty_rewards(ctx: Context<ClaimPenaltyRewards>) -> Result<()> {
        instructions::claim_penalty_rewards(ctx)
    }

    pub fn claim_spl_penalty_rewards(ctx: Context<ClaimSplPenaltyRewards>) -> Result<()> {
        instructions::claim_spl_penalty_rewards(ctx)
    }

    // ========== VAULT MANAGEMENT ==========

    pub fn update_vault_rules(
        ctx: Context<UpdateVaultRules>,
        daily_limit: Option<u64>,
        weekly_limit: Option<u64>,
        monthly_limit: Option<u64>,
        penalty_rate_bps: Option<u16>,
        limits_are_percentage: Option<bool>,
    ) -> Result<()> {
        instructions::update_vault_rules(ctx, daily_limit, weekly_limit, monthly_limit, penalty_rate_bps, limits_are_percentage)
    }

    // ========== WITHDRAWAL DESTINATIONS ==========

    pub fn add_withdrawal_destination(
        ctx: Context<AddWithdrawalDestination>,
        title: String,
    ) -> Result<()> {
        instructions::add_withdrawal_destination(ctx, title)
    }

    pub fn request_withdrawal_destination(
        ctx: Context<RequestWithdrawalDestination>,
        title: String,
    ) -> Result<()> {
        instructions::request_withdrawal_destination(ctx, title)
    }

    pub fn execute_destination_request(ctx: Context<ExecuteDestinationRequest>) -> Result<()> {
        instructions::execute_destination_request(ctx)
    }

    pub fn cancel_destination_request(ctx: Context<CancelDestinationRequest>) -> Result<()> {
        instructions::cancel_destination_request(ctx)
    }

    pub fn remove_withdrawal_destination(ctx: Context<RemoveWithdrawalDestination>) -> Result<()> {
        instructions::remove_withdrawal_destination(ctx)
    }

    // ========== RULE CHANGE PROPOSALS ==========

    pub fn propose_rule_change(
        ctx: Context<ProposeRuleChange>,
        new_daily_limit: Option<u64>,
        new_weekly_limit: Option<u64>,
        new_monthly_limit: Option<u64>,
        new_penalty_rate_bps: Option<u16>,
        new_limits_are_percentage: Option<bool>,
    ) -> Result<()> {
        instructions::propose_rule_change(ctx, new_daily_limit, new_weekly_limit, new_monthly_limit, new_penalty_rate_bps, new_limits_are_percentage)
    }

    pub fn execute_rule_change(ctx: Context<ExecuteRuleChange>) -> Result<()> {
        instructions::execute_rule_change(ctx)
    }

    pub fn cancel_rule_change(ctx: Context<CancelRuleChange>) -> Result<()> {
        instructions::cancel_rule_change(ctx)
    }

    // ========== BYPASS REQUESTS ==========

    pub fn request_bypass(
        ctx: Context<RequestBypass>,
        amount: u64,
        is_sol: bool,
    ) -> Result<()> {
        instructions::request_bypass(ctx, amount, is_sol)
    }

    pub fn execute_bypass_sol(ctx: Context<ExecuteBypassSol>) -> Result<()> {
        instructions::execute_bypass_sol(ctx)
    }

    pub fn execute_bypass_spl(ctx: Context<ExecuteBypassSpl>) -> Result<()> {
        instructions::execute_bypass_spl(ctx)
    }

    pub fn cancel_bypass(ctx: Context<CancelBypass>) -> Result<()> {
        instructions::cancel_bypass(ctx)
    }
}
