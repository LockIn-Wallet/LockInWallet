use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Insufficient balance")]
    InsufficientBalance,

    #[msg("Spending limit exceeded for this period")]
    SpendingLimitExceeded,

    #[msg("Vault name is empty or too long")]
    InvalidVaultName,

    #[msg("Vault description is too long")]
    InvalidVaultDescription,

    #[msg("Invalid limit: percentage mode values must be 0-10000 basis points")]
    InvalidLimit,

    #[msg("Invalid penalty rate: must be 1-5000 basis points (0.01%-50%)")]
    InvalidPenaltyRate,

    #[msg("At least one withdrawal limit must be set")]
    NoLimitsSet,

    #[msg("Only personal vaults allow rule changes")]
    CommunityVaultImmutable,

    #[msg("Cannot join a personal vault")]
    PersonalVaultOnly,

    #[msg("Vault is not active")]
    VaultNotActive,

    #[msg("Already a member of this vault")]
    AlreadyMember,

    #[msg("Member balance must be zero to leave")]
    BalanceNotZero,

    #[msg("No penalty rewards to claim")]
    NoPenaltyRewards,

    #[msg("Token mint does not match vault")]
    TokenMintMismatch,

    #[msg("Unauthorized: only admin can perform this action")]
    Unauthorized,

    #[msg("Vault is a SOL vault, use SOL instructions")]
    ExpectedSolVault,

    #[msg("Vault is an SPL vault, use SPL instructions")]
    ExpectedSplVault,

    #[msg("Weekly limit must be >= daily limit")]
    WeeklyLessThanDaily,

    #[msg("Monthly limit must be >= weekly limit")]
    MonthlyLessThanWeekly,

    #[msg("Timelock has not expired yet")]
    TimelockNotExpired,

    #[msg("Destination title is empty or too long")]
    InvalidDestinationTitle,

    #[msg("Cannot add own address as withdrawal destination")]
    CannotAddSelfAsDestination,

    #[msg("Active bypass request already exists")]
    BypassRequestExists,

    #[msg("Active rule change proposal already exists")]
    ProposalAlreadyExists,
}
