use anchor_lang::prelude::*;

/// Deposit proxy account that holds proxy configuration
#[account]
#[derive(Default)]
pub struct DepositProxy {
    /// The owner of this deposit proxy (user's wallet)
    pub owner: Pubkey,

    /// The savings program this proxy forwards to
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