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
    }

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
    }

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

// ========== SPENDING LIMITS INSTRUCTIONS ==========

/// Initialize a new spending limits account for a user
#[derive(Accounts)]
pub struct InitializeSpendingLimits<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + SpendingLimitsAccount::INIT_SPACE,
        seeds = [b"spending_limits", user.key().as_ref()],
        bump
    )]
    pub spending_limits_account: Account<'info, SpendingLimitsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Add or update a time period limit
#[derive(Accounts)]
pub struct AddTimePeriodLimit<'info> {
    #[account(
        mut,
        seeds = [b"spending_limits", user.key().as_ref()],
        bump = spending_limits_account.bump,
        constraint = spending_limits_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub spending_limits_account: Account<'info, SpendingLimitsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Remove a time period limit
#[derive(Accounts)]
pub struct RemoveTimePeriodLimit<'info> {
    #[account(
        mut,
        seeds = [b"spending_limits", user.key().as_ref()],
        bump = spending_limits_account.bump,
        constraint = spending_limits_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub spending_limits_account: Account<'info, SpendingLimitsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Set common period limits (Daily, Weekly, Monthly)
#[derive(Accounts)]
pub struct SetCommonPeriodLimits<'info> {
    #[account(
        mut,
        seeds = [b"spending_limits", user.key().as_ref()],
        bump = spending_limits_account.bump,
        constraint = spending_limits_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub spending_limits_account: Account<'info, SpendingLimitsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Commit initial setup
#[derive(Accounts)]
pub struct CommitInitialSetup<'info> {
    #[account(
        mut,
        seeds = [b"spending_limits", user.key().as_ref()],
        bump = spending_limits_account.bump,
        constraint = spending_limits_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub spending_limits_account: Account<'info, SpendingLimitsAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Get spending limits view
#[derive(Accounts)]
pub struct GetSpendingLimits<'info> {
    #[account(
        seeds = [b"spending_limits", user.key().as_ref()],
        bump = spending_limits_account.bump
    )]
    pub spending_limits_account: Account<'info, SpendingLimitsAccount>,

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

    #[account(
        mut,
        seeds = [b"spending_limits", user.key().as_ref()],
        bump = spending_limits_account.bump,
        constraint = spending_limits_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub spending_limits_account: Account<'info, SpendingLimitsAccount>,

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

    #[account(
        mut,
        seeds = [b"spending_limits", user.key().as_ref()],
        bump = spending_limits_account.bump,
        constraint = spending_limits_account.owner == user.key() @ ErrorCode::UnauthorizedAccess
    )]
    pub spending_limits_account: Account<'info, SpendingLimitsAccount>,

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
    let spending_limits_account = &mut ctx.accounts.spending_limits_account;
    let user = &ctx.accounts.user;
    let clock = Clock::get()?;

    spending_limits_account.owner = user.key();
    spending_limits_account.time_period_limits = Vec::new();
    spending_limits_account.setup_data = UserSetupData::default();
    spending_limits_account.bump = ctx.bumps.spending_limits_account;
    spending_limits_account.created_at = clock.unix_timestamp;
    spending_limits_account.updated_at = clock.unix_timestamp;

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
    let spending_limits_account = &mut ctx.accounts.spending_limits_account;
    let clock = Clock::get()?;

    spending_limits_account.add_time_period_limit(name.clone(), limit, duration, clock.unix_timestamp)?;
    spending_limits_account.updated_at = clock.unix_timestamp;

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
    let spending_limits_account = &mut ctx.accounts.spending_limits_account;
    let clock = Clock::get()?;

    spending_limits_account.remove_time_period_limit(&name)?;
    spending_limits_account.updated_at = clock.unix_timestamp;

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
    let spending_limits_account = &mut ctx.accounts.spending_limits_account;
    let clock = Clock::get()?;

    spending_limits_account.set_common_period_limits(
        daily_limit,
        weekly_limit,
        monthly_limit,
        clock.unix_timestamp,
    )?;
    spending_limits_account.updated_at = clock.unix_timestamp;

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
    let spending_limits_account = &mut ctx.accounts.spending_limits_account;
    let clock = Clock::get()?;

    // Calculate total locked value across all active periods
    let mut total_locked_value = 0u64;
    for period in &spending_limits_account.time_period_limits {
        if period.active {
            total_locked_value = total_locked_value.checked_add(period.limit)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        }
    }

    spending_limits_account.setup_data.has_committed_setup = true;
    spending_limits_account.setup_data.total_locked_value = total_locked_value;
    spending_limits_account.setup_data.commit_timestamp = clock.unix_timestamp;
    spending_limits_account.updated_at = clock.unix_timestamp;

    msg!(
        "Initial setup committed with total locked value: {}",
        total_locked_value
    );

    Ok(())
}

/// Get spending limits information
pub fn get_spending_limits(ctx: Context<GetSpendingLimits>) -> Result<()> {
    let spending_limits_account = &ctx.accounts.spending_limits_account;
    let clock = Clock::get()?;

    msg!("Spending limits for user: {}", ctx.accounts.user.key());
    msg!("Setup committed: {}", spending_limits_account.setup_data.has_committed_setup);
    msg!("Total locked value: {}", spending_limits_account.setup_data.total_locked_value);

    for (index, period) in spending_limits_account.time_period_limits.iter().enumerate() {
        if period.active {
            let (limit, spent, remaining, _) = spending_limits_account
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
    let spending_limits_account = &mut ctx.accounts.spending_limits_account;

    // Check if setup is committed (required for withdrawals)
    require!(
        spending_limits_account.setup_data.has_committed_setup,
        ErrorCode::SetupNotCommitted
    );

    // Check spending limits
    spending_limits_account.check_spending_limits(amount, clock.unix_timestamp)?;

    // Transfer SOL from savings account to user
    **savings_account.to_account_info().try_borrow_mut_lamports()? -= amount;
    **user.to_account_info().try_borrow_mut_lamports()? += amount;

    // Update SOL balance
    savings_account.sol_balance = savings_account
        .sol_balance
        .checked_sub(amount)
        .ok_or(crate::error::ErrorCode::ArithmeticOverflow)?;

    // Update spending tracking
    spending_limits_account.update_spending(amount, clock.unix_timestamp)?;
    spending_limits_account.updated_at = clock.unix_timestamp;

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
    let spending_limits_account = &mut ctx.accounts.spending_limits_account;

    // Check if setup is committed (required for withdrawals)
    require!(
        spending_limits_account.setup_data.has_committed_setup,
        ErrorCode::SetupNotCommitted
    );

    // Check spending limits (for SPL tokens, we use the token amount directly)
    spending_limits_account.check_spending_limits(amount, clock.unix_timestamp)?;

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
    spending_limits_account.update_spending(amount, clock.unix_timestamp)?;
    spending_limits_account.updated_at = clock.unix_timestamp;

    savings_account.updated_at = clock.unix_timestamp;

    msg!(
        "Withdrew {} tokens of mint {} from savings account with spending limits validation",
        amount,
        mint.key()
    );

    Ok(())
}