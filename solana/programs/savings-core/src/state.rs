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
                    .ok_or(error::ErrorCode::MathOverflow)?;
                return Ok(());
            }
        }

        // If token not found, add new entry
        if self.spl_balances.len() >= Self::MAX_TOKENS {
            return Err(error::ErrorCode::TooManyTokens.into());
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