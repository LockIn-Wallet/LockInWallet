const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);

/**
 * TestSetup - Automated test pipeline orchestration
 *
 * This module provides automated setup and teardown for comprehensive E2E testing:
 * 1. Validates environment prerequisites
 * 2. Starts local Solana validator
 * 3. Deploys Solana programs
 * 4. Runs test suites
 * 5. Cleans up resources
 *
 * Designed for both CI/CD and local development
 */

class TestSetup {
  constructor(options = {}) {
    this.options = {
      // Default configuration
      solanaValidatorPort: 8899,
      validatorTimeout: 30000,
      deployTimeout: 60000,
      testTimeout: 300000, // 5 minutes for full test suite
      cleanupOnExit: true,
      verbose: process.env.NODE_ENV !== 'test',
      ...options
    };

    this.validatorProcess = null;
    this.validatorReady = false;
    this.programsDeployed = false;
  }

  /**
   * Main orchestration method - sets up complete test environment
   */
  async setupTestEnvironment() {
    this.log('🚀 Setting up automated test environment...');

    try {
      // Step 1: Validate prerequisites
      await this.validatePrerequisites();

      // Step 2: Start local Solana validator
      await this.startSolanaValidator();

      // Step 3: Wait for validator to be ready
      await this.waitForValidator();

      // Step 4: Deploy Solana programs
      await this.deployPrograms();

      // Step 5: Validate deployment
      await this.validateDeployment();

      this.log('✅ Test environment setup complete!');
      return {
        validatorRunning: this.validatorReady,
        programsDeployed: this.programsDeployed,
        endpoint: `http://127.0.0.1:${this.options.solanaValidatorPort}`
      };
    } catch (error) {
      this.log('❌ Test environment setup failed:', error.message);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Validates all required tools and dependencies are available
   */
  async validatePrerequisites() {
    this.log('🔍 Validating prerequisites...');

    const requiredCommands = [
      { cmd: 'solana', version: '--version' },
      { cmd: 'anchor', version: '--version' },
      { cmd: 'npm', version: '--version' }
    ];

    for (const { cmd, version } of requiredCommands) {
      try {
        const { stdout } = await execAsync(`${cmd} ${version}`);
        this.log(`✅ ${cmd}: ${stdout.trim().split('\\n')[0]}`);
      } catch (error) {
        throw new Error(`Required command '${cmd}' not found. Please install and configure it.`);
      }
    }

    // Check if we're in the right directory structure
    const solanaDir = path.resolve('../solana');
    if (!fs.existsSync(solanaDir)) {
      throw new Error('Solana directory not found. Run tests from frontend/ directory.');
    }

    this.log('✅ Prerequisites validated');
  }

  /**
   * Starts local Solana validator
   */
  async startSolanaValidator() {
    this.log('🔧 Starting local Solana validator...');

    // Check if validator is already running
    try {
      const { stdout } = await execAsync(`lsof -ti:${this.options.solanaValidatorPort}`);
      if (stdout.trim()) {
        this.log('⚠️  Validator already running on port', this.options.solanaValidatorPort);
        this.validatorReady = true;
        return;
      }
    } catch (error) {
      // Port is free, continue with starting validator
    }

    return new Promise((resolve, reject) => {
      // Use anchor localnet to start validator with proper configuration
      this.validatorProcess = spawn('anchor', ['localnet'], {
        cwd: path.resolve('../solana'),
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        detached: false
      });

      this.validatorProcess.on('error', (error) => {
        this.log('❌ Failed to start validator:', error.message);
        reject(error);
      });

      // Give validator time to start
      setTimeout(() => {
        if (this.validatorProcess && !this.validatorProcess.killed) {
          this.log('✅ Validator process started');
          resolve();
        } else {
          reject(new Error('Validator process failed to start'));
        }
      }, 5000);

      // Set up cleanup on process exit
      if (this.options.cleanupOnExit) {
        process.on('exit', () => this.cleanup());
        process.on('SIGINT', () => this.cleanup());
        process.on('SIGTERM', () => this.cleanup());
      }
    });
  }

  /**
   * Waits for validator to be ready to accept connections
   */
  async waitForValidator() {
    this.log('⏳ Waiting for validator to be ready...');

    const startTime = Date.now();
    const timeout = this.options.validatorTimeout;

    while (Date.now() - startTime < timeout) {
      try {
        // Test validator connectivity
        const { stdout } = await execAsync('solana cluster-version');
        if (stdout.includes('1.') || stdout.includes('2.')) {
          this.validatorReady = true;
          this.log('✅ Validator is ready');
          return;
        }
      } catch (error) {
        // Validator not ready yet, continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Validator failed to start within ${timeout}ms`);
  }

  /**
   * Deploys Solana programs using the reliable deployment script
   */
  async deployPrograms() {
    this.log('📦 Deploying Solana programs...');

    try {
      // Use the reliable deployment script
      const { stdout, stderr } = await execAsync('npm run deploy-reliable', {
        cwd: path.resolve('../solana'),
        timeout: this.options.deployTimeout
      });

      if (this.options.verbose) {
        this.log('📋 Deployment output:', stdout);
      }

      if (stderr && !stderr.includes('warning')) {
        this.log('⚠️  Deployment warnings:', stderr);
      }

      this.programsDeployed = true;
      this.log('✅ Programs deployed successfully');
    } catch (error) {
      throw new Error(`Program deployment failed: ${error.message}`);
    }
  }

  /**
   * Validates that programs were deployed correctly
   */
  async validateDeployment() {
    this.log('🔍 Validating program deployment...');

    const programIds = [
      'HNi2JKTNeHvz2ENckdVBW1ncfkJUYppuYeBwNhWjkK7d'  // savings_core (includes proxy functionality)
    ];

    for (const programId of programIds) {
      try {
        const { stdout } = await execAsync(`solana account ${programId}`);
        if (stdout.includes('Account')) {
          this.log(`✅ Program ${programId} deployed`);
        }
      } catch (error) {
        this.log(`⚠️  Could not validate program ${programId}:`, error.message);
      }
    }

    this.log('✅ Deployment validation complete');
  }

  /**
   * Runs the complete test suite
   */
  async runTests(testPattern = '') {
    this.log('🧪 Running test suite...');

    try {
      const testCommand = testPattern
        ? `npm test -- --testPathPattern="${testPattern}"`
        : 'npm test -- --watchAll=false';

      const { stdout, stderr } = await execAsync(testCommand, {
        cwd: path.resolve('.'),
        timeout: this.options.testTimeout,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          CI: 'true' // Prevents interactive mode
        }
      });

      this.log('✅ Test suite completed');

      if (this.options.verbose) {
        this.log('📋 Test output:', stdout);
      }

      return {
        success: true,
        output: stdout,
        errors: stderr
      };
    } catch (error) {
      this.log('❌ Test suite failed:', error.message);
      return {
        success: false,
        output: error.stdout || '',
        errors: error.stderr || error.message
      };
    }
  }

  /**
   * Complete automated test pipeline
   */
  async runCompletePipeline(testPattern = '') {
    const startTime = Date.now();
    this.log('🚀 Starting complete automated test pipeline...');

    try {
      // Setup environment
      await this.setupTestEnvironment();

      // Run tests
      const testResults = await this.runTests(testPattern);

      // Report results
      const duration = Date.now() - startTime;
      this.log(`📊 Pipeline completed in ${duration}ms`);

      if (testResults.success) {
        this.log('✅ All tests passed!');
      } else {
        this.log('❌ Some tests failed');
        if (testResults.errors) {
          this.log('📋 Test errors:', testResults.errors);
        }
      }

      return {
        success: testResults.success,
        duration,
        testResults
      };
    } catch (error) {
      this.log('❌ Pipeline failed:', error.message);
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    } finally {
      // Always cleanup
      await this.cleanup();
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.log('🧹 Cleaning up test environment...');

    try {
      // Kill validator process
      if (this.validatorProcess && !this.validatorProcess.killed) {
        this.validatorProcess.kill('SIGTERM');
        this.log('✅ Validator process terminated');
      }

      // Give processes time to cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Force kill any remaining processes on validator port
      try {
        await execAsync(`lsof -ti:${this.options.solanaValidatorPort} | xargs kill -9`);
      } catch (error) {
        // Process might not exist, that's okay
      }

      this.log('✅ Cleanup completed');
    } catch (error) {
      this.log('⚠️  Cleanup warning:', error.message);
    }
  }

  /**
   * Utility logging method
   */
  log(...args) {
    if (this.options.verbose) {
      console.log('[TestSetup]', ...args);
    }
  }
}

/**
 * Quick setup functions for different use cases
 */
const QuickSetup = {
  // For local development
  async setupForDevelopment() {
    const setup = new TestSetup({ verbose: true, cleanupOnExit: true });
    return await setup.setupTestEnvironment();
  },

  // For CI/CD
  async setupForCI() {
    const setup = new TestSetup({ verbose: false, cleanupOnExit: true });
    return await setup.runCompletePipeline();
  },

  // For specific test patterns
  async runSpecificTests(pattern) {
    const setup = new TestSetup({ verbose: true });
    return await setup.runCompletePipeline(pattern);
  },

  // Just run tests (assumes environment is already set up)
  async runTestsOnly(pattern = '') {
    const setup = new TestSetup({ verbose: true });
    return await setup.runTests(pattern);
  }
};

module.exports = {
  TestSetup,
  QuickSetup
};