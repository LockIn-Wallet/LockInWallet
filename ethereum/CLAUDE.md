# ETHEREUM CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with Ethereum/EVM smart contracts in this repository.

## Project Overview

This directory contains the Ethereum/EVM smart contracts for the savings wallet DApp that allows users to deposit ETH and ERC20 tokens with built-in spending controls and multi-approval mechanisms. The contracts use modular architecture with upgradeable patterns.

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

### EVM Smart Contract Development (Hardhat)
```bash
# Navigate to ethereum directory
cd ethereum

# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm run test

# Start local EVM blockchain
npm run node

# AUTOMATED MODULAR WORKFLOW (RECOMMENDED):

# 1. Modular Development Cycle
npm run compile                     # Auto-updates frontend ABIs
npm run deploy-modular             # Modular deploy + validation
cd ../frontend && npm start       # Everything ready!

# MODULAR DEPLOYMENT OPTIONS:

# Option 1: Modular Deploy (RECOMMENDED)
# - Deploys SavingsCore + all 4 modules
# - Registers modules and sets up interactions
# - Includes validation and ABI updates
npm run deploy-modular

# Option 2: Individual Module Upgrade
# - Upgrades specific module while preserving data
# - Updates module registration automatically
npm run upgrade-module <ModuleName> <CoreAddress>
# Example: npm run upgrade-module TimePeriodLimitsModule 0x1234...

# Option 3: Legacy Deploy (for compatibility)
# - Uses older deployment method
# - May be needed for specific scenarios
npm run deploy:dev

# Option 4: Validation only
npm run validate-deployment

# AVAILABLE MODULES FOR UPGRADE:
# - TimePeriodLimitsModule
# - ProposalSystemModule
# - BypassSystemModule
# - ApprovalSystemModule
```

### Alternative Commands (from project root)
```bash
# EVM commands using workspace management
npm run compile --workspace=ethereum            # Compile contracts
npm run test --workspace=ethereum              # Run tests
npm run node --workspace=ethereum             # Start local blockchain
npm run deploy-modular --workspace=ethereum   # Deploy all contracts + modules
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

### Frontend Integration
- **Contract Address**: SavingsCore address hardcoded in `../frontend/src/App.js`
- **Main ABI**: Stored in `../frontend/src/SavingsABI.json` (SavingsCore ABI)
- **Module ABIs**: Individual module ABIs available in `../frontend/src/`
- **Network**: EVM localhost development (port 8545)
- **Module Config**: Module addresses stored in `../frontend/src/moduleAddresses.json`

### Frontend Development Commands (Multi-Blockchain)
```bash
# Using workspace commands (from project root)
npm run frontend:start    # Start React development server
npm run frontend:build    # Build for production
npm run frontend:test     # Run tests

# Working directly in frontend/ folder
cd frontend
npm start                # Start development server (connects to both EVM and Solana)
npm run build           # Build for production
npm test                # Run tests
```

### Token Support
- **ETH**: Native token (address: `0x0000000000000000000000000000000000000000`)
- **ERC20**: Any ERC20 token (tested with MockUSDT using 6 decimals)

## Deployment Process

### Initial Setup (First Time)
1. Start local Hardhat node: `npm run node`
2. Deploy modular contracts: `npm run deploy-modular`
3. Start frontend: `cd ../frontend && npm start`

### Contract Updates (After Initial Setup)
1. Make changes to any contract in `contracts/`
2. Compile: `npm run compile` (auto-updates ABIs)
3. **For Core changes**: `npm run deploy-modular`
4. **For Module changes**: `npm run upgrade-module <ModuleName> <CoreAddress>`
5. Frontend automatically updated with new ABIs

## Development Workflow

### For EVM Development (Detailed Workflow)
```bash
cd ethereum               # Work in ethereum folder
npm run compile          # Compile contracts
npm run deploy-modular   # Deploy with modules
npm run test            # Run tests

# Alternative: From project root using workspace commands
npm run compile --workspace=ethereum          # Compile contracts
npm run test --workspace=ethereum            # Run tests
npm run node --workspace=ethereum           # Start local blockchain
npm run deploy-modular --workspace=ethereum # Deploy all contracts + modules
```

### Multi-Chain Development Integration
```bash
# Terminal 1: Start EVM blockchain (from ethereum/ folder)
npm run node

# Terminal 2: Start Solana blockchain (from project root)
npm run solana:localnet

# Terminal 3: Deploy contracts and start frontend (from project root)
npm run deploy-modular --workspace=ethereum    # Deploy EVM contracts
npm run solana:deploy-reliable                 # Deploy Solana programs
npm run frontend:start                         # Start React app with dual blockchain support
```

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
- **package.json**: EVM-specific dependencies including ethers v6

## Testing Strategy

- **Smart Contracts**: Hardhat test suite needs updating for modular architecture
- **Module Testing**: Each module can be tested independently
- **Integration Testing**: Full system testing through SavingsCore
- **Validation Scripts**: Automated deployment validation in `scripts/validate-deployment.js`

## Troubleshooting

### 🔧 Diagnostic Tools & Monitoring

For comprehensive diagnostic utilities, monitoring workflows, and troubleshooting guidance, see the **[Diagnostic Tools Documentation](./DIAGNOSTIC_TOOLS.md)**.

**Available diagnostic categories:**
- **System Health Monitoring** - Overall contract status and functionality
- **Contract Verification** - Deployment status and code verification
- **Transaction Analysis** - Transaction history and cost analysis
- **Gas & Cost Estimation** - Planning and optimization tools
- **Development & Testing** - Development workflow support

### Common ABI/Contract Issues

#### **"could not decode result data" Error**
```bash
# Quick fixes (in order):
1. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
2. Check MetaMask network (should be localhost:8545, Chain ID: 31337)
3. Restart Hardhat node and redeploy:
   npm run node
   npm run deploy-modular
4. Force recompile: npm run compile --force
```

#### **Module Registration Issues**
```bash
# Validate deployment and module registration:
npm run validate-deployment

# Check specific module status (if debug script exists):
npm run debug-contract
```

#### **ABI Sync Issues**
```bash
# Force update all ABIs:
npm run compile

# Verify ABI compatibility (if test script exists):
npm run test-frontend-connection
```

### Nuclear Reset (Last Resort)
```bash
# Stop all terminals, then:
npm run clean
npm run compile
npm run node  # Terminal 1
npm run deploy-modular  # Terminal 2
cd ../frontend && npm start  # Terminal 3
# Clear browser cache completely
```

## Important Notes

### **Modular Architecture Notes**
- **SavingsCore** is the main contract - frontend always interacts with this address
- **Modules** are registered dynamically and can be upgraded individually
- **Module addresses** change on upgrade, but SavingsCore address stays constant
- **Module interactions** are handled automatically through core delegation

### **Development Best Practices**
- Always use `deploy-modular` for full system deployment
- Use `upgrade-module` for individual module updates
- ABIs are auto-updated on compilation - never edit manually
- Validation scripts catch issues early - always check output
- MockUSDT uses 6 decimals to match real USDT
- Frontend expects MetaMask for wallet connection

### **Data Preservation**
- **SavingsCore upgrades**: Preserve all user data (use UUPS pattern)
- **Module upgrades**: Preserve module-specific data and registrations
- **Fresh deployments**: Only use for initial setup (DATA LOSS)
- **User proxies**: Permanent addresses tied to user wallets

### **Best Coding Practices**
- Always use DRY principle
- Never have inline imports
- As a code practice never hardcode any numbers or addresses that could otherwise be generated with our deployment script

## Cross-References

- **Root Project Overview**: See **`../CLAUDE.md`** for multi-blockchain orchestration and workspace management
- **Diagnostic Tools**: See **`./DIAGNOSTIC_TOOLS.md`** for comprehensive monitoring, troubleshooting, and maintenance utilities
- **Solana Development**: See **`../solana/`** folder for Solana-specific development
- **Frontend Development**: See **`../frontend/`** folder for React app development
- **Multi-Chain Commands**: Use workspace commands from project root (see **`../CLAUDE.md`**)