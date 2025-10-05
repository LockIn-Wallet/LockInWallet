const { EventEmitter } = require('events');
const { PublicKey, Keypair, Transaction, VersionedTransaction } = require('@solana/web3.js');
const { WalletReadyState } = require('@solana/wallet-adapter-base');

/**
 * MockWalletProvider - A mock wallet adapter for testing Solana functionality
 * without requiring browser extensions like Phantom wallet.
 *
 * This provider:
 * - Generates test keypairs programmatically
 * - Provides signing capabilities for transactions
 * - Implements the wallet adapter interface
 * - Supports multiple test user scenarios
 */
class MockWalletProvider extends EventEmitter {
  constructor(options = {}) {
    super();

    // Generate a test keypair or use provided one
    this._keypair = options.keypair || Keypair.generate();
    this._connected = false;
    this._connecting = false;
    this._publicKey = this._keypair.publicKey;
    this._readyState = WalletReadyState.Installed;

    // Test user scenarios
    this.testScenario = options.testScenario || 'default';
    this.shouldFailSigning = options.shouldFailSigning || false;
    this.shouldFailConnection = options.shouldFailConnection || false;

    console.log('🧪 MockWalletProvider initialized:', {
      publicKey: this._publicKey.toString(),
      testScenario: this.testScenario
    });
  }

  // Wallet adapter interface properties
  get name() {
    return 'MockWallet';
  }

  get url() {
    return 'https://test.mock.wallet';
  }

  get icon() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PC9zdmc+';
  }

  get readyState() {
    return this._readyState;
  }

  get publicKey() {
    return this._connected ? this._publicKey : null;
  }

  get connected() {
    return this._connected;
  }

  get connecting() {
    return this._connecting;
  }

  // Connection management
  async connect() {
    if (this._connected) {
      return;
    }

    if (this.shouldFailConnection) {
      throw new Error('MockWallet: Connection failed (test scenario)');
    }

    this._connecting = true;

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100));

    this._connected = true;
    this._connecting = false;

    console.log('🧪 MockWallet connected:', this._publicKey.toString());
    this.emit('connect', this._publicKey);

    return;
  }

  async disconnect() {
    if (!this._connected) {
      return;
    }

    this._connected = false;
    this._connecting = false;

    console.log('🧪 MockWallet disconnected');
    this.emit('disconnect');
  }

  // Transaction signing
  async signTransaction(transaction) {
    if (!this._connected) {
      throw new Error('MockWallet: Not connected');
    }

    if (this.shouldFailSigning) {
      throw new Error('MockWallet: Signing failed (test scenario)');
    }

    console.log('🧪 MockWallet signing transaction:', {
      type: transaction.constructor.name,
      instructions: transaction instanceof Transaction ? transaction.instructions.length : 'versioned',
      feePayer: transaction.feePayer?.toString()
    });

    // Sign the transaction with our test keypair
    if (transaction instanceof Transaction) {
      transaction.sign(this._keypair);
    } else if (transaction instanceof VersionedTransaction) {
      transaction.sign([this._keypair]);
    } else {
      throw new Error('MockWallet: Unsupported transaction type');
    }

    return transaction;
  }

  async signAllTransactions(transactions) {
    if (!this._connected) {
      throw new Error('MockWallet: Not connected');
    }

    if (this.shouldFailSigning) {
      throw new Error('MockWallet: Signing failed (test scenario)');
    }

    console.log('🧪 MockWallet signing multiple transactions:', transactions.length);

    const signedTransactions = [];
    for (const transaction of transactions) {
      const signed = await this.signTransaction(transaction);
      signedTransactions.push(signed);
    }

    return signedTransactions;
  }

  async signMessage(message) {
    if (!this._connected) {
      throw new Error('MockWallet: Not connected');
    }

    if (this.shouldFailSigning) {
      throw new Error('MockWallet: Message signing failed (test scenario)');
    }

    console.log('🧪 MockWallet signing message:', message);

    // For testing purposes, return a mock signature
    const signature = new Uint8Array(64);
    signature.fill(42); // Fill with test data

    return signature;
  }

  // Test utilities
  getKeypair() {
    return this._keypair;
  }

  setTestScenario(scenario) {
    this.testScenario = scenario;
    console.log('🧪 MockWallet test scenario changed to:', scenario);
  }

  setFailureModes(options = {}) {
    this.shouldFailSigning = options.shouldFailSigning || false;
    this.shouldFailConnection = options.shouldFailConnection || false;
    console.log('🧪 MockWallet failure modes updated:', options);
  }

  // Simulate different user scenarios
  static createTestScenarios() {
    return {
      // Default test user with generated keypair
      default: new MockWalletProvider({
        testScenario: 'default'
      }),

      // User with specific test balance scenario
      richUser: new MockWalletProvider({
        testScenario: 'richUser',
        keypair: Keypair.generate()
      }),

      // User with limited permissions
      restrictedUser: new MockWalletProvider({
        testScenario: 'restrictedUser',
        keypair: Keypair.generate()
      }),

      // User that fails to connect
      failedConnection: new MockWalletProvider({
        testScenario: 'failedConnection',
        shouldFailConnection: true
      }),

      // User that fails to sign transactions
      failedSigning: new MockWalletProvider({
        testScenario: 'failedSigning',
        shouldFailSigning: true
      })
    };
  }
}

/**
 * MockWalletAdapter - Wrapper to make MockWalletProvider compatible with
 * Solana wallet adapter patterns used in the frontend
 */
class MockWalletAdapter {
  constructor(walletProvider) {
    this.provider = walletProvider;
  }

  get wallet() {
    return this.provider;
  }

  get publicKey() {
    return this.provider.publicKey;
  }

  get connected() {
    return this.provider.connected;
  }

  get connecting() {
    return this.provider.connecting;
  }

  async connect() {
    return this.provider.connect();
  }

  async disconnect() {
    return this.provider.disconnect();
  }

  async signTransaction(transaction) {
    return this.provider.signTransaction(transaction);
  }

  async signAllTransactions(transactions) {
    return this.provider.signAllTransactions(transactions);
  }

  async signMessage(message) {
    return this.provider.signMessage(message);
  }

  // Event handling
  on(event, listener) {
    this.provider.on(event, listener);
  }

  off(event, listener) {
    this.provider.off(event, listener);
  }
}

/**
 * Test utilities for creating mock wallet contexts
 */
const createMockWalletContext = (scenario = 'default') => {
  const scenarios = MockWalletProvider.createTestScenarios();
  const provider = scenarios[scenario] || scenarios.default;
  const adapter = new MockWalletAdapter(provider);

  return {
    wallet: adapter,
    publicKey: provider.publicKey,
    connected: provider.connected,
    connecting: provider.connecting,
    connect: () => adapter.connect(),
    disconnect: () => adapter.disconnect(),
    signTransaction: (tx) => adapter.signTransaction(tx),
    signAllTransactions: (txs) => adapter.signAllTransactions(txs),
    signMessage: (msg) => adapter.signMessage(msg),
    // Test utilities
    getKeypair: () => provider.getKeypair(),
    setTestScenario: (newScenario) => provider.setTestScenario(newScenario),
    setFailureModes: (options) => provider.setFailureModes(options)
  };
};

module.exports = {
  MockWalletProvider,
  MockWalletAdapter,
  createMockWalletContext
};