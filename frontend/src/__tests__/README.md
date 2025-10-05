# E2E Functionality Testing Framework

This directory contains a comprehensive E2E testing framework for Solana savings functionality that focuses on **testing functionality, not UI**. The tests are designed to remain stable as the UI evolves, focusing on what matters: does the blockchain functionality work correctly?

## 🎯 Key Principles

- **Test functionality, not UI** - Use adapter methods directly, not button clicks
- **UI-independent** - Tests work regardless of button placement or UI changes
- **Blockchain-focused** - Validate state changes, transaction success, error handling
- **Fast feedback** - Transaction simulation before execution
- **Comprehensive coverage** - Happy path, edge cases, and error scenarios

## 📁 Directory Structure

```
__tests__/
├── functionality/           # Core functionality tests (UI-independent)
│   ├── BaseFunctionalityTest.js    # Base test class with common utilities
│   └── SolanaAdapterTests.test.js  # Adapter method tests
├── simulation/              # Transaction simulation tests
│   └── SimulationTests.test.js     # Comprehensive simulation testing
└── README.md               # This file
```

## 🚀 Quick Start

### 1. Run All Tests (Automated Pipeline)
```bash
# Complete automated pipeline: starts validator, deploys programs, runs tests
npm run test:pipeline
```

### 2. Development Testing
```bash
# Set up test environment for development
npm run test:e2e:dev

# Then run specific test types
npm run test:functionality    # Adapter method tests
npm run test:simulation      # Transaction simulation tests
```

### 3. Manual Setup (Advanced)
```bash
# 1. Start Solana validator (from project root)
npm run solana:localnet

# 2. Deploy programs (from project root)
npm run solana:deploy-reliable

# 3. Run tests (from frontend/)
npm run test:functionality
```

## 🧪 Test Categories

### Functionality Tests (`functionality/`)

These tests validate core adapter functionality without UI dependencies:

- **Account Management**: Create and manage savings accounts
- **SOL Deposits**: Deposit SOL and validate balance changes
- **SOL Withdrawals**: Withdraw SOL and validate state updates
- **Balance Queries**: Accurate balance reporting
- **Error Handling**: Invalid inputs, insufficient funds, connection failures
- **Multi-User Scenarios**: Independent user operations

**Example test pattern:**
```javascript
// ❌ Don't test UI elements
const button = screen.getByText('Deposit SOL');
fireEvent.click(button);

// ✅ Test functionality directly
const result = await solanaAdapter.depositSOL(amount);
expect(result).toBeTruthy();
```

### Simulation Tests (`simulation/`)

These tests use transaction simulation for fast validation without state changes:

- **Pre-flight validation** - Catch errors before execution
- **Gas estimation** - Accurate transaction cost estimates
- **Performance analysis** - Resource consumption patterns
- **Error scenario testing** - Invalid transactions, insufficient funds
- **Batch operation simulation** - Complex multi-step workflows

**Benefits:**
- **Fast** - No actual blockchain transactions
- **Safe** - No state changes during testing
- **Comprehensive** - Test scenarios that would be expensive to execute

## 🛠 Test Infrastructure

### MockWalletProvider (`test-utils/MockWalletProvider.js`)

Replaces browser wallet extensions for testing:

```javascript
import { createMockWalletContext } from '../test-utils/MockWalletProvider';

// Create test wallet
const mockWallet = createMockWalletContext('default');
await mockWallet.connect();

// Use in tests
const signature = await mockWallet.signTransaction(transaction);
```

**Features:**
- Programmatic keypair generation
- Multiple test scenarios (default, rich user, failures)
- No browser extension required
- Full wallet adapter interface

### TestHelpers (`test-utils/TestHelpers.js`)

Common utilities for test setup and validation:

- **Environment validation** - Check validator and programs
- **Account funding** - Automatic test account setup
- **State validation** - Verify blockchain state changes
- **Transaction simulation** - Pre-flight validation
- **Cleanup utilities** - Resource management

### TestSetup (`test-utils/TestSetup.js`)

Automated test pipeline orchestration:

- **Prerequisites validation** - Check required tools
- **Validator management** - Start/stop Solana validator
- **Program deployment** - Automated deploy-reliable execution
- **Test execution** - Run test suites with proper setup
- **Cleanup** - Resource cleanup and process management

## 📊 Test Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run test:pipeline` | Complete automated pipeline | CI/CD, full validation |
| `npm run test:e2e:dev` | Development setup | Local development |
| `npm run test:functionality` | Adapter method tests | Feature development |
| `npm run test:simulation` | Simulation tests | Performance validation |
| `npm run test:ci` | CI-optimized tests | Continuous integration |
| `npm run validate:environment` | Environment check | Troubleshooting |

## 🎨 Writing New Tests

### 1. Functionality Tests

Extend `BaseFunctionalityTest` for adapter method testing:

```javascript
import { BaseFunctionalityTest } from './BaseFunctionalityTest';

describe('New Feature Tests', () => {
  let functionalityTest;

  beforeEach(async () => {
    functionalityTest = new BaseFunctionalityTest();
    await functionalityTest.beforeEach('default');
  });

  afterEach(async () => {
    await functionalityTest.afterEach();
  });

  test('should test new feature', async () => {
    // Test adapter method directly
    const result = await functionalityTest.testAdapterMethod(
      'newFeatureMethod',
      [param1, param2],
      expectedResult
    );

    // Validate state changes
    await functionalityTest.testAccountStatePersistence(
      async (testEnv) => {
        return await testEnv.solanaAdapter.newFeature(params);
      },
      { expectedStateChanges }
    );
  });
});
```

### 2. Simulation Tests

Test transaction validation without execution:

```javascript
test('should simulate new feature transaction', async () => {
  const simulation = await functionalityTest.testTransactionSimulation(
    async (testEnv) => {
      return await testEnv.solanaAdapter.buildNewFeatureTransaction(params);
    }
  );

  expect(simulation.err).toBeNull();
  expect(simulation.unitsConsumed).toBeGreaterThan(0);
});
```

### 3. Error Scenario Tests

Validate error handling:

```javascript
test('should handle invalid input', async () => {
  await functionalityTest.testErrorScenario(
    async (testEnv) => {
      return await testEnv.solanaAdapter.newFeature(-1); // Invalid input
    },
    'Invalid input' // Expected error message
  );
});
```

## 🔧 Configuration

### Test Environment Variables

```bash
# Override default configuration
SOLANA_VALIDATOR_PORT=8899      # Validator port
TEST_TIMEOUT=300000             # Test timeout (5 minutes)
VERBOSE_LOGGING=true            # Enable detailed logging
```

### Test Scenarios

Multiple test scenarios available via MockWalletProvider:

- `default` - Standard test user
- `richUser` - User with large balance
- `restrictedUser` - User with limited permissions
- `failedConnection` - Simulates connection failures
- `failedSigning` - Simulates signing failures

## 🚨 Troubleshooting

### Common Issues

1. **"Validator not running"**
   ```bash
   npm run validate:environment
   npm run solana:localnet
   ```

2. **"Programs not deployed"**
   ```bash
   cd ../solana && npm run deploy-reliable
   ```

3. **"Port already in use"**
   ```bash
   lsof -ti:8899 | xargs kill -9
   ```

4. **"Test timeouts"**
   - Increase timeout in test configuration
   - Check validator performance
   - Reduce test complexity

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
VERBOSE_LOGGING=true npm run test:functionality
```

## 🏆 Best Practices

### Do ✅
- Test adapter methods directly
- Validate blockchain state changes
- Use simulation for fast feedback
- Test both success and failure scenarios
- Clean up resources after tests
- Use meaningful test descriptions

### Don't ❌
- Test UI element positions
- Depend on specific DOM structure
- Skip error scenario testing
- Leave validator processes running
- Hardcode addresses or amounts
- Test only happy path scenarios

## 📈 Benefits

This testing framework provides:

- **UI Stability** - Tests survive UI changes
- **Fast Feedback** - Simulation catches errors quickly
- **Comprehensive Coverage** - All scenarios tested
- **Easy Debugging** - Clear error messages and logging
- **CI/CD Ready** - Automated pipeline for continuous integration
- **Developer Friendly** - Easy to write and maintain tests

## 🔗 Integration

The testing framework integrates with:

- **Jest** - Test runner and assertions
- **Solana Web3.js** - Blockchain interaction
- **Anchor** - Program deployment and interaction
- **Mock Wallet** - Browser-free wallet simulation
- **Local Validator** - Isolated test environment

This comprehensive testing setup ensures that your Solana savings functionality works correctly regardless of how the UI evolves!