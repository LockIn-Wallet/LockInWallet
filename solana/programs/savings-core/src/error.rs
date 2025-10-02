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
}