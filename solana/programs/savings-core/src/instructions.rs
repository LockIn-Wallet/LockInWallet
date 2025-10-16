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
        payer = payer,
        space = 8 + SavingsAccount::INIT_SPACE,
        seeds = [b"savings", beneficiary.key().as_ref()],
        bump
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    /// The beneficiary whose savings account will be credited
    /// CHECK: This account is used for PDA derivation and balance credit
    pub beneficiary: UncheckedAccount<'info>,

    /// The payer for account creation and transaction fees
    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Deposit SPL tokens to the savings account
#[derive(Accounts)]
pub struct DepositSpl<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + SavingsAccount::INIT_SPACE,
        seeds = [b"savings", beneficiary.key().as_ref()],
        bump
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    /// The beneficiary whose savings account will be credited
    /// CHECK: This account is used for PDA derivation and balance credit
    pub beneficiary: UncheckedAccount<'info>,

    /// The payer for account creation and transaction fees
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Source token account that holds the tokens to deposit
    #[account(
        mut,
        constraint = source_token_account.mint == mint.key()
    )]
    pub source_token_account: Account<'info, TokenAccount>,

    /// The savings account's token account for this mint
    #[account(
        init_if_needed,
        payer = payer,
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

/// Deposit SOL for self (backward compatibility)
#[derive(Accounts)]
pub struct DepositSolSelf<'info> {
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

/// Deposit SPL tokens for self (backward compatibility)
#[derive(Accounts)]
pub struct DepositSplSelf<'info> {
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
    let beneficiary = &ctx.accounts.beneficiary;
    let payer = &ctx.accounts.payer;
    let clock = Clock::get()?;

    // Initialize account if this is the first deposit
    if savings_account.owner == Pubkey::default() {
        savings_account.owner = beneficiary.key();
        savings_account.sol_balance = 0;
        savings_account.spl_balances = Vec::new();
        savings_account.bump = ctx.bumps.savings_account;
        savings_account.created_at = clock.unix_timestamp;
        savings_account.withdrawal_destinations = Vec::new();
        savings_account.pending_withdrawal_destination_requests = Vec::new();
        savings_account.pending_bypass_requests = Vec::new();
        savings_account.permanent_address_activated = false;
        savings_account.activation_payment_signature = Vec::new();
        savings_account.activated_at = 0;
    }

    // Check if permanent address is activated for deposits
    require!(
        savings_account.permanent_address_activated,
        ErrorCode::PermanentAddressNotActivated
    );

    // Transfer SOL from payer to savings account
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: payer.to_account_info(),
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
        "Deposited {} lamports to savings account for {}. New balance: {}",
        amount,
        beneficiary.key(),
        savings_account.sol_balance
    );

    Ok(())
}

/// Deposit SPL tokens instruction
pub fn deposit_spl(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let savings_account = &mut ctx.accounts.savings_account;
    let beneficiary = &ctx.accounts.beneficiary;
    let mint = &ctx.accounts.mint;
    let clock = Clock::get()?;

    // Initialize account if this is the first deposit
    if savings_account.owner == Pubkey::default() {
        savings_account.owner = beneficiary.key();
        savings_account.sol_balance = 0;
        savings_account.spl_balances = Vec::new();
        savings_account.bump = ctx.bumps.savings_account;
        savings_account.created_at = clock.unix_timestamp;
        savings_account.withdrawal_destinations = Vec::new();
        savings_account.pending_withdrawal_destination_requests = Vec::new();
        savings_account.pending_bypass_requests = Vec::new();
        savings_account.permanent_address_activated = false;
        savings_account.activation_payment_signature = Vec::new();
        savings_account.activated_at = 0;
    }

    // Check if permanent address is activated for deposits
    require!(
        savings_account.permanent_address_activated,
        ErrorCode::PermanentAddressNotActivated
    );

    // Transfer SPL tokens from source to savings account
    // The authority must be whoever owns the source_token_account
    let cpi_accounts = Transfer {
        from: ctx.accounts.source_token_account.to_account_info(),
        to: ctx.accounts.savings_token_account.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Update token balance in savings account
    savings_account.update_token_balance(mint.key(), amount)?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Deposited {} tokens of mint {} to savings account for {}",
        amount,
        mint.key(),
        beneficiary.key()
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

/// Withdraw SOL instruction with optional spending limits validation
pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let savings_account = &mut ctx.accounts.savings_account;
    let user = &ctx.accounts.user;

    // Check if permanent address is activated for withdrawals
    require!(
        savings_account.permanent_address_activated,
        ErrorCode::PermanentAddressNotActivated
    );

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

    // TODO: Add spending limits validation here when spending limits account is passed
    // This maintains backward compatibility with existing withdrawals

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

    // Check if permanent address is activated for withdrawals
    require!(
        savings_account.permanent_address_activated,
        ErrorCode::PermanentAddressNotActivated
    );

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

/// Deposit SOL for self (backward compatibility)
pub fn deposit_sol_self(ctx: Context<DepositSolSelf>, amount: u64) -> Result<()> {
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
        savings_account.withdrawal_destinations = Vec::new();
        savings_account.pending_withdrawal_destination_requests = Vec::new();
        savings_account.pending_bypass_requests = Vec::new();
        savings_account.permanent_address_activated = false;
        savings_account.activation_payment_signature = Vec::new();
        savings_account.activated_at = 0;
    }

    // Check if permanent address is activated for deposits
    require!(
        savings_account.permanent_address_activated,
        ErrorCode::PermanentAddressNotActivated
    );

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

/// Deposit SPL tokens for self (backward compatibility)
pub fn deposit_spl_self(ctx: Context<DepositSplSelf>, amount: u64) -> Result<()> {
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
        savings_account.withdrawal_destinations = Vec::new();
        savings_account.pending_withdrawal_destination_requests = Vec::new();
        savings_account.pending_bypass_requests = Vec::new();
        savings_account.permanent_address_activated = false;
        savings_account.activation_payment_signature = Vec::new();
        savings_account.activated_at = 0;
    }

    // Check if permanent address is activated for deposits
    require!(
        savings_account.permanent_address_activated,
        ErrorCode::PermanentAddressNotActivated
    );

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

// ========== SPENDING LIMITS INSTRUCTIONS ==========

/// Initialize a new spending limits account for a user (now uses unified SavingsAccount)
#[derive(Accounts)]
pub struct InitializeSpendingLimits<'info> {
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

/// Add or update a time period limit
#[derive(Accounts)]
pub struct AddTimePeriodLimit<'info> {
    #[account(
        mut,
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump,
        constraint = savings_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Remove a time period limit
#[derive(Accounts)]
pub struct RemoveTimePeriodLimit<'info> {
    #[account(
        mut,
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump,
        constraint = savings_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Set common period limits (Daily, Weekly, Monthly)
#[derive(Accounts)]
pub struct SetCommonPeriodLimits<'info> {
    #[account(
        mut,
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump,
        constraint = savings_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Commit initial setup
#[derive(Accounts)]
pub struct CommitInitialSetup<'info> {
    #[account(
        mut,
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump,
        constraint = savings_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Get spending limits view
#[derive(Accounts)]
pub struct GetSpendingLimits<'info> {
    #[account(
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    pub user: Signer<'info>,
}

/// Modified withdrawal context with spending limits
#[derive(Accounts)]
pub struct WithdrawSolWithLimits<'info> {
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

/// Modified SPL withdrawal context with spending limits
#[derive(Accounts)]
pub struct WithdrawSplWithLimits<'info> {
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

// ========== SPENDING LIMITS INSTRUCTION IMPLEMENTATIONS ==========

/// Initialize spending limits account instruction
pub fn initialize_spending_limits(ctx: Context<InitializeSpendingLimits>) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let user = &ctx.accounts.user;
    let clock = Clock::get()?;

    savings_account.owner = user.key();
    savings_account.sol_balance = 0;
    savings_account.spl_balances = Vec::new();
    savings_account.withdrawal_destinations = Vec::new();
    savings_account.pending_withdrawal_destination_requests = Vec::new();
    savings_account.pending_bypass_requests = Vec::new();
    savings_account.permanent_address_activated = false;
    savings_account.activation_payment_signature = Vec::new();
    savings_account.activated_at = 0;
    savings_account.time_period_limits = Vec::new();
    savings_account.pending_proposals = Vec::new();
    savings_account.has_committed_setup = false;
    savings_account.total_locked_value = 0;
    savings_account.commit_timestamp = 0;
    savings_account.bump = ctx.bumps.savings_account;
    savings_account.created_at = clock.unix_timestamp;
    savings_account.updated_at = clock.unix_timestamp;

    msg!("Spending limits account initialized for user: {}", user.key());

    Ok(())
}

/// Add time period limit instruction
pub fn add_time_period_limit(
    ctx: Context<AddTimePeriodLimit>,
    name: String,
    limit: u64,
    duration: u64,
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;

    savings_account.add_time_period_limit(name.clone(), limit, duration, clock.unix_timestamp)?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Added time period limit: {} with limit {} and duration {}",
        name,
        limit,
        duration
    );

    Ok(())
}

/// Remove time period limit instruction
pub fn remove_time_period_limit(
    ctx: Context<RemoveTimePeriodLimit>,
    name: String,
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;

    savings_account.remove_time_period_limit(&name)?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!("Removed time period limit: {}", name);

    Ok(())
}

/// Set common period limits instruction
pub fn set_common_period_limits(
    ctx: Context<SetCommonPeriodLimits>,
    daily_limit: Option<u64>,
    weekly_limit: Option<u64>,
    monthly_limit: Option<u64>,
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;

    savings_account.set_common_period_limits(
        daily_limit,
        weekly_limit,
        monthly_limit,
        clock.unix_timestamp,
    )?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Set common period limits - Daily: {:?}, Weekly: {:?}, Monthly: {:?}",
        daily_limit,
        weekly_limit,
        monthly_limit
    );

    Ok(())
}

/// Commit initial setup instruction
pub fn commit_initial_setup(ctx: Context<CommitInitialSetup>) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;

    // Calculate total locked value across all active periods
    let mut total_locked_value = 0u64;
    for period in &savings_account.time_period_limits {
        if period.active {
            total_locked_value = total_locked_value.checked_add(period.limit)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        }
    }

    savings_account.has_committed_setup = true;
    savings_account.total_locked_value = total_locked_value;
    savings_account.commit_timestamp = clock.unix_timestamp;
    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Initial setup committed with total locked value: {}",
        total_locked_value
    );

    Ok(())
}

/// Get spending limits information
pub fn get_spending_limits(ctx: Context<GetSpendingLimits>) -> Result<()> {
    let savings_account = &ctx.accounts.savings_account;
    let clock = Clock::get()?;

    msg!("Spending limits for user: {}", ctx.accounts.user.key());
    msg!("Setup committed: {}", savings_account.has_committed_setup);
    msg!("Total locked value: {}", savings_account.total_locked_value);

    for (index, period) in savings_account.time_period_limits.iter().enumerate() {
        if period.active {
            let (limit, spent, remaining, _) = savings_account
                .get_period_info(&period.name, clock.unix_timestamp)
                .unwrap_or((0, 0, 0, false));

            msg!(
                "Period {}: {} - Limit: {}, Spent: {}, Remaining: {}",
                index,
                period.name,
                limit,
                spent,
                remaining
            );
        }
    }

    Ok(())
}

/// Withdraw SOL with spending limits validation
pub fn withdraw_sol_with_limits(ctx: Context<WithdrawSolWithLimits>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let savings_account = &mut ctx.accounts.savings_account;
    let user = &ctx.accounts.user;
    let clock = Clock::get()?;

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

    // Validate spending limits
    let savings_account = &mut ctx.accounts.savings_account;

    // Check if setup is committed (required for withdrawals)
    require!(
        savings_account.has_committed_setup,
        ErrorCode::SetupNotCommitted
    );

    // Check spending limits
    savings_account.check_spending_limits(amount, clock.unix_timestamp)?;

    // Transfer SOL from savings account to user
    **savings_account.to_account_info().try_borrow_mut_lamports()? -= amount;
    **user.to_account_info().try_borrow_mut_lamports()? += amount;

    // Update SOL balance
    savings_account.sol_balance = savings_account
        .sol_balance
        .checked_sub(amount)
        .ok_or(crate::error::ErrorCode::ArithmeticOverflow)?;

    // Update spending tracking
    savings_account.update_spending(amount, clock.unix_timestamp)?;
    savings_account.updated_at = clock.unix_timestamp;

    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Withdrew {} lamports from savings account with spending limits validation. Remaining balance: {}",
        amount,
        savings_account.sol_balance
    );

    Ok(())
}

/// Withdraw SPL tokens with spending limits validation
pub fn withdraw_spl_with_limits(ctx: Context<WithdrawSplWithLimits>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let savings_account = &mut ctx.accounts.savings_account;
    let mint = &ctx.accounts.mint;
    let clock = Clock::get()?;

    // Check if user has sufficient token balance
    let current_balance = savings_account.get_token_balance(mint.key());
    require!(current_balance >= amount, ErrorCode::InsufficientBalance);

    // Validate spending limits
    let savings_account = &mut ctx.accounts.savings_account;

    // Check if setup is committed (required for withdrawals)
    require!(
        savings_account.has_committed_setup,
        ErrorCode::SetupNotCommitted
    );

    // Check spending limits (for SPL tokens, we use the token amount directly)
    savings_account.check_spending_limits(amount, clock.unix_timestamp)?;

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

    // Update spending tracking
    savings_account.update_spending(amount, clock.unix_timestamp)?;
    savings_account.updated_at = clock.unix_timestamp;

    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Withdrew {} tokens of mint {} from savings account with spending limits validation",
        amount,
        mint.key()
    );

    Ok(())
}

// ========== PROPOSAL MANAGEMENT INSTRUCTIONS ==========

/// Propose a spending limit change
#[derive(Accounts)]
pub struct ProposeLimitChange<'info> {
    #[account(
        mut,
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump,
        constraint = savings_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Execute a pending proposal
#[derive(Accounts)]
pub struct ExecuteLimitProposal<'info> {
    #[account(
        mut,
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump,
        constraint = savings_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Cancel a pending proposal
#[derive(Accounts)]
pub struct CancelLimitProposal<'info> {
    #[account(
        mut,
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump,
        constraint = savings_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

// ========== PROPOSAL MANAGEMENT INSTRUCTION IMPLEMENTATIONS ==========

/// Propose a spending limit change instruction
pub fn propose_limit_change(
    ctx: Context<ProposeLimitChange>,
    period_name: String,
    new_limit: u64,
) -> Result<()> {
    require!(!period_name.is_empty() && period_name.len() <= SavingsAccount::MAX_PERIOD_NAME_LENGTH, ErrorCode::InvalidLimitParameters);
    require!(new_limit > 0, ErrorCode::InvalidLimitParameters);

    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;

    // Check if setup is committed (required for proposals)
    require!(
        savings_account.has_committed_setup,
        ErrorCode::SetupNotCommitted
    );

    // Check if period exists
    let mut period_exists = false;
    for period in &savings_account.time_period_limits {
        if period.name == period_name && period.active {
            period_exists = true;
            break;
        }
    }
    require!(period_exists, ErrorCode::InvalidLimitParameters);

    // Check if we have room for more proposals
    if savings_account.pending_proposals.len() >= SavingsAccount::MAX_PROPOSALS {
        return Err(ErrorCode::TokenLimitExceeded.into());
    }

    // Check if proposal already exists for this period
    for proposal in &savings_account.pending_proposals {
        if proposal.period_name == period_name && !proposal.executed {
            return Err(ErrorCode::InvalidLimitParameters.into());
        }
    }

    // Generate unique proposal ID
    let mut hasher_input = Vec::new();
    hasher_input.extend_from_slice(ctx.accounts.user.key().as_ref());
    hasher_input.extend_from_slice(period_name.as_bytes());
    hasher_input.extend_from_slice(&new_limit.to_le_bytes());
    hasher_input.extend_from_slice(&clock.unix_timestamp.to_le_bytes());

    let proposal_id = anchor_lang::solana_program::keccak::hash(&hasher_input).to_bytes();

    // Create proposal with timelock (configurable via cargo features)
    let timelock_duration = crate::constants::PROPOSAL_TIMELOCK;
    let execute_after = clock.unix_timestamp + timelock_duration;

    // Determine if this is an increase
    let current_limit = savings_account.time_period_limits
        .iter()
        .find(|p| p.name == period_name && p.active)
        .map(|p| p.limit)
        .unwrap_or(0);
    let is_increase = new_limit > current_limit;

    let proposal = crate::state::PendingProposal {
        proposal_id,
        period_name: period_name.clone(),
        new_limit,
        execute_after,
        executed: false,
        is_increase,
        created_at: clock.unix_timestamp,
    };

    savings_account.pending_proposals.push(proposal);
    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Proposed limit change for {}: {} -> {} (execute after: {})",
        period_name,
        current_limit,
        new_limit,
        execute_after
    );

    Ok(())
}

/// Execute a pending proposal instruction
pub fn execute_limit_proposal(
    ctx: Context<ExecuteLimitProposal>,
    proposal_id: [u8; 32],
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;

    // Find the proposal
    let mut proposal_index = None;
    for (index, proposal) in savings_account.pending_proposals.iter().enumerate() {
        if proposal.proposal_id == proposal_id {
            proposal_index = Some(index);
            break;
        }
    }

    let proposal_index = proposal_index.ok_or(ErrorCode::InvalidLimitParameters)?;

    // Get proposal details before mutable borrow
    let (period_name, new_limit, executed, execute_after) = {
        let proposal = &savings_account.pending_proposals[proposal_index];
        (
            proposal.period_name.clone(),
            proposal.new_limit,
            proposal.executed,
            proposal.execute_after,
        )
    };

    // Check if already executed
    require!(!executed, ErrorCode::InvalidLimitParameters);

    // Check if timelock has passed
    require!(
        clock.unix_timestamp >= execute_after,
        ErrorCode::InvalidLimitParameters
    );

    // Execute the proposal by updating the corresponding limit
    for period in &mut savings_account.time_period_limits {
        if period.name == period_name && period.active {
            period.limit = new_limit;
            break;
        }
    }

    // Mark proposal as executed
    savings_account.pending_proposals[proposal_index].executed = true;
    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Executed proposal for {}: new limit {}",
        period_name,
        new_limit
    );

    Ok(())
}

/// Cancel a pending proposal instruction
pub fn cancel_limit_proposal(
    ctx: Context<CancelLimitProposal>,
    proposal_id: [u8; 32],
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;

    // Find and remove the proposal
    let mut proposal_index = None;
    for (index, proposal) in savings_account.pending_proposals.iter().enumerate() {
        if proposal.proposal_id == proposal_id {
            proposal_index = Some(index);
            break;
        }
    }

    let proposal_index = proposal_index.ok_or(ErrorCode::InvalidLimitParameters)?;
    let proposal = &savings_account.pending_proposals[proposal_index];

    // Check if already executed
    require!(!proposal.executed, ErrorCode::InvalidLimitParameters);

    let period_name = proposal.period_name.clone();

    // Remove the proposal
    savings_account.pending_proposals.remove(proposal_index);
    savings_account.updated_at = clock.unix_timestamp;

    msg!("Cancelled proposal for {}", period_name);

    Ok(())
}

// ========== WITHDRAWAL DESTINATION INSTRUCTIONS ==========

/// Add a withdrawal destination
#[derive(Accounts)]
pub struct AddWithdrawalDestination<'info> {
    #[account(mut, seeds = [b"savings", user.key().as_ref()], bump)]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Remove a withdrawal destination
#[derive(Accounts)]
pub struct RemoveWithdrawalDestination<'info> {
    #[account(mut, seeds = [b"savings", user.key().as_ref()], bump)]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Request withdrawal destination addition (with timelock)
#[derive(Accounts)]
pub struct RequestWithdrawalDestinationAddition<'info> {
    #[account(mut, seeds = [b"savings", user.key().as_ref()], bump)]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Execute a pending withdrawal destination request
#[derive(Accounts)]
pub struct ExecuteWithdrawalDestinationRequest<'info> {
    #[account(mut, seeds = [b"savings", user.key().as_ref()], bump)]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Cancel a pending withdrawal destination request
#[derive(Accounts)]
pub struct CancelWithdrawalDestinationRequest<'info> {
    #[account(mut, seeds = [b"savings", user.key().as_ref()], bump)]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Withdraw to destination (extends existing withdraw functionality)
#[derive(Accounts)]
pub struct WithdrawToDestination<'info> {
    #[account(mut, seeds = [b"savings", user.key().as_ref()], bump)]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: This is the destination address that will receive the funds
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Withdraw SPL tokens to destination
#[derive(Accounts)]
pub struct WithdrawSplToDestination<'info> {
    #[account(
        mut,
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump,
        constraint = savings_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// Token mint
    pub mint: Account<'info, Mint>,

    /// User's token account for sending
    #[account(mut)]
    pub savings_token_account: Account<'info, TokenAccount>,

    /// Destination token account for receiving
    #[account(mut)]
    pub destination_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ========== BYPASS REQUEST INSTRUCTIONS ==========

/// Request withdrawal bypass for amounts exceeding spending limits
#[derive(Accounts)]
pub struct RequestWithdrawalBypass<'info> {
    #[account(mut, seeds = [b"savings", user.key().as_ref()], bump)]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Execute a withdrawal bypass after timelock period
#[derive(Accounts)]
pub struct ExecuteWithdrawalBypass<'info> {
    #[account(mut, seeds = [b"savings", user.key().as_ref()], bump)]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: This is the destination address that will receive the funds
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Execute SPL token withdrawal bypass
#[derive(Accounts)]
pub struct ExecuteSplWithdrawalBypass<'info> {
    #[account(mut, seeds = [b"savings", user.key().as_ref()], bump)]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// Token mint
    pub mint: Account<'info, Mint>,

    /// User's token account for sending
    #[account(mut)]
    pub savings_token_account: Account<'info, TokenAccount>,

    /// Destination token account for receiving
    #[account(mut)]
    pub destination_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Cancel a withdrawal bypass request
#[derive(Accounts)]
pub struct CancelWithdrawalBypass<'info> {
    #[account(mut, seeds = [b"savings", user.key().as_ref()], bump)]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

// ========== INSTRUCTION IMPLEMENTATIONS ==========

/// Add a withdrawal destination instruction
pub fn add_withdrawal_destination(
    ctx: Context<AddWithdrawalDestination>,
    address: Pubkey,
    title: String,
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;

    savings_account.add_withdrawal_destination(address, title, clock.unix_timestamp)?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!("Added withdrawal destination: {}", address);
    Ok(())
}

/// Remove a withdrawal destination instruction
pub fn remove_withdrawal_destination(
    ctx: Context<RemoveWithdrawalDestination>,
    address: Pubkey,
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;

    savings_account.remove_withdrawal_destination(address)?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!("Removed withdrawal destination: {}", address);
    Ok(())
}

/// Request withdrawal destination addition instruction (with timelock)
pub fn request_withdrawal_destination_addition(
    ctx: Context<RequestWithdrawalDestinationAddition>,
    address: Pubkey,
    title: String,
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let user = &ctx.accounts.user;
    let clock = Clock::get()?;

    // Generate unique request ID
    let mut hasher_input = Vec::new();
    hasher_input.extend_from_slice(user.key().as_ref());
    hasher_input.extend_from_slice(address.as_ref());
    hasher_input.extend_from_slice(title.as_bytes());
    hasher_input.extend_from_slice(&clock.unix_timestamp.to_le_bytes());

    let request_id = anchor_lang::solana_program::keccak::hash(&hasher_input).to_bytes();

    savings_account.add_pending_withdrawal_destination_request(
        request_id,
        address,
        title.clone(),
        clock.unix_timestamp,
    )?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Requested withdrawal destination addition: {} with title '{}' (execute after: {})",
        address,
        title,
        clock.unix_timestamp + 86400
    );
    Ok(())
}

/// Execute a pending withdrawal destination request instruction
pub fn execute_withdrawal_destination_request(
    ctx: Context<ExecuteWithdrawalDestinationRequest>,
    request_id: [u8; 32],
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;

    let executed_request = savings_account.execute_pending_withdrawal_destination_request(
        request_id,
        clock.unix_timestamp,
    )?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Executed withdrawal destination request: {} with title '{}'",
        executed_request.address,
        executed_request.title
    );
    Ok(())
}

/// Cancel a pending withdrawal destination request instruction
pub fn cancel_withdrawal_destination_request(
    ctx: Context<CancelWithdrawalDestinationRequest>,
    request_id: [u8; 32],
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;

    savings_account.cancel_pending_withdrawal_destination_request(request_id)?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!("Cancelled withdrawal destination request");
    Ok(())
}

/// Withdraw SOL to destination instruction
pub fn withdraw_sol_to_destination(
    ctx: Context<WithdrawToDestination>,
    amount: u64,
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let user = &mut ctx.accounts.user;
    let destination = &mut ctx.accounts.destination;

    // Verify destination is approved
    require!(
        savings_account.is_destination_approved(destination.key()),
        ErrorCode::DestinationNotApproved
    );

    // Check balance
    require!(savings_account.sol_balance >= amount, ErrorCode::InsufficientBalance);

    // Transfer SOL from user to destination
    let transfer_instruction = anchor_lang::system_program::Transfer {
        from: user.to_account_info(),
        to: destination.to_account_info(),
    };

    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
        ),
        amount,
    )?;

    // Update balance
    savings_account.sol_balance = savings_account.sol_balance
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    let clock = Clock::get()?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!("Withdrew {} SOL to {}", amount, destination.key());
    Ok(())
}

/// Withdraw SPL tokens to destination instruction
pub fn withdraw_spl_to_destination(
    ctx: Context<WithdrawSplToDestination>,
    amount: u64,
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let mint = &ctx.accounts.mint;

    // Verify destination token account is approved (check the owner)
    require!(
        savings_account.is_destination_approved(ctx.accounts.destination_token_account.owner),
        ErrorCode::DestinationNotApproved
    );

    // Check balance
    let current_balance = savings_account.get_token_balance(mint.key());
    require!(current_balance >= amount, ErrorCode::InsufficientBalance);

    // Create seeds for signing
    let user_key = savings_account.owner;
    let seeds = &[b"savings", user_key.as_ref(), &[savings_account.bump]];
    let signer = &[&seeds[..]];

    // Transfer SPL tokens from savings account to destination
    let cpi_accounts = Transfer {
        from: ctx.accounts.savings_token_account.to_account_info(),
        to: ctx.accounts.destination_token_account.to_account_info(),
        authority: savings_account.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;

    // Update balance in savings account
    msg!("Before balance update - splBalances length: {}", savings_account.spl_balances.len());
    let mut balance_updated = false;
    for (i, token_balance) in savings_account.spl_balances.iter_mut().enumerate() {
        msg!("Checking balance entry {}: mint={}, amount={}", i, token_balance.mint, token_balance.amount);
        if token_balance.mint == mint.key() {
            let old_amount = token_balance.amount;
            token_balance.amount = token_balance.amount
                .checked_sub(amount)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
            msg!("Updated balance for mint {}: {} -> {}", mint.key(), old_amount, token_balance.amount);
            balance_updated = true;
            break;
        }
    }
    if !balance_updated {
        msg!("Warning: No balance entry found for mint {} to update", mint.key());
    }

    let clock = Clock::get()?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!("Withdrew {} tokens to destination", amount);
    Ok(())
}

/// Request withdrawal bypass instruction
pub fn request_withdrawal_bypass(
    ctx: Context<RequestWithdrawalBypass>,
    amount: u64,
    token_mint: Pubkey,
    bypassing_period: String,
    destination: Pubkey,
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;
    let user_key = ctx.accounts.user.key();

    // Generate unique request ID
    let request_id = hash_request_id(user_key, amount, clock.unix_timestamp);

    savings_account.add_bypass_request(
        request_id,
        amount,
        token_mint,
        bypassing_period.clone(),
        destination,
        clock.unix_timestamp,
    )?;

    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Requested withdrawal bypass: {} tokens, period: {}",
        amount,
        bypassing_period
    );
    Ok(())
}

/// Execute withdrawal bypass (SOL) instruction
pub fn execute_withdrawal_bypass(
    ctx: Context<ExecuteWithdrawalBypass>,
    request_id: [u8; 32],
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let user = &mut ctx.accounts.user;
    let destination = &mut ctx.accounts.destination;
    let clock = Clock::get()?;

    // Execute the bypass request
    let request = savings_account.execute_bypass_request(request_id, clock.unix_timestamp)?;

    // Verify this is a SOL withdrawal (token_mint should be system program)
    require!(
        request.token_mint == anchor_lang::system_program::ID,
        ErrorCode::InvalidParameters
    );

    // Verify destination matches
    require!(request.destination == destination.key(), ErrorCode::InvalidParameters);

    // Check balance
    require!(
        savings_account.sol_balance >= request.amount,
        ErrorCode::InsufficientBalance
    );

    // Transfer SOL
    let transfer_instruction = anchor_lang::system_program::Transfer {
        from: user.to_account_info(),
        to: destination.to_account_info(),
    };

    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
        ),
        request.amount,
    )?;

    // Update balance
    savings_account.sol_balance = savings_account.sol_balance
        .checked_sub(request.amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Executed bypass withdrawal: {} SOL to {}",
        request.amount,
        destination.key()
    );
    Ok(())
}

/// Execute SPL withdrawal bypass instruction
pub fn execute_spl_withdrawal_bypass(
    ctx: Context<ExecuteSplWithdrawalBypass>,
    request_id: [u8; 32],
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let mint = &ctx.accounts.mint;
    let clock = Clock::get()?;

    // Execute the bypass request
    let request = savings_account.execute_bypass_request(request_id, clock.unix_timestamp)?;

    // Verify this is for the correct token
    require!(request.token_mint == mint.key(), ErrorCode::InvalidParameters);

    // Verify destination matches
    require!(
        request.destination == ctx.accounts.destination_token_account.owner,
        ErrorCode::InvalidParameters
    );

    // Check balance
    let current_balance = savings_account.get_token_balance(mint.key());
    require!(current_balance >= request.amount, ErrorCode::InsufficientBalance);

    // Transfer SPL tokens
    let transfer_instruction = Transfer {
        from: ctx.accounts.savings_token_account.to_account_info(),
        to: ctx.accounts.destination_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
        ),
        request.amount,
    )?;

    // Update balance
    for token_balance in &mut savings_account.spl_balances {
        if token_balance.mint == mint.key() {
            token_balance.amount = token_balance.amount
                .checked_sub(request.amount)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
            break;
        }
    }

    savings_account.updated_at = clock.unix_timestamp;

    msg!("Executed SPL bypass withdrawal: {} tokens", request.amount);
    Ok(())
}

/// Cancel withdrawal bypass instruction
pub fn cancel_withdrawal_bypass(
    ctx: Context<CancelWithdrawalBypass>,
    request_id: [u8; 32],
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let clock = Clock::get()?;

    savings_account.cancel_bypass_request(request_id)?;
    savings_account.updated_at = clock.unix_timestamp;

    msg!("Cancelled withdrawal bypass request");
    Ok(())
}

/// Helper function to generate a unique request ID
fn hash_request_id(user: Pubkey, amount: u64, timestamp: i64) -> [u8; 32] {
    use anchor_lang::solana_program::hash::{hash, Hash};

    let mut data = Vec::new();
    data.extend_from_slice(&user.to_bytes());
    data.extend_from_slice(&amount.to_le_bytes());
    data.extend_from_slice(&timestamp.to_le_bytes());

    let hash_result: Hash = hash(&data);
    hash_result.to_bytes()
}

// ========== DEPOSIT PROXY INSTRUCTIONS ==========

/// Initialize a new deposit proxy for a user
#[derive(Accounts)]
pub struct InitializeProxy<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 8, // discriminator + owner + savings_program + bump + created_at + last_used + deposit_count
        seeds = [b"deposit_proxy", user.key().as_ref()],
        bump
    )]
    pub deposit_proxy: Account<'info, DepositProxy>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// The savings program this proxy will forward to
    /// CHECK: We validate this is a valid program account
    pub savings_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Forward SOL deposit to savings program
#[derive(Accounts)]
pub struct ForwardSolDeposit<'info> {
    #[account(
        mut,
        seeds = [b"deposit_proxy", deposit_proxy.owner.as_ref()],
        bump = deposit_proxy.bump,
    )]
    pub deposit_proxy: Account<'info, DepositProxy>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    /// The proxy owner (beneficiary of the deposit)
    /// CHECK: This is validated against the proxy owner field
    #[account(constraint = proxy_owner.key() == deposit_proxy.owner @ ErrorCode::UnauthorizedAccess)]
    pub proxy_owner: UncheckedAccount<'info>,

    /// The savings program to forward to
    /// CHECK: We validate this matches the proxy configuration
    #[account(constraint = savings_program.key() == deposit_proxy.savings_program @ ErrorCode::InvalidSavingsProgram)]
    pub savings_program: UncheckedAccount<'info>,

    /// Savings account PDA in the target program
    /// CHECK: This will be validated by the savings program
    pub savings_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Forward SPL token deposit to savings program
#[derive(Accounts)]
pub struct ForwardSplDeposit<'info> {
    #[account(
        mut,
        seeds = [b"deposit_proxy", deposit_proxy.owner.as_ref()],
        bump = deposit_proxy.bump,
    )]
    pub deposit_proxy: Account<'info, DepositProxy>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    /// The proxy owner (beneficiary of the deposit)
    /// CHECK: This is validated against the proxy owner field
    #[account(constraint = proxy_owner.key() == deposit_proxy.owner @ ErrorCode::UnauthorizedAccess)]
    pub proxy_owner: UncheckedAccount<'info>,

    /// Depositor's token account
    #[account(
        mut,
        constraint = depositor_token_account.owner == depositor.key(),
        constraint = depositor_token_account.mint == mint.key()
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,

    /// Proxy's token account (intermediate holder)
    #[account(
        init_if_needed,
        payer = depositor,
        associated_token::mint = mint,
        associated_token::authority = deposit_proxy,
    )]
    pub proxy_token_account: Account<'info, TokenAccount>,

    /// Target savings account for the proxy owner
    /// CHECK: This will be validated by the savings program
    pub savings_account: UncheckedAccount<'info>,

    /// Owner's token account in savings program
    /// CHECK: This will be validated by the savings program
    pub savings_token_account: UncheckedAccount<'info>,

    /// The mint of the SPL token being deposited
    pub mint: Account<'info, Mint>,

    /// The savings program to forward to
    /// CHECK: We validate this matches the proxy configuration
    #[account(constraint = savings_program.key() == deposit_proxy.savings_program @ ErrorCode::InvalidSavingsProgram)]
    pub savings_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Get proxy address context
#[derive(Accounts)]
pub struct GetProxyAddress<'info> {
    #[account(
        seeds = [b"deposit_proxy", user.key().as_ref()],
        bump = deposit_proxy.bump
    )]
    pub deposit_proxy: Account<'info, DepositProxy>,

    pub user: Signer<'info>,
}

// ========== DEPOSIT PROXY INSTRUCTION IMPLEMENTATIONS ==========

/// Initialize deposit proxy instruction
pub fn initialize_proxy(ctx: Context<InitializeProxy>) -> Result<()> {
    let deposit_proxy = &mut ctx.accounts.deposit_proxy;
    let user = &ctx.accounts.user;
    let savings_program = &ctx.accounts.savings_program;
    let clock = Clock::get()?;

    // Validate that savings_program is actually a program
    require!(savings_program.executable, ErrorCode::InvalidSavingsProgram);

    deposit_proxy.owner = user.key();
    deposit_proxy.savings_program = savings_program.key();
    deposit_proxy.bump = ctx.bumps.deposit_proxy;
    deposit_proxy.created_at = clock.unix_timestamp;
    deposit_proxy.last_used = clock.unix_timestamp;
    deposit_proxy.deposit_count = 0;

    msg!("Deposit proxy initialized for user: {} -> program: {}",
         user.key(), savings_program.key());

    Ok(())
}

/// Forward SOL deposit to savings program - simplified implementation
pub fn forward_sol_deposit(ctx: Context<ForwardSolDeposit>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let deposit_proxy = &mut ctx.accounts.deposit_proxy;
    let depositor = &ctx.accounts.depositor;
    let proxy_owner = &ctx.accounts.proxy_owner;

    // Record deposit in proxy statistics
    deposit_proxy.record_deposit()?;

    // TODO: For MVP, we're simplifying this to just record the deposit
    // The actual fund forwarding logic will be implemented after we verify
    // the basic program compilation and deployment cost savings

    msg!("Proxy deposit recorded: {} lamports from {} for {}",
         amount, depositor.key(), proxy_owner.key());

    Ok(())
}

/// Forward SPL token deposit to savings program - simplified implementation
pub fn forward_spl_deposit(ctx: Context<ForwardSplDeposit>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let deposit_proxy = &mut ctx.accounts.deposit_proxy;
    let depositor = &ctx.accounts.depositor;
    let proxy_owner = &ctx.accounts.proxy_owner;
    let mint = &ctx.accounts.mint;

    // Record deposit in proxy statistics
    deposit_proxy.record_deposit()?;

    // TODO: For MVP, we're simplifying this to just record the deposit
    // The actual token forwarding logic will be implemented after we verify
    // the basic program compilation and deployment cost savings

    msg!("Proxy SPL deposit recorded: {} tokens of mint {} from {} for {}",
         amount, mint.key(), depositor.key(), proxy_owner.key());

    Ok(())
}

/// Initialize program configuration (admin only)
#[derive(Accounts)]
pub struct InitializeProgramConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + ProgramConfig::INIT_SPACE,
        seeds = [b"program_config"],
        bump
    )]
    pub program_config: Account<'info, ProgramConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Treasury address can be any valid Pubkey
    pub treasury_address: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Update program configuration (admin only)
#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(
        mut,
        seeds = [b"program_config"],
        bump = program_config.bump,
        constraint = program_config.admin == admin.key() @ ErrorCode::Unauthorized
    )]
    pub program_config: Account<'info, ProgramConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

/// Activate permanent address with payment
#[derive(Accounts)]
pub struct ActivatePermanentAddressWithPayment<'info> {
    #[account(
        mut,
        seeds = [b"savings", user.key().as_ref()],
        bump = savings_account.bump,
        constraint = !savings_account.permanent_address_activated @ ErrorCode::AlreadyActivated
    )]
    pub savings_account: Account<'info, SavingsAccount>,

    #[account(
        seeds = [b"program_config"],
        bump = program_config.bump
    )]
    pub program_config: Account<'info, ProgramConfig>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: Treasury address from config - must match program_config.treasury_address
    #[account(
        mut,
        constraint = treasury_address.key() == program_config.treasury_address @ ErrorCode::InvalidTreasuryAddress
    )]
    pub treasury_address: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

// ========== MONETIZATION INSTRUCTION IMPLEMENTATIONS ==========

/// Initialize program configuration
pub fn initialize_program_config(
    ctx: Context<InitializeProgramConfig>,
    permanent_address_fee_lamports: u64,
) -> Result<()> {
    let program_config = &mut ctx.accounts.program_config;
    let admin = &ctx.accounts.admin;
    let treasury_address = &ctx.accounts.treasury_address;
    let clock = Clock::get()?;

    // Initialize program config
    program_config.treasury_address = treasury_address.key();
    program_config.permanent_address_fee_lamports = permanent_address_fee_lamports;
    program_config.admin = admin.key();
    program_config.bump = ctx.bumps.program_config;
    program_config.created_at = clock.unix_timestamp;
    program_config.updated_at = clock.unix_timestamp;

    msg!("Program config initialized - Treasury: {}, Fee: {} lamports, Admin: {}",
         treasury_address.key(), permanent_address_fee_lamports, admin.key());

    Ok(())
}

/// Update program configuration (admin only)
pub fn update_program_config(
    ctx: Context<UpdateProgramConfig>,
    new_treasury_address: Option<Pubkey>,
    new_fee_lamports: Option<u64>,
) -> Result<()> {
    let program_config = &mut ctx.accounts.program_config;
    let clock = Clock::get()?;

    // Update treasury address if provided
    if let Some(treasury) = new_treasury_address {
        program_config.treasury_address = treasury;
        msg!("Treasury address updated to: {}", treasury);
    }

    // Update fee if provided
    if let Some(fee) = new_fee_lamports {
        program_config.permanent_address_fee_lamports = fee;
        msg!("Permanent address fee updated to: {} lamports", fee);
    }

    program_config.updated_at = clock.unix_timestamp;

    Ok(())
}

/// Activate permanent address with payment
pub fn activate_permanent_address_with_payment(
    ctx: Context<ActivatePermanentAddressWithPayment>,
) -> Result<()> {
    let savings_account = &mut ctx.accounts.savings_account;
    let program_config = &ctx.accounts.program_config;
    let user = &ctx.accounts.user;
    let treasury_address = &ctx.accounts.treasury_address;
    let system_program = &ctx.accounts.system_program;
    let clock = Clock::get()?;

    // Check user has sufficient funds
    let user_balance = user.lamports();
    let fee_amount = program_config.permanent_address_fee_lamports;

    require!(
        user_balance >= fee_amount,
        ErrorCode::InsufficientFundsForActivation
    );

    // Transfer SOL from user to treasury
    let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
        &user.key(),
        &treasury_address.key(),
        fee_amount,
    );

    anchor_lang::solana_program::program::invoke(
        &transfer_instruction,
        &[
            user.to_account_info(),
            treasury_address.to_account_info(),
            system_program.to_account_info(),
        ],
    )?;

    // Activate permanent address
    savings_account.permanent_address_activated = true;
    savings_account.activated_at = clock.unix_timestamp;

    // Store transaction signature for verification (get from slot)
    let slot = clock.slot;
    let mut signature_bytes = [0u8; 64];
    signature_bytes[..8].copy_from_slice(&slot.to_le_bytes());
    savings_account.activation_payment_signature = Vec::from(signature_bytes);

    savings_account.updated_at = clock.unix_timestamp;

    msg!("Permanent address activated! User: {}, Fee paid: {} lamports, Treasury: {}",
         user.key(), fee_amount, treasury_address.key());

    Ok(())
}