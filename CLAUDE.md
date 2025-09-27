# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a savings wallet DApp that allows users to deposit ETH and ERC20 tokens with built-in spending controls and multi-approval mechanisms. The project consists of upgradeable smart contracts and a React frontend interface.

## Architecture

### Smart Contract Layer (Hardhat + TypeScript)
- **Main Contract**: `contracts/Lock.sol` - Renamed to `Savings` contract, an upgradeable savings wallet using OpenZeppelin's UUPS proxy pattern
- **Test Token**: `contracts/MockUSDT.sol` - Mock USDT token for testing (6 decimals)
- **Deployment**: Uses OpenZeppelin upgrades plugin for proxy deployment and upgrades

### Frontend (React + ethers.js)
- **Framework**: Create React App with ethers.js v6 for blockchain interaction
- **Location**: `frontend/` directory with standard React structure
- **Integration**: Connects to deployed contracts via hardcoded addresses

## Core Features

The Savings contract implements:
- Multi-token support (ETH and ERC20 tokens)
- Withdrawal categories with spending limits and time periods
- Multi-signature approval system for category changes
- Emergency full withdrawal with approval
- Upgradeability via UUPS proxy pattern

## Development Commands

### Smart Contract Development
```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Start local blockchain
npx hardhat node

# AUTOMATED WORKFLOW (RECOMMENDED):

# 1. Development Cycle
npx hardhat compile                                      # Auto-updates frontend ABIs
npx hardhat run scripts/deploy-upgrade.js --network localhost  # Smart deploy + validation
cd frontend && npm start                                # Everything ready!

# MANUAL OPTIONS (if needed):

# Option 1: Smart Deploy/Upgrade
# - Automatically detects if proxy exists
# - Uses upgrade if proxy found, deploy if not
# - Includes validation and ABI updates
npx hardhat run scripts/deploy-upgrade.js --network localhost

# Option 2: Fresh deployment (DATA LOSS WARNING!)
# - Always deploys new proxy (loses all user data)
# - Only use for initial setup or when data loss is acceptable
# - Includes validation and ABI updates
npx hardhat run scripts/deploy-all.js --network localhost

# Option 3: Manual upgrade (if you know proxy address)
# - Updates existing proxy implementation
# - Preserves all user data
npx hardhat run scripts/upgrade.ts --network localhost

# Option 4: Validation only
npx hardhat run scripts/validate-deployment.js --network localhost
```

### Frontend Development
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Key Technical Details

### Contract Architecture
- **Inheritance**: `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`
- **Storage**: Uses mappings for user data with token-specific balances
- **Security**: Includes reentrancy protection and authorization checks
- **Events**: Comprehensive event emission for all major actions

### Frontend Integration
- **Contract Address**: Hardcoded in `frontend/src/App.js`
- **ABI**: Stored in `frontend/src/SavingsABI.json`
- **Network**: Configured for localhost development (port 8545)

### Token Support
- **ETH**: Native token (address: `0x0000000000000000000000000000000000000000`)
- **ERC20**: Any ERC20 token (tested with MockUSDT using 6 decimals)

## Deployment Process

### Initial Setup (First Time)
1. Start local Hardhat node: `npx hardhat node`
2. Deploy contracts: `node scripts/deploy-upgrade.js`
3. Start frontend: `cd frontend && npm start`

### Contract Updates (After Initial Setup)
1. Make changes to `contracts/Lock.sol`
2. Compile: `npx hardhat compile`
3. Upgrade: `node scripts/deploy-upgrade.js` (preserves user data)
4. Frontend automatically updated

## Understanding the Upgrade System

### UUPS Proxy Pattern
This project uses OpenZeppelin's **UUPS (Universal Upgradeable Proxy Standard)** pattern:

- **Proxy Contract**: Permanent address that users interact with
- **Implementation Contract**: Contains the actual logic, can be updated
- **Storage**: Always stored in the proxy, preserved across upgrades

### Why Addresses Were Changing (Fixed)
**Previous Issue**: Using `deploy-all.js` always created new proxy contracts
**Solution**: `deploy-upgrade.js` detects existing proxies and preserves them

### Upgrade Safety
✅ **Safe Operations**:
- Adding new functions
- Adding new state variables (at end of struct)
- Modifying function logic
- Adding events

⚠️ **Dangerous Operations**:
- Reordering state variables
- Changing variable types
- Removing state variables
- Changing inheritance order

### Data Preservation
When using proper upgrade scripts:
- ✅ User balances preserved
- ✅ Spending limits preserved
- ✅ Proxy addresses preserved
- ✅ User proxy contracts preserved

## Configuration Files

- **hardhat.config.ts**: Hardhat configuration with localhost network
- **tsconfig.json**: TypeScript configuration for Node.js compatibility
- **frontend/package.json**: React app dependencies including ethers v6

## Testing Strategy

- **Smart Contracts**: Hardhat test suite in `test/Lock.ts` (needs updating for Savings contract)
- **Frontend**: Create React App test runner (minimal tests currently)

## Important Notes

- Contract addresses are hardcoded in frontend - update after each deployment
- MockUSDT uses 6 decimals to match real USDT
- Withdrawal limits and periods are token-agnostic but amounts are token-specific
- Contract is upgradeable - use upgrade script for updates, not redeployment
- Frontend expects MetaMask for wallet connection