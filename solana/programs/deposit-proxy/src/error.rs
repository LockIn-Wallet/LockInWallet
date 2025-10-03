use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount - must be greater than zero")]
    InvalidAmount,

    #[msg("Unauthorized access")]
    UnauthorizedAccess,

    #[msg("Invalid savings program")]
    InvalidSavingsProgram,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Proxy already exists for this user")]
    ProxyAlreadyExists,

    #[msg("Cross-program invocation failed")]
    CpiCallFailed,
}