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

## Development Principles

This project follows core software engineering principles to ensure maintainable, scalable, and robust code:

### KISS (Keep It Simple, Stupid)
- **Favor simplicity over complexity** - Choose the simplest solution that works
- **Avoid over-engineering** - Don't add features or complexity until needed
- **Write readable code** - Code should be self-documenting and easy to understand
- **Use clear naming** - Variables, functions, and components should have descriptive names

### DRY (Don't Repeat Yourself)
- **No code duplication** - Extract common functionality into reusable components/functions
- **Centralized configuration** - Use shared constants, configs, and design tokens
- **Modular architecture** - Create reusable modules that can be shared across blockchain layers
- **Component reuse** - Build composable UI components that work across different contexts

### SOLID Principles
- **Single Responsibility** - Each class/component should have one reason to change
- **Open/Closed** - Open for extension, closed for modification
- **Liskov Substitution** - Subtypes must be substitutable for their base types
- **Interface Segregation** - Depend on abstractions, not concretions
- **Dependency Inversion** - High-level modules shouldn't depend on low-level modules

### Practical Applications
- **Smart Contracts**: Modular contract architecture (EVM) and program separation (Solana)
- **Frontend**: Unified style system, blockchain adapters, and reusable components
- **Testing**: Shared test utilities and consistent testing patterns
- **Documentation**: Clear, maintainable documentation that follows DRY principles

### Code Quality Standards
- **Follow existing patterns** - Maintain consistency with established codebase conventions
- **Refactor when needed** - Improve code structure while maintaining functionality
- **Test coverage** - Write tests for new features and maintain existing test suites
- **Code reviews** - All changes should follow these principles

## Development Commands

### 🚀 Quick Start Commands

Common development scenarios for fast project startup:

```bash
# Start project for Solana development
npm run solana:deploy-reliable && npm run frontend:start

# Start project for EVM development (all-in-one: chain + deploy + frontend)
npm run dev:evm

# Manual EVM development (when you need more control)
npm run deploy-modular --workspace=ethereum && npm run frontend:start

# Full multi-chain development (everything at once)
npm run dev:full

# Frontend-only restart (when contracts already deployed)
npm run frontend:start

# Quick multi-chain deployment
npm run deploy:full && npm run frontend:start
```

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
# Ethereum development (automated)
npm run dev:evm              # All-in-one: start chain + deploy + frontend

# Ethereum development (manual steps)
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

### 🚀 Production Builds

Build and serve optimized production bundles for deployment or local testing:

**Quick Commands (From Project Root)**
```bash
# Build production bundle
npm run frontend:build:production

# Serve production build locally (http://localhost:3001)
npm run frontend:serve

# Build + Serve in one command (most convenient)
npm run build-and-serve --workspace=frontend
```

**Manual Commands**
```bash
# From project root
npm run build:production --workspace=frontend
cd frontend && npx serve -s build -p 3001

# Or from frontend folder
cd frontend
npm run build:production
npm run serve
```

**Production Build Features:**
- ✅ **Optimized Bundle**: Minified JavaScript and CSS
- ✅ **No Source Maps**: Reduced bundle size for production
- ✅ **Memory Optimized**: 4GB Node.js memory allocation for large builds
- ✅ **Static Server**: Serves on http://localhost:3001 with proper MIME types
- ✅ **Ready for Deployment**: Can be deployed to any static hosting service

**Bundle Size:** ~532 kB gzipped (main bundle)

**Use Cases:**
- 🧪 **Local Testing**: Test production behavior before deployment
- 📱 **Performance Testing**: Measure real-world load times
- 🚀 **Deployment Prep**: Generate files ready for hosting
- 🔍 **Debugging**: Test with production optimizations enabled

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

## Frontend Styles Architecture

**⚠️ CRITICAL: Never create inline styles in components. Always use the organized style system.**

### Overview
The frontend uses a comprehensive, organized style system to ensure maintainability, consistency, and DRY principles. All styles are centralized in `frontend/src/styles/` with a clean import system.

### Style System Structure
```
frontend/src/styles/
├── index.js              # Main export file - import everything from here
├── theme.js              # Design tokens (colors, spacing, typography)
├── utilities.js          # Common utility styles & spacing helpers
└── components/           # Component-specific styles
    ├── buttons.js        # Button variants & states
    ├── cards.js          # Card layouts & status cards
    ├── forms.js          # Form inputs, labels, selects
    ├── layout.js         # Layout patterns & containers
    └── steps.js          # Step wizard styles & states
```

### Usage Pattern (ALWAYS Follow)
```javascript
// ✅ CORRECT - Import from styles system
import {
  styles,              // Convenience object with common patterns
  buttonStyles,        // Button variants (primary, secondary, etc.)
  cardStyles,          // Card types (status, balance, warning, etc.)
  formStyles,          // Form elements (input, select, label)
  stepStyles,          // Step containers & validation states
  layoutStyles,        // Layout patterns (flex, grid, spacing)
  utilityStyles,       // Typography & utility classes
  spacingUtilities,    // Margin/padding utilities (m0, mb2, p3, etc.)
  colors,              // Color tokens (success.light, text.primary)
  spacing,             // Spacing scale (xs, sm, md, lg, xl, xxl)
  borderRadius,        // Border radius scale
  fontSize,            // Font size scale
  fontWeight,          // Font weight scale
  // Helper functions
  getStepContainerStyle,
  getStepTitleColor,
} from "./styles";

// ✅ Use organized styles in components
<button style={buttonStyles.primary}>
<div style={cardStyles.statusCard}>
<input style={formStyles.input}>
<div style={layoutStyles.flexBetween}>
<span style={utilityStyles.textSuccess}>
<div style={spacingUtilities.mb3}>  // marginBottom: spacing.md
```

### Design Tokens
All visual properties use centralized design tokens:
```javascript
// Colors
colors.success.main        // #48bb78
colors.success.light       // #9ae6b4
colors.text.primary        // white
colors.text.secondary      // #e2e8f0
colors.background.primary  // #2d3748

// Spacing Scale
spacing.xs    // 4px      spacingUtilities.m1, p1
spacing.sm    // 8px      spacingUtilities.m2, p2
spacing.md    // 10px     spacingUtilities.m3, p3
spacing.lg    // 12px     spacingUtilities.m4, p4
spacing.xl    // 15px     spacingUtilities.m5, p5
spacing.xxl   // 20px     spacingUtilities.m6, p6

// Typography
fontSize.xs    // 0.75rem
fontSize.sm    // 0.875rem
fontSize.normal // 1rem
fontSize.lg    // 1.125rem
fontSize.xl    // 1.25rem
```

### Component Style Patterns
```javascript
// Buttons
buttonStyles.primary      // Main action buttons
buttonStyles.secondary    // Secondary actions
buttonStyles.success      // Success states
buttonStyles.warning      // Warning actions
buttonStyles.danger       // Destructive actions
buttonStyles.disabled     // Disabled state

// Cards
cardStyles.statusCard     // Main status display
cardStyles.balanceCard    // Balance information
cardStyles.warningCard    // Warning messages
cardStyles.successCard    // Success notifications

// Layout
layoutStyles.flexBetween  // justify-content: space-between
layoutStyles.flexCenter   // Center content
layoutStyles.flexAlignCenter // Align items center with gap
layoutStyles.section      // Standard section spacing
layoutStyles.textCenter   // Text alignment
```

### Conditional Styling Helpers
```javascript
// Step containers with conditional logic
getStepContainerStyle(stepNumber, currentStep, isCommitted, validation)

// Step titles with dynamic colors
getStepTitleColor(stepNumber, isCommitted, validation)

// Example usage
<div style={getStepContainerStyle(1, currentStep, isSetupCommitted, stepValidation)}>
<h3 style={{ ...stepStyles.step1Title, color: getStepTitleColor(1, isSetupCommitted, stepValidation) }}>
```

### ❌ What NOT to Do
```javascript
// ❌ NEVER create inline styles
<div style={{ padding: "20px", marginBottom: "15px", color: "#48bb78" }}>

// ❌ NEVER hardcode values
<span style={{ fontSize: "1.2em", color: "#9ae6b4" }}>

// ❌ NEVER repeat style objects
const buttonStyle = { padding: "8px 16px", borderRadius: "4px" }
```

### ✅ What TO Do
```javascript
// ✅ ALWAYS use organized styles
<div style={cardStyles.statusCard}>
<div style={layoutStyles.section}>
<span style={utilityStyles.textSuccess}>
<button style={buttonStyles.primary}>

// ✅ Combine styles when needed
<div style={{ ...cardStyles.baseCard, ...layoutStyles.flexBetween }}>

// ✅ Use design tokens for custom styles
<div style={{ padding: spacing.xl, color: colors.success.light }}>
```

### Adding New Styles
When adding new UI elements:

1. **Check existing patterns first** - likely already exists
2. **Use design tokens** - never hardcode values
3. **Add to appropriate component file** - buttons.js, cards.js, etc.
4. **Export from main index.js** - maintain clean import
5. **Follow naming convention** - descriptive, component-based names

### Benefits of This System
- **Maintainability**: Central design system
- **Consistency**: All components use same tokens
- **DRY Principle**: No repeated style values
- **Performance**: Reused style objects
- **Developer Experience**: Clear, organized imports
- **Design System**: Easy theme changes via tokens

### Testing Requirements
- **Write tests for all new features** unless explicitly told not to
- **Run tests before committing** to ensure code quality and functionality
- Use 'npm run test' to verify all tests pass before making commits
- Tests should cover both happy path and edge cases for new functionality

#### What NOT to test
Tests cover **wallet functionality only** — contracts, adapters, transaction
flows, and the business logic behind them.

**Do not write tests for marketing, SEO or demo code.** That includes the
logged-out home page and its sections, the standalone content pages
(`/prize-savings`, `/savings-visualiser`), landing copy and nav data, SEO
helpers and metadata, and the illustrative demo/simulation utilities behind
them (e.g. `utils/homeDemo.js`, `utils/futureMirror.js`, `utils/seo.js`,
`utils/landingContent.js`, `utils/prizeSavingsContent.js`, and the
`components/organisms/landing/` tree). None of it touches user funds — the
numbers are illustrative, the copy changes often, and tests there only slow
iteration down. Verify those changes by looking at the page.

### Common Commands Reference
```bash
# Project setup
npm run install:all        # Install all workspace dependencies

# Multi-chain development
npm run dev:multi          # Start both chains
npm run deploy:full        # Deploy to both chains
npm run dev:full           # Start chains + frontend

# Individual chain development
npm run dev:evm            # EVM: start chain + deploy + frontend
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

### Release documentation rules

- Every user-facing or contract change MUST add a `[Unreleased]` entry in
  **CHANGELOG.md** (contract entries state the on-chain effect) AND a
  plain-language entry in **frontend/src/releaseNotes.js** (shown in-app on
  the Governance page)
- Update **SECURITY.md**/**GOVERNANCE.md** when timelocks, governance phases,
  or trust assumptions change; the governance delay must stay ≥ 2× the 24h
  emergency bypass delay
- Release process: see **RELEASING.md**

## Migration Notes

This project has been refactored into a workspace structure:
- **Before**: All EVM files in root, mixed with Solana and frontend
- **After**: Clean separation with `ethereum/`, `solana/`, `frontend/` folders
- **Benefits**: Independent development, clearer dependencies, scalable architecture
- **Backward compatibility**: Root workspace commands maintain familiar workflow

## 🧪 Testing Framework

The project includes a comprehensive E2E testing framework that validates multi-blockchain functionality without UI dependencies. Tests focus on adapter methods, business logic, and blockchain state changes across both Ethereum and Solana networks.

### Test Architecture

#### Frontend Tests (`frontend/src/__tests__/`)
- **Functionality Tests** (`functionality/`): Direct adapter method testing, wallet integration, blockchain state validation
- **Simulation Tests** (`simulation/`): Transaction execution testing, error handling, performance analysis
- **Test Utils** (`test-utils/`): Mock wallet providers, test environment setup, helper utilities

#### Key Testing Principles
- **Test functionality, not UI**: Focus on adapter methods and business logic
- **Use adapter methods directly**: Avoid DOM manipulation and UI dependencies
- **Validate blockchain state changes**: Ensure transactions produce expected outcomes
- **Test both success and failure scenarios**: Comprehensive error handling validation

### Test Environment Setup

#### Prerequisites
```bash
# Ensure Solana validator is running
solana-test-validator --bpf-program HNi2JKTNeHvz2ENckdVBW1ncfkJUYppuYeBwNhWjkK7d ./target/deploy/savings_core.so

# For Ethereum tests (if applicable)
npm run eth:node  # Start local Hardhat node
```

#### Test Configuration
The test framework automatically:
- **Validates local Solana validator** is running and accessible
- **Creates mock wallet instances** with deterministic key pairs
- **Funds test accounts** with SOL for transaction execution
- **Sets up network configurations** for both EVM and Solana adapters
- **Manages test cleanup** to prevent state leakage between tests

### Mock Wallet System

#### MockWalletProvider Features
- **Deterministic key generation**: Consistent addresses across test runs
- **Connection simulation**: Realistic wallet connection/disconnection flows
- **Failure mode testing**: Simulates connection failures, signing rejections
- **Multi-scenario support**: Different test scenarios (default, rich user, restricted user)

#### Usage Patterns
```javascript
// Basic mock wallet setup
const mockWallet = createMockWalletContext('default');
await mockWallet.connect();

// Test with failure scenarios
const failingWallet = createMockWalletContext('failedSigning');
// Will simulate signing failures for error testing
```

### Running Tests

#### Quick Test Commands
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:functionality    # Adapter functionality tests
npm run test:simulation      # Transaction simulation tests

# Run with CI configuration
npm run test:ci              # Non-interactive, with coverage

# Run specific test patterns
npm test -- --testPathPattern=SolanaAdapter
npm test -- --testNamePattern="deposit"
```

#### Test Environment Validation
```bash
# Validate test environment setup
npm run validate:environment

# Check if all prerequisites are running
# - Local Solana validator status
# - Program deployment verification
# - Network connectivity
```

### Test Structure Examples

#### Functionality Testing Pattern
```javascript
describe('SolanaAdapter Functionality', () => {
  let functionalityTest;

  beforeEach(async () => {
    functionalityTest = new BaseFunctionalityTest();
    await functionalityTest.beforeEach('default');
  });

  test('should deposit SOL successfully', async () => {
    const depositAmount = 0.1; // 0.1 SOL

    // Test adapter method directly
    const result = await functionalityTest.testAdapterMethod(
      'deposit',
      ['SOL', depositAmount, 9]
    );

    // Validate transaction success
    expect(result).toBeDefined();
    expect(typeof result).toBe('string'); // Transaction signature
  });
});
```

#### Error Scenario Testing
```javascript
test('should handle invalid deposit amounts', async () => {
  await functionalityTest.testErrorScenario(
    async (testEnv) => {
      return await testEnv.solanaAdapter.deposit('SOL', -1, 9);
    },
    'amount' // Expected error keyword
  );
});
```

### Troubleshooting Tests

#### Common Test Failures

**"Wallet not connected" errors:**
- **Cause**: Mock wallet not properly initialized or connected
- **Solution**: Ensure `MockWalletProvider` has live getter properties, not static values
- **Debug**: Check `wallet.connected` and `wallet.publicKey` status in test setup

**"Cannot read properties of undefined (reading 'tokens')" errors:**
- **Cause**: Missing network configuration in SolanaAdapter constructor
- **Solution**: Provide complete `networkConfig` with `tokens` object structure
- **Example**: Network config must include SOL and SPL token definitions

**"Program not found" or PDA derivation errors:**
- **Cause**: Solana programs not deployed to local validator
- **Solution**: Ensure programs are built and deployed before running tests
- **Command**: `npm run solana:deploy-reliable`

**ES6 import/export errors in Jest:**
- **Cause**: Jest expects CommonJS module syntax
- **Solution**: Use `require()` and `module.exports` instead of `import`/`export`
- **Note**: Test files must use CommonJS syntax even if source uses ES6

#### Debug Commands
```bash
# Run tests with detailed output
npm test -- --verbose

# Run single test with full error details
npm test -- --testNamePattern="specific test name" --verbose

# Check test environment
npm run validate:environment

# View test coverage
npm run test:ci
```

### Test Performance

#### Timing Considerations
- **Individual tests**: 30-90 seconds (includes blockchain operations)
- **Full test suite**: 5-10 minutes (depending on test coverage)
- **Network operations**: Account for validator response times
- **State cleanup**: Proper cleanup prevents test interference

#### Optimization Tips
- **Parallel execution**: Jest runs tests concurrently when possible
- **Focused testing**: Use pattern matching to run subset of tests during development
- **Mock reuse**: Efficient wallet and connection reuse within test suites
- **Timeout configuration**: Adequate timeouts for blockchain operations

### Test Maintenance

#### Adding New Tests
1. **Create test files** in appropriate `__tests__` subdirectory
2. **Use BaseFunctionalityTest** for consistent test setup
3. **Follow naming conventions**: `*.test.js` for Jest discovery
4. **Include both success and failure scenarios**
5. **Document complex test scenarios** with inline comments

#### Updating Mock Configurations
- **Network configurations**: Update token lists and program IDs as needed
- **Mock wallet scenarios**: Add new failure modes for edge case testing
- **Test data**: Keep test amounts and addresses consistent with funding levels

#### Best Practices
- **Deterministic tests**: Tests should produce same results on every run
- **Isolated tests**: No dependencies between test cases
- **Comprehensive coverage**: Test both happy path and error conditions
- **Clear assertions**: Specific, meaningful test expectations
- **Proper cleanup**: Always clean up test state in `afterEach` hooks

This testing framework ensures reliable validation of multi-blockchain functionality while maintaining fast development cycles and comprehensive error coverage.

## 🏗️ Adapter Architecture Principles

This project follows strict adapter architecture principles to ensure clean separation between blockchain-specific logic and business logic. ALL network-specific code MUST be encapsulated in adapters.

### Unified Interface Rule

**CORE PRINCIPLE**: Components MUST NOT contain network-specific conditionals (`if (networkType === "evm")` or `if (networkType === "solana")`). All blockchain differences are implementation details hidden behind unified adapter interfaces.

### Adapter Interface Requirements

Both EVM and Solana adapters MUST expose identical method signatures for the same business operations:

```javascript
// ✅ CORRECT - Both adapters implement these methods identically
interface UnifiedAdapter {
  // Setup operations
  async commitSetup(dailyLimit, weeklyLimit, monthlyLimit): Promise<string>

  // Spending limits
  async setSpendingLimits(dailyLimit, weeklyLimit, monthlyLimit): Promise<string>
  async getSpendingLimits(): Promise<SpendingLimit[]>

  // Withdrawal addresses
  async addWithdrawalAddress(title, address): Promise<string>
  async removeWithdrawalAddress(address): Promise<string>

  // Withdrawals
  async withdraw(amount, token, destination): Promise<string>

  // All methods return transaction hash/signature as string
}
```

### Method Naming Convention

- **Use business logic names**: `commitSetup()`, `addWithdrawalAddress()`, `withdraw()`
- **NOT technical names**: `commitInitialSetup()`, `requestWithdrawalAddress()`, `processWithdrawal()`
- **Return format**: Always return transaction hash/signature as string for consistency
- **Parameters**: Use business-friendly parameters (amounts as numbers, not Wei/Lamports)

### Violation Examples (DO NOT DO)

```javascript
// ❌ BAD - Network conditionals in components
if (networkType === "evm") {
  await savingsContract.commitInitialSetup();
} else {
  await transactionManager.commitSetup();
}

// ❌ BAD - Different method names for same business logic
evmContract.setCommonPeriodLimits() vs solanaAdapter.setSpendingLimits()

// ❌ BAD - Exposing technical implementation details
if (networkType === "evm") {
  const limitWei = ethers.parseUnits(amount.toString(), 6);
  await contract.method(limitWei);
}

// ❌ BAD - Network-specific error handling in components
catch (error) {
  if (networkType === "solana" && error.code === 6000) {
    // Solana-specific error handling
  } else if (networkType === "evm" && error.reason) {
    // EVM-specific error handling
  }
}
```

### Correct Pattern (DO THIS)

```javascript
// ✅ GOOD - Unified interface, no network awareness
await transactionManager.commitSetup(daily, weekly, monthly);

// ✅ GOOD - Adapter handles all network specifics
try {
  const txHash = await transactionManager.addWithdrawalAddress(title, address);
  console.log(`Transaction successful: ${txHash}`);
} catch (error) {
  // Adapter translates network-specific errors to unified format
  alert(`Operation failed: ${error.message}`);
}

// ✅ GOOD - Business logic stays clean
const limits = await transactionManager.getSpendingLimits();
const hasLimits = limits.some(limit => limit.isActive);
```

### Implementation Guidelines

#### 1. Adapter Responsibilities
```javascript
// EVMAdapter.js
class EVMAdapter {
  async commitSetup(dailyLimit, weeklyLimit, monthlyLimit) {
    // Convert to Wei internally
    const dailyWei = dailyLimit > 0 ? ethers.parseUnits(dailyLimit.toString(), 6) : 0;
    const weeklyWei = weeklyLimit > 0 ? ethers.parseUnits(weeklyLimit.toString(), 6) : 0;
    const monthlyWei = monthlyLimit > 0 ? ethers.parseUnits(monthlyLimit.toString(), 6) : 0;

    // Call unified contract method
    const tx = await this.savingsContract.commitSetup(dailyWei, weeklyWei, monthlyWei);

    // Return consistent format
    return tx.hash;
  }
}

// SolanaAdapter.js
class SolanaAdapter {
  async commitSetup(dailyLimit, weeklyLimit, monthlyLimit) {
    // Use existing commitSetupWithLimits method
    return await this.commitSetupWithLimits(dailyLimit, weeklyLimit, monthlyLimit);
  }
}
```

#### 2. Component Best Practices
```javascript
// ✅ SetupCommitStep.js - Clean business logic
const handleCommit = async () => {
  try {
    // Extract business values
    const daily = parseFloat(limitEdits.Daily.value) || 0;
    const weekly = parseFloat(limitEdits.Weekly.value) || 0;
    const monthly = parseFloat(limitEdits.Monthly.value) || 0;

    // Single unified call
    const txHash = await transactionManager.commitSetup(daily, weekly, monthly);

    alert("Setup committed successfully!");
  } catch (error) {
    alert(`Setup failed: ${error.message}`);
  }
};
```

#### 3. Error Handling Standards
```javascript
// Adapters MUST translate network-specific errors to business errors
class EVMAdapter {
  async commitSetup(...args) {
    try {
      return await this.savingsContract.commitSetup(...args);
    } catch (error) {
      // Translate EVM errors to business terms
      if (error.message.includes("Daily limit too high")) {
        throw new Error("Daily limit exceeds weekly limit");
      } else if (error.code === 4001) {
        throw new Error("Transaction cancelled by user");
      } else {
        throw new Error(`Setup failed: ${error.message}`);
      }
    }
  }
}
```

### Testing Adapter Interfaces

```javascript
// ✅ Test that both adapters implement the same interface
describe('Adapter Interface Compliance', () => {
  const evmAdapter = new EVMAdapter();
  const solanaAdapter = new SolanaAdapter();

  test('both adapters have commitSetup method', () => {
    expect(typeof evmAdapter.commitSetup).toBe('function');
    expect(typeof solanaAdapter.commitSetup).toBe('function');
  });

  test('commitSetup returns consistent format', async () => {
    const evmResult = await evmAdapter.commitSetup(100, 500, 2000);
    const solanaResult = await solanaAdapter.commitSetup(100, 500, 2000);

    expect(typeof evmResult).toBe('string'); // Transaction hash
    expect(typeof solanaResult).toBe('string'); // Transaction signature
  });
});
```

### Migration Strategy

When refactoring existing code that violates these principles:

1. **Identify Network Conditionals**: Search for `if (networkType === ` patterns
2. **Extract to Adapters**: Move network-specific logic to respective adapters
3. **Unify Method Names**: Ensure both adapters use same method names
4. **Standardize Returns**: All methods return transaction hash/signature as string
5. **Update Components**: Remove conditionals, use unified adapter calls
6. **Test Interface**: Verify both adapters work identically from component perspective

### Benefits

- ✅ **Clean separation of concerns**: Business logic separate from blockchain specifics
- ✅ **Easier testing**: Mock single interface instead of multiple network paths
- ✅ **Better maintainability**: Network changes only affect adapters
- ✅ **Consistent UX**: Same user experience across all blockchains
- ✅ **Future-proof**: Easy to add new blockchains without touching components
- ✅ **Reduced complexity**: Components focus on business logic, not technical details

### Code Review Checklist

When reviewing code, check for:
- [ ] No `if (networkType === ...)` conditionals in components
- [ ] All blockchain operations go through adapters
- [ ] Method names are business-focused, not technical
- [ ] Return formats are consistent across adapters
- [ ] Error messages are business-friendly, not network-specific
- [ ] Components can work with any adapter without modification
