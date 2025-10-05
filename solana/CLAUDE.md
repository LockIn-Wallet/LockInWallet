# SOLANA CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with Solana smart contracts in this repository.

## Project Overview

This directory contains the Solana smart contracts for the savings wallet DApp that allows users to deposit SOL and SPL tokens with built-in spending controls and multi-approval mechanisms. The contracts use Anchor framework with Program Derived Addresses (PDAs).

## Architecture

### Smart Contract Layer (Anchor + Rust)
- **Anchor Framework**: Rust-based smart contract development with type safety
- **Program Derived Addresses (PDAs)**: Deterministic account generation
- **Cross-program invocations**: Modular program interactions
- **Programs**: Rust programs handling core savings functionality
- **Tests**: Anchor test suites for comprehensive program testing

## Core Features

The Solana savings system implements:
- **Multi-token support** (SOL and SPL tokens) with token-specific balances
- **Time-based spending limits** with Daily/Weekly/Monthly periods and custom durations
- **Two-phase proposal system** with 24-72 hour timelock for security
- **Emergency bypass system** for urgent withdrawals with timelock protection
- **Multi-signature approval system** for emergency and administrative functions
- **Deterministic addresses** (PDAs) for permanent deposit addresses from exchanges
- **Program Derived Addresses** for deterministic account generation
- **Cross-program invocations** for modular program interactions

## Development Commands

### Solana Smart Contract Development (Anchor)

#### ⚡ **RECOMMENDED: Reliable Deployment (IMPORTANT!)**
```bash
# Navigate to solana directory
cd solana

# 🎯 ONE-COMMAND DEPLOYMENT (handles everything automatically)
npm run deploy-reliable

# This script automatically:
# - Checks prerequisites (Anchor CLI, etc.)
# - Starts local validator if needed
# - Builds the program (bypassing version conflicts)
# - Deploys to local validator
# - Updates frontend addresses
# - Provides deployment summary
```

#### **Testing and Development Commands**
```bash
# Navigate to solana directory
cd solana

# Start local Solana validator (for testing only)
anchor localnet

# Test Solana programs
anchor test

# Update frontend with Solana program addresses
npm run update-frontend
```

**Note**: For all deployment, use `npm run deploy-reliable` which handles the correct build process.

#### **✅ WORKING CONFIGURATION (Updated)**
**Required Versions for Successful Build/Deploy:**
- **Solana CLI**: 2.1.15+ (Agave) - `sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.15/install)"`
- **Anchor CLI**: 0.31.1 (homebrew) - `brew install anchor-cli`
- **Rust**: 1.85.0+ (we use 1.90.0) - `rustup update`

**Deployment:**
```bash
npm run deploy-reliable  # ONLY recommended method - handles correct homebrew anchor build
```

### Alternative Commands (from project root)
```bash
# Solana commands using root orchestration
npm run solana:localnet           # Start Solana validator
npm run solana:build              # Build programs
npm run solana:test               # Run tests
npm run solana:deploy             # Deploy to localnet
npm run solana:deploy:dev         # Deploy to devnet
npm run solana:deploy:prod        # Deploy to mainnet
npm run solana:deploy-reliable    # Automated deployment
npm run solana:upgrade            # Upgrade programs
npm run solana:update-frontend    # Update frontend addresses
npm run solana:setup              # Complete setup workflow
```

## Key Technical Details

### Program Architecture
- **Anchor Framework**: Type-safe Rust development with automatic serialization
- **Program Derived Addresses (PDAs)**: Deterministic accounts derived from seeds
- **Cross-Program Invocations (CPIs)**: Modular program interactions
- **Account Structure**: Structured account definitions with validation
- **Security**: Built-in protection against common Solana vulnerabilities

### Frontend Integration
- **Program Address**: Solana program address configured in `../frontend/src/`
- **IDL**: Interface Definition Language files for frontend integration
- **Network**: Solana localnet development (default RPC endpoint)
- **SPL Token Support**: Full SPL token ecosystem integration

### Token Support
- **SOL**: Native Solana token
- **SPL Tokens**: Any SPL token standard (fungible tokens)

## Deployment Process

### Initial Setup (First Time)
1. Start local Solana validator: `npm run solana:localnet` (from root) or `anchor localnet` (from solana/)
2. Deploy programs: `npm run deploy-reliable`
3. Start frontend: `cd ../frontend && npm start`

### Program Updates (After Initial Setup)
1. Make changes to any program in `programs/`
2. Build: `anchor build`
3. Deploy: `npm run deploy-reliable` or `anchor deploy --provider.cluster localnet`
4. Frontend automatically updated with new IDL

## Development Workflow

### For Solana Development (Detailed Workflow)
```bash
cd solana                # Work in solana folder
npm run deploy-reliable  # Deploy programs (ONLY recommended method)
anchor test             # Run tests

# Alternative: From project root using orchestration commands
npm run solana:deploy-reliable      # Deploy Solana programs (ONLY recommended method)
npm run solana:test                 # Run Solana tests
```

### Multi-Chain Development Integration
```bash
# Terminal 1: Start Solana validator (from solana/ folder)
anchor localnet

# Terminal 2: Start EVM blockchain (from project root)
npm run node --workspace=ethereum

# Terminal 3: Deploy contracts and start frontend (from project root)
npm run solana:deploy-reliable                  # Deploy Solana programs
npm run deploy-modular --workspace=ethereum    # Deploy EVM contracts
npm run frontend:start                         # Start React app with dual blockchain support
```

## Understanding the Solana Architecture

### Program Derived Addresses (PDAs)
PDAs are deterministic addresses derived from program ID and seeds:
```rust
// Example PDA derivation
let (user_account_pda, bump) = Pubkey::find_program_address(
    &[b"user_account", user.key().as_ref()],
    program_id
);
```

### Cross-Program Invocations (CPIs)
Solana programs can invoke other programs:
```rust
// Example CPI call
solana_program::program::invoke(
    &instruction,
    &[account1, account2, program_account]
)?;
```

### Account Structure
Anchor provides structured account definitions:
```rust
#[account]
pub struct UserAccount {
    pub owner: Pubkey,
    pub balance: u64,
    pub created_at: i64,
}
```

## Configuration Files

- **Anchor.toml**: Anchor framework configuration with cluster settings
- **Cargo.toml**: Rust package configuration for programs
- **package.json**: Solana-specific dependencies and scripts

## Testing Strategy

- **Anchor Tests**: Comprehensive test suite using Anchor testing framework
- **Unit Tests**: Individual program instruction testing
- **Integration Tests**: Full system testing across programs
- **Local Validator**: Automated testing against local Solana validator

## Troubleshooting

### Common Solana/Anchor Issues

#### **Version Conflicts**
```bash
# Quick fixes (in order):
1. Use npm run deploy-reliable (bypasses most conflicts)
2. Update Solana CLI: sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.15/install)"
3. Update Anchor CLI: brew upgrade anchor-cli
4. Update Rust: rustup update
```

#### **Deployment Issues**
```bash
# Use only the reliable deployment method:
npm run deploy-reliable

# Check program deployment:
solana program show <PROGRAM_ID>
```

#### **Account Issues**
```bash
# Reset local validator if accounts are corrupted:
solana-test-validator --reset

# Check account data:
solana account <ACCOUNT_ADDRESS>
```

### Nuclear Reset (Last Resort)
```bash
# Stop all terminals, then:
pkill solana-test-validator
anchor clean
cargo clean
npm run deploy-reliable  # Handles everything automatically
cd ../frontend && npm start  # Start frontend
```

## Important Notes

### **Anchor Framework Notes**
- **Programs** are the main contracts - frontend interacts with program addresses
- **PDAs** provide deterministic addresses for user accounts
- **IDL files** are automatically generated for frontend integration
- **Account validation** is handled automatically by Anchor

### **Development Best Practices**
- Always use `deploy-reliable` for automated deployment workflow
- Use `anchor test` for comprehensive program testing
- IDL files are auto-generated - never edit manually
- Local validator provides fast development iteration
- Use proper PDA seeds for deterministic account generation

### **Data Preservation**
- **Program upgrades**: Preserve all account data (use proper upgrade authority)
- **Account migrations**: Handle account structure changes carefully
- **Fresh deployments**: Only use for initial setup or testing (DATA LOSS)
- **PDA accounts**: Deterministic addresses tied to user wallets

### **Best Coding Practices**
- Always use DRY principle
- Never have inline imports
- Use proper error handling with Anchor error codes
- Implement proper access control with account constraints
- Use PDAs for deterministic account generation

## Cross-References

- **Root Project Overview**: See **`../CLAUDE.md`** for multi-blockchain orchestration and workspace management
- **EVM Development**: See **`../ethereum/CLAUDE.md`** for Ethereum-specific development
- **Frontend Development**: See **`../frontend/`** folder for React app development
- **Multi-Chain Commands**: Use workspace commands from project root (see **`../CLAUDE.md`**)