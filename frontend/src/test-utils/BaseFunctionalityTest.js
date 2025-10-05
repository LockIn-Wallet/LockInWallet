const TestHelpers = require('./TestHelpers');
const { TestAssertions } = require('./TestHelpers');
const { Transaction } = require('@solana/web3.js');

/**
 * BaseFunctionalityTest - Base class for E2E functionality tests
 *
 * This class provides a foundation for testing Solana savings functionality
 * without UI dependencies. Tests focus on adapter methods and business logic
 * rather than button positions or DOM elements.
 *
 * Key principles:
 * - Test functionality, not UI
 * - Use adapter methods directly
 * - Validate blockchain state changes
 * - Test both success and failure scenarios
 */
class BaseFunctionalityTest {
  constructor() {
    this.testEnv = null;
    this.testStartTime = null;
  }

  /**
   * Set up test environment before each test
   */
  async beforeEach(testScenario = 'default') {
    this.testStartTime = Date.now();
    console.log('🧪 Setting up functionality test:', testScenario);

    // Validate that local validator is running
    const isValid = await TestHelpers.validateTestEnvironment();
    if (!isValid) {
      throw new Error('Test environment validation failed. Ensure local Solana validator is running.');
    }

    // Set up test environment
    this.testEnv = await TestHelpers.setupTestEnvironment(testScenario);

    // Ensure wallet is connected before funding
    if (!this.testEnv.mockWallet.connected) {
      await this.testEnv.mockWallet.connect();
    }

    // Fund test account using the connected wallet's public key
    await TestHelpers.fundTestAccount(
      this.testEnv.connection,
      this.testEnv.mockWallet.publicKey || this.testEnv.testKeypair.publicKey,
      TestHelpers.TEST_CONFIG.AMOUNTS.SOL_DEPOSIT * 10 // Fund with 10x deposit amount
    );

    console.log('✅ Test setup complete in', Date.now() - this.testStartTime, 'ms');
  }

  /**
   * Clean up after each test
   */
  async afterEach() {
    console.log('🧪 Cleaning up functionality test...');

    if (this.testEnv) {
      await TestHelpers.cleanupTestEnvironment(this.testEnv);
    }

    console.log('✅ Test cleanup complete');
  }

  /**
   * Test adapter method without UI interaction
   * This demonstrates the core testing pattern: call adapter methods directly
   */
  async testAdapterMethod(methodName, args = [], expectedResult = null) {
    console.log(`🧪 Testing adapter method: ${methodName}`, args);

    try {
      const adapter = this.testEnv.solanaAdapter;
      const method = adapter[methodName];

      if (typeof method !== 'function') {
        throw new Error(`Adapter method '${methodName}' not found`);
      }

      // Execute the adapter method
      const result = await method.apply(adapter, args);

      // Validate result if expected
      if (expectedResult !== null) {
        if (typeof expectedResult === 'function') {
          expectedResult(result);
        } else {
          if (result !== expectedResult) {
            throw new Error(`Method result mismatch. Expected: ${expectedResult}, Actual: ${result}`);
          }
        }
      }

      console.log(`✅ Adapter method ${methodName} succeeded:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Adapter method ${methodName} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Test transaction simulation before execution
   */
  async testTransactionSimulation(transactionBuilder) {
    console.log('🧪 Testing transaction simulation...');

    try {
      // Build transaction
      const transaction = await transactionBuilder(this.testEnv);

      // Simulate transaction
      const simulation = await TestHelpers.simulateTransaction(
        this.testEnv.connection,
        transaction
      );

      console.log('✅ Transaction simulation passed');
      return simulation;
    } catch (error) {
      console.error('❌ Transaction simulation failed:', error.message);
      throw error;
    }
  }

  /**
   * Test error scenarios
   */
  async testErrorScenario(operation, expectedError) {
    console.log('🧪 Testing error scenario...');

    try {
      await operation(this.testEnv);
      throw new Error('Expected operation to throw error, but it succeeded');
    } catch (error) {
      TestAssertions.assertErrorMessage(error, expectedError);
      console.log('✅ Error scenario test passed');
      return error;
    }
  }

  /**
   * Test account state persistence
   */
  async testAccountStatePersistence(operation, expectedStateChanges) {
    console.log('🧪 Testing account state persistence...');

    // Get initial state
    const initialBalance = await this.getCurrentSOLBalance();

    // Execute operation
    const result = await operation(this.testEnv);

    // Validate state changes
    await TestHelpers.validateAccountState(
      this.testEnv.solanaAdapter,
      {
        solBalance: initialBalance + expectedStateChanges.solBalanceChange,
        ...expectedStateChanges
      }
    );

    console.log('✅ Account state persistence test passed');
    return result;
  }

  /**
   * Helper methods for common test patterns
   */

  // Get test keypair for current test user
  getTestKeypair() {
    return this.testEnv.testKeypair;
  }

  // Get test public key
  getTestPublicKey() {
    return this.testEnv.mockWallet.publicKey;
  }

  // Set wallet failure modes for testing error scenarios
  setWalletFailureMode(failureMode) {
    this.testEnv.mockWallet.setFailureModes(failureMode);
  }

  // Get current SOL balance
  async getCurrentSOLBalance() {
    const userAddress = await this.testEnv.solanaAdapter.getAddress();
    const userAddressString = userAddress?.toString() || userAddress;
    return await this.testEnv.solanaAdapter.getTokenBalance(userAddressString, 'SOL');
  }

  // Create test transaction
  async createTestTransaction(instructions) {
    const transaction = new Transaction();
    transaction.add(...instructions);
    transaction.feePayer = this.getTestPublicKey();

    const { blockhash } = await this.testEnv.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    return transaction;
  }
}

module.exports = {
  BaseFunctionalityTest
};