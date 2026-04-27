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

    // Withdrawal destinations related errors
    #[msg("Invalid parameters provided")]
    InvalidParameters,

    #[msg("Too many withdrawal destinations (max 20 allowed)")]
    TooManyDestinations,

    #[msg("Destination address already exists")]
    DestinationAlreadyExists,

    #[msg("Cannot set own address as withdrawal destination")]
    CannotSetOwnAddress,

    #[msg("Withdrawal destination not found")]
    DestinationNotFound,

    #[msg("Destination is not approved for withdrawals")]
    DestinationNotApproved,

    // Bypass requests related errors
    #[msg("Too many bypass requests (max 10 allowed)")]
    TooManyBypassRequests,

    #[msg("Request is still in timelock period")]
    RequestStillInTimelock,

    #[msg("Bypass request not found")]
    RequestNotFound,

    // Proxy related errors
    #[msg("Invalid savings program")]
    InvalidSavingsProgram,

    #[msg("Proxy already exists for this user")]
    ProxyAlreadyExists,

    #[msg("Cross-program invocation failed")]
    CpiCallFailed,

    // Payment activation related errors
    #[msg("Permanent address already activated")]
    AlreadyActivated,

    #[msg("Invalid treasury address")]
    InvalidTreasuryAddress,

    #[msg("Unauthorized: only admin can perform this action")]
    Unauthorized,

    #[msg("Permanent address not activated - payment required")]
    PermanentAddressNotActivated,

    #[msg("Insufficient funds for activation fee")]
    InsufficientFundsForActivation,

    #[msg("Invalid penalty rate: must be between 0 and 5000 basis points (50%)")]
    InvalidPenaltyRate,

    #[msg("Program config not initialized - penalty rate not available")]
    ProgramConfigNotInitialized,
}