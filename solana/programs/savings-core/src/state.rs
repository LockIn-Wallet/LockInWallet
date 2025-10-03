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
}

/// Represents a balance for a specific SPL token
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct TokenBalance {
    /// The mint address of the SPL token
    pub mint: Pubkey,

    /// The amount of tokens deposited
    pub amount: u64,
}

impl SavingsAccount {
    /// Size calculation for account space allocation
    pub const DISCRIMINATOR_SIZE: usize = 8;
    pub const PUBKEY_SIZE: usize = 32;
    pub const U64_SIZE: usize = 8;
    pub const U8_SIZE: usize = 1;
    pub const I64_SIZE: usize = 8;
    pub const VEC_OVERHEAD: usize = 4; // Vec length prefix
    pub const TOKEN_BALANCE_SIZE: usize = 32 + 8; // Pubkey + u64
    pub const MAX_TOKENS: usize = 10; // Support up to 10 different tokens initially

    pub const INIT_SPACE: usize = Self::DISCRIMINATOR_SIZE
        + Self::PUBKEY_SIZE // owner
        + Self::U64_SIZE // sol_balance
        + Self::VEC_OVERHEAD + (Self::TOKEN_BALANCE_SIZE * Self::MAX_TOKENS) // spl_balances
        + Self::U8_SIZE // bump
        + Self::I64_SIZE // created_at
        + Self::I64_SIZE; // updated_at

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

    // TimePeriodLimit size calculation
    pub const TIME_PERIOD_LIMIT_SIZE: usize = Self::U64_SIZE // limit
        + Self::U64_SIZE // spent
        + Self::I64_SIZE // last_reset
        + Self::U64_SIZE // duration
        + Self::STRING_OVERHEAD + Self::MAX_NAME_LENGTH // name
        + Self::BOOL_SIZE; // active

    // UserSetupData size calculation
    pub const USER_SETUP_DATA_SIZE: usize = Self::BOOL_SIZE // has_committed_setup
        + Self::U64_SIZE // total_locked_value
        + Self::I64_SIZE // commit_timestamp
        + Self::I64_SIZE // last_increase_timestamp
        + Self::U64_SIZE; // increases_in_period

    pub const INIT_SPACE: usize = Self::DISCRIMINATOR_SIZE
        + Self::PUBKEY_SIZE // owner
        + Self::VEC_OVERHEAD + (Self::TIME_PERIOD_LIMIT_SIZE * Self::MAX_PERIODS) // time_period_limits
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