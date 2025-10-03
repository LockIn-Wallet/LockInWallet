use anchor_lang::prelude::*;

/// Custom error codes for the savings program
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount: amount must be greater than zero")]
    InvalidAmount,

    #[msg("Math overflow occurred")]
    ArithmeticOverflow,

    #[msg("Too many different tokens in account (max 10 supported)")]
    TokenLimitExceeded,

    #[msg("Insufficient balance for this operation")]
    InsufficientBalance,

    #[msg("Unauthorized access to this savings account")]
    UnauthorizedAccess,

    #[msg("Account not properly initialized")]
    AccountNotInitialized,

    // Spending limits related errors
    #[msg("Spending limit exceeded for this time period")]
    SpendingLimitExceeded,

    #[msg("Invalid spending limit parameters")]
    InvalidLimitParameters,

    #[msg("Setup must be committed before withdrawals are allowed")]
    SetupNotCommitted,

    #[msg("Spending limits account not found")]
    SpendingLimitsNotFound,

    #[msg("Period limit not found")]
    PeriodLimitNotFound,
}