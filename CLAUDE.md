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
- **Documentation**: See `solana/CLAUDE.md` for detailed Solana development guide

### Frontend (`frontend/`)
- **Framework**: Create React App with multi-blockchain support
- **Blockchain Adapters**: Separate adapters for EVM (ethers.js) and Solana (@solana/web3.js)
- **Unified Interface**: Single UI supporting both blockchain backends
- **Network Switching**: Dynamic switching between EVM and Solana networks

## Core Features

Multi-blockchain savings system with identical functionality across EVM and Solana:
- **Multi-token support** (ETH/SOL, ERC20/SPL)
- **Time-based spending limits** with proposals system
- **Emergency bypass** and multi-signature approvals
- **Deterministic addresses** for seamless exchange integration

For detailed feature documentation, see component-specific folders.

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
npm run node --workspace=ethereum        # Start EVM chain
npm run deploy-modular --workspace=ethereum    # Deploy EVM contracts
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
npm run deploy-modular --workspace=ethereum    # Deploy EVM contracts
npm run solana:deploy-reliable    # Deploy Solana programs
npm run frontend:start       # Start React app with dual blockchain support
```

### EVM Smart Contract Development
For detailed EVM development, see **`ethereum/CLAUDE.md`**

### Solana Smart Contract Development
For detailed Solana development, see **`solana/CLAUDE.md`**

### Frontend Development
For detailed frontend development, see documentation in **`frontend/`** folder

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
npm run compile --workspace=ethereum
npm run deploy-modular --workspace=ethereum
npm run test --workspace=ethereum

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

See individual component documentation:
- **EVM Architecture**: Detailed in **`ethereum/CLAUDE.md`**
- **Solana Architecture**: Detailed in **`solana/CLAUDE.md`**
- **Frontend Architecture**: Documented in **`frontend/`** folder

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
npm run node --workspace=ethereum

# Terminal 2: Start Solana chain
npm run solana:localnet

# Terminal 3: Deploy and start frontend
npm run deploy-modular --workspace=ethereum
npm run solana:deploy-reliable
npm run frontend:start
```

### Development Workflow

Use workspace commands from project root or navigate to specific folders:
- **EVM**: See **`ethereum/CLAUDE.md`** for detailed workflow
- **Solana**: See **`solana/CLAUDE.md`** for detailed workflow
- **Frontend**: See **`frontend/`** folder for detailed workflow

## Best Practices

- **Chain-specific development**: Use component folders (`ethereum/`, `solana/`, `frontend/`) for focused work
- **Multi-chain testing**: Use workspace commands from root for cross-chain orchestration
- **Documentation**: Component-specific docs in respective folders, orchestration in root

### Testing Requirements
- **Write tests for all new features** unless explicitly told not to
- **Run tests before committing** to ensure code quality and functionality
- Use 'npm run test' to verify all tests pass before making commits
- Tests should cover both happy path and edge cases for new functionality

### Common Commands Reference
```bash
# Project setup
npm run install:all        # Install all workspace dependencies

# Multi-chain development
npm run dev:multi          # Start both chains
npm run deploy:full        # Deploy to both chains
npm run dev:full           # Start chains + frontend

# Individual chain development
npm run * --workspace=ethereum    # Ethereum commands
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
- **solana/CLAUDE.md**: Detailed Solana development guide (programs, deployment, Anchor)
- **frontend/**: React app documentation for multi-blockchain UI

## Migration Notes

This project has been refactored into a workspace structure:
- **Before**: All EVM files in root, mixed with Solana and frontend
- **After**: Clean separation with `ethereum/`, `solana/`, `frontend/` folders
- **Benefits**: Independent development, clearer dependencies, scalable architecture
- **Backward compatibility**: Root workspace commands maintain familiar workflow
