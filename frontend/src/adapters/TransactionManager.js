import { EVMAdapter } from "./EVMAdapter.js";
import { SolanaAdapter } from "./SolanaAdapter.js";
import { getTokenMeta } from "../utils/tokenUtils.js";
import { clearPendingReferrer } from "../services/referral.service.js";

const PERSONAL_VAULT_KEY = "personal_vault_address";
const ACTIVE_VAULT_KEY = "active_vault_address";

export class TransactionManager {
  constructor() {
    this.adapter = null;
    this.networkType = null;
    this.networkConfig = null;
    this.personalVaultAddress = null;
    // The vault the main wallet UI currently operates on.
    // null = the default: the personal vault (Solana) or legacy account (EVM).
    this.activeVaultAddress = null;
  }

  async initialize(networkType, networkConfig, walletConfig = {}) {
    this.networkType = networkType;
    this.networkConfig = networkConfig;

    if (networkType === "evm") {
      this.adapter = new EVMAdapter(networkConfig);
      await this.adapter.connect(walletConfig);
    } else if (networkType === "solana") {
      const { wallet, connection } = walletConfig;
      if (!wallet || !connection) {
        throw new Error("Solana wallet and connection required");
      }
      this.adapter = new SolanaAdapter(networkConfig, wallet, connection);
      if (wallet.connected) {
        this.adapter.userAddress = wallet.publicKey.toString();
      }
      await this._loadPersonalVault();
    } else {
      throw new Error(`Unsupported network type: ${networkType}`);
    }

    await this._restoreActiveVault();
    return this;
  }

  // ---- Active vault selection ----

  _walletKey() {
    return this.getAdapter().userAddress || null;
  }

  async _restoreActiveVault() {
    const walletAddr = this._walletKey();
    if (!walletAddr) return;
    const stored = localStorage.getItem(`${ACTIVE_VAULT_KEY}_${walletAddr}`);
    if (!stored) return;

    // A stored selection can outlive the chain it was made on (e.g. a local
    // chain reset) — a stale vault would silently swallow every vault-scoped
    // read, so validate it and fall back to the default account if it's gone
    const info = await this.getAdapter().getVaultInfo(stored).catch(() => null);
    if (info) {
      this.activeVaultAddress = stored;
    } else {
      localStorage.removeItem(`${ACTIVE_VAULT_KEY}_${walletAddr}`);
      this.activeVaultAddress = null;
    }
  }

  /** Select which vault the main wallet UI operates on (null = personal). */
  setActiveVault(vaultAddress) {
    this.activeVaultAddress = vaultAddress || null;
    const walletAddr = this._walletKey();
    if (!walletAddr) return;
    const key = `${ACTIVE_VAULT_KEY}_${walletAddr}`;
    if (vaultAddress) localStorage.setItem(key, vaultAddress);
    else localStorage.removeItem(key);
  }

  getActiveVaultAddress() {
    return this.activeVaultAddress || this.personalVaultAddress;
  }

  /** True when the user explicitly selected a vault (not the default account). */
  isVaultSelected() {
    return !!this.activeVaultAddress;
  }

  _usesLegacyAccount() {
    // EVM's initial setup lives in the legacy savings account; only an
    // explicitly selected vault routes through the vault module
    return this.networkType === "evm" && !this.activeVaultAddress;
  }

  _requireActiveVault() {
    const address = this.getActiveVaultAddress();
    if (!address) throw new Error("No vault selected. Complete setup first.");
    return address;
  }

  /** Feature support of the currently selected vault. */
  getActiveVaultCapabilities() {
    // The EVM vault module has no timelocked rule proposals, bypass requests
    // or destination whitelists yet — rule changes apply immediately there
    const full = this.networkType !== "evm" || !this.activeVaultAddress;
    return { proposals: full, bypass: full, destinations: full };
  }

  _requireCapability(name) {
    if (!this.getActiveVaultCapabilities()[name]) {
      throw new Error("This feature is not available for this vault yet");
    }
  }

  getNetworkType() { return this.networkType; }

  getAdapter() {
    if (!this.adapter) throw new Error("TransactionManager not initialized");
    return this.adapter;
  }

  // ---- Personal vault management ----

  _getTokenDecimals(vault) {
    if (vault?.tokenDecimals != null) return vault.tokenDecimals;
    return getTokenMeta(this.networkConfig, vault?.isSolVault ? null : vault?.tokenMint).decimals;
  }

  _getTokenSymbol(vault) {
    if (vault?.tokenSymbol) return vault.tokenSymbol;
    return getTokenMeta(this.networkConfig, vault?.isSolVault ? null : vault?.tokenMint).symbol;
  }

  async _loadPersonalVault() {
    const walletAddr = this.getAddress();
    if (!walletAddr) return;

    const stored = localStorage.getItem(`${PERSONAL_VAULT_KEY}_${walletAddr}`);
    if (stored) {
      const info = await this.getAdapter().getVaultInfo(stored).catch(() => null);
      if (info && info.vaultType === "Personal" && info.creator === walletAddr) {
        this.personalVaultAddress = stored;
        return;
      }
      localStorage.removeItem(`${PERSONAL_VAULT_KEY}_${walletAddr}`);
    }

    const userVaults = await this.getAdapter().getUserVaults().catch(() => []);
    const personal = userVaults.find(
      (v) => v.vault.vaultType === "Personal" && v.vault.creator === walletAddr
    );
    if (personal) {
      this.personalVaultAddress = personal.vault.address;
      localStorage.setItem(`${PERSONAL_VAULT_KEY}_${walletAddr}`, personal.vault.address);
    }
  }

  getPersonalVaultAddress() {
    return this.personalVaultAddress;
  }

  isSetupCommitted() {
    if (this.networkType === "evm") return null;
    return !!this.personalVaultAddress;
  }

  supportsReferrals() {
    // Referral recording lives in the EVM ReferralModule; Solana parity later
    return this.networkType === "evm";
  }

  supportsPercentSetupLimits() {
    // Solana setup creates a personal vault, which supports percent-of-balance
    // limits; EVM setup still uses the legacy TimePeriodLimits module, which
    // only knows fixed amounts
    return this.networkType === "solana";
  }

  async getActiveVault() {
    const address = this.getActiveVaultAddress();
    if (!address) return null;
    return this.getAdapter().getVaultInfo(address);
  }

  async getActiveMembership() {
    const address = this.getActiveVaultAddress();
    if (!address) return null;
    return this.getAdapter().getVaultMemberInfo(address);
  }

  // ---- Compatibility layer (old UI flow) ----

  async commitSetup(daily, weekly, monthly, limitsArePercentage = false, tokenMint = null, referrer = null) {
    if (this.networkType === "evm") {
      const hash = await this.getAdapter().commitSetup(daily, weekly, monthly, referrer);
      clearPendingReferrer();
      return hash;
    }

    if (limitsArePercentage && (daily > 100 || weekly > 100 || monthly > 100)) {
      throw new Error("Percentage values must be between 0 and 100");
    }

    // Adapters accept business units (percent or token amounts) directly
    const result = await this.getAdapter().createVault({
      name: "Savings",
      description: "My personal savings vault",
      vaultType: "Personal",
      tokenMint,
      dailyLimit: daily,
      weeklyLimit: weekly,
      monthlyLimit: monthly,
      penaltyRateBps: 2000,
      limitsArePercentage,
    });

    this.personalVaultAddress = result.vaultAddress;
    const walletAddr = this.getAddress();
    if (walletAddr) {
      localStorage.setItem(`${PERSONAL_VAULT_KEY}_${walletAddr}`, result.vaultAddress);
    }
    // Referral recording isn't supported on this chain yet, but the signup is
    // complete, so the captured referrer is no longer pending
    clearPendingReferrer();
    return result.signature;
  }

  // ---- Governance ----
  getGovernanceStatus() {
    return this.getAdapter().getGovernanceStatus();
  }

  // ---- Referrals ----
  getReferralInfo(userAddress) {
    return this.getAdapter().getReferralInfo(userAddress);
  }
  getReferredUsers(userAddress) {
    return this.getAdapter().getReferredUsers(userAddress);
  }

  // ---- Recovery protection ----
  supportsRecovery() {
    // The recovery module lives on EVM; Solana parity later
    return this.networkType === "evm";
  }
  getRecoveryStatus(userAddress) {
    return this.getAdapter().getRecoveryStatus(userAddress);
  }
  setRecoveryAddress(recoveryAddress) {
    return this.getAdapter().setRecoveryAddress(recoveryAddress);
  }
  freezeAccount(targetAddress) {
    return this.getAdapter().freezeAccount(targetAddress);
  }
  unfreezeAccount(targetAddress) {
    return this.getAdapter().unfreezeAccount(targetAddress);
  }
  requestRecoveryKeyChange(newRecoveryAddress) {
    return this.getAdapter().requestRecoveryKeyChange(newRecoveryAddress);
  }
  executeRecoveryKeyChange() {
    return this.getAdapter().executeRecoveryKeyChange();
  }
  cancelRecoveryKeyChange(targetAddress) {
    return this.getAdapter().cancelRecoveryKeyChange(targetAddress);
  }
  recoverAccount(targetAddress, newOwnerAddress) {
    return this.getAdapter().recoverAccount(targetAddress, newOwnerAddress);
  }

  async getAllBalances(userAddress) {
    if (this._usesLegacyAccount()) {
      return this.getAdapter().getAllBalances(userAddress);
    }

    // Credit anything sitting on the vault's permanent deposit address first
    if (this.networkType === "evm") {
      await this.getAdapter().checkAndSweepVaultProxy?.(this.getActiveVaultAddress());
    }

    const vault = await this.getActiveVault();
    const membership = await this.getActiveMembership();
    if (!vault || !membership) return {};

    const decimals = this._getTokenDecimals(vault);
    const symbol = this._getTokenSymbol(vault);
    const value = this._formatTokenAmount(membership.balance, decimals);
    return { [symbol]: value };
  }

  _formatTokenAmount(raw, decimals) {
    const factor = 10 ** decimals;
    const num = raw / factor;
    const displayDecimals = decimals <= 6 ? 2 : 4;
    const formatted = num.toFixed(displayDecimals);
    return parseFloat(formatted).toString();
  }

  async depositToActiveVault(amount) {
    return this.getAdapter().depositToVault(this._requireActiveVault(), amount);
  }

  async withdrawFromActiveVault(amount) {
    return this.getAdapter().withdrawFromVault(this._requireActiveVault(), amount);
  }

  async penaltyWithdrawFromActiveVault(amount) {
    return this.getAdapter().withdrawFromVaultWithPenalty(this._requireActiveVault(), amount);
  }

  async updateActiveVaultRules(rules) {
    return this.getAdapter().updateVaultRules(this._requireActiveVault(), rules);
  }

  // ---- Old service compatibility layer ----

  getCurrentAdapter() { return this.getAdapter(); }

  async getSpendingLimits(userAddress) {
    if (this._usesLegacyAccount()) {
      return this.getAdapter().getSpendingLimits(userAddress);
    }

    const vault = await this.getActiveVault();
    const membership = await this.getActiveMembership();
    if (!vault || !membership) {
      // On EVM a vault is only selectable after setup, so report committed
      const committed = this.networkType === "evm" ? true : !!this.personalVaultAddress;
      return { limits: [], isSetupCommitted: committed };
    }

    const decimals = this._getTokenDecimals(vault);
    const factor = 10 ** decimals;
    const balance = membership.balance / factor;
    const isPercentage = vault.limitsArePercentage;
    const limits = [];

    const periods = [
      { name: "Daily", limitRaw: vault.dailyLimit, spent: membership.dailySpent, lastReset: membership.dailyLastReset, duration: 86400 },
      { name: "Weekly", limitRaw: vault.weeklyLimit, spent: membership.weeklySpent, lastReset: membership.weeklyLastReset, duration: 604800 },
      { name: "Monthly", limitRaw: vault.monthlyLimit, spent: membership.monthlySpent, lastReset: membership.monthlyLastReset, duration: 2592000 },
    ];

    for (const p of periods) {
      let limitAmt;
      if (isPercentage) {
        limitAmt = balance * p.limitRaw / 10000;
      } else {
        limitAmt = p.limitRaw / factor;
      }
      // On-chain spent counters stay stale until the next transaction, so an
      // elapsed window counts as already reset for display purposes.
      const resetAt = (p.lastReset + p.duration) * 1000;
      const windowElapsed = Date.now() >= resetAt;
      const spent = windowElapsed ? 0 : p.spent / factor;
      limits.push({
        name: p.name,
        limit: limitAmt.toString(),
        spent: spent.toString(),
        remaining: Math.max(0, limitAmt - spent),
        resetAt: windowElapsed ? null : resetAt,
        duration: p.duration.toString(),
        active: p.limitRaw > 0,
        isActive: p.limitRaw > 0,
        durationHours: Math.floor(p.duration / 3600),
        durationDays: Math.floor(p.duration / 86400),
        percentage: isPercentage ? p.limitRaw / 100 : null,
        limitsArePercentage: isPercentage,
      });
    }

    const symbol = this._getTokenSymbol(vault);
    const stablecoins = ["USDT", "USDC", "DAI", "BUSD", "TUSD"];
    const tokenSymbol = stablecoins.includes(symbol) ? "USD" : symbol;
    return { limits, isSetupCommitted: true, limitsArePercentage: isPercentage, tokenSymbol };
  }

  async getPendingWithdrawalDestinationRequests(userAddress) {
    if (this._usesLegacyAccount()) {
      return this.getAdapter().getPendingWithdrawalDestinationRequests(userAddress);
    }

    const pending = await this.getPendingWithdrawalAddresses();
    return pending.map((p) => ({
      title: p.title,
      destination: p.destination,
      executeAfter: p.executeAfter,
      createdAt: p.createdAt,
      networkType: "solana",
    }));
  }

  async fetchPendingBypassRequests(userAddress) {
    if (this._usesLegacyAccount()) {
      return this.getAdapter().fetchPendingBypassRequests(userAddress);
    }
    if (!this.getActiveVaultCapabilities().bypass) return [];

    const req = await this.getBypassRequest();
    if (!req) return [];
    const vault = await this.getActiveVault();
    const factor = 10 ** this._getTokenDecimals(vault);
    return [{
      amount: req.amount / factor,
      amountRaw: req.amount,
      isSol: req.isSol,
      executeAfter: req.executeAfter,
      createdAt: req.createdAt,
      networkType: "solana",
    }];
  }

  // ---- Wallet ----
  isConnected() { return this.getAdapter().isConnected(); }
  getAddress() { return this.getAdapter().getAddress(); }

  async isCorrectNetwork() {
    if (this.networkType === "evm") return this.getAdapter().isCorrectNetwork();
    return true;
  }

  async isProxyDeployed(userAddress) {
    if (this._usesLegacyAccount()) return this.getAdapter().isProxyDeployed(userAddress);
    if (this.networkType === "evm") {
      return !!(await this.getAdapter().getVaultDepositAddress(this.getActiveVaultAddress()));
    }
    return !!this.getActiveVaultAddress();
  }

  async getDepositAddress(userAddress) {
    if (this._usesLegacyAccount()) return this.getAdapter().getDepositAddress(userAddress);
    if (this.networkType === "evm") {
      return (await this.getAdapter().getVaultDepositAddress(this.getActiveVaultAddress())) || "";
    }
    return this.getActiveVaultAddress() || "";
  }

  async deposit(tokenAddress, amount, decimals) {
    if (this._usesLegacyAccount()) {
      return this.getAdapter().deposit(tokenAddress, amount, decimals);
    }

    // A vault holds a single token, so the deposit always uses the vault's own
    const sig = await this.depositToActiveVault(parseFloat(amount));
    return { hash: sig };
  }

  // ---- EVM-specific accessors ----
  getSigner() { return this.networkType === "evm" ? this.getAdapter().getSigner() : null; }
  getContract() { return this.networkType === "evm" ? this.getAdapter().getContract() : null; }
  getProvider() { return this.networkType === "evm" ? this.getAdapter().getProvider() : null; }

  // ---- Legacy-shaped proposal methods ----
  async proposeLimitChange(periodName, newLimit) {
    if (this._usesLegacyAccount()) return this.getAdapter().proposeLimitChange(periodName, newLimit);
    return this.proposeRuleChange({ [`${periodName.toLowerCase()}Limit`]: newLimit });
  }
  async fetchPendingProposals(userAddress) {
    if (this._usesLegacyAccount()) return this.getAdapter().fetchPendingProposals(userAddress);
    const proposal = await this.getRuleChangeProposal();
    return proposal ? [proposal] : [];
  }
  async executeLimitProposal(proposalId) {
    if (this._usesLegacyAccount()) return this.getAdapter().executeLimitProposal(proposalId);
    return this.executeRuleChange();
  }
  async cancelLimitProposal(proposalId) {
    if (this._usesLegacyAccount()) return this.getAdapter().cancelLimitProposal(proposalId);
    return this.cancelRuleChange();
  }

  // ---- Legacy-shaped withdrawal address methods ----
  async fetchWithdrawalAddresses(userAddress) {
    if (this._usesLegacyAccount()) return this.getAdapter().fetchWithdrawalAddresses(userAddress);
    return this.getWithdrawalAddresses();
  }
  async addWithdrawalDestinationDirect(address, title) {
    if (this._usesLegacyAccount()) return this.getAdapter().addWithdrawalDestinationDirect(address, title);
    return this.addWithdrawalAddress(title, address);
  }
  async requestWithdrawalDestinationAddition(address, title) {
    if (this._usesLegacyAccount()) return this.getAdapter().requestWithdrawalDestinationAddition(address, title);
    return this.requestWithdrawalAddress(title, address);
  }

  // ---- EVM proxy/setup methods ----
  async deployProxy() {
    if (this._usesLegacyAccount()) return this.getAdapter().deployProxy();
    if (this.networkType === "evm") {
      return this.getAdapter().deployVaultDepositAddress(this.getActiveVaultAddress());
    }
    throw new Error("Proxy deployment is only available on EVM");
  }
  async getIsSetupCommitted(userAddress) {
    if (this.networkType === "evm") return this.getAdapter().getIsSetupCommitted(userAddress);
    return !!this.personalVaultAddress;
  }
  async setSpendingLimits(daily, weekly, monthly) {
    if (this._usesLegacyAccount()) return this.getAdapter().setSpendingLimits(daily, weekly, monthly);
    return this.updateActiveVaultRules({ dailyLimit: daily, weeklyLimit: weekly, monthlyLimit: monthly });
  }

  // ---- EVM PoolTogether methods ----
  async hasPoolTogetherVault(tokenAddress) { return this.getAdapter().hasPoolTogetherVault?.(tokenAddress) ?? false; }
  async getPoolTogetherBalance(tokenAddress) { return this.getAdapter().getPoolTogetherBalance?.(tokenAddress) ?? "0"; }
  async getPoolTogetherGrandPrize() { return this.getAdapter().getPoolTogetherGrandPrize?.() ?? null; }
  async depositToPoolTogether(tokenAddress, amount) { return this.getAdapter().depositToPoolTogether?.(tokenAddress, amount); }
  async withdrawFromPoolTogether(tokenAddress, shares) { return this.getAdapter().withdrawFromPoolTogether?.(tokenAddress, shares); }
  async claimPoolTogetherPrize(tokenAddress, tier) { return this.getAdapter().claimPoolTogetherPrize?.(tokenAddress, tier); }

  // ---- EVM withdraw ----
  async withdraw(amount, tokenAddress, destination) {
    if (this._usesLegacyAccount()) return this.getAdapter().withdraw(amount, tokenAddress, destination);
    return this.withdrawFromActiveVault(amount);
  }
  async withdrawWithPenalty(tokenAddress, amount, tokenDecimals) {
    if (this._usesLegacyAccount()) throw new Error("Penalty withdrawal not supported on EVM");
    return this.penaltyWithdrawFromActiveVault(amount);
  }
  async getPenaltyRate() {
    if (this._usesLegacyAccount()) return 0;
    const vault = await this.getActiveVault();
    return vault ? vault.penaltyRateBps / 100 : 0;
  }

  async getTransactionHistory() {
    if (this.networkType === "evm") return [];
    const vaultAddress = this.getActiveVaultAddress();
    if (!vaultAddress) return [];
    try {
      const adapter = this.getAdapter();
      const connection = adapter.connection;
      const { PublicKey } = await import("@solana/web3.js");
      const vaultPubkey = new PublicKey(vaultAddress);

      const sigs = await connection.getSignaturesForAddress(vaultPubkey, { limit: 30 });
      const vault = await this.getActiveVault();
      const decimals = this._getTokenDecimals(vault);
      const symbol = this._getTokenSymbol(vault);
      const factor = 10 ** decimals;

      const INSTRUCTION_NAMES = {
        "6c514e757d9b38c8": { name: "DepositSol", label: "Deposit SOL", icon: "📥" },
        "e000c6afc62f69cc": { name: "DepositSpl", label: "Deposit", icon: "📥" },
        "91834a8841892a26": { name: "WithdrawSol", label: "Withdraw SOL", icon: "📤" },
        "b59a5e563e7306ba": { name: "WithdrawSpl", label: "Withdraw", icon: "📤" },
        "f06ea293c3802b87": { name: "WithdrawSolWithPenalty", label: "Penalty Withdraw SOL", icon: "⚡" },
        "15c47249c45ae4b2": { name: "WithdrawSplWithPenalty", label: "Penalty Withdraw", icon: "⚡" },
        "1dedf7d0c1523687": { name: "CreateVault", label: "Create Vault", icon: "🔒" },
        "46ed1e0318e74643": { name: "CreateSplVault", label: "Create Vault", icon: "🔒" },
      };

      const txs = await connection.getTransactions(
        sigs.map((s) => s.signature),
        { maxSupportedTransactionVersion: 0 }
      );

      const history = [];
      for (let i = 0; i < sigs.length; i++) {
        const sig = sigs[i];
        const tx = txs[i];
        if (!tx?.meta || sig.err) continue;

        let matched = null;
        let amount = null;
        const ixs = tx.transaction.message.compiledInstructions || [];
        for (const ix of ixs) {
          const discHex = Buffer.from(ix.data.slice(0, 8)).toString("hex");
          if (INSTRUCTION_NAMES[discHex]) {
            matched = INSTRUCTION_NAMES[discHex];
            if (ix.data.length >= 16) {
              const rawAmount = Buffer.from(ix.data.slice(8, 16)).readBigUInt64LE();
              amount = Number(rawAmount) / factor;
            }
            break;
          }
        }
        if (!matched) continue;

        history.push({
          eventName: matched.name,
          label: matched.label,
          icon: matched.icon,
          txHash: sig.signature,
          amount,
          token: vault?.isSolVault ? "SOL" : symbol,
          decimals,
          timestamp: sig.blockTime,
          category: "Vault",
        });
      }
      return history;
    } catch (err) {
      console.error("Error fetching transaction history:", err);
      return [];
    }
  }

  // ---- Vault CRUD ----
  createVault(params) { return this.getAdapter().createVault(params); }
  joinVault(vaultAddress) { return this.getAdapter().joinVault(vaultAddress); }
  leaveVault(vaultAddress) { return this.getAdapter().leaveVault(vaultAddress); }

  // ---- Deposits / withdrawals (chain-agnostic, business units) ----
  depositToVault(vaultAddress, amount) {
    return this.getAdapter().depositToVault(vaultAddress, amount);
  }
  withdrawFromVault(vaultAddress, amount) {
    return this.getAdapter().withdrawFromVault(vaultAddress, amount);
  }
  withdrawFromVaultWithPenalty(vaultAddress, amount) {
    return this.getAdapter().withdrawFromVaultWithPenalty(vaultAddress, amount);
  }

  // ---- Penalty rewards ----
  claimVaultPenaltyRewards(vaultAddress) {
    return this.getAdapter().claimVaultPenaltyRewards(vaultAddress);
  }

  // ---- Vault management ----
  updateVaultRules(vaultAddress, rules) {
    return this.getAdapter().updateVaultRules(vaultAddress, rules);
  }

  // ---- Withdrawal destinations (personal vault compat) ----

  async addWithdrawalAddress(title, destinationAddress) {
    if (this._usesLegacyAccount()) {
      // Routes to a direct add before lock-in and to the 24h timelock
      // request after — the contract rejects direct adds once committed
      return this.getAdapter().addWithdrawalDestination(destinationAddress, title);
    }
    this._requireCapability("destinations");
    return this.getAdapter().addWithdrawalDestination(this._requireActiveVault(), destinationAddress, title);
  }

  async requestWithdrawalAddress(title, destinationAddress) {
    if (this._usesLegacyAccount()) return this.getAdapter().requestWithdrawalDestinationAddition(destinationAddress, title);
    this._requireCapability("destinations");
    return this.getAdapter().requestWithdrawalDestination(this._requireActiveVault(), destinationAddress, title);
  }

  async executeWithdrawalAddressRequest(destinationAddress) {
    if (this._usesLegacyAccount()) return this.getAdapter().executeWithdrawalAddressRequest(destinationAddress);
    this._requireCapability("destinations");
    return this.getAdapter().executeDestinationRequest(this._requireActiveVault(), destinationAddress);
  }

  async cancelWithdrawalAddressRequest(destinationAddress) {
    if (this._usesLegacyAccount()) return this.getAdapter().cancelWithdrawalAddressRequest?.(destinationAddress);
    this._requireCapability("destinations");
    return this.getAdapter().cancelDestinationRequest(this._requireActiveVault(), destinationAddress);
  }

  async removeWithdrawalAddress(destinationAddress) {
    if (this._usesLegacyAccount()) return this.getAdapter().removeWithdrawalAddress(destinationAddress);
    this._requireCapability("destinations");
    return this.getAdapter().removeWithdrawalDestination(this._requireActiveVault(), destinationAddress);
  }

  async getWithdrawalAddresses() {
    if (this._usesLegacyAccount()) return this.getAdapter().fetchWithdrawalAddresses();
    if (!this.getActiveVaultCapabilities().destinations) return [];
    const vaultAddress = this.getActiveVaultAddress();
    if (!vaultAddress) return [];
    return this.getAdapter().getWithdrawalDestinations(vaultAddress);
  }

  async getPendingWithdrawalAddresses() {
    if (this._usesLegacyAccount()) return this.getAdapter().getPendingWithdrawalDestinationRequests();
    if (!this.getActiveVaultCapabilities().destinations) return [];
    const vaultAddress = this.getActiveVaultAddress();
    if (!vaultAddress) return [];
    return this.getAdapter().getPendingDestinationRequests(vaultAddress);
  }

  // ---- Rule change proposals (personal vault compat) ----

  async proposeRuleChange(rules) {
    const vaultAddress = this._requireActiveVault();
    if (!this.getActiveVaultCapabilities().proposals) {
      // The EVM vault module has no timelocked proposals yet — rule changes
      // apply immediately. Callers pass raw units (legacy shape), while
      // updateVaultRules expects business units, so convert back.
      const vault = await this.getActiveVault();
      const pct = rules.limitsArePercentage ?? vault.limitsArePercentage;
      const factor = 10 ** this._getTokenDecimals(vault);
      const toBusiness = (value) =>
        value == null ? undefined : pct ? value / 100 : value / factor;
      return this.updateActiveVaultRules({
        dailyLimit: toBusiness(rules.dailyLimit),
        weeklyLimit: toBusiness(rules.weeklyLimit),
        monthlyLimit: toBusiness(rules.monthlyLimit),
        penaltyRateBps: rules.penaltyRateBps,
        limitsArePercentage: rules.limitsArePercentage,
      });
    }
    return this.getAdapter().proposeRuleChange(vaultAddress, rules);
  }

  async executeRuleChange() {
    this._requireCapability("proposals");
    return this.getAdapter().executeRuleChange(this._requireActiveVault());
  }

  async cancelRuleChange() {
    this._requireCapability("proposals");
    return this.getAdapter().cancelRuleChange(this._requireActiveVault());
  }

  async getRuleChangeProposal() {
    if (!this.getActiveVaultCapabilities().proposals) return null;
    const vaultAddress = this.getActiveVaultAddress();
    if (!vaultAddress) return null;
    return this.getAdapter().getRuleChangeProposal(vaultAddress);
  }

  // ---- Bypass requests (personal vault compat) ----

  async requestBypass(amount) {
    this._requireCapability("bypass");
    const vaultAddress = this._requireActiveVault();
    const vault = await this.getActiveVault();
    const isSol = vault ? vault.isSolVault : true;
    const rawAmount = isSol ? amount : Math.round(amount * 10 ** this._getTokenDecimals(vault));
    return this.getAdapter().requestBypass(vaultAddress, rawAmount, isSol);
  }

  async executeBypass() {
    this._requireCapability("bypass");
    const vaultAddress = this._requireActiveVault();
    const vault = await this.getActiveVault();
    if (vault && !vault.isSolVault) {
      return this.getAdapter().executeBypassSpl(vaultAddress, vault.tokenMint);
    }
    return this.getAdapter().executeBypassSol(vaultAddress);
  }

  async cancelBypass() {
    this._requireCapability("bypass");
    return this.getAdapter().cancelBypass(this._requireActiveVault());
  }

  async getBypassRequest() {
    if (!this.getActiveVaultCapabilities().bypass) return null;
    const vaultAddress = this.getActiveVaultAddress();
    if (!vaultAddress) return null;
    return this.getAdapter().getBypassRequest(vaultAddress);
  }

  // ---- Withdrawal destinations (vault-level) ----
  addWithdrawalDestination(vaultAddress, destinationAddress, title) {
    return this.getAdapter().addWithdrawalDestination(vaultAddress, destinationAddress, title);
  }
  requestWithdrawalDestination(vaultAddress, destinationAddress, title) {
    return this.getAdapter().requestWithdrawalDestination(vaultAddress, destinationAddress, title);
  }
  executeDestinationRequest(vaultAddress, destinationAddress) {
    return this.getAdapter().executeDestinationRequest(vaultAddress, destinationAddress);
  }
  cancelDestinationRequest(vaultAddress, destinationAddress) {
    return this.getAdapter().cancelDestinationRequest(vaultAddress, destinationAddress);
  }
  removeWithdrawalDestination(vaultAddress, destinationAddress) {
    return this.getAdapter().removeWithdrawalDestination(vaultAddress, destinationAddress);
  }
  getWithdrawalDestinations(vaultAddress, memberAddress) {
    return this.getAdapter().getWithdrawalDestinations(vaultAddress, memberAddress);
  }
  getPendingDestinationRequests(vaultAddress, memberAddress) {
    return this.getAdapter().getPendingDestinationRequests(vaultAddress, memberAddress);
  }

  // ---- Rule proposals (vault-level) ----
  proposeVaultRuleChange(vaultAddress, rules) {
    return this.getAdapter().proposeRuleChange(vaultAddress, rules);
  }
  executeVaultRuleChange(vaultAddress) {
    return this.getAdapter().executeRuleChange(vaultAddress);
  }
  cancelVaultRuleChange(vaultAddress) {
    return this.getAdapter().cancelRuleChange(vaultAddress);
  }
  getRuleChangeProposalForVault(vaultAddress) {
    return this.getAdapter().getRuleChangeProposal(vaultAddress);
  }

  // ---- Bypass (vault-level) ----
  requestVaultBypass(vaultAddress, amount, isSol) {
    return this.getAdapter().requestBypass(vaultAddress, amount, isSol);
  }
  executeVaultBypassSol(vaultAddress) {
    return this.getAdapter().executeBypassSol(vaultAddress);
  }
  executeVaultBypassSpl(vaultAddress, tokenMint) {
    return this.getAdapter().executeBypassSpl(vaultAddress, tokenMint);
  }
  cancelVaultBypass(vaultAddress) {
    return this.getAdapter().cancelBypass(vaultAddress);
  }
  getVaultBypassRequest(vaultAddress, memberAddress) {
    return this.getAdapter().getBypassRequest(vaultAddress, memberAddress);
  }

  // ---- Read operations ----
  getVaultInfo(vaultAddress) { return this.getAdapter().getVaultInfo(vaultAddress); }
  getVaultMemberInfo(vaultAddress, memberAddress) {
    return this.getAdapter().getVaultMemberInfo(vaultAddress, memberAddress);
  }
  getUserVaults() { return this.getAdapter().getUserVaults(); }
  discoverVaults(filters) { return this.getAdapter().discoverVaults(filters); }
  getVaultMembers(vaultAddress) { return this.getAdapter().getVaultMembers(vaultAddress); }

  // ---- Program config ----
  initializeProgramConfig(penaltyRateBps) {
    return this.getAdapter().initializeProgramConfig(penaltyRateBps);
  }
  getProgramConfig() { return this.getAdapter().getProgramConfig(); }
}
