use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

// This will be updated during deployment
declare_id!("EyfA57i8PgyJBDmyLYFmdYMjPonZcY7BbnH98UmP8Rqp");

pub mod state;
pub mod instructions;
pub mod error;

pub use state::*;
pub use instructions::*;
pub use error::*;

#[program]
pub mod deposit_proxy {
    use super::*;

    /// Initialize a deposit proxy for a user
    pub fn initialize_proxy(ctx: Context<InitializeProxy>) -> Result<()> {
        instructions::initialize_proxy(ctx)
    }

    /// Forward SOL deposit to savings program
    pub fn forward_sol_deposit(ctx: Context<ForwardSolDeposit>, amount: u64) -> Result<()> {
        instructions::forward_sol_deposit(ctx, amount)
    }

    /// Forward SPL token deposit to savings program
    pub fn forward_spl_deposit(ctx: Context<ForwardSplDeposit>, amount: u64) -> Result<()> {
        instructions::forward_spl_deposit(ctx, amount)
    }

    /// Get the proxy address for a user (view function)
    pub fn get_proxy_address(ctx: Context<GetProxyAddress>) -> Result<Pubkey> {
        Ok(ctx.accounts.deposit_proxy.key())
    }
}