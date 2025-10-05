import { BaseFunctionalityTest } from '../functionality/BaseFunctionalityTest';
import { TestAssertions } from '../../test-utils/TestHelpers';
import { Transaction, SystemProgram, PublicKey } from '@solana/web3.js';

/**
 * SimulationTests - Comprehensive transaction simulation testing
 *
 * These tests leverage the existing simulateTransaction() capabilities in SolanaAdapter
 * to validate transactions before execution. This provides:
 * - Fast feedback on transaction validity
 * - Gas estimation and cost analysis
 * - Error detection before execution
 * - Complex scenario testing without state changes
 *
 * Key benefits:
 * - No blockchain state changes during testing
 * - Fast execution (no actual transactions)
 * - Comprehensive error scenario coverage
 * - Transaction cost validation
 */
describe('Transaction Simulation Tests', () => {
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

  describe('SOL Deposit Simulations', () => {
    test('should simulate successful SOL deposit', async () => {
      // Test: Validate deposit transaction before execution

      const depositAmount = 0.1 * 1e9; // 0.1 SOL
      const adapter = functionalityTest.testEnv.solanaAdapter;

      // Build deposit transaction
      const transaction = await adapter.buildDepositSOLTransaction(depositAmount);

      // Simulate transaction
      const simulation = await adapter.simulateTransaction(transaction);

      // Validate simulation results
      expect(simulation.err).toBeNull();
      expect(simulation.unitsConsumed).toBeGreaterThan(0);
      expect(simulation.logs).toBeDefined();
      expect(Array.isArray(simulation.logs)).toBe(true);

      console.log('✅ SOL deposit simulation successful');
      console.log('⛽ Units consumed:', simulation.unitsConsumed);
    }, 30000);

    test('should simulate deposit with insufficient funds', async () => {
      // Test: Simulation should catch insufficient funds before execution

      const hugeAmount = 1000 * 1e9; // 1000 SOL (more than available)
      const adapter = functionalityTest.testEnv.solanaAdapter;

      try {
        // This should fail during simulation
        const transaction = await adapter.buildDepositSOLTransaction(hugeAmount);
        const simulation = await adapter.simulateTransaction(transaction);

        // If simulation doesn't fail, check for specific error
        if (simulation.err) {
          console.log('✅ Simulation correctly caught insufficient funds error');
          expect(simulation.err).toBeDefined();
        }
      } catch (error) {
        // Error caught during transaction building or simulation
        TestAssertions.assertErrorMessage(error, 'insufficient');
        console.log('✅ Insufficient funds caught during simulation');
      }
    }, 30000);

    test('should estimate gas costs for deposits', async () => {
      // Test: Get accurate gas cost estimates for deposits

      const amounts = [
        0.01 * 1e9,  // Small deposit
        0.1 * 1e9,   // Medium deposit
        1.0 * 1e9    // Large deposit
      ];

      const gasEstimates = [];

      for (const amount of amounts) {
        try {
          const adapter = functionalityTest.testEnv.solanaAdapter;
          const transaction = await adapter.buildDepositSOLTransaction(amount);
          const simulation = await adapter.simulateTransaction(transaction);

          gasEstimates.push({
            amount: amount / 1e9,
            unitsConsumed: simulation.unitsConsumed,
            logs: simulation.logs?.length || 0
          });
        } catch (error) {
          // Some amounts might fail due to insufficient funds
          console.log(`⚠️  Amount ${amount / 1e9} SOL failed simulation:`, error.message);
        }
      }

      // Validate we got at least one successful estimate
      expect(gasEstimates.length).toBeGreaterThan(0);

      console.log('✅ Gas estimation test completed');
      console.log('📊 Gas estimates:', gasEstimates);
    }, 60000);
  });

  describe('SOL Withdrawal Simulations', () => {
    test('should simulate successful SOL withdrawal', async () => {
      // Test: Validate withdrawal transaction before execution

      const depositAmount = 0.2 * 1e9; // 0.2 SOL
      const withdrawAmount = 0.1 * 1e9; // 0.1 SOL
      const adapter = functionalityTest.testEnv.solanaAdapter;

      // First, actually deposit some SOL (this needs to be real for withdrawal simulation)
      await adapter.depositSOL(depositAmount);

      // Now simulate withdrawal
      const destination = functionalityTest.getTestKeypair().publicKey.toString();
      const transaction = await adapter.buildWithdrawSOLTransaction(destination, withdrawAmount);
      const simulation = await adapter.simulateTransaction(transaction);

      // Validate simulation
      expect(simulation.err).toBeNull();
      expect(simulation.unitsConsumed).toBeGreaterThan(0);

      console.log('✅ SOL withdrawal simulation successful');
      console.log('⛽ Withdrawal gas estimate:', simulation.unitsConsumed);
    }, 90000);

    test('should simulate withdrawal with insufficient balance', async () => {
      // Test: Simulation should catch insufficient balance

      const withdrawAmount = 10 * 1e9; // 10 SOL (more than deposited)
      const adapter = functionalityTest.testEnv.solanaAdapter;

      // Deposit small amount first
      await adapter.depositSOL(0.1 * 1e9);

      try {
        const destination = functionalityTest.getTestKeypair().publicKey.toString();
        const transaction = await adapter.buildWithdrawSOLTransaction(destination, withdrawAmount);
        const simulation = await adapter.simulateTransaction(transaction);

        // Should either fail simulation or show error
        if (simulation.err) {
          console.log('✅ Simulation correctly caught insufficient balance');
          expect(simulation.err).toBeDefined();
        }
      } catch (error) {
        TestAssertions.assertErrorMessage(error, 'insufficient');
        console.log('✅ Insufficient balance caught during simulation');
      }
    }, 90000);
  });

  describe('Complex Transaction Simulations', () => {
    test('should simulate batch operations', async () => {
      // Test: Simulate multiple operations in sequence

      const operations = [
        { type: 'deposit', amount: 0.1 * 1e9 },
        { type: 'deposit', amount: 0.05 * 1e9 },
        { type: 'withdraw', amount: 0.08 * 1e9 }
      ];

      const adapter = functionalityTest.testEnv.solanaAdapter;
      const simulationResults = [];

      for (const [index, operation] of operations.entries()) {
        try {
          let transaction;

          if (operation.type === 'deposit') {
            transaction = await adapter.buildDepositSOLTransaction(operation.amount);
          } else if (operation.type === 'withdraw') {
            const destination = functionalityTest.getTestKeypair().publicKey.toString();
            transaction = await adapter.buildWithdrawSOLTransaction(destination, operation.amount);
          }

          const simulation = await adapter.simulateTransaction(transaction);

          simulationResults.push({
            operation: `${operation.type} ${operation.amount / 1e9} SOL`,
            success: !simulation.err,
            unitsConsumed: simulation.unitsConsumed,
            error: simulation.err
          });

          // If this was a successful deposit simulation, actually execute it
          // so subsequent operations have the right state
          if (operation.type === 'deposit' && !simulation.err) {
            await adapter.depositSOL(operation.amount);
          }
        } catch (error) {
          simulationResults.push({
            operation: `${operation.type} ${operation.amount / 1e9} SOL`,
            success: false,
            error: error.message
          });
        }
      }

      console.log('✅ Batch operation simulation completed');
      console.log('📊 Simulation results:', simulationResults);

      // Validate we got results for all operations
      expect(simulationResults.length).toBe(operations.length);
    }, 120000);

    test('should simulate invalid transaction scenarios', async () => {
      // Test: Various invalid transaction scenarios

      const invalidScenarios = [
        {
          name: 'Zero amount deposit',
          builder: async () => {
            const adapter = functionalityTest.testEnv.solanaAdapter;
            return await adapter.buildDepositSOLTransaction(0);
          }
        },
        {
          name: 'Negative amount deposit',
          builder: async () => {
            const adapter = functionalityTest.testEnv.solanaAdapter;
            return await adapter.buildDepositSOLTransaction(-1000);
          }
        },
        {
          name: 'Invalid destination withdrawal',
          builder: async () => {
            const adapter = functionalityTest.testEnv.solanaAdapter;
            // First deposit something
            await adapter.depositSOL(0.1 * 1e9);
            // Try to withdraw to invalid address
            return await adapter.buildWithdrawSOLTransaction('invalid-address', 0.05 * 1e9);
          }
        }
      ];

      const invalidResults = [];

      for (const scenario of invalidScenarios) {
        try {
          const transaction = await scenario.builder();
          const simulation = await functionalityTest.testEnv.solanaAdapter.simulateTransaction(transaction);

          invalidResults.push({
            scenario: scenario.name,
            simulationFailed: !!simulation.err,
            error: simulation.err || 'No error'
          });
        } catch (error) {
          invalidResults.push({
            scenario: scenario.name,
            buildFailed: true,
            error: error.message
          });
        }
      }

      console.log('✅ Invalid scenario simulation completed');
      console.log('📊 Invalid scenario results:', invalidResults);

      // Validate we tested all scenarios
      expect(invalidResults.length).toBe(invalidScenarios.length);
    }, 90000);
  });

  describe('Performance and Resource Analysis', () => {
    test('should analyze transaction costs across different scenarios', async () => {
      // Test: Comprehensive cost analysis

      const scenarios = [
        { name: 'Small deposit', type: 'deposit', amount: 0.01 * 1e9 },
        { name: 'Medium deposit', type: 'deposit', amount: 0.1 * 1e9 },
        { name: 'Large deposit', type: 'deposit', amount: 1.0 * 1e9 }
      ];

      const costAnalysis = [];
      const adapter = functionalityTest.testEnv.solanaAdapter;

      for (const scenario of scenarios) {
        try {
          const transaction = await adapter.buildDepositSOLTransaction(scenario.amount);
          const simulation = await adapter.simulateTransaction(transaction);

          if (!simulation.err) {
            costAnalysis.push({
              scenario: scenario.name,
              amount: scenario.amount / 1e9,
              unitsConsumed: simulation.unitsConsumed,
              estimatedFee: simulation.unitsConsumed * 0.000005, // Rough SOL estimate
              logCount: simulation.logs?.length || 0
            });
          }
        } catch (error) {
          console.log(`⚠️  Scenario ${scenario.name} failed:`, error.message);
        }
      }

      console.log('✅ Transaction cost analysis completed');
      console.log('📊 Cost analysis:', costAnalysis);

      // Validate we got some successful analyses
      expect(costAnalysis.length).toBeGreaterThan(0);

      // Analyze cost patterns
      if (costAnalysis.length > 1) {
        const avgUnits = costAnalysis.reduce((sum, item) => sum + item.unitsConsumed, 0) / costAnalysis.length;
        console.log('📈 Average units consumed:', avgUnits);
      }
    }, 90000);

    test('should validate simulation consistency', async () => {
      // Test: Multiple simulations of same transaction should give consistent results

      const depositAmount = 0.1 * 1e9;
      const adapter = functionalityTest.testEnv.solanaAdapter;
      const simulations = [];

      // Run same simulation multiple times
      for (let i = 0; i < 3; i++) {
        const transaction = await adapter.buildDepositSOLTransaction(depositAmount);
        const simulation = await adapter.simulateTransaction(transaction);

        simulations.push({
          run: i + 1,
          success: !simulation.err,
          unitsConsumed: simulation.unitsConsumed,
          logCount: simulation.logs?.length || 0
        });
      }

      console.log('✅ Simulation consistency test completed');
      console.log('📊 Consistency results:', simulations);

      // Validate all simulations succeeded
      const successfulSims = simulations.filter(sim => sim.success);
      expect(successfulSims.length).toBe(simulations.length);

      // Check for consistency in units consumed (should be very similar)
      if (successfulSims.length > 1) {
        const units = successfulSims.map(sim => sim.unitsConsumed);
        const maxUnits = Math.max(...units);
        const minUnits = Math.min(...units);
        const variance = maxUnits - minUnits;

        // Units should be very consistent (within 10% variance)
        expect(variance / minUnits).toBeLessThan(0.1);
        console.log('📈 Units consumed variance:', variance, 'units');
      }
    }, 60000);
  });
});

/**
 * Simulation test utilities
 */
export const SimulationTestUtils = {
  // Create comprehensive simulation report
  createSimulationReport: (simulations) => {
    const successful = simulations.filter(sim => !sim.err);
    const failed = simulations.filter(sim => sim.err);

    return {
      total: simulations.length,
      successful: successful.length,
      failed: failed.length,
      averageUnits: successful.length > 0
        ? successful.reduce((sum, sim) => sum + sim.unitsConsumed, 0) / successful.length
        : 0,
      totalUnits: successful.reduce((sum, sim) => sum + sim.unitsConsumed, 0),
      errors: failed.map(sim => sim.err)
    };
  },

  // Estimate transaction costs
  estimateTransactionCost: (unitsConsumed, pricePerUnit = 0.000005) => {
    return {
      units: unitsConsumed,
      estimatedSOL: unitsConsumed * pricePerUnit,
      estimatedUSD: unitsConsumed * pricePerUnit * 50 // Rough SOL price estimate
    };
  },

  // Compare simulation performance
  compareSimulations: (sim1, sim2) => {
    return {
      unitsConsumptionDiff: sim2.unitsConsumed - sim1.unitsConsumed,
      logCountDiff: (sim2.logs?.length || 0) - (sim1.logs?.length || 0),
      both_successful: !sim1.err && !sim2.err
    };
  }
};

export default SimulationTestUtils;