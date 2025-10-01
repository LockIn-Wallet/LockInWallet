import { EVMAdapter } from './EVMAdapter.js';
import { SolanaAdapter } from './SolanaAdapter.js';

/**
 * TransactionManager - Routes blockchain operations based on network type
 * Provides a unified interface for multi-blockchain operations
 */
export class TransactionManager {
  constructor() {
    this.currentAdapter = null;
    this.networkType = null;
    this.adapters = new Map();
  }

  /**
   * Initialize the transaction manager with network configuration
   */
  async initialize(networkType, networkConfig, walletConfig = {}) {
    this.networkType = networkType;

    try {
      if (networkType === 'evm') {
        const adapter = new EVMAdapter(networkConfig);
        this.adapters.set('evm', adapter);
        this.currentAdapter = adapter;
      } else if (networkType === 'solana') {
        const { wallet, connection } = walletConfig;
        if (!wallet || !connection) {
          throw new Error('Solana adapter requires wallet and connection');
        }
        const adapter = new SolanaAdapter(networkConfig, wallet, connection);
        this.adapters.set('solana', adapter);
        this.currentAdapter = adapter;
      } else {
        throw new Error(`Unsupported network type: ${networkType}`);
      }

      console.log(`TransactionManager initialized for ${networkType}`);
      return this.currentAdapter;
    } catch (error) {
      console.error('Error initializing TransactionManager:', error);
      throw error;
    }
  }

  /**
   * Switch between different blockchain networks
   */
  async switchNetwork(networkType, networkConfig, walletConfig = {}) {
    if (this.networkType === networkType && this.currentAdapter) {
      // Same network type, just switch network within adapter
      await this.currentAdapter.switchNetwork(networkConfig);
      return this.currentAdapter;
    }

    // Different network type, reinitialize
    return await this.initialize(networkType, networkConfig, walletConfig);
  }

  /**
   * Get the current active adapter
   */
  getCurrentAdapter() {
    if (!this.currentAdapter) {
      throw new Error('TransactionManager not initialized. Call initialize() first.');
    }
    return this.currentAdapter;
  }

  /**
   * Check if a specific network type is supported
   */
  isNetworkSupported(networkType) {
    return ['evm', 'solana'].includes(networkType);
  }

  // Wallet Management Methods
  async isConnected() {
    return await this.getCurrentAdapter().isConnected();
  }

  async connect() {
    return await this.getCurrentAdapter().connect();
  }

  async disconnect() {
    return await this.getCurrentAdapter().disconnect();
  }

  async getAddress() {
    return await this.getCurrentAdapter().getAddress();
  }

  // Balance Management Methods
  async getTokenBalance(userAddress, tokenAddress) {
    return await this.getCurrentAdapter().getTokenBalance(userAddress, tokenAddress);
  }

  async getAllBalances(userAddress) {
    return await this.getCurrentAdapter().getAllBalances(userAddress);
  }

  // Transaction Methods
  async deposit(tokenAddress, amount, tokenDecimals) {
    try {
      const adapter = this.getCurrentAdapter();

      // Validate inputs
      if (!tokenAddress || !amount || !tokenDecimals) {
        throw new Error('Missing required parameters for deposit');
      }

      // Check if wallet is connected
      if (!(await adapter.isConnected())) {
        throw new Error('Wallet not connected');
      }

      // Check if on correct network
      if (!(await adapter.isCorrectNetwork())) {
        throw new Error('Please switch to the correct network');
      }

      // Validate amount
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Invalid deposit amount');
      }

      // Validate address
      if (!adapter.isValidAddress(tokenAddress)) {
        throw new Error('Invalid token address');
      }

      console.log(`Executing ${this.networkType} deposit:`, {
        tokenAddress,
        amount,
        tokenDecimals
      });

      // Execute deposit
      const result = await adapter.deposit(tokenAddress, amount, tokenDecimals);

      console.log(`${this.networkType} deposit successful:`, result);
      return result;

    } catch (error) {
      console.error(`${this.networkType} deposit error:`, error);
      throw error;
    }
  }

  async withdraw(amount, tokenAddress, destination = null) {
    try {
      const adapter = this.getCurrentAdapter();

      // Similar validation as deposit
      if (!tokenAddress || !amount) {
        throw new Error('Missing required parameters for withdrawal');
      }

      if (!(await adapter.isConnected())) {
        throw new Error('Wallet not connected');
      }

      const result = await adapter.withdraw(amount, tokenAddress, destination);
      console.log(`${this.networkType} withdrawal successful:`, result);
      return result;

    } catch (error) {
      console.error(`${this.networkType} withdrawal error:`, error);
      throw error;
    }
  }

  // Proxy Management Methods
  async isProxyDeployed(userAddress) {
    return await this.getCurrentAdapter().isProxyDeployed(userAddress);
  }

  async getDepositAddress(userAddress) {
    return await this.getCurrentAdapter().getDepositAddress(userAddress);
  }

  async deployProxy() {
    try {
      const adapter = this.getCurrentAdapter();

      if (!(await adapter.isConnected())) {
        throw new Error('Wallet not connected');
      }

      const result = await adapter.deployProxy();
      console.log(`${this.networkType} proxy deployment successful:`, result);
      return result;

    } catch (error) {
      console.error(`${this.networkType} proxy deployment error:`, error);
      throw error;
    }
  }

  // Spending Limits Methods
  async getSpendingLimits(userAddress) {
    return await this.getCurrentAdapter().getSpendingLimits(userAddress);
  }

  async setSpendingLimits(daily, weekly, monthly) {
    try {
      const adapter = this.getCurrentAdapter();

      if (!(await adapter.isConnected())) {
        throw new Error('Wallet not connected');
      }

      const result = await adapter.setSpendingLimits(daily, weekly, monthly);
      console.log(`${this.networkType} spending limits updated:`, result);
      return result;

    } catch (error) {
      console.error(`${this.networkType} spending limits error:`, error);
      throw error;
    }
  }

  // Utility Methods
  formatAmount(amount, decimals) {
    return this.getCurrentAdapter().formatAmount(amount, decimals);
  }

  parseAmount(amount, decimals) {
    return this.getCurrentAdapter().parseAmount(amount, decimals);
  }

  isValidAddress(address) {
    return this.getCurrentAdapter().isValidAddress(address);
  }

  async isCorrectNetwork() {
    return await this.getCurrentAdapter().isCorrectNetwork();
  }

  getNetworkInfo() {
    return this.getCurrentAdapter().getNetworkInfo();
  }

  getNetworkType() {
    return this.networkType;
  }

  // Error Handling Helper
  _formatError(error, operation) {
    const networkPrefix = this.networkType ? `[${this.networkType.toUpperCase()}]` : '[UNKNOWN]';
    return new Error(`${networkPrefix} ${operation} failed: ${error.message}`);
  }

  // Debug Methods
  getAdapterInfo() {
    return {
      networkType: this.networkType,
      hasAdapter: !!this.currentAdapter,
      supportedNetworks: Array.from(this.adapters.keys()),
      adapterType: this.currentAdapter?.constructor.name
    };
  }

  // Backward Compatibility Methods
  // These provide compatibility with existing code that expects specific objects

  getSigner() {
    if (this.networkType === 'evm') {
      return this.currentAdapter.getSigner();
    }
    return null; // Solana doesn't have signers in the same way
  }

  getContract() {
    if (this.networkType === 'evm') {
      return this.currentAdapter.getContract();
    }
    return null;
  }

  getProgram() {
    if (this.networkType === 'solana') {
      return this.currentAdapter.getProgram();
    }
    return null;
  }

  getWallet() {
    if (this.networkType === 'solana') {
      return this.currentAdapter.getWallet();
    }
    return null;
  }
}