/**
 * Base BlockchainAdapter interface
 * Defines the common interface that all blockchain adapters must implement
 */
export class BlockchainAdapter {
  constructor(networkConfig) {
    this.networkConfig = networkConfig;
  }

  // Wallet Management
  async isConnected() {
    throw new Error('isConnected must be implemented by subclass');
  }

  async connect() {
    throw new Error('connect must be implemented by subclass');
  }

  async disconnect() {
    throw new Error('disconnect must be implemented by subclass');
  }

  async getAddress() {
    throw new Error('getAddress must be implemented by subclass');
  }

  async switchNetwork(networkConfig) {
    throw new Error('switchNetwork must be implemented by subclass');
  }

  // Balance Management
  async getTokenBalance(userAddress, tokenAddress) {
    throw new Error('getTokenBalance must be implemented by subclass');
  }

  async getAllBalances(userAddress) {
    throw new Error('getAllBalances must be implemented by subclass');
  }

  // Deposit Operations
  async deposit(tokenAddress, amount, tokenDecimals) {
    throw new Error('deposit must be implemented by subclass');
  }

  async approveToken(tokenAddress, spenderAddress, amount) {
    throw new Error('approveToken must be implemented by subclass');
  }

  // Withdrawal Operations
  async withdraw(amount, tokenAddress, destination = null) {
    throw new Error('withdraw must be implemented by subclass');
  }

  // Proxy Management
  async isProxyDeployed(userAddress) {
    throw new Error('isProxyDeployed must be implemented by subclass');
  }

  async getDepositAddress(userAddress) {
    throw new Error('getDepositAddress must be implemented by subclass');
  }

  async deployProxy() {
    throw new Error('deployProxy must be implemented by subclass');
  }

  // Spending Limits
  async getSpendingLimits(userAddress) {
    throw new Error('getSpendingLimits must be implemented by subclass');
  }

  async setSpendingLimits(daily, weekly, monthly) {
    throw new Error('setSpendingLimits must be implemented by subclass');
  }

  // Governance — default for chains without an on-chain upgrade timelock,
  // so components never need network conditionals
  async getGovernanceStatus() {
    return { enabled: false, operations: [] };
  }

  // Referrals — default no-op implementation for chains that don't support
  // referral recording yet, so components never need network conditionals
  async getReferralInfo(userAddress) {
    return null;
  }

  async getReferredUsers(userAddress) {
    return { count: 0, users: [] };
  }

  // Recovery protection — default for chains without the recovery module,
  // so components never need network conditionals
  async getRecoveryStatus(userAddress) {
    return { supported: false };
  }

  async setRecoveryAddress(recoveryAddress) {
    throw new Error("Recovery protection is not available on this network yet");
  }

  async acceptRecoveryRole(targetAddress) {
    throw new Error("Recovery protection is not available on this network yet");
  }

  async cancelRecoveryKeyProposal() {
    throw new Error("Recovery protection is not available on this network yet");
  }

  async freezeAccount(targetAddress) {
    throw new Error("Recovery protection is not available on this network yet");
  }

  async unfreezeAccount(targetAddress) {
    throw new Error("Recovery protection is not available on this network yet");
  }

  async requestRecoveryKeyChange(newRecoveryAddress) {
    throw new Error("Recovery protection is not available on this network yet");
  }

  async executeRecoveryKeyChange() {
    throw new Error("Recovery protection is not available on this network yet");
  }

  async cancelRecoveryKeyChange(targetAddress) {
    throw new Error("Recovery protection is not available on this network yet");
  }

  async recoverAccount(targetAddress, newOwnerAddress) {
    throw new Error("Recovery protection is not available on this network yet");
  }

  // Utility Methods
  formatAmount(amount, decimals) {
    throw new Error('formatAmount must be implemented by subclass');
  }

  parseAmount(amount, decimals) {
    throw new Error('parseAmount must be implemented by subclass');
  }

  isValidAddress(address) {
    throw new Error('isValidAddress must be implemented by subclass');
  }

  // Network Validation
  async isCorrectNetwork() {
    throw new Error('isCorrectNetwork must be implemented by subclass');
  }

  getNetworkInfo() {
    return this.networkConfig;
  }
}