import { SolanaAdapter } from "./SolanaAdapter.js";

const PERSONAL_VAULT_KEY = "personal_vault_address";

export class TransactionManager {
  constructor() {
    this.adapter = null;
    this.networkConfig = null;
    this.personalVaultAddress = null;
  }

  async initialize(networkConfig, walletConfig) {
    const { wallet, connection } = walletConfig;
    if (!wallet || !connection) {
      throw new Error("Solana wallet and connection required");
    }
    this.networkConfig = networkConfig;
    this.adapter = new SolanaAdapter(networkConfig, wallet, connection);
    if (wallet.connected) {
      this.adapter.userAddress = wallet.publicKey.toString();
    }

    await this._loadPersonalVault();
    return this;
  }

  getAdapter() {
    if (!this.adapter) throw new Error("TransactionManager not initialized");
    return this.adapter;
  }

  // ---- Personal vault management ----

  _getTokenDecimals(vault) {
    if (!vault) return 9;
    if (vault.isSolVault) return 9;
    const tokens = this.networkConfig?.tokens || {};
    const match = Object.values(tokens).find(
      (t) => t.address === vault.tokenMint
    );
    return match?.decimals ?? 6;
  }

  _getTokenSymbol(vault) {
    if (!vault) return "SOL";
    if (vault.isSolVault) return "SOL";
    const tokens = this.networkConfig?.tokens || {};
    const match = Object.values(tokens).find(
      (t) => t.address === vault.tokenMint
    );
    return match?.symbol ?? "TOKEN";
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
    return !!this.personalVaultAddress;
  }

  async getPersonalVault() {
    if (!this.personalVaultAddress) return null;
    return this.getAdapter().getVaultInfo(this.personalVaultAddress);
  }

  async getPersonalMembership() {
    if (!this.personalVaultAddress) return null;
    return this.getAdapter().getVaultMemberInfo(this.personalVaultAddress);
  }

  // ---- Compatibility layer (old UI flow) ----

  async commitSetup(daily, weekly, monthly, limitsArePercentage = false, tokenMint = null, tokenDecimals = 6) {
    let dailyVal, weeklyVal, monthlyVal;
    const decimals = tokenMint ? tokenDecimals : 9;

    if (limitsArePercentage) {
      if (daily > 100 || weekly > 100 || monthly > 100) {
        throw new Error("Percentage values must be between 0 and 100");
      }
      dailyVal = daily > 0 ? Math.round(daily * 100) : 0;
      weeklyVal = weekly > 0 ? Math.round(weekly * 100) : 0;
      monthlyVal = monthly > 0 ? Math.round(monthly * 100) : 0;
    } else {
      const factor = 10 ** decimals;
      dailyVal = daily > 0 ? Math.round(daily * factor) : 0;
      weeklyVal = weekly > 0 ? Math.round(weekly * factor) : 0;
      monthlyVal = monthly > 0 ? Math.round(monthly * factor) : 0;
    }

    const result = await this.getAdapter().createVault({
      name: "Personal Savings",
      description: "My personal savings vault",
      vaultType: "Personal",
      tokenMint,
      dailyLimit: dailyVal,
      weeklyLimit: weeklyVal,
      monthlyLimit: monthlyVal,
      penaltyRateBps: 2000,
      limitsArePercentage,
    });

    this.personalVaultAddress = result.vaultAddress;
    const walletAddr = this.getAddress();
    if (walletAddr) {
      localStorage.setItem(`${PERSONAL_VAULT_KEY}_${walletAddr}`, result.vaultAddress);
    }
    return result.signature;
  }

  async getPersonalVaultLimits() {
    const vault = await this.getPersonalVault();
    if (!vault) return { daily: 0, weekly: 0, monthly: 0, penaltyPct: 0, limitsArePercentage: false };
    if (vault.limitsArePercentage) {
      return {
        daily: vault.dailyLimit / 100,
        weekly: vault.weeklyLimit / 100,
        monthly: vault.monthlyLimit / 100,
        penaltyPct: vault.penaltyRateBps / 100,
        limitsArePercentage: true,
      };
    }
    const factor = 10 ** this._getTokenDecimals(vault);
    return {
      daily: vault.dailyLimit / factor,
      weekly: vault.weeklyLimit / factor,
      monthly: vault.monthlyLimit / factor,
      penaltyPct: vault.penaltyRateBps / 100,
      limitsArePercentage: false,
    };
  }

  async getPersonalVaultBalance() {
    const vault = await this.getPersonalVault();
    const membership = await this.getPersonalMembership();
    if (!membership) return 0;
    const factor = 10 ** this._getTokenDecimals(vault);
    return membership.balance / factor;
  }

  async getAllBalances() {
    const vault = await this.getPersonalVault();
    const membership = await this.getPersonalMembership();
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

  async depositToPersonalVault(amount) {
    if (!this.personalVaultAddress) throw new Error("No personal vault. Complete setup first.");
    const vault = await this.getPersonalVault();
    if (vault && !vault.isSolVault) {
      const decimals = this._getTokenDecimals(vault);
      return this.getAdapter().depositSpl(this.personalVaultAddress, vault.tokenMint, amount, decimals);
    }
    return this.getAdapter().depositSol(this.personalVaultAddress, amount);
  }

  async withdrawFromPersonalVault(amount) {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    const vault = await this.getPersonalVault();
    if (vault && !vault.isSolVault) {
      const decimals = this._getTokenDecimals(vault);
      return this.getAdapter().withdrawSpl(this.personalVaultAddress, vault.tokenMint, amount, decimals);
    }
    return this.getAdapter().withdrawSol(this.personalVaultAddress, amount);
  }

  async penaltyWithdrawFromPersonalVault(amount) {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    const vault = await this.getPersonalVault();
    if (vault && !vault.isSolVault) {
      const decimals = this._getTokenDecimals(vault);
      return this.getAdapter().withdrawSplWithPenalty(this.personalVaultAddress, vault.tokenMint, amount, decimals);
    }
    return this.getAdapter().withdrawSolWithPenalty(this.personalVaultAddress, amount);
  }

  async updatePersonalVaultRules(rules) {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    return this.getAdapter().updateVaultRules(this.personalVaultAddress, rules);
  }

  // ---- Old service compatibility layer ----

  getCurrentAdapter() { return this.getAdapter(); }

  async getSpendingLimits() {
    const vault = await this.getPersonalVault();
    const membership = await this.getPersonalMembership();
    if (!vault || !membership) {
      return { limits: [], isSetupCommitted: !!this.personalVaultAddress };
    }

    const decimals = this._getTokenDecimals(vault);
    const factor = 10 ** decimals;
    const balance = membership.balance / factor;
    const isPercentage = vault.limitsArePercentage;
    const limits = [];

    const periods = [
      { name: "Daily", limitRaw: vault.dailyLimit, spent: membership.dailySpent, duration: 86400 },
      { name: "Weekly", limitRaw: vault.weeklyLimit, spent: membership.weeklySpent, duration: 604800 },
      { name: "Monthly", limitRaw: vault.monthlyLimit, spent: membership.monthlySpent, duration: 2592000 },
    ];

    for (const p of periods) {
      let limitAmt;
      if (isPercentage) {
        limitAmt = balance * p.limitRaw / 10000;
      } else {
        limitAmt = p.limitRaw / factor;
      }
      const spent = p.spent / factor;
      limits.push({
        name: p.name,
        limit: limitAmt.toString(),
        spent: spent.toString(),
        remaining: Math.max(0, limitAmt - spent),
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

  async getPendingWithdrawalDestinationRequests() {
    const pending = await this.getPendingWithdrawalAddresses();
    return pending.map((p) => ({
      title: p.title,
      destination: p.destination,
      executeAfter: p.executeAfter,
      createdAt: p.createdAt,
      networkType: "solana",
    }));
  }

  async fetchPendingBypassRequests() {
    const req = await this.getBypassRequest();
    if (!req) return [];
    const vault = await this.getPersonalVault();
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

  async isCorrectNetwork() { return true; }
  async isProxyDeployed() { return !!this.personalVaultAddress; }
  async getDepositAddress() { return this.personalVaultAddress || ""; }

  async deposit(tokenAddress, amount, decimals) {
    if (!this.personalVaultAddress) throw new Error("No personal vault. Complete setup first.");
    const numAmount = parseFloat(amount);
    if (tokenAddress === "native" || tokenAddress === "SOL") {
      const sig = await this.getAdapter().depositSol(this.personalVaultAddress, numAmount);
      return { hash: sig };
    }
    const sig = await this.getAdapter().depositSpl(this.personalVaultAddress, tokenAddress, numAmount, decimals);
    return { hash: sig };
  }

  async getTransactionHistory() {
    if (!this.personalVaultAddress) return [];
    try {
      const adapter = this.getAdapter();
      const connection = adapter.connection;
      const { PublicKey } = await import("@solana/web3.js");
      const vaultPubkey = new PublicKey(this.personalVaultAddress);

      const sigs = await connection.getSignaturesForAddress(vaultPubkey, { limit: 30 });
      const vault = await this.getPersonalVault();
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

  // ---- Deposits ----
  depositSol(vaultAddress, amount) { return this.getAdapter().depositSol(vaultAddress, amount); }
  depositSpl(vaultAddress, tokenMint, amount, decimals) {
    return this.getAdapter().depositSpl(vaultAddress, tokenMint, amount, decimals);
  }

  // ---- Withdrawals ----
  withdrawSol(vaultAddress, amount) { return this.getAdapter().withdrawSol(vaultAddress, amount); }
  withdrawSpl(vaultAddress, tokenMint, amount, decimals) {
    return this.getAdapter().withdrawSpl(vaultAddress, tokenMint, amount, decimals);
  }
  withdrawSolWithPenalty(vaultAddress, amount) {
    return this.getAdapter().withdrawSolWithPenalty(vaultAddress, amount);
  }
  withdrawSplWithPenalty(vaultAddress, tokenMint, amount, decimals) {
    return this.getAdapter().withdrawSplWithPenalty(vaultAddress, tokenMint, amount, decimals);
  }

  // ---- Penalty rewards ----
  claimPenaltyRewards(vaultAddress, isSpl, tokenMint) {
    return this.getAdapter().claimPenaltyRewards(vaultAddress, isSpl, tokenMint);
  }

  // ---- Vault management ----
  updateVaultRules(vaultAddress, rules) {
    return this.getAdapter().updateVaultRules(vaultAddress, rules);
  }

  // ---- Withdrawal destinations (personal vault compat) ----

  async addWithdrawalAddress(title, destinationAddress) {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    return this.getAdapter().addWithdrawalDestination(this.personalVaultAddress, destinationAddress, title);
  }

  async requestWithdrawalAddress(title, destinationAddress) {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    return this.getAdapter().requestWithdrawalDestination(this.personalVaultAddress, destinationAddress, title);
  }

  async executeWithdrawalAddressRequest(destinationAddress) {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    return this.getAdapter().executeDestinationRequest(this.personalVaultAddress, destinationAddress);
  }

  async cancelWithdrawalAddressRequest(destinationAddress) {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    return this.getAdapter().cancelDestinationRequest(this.personalVaultAddress, destinationAddress);
  }

  async removeWithdrawalAddress(destinationAddress) {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    return this.getAdapter().removeWithdrawalDestination(this.personalVaultAddress, destinationAddress);
  }

  async getWithdrawalAddresses() {
    if (!this.personalVaultAddress) return [];
    return this.getAdapter().getWithdrawalDestinations(this.personalVaultAddress);
  }

  async getPendingWithdrawalAddresses() {
    if (!this.personalVaultAddress) return [];
    return this.getAdapter().getPendingDestinationRequests(this.personalVaultAddress);
  }

  // ---- Rule change proposals (personal vault compat) ----

  async proposeRuleChange(rules) {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    return this.getAdapter().proposeRuleChange(this.personalVaultAddress, rules);
  }

  async executeRuleChange() {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    return this.getAdapter().executeRuleChange(this.personalVaultAddress);
  }

  async cancelRuleChange() {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    return this.getAdapter().cancelRuleChange(this.personalVaultAddress);
  }

  async getRuleChangeProposal() {
    if (!this.personalVaultAddress) return null;
    return this.getAdapter().getRuleChangeProposal(this.personalVaultAddress);
  }

  // ---- Bypass requests (personal vault compat) ----

  async requestBypass(amount) {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    const vault = await this.getPersonalVault();
    const isSol = vault ? vault.isSolVault : true;
    const rawAmount = isSol ? amount : Math.round(amount * 10 ** this._getTokenDecimals(vault));
    return this.getAdapter().requestBypass(this.personalVaultAddress, rawAmount, isSol);
  }

  async executeBypass() {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    const vault = await this.getPersonalVault();
    if (vault && !vault.isSolVault) {
      return this.getAdapter().executeBypassSpl(this.personalVaultAddress, vault.tokenMint);
    }
    return this.getAdapter().executeBypassSol(this.personalVaultAddress);
  }

  async cancelBypass() {
    if (!this.personalVaultAddress) throw new Error("No personal vault");
    return this.getAdapter().cancelBypass(this.personalVaultAddress);
  }

  async getBypassRequest() {
    if (!this.personalVaultAddress) return null;
    return this.getAdapter().getBypassRequest(this.personalVaultAddress);
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
