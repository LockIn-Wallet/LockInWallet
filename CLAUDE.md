# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **multi-blockchain savings wallet DApp** that supports both **Ethereum/EVM** and **Solana** networks. Users can deposit tokens with built-in spending controls, multi-approval mechanisms, and time-based limits across both blockchain ecosystems.

## Project Structure

```
savings-wallet/
├── ethereum/                   # Ethereum/EVM smart contracts and tooling
│   ├── contracts/             # Solidity smart contracts (modular architecture)
│   ├── scripts/              # Hardhat deployment and utility scripts
│   ├── test/                 # Hardhat test suites
│   ├── hardhat.config.ts     # Hardhat configuration
│   ├── package.json          # EVM-specific dependencies
│   └── CLAUDE.md            # EVM-specific development guide
├── solana/                    # Solana programs and tooling
│   ├── programs/             # Anchor/Rust programs
│   ├── tests/               # Anchor test suites
│   ├── Anchor.toml          # Anchor configuration
│   ├── package.json         # Solana-specific dependencies
│   └── [deployment scripts] # Solana-specific scripts
├── frontend/                  # Multi-blockchain React frontend
│   ├── src/                 # React components and blockchain adapters
│   ├── package.json         # Frontend dependencies
│   └── [React app files]   # Standard Create React App structure
├── package.json              # Workspace management and multi-chain commands
└── CLAUDE.md                 # This file - multi-chain overview
```

## Architecture

### Multi-Blockchain Design
- **Ethereum Layer**: UUPS upgradeable smart contracts with modular architecture
- **Solana Layer**: Anchor programs with Program Derived Addresses (PDAs)
- **Unified Frontend**: Single React app supporting both blockchains
- **Shared Features**: Identical functionality across both chains (spending limits, bypass system, proposals)

### Ethereum Smart Contracts (`ethereum/`)
- **Modular Architecture**: Core contract + 4 specialized modules
- **UUPS Proxy Pattern**: Upgradeable contracts preserving user data
- **Module System**: TimePeriodLimits, ProposalSystem, BypassSystem, ApprovalSystem
- **Documentation**: See `ethereum/CLAUDE.md` for detailed EVM development guide

### Solana Programs (`solana/`)
- **Anchor Framework**: Rust-based smart contract development
- **PDA Architecture**: Program-derived addresses for deterministic accounts
- **Cross-Program Invocations**: Modular program interactions
- **Documentation**: Existing Solana-specific documentation in `solana/` folder

### Frontend (`frontend/`)
- **Framework**: Create React App with multi-blockchain support
- **Blockchain Adapters**: Separate adapters for EVM (ethers.js) and Solana (@solana/web3.js)
- **Unified Interface**: Single UI supporting both blockchain backends
- **Network Switching**: Dynamic switching between EVM and Solana networks

## Core Features

The multi-blockchain savings system implements identical functionality across both chains:

### Shared Features (EVM + Solana)
- **Multi-token support**: Native tokens (ETH/SOL) and standards (ERC20/SPL)
- **Time-based spending limits**: Daily/Weekly/Monthly periods with custom durations
- **Two-phase proposal system**: 24-72 hour timelock for security
- **Emergency bypass system**: Urgent withdrawals with timelock protection
- **Multi-signature approval system**: Emergency and administrative functions
- **Deterministic addresses**: Permanent deposit addresses for exchange integration

### EVM-Specific Features
- **Module upgradeability**: Individual modules can be upgraded without affecting others
- **UUPS proxy pattern**: Upgradeable contracts preserving user data
- **Contract size optimization**: Modular architecture stays under deployment limits

### Solana-Specific Features
- **Program Derived Addresses (PDAs)**: Deterministic account generation
- **Cross-program invocations**: Modular program interactions
- **Anchor framework**: Type-safe Rust development environment

## Development Commands

### ⚡ Multi-Blockchain Development Startup

**Option 1: Workspace Commands (RECOMMENDED)**
```bash
# Start both blockchains
npm run dev:multi

# Deploy to both chains and start frontend
npm run deploy:full
npm run frontend:start

# Or start everything at once
npm run dev:full
```

**Option 2: Individual Chain Development**
```bash
# Ethereum development
npm run eth:node        # Start EVM chain
npm run eth:deploy-modular    # Deploy EVM contracts
cd frontend && npm start      # Start frontend

# Solana development
npm run solana:localnet       # Start Solana validator
npm run solana:deploy-reliable    # Deploy Solana programs
cd frontend && npm start          # Start frontend
```

**Option 3: Manual Setup (Advanced)**
```bash
# Terminal 1: Start EVM blockchain
cd ethereum && npm run node

# Terminal 2: Start Solana blockchain
npm run solana:localnet

# Terminal 3: Deploy contracts and start frontend
npm run eth:deploy-modular    # Deploy EVM contracts
npm run solana:deploy-reliable    # Deploy Solana programs
npm run frontend:start       # Start React app with dual blockchain support
```

### EVM Smart Contract Development
For detailed EVM development, see **`ethereum/CLAUDE.md`**

**Quick EVM Commands:**
```bash
# Using workspace commands (from project root)
npm run eth:compile            # Compile contracts
npm run eth:test              # Run tests
npm run eth:node             # Start local blockchain
npm run eth:deploy-modular   # Deploy all contracts + modules

# Working directly in ethereum/ folder
cd ethereum
npm run compile              # Compile contracts
npm run deploy-modular       # Deploy with module system
npm run upgrade-module <ModuleName> <CoreAddress>  # Upgrade specific module
```

### Solana Smart Contract Development (Anchor)

#### ⚡ **RECOMMENDED: Reliable Deployment (IMPORTANT!)**
```bash
# 🎯 ONE-COMMAND DEPLOYMENT (handles everything automatically)
npm run solana:deploy-reliable

# This script automatically:
# - Checks prerequisites (Anchor CLI, etc.)
# - Starts local validator if needed
# - Builds the program (bypassing version conflicts)
# - Deploys to local validator
# - Updates frontend addresses
# - Provides deployment summary
```

#### **Individual Commands (Advanced Users)**
```bash
# Start local Solana validator
npm run solana:localnet

# Build Solana programs (may have version conflicts)
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

#### **✅ WORKING CONFIGURATION (Updated)**
**Required Versions for Successful Build/Deploy:**
- **Solana CLI**: 2.1.15+ (Agave) - `sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.15/install)"`
- **Anchor CLI**: 0.31.1 (homebrew) - `brew install anchor-cli`
- **Rust**: 1.85.0+ (we use 1.90.0) - `rustup update`

**Deployment:**
```bash
npm run solana:deploy-reliable  # Still recommended for automation
# OR manual deployment:
cd solana && anchor build && anchor deploy --provider.cluster localnet
```

### Frontend Development (Multi-Blockchain)
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

## Workspace Management

This project uses **npm workspaces** to manage the multi-blockchain architecture:

### Installing Dependencies
```bash
# Install all workspace dependencies
npm run install:all

# Install for specific workspace
npm install --workspace=ethereum
npm install --workspace=solana
npm install --workspace=frontend
```

### Running Commands Across Workspaces
```bash
# Ethereum commands
npm run eth:compile
npm run eth:deploy-modular
npm run eth:test

# Solana commands
npm run solana:deploy-reliable
npm run solana:build
npm run solana:test

# Frontend commands
npm run frontend:start
npm run frontend:build

# Multi-chain commands
npm run dev:multi     # Start both blockchains
npm run dev:full      # Start everything (chains + frontend)
npm run deploy:full   # Deploy to both chains
```

## Technical Architecture Overview

### EVM Architecture
For detailed technical information about the Ethereum implementation, see **`ethereum/CLAUDE.md`**:
- Modular smart contract design with UUPS proxy pattern
- 4 specialized modules (TimePeriodLimits, ProposalSystem, BypassSystem, ApprovalSystem)
- Module upgradeability and storage preservation
- Hardhat development environment with automated ABI sync

### Solana Architecture
For detailed technical information about the Solana implementation:
- Anchor framework with Rust smart contracts
- Program Derived Addresses (PDAs) for deterministic accounts
- Cross-program invocations for modular functionality
- Existing documentation in `solana/` folder

### Frontend Architecture
- **Multi-blockchain support**: Single React app with blockchain adapters
- **EVM Integration**: ethers.js v6 for Ethereum connectivity
- **Solana Integration**: @solana/web3.js for Solana connectivity
- **Network Switching**: Dynamic switching between blockchain backends
- **Shared UI**: Identical interface for both blockchain implementations

## Deployment Process

### Initial Setup (Multi-Blockchain)

**Option 1: Quick Setup**
```bash
# Install all dependencies
npm run install:all

# Start both blockchains and deploy
npm run dev:multi          # Start EVM + Solana chains
npm run deploy:full        # Deploy to both chains
npm run frontend:start     # Start React app
```

**Option 2: Step-by-Step Setup**
```bash
# Terminal 1: Start EVM chain
npm run eth:node

# Terminal 2: Start Solana chain
npm run solana:localnet

# Terminal 3: Deploy and start frontend
npm run eth:deploy-modular
npm run solana:deploy-reliable
npm run frontend:start
```

### Development Workflow

**For EVM development:**
```bash
cd ethereum               # Work in ethereum folder
npm run compile          # Compile contracts
npm run deploy-modular   # Deploy with modules
npm run test            # Run tests
```

**For Solana development:**
```bash
cd solana                # Work in solana folder
npm run deploy-reliable  # Deploy programs
anchor test             # Run tests
```

**For frontend development:**
```bash
cd frontend             # Work in frontend folder
npm start              # Start dev server
npm test               # Run tests
```

## Best Practices

### Development Workflow
- **Chain-specific development**: Use `cd ethereum` or `cd solana` for focused development
- **Multi-chain testing**: Use workspace commands from root to test both chains
- **Incremental deployment**: Deploy to one chain first, test, then deploy to the other
- **Frontend compatibility**: Ensure frontend changes work with both blockchain backends

### Project Organization
- **EVM-specific files**: Keep all Ethereum development in `ethereum/` folder
- **Solana-specific files**: Keep all Solana development in `solana/` folder
- **Shared resources**: Frontend and project-wide configuration stay in root
- **Documentation**: Chain-specific docs in respective folders, overview in root

### Common Commands Reference
```bash
# Project setup
npm run install:all        # Install all workspace dependencies

# Multi-chain development
npm run dev:multi          # Start both chains
npm run deploy:full        # Deploy to both chains
npm run dev:full           # Start chains + frontend

# Individual chain development
npm run eth:*              # Ethereum commands
npm run solana:*           # Solana commands
npm run frontend:*         # Frontend commands

# Direct workspace development
cd ethereum && npm run *   # Work directly in ethereum folder
cd solana && npm run *     # Work directly in solana folder
cd frontend && npm run *   # Work directly in frontend folder
```

## Documentation

- **Root CLAUDE.md**: This file - multi-chain overview and workspace management
- **ethereum/CLAUDE.md**: Detailed EVM development guide (contracts, deployment, modules)
- **solana/**: Existing Solana-specific documentation and deployment guides
- **frontend/**: React app documentation for multi-blockchain UI

## Migration Notes

This project has been refactored into a workspace structure:
- **Before**: All EVM files in root, mixed with Solana and frontend
- **After**: Clean separation with `ethereum/`, `solana/`, `frontend/` folders
- **Benefits**: Independent development, clearer dependencies, scalable architecture
- **Backward compatibility**: Root workspace commands maintain familiar workflow
