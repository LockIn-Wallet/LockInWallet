use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

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

    /// Deposit SOL to the savings account
    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        instructions::deposit_sol(ctx, amount)
    }

    /// Deposit SPL tokens to the savings account
    pub fn deposit_spl(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
        instructions::deposit_spl(ctx, amount)
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
}