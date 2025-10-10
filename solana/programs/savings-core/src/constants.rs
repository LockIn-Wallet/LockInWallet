// Timelock Constants
// These constants are conditionally compiled based on cargo features

// Development timelocks (15 seconds) - used by default for fast testing
#[cfg(feature = "dev-timelock")]
pub const PROPOSAL_TIMELOCK: i64 = 15;

#[cfg(feature = "dev-timelock")]
pub const WITHDRAWAL_DESTINATION_TIMELOCK: i64 = 15;

#[cfg(feature = "dev-timelock")]
pub const BYPASS_REQUEST_TIMELOCK: i64 = 15;

// Production timelocks (24 hours) - for future --prod flag
#[cfg(feature = "prod-timelock")]
pub const PROPOSAL_TIMELOCK: i64 = 24 * 60 * 60; // 24 hours

#[cfg(feature = "prod-timelock")]
pub const WITHDRAWAL_DESTINATION_TIMELOCK: i64 = 86400; // 24 hours

#[cfg(feature = "prod-timelock")]
pub const BYPASS_REQUEST_TIMELOCK: i64 = 86400; // 24 hours

// Compile-time validation to ensure exactly one timelock feature is enabled
#[cfg(all(feature = "dev-timelock", feature = "prod-timelock"))]
compile_error!("Cannot enable both dev-timelock and prod-timelock features");

#[cfg(not(any(feature = "dev-timelock", feature = "prod-timelock")))]
compile_error!("Must enable either dev-timelock or prod-timelock feature");