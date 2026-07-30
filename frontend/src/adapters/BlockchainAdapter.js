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

  async getReferralCount(userAddress) {
    return 0;
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

  // ---- User-facing errors ----
  //
  // Raw chain failures are unreadable: EVM hands back a page-long ethers blob
  // wrapped around a require() string, Solana hands back "custom program error:
  // 0x1771". Nothing below the adapter should ever reach the UI untranslated.

  /**
   * Build an error whose message is written for the user. The flag stops any
   * outer handler from re-wrapping it as if it were a raw chain failure.
   */
  _userError(message, cause) {
    const error = new Error(message);
    error.isUserFacing = true;
    if (cause) error.cause = cause;
    return error;
  }

  /**
   * Turn any failure into something worth showing. Shared handling lives here;
   * the chain-specific lookup is _chainErrorMessage() in the subclass.
   */
  _translateError(error, fallback = 'Transaction failed') {
    if (error?.isUserFacing) return error;

    if (this._isUserRejection(error)) {
      return this._userError('Transaction cancelled in your wallet', error);
    }

    const known = this._chainErrorMessage(error);
    if (known) return this._userError(known, error);

    // Nothing matched — keep the fallback readable rather than dumping the
    // full provider payload the user can't act on anyway.
    const detail = error?.shortMessage || error?.reason || error?.message || String(error);
    return this._userError(`${fallback}: ${detail}`, error);
  }

  _isUserRejection(error) {
    const message = (error?.message || '').toLowerCase();
    return (
      error?.code === 4001 ||
      error?.code === 'ACTION_REJECTED' ||
      message.includes('user rejected') ||
      message.includes('user denied') ||
      message.includes('rejected the request')
    );
  }

  /** Subclass hook: map a chain failure to a plain sentence, or null. */
  _chainErrorMessage(error) {
    return null;
  }

  /**
   * Wrap the adapter's write methods so every failure leaves the adapter
   * already translated. Subclasses call this once from their constructor with
   * `{ methodName: fallbackMessage }` — a table beats a try/catch in each of
   * the forty-odd write paths, and can't be forgotten when one is added.
   */
  _installErrorTranslation(fallbacks) {
    for (const [method, fallback] of Object.entries(fallbacks)) {
      const original = this[method];
      if (typeof original !== 'function') continue;

      this[method] = async (...args) => {
        try {
          return await original.apply(this, args);
        } catch (error) {
          throw this._translateError(error, fallback);
        }
      };
    }
  }

  /**
   * Withdrawals revert on-chain with a bare "Invalid amount" whenever the amount
   * is zero or exceeds the saved balance, which tells the user nothing — check
   * first and name the actual shortfall.
   */
  _assertSufficientBalance(rawAmount, rawBalance, symbol, decimals, location = 'your savings wallet') {
    const amount = BigInt(rawAmount);
    if (amount <= 0n) throw this._userError('Enter an amount greater than zero');

    const available = BigInt(rawBalance);
    if (amount <= available) return;

    const readable = parseFloat((Number(available) / 10 ** decimals).toFixed(decimals));
    throw this._userError(
      `Not enough ${symbol} in ${location} — you have ${readable} ${symbol} available`
    );
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