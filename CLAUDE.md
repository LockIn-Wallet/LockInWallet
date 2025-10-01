# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a savings wallet DApp that allows users to deposit ETH and ERC20 tokens with built-in spending controls and multi-approval mechanisms. The project consists of upgradeable smart contracts and a React frontend interface.

## Architecture

### Smart Contract Layer (Hardhat + TypeScript)
- **Modular Architecture**: Contract split into multiple modules to stay under size limits
- **Core Contract**: `contracts/SavingsCore.sol` - Main coordinator using UUPS proxy pattern
- **Shared Interfaces**: `contracts/SavingsInterfaces.sol` - Common data structures and interfaces
- **Modules**:
  - `TimePeriodLimitsModule.sol` - Spending limits with time periods (Daily/Weekly/Monthly/Custom)
  - `ProposalSystemModule.sol` - Two-phase proposal system with timelock security
  - `BypassSystemModule.sol` - Emergency bypass system for urgent withdrawals
  - `ApprovalSystemModule.sol` - Multi-signature approval system
- **User Proxies**: `contracts/UserProxy.sol` - Deterministic deposit addresses for users
- **Test Token**: `contracts/MockUSDT.sol` - Mock USDT token for testing (6 decimals)
- **Deployment**: Uses modular deployment with module registration and automated ABI sync

### Frontend (React + ethers.js)
- **Framework**: Create React App with ethers.js v6 for blockchain interaction
- **Location**: `frontend/` directory with standard React structure
- **Integration**: Connects to deployed contracts via hardcoded addresses

## Core Features

The modular savings system implements:
- **Multi-token support** (ETH and ERC20 tokens) with token-specific balances
- **Time-based spending limits** with Daily/Weekly/Monthly periods and custom durations
- **Two-phase proposal system** with 24-72 hour timelock for security
- **Emergency bypass system** for urgent withdrawals with timelock protection
- **Multi-signature approval system** for emergency and administrative functions
- **Deterministic user proxies** for permanent deposit addresses from exchanges
- **Module upgradeability** - Individual modules can be upgraded without affecting others
- **Contract size optimization** - Modular architecture stays under deployment limits

## Development Commands

### ⚡ Multi-Blockchain Development Startup

**For complete multi-blockchain development, start both chains:**

```bash
# Terminal 1: Start EVM blockchain (Hardhat)
npx hardhat node

# Terminal 2: Start Solana blockchain
npm run solana:localnet

# Terminal 3: Start frontend (connects to both chains)
cd frontend && npm start
```

**Quick Setup (EVM + Solana + Frontend):**
```bash
# Terminal 1: EVM Chain
npx hardhat node

# Terminal 2: Solana Chain
npm run solana:localnet

# Terminal 3: Deploy contracts and start frontend
npx hardhat run scripts/deploy-modular.js --network localhost  # Deploy EVM contracts
npm run solana:setup                                           # Build + deploy Solana programs
cd frontend && npm start                                       # Start React app with dual blockchain support
```

### EVM Smart Contract Development (Hardhat)
```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Start local EVM blockchain
npx hardhat node

# AUTOMATED MODULAR WORKFLOW (RECOMMENDED):

# 1. Modular Development Cycle
npx hardhat compile                                        # Auto-updates frontend ABIs
npx hardhat run scripts/deploy-modular.js --network localhost  # Modular deploy + validation
cd frontend && npm start                                  # Everything ready!

# MODULAR DEPLOYMENT OPTIONS:

# Option 1: Modular Deploy (RECOMMENDED)
# - Deploys SavingsCore + all 4 modules
# - Registers modules and sets up interactions
# - Includes validation and ABI updates
npx hardhat run scripts/deploy-modular.js --network localhost

# Option 2: Individual Module Upgrade
# - Upgrades specific module while preserving data
# - Updates module registration automatically
npx hardhat run scripts/upgrade-module.js --network localhost <ModuleName> <CoreAddress>
# Example: npx hardhat run scripts/upgrade-module.js --network localhost TimePeriodLimitsModule 0x1234...

# Option 3: Legacy Deploy (for compatibility)
# - Uses older deployment method
# - May be needed for specific scenarios
npx hardhat run scripts/deploy-upgrade.js --network localhost

# Option 4: Validation only
npx hardhat run scripts/validate-deployment.js --network localhost

# AVAILABLE MODULES FOR UPGRADE:
# - TimePeriodLimitsModule
# - ProposalSystemModule
# - BypassSystemModule
# - ApprovalSystemModule
```

### Solana Smart Contract Development (Anchor)
```bash
# Start local Solana validator
npm run solana:localnet

# Build Solana programs
npm run solana:build

# Test Solana programs
npm run solana:test

# Deploy to local Solana validator
npm run solana:deploy

# Deploy to devnet
npm run solana:deploy:dev

# Deploy to mainnet
npm run solana:deploy:prod

# Complete setup (build + deploy + update frontend)
npm run solana:setup

# Update frontend with Solana program addresses
npm run solana:update-frontend
```

### Frontend Development (Multi-Blockchain)
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server (connects to both EVM and Solana)
npm start

# Build for production
npm run build

# Run tests
npm test

# Alternative start commands
npm run start:quiet    # Start without source maps (cleaner output)
npm run start:clean    # Clean cache and start
```

## Key Technical Details

### Contract Architecture
- **Modular Design**: SavingsCore coordinates 4 specialized modules via delegated calls
- **Core Contract**: `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`
- **Module Authorization**: Each module has `onlyCore` modifier for security isolation
- **Shared Storage**: All modules access storage through SavingsCore
- **Module Registration**: Dynamic module registration with keccak256 identifiers:
  - `TIME_PERIOD_LIMITS` → TimePeriodLimitsModule
  - `PROPOSAL_SYSTEM` → ProposalSystemModule
  - `BYPASS_SYSTEM` → BypassSystemModule
  - `APPROVAL_SYSTEM` → ApprovalSystemModule
- **Security**: Includes reentrancy protection, authorization checks, and timelock mechanisms
- **Events**: Comprehensive event emission across all modules for transparency

### Frontend Integration (Multi-Blockchain)

**EVM Integration:**
- **Contract Address**: SavingsCore address hardcoded in `frontend/src/App.js`
- **Main ABI**: Stored in `frontend/src/SavingsABI.json` (SavingsCore ABI)
- **Module ABIs**: Individual module ABIs available in `frontend/src/`
- **Network**: EVM localhost development (port 8545)
- **Module Config**: Module addresses stored in `frontend/src/moduleAddresses.json`

**Solana Integration:**
- **Program Addresses**: Stored in `frontend/src/solanaAddresses.json`
- **Network**: Solana localhost validator (port 8899)
- **Wallet Support**: Phantom, Solflare, and other Solana wallets
- **RPC Endpoint**: `http://127.0.0.1:8899` for local development

**Frontend Network Switching:**
- **Blockchain Selector**: Switch between EVM and Solana networks
- **Network Types**: Each blockchain supports multiple networks (localhost, testnet, mainnet)
- **Wallet Integration**: MetaMask for EVM, Phantom/Solflare for Solana
- **Frontend Port**: React development server runs on port 3000

### Token Support

**EVM Tokens:**
- **ETH**: Native token (address: `0x0000000000000000000000000000000000000000`)
- **ERC20**: Any ERC20 token (tested with MockUSDT using 6 decimals)

**Solana Tokens:**
- **SOL**: Native token
- **SPL Tokens**: Solana Program Library tokens

## Deployment Process

### Initial Setup (First Time) - Multi-Blockchain

**Complete Multi-Blockchain Setup:**
1. **Terminal 1**: Start EVM chain: `npx hardhat node`
2. **Terminal 2**: Start Solana chain: `npm run solana:localnet`
3. **Terminal 3**: Deploy EVM contracts: `npx hardhat run scripts/deploy-modular.js --network localhost`
4. **Terminal 3**: Setup Solana programs: `npm run solana:setup`
5. **Terminal 3**: Start frontend: `cd frontend && npm start`

**EVM-Only Setup (Legacy):**
1. Start local Hardhat node: `npx hardhat node`
2. Deploy modular contracts: `npx hardhat run scripts/deploy-modular.js --network localhost`
3. Start frontend: `cd frontend && npm start`

**Solana-Only Setup:**
1. Start Solana validator: `npm run solana:localnet`
2. Setup Solana programs: `npm run solana:setup`
3. Start frontend: `cd frontend && npm start`

### Contract Updates (After Initial Setup)

**EVM Contract Updates:**
1. Make changes to any contract in `contracts/`
2. Compile: `npx hardhat compile` (auto-updates ABIs)
3. **For Core changes**: `npx hardhat run scripts/deploy-modular.js --network localhost`
4. **For Module changes**: `npx hardhat run scripts/upgrade-module.js --network localhost <ModuleName> <CoreAddress>`
5. Frontend automatically updated with new ABIs

**Solana Program Updates:**
1. Make changes to programs in `solana/programs/`
2. Build and deploy: `npm run solana:setup`
3. Frontend automatically updated with new program addresses

## Understanding the Modular System

### Modular Architecture Benefits
**Why we switched from monolithic to modular:**
- **Contract Size Limits**: Ethereum has ~24KB deployment limit, our contract was too large
- **Independent Upgrades**: Upgrade individual modules without affecting others
- **Specialized Functionality**: Each module focuses on one responsibility
- **Reduced Gas Costs**: Only deploy/upgrade what needs to change

### Module System Design
```
SavingsCore (Proxy)
├── TimePeriodLimitsModule    → Daily/Weekly/Monthly spending limits
├── ProposalSystemModule      → Two-phase proposals with timelock
├── BypassSystemModule        → Emergency withdrawal bypass
└── ApprovalSystemModule      → Multi-signature approvals
```

### Module Registration Process
```solidity
// Modules are registered with keccak256 identifiers:
bytes32 moduleId = keccak256(abi.encodePacked("TIME_PERIOD_LIMITS"));
savingsCore.registerModule(moduleId, moduleAddress);
```

### UUPS Proxy Pattern
This project uses OpenZeppelin's **UUPS (Universal Upgradeable Proxy Standard)** pattern:

- **SavingsCore Proxy**: Permanent address that users and frontend interact with
- **Module Implementations**: Can be updated independently without changing core
- **Shared Storage**: All modules access storage through SavingsCore
- **Storage**: Always stored in the proxy, preserved across upgrades

### Module vs Core Upgrades
**SavingsCore Upgrades:**
- Use UUPS proxy upgrade pattern
- Preserve all user data and module registrations
- Require careful storage layout management

**Module Upgrades:**
- Deploy new module implementation
- Update registration in SavingsCore
- Old module automatically deregistered
- Module-specific data preserved in SavingsCore storage

### Upgrade Safety
✅ **Safe Operations (Core & Modules)**:
- Adding new functions
- Adding new state variables (at end of struct)
- Modifying function logic
- Adding events
- Adding new modules

✅ **Safe Module Operations**:
- Complete module replacement
- New module implementations
- Updated module logic

⚠️ **Dangerous Operations**:
- Reordering state variables in SavingsCore
- Changing variable types in shared storage
- Removing state variables from SavingsCore
- Changing inheritance order in SavingsCore

### Data Preservation
When using proper upgrade scripts:
- ✅ User balances preserved (stored in SavingsCore)
- ✅ Spending limits preserved (stored in SavingsCore)
- ✅ SavingsCore proxy address preserved
- ✅ User proxy contracts preserved
- ✅ Module registrations updated automatically
- ✅ Module-specific data preserved across module upgrades

## Configuration Files

- **hardhat.config.ts**: Hardhat configuration with localhost network
- **tsconfig.json**: TypeScript configuration for Node.js compatibility
- **frontend/package.json**: React app dependencies including ethers v6

## Testing Strategy

- **Smart Contracts**: Hardhat test suite needs updating for modular architecture
- **Module Testing**: Each module can be tested independently
- **Integration Testing**: Full system testing through SavingsCore
- **Frontend**: Create React App test runner (minimal tests currently)
- **Validation Scripts**: Automated deployment validation in `scripts/validate-deployment.js`

## Troubleshooting

### Common ABI/Contract Issues

#### **"could not decode result data" Error**
```bash
# Quick fixes (in order):
1. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
2. Check MetaMask network (should be localhost:8545, Chain ID: 31337)
3. Restart Hardhat node and redeploy:
   npx hardhat node
   npx hardhat run scripts/deploy-modular.js --network localhost
4. Force recompile: npx hardhat clean && npx hardhat compile
```

#### **Module Registration Issues**
```bash
# Validate deployment and module registration:
npx hardhat run scripts/validate-deployment.js --network localhost

# Check specific module status:
npx hardhat run scripts/debug-contract.js --network localhost
```

#### **ABI Sync Issues**
```bash
# Force update all ABIs:
npx hardhat compile --force

# Verify ABI compatibility:
npx hardhat run scripts/test-frontend-connection.js --network localhost
```

### Nuclear Reset (Last Resort)
```bash
# Stop all terminals, then:
npx hardhat clean
npx hardhat compile
npx hardhat node  # Terminal 1
npx hardhat run scripts/deploy-modular.js --network localhost  # Terminal 2
cd frontend && npm start  # Terminal 3
# Clear browser cache completely
```

## Important Notes

### **Modular Architecture Notes**
- **SavingsCore** is the main contract - frontend always interacts with this address
- **Modules** are registered dynamically and can be upgraded individually
- **Module addresses** change on upgrade, but SavingsCore address stays constant
- **Module interactions** are handled automatically through core delegation

### **Development Best Practices**
- Always use `deploy-modular.js` for full system deployment
- Use `upgrade-module.js` for individual module updates
- ABIs are auto-updated on compilation - never edit manually
- Validation scripts catch issues early - always check output
- MockUSDT uses 6 decimals to match real USDT
- Frontend expects MetaMask for wallet connection

### **Data Preservation**
- **SavingsCore upgrades**: Preserve all user data (use UUPS pattern)
- **Module upgrades**: Preserve module-specific data and registrations
- **Fresh deployments**: Only use for initial setup (DATA LOSS)
- **User proxies**: Permanent addresses tied to user wallets