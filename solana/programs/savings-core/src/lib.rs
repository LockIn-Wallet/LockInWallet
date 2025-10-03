use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("HNi2JKTNeHvz2ENckdVBW1ncfkJUYppuYeBwNhWjkK7d");

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
}