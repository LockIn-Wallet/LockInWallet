const { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction } = require('@solana/web3.js');
const { Program, AnchorProvider } = require('@coral-xyz/anchor');
const { SolanaAdapter } = require('../adapters/SolanaAdapter');
const { createMockWalletContext } = require('./MockWalletProvider');

/**
 * TestHelpers - Utility functions for E2E functionality testing
 *
 * This module provides:
 * - Connection setup to local Solana validator
 * - Test environment configuration
 * - Adapter testing utilities
 * - Account state validation helpers
 */

// Test configuration
const TEST_CONFIG = {
  // Local validator endpoint
  RPC_ENDPOINT: 'http://127.0.0.1:8899',

  // Test program IDs (should match deployed programs)
  PROGRAM_IDS: {
    SAVINGS_CORE: 'HNi2JKTNeHvz2ENckdVBW1ncfkJUYppuYeBwNhWjkK7d',
    DEPOSIT_PROXY: '4Tr7zEp7p5YtvXNAK98UnEUUpYP9q87sgKBJjfgfNtr4'
  },

  // Test amounts
  AMOUNTS: {
    SOL_DEPOSIT: 0.1 * LAMPORTS_PER_SOL,  // 0.1 SOL
    SOL_WITHDRAW: 0.05 * LAMPORTS_PER_SOL, // 0.05 SOL
    SPL_DEPOSIT: 1000000,  // 1 token (6 decimals)
    SPL_WITHDRAW: 500000   // 0.5 token (6 decimals)
  },

  // Test timeouts
  TIMEOUTS: {
    CONNECTION: 10000,    // 10 seconds
    TRANSACTION: 30000,   // 30 seconds
    CONFIRMATION: 60000   // 60 seconds
  }
};

/**
 * Creates a connection to the local Solana validator
 */
const createTestConnection = () => {
  console.log('🧪 Creating test connection to:', TEST_CONFIG.RPC_ENDPOINT);
  return new Connection(TEST_CONFIG.RPC_ENDPOINT, 'confirmed');
};

/**
 * Sets up a test environment with mock wallet and Solana adapter
 */
const setupTestEnvironment = async (testScenario = 'default') => {
  console.log('🧪 Setting up test environment:', testScenario);

  // Create mock wallet
  const mockWalletContext = createMockWalletContext(testScenario);
  await mockWalletContext.connect();

  // Get the actual wallet adapter (has live getters)
  const mockWallet = mockWalletContext.wallet;

  // Create connection
  const connection = createTestConnection();

  // Create test provider - use mock wallet directly for provider
  const provider = new AnchorProvider(
    connection,
    mockWalletContext.getKeypair(),
    { commitment: 'confirmed' }
  );

  // Create test network configuration matching production structure
  const testNetworkConfig = {
    network: 'devnet', // Use devnet for testing
    name: "Test Solana Network",
    rpcUrl: TEST_CONFIG.RPC_ENDPOINT,
    programId: "HNi2JKTNeHvz2ENckdVBW1ncfkJUYppuYeBwNhWjkK7d",
    tokens: {
      SOL: {
        address: "native",
        mint: "So11111111111111111111111111111111111111112", // SOL mint address
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        recommended: true,
      },
      USDT: {
        mint: "HQQPp5Vh6WHdfHrcr41VrdTPVPzrvbSsUde4gGFLLpJM",
        symbol: "USDT",
        name: "Test USDT",
        decimals: 6,
        recommended: true,
      },
    },
  };

  // Create Solana adapter with proper configuration (use actual wallet adapter)
  const solanaAdapter = new SolanaAdapter(testNetworkConfig, mockWallet, connection);


  console.log('✅ Test environment ready:', {
    publicKey: mockWallet.publicKey?.toString(),
    connected: mockWallet.connected,
    endpoint: TEST_CONFIG.RPC_ENDPOINT
  });

  return {
    connection,
    provider,
    mockWallet: mockWalletContext, // Return the context for other test utilities
    solanaAdapter,
    testKeypair: mockWalletContext.getKeypair()
  };
};

/**
 * Validates that local validator is running and accessible
 */
const validateTestEnvironment = async () => {
  try {
    const connection = createTestConnection();

    // Check if validator is running
    const version = await connection.getVersion();
    console.log('✅ Solana validator version:', version);

    // Check if test programs are deployed
    for (const [name, programId] of Object.entries(TEST_CONFIG.PROGRAM_IDS)) {
      try {
        const programAccount = await connection.getAccountInfo(new PublicKey(programId));
        if (programAccount) {
          console.log(`✅ Program ${name} deployed at:`, programId);
        } else {
          console.warn(`⚠️  Program ${name} not found at:`, programId);
        }
      } catch (error) {
        console.warn(`⚠️  Could not check program ${name}:`, error.message);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Test environment validation failed:', error.message);
    console.error('💡 Make sure local Solana validator is running:');
    console.error('   cd solana && anchor localnet');
    console.error('   or: npm run solana:localnet');
    return false;
  }
};

/**
 * Funds a test account with SOL for testing
 */
const fundTestAccount = async (connection, publicKey, lamports = LAMPORTS_PER_SOL) => {
  try {
    console.log('🧪 Funding test account:', publicKey.toString(), 'with', lamports / LAMPORTS_PER_SOL, 'SOL');

    // Request airdrop
    const signature = await connection.requestAirdrop(publicKey, lamports);
    await connection.confirmTransaction(signature, 'confirmed');

    // Verify balance
    const balance = await connection.getBalance(publicKey);
    console.log('✅ Account funded. Balance:', balance / LAMPORTS_PER_SOL, 'SOL');

    return balance;
  } catch (error) {
    console.error('❌ Failed to fund test account:', error.message);
    throw error;
  }
};

/**
 * Waits for a transaction to be confirmed
 */
const waitForTransactionConfirmation = async (connection, signature, timeout = TEST_CONFIG.TIMEOUTS.CONFIRMATION) => {
  console.log('🧪 Waiting for transaction confirmation:', signature);

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const status = await connection.getSignatureStatus(signature);
      if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
        console.log('✅ Transaction confirmed:', signature);
        return status.value;
      }
    } catch (error) {
      console.warn('⚠️  Error checking transaction status:', error.message);
    }

    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Transaction confirmation timeout: ${signature}`);
};

/**
 * Validates account state after operations
 */
const validateAccountState = async (solanaAdapter, expectedState) => {
  console.log('🧪 Validating account state...');

  try {
    // Get current balance
    const solBalance = await solanaAdapter.getSOLBalance();

    // Validate SOL balance if expected
    if (expectedState.solBalance !== undefined) {
      const expectedBalance = expectedState.solBalance;
      const tolerance = expectedState.tolerance || 0.001 * LAMPORTS_PER_SOL; // Default 0.001 SOL tolerance

      if (Math.abs(solBalance - expectedBalance) > tolerance) {
        throw new Error(`SOL balance mismatch. Expected: ${expectedBalance}, Actual: ${solBalance}, Tolerance: ${tolerance}`);
      }
      console.log('✅ SOL balance validated:', solBalance / LAMPORTS_PER_SOL, 'SOL');
    }

    // Validate account existence
    if (expectedState.accountShouldExist !== undefined) {
      try {
        await solanaAdapter.ensureAccountExists();
        if (!expectedState.accountShouldExist) {
          throw new Error('Account exists but should not');
        }
        console.log('✅ Account existence validated: exists');
      } catch (error) {
        if (expectedState.accountShouldExist) {
          throw new Error('Account should exist but does not');
        }
        console.log('✅ Account existence validated: does not exist');
      }
    }

    console.log('✅ Account state validation passed');
    return true;
  } catch (error) {
    console.error('❌ Account state validation failed:', error.message);
    throw error;
  }
};

/**
 * Simulates a transaction without executing it
 */
const simulateTransaction = async (connection, transaction) => {
  console.log('🧪 Simulating transaction...');

  try {
    const simulation = await connection.simulateTransaction(transaction);

    if (simulation.value.err) {
      console.error('❌ Simulation failed:', simulation.value.err);
      if (simulation.value.logs) {
        console.error('📋 Simulation logs:', simulation.value.logs);
      }
      throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    console.log('✅ Simulation successful!');
    console.log('📋 Simulation logs:', simulation.value.logs);
    console.log('⛽ Units consumed:', simulation.value.unitsConsumed);

    return simulation.value;
  } catch (error) {
    console.error('❌ Could not simulate transaction:', error.message);
    throw error;
  }
};

/**
 * Clean up test environment
 */
const cleanupTestEnvironment = async (testEnv) => {
  console.log('🧪 Cleaning up test environment...');

  try {
    if (testEnv.mockWallet && testEnv.mockWallet.connected) {
      await testEnv.mockWallet.disconnect();
    }
    console.log('✅ Test environment cleaned up');
  } catch (error) {
    console.warn('⚠️  Cleanup warning:', error.message);
  }
};

/**
 * Test assertion helpers
 */
const TestAssertions = {
  // Assert transaction succeeded
  assertTransactionSuccess: (signature) => {
    if (!signature || typeof signature !== 'string') {
      throw new Error('Invalid transaction signature');
    }
    console.log('✅ Transaction successful:', signature);
  },

  // Assert balance within tolerance
  assertBalanceEquals: (actual, expected, tolerance = 0.001 * LAMPORTS_PER_SOL) => {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`Balance assertion failed. Expected: ${expected}, Actual: ${actual}, Tolerance: ${tolerance}`);
    }
    console.log('✅ Balance assertion passed:', actual / LAMPORTS_PER_SOL, 'SOL');
  },

  // Assert account exists
  assertAccountExists: async (solanaAdapter) => {
    try {
      await solanaAdapter.ensureAccountExists();
      console.log('✅ Account exists assertion passed');
    } catch (error) {
      throw new Error('Account should exist but does not');
    }
  },

  // Assert error contains expected message
  assertErrorMessage: (error, expectedMessage) => {
    if (!error.message.includes(expectedMessage)) {
      throw new Error(`Error message assertion failed. Expected to contain: "${expectedMessage}", Actual: "${error.message}"`);
    }
    console.log('✅ Error message assertion passed:', expectedMessage);
  }
};

module.exports = {
  TEST_CONFIG,
  createTestConnection,
  setupTestEnvironment,
  validateTestEnvironment,
  fundTestAccount,
  waitForTransactionConfirmation,
  validateAccountState,
  simulateTransaction,
  cleanupTestEnvironment,
  TestAssertions
};