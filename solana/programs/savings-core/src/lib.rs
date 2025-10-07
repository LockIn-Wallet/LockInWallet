use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("b7DwCc8gcNd5hfUit1ezJXGXxd2pjga6BTz2vB6e62y");

pub mod state;
pub mod instructions;
pub mod error;

pub use state::*;
pub use instructions::*;
pub use error::*;

#[program]
pub mod savings_core {
    use super::*;

    /// Initialize a savings account for a user
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize(ctx)
    }

    /// Deposit SOL to the savings account (supports CPI)
    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        instructions::deposit_sol(ctx, amount)
    }

    /// Deposit SPL tokens to the savings account (supports CPI)
    pub fn deposit_spl(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
        instructions::deposit_spl(ctx, amount)
    }

    /// Deposit SOL for self (backward compatibility)
    pub fn deposit_sol_self(ctx: Context<DepositSolSelf>, amount: u64) -> Result<()> {
        instructions::deposit_sol_self(ctx, amount)
    }

    /// Deposit SPL tokens for self (backward compatibility)
    pub fn deposit_spl_self(ctx: Context<DepositSplSelf>, amount: u64) -> Result<()> {
        instructions::deposit_spl_self(ctx, amount)
    }

    /// Withdraw SOL from the savings account
    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        instructions::withdraw_sol(ctx, amount)
    }

    /// Withdraw SPL tokens from the savings account
    pub fn withdraw_spl(ctx: Context<WithdrawSpl>, amount: u64) -> Result<()> {
        instructions::withdraw_spl(ctx, amount)
    }

    /// Get user's total SOL balance
    pub fn get_sol_balance(ctx: Context<GetBalance>) -> Result<u64> {
        Ok(ctx.accounts.savings_account.sol_balance)
    }

    /// Get user's SPL token balance for a specific mint
    pub fn get_spl_balance(ctx: Context<GetBalance>, mint: Pubkey) -> Result<u64> {
        let savings_account = &ctx.accounts.savings_account;

        for token_balance in &savings_account.spl_balances {
            if token_balance.mint == mint {
                return Ok(token_balance.amount);
            }
        }

        Ok(0) // Return 0 if token not found
    }

    // ========== SPENDING LIMITS INSTRUCTIONS ==========

    /// Initialize a spending limits account for a user
    pub fn initialize_spending_limits(ctx: Context<InitializeSpendingLimits>) -> Result<()> {
        instructions::initialize_spending_limits(ctx)
    }

    /// Add or update a time period limit
    pub fn add_time_period_limit(
        ctx: Context<AddTimePeriodLimit>,
        name: String,
        limit: u64,
        duration: u64,
    ) -> Result<()> {
        instructions::add_time_period_limit(ctx, name, limit, duration)
    }

    /// Remove a time period limit
    pub fn remove_time_period_limit(
        ctx: Context<RemoveTimePeriodLimit>,
        name: String,
    ) -> Result<()> {
        instructions::remove_time_period_limit(ctx, name)
    }

    /// Set common period limits (Daily, Weekly, Monthly)
    pub fn set_common_period_limits(
        ctx: Context<SetCommonPeriodLimits>,
        daily_limit: Option<u64>,
        weekly_limit: Option<u64>,
        monthly_limit: Option<u64>,
    ) -> Result<()> {
        instructions::set_common_period_limits(ctx, daily_limit, weekly_limit, monthly_limit)
    }

    /// Commit initial setup
    pub fn commit_initial_setup(ctx: Context<CommitInitialSetup>) -> Result<()> {
        instructions::commit_initial_setup(ctx)
    }

    /// Get spending limits information
    pub fn get_spending_limits(ctx: Context<GetSpendingLimits>) -> Result<()> {
        instructions::get_spending_limits(ctx)
    }

    /// Withdraw SOL with spending limits validation
    pub fn withdraw_sol_with_limits(ctx: Context<WithdrawSolWithLimits>, amount: u64) -> Result<()> {
        instructions::withdraw_sol_with_limits(ctx, amount)
    }

    /// Withdraw SPL tokens with spending limits validation
    pub fn withdraw_spl_with_limits(ctx: Context<WithdrawSplWithLimits>, amount: u64) -> Result<()> {
        instructions::withdraw_spl_with_limits(ctx, amount)
    }

    // ========== PROPOSAL MANAGEMENT INSTRUCTIONS ==========

    /// Propose a spending limit change
    pub fn propose_limit_change(
        ctx: Context<ProposeLimitChange>,
        period_name: String,
        new_limit: u64,
    ) -> Result<()> {
        instructions::propose_limit_change(ctx, period_name, new_limit)
    }

    /// Execute a pending proposal
    pub fn execute_limit_proposal(
        ctx: Context<ExecuteLimitProposal>,
        proposal_id: [u8; 32],
    ) -> Result<()> {
        instructions::execute_limit_proposal(ctx, proposal_id)
    }

    /// Cancel a pending proposal
    pub fn cancel_limit_proposal(
        ctx: Context<CancelLimitProposal>,
        proposal_id: [u8; 32],
    ) -> Result<()> {
        instructions::cancel_limit_proposal(ctx, proposal_id)
    }

    // ========== WITHDRAWAL DESTINATION INSTRUCTIONS ==========

    /// Add a withdrawal destination
    pub fn add_withdrawal_destination(
        ctx: Context<AddWithdrawalDestination>,
        address: Pubkey,
        title: String,
    ) -> Result<()> {
        instructions::add_withdrawal_destination(ctx, address, title)
    }

    /// Remove a withdrawal destination
    pub fn remove_withdrawal_destination(
        ctx: Context<RemoveWithdrawalDestination>,
        address: Pubkey,
    ) -> Result<()> {
        instructions::remove_withdrawal_destination(ctx, address)
    }

    /// Request withdrawal destination addition (with timelock)
    pub fn request_withdrawal_destination_addition(
        ctx: Context<RequestWithdrawalDestinationAddition>,
        address: Pubkey,
        title: String,
    ) -> Result<()> {
        instructions::request_withdrawal_destination_addition(ctx, address, title)
    }

    /// Execute a pending withdrawal destination request
    pub fn execute_withdrawal_destination_request(
        ctx: Context<ExecuteWithdrawalDestinationRequest>,
        request_id: [u8; 32],
    ) -> Result<()> {
        instructions::execute_withdrawal_destination_request(ctx, request_id)
    }

    /// Cancel a pending withdrawal destination request
    pub fn cancel_withdrawal_destination_request(
        ctx: Context<CancelWithdrawalDestinationRequest>,
        request_id: [u8; 32],
    ) -> Result<()> {
        instructions::cancel_withdrawal_destination_request(ctx, request_id)
    }

    /// Withdraw SOL to destination
    pub fn withdraw_sol_to_destination(
        ctx: Context<WithdrawToDestination>,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_sol_to_destination(ctx, amount)
    }

    /// Withdraw SPL tokens to destination
    pub fn withdraw_spl_to_destination(
        ctx: Context<WithdrawSplToDestination>,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_spl_to_destination(ctx, amount)
    }

    // ========== WITHDRAWAL BYPASS INSTRUCTIONS ==========

    /// Request withdrawal bypass for amounts exceeding spending limits
    pub fn request_withdrawal_bypass(
        ctx: Context<RequestWithdrawalBypass>,
        amount: u64,
        token_mint: Pubkey,
        bypassing_period: String,
        destination: Pubkey,
    ) -> Result<()> {
        instructions::request_withdrawal_bypass(ctx, amount, token_mint, bypassing_period, destination)
    }

    /// Execute withdrawal bypass (SOL)
    pub fn execute_withdrawal_bypass(
        ctx: Context<ExecuteWithdrawalBypass>,
        request_id: [u8; 32],
    ) -> Result<()> {
        instructions::execute_withdrawal_bypass(ctx, request_id)
    }

    /// Execute SPL withdrawal bypass
    pub fn execute_spl_withdrawal_bypass(
        ctx: Context<ExecuteSplWithdrawalBypass>,
        request_id: [u8; 32],
    ) -> Result<()> {
        instructions::execute_spl_withdrawal_bypass(ctx, request_id)
    }

    /// Cancel withdrawal bypass request
    pub fn cancel_withdrawal_bypass(
        ctx: Context<CancelWithdrawalBypass>,
        request_id: [u8; 32],
    ) -> Result<()> {
        instructions::cancel_withdrawal_bypass(ctx, request_id)
    }
}