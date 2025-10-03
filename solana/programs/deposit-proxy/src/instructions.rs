use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::Instruction, instruction::AccountMeta};
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::*;
use crate::error::ErrorCode;

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

/// Forward SOL deposit to savings program
pub fn forward_sol_deposit(ctx: Context<ForwardSolDeposit>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let deposit_proxy = &mut ctx.accounts.deposit_proxy;
    let depositor = &ctx.accounts.depositor;
    let proxy_owner = &ctx.accounts.proxy_owner;
    let savings_program = &ctx.accounts.savings_program;
    let savings_account = &ctx.accounts.savings_account;
    let system_program = &ctx.accounts.system_program;

    // Record deposit in proxy statistics
    deposit_proxy.record_deposit()?;

    // Create CPI context for the savings program deposit_sol instruction
    let cpi_accounts = vec![
        savings_account.to_account_info(),
        proxy_owner.to_account_info(),
        system_program.to_account_info(),
    ];

    // Create the instruction data for deposit_sol (discriminator + amount)
    let mut instruction_data = vec![108, 81, 78, 117, 125, 155, 56, 200]; // deposit_sol discriminator
    instruction_data.extend_from_slice(&amount.to_le_bytes());

    let deposit_ix = Instruction {
        program_id: savings_program.key(),
        accounts: vec![
            AccountMeta::new(savings_account.key(), false),
            AccountMeta::new(proxy_owner.key(), true),
            AccountMeta::new_readonly(system_program.key(), false),
        ],
        data: instruction_data,
    };

    // First, transfer SOL from depositor to proxy owner so they can make the deposit
    let transfer_ix = anchor_lang::system_program::Transfer {
        from: depositor.to_account_info(),
        to: proxy_owner.to_account_info(),
    };
    let transfer_ctx = CpiContext::new(system_program.to_account_info(), transfer_ix);
    anchor_lang::system_program::transfer(transfer_ctx, amount)?;

    // Then invoke the savings program
    anchor_lang::solana_program::program::invoke(
        &deposit_ix,
        &cpi_accounts,
    )?;

    msg!("Forwarded {} lamports from {} to savings account for {}",
         amount, depositor.key(), proxy_owner.key());

    Ok(())
}

/// Forward SPL token deposit to savings program
pub fn forward_spl_deposit(ctx: Context<ForwardSplDeposit>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let deposit_proxy = &mut ctx.accounts.deposit_proxy;
    let depositor = &ctx.accounts.depositor;
    let proxy_owner = &ctx.accounts.proxy_owner;
    let mint = &ctx.accounts.mint;
    let savings_program = &ctx.accounts.savings_program;
    let savings_account = &ctx.accounts.savings_account;
    let savings_token_account = &ctx.accounts.savings_token_account;
    let token_program = &ctx.accounts.token_program;
    let associated_token_program = &ctx.accounts.associated_token_program;
    let system_program = &ctx.accounts.system_program;

    // Record deposit in proxy statistics
    deposit_proxy.record_deposit()?;

    // Step 1: Transfer tokens from depositor to proxy
    let transfer_to_proxy = Transfer {
        from: ctx.accounts.depositor_token_account.to_account_info(),
        to: ctx.accounts.proxy_token_account.to_account_info(),
        authority: depositor.to_account_info(),
    };
    let transfer_to_proxy_ctx = CpiContext::new(token_program.to_account_info(), transfer_to_proxy);
    token::transfer(transfer_to_proxy_ctx, amount)?;

    // Step 2: Create CPI to savings program deposit_spl instruction
    let cpi_accounts = vec![
        savings_account.to_account_info(),
        proxy_owner.to_account_info(),
        ctx.accounts.proxy_token_account.to_account_info(),
        savings_token_account.to_account_info(),
        mint.to_account_info(),
        token_program.to_account_info(),
        associated_token_program.to_account_info(),
        system_program.to_account_info(),
    ];

    // Create the instruction data for deposit_spl (discriminator + amount)
    let mut instruction_data = vec![224, 0, 198, 175, 198, 47, 105, 204]; // deposit_spl discriminator
    instruction_data.extend_from_slice(&amount.to_le_bytes());

    let deposit_ix = Instruction {
        program_id: savings_program.key(),
        accounts: vec![
            AccountMeta::new(savings_account.key(), false),
            AccountMeta::new(proxy_owner.key(), true),
            AccountMeta::new(ctx.accounts.proxy_token_account.key(), false),
            AccountMeta::new(savings_token_account.key(), false),
            AccountMeta::new_readonly(mint.key(), false),
            AccountMeta::new_readonly(token_program.key(), false),
            AccountMeta::new_readonly(associated_token_program.key(), false),
            AccountMeta::new_readonly(system_program.key(), false),
        ],
        data: instruction_data,
    };

    // Create seeds for proxy signing
    let proxy_owner_key = deposit_proxy.owner;
    let seeds = &[b"deposit_proxy", proxy_owner_key.as_ref(), &[deposit_proxy.bump]];
    let signer = &[&seeds[..]];

    // Execute the CPI with proxy as signer for its token account
    anchor_lang::solana_program::program::invoke_signed(
        &deposit_ix,
        &cpi_accounts,
        signer,
    )?;

    msg!("Forwarded {} tokens of mint {} from {} to savings account for {}",
         amount, mint.key(), depositor.key(), proxy_owner.key());

    Ok(())
}