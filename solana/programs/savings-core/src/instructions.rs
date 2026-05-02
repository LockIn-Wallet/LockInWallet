use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

use crate::state::*;
use crate::error::ErrorCode;
use crate::constants::*;

// ============================================================
// Account Contexts
// ============================================================

#[derive(Accounts)]
pub struct InitializeProgramConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = ProgramConfig::INIT_SPACE,
        seeds = [b"program_config"],
        bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(
        mut,
        seeds = [b"program_config"],
        bump = program_config.bump,
        has_one = admin @ ErrorCode::Unauthorized,
    )]
    pub program_config: Account<'info, ProgramConfig>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(name: String, vault_nonce: u64)]
pub struct CreateVault<'info> {
    #[account(
        init,
        payer = creator,
        space = Vault::INIT_SPACE,
        seeds = [b"vault", creator.key().as_ref(), &vault_nonce.to_le_bytes()],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = creator,
        space = VaultMember::INIT_SPACE,
        seeds = [b"vault_member", vault.key().as_ref(), creator.key().as_ref()],
        bump,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String, vault_nonce: u64)]
pub struct CreateSplVault<'info> {
    #[account(
        init,
        payer = creator,
        space = Vault::INIT_SPACE,
        seeds = [b"vault", creator.key().as_ref(), &vault_nonce.to_le_bytes()],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = creator,
        space = VaultMember::INIT_SPACE,
        seeds = [b"vault_member", vault.key().as_ref(), creator.key().as_ref()],
        bump,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        init,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct JoinVault<'info> {
    #[account(
        mut,
        constraint = vault.vault_type == VaultType::Community @ ErrorCode::PersonalVaultOnly,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = member,
        space = VaultMember::INIT_SPACE,
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(
        mut,
        constraint = vault.is_sol_vault() @ ErrorCode::ExpectedSolVault,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSpl<'info> {
    #[account(
        mut,
        constraint = !vault.is_sol_vault() @ ErrorCode::ExpectedSplVault,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
        constraint = vault.token_mint == token_mint.key() @ ErrorCode::TokenMintMismatch,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = member,
    )]
    pub member_token_account: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(
        mut,
        constraint = vault.is_sol_vault() @ ErrorCode::ExpectedSolVault,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawSpl<'info> {
    #[account(
        mut,
        constraint = !vault.is_sol_vault() @ ErrorCode::ExpectedSplVault,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
        constraint = vault.token_mint == token_mint.key() @ ErrorCode::TokenMintMismatch,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = member,
    )]
    pub member_token_account: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawSolWithPenalty<'info> {
    #[account(
        mut,
        constraint = vault.is_sol_vault() @ ErrorCode::ExpectedSolVault,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        seeds = [b"program_config"],
        bump = program_config.bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,
    /// CHECK: Treasury receives penalty for personal vaults
    #[account(
        mut,
        constraint = treasury.key() == program_config.treasury_address @ ErrorCode::Unauthorized,
    )]
    pub treasury: AccountInfo<'info>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawSplWithPenalty<'info> {
    #[account(
        mut,
        constraint = !vault.is_sol_vault() @ ErrorCode::ExpectedSplVault,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
        constraint = vault.token_mint == token_mint.key() @ ErrorCode::TokenMintMismatch,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        seeds = [b"program_config"],
        bump = program_config.bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = member,
    )]
    pub member_token_account: Account<'info, TokenAccount>,
    /// Treasury ATA for SPL penalty on personal vaults
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,
    /// CHECK: Treasury account
    #[account(
        constraint = treasury.key() == program_config.treasury_address @ ErrorCode::Unauthorized,
    )]
    pub treasury: AccountInfo<'info>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimPenaltyRewards<'info> {
    #[account(
        mut,
        constraint = vault.is_sol_vault() @ ErrorCode::ExpectedSolVault,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimSplPenaltyRewards<'info> {
    #[account(
        mut,
        constraint = !vault.is_sol_vault() @ ErrorCode::ExpectedSplVault,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
        constraint = vault.token_mint == token_mint.key() @ ErrorCode::TokenMintMismatch,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = member,
    )]
    pub member_token_account: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct LeaveVault<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
        close = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateVaultRules<'info> {
    #[account(
        mut,
        has_one = creator @ ErrorCode::Unauthorized,
        constraint = vault.vault_type == VaultType::Personal @ ErrorCode::CommunityVaultImmutable,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    pub creator: Signer<'info>,
}

// ============================================================
// Withdrawal Destination Contexts
// ============================================================

/// Add a withdrawal destination directly (before setup commit / personal vault pre-lock).
#[derive(Accounts)]
pub struct AddWithdrawalDestination<'info> {
    #[account(
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        init,
        payer = member,
        space = WithdrawalDestination::INIT_SPACE,
        seeds = [b"withdrawal_dest", vault.key().as_ref(), member.key().as_ref(), destination.key().as_ref()],
        bump,
    )]
    pub withdrawal_dest: Account<'info, WithdrawalDestination>,
    /// CHECK: The destination address being whitelisted
    pub destination: AccountInfo<'info>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Request a withdrawal destination with timelock (post-setup).
#[derive(Accounts)]
pub struct RequestWithdrawalDestination<'info> {
    #[account(
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        init,
        payer = member,
        space = PendingDestinationRequest::INIT_SPACE,
        seeds = [b"pending_dest", vault.key().as_ref(), member.key().as_ref(), destination.key().as_ref()],
        bump,
    )]
    pub pending_request: Account<'info, PendingDestinationRequest>,
    /// CHECK: The destination address being requested
    pub destination: AccountInfo<'info>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Execute a pending withdrawal destination request after timelock.
#[derive(Accounts)]
pub struct ExecuteDestinationRequest<'info> {
    #[account(
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        mut,
        seeds = [b"pending_dest", vault.key().as_ref(), member.key().as_ref(), destination.key().as_ref()],
        bump = pending_request.bump,
        has_one = vault,
        has_one = member,
        close = member,
    )]
    pub pending_request: Account<'info, PendingDestinationRequest>,
    #[account(
        init,
        payer = member,
        space = WithdrawalDestination::INIT_SPACE,
        seeds = [b"withdrawal_dest", vault.key().as_ref(), member.key().as_ref(), destination.key().as_ref()],
        bump,
    )]
    pub withdrawal_dest: Account<'info, WithdrawalDestination>,
    /// CHECK: The destination address
    pub destination: AccountInfo<'info>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Cancel a pending withdrawal destination request.
#[derive(Accounts)]
pub struct CancelDestinationRequest<'info> {
    pub vault: Account<'info, Vault>,
    #[account(
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        mut,
        seeds = [b"pending_dest", vault.key().as_ref(), member.key().as_ref(), destination.key().as_ref()],
        bump = pending_request.bump,
        has_one = vault,
        has_one = member,
        close = member,
    )]
    pub pending_request: Account<'info, PendingDestinationRequest>,
    /// CHECK: The destination address
    pub destination: AccountInfo<'info>,
    #[account(mut)]
    pub member: Signer<'info>,
}

/// Remove an approved withdrawal destination.
#[derive(Accounts)]
pub struct RemoveWithdrawalDestination<'info> {
    pub vault: Account<'info, Vault>,
    #[account(
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        mut,
        seeds = [b"withdrawal_dest", vault.key().as_ref(), member.key().as_ref(), destination.key().as_ref()],
        bump = withdrawal_dest.bump,
        has_one = vault,
        has_one = member,
        close = member,
    )]
    pub withdrawal_dest: Account<'info, WithdrawalDestination>,
    /// CHECK: The destination address being removed
    pub destination: AccountInfo<'info>,
    #[account(mut)]
    pub member: Signer<'info>,
}

// ============================================================
// Rule Change Proposal Contexts
// ============================================================

/// Propose a rule change on a personal vault (timelock).
#[derive(Accounts)]
pub struct ProposeRuleChange<'info> {
    #[account(
        has_one = creator @ ErrorCode::Unauthorized,
        constraint = vault.vault_type == VaultType::Personal @ ErrorCode::CommunityVaultImmutable,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = creator,
        space = RuleChangeProposal::INIT_SPACE,
        seeds = [b"rule_proposal", vault.key().as_ref()],
        bump,
    )]
    pub proposal: Account<'info, RuleChangeProposal>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Execute a rule change proposal after timelock.
#[derive(Accounts)]
pub struct ExecuteRuleChange<'info> {
    #[account(
        mut,
        has_one = creator @ ErrorCode::Unauthorized,
        constraint = vault.vault_type == VaultType::Personal @ ErrorCode::CommunityVaultImmutable,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"rule_proposal", vault.key().as_ref()],
        bump = proposal.bump,
        has_one = vault,
        close = creator,
    )]
    pub proposal: Account<'info, RuleChangeProposal>,
    #[account(mut)]
    pub creator: Signer<'info>,
}

/// Cancel a rule change proposal.
#[derive(Accounts)]
pub struct CancelRuleChange<'info> {
    #[account(
        has_one = creator @ ErrorCode::Unauthorized,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"rule_proposal", vault.key().as_ref()],
        bump = proposal.bump,
        has_one = vault,
        close = creator,
    )]
    pub proposal: Account<'info, RuleChangeProposal>,
    #[account(mut)]
    pub creator: Signer<'info>,
}

// ============================================================
// Bypass Request Contexts
// ============================================================

/// Request a bypass withdrawal (timelock-based, no penalty).
#[derive(Accounts)]
pub struct RequestBypass<'info> {
    #[account(
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        init,
        payer = member,
        space = BypassRequest::INIT_SPACE,
        seeds = [b"bypass_request", vault.key().as_ref(), member.key().as_ref()],
        bump,
    )]
    pub bypass_request: Account<'info, BypassRequest>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Execute a bypass request after timelock — SOL vault.
#[derive(Accounts)]
pub struct ExecuteBypassSol<'info> {
    #[account(
        mut,
        constraint = vault.is_sol_vault() @ ErrorCode::ExpectedSolVault,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        mut,
        seeds = [b"bypass_request", vault.key().as_ref(), member.key().as_ref()],
        bump = bypass_request.bump,
        has_one = vault,
        has_one = member,
        close = member,
    )]
    pub bypass_request: Account<'info, BypassRequest>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Execute a bypass request after timelock — SPL vault.
#[derive(Accounts)]
pub struct ExecuteBypassSpl<'info> {
    #[account(
        mut,
        constraint = !vault.is_sol_vault() @ ErrorCode::ExpectedSplVault,
        constraint = vault.is_active @ ErrorCode::VaultNotActive,
        constraint = vault.token_mint == token_mint.key() @ ErrorCode::TokenMintMismatch,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        mut,
        seeds = [b"bypass_request", vault.key().as_ref(), member.key().as_ref()],
        bump = bypass_request.bump,
        has_one = vault,
        has_one = member,
        close = member,
    )]
    pub bypass_request: Account<'info, BypassRequest>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = member,
    )]
    pub member_token_account: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub member: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

/// Cancel a bypass request.
#[derive(Accounts)]
pub struct CancelBypass<'info> {
    pub vault: Account<'info, Vault>,
    #[account(
        seeds = [b"vault_member", vault.key().as_ref(), member.key().as_ref()],
        bump = vault_member.bump,
        has_one = vault,
        has_one = member,
    )]
    pub vault_member: Account<'info, VaultMember>,
    #[account(
        mut,
        seeds = [b"bypass_request", vault.key().as_ref(), member.key().as_ref()],
        bump = bypass_request.bump,
        has_one = vault,
        has_one = member,
        close = member,
    )]
    pub bypass_request: Account<'info, BypassRequest>,
    #[account(mut)]
    pub member: Signer<'info>,
}

// ============================================================
// Instruction Handlers
// ============================================================

pub fn initialize_program_config(
    ctx: Context<InitializeProgramConfig>,
    default_penalty_rate_bps: u16,
) -> Result<()> {
    require!(
        default_penalty_rate_bps > 0 && default_penalty_rate_bps <= MAX_PENALTY_BPS,
        ErrorCode::InvalidPenaltyRate,
    );
    let clock = Clock::get()?;
    let config = &mut ctx.accounts.program_config;
    config.treasury_address = ctx.accounts.admin.key();
    config.default_penalty_rate_bps = default_penalty_rate_bps;
    config.admin = ctx.accounts.admin.key();
    config.bump = ctx.bumps.program_config;
    config.created_at = clock.unix_timestamp;
    config.updated_at = clock.unix_timestamp;
    Ok(())
}

pub fn update_program_config(
    ctx: Context<UpdateProgramConfig>,
    new_treasury: Option<Pubkey>,
    new_penalty_rate_bps: Option<u16>,
) -> Result<()> {
    let clock = Clock::get()?;
    let config = &mut ctx.accounts.program_config;
    if let Some(treasury) = new_treasury {
        config.treasury_address = treasury;
    }
    if let Some(rate) = new_penalty_rate_bps {
        require!(rate > 0 && rate <= MAX_PENALTY_BPS, ErrorCode::InvalidPenaltyRate);
        config.default_penalty_rate_bps = rate;
    }
    config.updated_at = clock.unix_timestamp;
    Ok(())
}

fn validate_vault_params(
    name: &str,
    description: &str,
    daily_limit: u64,
    weekly_limit: u64,
    monthly_limit: u64,
    limits_are_percentage: bool,
    penalty_rate_bps: u16,
) -> Result<()> {
    require!(
        !name.is_empty() && name.len() <= MAX_VAULT_NAME_LENGTH,
        ErrorCode::InvalidVaultName,
    );
    require!(description.len() <= MAX_VAULT_DESCRIPTION_LENGTH, ErrorCode::InvalidVaultDescription);

    if limits_are_percentage {
        require!(daily_limit <= MAX_BPS as u64, ErrorCode::InvalidLimit);
        require!(weekly_limit <= MAX_BPS as u64, ErrorCode::InvalidLimit);
        require!(monthly_limit <= MAX_BPS as u64, ErrorCode::InvalidLimit);
    }

    require!(
        daily_limit > 0 || weekly_limit > 0 || monthly_limit > 0,
        ErrorCode::NoLimitsSet,
    );
    require!(
        penalty_rate_bps > 0 && penalty_rate_bps <= MAX_PENALTY_BPS,
        ErrorCode::InvalidPenaltyRate,
    );

    if daily_limit > 0 && weekly_limit > 0 {
        require!(weekly_limit >= daily_limit, ErrorCode::WeeklyLessThanDaily);
    }
    if weekly_limit > 0 && monthly_limit > 0 {
        require!(monthly_limit >= weekly_limit, ErrorCode::MonthlyLessThanWeekly);
    }
    if daily_limit > 0 && monthly_limit > 0 && weekly_limit == 0 {
        require!(monthly_limit >= daily_limit, ErrorCode::MonthlyLessThanWeekly);
    }

    Ok(())
}

fn init_vault_fields(
    vault: &mut Account<Vault>,
    creator: Pubkey,
    vault_type: VaultType,
    token_mint: Pubkey,
    name: String,
    description: String,
    daily_limit: u64,
    weekly_limit: u64,
    monthly_limit: u64,
    limits_are_percentage: bool,
    penalty_rate_bps: u16,
    vault_nonce: u64,
    bump: u8,
    clock: &Clock,
) {
    vault.creator = creator;
    vault.vault_type = vault_type;
    vault.token_mint = token_mint;
    vault.name = name;
    vault.description = description;
    vault.daily_limit = daily_limit;
    vault.weekly_limit = weekly_limit;
    vault.monthly_limit = monthly_limit;
    vault.limits_are_percentage = limits_are_percentage;
    vault.penalty_rate_bps = penalty_rate_bps;
    vault.vault_nonce = vault_nonce;
    vault.member_count = 1;
    vault.total_balance = 0;
    vault.accumulated_penalty_per_share = 0;
    vault.is_active = true;
    vault.created_at = clock.unix_timestamp;
    vault.updated_at = clock.unix_timestamp;
    vault.bump = bump;
}

fn init_member_fields(
    vm: &mut Account<VaultMember>,
    vault_key: Pubkey,
    member_key: Pubkey,
    bump: u8,
    clock: &Clock,
) {
    vm.vault = vault_key;
    vm.member = member_key;
    vm.balance = 0;
    vm.daily_spent = 0;
    vm.daily_last_reset = clock.unix_timestamp;
    vm.weekly_spent = 0;
    vm.weekly_last_reset = clock.unix_timestamp;
    vm.monthly_spent = 0;
    vm.monthly_last_reset = clock.unix_timestamp;
    vm.penalty_debt = 0;
    vm.unclaimed_penalties = 0;
    vm.joined_at = clock.unix_timestamp;
    vm.bump = bump;
}

/// Create a native SOL vault.
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
    validate_vault_params(
        &name, &description, daily_limit, weekly_limit,
        monthly_limit, limits_are_percentage, penalty_rate_bps,
    )?;
    let clock = Clock::get()?;

    init_vault_fields(
        &mut ctx.accounts.vault,
        ctx.accounts.creator.key(),
        vault_type,
        Pubkey::default(),
        name, description,
        daily_limit, weekly_limit, monthly_limit,
        limits_are_percentage, penalty_rate_bps, vault_nonce,
        ctx.bumps.vault, &clock,
    );

    init_member_fields(
        &mut ctx.accounts.vault_member,
        ctx.accounts.vault.key(),
        ctx.accounts.creator.key(),
        ctx.bumps.vault_member,
        &clock,
    );

    Ok(())
}

/// Create an SPL token vault (also creates the vault's ATA).
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
    validate_vault_params(
        &name, &description, daily_limit, weekly_limit,
        monthly_limit, limits_are_percentage, penalty_rate_bps,
    )?;
    let clock = Clock::get()?;

    init_vault_fields(
        &mut ctx.accounts.vault,
        ctx.accounts.creator.key(),
        vault_type,
        ctx.accounts.token_mint.key(),
        name, description,
        daily_limit, weekly_limit, monthly_limit,
        limits_are_percentage, penalty_rate_bps, vault_nonce,
        ctx.bumps.vault, &clock,
    );

    init_member_fields(
        &mut ctx.accounts.vault_member,
        ctx.accounts.vault.key(),
        ctx.accounts.creator.key(),
        ctx.bumps.vault_member,
        &clock,
    );

    Ok(())
}

/// Join a community vault.
pub fn join_vault(ctx: Context<JoinVault>) -> Result<()> {
    let clock = Clock::get()?;
    let vault = &mut ctx.accounts.vault;
    vault.member_count = vault.member_count
        .checked_add(1)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    vault.updated_at = clock.unix_timestamp;

    init_member_fields(
        &mut ctx.accounts.vault_member,
        vault.key(),
        ctx.accounts.member.key(),
        ctx.bumps.vault_member,
        &clock,
    );

    Ok(())
}

/// Deposit SOL into a SOL vault.
pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    let clock = Clock::get()?;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.member.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    let accumulated = ctx.accounts.vault.accumulated_penalty_per_share;
    ctx.accounts.vault_member.settle_penalties(accumulated);

    ctx.accounts.vault_member.balance = ctx.accounts.vault_member.balance
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    ctx.accounts.vault.total_balance = ctx.accounts.vault.total_balance
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    ctx.accounts.vault_member.snapshot_debt(ctx.accounts.vault.accumulated_penalty_per_share);
    ctx.accounts.vault.updated_at = clock.unix_timestamp;
    Ok(())
}

/// Deposit SPL tokens into an SPL vault.
pub fn deposit_spl(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    let clock = Clock::get()?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.member_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.member.to_account_info(),
            },
        ),
        amount,
    )?;

    let accumulated = ctx.accounts.vault.accumulated_penalty_per_share;
    ctx.accounts.vault_member.settle_penalties(accumulated);

    ctx.accounts.vault_member.balance = ctx.accounts.vault_member.balance
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    ctx.accounts.vault.total_balance = ctx.accounts.vault.total_balance
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    ctx.accounts.vault_member.snapshot_debt(ctx.accounts.vault.accumulated_penalty_per_share);
    ctx.accounts.vault.updated_at = clock.unix_timestamp;
    Ok(())
}

/// Withdraw SOL within spending limits.
pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(ctx.accounts.vault_member.balance >= amount, ErrorCode::InsufficientBalance);
    let clock = Clock::get()?;

    let accumulated = ctx.accounts.vault.accumulated_penalty_per_share;
    ctx.accounts.vault_member.settle_penalties(accumulated);

    let balance = ctx.accounts.vault_member.balance;
    ctx.accounts.vault_member.check_and_update_limits(
        amount, balance, &ctx.accounts.vault, clock.unix_timestamp,
    )?;

    let vault_info = ctx.accounts.vault.to_account_info();
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(vault_info.data_len());
    require!(
        vault_info.lamports() >= min_balance + amount,
        ErrorCode::InsufficientBalance,
    );

    **vault_info.try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.member.to_account_info().try_borrow_mut_lamports()? += amount;

    ctx.accounts.vault_member.balance = ctx.accounts.vault_member.balance
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    ctx.accounts.vault.total_balance = ctx.accounts.vault.total_balance
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    ctx.accounts.vault_member.snapshot_debt(ctx.accounts.vault.accumulated_penalty_per_share);
    ctx.accounts.vault.updated_at = clock.unix_timestamp;
    Ok(())
}

/// Withdraw SPL tokens within spending limits.
pub fn withdraw_spl(ctx: Context<WithdrawSpl>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(ctx.accounts.vault_member.balance >= amount, ErrorCode::InsufficientBalance);
    let clock = Clock::get()?;

    let accumulated = ctx.accounts.vault.accumulated_penalty_per_share;
    ctx.accounts.vault_member.settle_penalties(accumulated);

    let balance = ctx.accounts.vault_member.balance;
    ctx.accounts.vault_member.check_and_update_limits(
        amount, balance, &ctx.accounts.vault, clock.unix_timestamp,
    )?;

    let vault = &ctx.accounts.vault;
    let creator = vault.creator;
    let nonce_bytes = vault.vault_nonce.to_le_bytes();
    let bump = [vault.bump];
    let seeds: &[&[u8]] = &[b"vault", creator.as_ref(), nonce_bytes.as_ref(), &bump];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.member_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;

    ctx.accounts.vault_member.balance = ctx.accounts.vault_member.balance
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    ctx.accounts.vault.total_balance = ctx.accounts.vault.total_balance
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    ctx.accounts.vault_member.snapshot_debt(ctx.accounts.vault.accumulated_penalty_per_share);
    ctx.accounts.vault.updated_at = clock.unix_timestamp;
    Ok(())
}

/// Withdraw SOL with penalty — bypasses limits.
/// Community vault: penalty redistributed to other members.
/// Personal vault: penalty sent to treasury.
pub fn withdraw_sol_with_penalty(ctx: Context<WithdrawSolWithPenalty>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(ctx.accounts.vault_member.balance >= amount, ErrorCode::InsufficientBalance);
    let clock = Clock::get()?;

    let accumulated = ctx.accounts.vault.accumulated_penalty_per_share;
    ctx.accounts.vault_member.settle_penalties(accumulated);

    let penalty_bps = ctx.accounts.vault.penalty_rate_bps;
    let penalty_amount = ((amount as u128) * (penalty_bps as u128) / (MAX_BPS as u128)) as u64;
    let user_amount = amount.checked_sub(penalty_amount).ok_or(ErrorCode::ArithmeticOverflow)?;

    ctx.accounts.vault_member.balance = ctx.accounts.vault_member.balance
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    let vault_info = ctx.accounts.vault.to_account_info();
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(vault_info.data_len());

    if ctx.accounts.vault.vault_type == VaultType::Community {
        ctx.accounts.vault.total_balance = ctx.accounts.vault.total_balance
            .checked_sub(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        ctx.accounts.vault.record_penalty(penalty_amount);

        require!(
            vault_info.lamports() >= min_balance + user_amount,
            ErrorCode::InsufficientBalance,
        );
        **vault_info.try_borrow_mut_lamports()? -= user_amount;
        **ctx.accounts.member.to_account_info().try_borrow_mut_lamports()? += user_amount;
    } else {
        ctx.accounts.vault.total_balance = ctx.accounts.vault.total_balance
            .checked_sub(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        require!(
            vault_info.lamports() >= min_balance + user_amount + penalty_amount,
            ErrorCode::InsufficientBalance,
        );
        **vault_info.try_borrow_mut_lamports()? -= user_amount + penalty_amount;
        **ctx.accounts.member.to_account_info().try_borrow_mut_lamports()? += user_amount;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += penalty_amount;
    }

    ctx.accounts.vault_member.snapshot_debt(ctx.accounts.vault.accumulated_penalty_per_share);
    ctx.accounts.vault.updated_at = clock.unix_timestamp;
    Ok(())
}

/// Withdraw SPL tokens with penalty — bypasses limits.
pub fn withdraw_spl_with_penalty(ctx: Context<WithdrawSplWithPenalty>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(ctx.accounts.vault_member.balance >= amount, ErrorCode::InsufficientBalance);
    let clock = Clock::get()?;

    let accumulated = ctx.accounts.vault.accumulated_penalty_per_share;
    ctx.accounts.vault_member.settle_penalties(accumulated);

    let penalty_bps = ctx.accounts.vault.penalty_rate_bps;
    let penalty_amount = ((amount as u128) * (penalty_bps as u128) / (MAX_BPS as u128)) as u64;
    let user_amount = amount.checked_sub(penalty_amount).ok_or(ErrorCode::ArithmeticOverflow)?;

    ctx.accounts.vault_member.balance = ctx.accounts.vault_member.balance
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    let vault = &ctx.accounts.vault;
    let creator = vault.creator;
    let nonce_bytes = vault.vault_nonce.to_le_bytes();
    let bump = [vault.bump];
    let seeds: &[&[u8]] = &[b"vault", creator.as_ref(), nonce_bytes.as_ref(), &bump];

    if ctx.accounts.vault.vault_type == VaultType::Community {
        ctx.accounts.vault.total_balance = ctx.accounts.vault.total_balance
            .checked_sub(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        ctx.accounts.vault.record_penalty(penalty_amount);

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.member_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                &[seeds],
            ),
            user_amount,
        )?;
    } else {
        ctx.accounts.vault.total_balance = ctx.accounts.vault.total_balance
            .checked_sub(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.member_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                &[seeds],
            ),
            user_amount,
        )?;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                &[seeds],
            ),
            penalty_amount,
        )?;
    }

    ctx.accounts.vault_member.snapshot_debt(ctx.accounts.vault.accumulated_penalty_per_share);
    ctx.accounts.vault.updated_at = clock.unix_timestamp;
    Ok(())
}

/// Claim accumulated penalty rewards (SOL vault).
pub fn claim_penalty_rewards(ctx: Context<ClaimPenaltyRewards>) -> Result<()> {
    let accumulated = ctx.accounts.vault.accumulated_penalty_per_share;
    ctx.accounts.vault_member.settle_penalties(accumulated);

    let rewards = ctx.accounts.vault_member.unclaimed_penalties;
    require!(rewards > 0, ErrorCode::NoPenaltyRewards);

    let vault_info = ctx.accounts.vault.to_account_info();
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(vault_info.data_len());
    require!(
        vault_info.lamports() >= min_balance + rewards,
        ErrorCode::InsufficientBalance,
    );

    **vault_info.try_borrow_mut_lamports()? -= rewards;
    **ctx.accounts.member.to_account_info().try_borrow_mut_lamports()? += rewards;

    ctx.accounts.vault_member.unclaimed_penalties = 0;

    let clock = Clock::get()?;
    ctx.accounts.vault.updated_at = clock.unix_timestamp;
    Ok(())
}

/// Claim accumulated penalty rewards (SPL vault).
pub fn claim_spl_penalty_rewards(ctx: Context<ClaimSplPenaltyRewards>) -> Result<()> {
    let accumulated = ctx.accounts.vault.accumulated_penalty_per_share;
    ctx.accounts.vault_member.settle_penalties(accumulated);

    let rewards = ctx.accounts.vault_member.unclaimed_penalties;
    require!(rewards > 0, ErrorCode::NoPenaltyRewards);

    let vault = &ctx.accounts.vault;
    let creator = vault.creator;
    let nonce_bytes = vault.vault_nonce.to_le_bytes();
    let bump = [vault.bump];
    let seeds: &[&[u8]] = &[b"vault", creator.as_ref(), nonce_bytes.as_ref(), &bump];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.member_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[seeds],
        ),
        rewards,
    )?;

    ctx.accounts.vault_member.unclaimed_penalties = 0;

    let clock = Clock::get()?;
    ctx.accounts.vault.updated_at = clock.unix_timestamp;
    Ok(())
}

/// Leave a vault. Balance and unclaimed penalties must be zero.
pub fn leave_vault(ctx: Context<LeaveVault>) -> Result<()> {
    require!(ctx.accounts.vault_member.balance == 0, ErrorCode::BalanceNotZero);
    require!(ctx.accounts.vault_member.unclaimed_penalties == 0, ErrorCode::BalanceNotZero);

    let vault = &mut ctx.accounts.vault;
    vault.member_count = vault.member_count.saturating_sub(1);

    let clock = Clock::get()?;
    vault.updated_at = clock.unix_timestamp;

    Ok(())
}

/// Update rules on a personal vault (creator only).
pub fn update_vault_rules(
    ctx: Context<UpdateVaultRules>,
    daily_limit: Option<u64>,
    weekly_limit: Option<u64>,
    monthly_limit: Option<u64>,
    penalty_rate_bps: Option<u16>,
    limits_are_percentage: Option<bool>,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let daily = daily_limit.unwrap_or(vault.daily_limit);
    let weekly = weekly_limit.unwrap_or(vault.weekly_limit);
    let monthly = monthly_limit.unwrap_or(vault.monthly_limit);
    let penalty = penalty_rate_bps.unwrap_or(vault.penalty_rate_bps);
    let pct_mode = limits_are_percentage.unwrap_or(vault.limits_are_percentage);

    validate_vault_params(&vault.name, &vault.description, daily, weekly, monthly, pct_mode, penalty)?;

    vault.daily_limit = daily;
    vault.weekly_limit = weekly;
    vault.monthly_limit = monthly;
    vault.limits_are_percentage = pct_mode;
    vault.penalty_rate_bps = penalty;

    let clock = Clock::get()?;
    vault.updated_at = clock.unix_timestamp;
    Ok(())
}

// ============================================================
// Withdrawal Destination Handlers
// ============================================================

fn validate_destination_title(title: &str) -> Result<()> {
    require!(
        !title.is_empty() && title.len() <= WithdrawalDestination::MAX_TITLE_LENGTH,
        ErrorCode::InvalidDestinationTitle,
    );
    Ok(())
}

pub fn add_withdrawal_destination(
    ctx: Context<AddWithdrawalDestination>,
    title: String,
) -> Result<()> {
    validate_destination_title(&title)?;
    require!(
        ctx.accounts.destination.key() != ctx.accounts.member.key(),
        ErrorCode::CannotAddSelfAsDestination,
    );

    let clock = Clock::get()?;
    let dest = &mut ctx.accounts.withdrawal_dest;
    dest.vault = ctx.accounts.vault.key();
    dest.member = ctx.accounts.member.key();
    dest.destination = ctx.accounts.destination.key();
    dest.title = title;
    dest.added_at = clock.unix_timestamp;
    dest.bump = ctx.bumps.withdrawal_dest;
    Ok(())
}

pub fn request_withdrawal_destination(
    ctx: Context<RequestWithdrawalDestination>,
    title: String,
) -> Result<()> {
    validate_destination_title(&title)?;
    require!(
        ctx.accounts.destination.key() != ctx.accounts.member.key(),
        ErrorCode::CannotAddSelfAsDestination,
    );

    let clock = Clock::get()?;
    let req = &mut ctx.accounts.pending_request;
    req.vault = ctx.accounts.vault.key();
    req.member = ctx.accounts.member.key();
    req.destination = ctx.accounts.destination.key();
    req.title = title;
    req.execute_after = clock.unix_timestamp
        .checked_add(WITHDRAWAL_DESTINATION_TIMELOCK)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    req.created_at = clock.unix_timestamp;
    req.bump = ctx.bumps.pending_request;
    Ok(())
}

pub fn execute_destination_request(ctx: Context<ExecuteDestinationRequest>) -> Result<()> {
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= ctx.accounts.pending_request.execute_after,
        ErrorCode::TimelockNotExpired,
    );

    let req = &ctx.accounts.pending_request;
    let dest = &mut ctx.accounts.withdrawal_dest;
    dest.vault = req.vault;
    dest.member = req.member;
    dest.destination = req.destination;
    dest.title = req.title.clone();
    dest.added_at = clock.unix_timestamp;
    dest.bump = ctx.bumps.withdrawal_dest;
    Ok(())
}

pub fn cancel_destination_request(_ctx: Context<CancelDestinationRequest>) -> Result<()> {
    Ok(())
}

pub fn remove_withdrawal_destination(_ctx: Context<RemoveWithdrawalDestination>) -> Result<()> {
    Ok(())
}

// ============================================================
// Rule Change Proposal Handlers
// ============================================================

pub fn propose_rule_change(
    ctx: Context<ProposeRuleChange>,
    new_daily_limit: Option<u64>,
    new_weekly_limit: Option<u64>,
    new_monthly_limit: Option<u64>,
    new_penalty_rate_bps: Option<u16>,
    new_limits_are_percentage: Option<bool>,
) -> Result<()> {
    let vault = &ctx.accounts.vault;

    let daily = new_daily_limit.unwrap_or(vault.daily_limit);
    let weekly = new_weekly_limit.unwrap_or(vault.weekly_limit);
    let monthly = new_monthly_limit.unwrap_or(vault.monthly_limit);
    let penalty = new_penalty_rate_bps.unwrap_or(vault.penalty_rate_bps);
    let pct_mode = new_limits_are_percentage.unwrap_or(vault.limits_are_percentage);
    validate_vault_params(&vault.name, &vault.description, daily, weekly, monthly, pct_mode, penalty)?;

    let clock = Clock::get()?;
    let proposal = &mut ctx.accounts.proposal;
    proposal.vault = vault.key();
    proposal.proposer = ctx.accounts.creator.key();
    proposal.new_daily_limit = new_daily_limit;
    proposal.new_weekly_limit = new_weekly_limit;
    proposal.new_monthly_limit = new_monthly_limit;
    proposal.new_limits_are_percentage = new_limits_are_percentage;
    proposal.new_penalty_rate_bps = new_penalty_rate_bps;
    proposal.execute_after = clock.unix_timestamp
        .checked_add(PROPOSAL_TIMELOCK)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    proposal.created_at = clock.unix_timestamp;
    proposal.bump = ctx.bumps.proposal;
    Ok(())
}

pub fn execute_rule_change(ctx: Context<ExecuteRuleChange>) -> Result<()> {
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= ctx.accounts.proposal.execute_after,
        ErrorCode::TimelockNotExpired,
    );

    let proposal = &ctx.accounts.proposal;
    let vault = &mut ctx.accounts.vault;

    if let Some(daily) = proposal.new_daily_limit {
        vault.daily_limit = daily;
    }
    if let Some(weekly) = proposal.new_weekly_limit {
        vault.weekly_limit = weekly;
    }
    if let Some(monthly) = proposal.new_monthly_limit {
        vault.monthly_limit = monthly;
    }
    if let Some(pct) = proposal.new_limits_are_percentage {
        vault.limits_are_percentage = pct;
    }
    if let Some(penalty) = proposal.new_penalty_rate_bps {
        vault.penalty_rate_bps = penalty;
    }

    vault.updated_at = clock.unix_timestamp;
    Ok(())
}

pub fn cancel_rule_change(_ctx: Context<CancelRuleChange>) -> Result<()> {
    Ok(())
}

// ============================================================
// Bypass Request Handlers
// ============================================================

pub fn request_bypass(
    ctx: Context<RequestBypass>,
    amount: u64,
    is_sol: bool,
) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(ctx.accounts.vault_member.balance >= amount, ErrorCode::InsufficientBalance);

    let clock = Clock::get()?;
    let req = &mut ctx.accounts.bypass_request;
    req.vault = ctx.accounts.vault.key();
    req.member = ctx.accounts.member.key();
    req.amount = amount;
    req.is_sol = is_sol;
    req.token_mint = ctx.accounts.vault.token_mint;
    req.execute_after = clock.unix_timestamp
        .checked_add(BYPASS_REQUEST_TIMELOCK)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    req.created_at = clock.unix_timestamp;
    req.bump = ctx.bumps.bypass_request;
    Ok(())
}

pub fn execute_bypass_sol(ctx: Context<ExecuteBypassSol>) -> Result<()> {
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= ctx.accounts.bypass_request.execute_after,
        ErrorCode::TimelockNotExpired,
    );

    let amount = ctx.accounts.bypass_request.amount;
    require!(ctx.accounts.vault_member.balance >= amount, ErrorCode::InsufficientBalance);

    let accumulated = ctx.accounts.vault.accumulated_penalty_per_share;
    ctx.accounts.vault_member.settle_penalties(accumulated);

    let vault_info = ctx.accounts.vault.to_account_info();
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(vault_info.data_len());
    require!(
        vault_info.lamports() >= min_balance + amount,
        ErrorCode::InsufficientBalance,
    );

    **vault_info.try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.member.to_account_info().try_borrow_mut_lamports()? += amount;

    ctx.accounts.vault_member.balance = ctx.accounts.vault_member.balance
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    ctx.accounts.vault.total_balance = ctx.accounts.vault.total_balance
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    ctx.accounts.vault_member.snapshot_debt(ctx.accounts.vault.accumulated_penalty_per_share);
    ctx.accounts.vault.updated_at = clock.unix_timestamp;
    Ok(())
}

pub fn execute_bypass_spl(ctx: Context<ExecuteBypassSpl>) -> Result<()> {
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= ctx.accounts.bypass_request.execute_after,
        ErrorCode::TimelockNotExpired,
    );

    let amount = ctx.accounts.bypass_request.amount;
    require!(ctx.accounts.vault_member.balance >= amount, ErrorCode::InsufficientBalance);

    let accumulated = ctx.accounts.vault.accumulated_penalty_per_share;
    ctx.accounts.vault_member.settle_penalties(accumulated);

    let vault = &ctx.accounts.vault;
    let creator = vault.creator;
    let nonce_bytes = vault.vault_nonce.to_le_bytes();
    let bump = [vault.bump];
    let seeds: &[&[u8]] = &[b"vault", creator.as_ref(), nonce_bytes.as_ref(), &bump];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.member_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;

    ctx.accounts.vault_member.balance = ctx.accounts.vault_member.balance
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    ctx.accounts.vault.total_balance = ctx.accounts.vault.total_balance
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    ctx.accounts.vault_member.snapshot_debt(ctx.accounts.vault.accumulated_penalty_per_share);
    ctx.accounts.vault.updated_at = clock.unix_timestamp;
    Ok(())
}

pub fn cancel_bypass(_ctx: Context<CancelBypass>) -> Result<()> {
    Ok(())
}
