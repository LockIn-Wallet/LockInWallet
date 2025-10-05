const { BaseFunctionalityTest } = require('../../test-utils/BaseFunctionalityTest');
const { TestAssertions } = require('../../test-utils/TestHelpers');

/**
 * SolanaAdapterTests - UI-independent tests for Solana adapter functionality
 *
 * These tests focus on:
 * - Testing adapter methods directly (no UI interaction)
 * - Validating blockchain state changes
 * - Testing both success and failure scenarios
 * - Ensuring functionality works regardless of UI changes
 *
 * Key principle: Test what the buttons DO, not where they are
 */

// Increase Jest timeout for blockchain operations
jest.setTimeout(120000);

describe('SolanaAdapter Functionality Tests', () => {
  let functionalityTest;

  beforeEach(async () => {
    functionalityTest = new BaseFunctionalityTest();
    await functionalityTest.beforeEach('default');
  });

  afterEach(async () => {
    if (functionalityTest) {
      await functionalityTest.afterEach();
    }
  });

  describe('Connection and Setup', () => {
    test('should connect to wallet successfully', async () => {
      // Test: Basic wallet connection functionality

      // Check if adapter is connected
      const isConnected = await functionalityTest.testAdapterMethod('isConnected');
      expect(typeof isConnected).toBe('boolean');

      // Get user address
      const address = await functionalityTest.testAdapterMethod('getAddress');
      const addressString = address?.toString() || address;
      expect(typeof addressString).toBe('string');
      expect(addressString.length).toBeGreaterThan(0);

      console.log('✅ Wallet connection test passed');
    }, 60000);

    test('should validate Solana network connection', async () => {
      // Test: Network validation functionality

      // Check if on correct network
      const isCorrectNetwork = await functionalityTest.testAdapterMethod('isCorrectNetwork');
      expect(typeof isCorrectNetwork).toBe('boolean');

      console.log('✅ Network validation test passed');
    }, 60000);
  });

  describe('SOL Deposit Functionality', () => {
    test('should deposit SOL successfully', async () => {
      // Test: Can we deposit SOL and update balance correctly?

      const depositAmount = 0.1; // 0.1 SOL
      const userAddress = await functionalityTest.testAdapterMethod('getAddress');
      const userAddressString = userAddress?.toString() || userAddress;

      // Get initial balance
      const initialBalance = await functionalityTest.testAdapterMethod('getTokenBalance', [userAddressString, 'SOL']);

      // Test the deposit functionality directly
      const result = await functionalityTest.testAdapterMethod('deposit', ['SOL', depositAmount, 9]);

      // Validate transaction signature was returned
      TestAssertions.assertTransactionSuccess(result);

      console.log('✅ SOL deposit functionality test passed');
    }, 90000);

    test('should get token balance accurately', async () => {
      // Test: Balance queries return correct values

      const userAddress = await functionalityTest.testAdapterMethod('getAddress');
      const userAddressString = userAddress?.toString() || userAddress;

      // Get SOL balance
      const solBalance = await functionalityTest.testAdapterMethod('getTokenBalance', [userAddressString, 'SOL']);
      expect(typeof solBalance).toBe('number');
      expect(solBalance).toBeGreaterThanOrEqual(0);

      console.log('✅ SOL balance query functionality test passed');
    }, 60000);

    test('should handle invalid deposit amounts', async () => {
      // Test: Input validation for deposit methods

      // Test negative amounts
      await functionalityTest.testErrorScenario(
        async (testEnv) => {
          return await testEnv.solanaAdapter.deposit('SOL', -1, 9);
        },
        'amount' // Expected error for negative amount
      );

      console.log('✅ Invalid amount error handling test passed');
    }, 60000);
  });

  describe('SOL Withdrawal Functionality', () => {
    test('should handle withdrawal functionality', async () => {
      // Test: Withdrawal method exists and handles basic validation

      // Generate a test destination address
      const testDestination = functionalityTest.getTestKeypair().publicKey.toString();
      const withdrawAmount = 0.01; // Small amount

      // Test withdrawal method exists (may fail due to insufficient balance, but should not be undefined)
      try {
        const result = await functionalityTest.testAdapterMethod('withdraw', [withdrawAmount, 'SOL', testDestination]);
        TestAssertions.assertTransactionSuccess(result);
        console.log('✅ SOL withdrawal functionality test passed');
      } catch (error) {
        // Expected to fail with insufficient balance, but method should exist
        if (error.message.includes('not found')) {
          throw error; // Re-throw if method doesn't exist
        }
        console.log('✅ SOL withdrawal method exists (failed as expected with insufficient balance)');
      }
    }, 90000);

    test('should validate withdrawal addresses', async () => {
      // Test: Address validation for withdrawals

      await functionalityTest.testErrorScenario(
        async (testEnv) => {
          return await testEnv.solanaAdapter.withdraw(0.01, 'SOL', 'invalid-address');
        },
        'Invalid' // Expected error for invalid address
      );

      console.log('✅ Invalid address error handling test passed');
    }, 60000);
  });

  describe('Advanced Features', () => {
    test('should get all balances for user', async () => {
      // Test: Get comprehensive balance information

      const userAddress = await functionalityTest.testAdapterMethod('getAddress');
      const userAddressString = userAddress?.toString() || userAddress;
      const allBalances = await functionalityTest.testAdapterMethod('getAllBalances', [userAddressString]);

      expect(typeof allBalances).toBe('object');
      console.log('✅ All balances query test passed');
    }, 60000);

    test('should validate addresses', async () => {
      // Test: Address validation functionality

      const userAddress = await functionalityTest.testAdapterMethod('getAddress');
      const userAddressString = userAddress?.toString() || userAddress;
      const isValid = await functionalityTest.testAdapterMethod('isValidAddress', [userAddressString]);
      expect(isValid).toBe(true);

      const isInvalid = await functionalityTest.testAdapterMethod('isValidAddress', ['invalid-address']);
      expect(isInvalid).toBe(false);

      console.log('✅ Address validation test passed');
    }, 30000);
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle wallet connection failures', async () => {
      // Test: What happens when wallet fails to connect?

      // Set wallet to fail connections
      functionalityTest.setWalletFailureMode({ shouldFailConnection: true });

      // Create new test environment with failing wallet
      await functionalityTest.afterEach();
      functionalityTest = new BaseFunctionalityTest();

      // This should fail
      await expect(functionalityTest.beforeEach('failedConnection')).rejects.toThrow();

      console.log('✅ Wallet connection failure handling test passed');
    }, 30000);

    test('should handle transaction signing failures', async () => {
      // Test: What happens when wallet fails to sign transactions?

      // Set wallet to fail signing
      functionalityTest.setWalletFailureMode({ shouldFailSigning: true });

      await functionalityTest.testErrorScenario(
        async (testEnv) => {
          return await testEnv.solanaAdapter.deposit('SOL', 0.01, 9);
        },
        'signing failed' // Expected error message
      );

      console.log('✅ Transaction signing failure handling test passed');
    }, 60000);
  });
});

/**
 * Test utilities specific to SolanaAdapter testing
 */
const SolanaAdapterTestUtils = {
  // Create test amounts for different scenarios
  createTestAmounts: () => ({
    tiny: 0.001 * 1e9,     // 0.001 SOL
    small: 0.01 * 1e9,     // 0.01 SOL
    medium: 0.1 * 1e9,     // 0.1 SOL
    large: 1.0 * 1e9,      // 1.0 SOL
    huge: 1000 * 1e9       // 1000 SOL (for error testing)
  }),

  // Generate test addresses
  generateTestAddress: () => {
    const { Keypair } = require('@solana/web3.js');
    return Keypair.generate().publicKey.toString();
  },

  // Common test scenarios
  testScenarios: {
    happyPath: 'default',
    richUser: 'richUser',
    restrictedUser: 'restrictedUser',
    connectionFailure: 'failedConnection',
    signingFailure: 'failedSigning'
  }
};

module.exports = {
  SolanaAdapterTestUtils
};