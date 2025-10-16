use anchor_lang::prelude::*;

/// Main savings account that stores user's deposit information
/// Similar to the userTokenBalances mapping in your EVM contract
#[account]
#[derive(Default)]
pub struct SavingsAccount {
    /// The owner of this savings account
    pub owner: Pubkey,

    /// Total SOL deposited (in lamports)
    pub sol_balance: u64,

    /// SPL token balances
    pub spl_balances: Vec<TokenBalance>,

    /// Bump seed for this PDA
    pub bump: u8,

    /// When this account was created
    pub created_at: i64,

    /// Last update timestamp
    pub updated_at: i64,

    /// Approved withdrawal destinations (addresses user can withdraw to)
    pub withdrawal_destinations: Vec<WithdrawalDestination>,

    /// Pending withdrawal destination requests (addresses pending approval with timelock)
    pub pending_withdrawal_destination_requests: Vec<PendingWithdrawalDestinationRequest>,

    /// Pending bypass requests for withdrawals exceeding spending limits
    pub pending_bypass_requests: Vec<BypassRequest>,

    /// Whether permanent address functionality has been activated with payment
    pub permanent_address_activated: bool,

    /// The transaction signature of the activation payment (for verification)
    pub activation_payment_signature: Vec<u8>,

    /// When the permanent address was activated (Unix timestamp)
    pub activated_at: i64,
}

/// Represents a balance for a specific SPL token
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct TokenBalance {
    /// The mint address of the SPL token
    pub mint: Pubkey,

    /// The amount of tokens deposited
    pub amount: u64,
}

/// Represents an approved withdrawal destination address
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct WithdrawalDestination {
    /// The destination address
    pub address: Pubkey,

    /// Optional title/label for this destination
    pub title: String,

    /// When this destination was added
    pub added_at: i64,

    /// Whether this destination is currently active
    pub active: bool,
}

/// Represents a pending bypass request for withdrawals exceeding spending limits
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct BypassRequest {
    /// Unique identifier for this request
    pub request_id: [u8; 32],

    /// Amount to withdraw (in lamports for SOL, token units for SPL)
    pub amount: u64,

    /// Token mint (use System Program ID for SOL)
    pub token_mint: Pubkey,

    /// Which spending period this request is bypassing
    pub bypassing_period: String,

    /// Destination address for the withdrawal
    pub destination: Pubkey,

    /// Unix timestamp when this request can be executed (24 hours after creation)
    pub execute_after: i64,

    /// Whether this request has been executed
    pub executed: bool,

    /// Whether this request has been cancelled
    pub cancelled: bool,

    /// When this request was created
    pub created_at: i64,
}

/// Represents a pending withdrawal destination request (similar to EVM timelock system)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct PendingWithdrawalDestinationRequest {
    /// Unique identifier for this request
    pub request_id: [u8; 32],

    /// The destination address to be added
    pub address: Pubkey,

    /// Title/label for this destination
    pub title: String,

    /// Unix timestamp when this request can be executed (24 hours after creation)
    pub execute_after: i64,

    /// Whether this request has been executed
    pub executed: bool,

    /// Whether this request has been cancelled
    pub cancelled: bool,

    /// When this request was created
    pub created_at: i64,
}

impl SavingsAccount {
    /// Size calculation for account space allocation
    pub const DISCRIMINATOR_SIZE: usize = 8;
    pub const PUBKEY_SIZE: usize = 32;
    pub const U64_SIZE: usize = 8;
    pub const U8_SIZE: usize = 1;
    pub const I64_SIZE: usize = 8;
    pub const VEC_OVERHEAD: usize = 4; // Vec length prefix
    pub const STRING_OVERHEAD: usize = 4; // String length prefix
    pub const BOOL_SIZE: usize = 1;
    pub const TOKEN_BALANCE_SIZE: usize = 32 + 8; // Pubkey + u64
    pub const MAX_TOKENS: usize = 10; // Support up to 10 different tokens initially
    pub const MAX_WITHDRAWAL_DESTINATIONS: usize = 20; // Support up to 20 withdrawal destinations
    pub const MAX_PENDING_WITHDRAWAL_DESTINATION_REQUESTS: usize = 5; // Support up to 5 pending destination requests
    pub const MAX_BYPASS_REQUESTS: usize = 10; // Support up to 10 pending bypass requests
    pub const MAX_TITLE_LENGTH: usize = 64; // Max characters for destination title
    pub const MAX_PERIOD_NAME_LENGTH: usize = 32; // Max characters for period name

    // WithdrawalDestination size calculation
    pub const WITHDRAWAL_DESTINATION_SIZE: usize = Self::PUBKEY_SIZE // address
        + Self::STRING_OVERHEAD + Self::MAX_TITLE_LENGTH // title
        + Self::I64_SIZE // added_at
        + Self::BOOL_SIZE; // active

    // PendingWithdrawalDestinationRequest size calculation
    pub const PENDING_WITHDRAWAL_DESTINATION_REQUEST_SIZE: usize = 32 // request_id ([u8; 32])
        + Self::PUBKEY_SIZE // address
        + Self::STRING_OVERHEAD + Self::MAX_TITLE_LENGTH // title
        + Self::I64_SIZE // execute_after
        + Self::BOOL_SIZE // executed
        + Self::BOOL_SIZE // cancelled
        + Self::I64_SIZE; // created_at

    // BypassRequest size calculation
    pub const BYPASS_REQUEST_SIZE: usize = 32 // request_id ([u8; 32])
        + Self::U64_SIZE // amount
        + Self::PUBKEY_SIZE // token_mint
        + Self::STRING_OVERHEAD + Self::MAX_PERIOD_NAME_LENGTH // bypassing_period
        + Self::PUBKEY_SIZE // destination
        + Self::I64_SIZE // execute_after
        + Self::BOOL_SIZE // executed
        + Self::BOOL_SIZE // cancelled
        + Self::I64_SIZE; // created_at

    pub const INIT_SPACE: usize = Self::DISCRIMINATOR_SIZE
        + Self::PUBKEY_SIZE // owner
        + Self::U64_SIZE // sol_balance
        + Self::VEC_OVERHEAD + (Self::TOKEN_BALANCE_SIZE * Self::MAX_TOKENS) // spl_balances
        + Self::U8_SIZE // bump
        + Self::I64_SIZE // created_at
        + Self::I64_SIZE // updated_at
        + Self::VEC_OVERHEAD + (Self::WITHDRAWAL_DESTINATION_SIZE * Self::MAX_WITHDRAWAL_DESTINATIONS) // withdrawal_destinations
        + Self::VEC_OVERHEAD + (Self::PENDING_WITHDRAWAL_DESTINATION_REQUEST_SIZE * Self::MAX_PENDING_WITHDRAWAL_DESTINATION_REQUESTS) // pending_withdrawal_destination_requests
        + Self::VEC_OVERHEAD + (Self::BYPASS_REQUEST_SIZE * Self::MAX_BYPASS_REQUESTS) // pending_bypass_requests
        + Self::BOOL_SIZE // permanent_address_activated
        + Self::VEC_OVERHEAD + 64 // activation_payment_signature (Vec<u8> with max 64 bytes)
        + Self::I64_SIZE; // activated_at

    /// Update or add a token balance
    pub fn update_token_balance(&mut self, mint: Pubkey, amount: u64) -> Result<()> {
        // Find existing token balance
        for token_balance in &mut self.spl_balances {
            if token_balance.mint == mint {
                token_balance.amount = token_balance.amount.checked_add(amount)
                    .ok_or(crate::error::ErrorCode::ArithmeticOverflow)?;
                return Ok(());
            }
        }

        // If token not found, add new entry
        if self.spl_balances.len() >= Self::MAX_TOKENS {
            return Err(crate::error::ErrorCode::TokenLimitExceeded.into());
        }

        self.spl_balances.push(TokenBalance { mint, amount });
        Ok(())
    }

    /// Get token balance for a specific mint
    pub fn get_token_balance(&self, mint: Pubkey) -> u64 {
        for token_balance in &self.spl_balances {
            if token_balance.mint == mint {
                return token_balance.amount;
            }
        }
        0
    }

    /// Add a new withdrawal destination
    pub fn add_withdrawal_destination(&mut self, address: Pubkey, title: String, current_time: i64) -> Result<()> {
        require!(!title.is_empty() && title.len() <= Self::MAX_TITLE_LENGTH, crate::error::ErrorCode::InvalidParameters);
        require!(self.withdrawal_destinations.len() < Self::MAX_WITHDRAWAL_DESTINATIONS, crate::error::ErrorCode::TooManyDestinations);

        // Check if destination already exists
        for dest in &self.withdrawal_destinations {
            if dest.address == address && dest.active {
                return Err(crate::error::ErrorCode::DestinationAlreadyExists.into());
            }
        }

        // Check if user is trying to add their own address (not allowed for security)
        require!(address != self.owner, crate::error::ErrorCode::CannotSetOwnAddress);

        self.withdrawal_destinations.push(WithdrawalDestination {
            address,
            title,
            added_at: current_time,
            active: true,
        });

        Ok(())
    }

    /// Remove a withdrawal destination
    pub fn remove_withdrawal_destination(&mut self, address: Pubkey) -> Result<()> {
        for dest in &mut self.withdrawal_destinations {
            if dest.address == address && dest.active {
                dest.active = false;
                return Ok(());
            }
        }
        Err(crate::error::ErrorCode::DestinationNotFound.into())
    }

    /// Check if a destination is approved
    pub fn is_destination_approved(&self, address: Pubkey) -> bool {
        // Owner can always withdraw to self
        if address == self.owner {
            return true;
        }

        for dest in &self.withdrawal_destinations {
            if dest.address == address && dest.active {
                return true;
            }
        }
        false
    }

    /// Add a new pending withdrawal destination request (with timelock)
    pub fn add_pending_withdrawal_destination_request(
        &mut self,
        request_id: [u8; 32],
        address: Pubkey,
        title: String,
        current_time: i64,
    ) -> Result<()> {
        require!(!title.is_empty() && title.len() <= Self::MAX_TITLE_LENGTH, crate::error::ErrorCode::InvalidParameters);
        require!(self.pending_withdrawal_destination_requests.len() < Self::MAX_PENDING_WITHDRAWAL_DESTINATION_REQUESTS, crate::error::ErrorCode::TooManyDestinations);

        // Check if destination already exists or is already pending
        for dest in &self.withdrawal_destinations {
            if dest.address == address && dest.active {
                return Err(crate::error::ErrorCode::DestinationAlreadyExists.into());
            }
        }
        for pending in &self.pending_withdrawal_destination_requests {
            if pending.address == address && !pending.executed && !pending.cancelled {
                return Err(crate::error::ErrorCode::DestinationAlreadyExists.into());
            }
        }

        // Check if user is trying to add their own address (not allowed for security)
        require!(address != self.owner, crate::error::ErrorCode::CannotSetOwnAddress);

        // Timelock (configurable via cargo features)
        let execute_after = current_time + crate::constants::WITHDRAWAL_DESTINATION_TIMELOCK;

        self.pending_withdrawal_destination_requests.push(PendingWithdrawalDestinationRequest {
            request_id,
            address,
            title,
            execute_after,
            executed: false,
            cancelled: false,
            created_at: current_time,
        });

        Ok(())
    }

    /// Execute a pending withdrawal destination request
    pub fn execute_pending_withdrawal_destination_request(
        &mut self,
        request_id: [u8; 32],
        current_time: i64,
    ) -> Result<PendingWithdrawalDestinationRequest> {
        // First find the request and extract the data we need
        let mut found_request: Option<PendingWithdrawalDestinationRequest> = None;

        for request in &mut self.pending_withdrawal_destination_requests {
            if request.request_id == request_id && !request.executed && !request.cancelled {
                require!(current_time >= request.execute_after, crate::error::ErrorCode::RequestStillInTimelock);

                // Mark as executed and copy the request data
                request.executed = true;
                found_request = Some(request.clone());
                break;
            }
        }

        if let Some(request) = found_request {
            // Now add the destination to the approved list (no longer borrowing the requests array)
            self.add_withdrawal_destination(request.address, request.title.clone(), current_time)?;
            Ok(request)
        } else {
            Err(crate::error::ErrorCode::RequestNotFound.into())
        }
    }

    /// Cancel a pending withdrawal destination request
    pub fn cancel_pending_withdrawal_destination_request(&mut self, request_id: [u8; 32]) -> Result<()> {
        for request in &mut self.pending_withdrawal_destination_requests {
            if request.request_id == request_id && !request.executed && !request.cancelled {
                request.cancelled = true;
                return Ok(());
            }
        }
        Err(crate::error::ErrorCode::RequestNotFound.into())
    }

    /// Get active pending withdrawal destination requests
    pub fn get_active_pending_withdrawal_destination_requests(&self) -> Vec<PendingWithdrawalDestinationRequest> {
        self.pending_withdrawal_destination_requests
            .iter()
            .filter(|r| !r.executed && !r.cancelled)
            .cloned()
            .collect()
    }

    /// Add a new bypass request
    pub fn add_bypass_request(
        &mut self,
        request_id: [u8; 32],
        amount: u64,
        token_mint: Pubkey,
        bypassing_period: String,
        destination: Pubkey,
        current_time: i64,
    ) -> Result<()> {
        require!(self.pending_bypass_requests.len() < Self::MAX_BYPASS_REQUESTS, crate::error::ErrorCode::TooManyBypassRequests);
        require!(amount > 0, crate::error::ErrorCode::InvalidParameters);
        require!(!bypassing_period.is_empty() && bypassing_period.len() <= Self::MAX_PERIOD_NAME_LENGTH, crate::error::ErrorCode::InvalidParameters);

        // Check if destination is approved
        require!(self.is_destination_approved(destination), crate::error::ErrorCode::DestinationNotApproved);

        // Timelock (configurable via cargo features)
        let execute_after = current_time + crate::constants::BYPASS_REQUEST_TIMELOCK;

        self.pending_bypass_requests.push(BypassRequest {
            request_id,
            amount,
            token_mint,
            bypassing_period,
            destination,
            execute_after,
            executed: false,
            cancelled: false,
            created_at: current_time,
        });

        Ok(())
    }

    /// Execute a bypass request
    pub fn execute_bypass_request(&mut self, request_id: [u8; 32], current_time: i64) -> Result<BypassRequest> {
        for request in &mut self.pending_bypass_requests {
            if request.request_id == request_id && !request.executed && !request.cancelled {
                require!(current_time >= request.execute_after, crate::error::ErrorCode::RequestStillInTimelock);
                request.executed = true;
                return Ok(request.clone());
            }
        }
        Err(crate::error::ErrorCode::RequestNotFound.into())
    }

    /// Cancel a bypass request
    pub fn cancel_bypass_request(&mut self, request_id: [u8; 32]) -> Result<()> {
        for request in &mut self.pending_bypass_requests {
            if request.request_id == request_id && !request.executed && !request.cancelled {
                request.cancelled = true;
                return Ok(());
            }
        }
        Err(crate::error::ErrorCode::RequestNotFound.into())
    }

    /// Get active bypass requests
    pub fn get_active_bypass_requests(&self) -> Vec<BypassRequest> {
        self.pending_bypass_requests
            .iter()
            .filter(|r| !r.executed && !r.cancelled)
            .cloned()
            .collect()
    }
}

/// Spending limits account that stores user's spending control configuration
/// Similar to the userSpendingLimits mapping in your EVM contract
#[account]
#[derive(Default)]
pub struct SpendingLimitsAccount {
    /// The owner of this spending limits account
    pub owner: Pubkey,

    /// Array of time-based spending limits (Daily, Weekly, Monthly, Custom)
    pub time_period_limits: Vec<TimePeriodLimit>,

    /// Pending proposals for limit changes (mirrors EVM proposal system)
    pub pending_proposals: Vec<PendingProposal>,

    /// Setup and configuration data
    pub setup_data: UserSetupData,

    /// Bump seed for this PDA
    pub bump: u8,

    /// When this account was created
    pub created_at: i64,

    /// Last update timestamp
    pub updated_at: i64,
}

/// Represents a time-based spending limit (mirrors EVM TimePeriodLimit struct)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct TimePeriodLimit {
    /// Spending limit for this period (in lamports for SOL, token amount for SPL)
    pub limit: u64,

    /// Amount spent in current period
    pub spent: u64,

    /// When this period was last reset (Unix timestamp)
    pub last_reset: i64,

    /// Period duration in seconds (86400 for daily, 604800 for weekly, etc.)
    pub duration: u64,

    /// Period name ("Daily", "Weekly", "Monthly", "Custom Salary", etc.)
    pub name: String,

    /// Whether this limit is currently active
    pub active: bool,
}

/// Pending proposal for spending limit changes (mirrors EVM proposal system)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct PendingProposal {
    /// Unique identifier for this proposal
    pub proposal_id: [u8; 32],

    /// Period name being modified ("Daily", "Weekly", "Monthly", etc.)
    pub period_name: String,

    /// New limit being proposed
    pub new_limit: u64,

    /// Unix timestamp when this proposal can be executed
    pub execute_after: i64,

    /// Whether this proposal has been executed
    pub executed: bool,

    /// Whether this is a limit increase (true) or decrease/removal (false)
    pub is_increase: bool,

    /// When this proposal was created
    pub created_at: i64,
}

/// User setup and configuration data (mirrors EVM UserSetupData struct)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Default)]
pub struct UserSetupData {
    /// Track if user has committed initial setup
    pub has_committed_setup: bool,

    /// Total value locked across all periods (for validation)
    pub total_locked_value: u64,

    /// When setup was committed (Unix timestamp)
    pub commit_timestamp: i64,

    /// Track period start for increase limits
    pub last_increase_timestamp: i64,

    /// Amount increased in current 7-day period
    pub increases_in_period: u64,
}

impl SpendingLimitsAccount {
    /// Size calculation for account space allocation
    pub const DISCRIMINATOR_SIZE: usize = 8;
    pub const PUBKEY_SIZE: usize = 32;
    pub const U64_SIZE: usize = 8;
    pub const U8_SIZE: usize = 1;
    pub const I64_SIZE: usize = 8;
    pub const BOOL_SIZE: usize = 1;
    pub const VEC_OVERHEAD: usize = 4; // Vec length prefix
    pub const STRING_OVERHEAD: usize = 4; // String length prefix
    pub const MAX_NAME_LENGTH: usize = 32; // Max characters for period name
    pub const MAX_PERIODS: usize = 10; // Support up to 10 different time periods
    pub const MAX_PROPOSALS: usize = 5; // Support up to 5 pending proposals

    // TimePeriodLimit size calculation
    pub const TIME_PERIOD_LIMIT_SIZE: usize = Self::U64_SIZE // limit
        + Self::U64_SIZE // spent
        + Self::I64_SIZE // last_reset
        + Self::U64_SIZE // duration
        + Self::STRING_OVERHEAD + Self::MAX_NAME_LENGTH // name
        + Self::BOOL_SIZE; // active

    // PendingProposal size calculation
    pub const PENDING_PROPOSAL_SIZE: usize = 32 // proposal_id ([u8; 32])
        + Self::STRING_OVERHEAD + Self::MAX_NAME_LENGTH // period_name
        + Self::U64_SIZE // new_limit
        + Self::I64_SIZE // execute_after
        + Self::BOOL_SIZE // executed
        + Self::BOOL_SIZE // is_increase
        + Self::I64_SIZE; // created_at

    // UserSetupData size calculation
    pub const USER_SETUP_DATA_SIZE: usize = Self::BOOL_SIZE // has_committed_setup
        + Self::U64_SIZE // total_locked_value
        + Self::I64_SIZE // commit_timestamp
        + Self::I64_SIZE // last_increase_timestamp
        + Self::U64_SIZE; // increases_in_period

    pub const INIT_SPACE: usize = Self::DISCRIMINATOR_SIZE
        + Self::PUBKEY_SIZE // owner
        + Self::VEC_OVERHEAD + (Self::TIME_PERIOD_LIMIT_SIZE * Self::MAX_PERIODS) // time_period_limits
        + Self::VEC_OVERHEAD + (Self::PENDING_PROPOSAL_SIZE * Self::MAX_PROPOSALS) // pending_proposals
        + Self::USER_SETUP_DATA_SIZE // setup_data
        + Self::U8_SIZE // bump
        + Self::I64_SIZE // created_at
        + Self::I64_SIZE; // updated_at

    /// Add or update a time period limit
    pub fn add_time_period_limit(
        &mut self,
        name: String,
        limit: u64,
        duration: u64,
        current_time: i64,
    ) -> Result<()> {
        require!(limit > 0, crate::error::ErrorCode::InvalidLimitParameters);
        require!(duration >= 3600, crate::error::ErrorCode::InvalidLimitParameters); // At least 1 hour
        require!(!name.is_empty() && name.len() <= Self::MAX_NAME_LENGTH, crate::error::ErrorCode::InvalidLimitParameters);

        // Check if period already exists
        for period in &mut self.time_period_limits {
            if period.name == name {
                // Update existing period
                period.limit = limit;
                period.duration = duration;
                period.active = true;
                return Ok(());
            }
        }

        // Add new period if we haven't reached the limit
        if self.time_period_limits.len() >= Self::MAX_PERIODS {
            return Err(crate::error::ErrorCode::TokenLimitExceeded.into());
        }

        self.time_period_limits.push(TimePeriodLimit {
            limit,
            spent: 0,
            last_reset: current_time,
            duration,
            name,
            active: true,
        });

        Ok(())
    }

    /// Remove a time period limit by name
    pub fn remove_time_period_limit(&mut self, name: &str) -> Result<()> {
        for period in &mut self.time_period_limits {
            if period.name == name {
                period.active = false;
                return Ok(());
            }
        }
        Err(crate::error::ErrorCode::InvalidLimitParameters.into())
    }

    /// Check if withdrawal amount is within all active limits
    pub fn check_spending_limits(&mut self, amount: u64, current_time: i64) -> Result<()> {
        for period in &mut self.time_period_limits {
            if !period.active {
                continue;
            }

            // Reset period if duration has passed
            if current_time >= period.last_reset + period.duration as i64 {
                period.last_reset = current_time;
                period.spent = 0;
            }

            // Check if this withdrawal would exceed the period limit
            if period.spent + amount > period.limit {
                return Err(crate::error::ErrorCode::SpendingLimitExceeded.into());
            }
        }
        Ok(())
    }

    /// Update spending for all active periods after successful withdrawal
    pub fn update_spending(&mut self, amount: u64, current_time: i64) -> Result<()> {
        for period in &mut self.time_period_limits {
            if !period.active {
                continue;
            }

            // Reset period if duration has passed
            if current_time >= period.last_reset + period.duration as i64 {
                period.last_reset = current_time;
                period.spent = 0;
            }

            period.spent = period.spent.checked_add(amount)
                .ok_or(crate::error::ErrorCode::ArithmeticOverflow)?;
        }
        Ok(())
    }

    /// Get current spending information for a specific period
    pub fn get_period_info(&self, name: &str, current_time: i64) -> Option<(u64, u64, u64, bool)> {
        for period in &self.time_period_limits {
            if period.name == name && period.active {
                // Calculate current spent (would be reset if duration passed)
                let current_spent = if current_time >= period.last_reset + period.duration as i64 {
                    0 // Would be reset
                } else {
                    period.spent
                };

                let remaining = if period.limit > current_spent {
                    period.limit - current_spent
                } else {
                    0
                };

                return Some((period.limit, current_spent, remaining, period.active));
            }
        }
        None
    }

    /// Set common period limits (Daily, Weekly, Monthly) helper function
    pub fn set_common_period_limits(
        &mut self,
        daily_limit: Option<u64>,
        weekly_limit: Option<u64>,
        monthly_limit: Option<u64>,
        current_time: i64,
    ) -> Result<()> {
        // Validate logical limit ordering if multiple limits are set
        if let (Some(daily), Some(weekly)) = (daily_limit, weekly_limit) {
            require!(daily * 7 <= weekly, crate::error::ErrorCode::InvalidLimitParameters);
        }
        if let (Some(weekly), Some(monthly)) = (weekly_limit, monthly_limit) {
            require!(weekly * 4 <= monthly, crate::error::ErrorCode::InvalidLimitParameters);
        }
        if let (Some(daily), Some(monthly)) = (daily_limit, monthly_limit) {
            require!(daily * 30 <= monthly, crate::error::ErrorCode::InvalidLimitParameters);
        }

        // Add or update common periods
        if let Some(limit) = daily_limit {
            self.add_time_period_limit("Daily".to_string(), limit, 86400, current_time)?; // 1 day
        }
        if let Some(limit) = weekly_limit {
            self.add_time_period_limit("Weekly".to_string(), limit, 604800, current_time)?; // 7 days
        }
        if let Some(limit) = monthly_limit {
            self.add_time_period_limit("Monthly".to_string(), limit, 2592000, current_time)?; // 30 days
        }

        Ok(())
    }
}

/// Deposit proxy account that provides permanent addresses for exchange deposits
/// This allows users to have deterministic deposit addresses that forward to their savings
#[account]
#[derive(Default)]
pub struct DepositProxy {
    /// The owner of this deposit proxy (user's wallet)
    pub owner: Pubkey,

    /// The savings program this proxy forwards to (should be current program)
    pub savings_program: Pubkey,

    /// Bump seed for this PDA
    pub bump: u8,

    /// When this proxy was created
    pub created_at: i64,

    /// Last time this proxy was used
    pub last_used: i64,

    /// Total number of deposits forwarded
    pub deposit_count: u64,
}

impl DepositProxy {
    /// Update deposit statistics
    pub fn record_deposit(&mut self) -> Result<()> {
        let clock = Clock::get()?;
        self.last_used = clock.unix_timestamp;
        self.deposit_count = self.deposit_count.saturating_add(1);
        Ok(())
    }
}

/// Program configuration that stores treasury and fee settings
#[account]
#[derive(Default)]
pub struct ProgramConfig {
    /// Treasury address where activation fees are sent
    pub treasury_address: Pubkey,

    /// Fee amount in lamports for permanent address activation ($5 USD equivalent)
    pub permanent_address_fee_lamports: u64,

    /// Admin address that can update treasury and fee settings
    pub admin: Pubkey,

    /// Bump seed for this PDA
    pub bump: u8,

    /// When this config was created
    pub created_at: i64,

    /// Last update timestamp
    pub updated_at: i64,
}

impl ProgramConfig {
    /// Size calculation for account space allocation
    pub const DISCRIMINATOR_SIZE: usize = 8;
    pub const PUBKEY_SIZE: usize = 32;
    pub const U64_SIZE: usize = 8;
    pub const U8_SIZE: usize = 1;
    pub const I64_SIZE: usize = 8;

    pub const INIT_SPACE: usize = Self::DISCRIMINATOR_SIZE
        + Self::PUBKEY_SIZE // treasury_address
        + Self::U64_SIZE // permanent_address_fee_lamports
        + Self::PUBKEY_SIZE // admin
        + Self::U8_SIZE // bump
        + Self::I64_SIZE // created_at
        + Self::I64_SIZE; // updated_at
}