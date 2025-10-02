use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::*;
use crate::error::ErrorCode;

/// Initialize a new savings account for a user
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + SavingsAccount::INIT_SPACE,
        seeds = [b"savings", user.key().as_ref()],
        bump
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Deposit SOL to the savings account
#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + SavingsAccount::INIT_SPACE,
        seeds = [b"savings", user.key().as_ref()],
        bump
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Deposit SPL tokens to the savings account
#[derive(Accounts)]
pub struct DepositSpl<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + SavingsAccount::INIT_SPACE,
        seeds = [b"savings", user.key().as_ref()],
        bump
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// User's token account that holds the tokens to deposit
    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == mint.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// The savings account's token account for this mint
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = savings_account,
    )]
    pub savings_token_account: Account<'info, TokenAccount>,

    /// The mint of the SPL token being deposited
    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Get balance account context
#[derive(Accounts)]
pub struct GetBalance<'info> {
    #[account(
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    pub user: Signer<'info>,
}

/// Initialize savings account instruction
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let user = &ctx.accounts.user;
    let clock = Clock::get()?;

    savings_account.owner = user.key();
    savings_account.sol_balance = 0;
    savings_account.spl_balances = Vec::new();
    savings_account.bump = ctx.bumps.savings_account;
    savings_account.created_at = clock.unix_timestamp;
    savings_account.updated_at = clock.unix_timestamp;

    msg!("Savings account initialized for user: {}", user.key());

    Ok(())
}

/// Deposit SOL instruction
pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let savings_account = &mut ctx.accounts.savings_account;
    let user = &ctx.accounts.user;
    let clock = Clock::get()?;

    // Initialize account if this is the first deposit
    if savings_account.owner == Pubkey::default() {
        savings_account.owner = user.key();
        savings_account.sol_balance = 0;
        savings_account.spl_balances = Vec::new();
        savings_account.bump = ctx.bumps.savings_account;
        savings_account.created_at = clock.unix_timestamp;
    }

    // Transfer SOL from user to savings account
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: user.to_account_info(),
            to: savings_account.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, amount)?;

    // Update SOL balance
    savings_account.sol_balance = savings_account
        .sol_balance
        .checked_add(amount)
        .ok_or(crate::error::ErrorCode::ArithmeticOverflow)?;

    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Deposited {} lamports to savings account. New balance: {}",
        amount,
        savings_account.sol_balance
    );

    Ok(())
}

/// Deposit SPL tokens instruction
pub fn deposit_spl(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let savings_account = &mut ctx.accounts.savings_account;
    let user = &ctx.accounts.user;
    let mint = &ctx.accounts.mint;
    let clock = Clock::get()?;

    // Initialize account if this is the first deposit
    if savings_account.owner == Pubkey::default() {
        savings_account.owner = user.key();
        savings_account.sol_balance = 0;
        savings_account.spl_balances = Vec::new();
        savings_account.bump = ctx.bumps.savings_account;
        savings_account.created_at = clock.unix_timestamp;
    }

    // Transfer SPL tokens from user to savings account
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.savings_token_account.to_account_info(),
        authority: user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Update token balance in savings account
    savings_account.update_token_balance(mint.key(), amount)?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Deposited {} tokens of mint {} to savings account",
        amount,
        mint.key()
    );

    Ok(())
}

/// Withdraw SOL from the savings account
#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(
        mut,
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump,
        constraint = savings_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Withdraw SPL tokens from the savings account
#[derive(Accounts)]
pub struct WithdrawSpl<'info> {
    #[account(
        mut,
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump,
        constraint = savings_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// User's token account to receive the withdrawn tokens
    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == mint.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// The savings account's token account for this mint
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = savings_account,
    )]
    pub savings_token_account: Account<'info, TokenAccount>,

    /// The mint of the SPL token being withdrawn
    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

/// Withdraw SOL instruction
pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let savings_account = &mut ctx.accounts.savings_account;
    let user = &ctx.accounts.user;

    // Check if user has sufficient balance
    require!(
        savings_account.sol_balance >= amount,
        ErrorCode::InsufficientBalance
    );

    // Calculate rent-exempt minimum
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(8 + SavingsAccount::INIT_SPACE);
    let account_balance = savings_account.to_account_info().lamports();

    // Ensure we don't withdraw below rent-exempt minimum
    require!(
        account_balance.saturating_sub(amount) >= min_balance,
        ErrorCode::InsufficientBalance
    );

    // Transfer SOL from savings account to user
    **savings_account.to_account_info().try_borrow_mut_lamports()? -= amount;
    **user.to_account_info().try_borrow_mut_lamports()? += amount;

    // Update SOL balance
    savings_account.sol_balance = savings_account
        .sol_balance
        .checked_sub(amount)
        .ok_or(crate::error::ErrorCode::ArithmeticOverflow)?;

    let clock = Clock::get()?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Withdrew {} lamports from savings account. Remaining balance: {}",
        amount,
        savings_account.sol_balance
    );

    Ok(())
}

/// Withdraw SPL tokens instruction
pub fn withdraw_spl(ctx: Context<WithdrawSpl>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let savings_account = &mut ctx.accounts.savings_account;
    let mint = &ctx.accounts.mint;

    // Check if user has sufficient token balance
    let current_balance = savings_account.get_token_balance(mint.key());
    require!(current_balance >= amount, ErrorCode::InsufficientBalance);

    // Create seeds for signing
    let user_key = savings_account.owner;
    let seeds = &[b"savings", user_key.as_ref(), &[savings_account.bump]];
    let signer = &[&seeds[..]];

    // Transfer SPL tokens from savings account to user
    let cpi_accounts = Transfer {
        from: ctx.accounts.savings_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: savings_account.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;

    // Update token balance in savings account
    for token_balance in &mut savings_account.spl_balances {
        if token_balance.mint == mint.key() {
            token_balance.amount = token_balance
                .amount
                .checked_sub(amount)
                .ok_or(crate::error::ErrorCode::ArithmeticOverflow)?;
            break;
        }
    }

    let clock = Clock::get()?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Withdrew {} tokens of mint {} from savings account",
        amount,
        mint.key()
    );

    Ok(())
}