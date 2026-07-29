import { ethers } from "ethers";
import { BlockchainAdapter } from "./BlockchainAdapter.js";
import SavingsABI from "../SavingsABI.json";
import MockUSDT_ABI from "../MockUSDT_ABI.json";
import ProxyDeploymentModuleABI from "../ProxyDeploymentModuleABI.json";
import TimePeriodLimitsModuleABI from "../TimePeriodLimitsModuleABI.json";
import ProposalSystemModuleABI from "../ProposalSystemModuleABI.json";
import BypassSystemModuleABI from "../BypassSystemModuleABI.json";
import ApprovalSystemModuleABI from "../ApprovalSystemModuleABI.json";
import PoolTogetherModuleABI from "../PoolTogetherModuleABI.json";
import VaultSystemModuleABI from "../VaultSystemModuleABI.json";
import SavingsTimelockABI from "../SavingsTimelockABI.json";
import ReferralModuleABI from "../ReferralModuleABI.json";
import RecoverySystemModuleABI from "../RecoverySystemModuleABI.json";
import ERC20ABI from "../ERC20ABI.json";
import { getTokenMeta } from "../utils/tokenUtils.js";
import {
  SPENDING_PERIODS,
  getPeriodDuration,
  getDefaultUnlockDelay,
} from "../utils/spendingPeriods.js";

const VAULT_SYSTEM_MODULE_ID = ethers.keccak256(ethers.toUtf8Bytes("VAULT_SYSTEM"));
const REFERRAL_MODULE_ID = ethers.keccak256(ethers.toUtf8Bytes("REFERRAL"));
const RECOVERY_SYSTEM_MODULE_ID = ethers.keccak256(ethers.toUtf8Bytes("RECOVERY_SYSTEM"));
const REFERRAL_PAGE_SIZE = 100;

// User-facing modules are called directly (Pattern B): each authenticates the
// caller via msg.sender, so no calls route through SavingsCore forwarders
const MODULE_DEFS = {
  timePeriodLimits: { id: ethers.keccak256(ethers.toUtf8Bytes("TIME_PERIOD_LIMITS")), abi: TimePeriodLimitsModuleABI },
  proposalSystem: { id: ethers.keccak256(ethers.toUtf8Bytes("PROPOSAL_SYSTEM")), abi: ProposalSystemModuleABI },
  bypassSystem: { id: ethers.keccak256(ethers.toUtf8Bytes("BYPASS_SYSTEM")), abi: BypassSystemModuleABI },
  approvalSystem: { id: ethers.keccak256(ethers.toUtf8Bytes("APPROVAL_SYSTEM")), abi: ApprovalSystemModuleABI },
  proxyDeployment: { id: ethers.keccak256(ethers.toUtf8Bytes("PROXY_DEPLOYMENT")), abi: ProxyDeploymentModuleABI },
  poolTogether: { id: ethers.keccak256(ethers.toUtf8Bytes("POOL_TOGETHER")), abi: PoolTogetherModuleABI },
};
const VAULT_TYPE_NAMES = ["Personal", "Community"];

// Human-readable labels for calls wrapped inside timelock operations, so the
// governance UI can show what a queued action actually does
const GOVERNANCE_CALL_LABELS = {
  "0x4f1ef286": "Contract upgrade (upgradeToAndCall)",
  "0xa78e922b": "Register new module",
  "0x3595945d": "Unregister module",
  "0xf2fde38b": "Transfer ownership",
  "0x2f2ff15d": "Grant governance role",
  "0xd547741f": "Revoke governance role",
  "0x64d62353": "Change timelock delay",
};

// Minimal Gnosis Safe surface — enough to display who controls the timelock
const SAFE_ABI = [
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
];

// Contract revert reasons the user can actually hit, paired with what they
// should read instead. Matched as substrings in order, so a longer reason must
// come before any shorter one it contains.
const REVERT_MESSAGES = [
  // Recovery
  ["Recovery key already set - use timelocked change", "A recovery key is already set — replacing it takes the 30-day change request"],
  ["Recovery key must differ from account key", "The recovery key must be a different address from your account"],
  ["Not the proposed recovery key", "This wallet is not the proposed recovery key for that account"],
  ["Account was recovered", "This account was already recovered to a new address"],
  ["New owner was recovered", "That address has already received a recovered account"],
  ["Only recovery key", "Only the account's recovery key can do this"],
  ["No recovery key set", "Set a recovery key first"],
  ["No pending proposal", "There is no recovery key proposal to cancel"],
  ["No pending change", "There is no pending recovery key change"],
  ["Already frozen", "This account is already frozen"],
  ["Not frozen", "This account is not frozen"],
  ["Account is frozen", "This account is frozen — its recovery key can unfreeze it"],

  // Timelocks and requests
  ["Request still in timelock", "The waiting period is not over yet"],
  ["Still in timelock", "The waiting period is not over yet"],
  ["Request already executed", "This request has already been executed"],
  ["Request does not exist", "That request no longer exists"],
  ["Request exists", "You already have a request waiting for this"],
  ["Full withdrawal not approved", "A full withdrawal needs approval from your approvers first"],
  ["Not approved", "This action has not been approved yet"],
  ["Not authorized approver", "This wallet is not one of your approvers"],

  // Spending limits and setup
  ["Setup already committed - use timelock method", "Your setup is locked in — changes go through the waiting period"],
  ["Setup committed - use proposals", "Your setup is locked in — changing a limit takes a proposal"],
  ["Setup must be committed for proposals", "Lock in your setup before proposing changes"],
  ["Setup not committed", "Lock in your setup first"],
  ["Already committed", "Your setup is already locked in"],
  ["Shorter period exceeds longer period", "A shorter period can never allow more than a longer one"],
  ["Monthly below weekly", "The monthly limit must be at least the weekly limit"],
  ["Monthly below daily", "The monthly limit must be at least the daily limit"],
  ["Weekly below daily", "The weekly limit must be at least the daily limit"],
  ["At least one limit must be set", "Set at least one spending limit"],
  ["No limits set", "Set at least one spending limit"],
  ["Limit exceeds 100%", "A percentage limit cannot be above 100%"],
  ["Period not found or inactive", "That spending period is not active on your account"],
  ["Period not found", "That spending period is not set on your account"],
  ["Period name cannot be empty", "Give the spending period a name"],
  ["Proposal already exists", "You already have a proposal waiting for this period"],
  ["Invalid proposal", "That proposal no longer exists"],
  ["Invalid timelock duration", "Choose a waiting period between 1 hour and 365 days"],
  ["Invalid unlock delay", "The wait time must be between 1 hour and 1 year"],
  ["Daily limit exceeded", "This is over your daily limit — request a bypass to withdraw it"],
  ["Weekly limit exceeded", "This is over your weekly limit — request a bypass to withdraw it"],
  ["Monthly limit exceeded", "This is over your monthly limit — request a bypass to withdraw it"],
  ["Exceeds limit", "This is over your spending limit — request a bypass to withdraw it"],

  // Withdrawal destinations and approvals
  ["Cannot set own address as destination", "Your own address is always available — no need to add it"],
  ["Address already exists", "That address is already on your list"],
  ["Duplicate approval address", "That approver is already on your list"],
  ["Cannot approve yourself", "You cannot add your own address as an approver"],
  ["Approval address not found", "That approver is not on your list"],
  ["Invalid destination address", "That destination address is not valid"],
  ["Invalid destination", "That destination is not on your approved list"],
  ["Invalid title length", "Give the address a name between 1 and 32 characters"],
  ["Too many approvals at once", "Add fewer approvers at a time"],
  ["Too many revocations at once", "Remove fewer approvers at a time"],
  ["No approvals provided", "Choose at least one approver"],

  // Balances and amounts
  ["Deposit must be greater than zero", "Enter a deposit greater than zero"],
  ["Amount must be greater than zero", "Enter an amount greater than zero"],
  ["Amount must be > 0", "Enter an amount greater than zero"],
  ["Insufficient ETH for fee", "Not enough ETH in your wallet to cover the fee"],
  ["Incorrect ETH amount", "The ETH sent does not match the amount requested"],
  ["Insufficient balance", "That is more than your balance"],
  ["Insufficient shares", "That is more than you have in the prize pool"],
  ["Invalid amount", "That is more than your balance"],
  ["No funds", "There is nothing to withdraw"],
  ["Nothing to sweep", "There is nothing waiting at your deposit address"],
  ["No tokens to sweep", "There is nothing waiting at your deposit address"],
  ["ERC20: transfer amount exceeds balance", "That is more than your wallet holds"],
  ["ERC20InsufficientBalance", "That is more than your wallet holds"],
  ["transfer amount exceeds allowance", "The token approval did not go through — try again"],
  ["ERC20InsufficientAllowance", "The token approval did not go through — try again"],

  // Vaults
  ["Community rules immutable", "A community vault's rules cannot be changed after it is created"],
  ["Creator cannot leave", "The creator cannot leave their own vault"],
  ["Balance not zero", "Withdraw your balance before leaving the vault"],
  ["Already a member", "You are already a member of this vault"],
  ["Not a vault member", "You are not a member of this vault"],
  ["Not in member list", "You are not a member of this vault"],
  ["Vault not active", "This vault is no longer active"],
  ["Vault not found", "That vault no longer exists"],
  ["Vault asset mismatch", "That token does not match this vault"],
  ["Personal vault", "A personal vault cannot be joined"],
  ["Only creator", "Only the vault's creator can do this"],
  ["Invalid penalty rate", "The penalty rate must be between 0.01% and 50%"],
  ["Invalid vault type", "Choose a valid vault type"],
  ["Invalid name", "Give the vault a name"],
  ["Invalid description", "The vault description is too long"],

  // Prize pool
  ["No vault for token", "The prize pool does not accept this token"],
  ["Prize pool underfunded", "The prize pool cannot cover this prize right now"],
  ["PrizePool not configured", "The prize pool is not available on this network"],
  ["No prize for tier", "There is no prize to claim at this tier"],
  ["No prize to claim", "You have no prize to claim"],
  ["Nothing to claim", "You have nothing to claim"],
  ["Invalid tier", "That prize tier does not exist"],
  ["Zero redeem", "There is nothing to withdraw from the prize pool"],
  ["Zero deposit", "Enter a deposit greater than zero"],

  // Referrals and proxies
  ["Cannot refer yourself", "You cannot refer yourself"],
  ["Referrer already recorded", "A referrer is already recorded for this account"],
  ["Invalid referrer", "That referral link is not valid"],
  ["Already deployed", "Your deposit address is already deployed"],
  ["Already registered", "This account is already registered"],
];

// Every write path, with the sentence prefixed when nothing above matches
const WRITE_FALLBACKS = {
  deposit: "Deposit failed",
  withdraw: "Withdrawal failed",
  deployProxy: "Could not create your deposit address",
  sweepProxy: "Could not move funds from your deposit address",
  commitSetup: "Could not lock in your setup",
  setSpendingLimits: "Could not save your spending limits",
  addSpendingLimit: "Could not add the spending limit",
  proposeLimitChange: "Could not propose the limit change",
  proposeUnlockDelayChange: "Could not propose the wait time change",
  executeLimitProposal: "Could not execute the proposal",
  cancelLimitProposal: "Could not cancel the proposal",
  requestLimitBypass: "Could not request the bypass",
  executeBypassWithdrawal: "Could not execute the bypass",
  cancelBypassRequest: "Could not cancel the bypass request",
  addWithdrawalDestination: "Could not add the withdrawal address",
  requestWithdrawalDestinationAddition: "Could not request the withdrawal address",
  addWithdrawalDestinationDirect: "Could not add the withdrawal address",
  executeWithdrawalAddressRequest: "Could not execute the request",
  cancelWithdrawalAddressRequest: "Could not cancel the request",
  removeWithdrawalAddress: "Could not remove the withdrawal address",
  setRecoveryAddress: "Could not set the recovery key",
  acceptRecoveryRole: "Could not accept the recovery role",
  cancelRecoveryKeyProposal: "Could not cancel the recovery key proposal",
  requestRecoveryKeyChange: "Could not request the recovery key change",
  executeRecoveryKeyChange: "Could not change the recovery key",
  cancelRecoveryKeyChange: "Could not cancel the recovery key change",
  freezeAccount: "Could not freeze the account",
  unfreezeAccount: "Could not unfreeze the account",
  recoverAccount: "Could not recover the account",
  depositToPoolTogether: "Could not join the prize pool",
  withdrawFromPoolTogether: "Could not leave the prize pool",
  claimPoolTogetherPrize: "Could not claim the prize",
  createVault: "Could not create the vault",
  joinVault: "Could not join the vault",
  leaveVault: "Could not leave the vault",
  updateVaultRules: "Could not update the vault rules",
  depositToVault: "Deposit failed",
  withdrawFromVault: "Withdrawal failed",
  withdrawFromVaultWithPenalty: "Withdrawal failed",
  claimVaultPenaltyRewards: "Could not claim your rewards",
  deployVaultDepositAddress: "Could not create the vault deposit address",
};

/**
 * EVM Blockchain Adapter for MetaMask and ethers.js integration
 */
export class EVMAdapter extends BlockchainAdapter {
  constructor(networkConfig) {
    super(networkConfig);
    this.provider = null;
    this.signer = null;
    this.savingsContract = null;
    this.proxyDeploymentModule = null;
    this.vaultModule = null;
    this.userAddress = null;
    this.ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
    this._installErrorTranslation(WRITE_FALLBACKS);
  }

  /**
   * Find the revert reason inside the ethers error — it can sit in `reason`,
   * in the short message, or only in the nested provider payload.
   */
  _chainErrorMessage(error) {
    const haystack = [
      error?.reason,
      error?.shortMessage,
      error?.message,
      error?.info?.error?.message,
      error?.error?.message,
      error?.data?.message,
    ]
      .filter(Boolean)
      .join(" | ");

    const match = REVERT_MESSAGES.find(([reason]) => haystack.includes(reason));
    if (match) return match[1];

    // MetaMask reports a gas shortfall before the contract is ever reached
    if (/insufficient funds for (intrinsic transaction cost|gas)/i.test(haystack)) {
      return "Not enough ETH in your wallet to pay the network fee";
    }
    return null;
  }

  // Wallet Management
  async isConnected() {
    try {
      if (!window.ethereum) return false;
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });
      return accounts.length > 0 && this.provider && this.signer;
    } catch {
      return false;
    }
  }

  async connect({ provider, signer } = {}) {
    try {
      if (provider && signer) {
        // Use provided provider/signer from root component
        this.provider = provider;
        this.signer = signer;
      } else {
        // Fallback: create own provider (should rarely happen)
        if (!window.ethereum) {
          throw new Error(
            "MetaMask not found. Please install MetaMask to continue.",
          );
        }
        await window.ethereum.request({ method: "eth_requestAccounts" });
        this.provider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await this.provider.getSigner();
      }

      this.userAddress = await this.signer.getAddress();
      await this._initializeContracts();

      return {
        address: this.userAddress,
        provider: this.provider,
        signer: this.signer,
      };
    } catch (error) {
      console.error("Failed to connect to MetaMask:", error);
      throw error;
    }
  }

  async disconnect() {
    this.provider = null;
    this.signer = null;
    this.savingsContract = null;
    this.proxyDeploymentModule = null;
    this.vaultModule = null;
    this.userAddress = null;
  }

  async getAddress() {
    if (this.userAddress) return this.userAddress;
    if (this.signer) {
      this.userAddress = await this.signer.getAddress();
      return this.userAddress;
    }
    return null;
  }

  async switchNetwork(networkConfig) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${networkConfig.chainId.toString(16)}` }],
      });

      this.networkConfig = networkConfig;
      await this._initializeContracts();
    } catch (error) {
      if (error.code === 4902) {
        // Network not added, try to add it
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${networkConfig.chainId.toString(16)}`,
              chainName: networkConfig.name,
              rpcUrls: [networkConfig.rpcUrl],
              nativeCurrency: {
                name: "ETH",
                symbol: "ETH",
                decimals: 18,
              },
            },
          ],
        });
      } else {
        throw error;
      }
    }
  }

  // Proxy Sweep - forwards ERC20 tokens stuck in UserProxy into savings
  async sweepProxy(tokenAddress) {
    if (!this.savingsContract || !this.signer)
      throw new Error("Contract not initialized");

    const proxyModule = await this._getModuleContract("proxyDeployment");
    const proxyAddress = await proxyModule.getUserProxy(await this.getAddress());
    if (!proxyAddress || proxyAddress === ethers.ZeroAddress) return null;

    const userProxyABI = ["function sweepERC20(address token) external"];
    const proxyContract = new ethers.Contract(
      proxyAddress,
      userProxyABI,
      this.signer,
    );

    const tx = await proxyContract.sweepERC20(tokenAddress);
    await tx.wait();
    return tx.hash;
  }

  async checkAndSweepProxy() {
    try {
      const userAddress = await this.getAddress();
      const proxyModule = await this._getModuleContract("proxyDeployment");
      const isDeployed = await proxyModule.isProxyDeployed(userAddress);
      console.log(
        "🚀 ~ EVMAdapter ~ checkAndSweepProxy ~ isDeployed:",
        isDeployed,
      );
      if (!isDeployed) return;

      const proxyAddress = await proxyModule.getUserProxy(userAddress);
      if (!proxyAddress || proxyAddress === ethers.ZeroAddress) return;
      console.log(
        "🚀 ~ EVMAdapter ~ checkAndSweepProxy ~ proxyAddress:",
        proxyAddress,
      );

      // Verify proxy has code (not an EOA or destroyed contract)
      const code = await this.provider.getCode(proxyAddress);
      if (!code || code === "0x") return;

      const tokens = this.networkConfig.tokens;
      if (!tokens) return;

      const ETH_ZERO = "0x0000000000000000000000000000000000000000";
      for (const [, token] of Object.entries(tokens)) {
        console.log("🚀 ~ EVMAdapter ~ checkAndSweepProxy ~ token:", token);
        if (!token.address || token.address === ETH_ZERO) continue;
        try {
          const tokenContract = new ethers.Contract(
            token.address,
            ["function balanceOf(address) view returns (uint256)"],
            this.provider,
          );
          const balance = await tokenContract.balanceOf(proxyAddress);
          if (balance > 0n) {
            console.log(
              `Sweeping ${ethers.formatUnits(balance, token.decimals)} ${
                token.symbol
              } from proxy`,
            );
            await this.sweepProxy(token.address);
          }
        } catch (error) {
          console.warn(`Failed to sweep ${token.symbol}:`, error.message);
        }
      }
    } catch (error) {
      console.warn("Proxy sweep check failed:", error.message);
    }
  }

  // Balance Management
  async getTokenBalance(userAddress, tokenAddress) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    const balance = await this.savingsContract.getTokenBalance(
      userAddress,
      tokenAddress,
    );
    return balance;
  }

  async getAllBalances(userAddress) {
    if (!this.savingsContract || !userAddress)
      throw new Error("Contract or address not available");

    // Auto-sweep any ERC20 tokens sitting in the user's proxy
    await this.checkAndSweepProxy();

    const balances = {};

    // Skip ETH balance - only fetch stablecoins

    // Fetch token balances
    if (this.networkConfig.tokens) {
      for (const [key, token] of Object.entries(this.networkConfig.tokens)) {
        if (
          token.address &&
          token.address !== "0x0000000000000000000000000000000000000000"
        ) {
          try {
            const tokenBalance = await this.savingsContract.getTokenBalance(
              userAddress,
              token.address,
            );
            // Trim trailing zeros ("200.0" -> "200") to match the vault path
            balances[key] = parseFloat(
              this.formatAmount(tokenBalance, token.decimals),
            ).toString();
          } catch (error) {
            console.error(`Error fetching ${key} balance:`, error);
            balances[key] = "0";
          }
        }
      }
    }

    return balances;
  }

  // Deposit Operations
  async deposit(tokenAddress, amount, tokenDecimals) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    const amountWei = this.parseAmount(amount, tokenDecimals);

    // Check before approving — approve() succeeds regardless of balance, so an
    // unaffordable deposit would otherwise cost a signature and gas before
    // reverting inside the token transfer
    await this._assertWalletBalance(tokenAddress, amountWei);

    // Handle ERC20 approval if not ETH
    if (tokenAddress !== this.ETH_ADDRESS) {
      await this.approveToken(
        tokenAddress,
        this.networkConfig.savingsContract,
        amountWei,
      );
    }

    // Execute deposit
    const depositTx = await this.savingsContract["deposit(address,uint256)"](
      tokenAddress,
      amountWei,
      {
        value: tokenAddress === this.ETH_ADDRESS ? amountWei : 0,
      },
    );

    const receipt = await depositTx.wait();
    return {
      hash: depositTx.hash,
      receipt: receipt,
      success: true,
    };
  }

  async approveToken(tokenAddress, spenderAddress, amount) {
    if (!this.signer) throw new Error("Signer not available");

    const tokenContract = new ethers.Contract(
      tokenAddress,
      MockUSDT_ABI,
      this.signer,
    );
    const approvalTx = await tokenContract.approve(spenderAddress, amount);
    await approvalTx.wait();

    return {
      hash: approvalTx.hash,
      success: true,
    };
  }

  // Withdrawal Operations
  async withdraw(amount, tokenAddress, destination = null) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    const token = !tokenAddress || tokenAddress === this.ETH_ADDRESS ? null : tokenAddress;
    const { symbol, decimals } = await this._resolveTokenMeta(token);
    const rawAmount = this._toBaseUnits(amount, decimals);

    const balance = await this.getTokenBalance(
      this.userAddress,
      token || this.ETH_ADDRESS,
    );
    this._assertSufficientBalance(rawAmount, balance, symbol, decimals);

    let tx;
    if (destination) {
      tx = await this.savingsContract.withdrawTo(
        rawAmount,
        token || this.ETH_ADDRESS,
        destination,
      );
    } else {
      tx = await this.savingsContract.withdraw(rawAmount, token || this.ETH_ADDRESS);
    }

    const receipt = await tx.wait();
    return {
      hash: tx.hash,
      receipt: receipt,
      success: true,
    };
  }

  // Proxy Management
  async isProxyDeployed(userAddress) {
    const proxyModule = await this._getModuleContract("proxyDeployment");
    return await proxyModule.isProxyDeployed(userAddress);
  }

  async getDepositAddress(userAddress) {
    const proxyModule = await this._getModuleContract("proxyDeployment");
    return await proxyModule.getUserDepositAddress(userAddress);
  }

  async getProxyDeploymentFee() {
    const proxyModule = await this._getModuleContract("proxyDeployment");
    return await proxyModule.getProxyDeploymentFee();
  }

  async deployProxy() {
    const proxyModule = await this._getModuleContract("proxyDeployment");

    // Approve USDT fee before deploying
    const fee = await proxyModule.getProxyDeploymentFee();
    if (fee > 0n) {
      const paymentTokenAddress = await proxyModule.paymentToken();
      await this._assertWalletBalance(paymentTokenAddress, fee, "to cover the fee");
      await this.approveToken(paymentTokenAddress, proxyModule.target, fee);
    }

    const tx = await proxyModule.deployUserProxy(this.userAddress);
    const receipt = await tx.wait();

    return {
      hash: tx.hash,
      receipt: receipt,
      success: true,
    };
  }

  // Spending Limits
  async getSpendingLimits(userAddress) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    const limitsModule = await this._getModuleContract("timePeriodLimits");
    const spendingData = await limitsModule.getUserSpendingLimits(userAddress);
    const [names, limits, spent, remaining, durations, active, unlockDelays] = spendingData;

    const resetData = await this._fetchLimitResetTimes(userAddress, names, durations, active);

    const fetchedLimits = [];
    for (let i = 0; i < names.length; i++) {
      fetchedLimits.push({
        name: names[i],
        limit: this.formatAmount(limits[i], 6),
        spent: this.formatAmount(spent[i], 6),
        remaining: Number(this.formatAmount(remaining[i], 6)),
        duration: durations[i].toString(),
        active: active[i],
        resetAt: resetData[i],
        unlockDelay: Number(unlockDelays[i]),
      });
    }

    const isSetupCommitted = await this.getIsSetupCommitted();

    return {
      limits: fetchedLimits,
      isSetupCommitted: isSetupCommitted,
    };
  }

  async _fetchLimitResetTimes(userAddress, names, durations, active) {
    const resetData = [];
    try {
      const limitsModule = await this._getModuleContract("timePeriodLimits");
      for (let i = 0; i < names.length; i++) {
        if (!active[i]) {
          resetData.push(0);
          continue;
        }
        const periodData = await limitsModule.getTimePeriodLimit(userAddress, names[i]);
        const lastReset = Number(periodData.lastReset);
        const duration = Number(durations[i]);
        resetData.push(lastReset + duration);
      }
    } catch {
      return names.map(() => 0);
    }
    return resetData;
  }

  async setSpendingLimits(daily, weekly, monthly) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    const dailyLimitWei = daily > 0 ? this.parseAmount(daily.toString(), 6) : 0;
    const weeklyLimitWei =
      weekly > 0 ? this.parseAmount(weekly.toString(), 6) : 0;
    const monthlyLimitWei =
      monthly > 0 ? this.parseAmount(monthly.toString(), 6) : 0;

    const limitsModule = await this._getModuleContract("timePeriodLimits");
    try {
      const tx = await limitsModule.setCommonPeriodLimits(
        this.userAddress,
        dailyLimitWei,
        weeklyLimitWei,
        monthlyLimitWei,
      );

      const receipt = await tx.wait();
      return {
        hash: tx.hash,
        receipt: receipt,
        success: true,
      };
    } catch (error) {
      if (error.message.includes("Setup committed")) {
        throw new Error("Limits are locked — submit a limit change proposal instead");
      }
      throw error;
    }
  }

  async addSpendingLimit(periodName, limit, unlockDelay = null) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    const limitWei = ethers.parseUnits(limit.toString(), 6);

    const duration = getPeriodDuration(periodName);
    if (!duration) {
      const supported = SPENDING_PERIODS.map((period) => period.name).join(", ");
      throw new Error(`Invalid period name. Must be one of: ${supported}`);
    }

    const limitsModule = await this._getModuleContract("timePeriodLimits");
    const tx = await limitsModule.setPeriodLimit(
      this.userAddress,
      periodName,
      limitWei,
      duration,
      unlockDelay ?? getDefaultUnlockDelay(periodName),
    );

    await tx.wait();
    return tx.hash;
  }

  // Proposal Management
  async proposeLimitChange(periodName, newLimit) {
    if (!this.savingsContract)
      throw new Error("Savings contract not initialized");
    if (!this.userAddress) throw new Error("User not connected");

    const limitWei = ethers.parseUnits(newLimit.toString(), 6);
    const proposalModule = await this._getModuleContract("proposalSystem");
    const tx = await proposalModule.proposeLimitChange(
      this.userAddress,
      periodName,
      limitWei,
    );
    await tx.wait();

    return tx.hash;
  }

  // Fetch pending proposals from the contract
  async fetchPendingProposals(userAddress = null) {
    try {
      if (!this.savingsContract) {
        console.log(
          "❌ Savings contract not available, skipping proposal fetch",
        );
        return [];
      }

      const targetAddress = userAddress || this.userAddress;
      if (!targetAddress) {
        console.log(
          "❌ No user address available for fetching pending proposals",
        );
        return [];
      }

      console.log("📋 Fetching EVM pending proposals from contract...");

      // Call the contract method to get pending proposals
      const [
        proposalIds,
        categories,
        newLimits,
        executeAfters,
        isIncreaseFlags,
        isDelayChangeFlags,
        newUnlockDelays,
      ] = await (await this._getModuleContract("proposalSystem")).getUserPendingProposals(targetAddress);

      console.log(`✅ Found ${proposalIds.length} pending proposals for EVM`);

      const proposals = [];
      const currentTime = Math.floor(Date.now() / 1000);

      // Format the data to match Solana structure
      for (let i = 0; i < proposalIds.length; i++) {
        const executeAfterTimestamp = Number(executeAfters[i]);
        const timeRemaining = Math.max(0, executeAfterTimestamp - currentTime);
        const canExecute = timeRemaining === 0;

        // Convert Wei to human-readable format
        const limitInTokens = parseFloat(ethers.formatUnits(newLimits[i], 6));

        const isDelayChange = isDelayChangeFlags[i];
        const newUnlockDelay = Number(newUnlockDelays[i]);

        proposals.push({
          proposalId: proposalIds[i], // Keep as bytes32 string
          periodName: categories[i],
          newLimit: limitInTokens.toString(),
          executeAfter: executeAfterTimestamp,
          executed: false, // This method only returns pending proposals
          isIncrease: isIncreaseFlags[i],
          isDelayChange,
          newUnlockDelay,
          // The proposal waited out this period's own delay, so that is also
          // how far back it was created
          createdAt: executeAfterTimestamp - (await this.getUnlockDelay(categories[i])),
          action: isDelayChange ? "waitTime" : "change",
          networkType: "evm",
          timeRemaining,
          canExecute,
          timeRemainingText:
            timeRemaining > 0
              ? this.formatTimeRemaining(timeRemaining)
              : "Ready to execute",
        });
      }

      console.log(`📋 Formatted ${proposals.length} EVM proposals for display`);
      return proposals;
    } catch (error) {
      console.error("Error fetching EVM pending proposals:", error);
      return [];
    }
  }

  // Helper function to format time remaining (matching Solana implementation)
  formatTimeRemaining(seconds) {
    if (seconds <= 0) return "Ready to execute";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  // Execute a pending proposal
  async executeLimitProposal(proposalId) {
    try {
      if (!this.savingsContract) {
        throw new Error("Savings contract not initialized");
      }
      if (!this.userAddress) {
        throw new Error("User not connected");
      }

      console.log("🔄 Executing EVM proposal:", proposalId);

      await this._refreshDevChainClock();
      // Call the contract method to execute the proposal
      const proposalModule = await this._getModuleContract("proposalSystem");
      const tx = await proposalModule.executeLimitProposal(this.userAddress, proposalId);
      await tx.wait();

      console.log("✅ EVM proposal executed successfully:", tx.hash);
      return tx.hash;
    } catch (error) {
      console.error("❌ Error executing EVM proposal:", error);
      throw new Error(`Proposal execution failed: ${error.message}`);
    }
  }

  // Cancel a pending proposal
  async cancelLimitProposal(proposalId) {
    try {
      if (!this.savingsContract) {
        throw new Error("Savings contract not initialized");
      }
      if (!this.userAddress) {
        throw new Error("User not connected");
      }

      console.log("🔄 Cancelling EVM proposal:", proposalId);

      // Call the contract method to cancel the proposal
      const proposalModule = await this._getModuleContract("proposalSystem");
      const tx = await proposalModule.cancelLimitProposal(this.userAddress, proposalId);
      await tx.wait();

      console.log("✅ EVM proposal cancelled successfully:", tx.hash);
      return tx.hash;
    } catch (error) {
      console.error("❌ Error cancelling EVM proposal:", error);
      throw new Error(`Proposal cancellation failed: ${error.message}`);
    }
  }

  // Utility Methods
  formatAmount(amount, decimals) {
    return ethers.formatUnits(amount, decimals);
  }

  parseAmount(amount, decimals) {
    return ethers.parseUnits(amount, decimals);
  }

  isValidAddress(address) {
    return ethers.isAddress(address);
  }

  // Network Validation
  async isCorrectNetwork() {
    try {
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      return parseInt(chainId, 16) === this.networkConfig.chainId;
    } catch {
      return false;
    }
  }

  // Setup Operations - Unified Interface
  /**
   * Sets every spending limit and commits setup in a single transaction.
   * @param {Array<{name: string, limit: number, duration: number, unlockDelay: number}>} periods
   *        Periods to activate, in business units. `unlockDelay` is how long a
   *        bypass or limit change for that period must wait, in seconds.
   * @param {string|null} referrer Wallet address that referred the user (optional)
   * @returns {Promise<string>} Transaction hash
   */
  async commitSetup(periods, referrer = null) {
    if (!this.savingsContract) throw new Error("Contract not initialized");
    if (!Array.isArray(periods) || periods.length === 0) {
      throw new Error("Please set at least one spending limit");
    }

    // Contract expects 6 decimal places for USDT-compatible amounts
    const names = periods.map((period) => period.name);
    const limits = periods.map((period) => ethers.parseUnits(period.limit.toString(), 6));
    const durations = periods.map((period) => period.duration);
    const unlockDelays = periods.map((period) => period.unlockDelay);

    // Recording a referrer must never block setup: fall back to no referrer
    // whenever it is unusable (invalid, self, or the module isn't deployed on
    // this network)
    const validReferrer =
      referrer &&
      ethers.isAddress(referrer) &&
      referrer.toLowerCase() !== this.userAddress?.toLowerCase() &&
      (await this._getReferralModule()) !== null
        ? referrer
        : ethers.ZeroAddress;

    const proposalModule = await this._getModuleContract("proposalSystem");
    const tx = await proposalModule.commitSetupWithPeriods(
      names,
      limits,
      durations,
      unlockDelays,
      validReferrer,
    );
    await tx.wait(); // Wait for transaction confirmation

    return tx.hash; // Return consistent format (transaction hash as string)
  }

  /**
   * Propose a new wait time for a period. The change itself serves out the
   * period's current wait before it can be executed.
   * @param {string} periodName Period to retune ("Weekly", "Yearly", ...)
   * @param {number} newUnlockDelay New wait in seconds
   * @returns {Promise<string>} Transaction hash
   */
  async proposeUnlockDelayChange(periodName, newUnlockDelay) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    const proposalModule = await this._getModuleContract("proposalSystem");
    const tx = await proposalModule.proposeUnlockDelayChange(
      this.userAddress,
      periodName,
      newUnlockDelay,
    );
    await tx.wait();
    return tx.hash;
  }

  /** Current wait time for a period, in seconds. */
  async getUnlockDelay(periodName) {
    const limitsModule = await this._getModuleContract("timePeriodLimits");
    const delay = await limitsModule.getUnlockDelay(this.userAddress, periodName);
    return Number(delay);
  }

  // ========== GOVERNANCE ==========

  _governanceConfig() {
    return this.networkConfig.governance || null;
  }

  _labelForTarget(address, moduleNames) {
    if (!address) return "unknown";
    if (address.toLowerCase() === this.networkConfig.savingsContract?.toLowerCase()) {
      return "SavingsCore";
    }
    return moduleNames[address.toLowerCase()] || address;
  }

  /**
   * Reads the upgrade timelock's operation queue and history.
   * @returns {Promise<{enabled: boolean, timelock?: string, multisig?: string,
   *   threshold?: number, signers?: string[], minDelay?: number,
   *   operations: Array<{id: string, targetLabel: string, actionLabel: string,
   *   scheduledAt: number, readyAt: number, status: string}>}>}
   */
  async getGovernanceStatus() {
    const governance = this._governanceConfig();
    if (!governance?.timelock || !this.provider) {
      return { enabled: false, operations: [] };
    }

    try {
      const timelock = new ethers.Contract(governance.timelock, SavingsTimelockABI, this.provider);
      const fromBlock = governance.deployBlock || 0;

      // Resolve module addresses once for target labelling
      const moduleNames = {};
      for (const [key, def] of Object.entries(MODULE_DEFS)) {
        const address = await this.savingsContract.getModule(def.id).catch(() => null);
        if (address && address !== ethers.ZeroAddress) moduleNames[address.toLowerCase()] = key;
      }
      const referralAddress = await this.savingsContract.getModule(REFERRAL_MODULE_ID).catch(() => null);
      if (referralAddress && referralAddress !== ethers.ZeroAddress) moduleNames[referralAddress.toLowerCase()] = "referral";
      const vaultAddress = await this.savingsContract.getModule(VAULT_SYSTEM_MODULE_ID).catch(() => null);
      if (vaultAddress && vaultAddress !== ethers.ZeroAddress) moduleNames[vaultAddress.toLowerCase()] = "vaultSystem";
      const recoveryAddress = await this.savingsContract.getModule(RECOVERY_SYSTEM_MODULE_ID).catch(() => null);
      if (recoveryAddress && recoveryAddress !== ethers.ZeroAddress) moduleNames[recoveryAddress.toLowerCase()] = "recoverySystem";

      const [scheduled, executed, cancelled] = await Promise.all([
        timelock.queryFilter(timelock.filters.CallScheduled(), fromBlock),
        timelock.queryFilter(timelock.filters.CallExecuted(), fromBlock),
        timelock.queryFilter(timelock.filters.Cancelled(), fromBlock),
      ]);
      const executedIds = new Set(executed.map((e) => e.args.id));
      const cancelledIds = new Set(cancelled.map((e) => e.args.id));

      const now = Math.floor(Date.now() / 1000);
      const operations = [];
      for (const event of scheduled) {
        const { id, target, data, delay } = event.args;
        const block = await event.getBlock();
        const scheduledAt = block.timestamp;
        const readyAt = scheduledAt + Number(delay);
        const selector = (data || "0x").slice(0, 10);
        const status = cancelledIds.has(id)
          ? "cancelled"
          : executedIds.has(id)
            ? "executed"
            : now >= readyAt
              ? "ready"
              : "pending";
        operations.push({
          id,
          targetLabel: this._labelForTarget(target, moduleNames),
          actionLabel: GOVERNANCE_CALL_LABELS[selector] || `call ${selector}`,
          scheduledAt,
          readyAt,
          status,
        });
      }
      operations.sort((a, b) => b.scheduledAt - a.scheduledAt);

      // The proposer is expected to be a Gnosis Safe — read its live
      // threshold/owner count for display; tolerate an EOA proposer (dev)
      let threshold = null;
      let signerCount = null;
      if (governance.proposer) {
        try {
          const safeContract = new ethers.Contract(governance.proposer, SAFE_ABI, this.provider);
          threshold = Number(await safeContract.getThreshold());
          signerCount = (await safeContract.getOwners()).length;
        } catch {
          // Not a Safe (EOA proposer during rollout) — displayed as such
        }
      }

      return {
        enabled: true,
        timelock: governance.timelock,
        proposer: governance.proposer,
        threshold,
        signerCount,
        minDelay: governance.minDelay,
        operations,
      };
    } catch (error) {
      console.error("Error reading governance status:", error);
      return { enabled: false, operations: [] };
    }
  }

  // ========== REFERRALS ==========

  async _getReferralModule() {
    if (this.referralModule !== undefined) return this.referralModule;
    if (!this.savingsContract) throw new Error("Contract not initialized");
    try {
      const moduleAddress = await this.savingsContract.getModule(REFERRAL_MODULE_ID);
      this.referralModule =
        moduleAddress && moduleAddress !== ethers.ZeroAddress
          ? new ethers.Contract(moduleAddress, ReferralModuleABI, this.signer)
          : null;
    } catch {
      this.referralModule = null;
    }
    return this.referralModule;
  }

  /**
   * Who referred the given user, if anyone.
   * @returns {Promise<{referrer: string, referredAt: Date}|null>}
   */
  async getReferralInfo(userAddress = null) {
    const module = await this._getReferralModule();
    if (!module) return null;

    const targetAddress = userAddress || this.userAddress;
    const [referrer, referredAt] = await module.getReferrer(targetAddress);
    if (referrer === ethers.ZeroAddress) return null;
    return { referrer, referredAt: new Date(Number(referredAt) * 1000) };
  }

  /**
   * Users the given address has referred.
   * @returns {Promise<{count: number, users: {address: string, joinedAt: Date}[]}>}
   */
  async getReferredUsers(userAddress = null) {
    const module = await this._getReferralModule();
    if (!module) return { count: 0, users: [] };

    const targetAddress = userAddress || this.userAddress;
    const count = Number(await module.getReferralCount(targetAddress));
    const users = [];
    for (let offset = 0; offset < count; offset += REFERRAL_PAGE_SIZE) {
      const [addresses, joinedAt] = await module.getReferredUsers(
        targetAddress,
        offset,
        REFERRAL_PAGE_SIZE,
      );
      for (let i = 0; i < addresses.length; i++) {
        users.push({
          address: addresses[i],
          joinedAt: new Date(Number(joinedAt[i]) * 1000),
        });
      }
    }
    return { count, users };
  }

  // ========== RECOVERY PROTECTION ==========

  async _getRecoveryModule() {
    if (this.recoveryModule !== undefined) return this.recoveryModule;
    if (!this.savingsContract) throw new Error("Contract not initialized");
    try {
      const moduleAddress = await this.savingsContract.getModule(RECOVERY_SYSTEM_MODULE_ID);
      this.recoveryModule =
        moduleAddress && moduleAddress !== ethers.ZeroAddress
          ? new ethers.Contract(moduleAddress, RecoverySystemModuleABI, this.signer)
          : null;
    } catch {
      this.recoveryModule = null;
    }
    return this.recoveryModule;
  }

  async _requireRecoveryModule() {
    const module = await this._getRecoveryModule();
    if (!module) throw this._userError("Recovery protection is not available on this network yet");
    return module;
  }

  // All token addresses the savings account can hold on this network —
  // recovery moves every one of them to the new owner
  _recoveryTokenAddresses() {
    const tokenAddresses = Object.values(this.networkConfig.tokens || {})
      .map((token) => token.address)
      .filter((address) => address && ethers.isAddress(address));
    return [this.ETH_ADDRESS, ...tokenAddresses];
  }

  /**
   * Recovery protection state of an account.
   * @returns {Promise<{supported: boolean, recoveryAddress?: string|null,
   *   isFrozen?: boolean, isRecovered?: boolean,
   *   pendingChange?: {newRecovery: string|null, executeAfter: Date}|null,
   *   isRecoveryKeyFor?: boolean}>}
   */
  async getRecoveryStatus(userAddress = null) {
    const module = await this._getRecoveryModule();
    if (!module) return { supported: false };

    const targetAddress = userAddress || this.userAddress;
    const [recoveryAddress, frozen, recovered] = await module.getRecoveryConfig(targetAddress);
    const [newRecovery, executeAfter, exists] = await module.getPendingRecoveryAddressChange(targetAddress);
    const pendingRecoveryKey = await module.getPendingRecoveryKey(targetAddress);

    return {
      supported: true,
      recoveryAddress: recoveryAddress === ethers.ZeroAddress ? null : recoveryAddress,
      // Proposed key that has not yet proven itself via acceptRecoveryRole
      pendingRecoveryKey: pendingRecoveryKey === ethers.ZeroAddress ? null : pendingRecoveryKey,
      isFrozen: frozen || recovered,
      isRecovered: recovered,
      pendingChange: exists
        ? {
            newRecovery: newRecovery === ethers.ZeroAddress ? null : newRecovery,
            executeAfter: new Date(Number(executeAfter) * 1000),
          }
        : null,
      isRecoveryKeyFor:
        recoveryAddress !== ethers.ZeroAddress &&
        recoveryAddress.toLowerCase() === this.userAddress?.toLowerCase(),
      isProposedRecoveryKeyFor:
        pendingRecoveryKey !== ethers.ZeroAddress &&
        pendingRecoveryKey.toLowerCase() === this.userAddress?.toLowerCase(),
    };
  }

  /** Confirm this wallet as the recovery key someone proposed (activates protection). */
  async acceptRecoveryRole(targetAddress) {
    const module = await this._requireRecoveryModule();
    if (!ethers.isAddress(targetAddress)) throw this._userError("Invalid account address");
    const tx = await module.acceptRecoveryRole(targetAddress);
    await tx.wait();
    return tx.hash;
  }

  /** Withdraw the connected account's own not-yet-accepted proposal. */
  async cancelRecoveryKeyProposal() {
    const module = await this._requireRecoveryModule();
    const tx = await module.cancelRecoveryKeyProposal();
    await tx.wait();
    return tx.hash;
  }

  /** Register the connected account's recovery key (one-time, instant). */
  async setRecoveryAddress(recoveryAddress) {
    const module = await this._requireRecoveryModule();
    if (!ethers.isAddress(recoveryAddress)) throw this._userError("Invalid recovery address");
    const tx = await module.setRecoveryAddress(recoveryAddress);
    await tx.wait();
    return tx.hash;
  }

  /** Freeze an account (own account, or one this wallet is the recovery key for). */
  async freezeAccount(targetAddress = null) {
    const module = await this._requireRecoveryModule();
    const tx = await module.freeze(targetAddress || this.userAddress);
    await tx.wait();
    return tx.hash;
  }

  /** Unfreeze an account — recovery key only. */
  async unfreezeAccount(targetAddress = null) {
    const module = await this._requireRecoveryModule();
    const tx = await module.unfreeze(targetAddress || this.userAddress);
    await tx.wait();
    return tx.hash;
  }

  /** Start the 30-day recovery key change (null removes the key). */
  async requestRecoveryKeyChange(newRecoveryAddress = null) {
    const module = await this._requireRecoveryModule();
    if (newRecoveryAddress && !ethers.isAddress(newRecoveryAddress)) {
      throw this._userError("Invalid recovery address");
    }
    const tx = await module.requestRecoveryAddressChange(newRecoveryAddress || ethers.ZeroAddress);
    await tx.wait();
    return tx.hash;
  }

  async executeRecoveryKeyChange() {
    const module = await this._requireRecoveryModule();
    const tx = await module.executeRecoveryAddressChange();
    await tx.wait();
    return tx.hash;
  }

  /** Veto a pending recovery key change (own account or as recovery key). */
  async cancelRecoveryKeyChange(targetAddress = null) {
    const module = await this._requireRecoveryModule();
    const tx = await module.cancelRecoveryAddressChange(targetAddress || this.userAddress);
    await tx.wait();
    return tx.hash;
  }

  /**
   * Move a compromised account to a fresh address — recovery key only.
   * Transfers every known token balance and permanently disables the old
   * account.
   */
  async recoverAccount(targetAddress, newOwnerAddress) {
    const module = await this._requireRecoveryModule();
    if (!ethers.isAddress(targetAddress)) throw this._userError("Invalid account address");
    if (!ethers.isAddress(newOwnerAddress)) throw this._userError("Invalid new owner address");
    const tx = await module.recoverOwnership(
      targetAddress,
      newOwnerAddress,
      this._recoveryTokenAddresses(),
    );
    await tx.wait();
    return tx.hash;
  }

  // Private Methods
  async _initializeContracts() {
    if (!this.signer || !this.networkConfig.savingsContract) return;

    // Drop caches tied to the previous network/signer
    this.vaultModule = null;
    this.referralModule = undefined;
    this.recoveryModule = undefined;
    this._moduleContracts = {};
    this._tokenMetaCache = null;

    // Initialize savings contract (custody kernel + module registry)
    this.savingsContract = new ethers.Contract(
      this.networkConfig.savingsContract,
      SavingsABI,
      this.signer,
    );

    // Kept for backward compatibility with existing call sites
    try {
      this.proxyDeploymentModule = await this._getModuleContract("proxyDeployment");
    } catch (e) {
      console.warn("Could not initialize ProxyDeploymentModule:", e.message);
    }
  }

  /**
   * Hardhat only mines blocks when transactions arrive, and gas estimation
   * runs against the latest block's timestamp — so on an idle local chain a
   * timelock that has elapsed in wall-clock time still fails estimation.
   * Mine one block through a direct RPC connection (MetaMask rejects
   * non-standard methods) to refresh the chain clock. No-op elsewhere.
   */
  async _refreshDevChainClock() {
    if (this.networkConfig.chainId !== 31337) return;
    try {
      const rpcUrl = this.networkConfig.rpcUrls?.[0];
      if (!rpcUrl) return;
      const rpc = new ethers.JsonRpcProvider(rpcUrl);
      await rpc.send("evm_mine", []);
    } catch {
      // Not a dev chain after all — estimation will report the real state
    }
  }

  /** Resolve a user-facing module contract through the core registry (cached). */
  async _getModuleContract(key) {
    if (!this._moduleContracts) this._moduleContracts = {};
    if (this._moduleContracts[key]) return this._moduleContracts[key];
    if (!this.savingsContract) throw new Error("Contract not initialized");

    const def = MODULE_DEFS[key];
    if (!def) throw new Error(`Unknown module: ${key}`);
    const moduleAddress = await this.savingsContract.getModule(def.id);
    if (!moduleAddress || moduleAddress === ethers.ZeroAddress) {
      throw new Error(`${key} module is not registered on this network`);
    }
    this._moduleContracts[key] = new ethers.Contract(moduleAddress, def.abi, this.signer);
    return this._moduleContracts[key];
  }

  // Bypass Requests (unified adapter pattern)
  async fetchPendingBypassRequests(userAddress = null) {
    const bypassModule = await this._getModuleContract("bypassSystem");
    const targetAddress = userAddress || this.userAddress;
    const bypassData = await bypassModule.getUserActiveBypassRequests(targetAddress);
    const [requestIds, amounts, skipPeriods, tokens, executeAfters] =
      bypassData;

    const requests = [];
    for (let i = 0; i < requestIds.length; i++) {
      requests.push({
        requestId: requestIds[i],
        amount: this.formatAmount(amounts[i], 6), // Format to USDT units
        skipPeriod: skipPeriods[i],
        token: tokens[i],
        executeAfter: executeAfters[i].toString(),
      });
    }

    return requests;
  }

  async requestLimitBypass(amountRaw, skipPeriod, tokenAddress) {
    const bypassModule = await this._getModuleContract("bypassSystem");
    const tx = await bypassModule.requestLimitBypass(
      this.userAddress,
      amountRaw,
      skipPeriod,
      tokenAddress,
    );
    await tx.wait();
    return tx.hash;
  }

  async executeBypassWithdrawal(requestId) {
    await this._refreshDevChainClock();
    const bypassModule = await this._getModuleContract("bypassSystem");
    const tx = await bypassModule.executeBypassWithdrawal(this.userAddress, requestId);
    await tx.wait();
    return tx.hash;
  }

  async cancelBypassRequest(requestId) {
    const bypassModule = await this._getModuleContract("bypassSystem");
    const tx = await bypassModule.cancelBypassRequest(this.userAddress, requestId);
    await tx.wait();
    return tx.hash;
  }

  // Withdrawal Destination Requests (unified adapter pattern)
  async getPendingWithdrawalDestinationRequests(userAddress = null) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    const targetAddress = userAddress || (await this.getAddress());

    try {
      console.log(
        "🔍 EVMAdapter: Fetching withdrawal destination requests for",
        targetAddress,
      );
      const approvalModule = await this._getModuleContract("approvalSystem");
      const result = await approvalModule.getUserPendingWithdrawalRequests(targetAddress);
      return this.formatWithdrawalRequests(result);
    } catch (error) {
      console.error(
        "❌ EVMAdapter: Error fetching withdrawal destination requests:",
        error,
      );
      return [];
    }
  }

  // Withdrawal Address Management (unified adapter interface)
  async fetchWithdrawalAddresses(userAddress = null) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    try {
      const approvalModule = await this._getModuleContract("approvalSystem");
      const result = await approvalModule.getUserWithdrawalAddresses(
        userAddress || this.userAddress,
      );
      return this.formatWithdrawalAddresses(result);
    } catch (error) {
      console.error(
        "❌ EVMAdapter: Error fetching withdrawal addresses:",
        error,
      );
      return [];
    }
  }

  async addWithdrawalDestination(address, title) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    try {
      // Check if contract is locked by getting setup committed status
      console.log("🔍 EVMAdapter: Checking setup committed status...");
      const isSetupCommitted = await this.getIsSetupCommitted();
      console.log(
        `📊 EVMAdapter: isSetupCommitted() returned: ${isSetupCommitted}`,
      );
      console.log(
        `📊 Contract lock status: ${isSetupCommitted ? "LOCKED" : "UNLOCKED"}`,
      );

      if (isSetupCommitted) {
        // Contract is locked - use timelock pattern for security
        console.log("🔒 Contract is locked, using timelock request...");
        return await this.requestWithdrawalDestinationAddition(address, title);
      } else {
        // Contract is unlocked - add directly without timelock
        console.log("🔓 Contract is unlocked, adding directly...");
        console.log(
          `🔧 Calling addWithdrawalDestinationDirect(${address}, ${title})`,
        );
        return await this.addWithdrawalDestinationDirect(address, title);
      }
    } catch (error) {
      console.error("❌ Error in addWithdrawalDestination:", error);
      console.error("❌ Error stack:", error.stack);
      // Fallback to timelock pattern for safety
      console.log("⚠️ Falling back to timelock pattern for safety");
      return await this.requestWithdrawalDestinationAddition(address, title);
    }
  }

  async requestWithdrawalDestinationAddition(address, title) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    try {
      const approvalModule = await this._getModuleContract("approvalSystem");
      const tx = await approvalModule.requestWithdrawalAddress(
        this.userAddress,
        title,
        address,
      );
      await tx.wait();
      console.log(
        `✅ Requested withdrawal address: ${title} -> ${address} (tx: ${tx.hash})`,
      );
      return tx.hash;
    } catch (error) {
      console.error(
        "❌ EVMAdapter: Error requesting withdrawal address:",
        error,
      );
      throw error;
    }
  }

  async addWithdrawalDestinationDirect(address, title) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    try {
      console.log(
        `🔧 EVMAdapter: Calling contract.addWithdrawalAddressDirect("${title}", "${address}")`,
      );
      const approvalModule = await this._getModuleContract("approvalSystem");
      const tx = await approvalModule.addWithdrawalAddressDirect(
        this.userAddress,
        title,
        address,
      );
      console.log(`📋 EVMAdapter: Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(
        `✅ Added withdrawal address directly: ${title} -> ${address} (tx: ${tx.hash})`,
      );
      return tx.hash;
    } catch (error) {
      console.error(
        "❌ EVMAdapter: Error adding withdrawal address directly:",
        error,
      );
      console.error("❌ EVMAdapter: Direct add error details:", error.message);
      if (error.reason)
        console.error("❌ EVMAdapter: Contract revert reason:", error.reason);
      throw error;
    }
  }

  async executeWithdrawalAddressRequest(requestId) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    try {
      await this._refreshDevChainClock();
      const approvalModule = await this._getModuleContract("approvalSystem");
      const tx = await approvalModule.executeWithdrawalAddressRequest(
        this.userAddress,
        requestId,
      );
      await tx.wait();
      console.log(
        `✅ Executed withdrawal address request: ${requestId} (tx: ${tx.hash})`,
      );
      return tx.hash;
    } catch (error) {
      console.error(
        "❌ EVMAdapter: Error executing withdrawal address request:",
        error,
      );
      throw error;
    }
  }

  async cancelWithdrawalAddressRequest(requestId) {
    const approvalModule = await this._getModuleContract("approvalSystem");
    const tx = await approvalModule.cancelWithdrawalAddressRequest(this.userAddress, requestId);
    await tx.wait();
    return tx.hash;
  }

  async removeWithdrawalAddress(destination) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    try {
      const approvalModule = await this._getModuleContract("approvalSystem");
      const tx = await approvalModule.removeWithdrawalAddress(
        this.userAddress,
        destination,
      );
      await tx.wait();
      console.log(
        `✅ Removed withdrawal address: ${destination} (tx: ${tx.hash})`,
      );
      return tx.hash;
    } catch (error) {
      console.error("❌ EVMAdapter: Error removing withdrawal address:", error);
      throw error;
    }
  }

  async getIsSetupCommitted(userAddress = null) {
    try {
      console.log("🔍 EVMAdapter: Calling isSetupCommitted()...");
      const proposalModule = await this._getModuleContract("proposalSystem");
      const result = await proposalModule.isSetupCommitted(userAddress || this.userAddress);
      console.log(
        `🔍 EVMAdapter: Contract returned isSetupCommitted: ${result}`,
      );
      return result;
    } catch (error) {
      console.error(
        "❌ EVMAdapter: Error checking setup committed status:",
        error,
      );
      console.error("❌ EVMAdapter: Setup check error details:", error.message);
      return false;
    }
  }

  // Data formatting helpers
  formatWithdrawalAddresses(contractResult) {
    const [titles, destinations, timestamps] = contractResult;
    return titles.map((title, index) => ({
      title,
      destination: destinations[index],
      addedAt: Number(timestamps[index]),
      active: true, // All returned addresses are active
    }));
  }

  formatWithdrawalRequests(contractResult) {
    const [requestIds, titles, destinations, executeAfters] = contractResult;
    return requestIds.map((requestId, index) => ({
      requestId,
      title: titles[index],
      destination: destinations[index],
      executeAfter: Number(executeAfters[index]),
      timeRemaining: Math.max(
        0,
        Number(executeAfters[index]) - Math.floor(Date.now() / 1000),
      ),
    }));
  }

  // Getters for backward compatibility
  getContract() {
    return this.savingsContract;
  }

  getSigner() {
    return this.signer;
  }

  getProvider() {
    return this.provider;
  }

  // ========== POOL TOGETHER ==========

  async depositToPoolTogether(tokenAddress, amount) {
    const poolModule = await this._getModuleContract("poolTogether");
    const tx = await poolModule.depositToVault(this.userAddress, tokenAddress, amount);
    await tx.wait();
    return tx.hash;
  }

  async withdrawFromPoolTogether(tokenAddress, shares) {
    const poolModule = await this._getModuleContract("poolTogether");
    const tx = await poolModule.withdrawFromVault(this.userAddress, tokenAddress, shares);
    await tx.wait();
    return tx.hash;
  }

  async getPoolTogetherBalance(tokenAddress) {
    const poolModule = await this._getModuleContract("poolTogether");
    const shares = await poolModule.getUserVaultShares(this.userAddress, tokenAddress);
    const assets = await poolModule.getUserVaultBalance(this.userAddress, tokenAddress);
    return { shares, assets };
  }

  async getPoolTogetherGrandPrize() {
    const poolModule = await this._getModuleContract("poolTogether");
    return await poolModule.getGrandPrize();
  }

  async hasPoolTogetherVault(tokenAddress) {
    const poolModule = await this._getModuleContract("poolTogether");
    return await poolModule.hasVault(tokenAddress);
  }

  async claimPoolTogetherPrize(tokenAddress, tier = 3) {
    const poolModule = await this._getModuleContract("poolTogether");
    const tx = await poolModule.claimPrize(this.userAddress, tokenAddress, tier);
    await tx.wait();
    return tx.hash;
  }

  // ========== VAULTS ==========

  async _getVaultModule() {
    if (this.vaultModule) return this.vaultModule;
    if (!this.savingsContract) throw new Error("Contract not initialized");
    const moduleAddress = await this.savingsContract.getModule(VAULT_SYSTEM_MODULE_ID);
    if (moduleAddress === ethers.ZeroAddress) {
      throw new Error("Vaults are not available on this network yet");
    }
    this.vaultModule = new ethers.Contract(moduleAddress, VaultSystemModuleABI, this.signer);
    return this.vaultModule;
  }

  /**
   * Resolve token symbol/decimals, falling back to the token contract itself
   * for tokens missing from the network config (e.g. custom vault tokens) —
   * a wrong-decimals fallback would misprice every amount by orders of magnitude.
   */
  async _resolveTokenMeta(tokenAddress) {
    const meta = getTokenMeta(this.networkConfig, tokenAddress);
    if (!tokenAddress || meta.symbol !== "TOKEN") return meta;

    if (!this._tokenMetaCache) this._tokenMetaCache = {};
    if (this._tokenMetaCache[tokenAddress]) return this._tokenMetaCache[tokenAddress];

    const token = new ethers.Contract(tokenAddress, ERC20ABI, this.provider);
    const decimals = Number(await token.decimals());
    const symbol = await token.symbol().catch(() => "TOKEN");
    const resolved = { symbol, decimals, isNative: false };
    this._tokenMetaCache[tokenAddress] = resolved;
    return resolved;
  }

  _mapVault(vaultId, raw, meta) {
    const token = raw.token === ethers.ZeroAddress ? null : raw.token;
    return {
      address: vaultId.toString(),
      creator: raw.creator,
      vaultType: VAULT_TYPE_NAMES[Number(raw.vaultType)] || "Personal",
      tokenMint: token,
      isNativeToken: meta.isNative,
      tokenSymbol: meta.symbol,
      tokenDecimals: meta.decimals,
      name: raw.name,
      description: raw.description,
      dailyLimit: Number(raw.dailyLimit),
      weeklyLimit: Number(raw.weeklyLimit),
      monthlyLimit: Number(raw.monthlyLimit),
      limitsArePercentage: raw.limitsArePercentage,
      penaltyRateBps: Number(raw.penaltyRateBps),
      memberCount: Number(raw.memberCount),
      totalBalance: Number(raw.totalBalance),
      accumulatedPenalty: Number(raw.accPenaltyPerShare),
      isActive: raw.isActive,
      createdAt: Number(raw.createdAt),
      updatedAt: Number(raw.updatedAt),
    };
  }

  _mapVaultMember(vaultId, memberAddress, raw) {
    return {
      vault: vaultId.toString(),
      member: memberAddress,
      balance: Number(raw.balance),
      dailySpent: Number(raw.dailySpent),
      dailyLastReset: Number(raw.dailyLastReset),
      weeklySpent: Number(raw.weeklySpent),
      weeklyLastReset: Number(raw.weeklyLastReset),
      monthlySpent: Number(raw.monthlySpent),
      monthlyLastReset: Number(raw.monthlyLastReset),
      penaltyDebt: Number(raw.penaltyDebt),
      unclaimedPenalties: Number(raw.unclaimedPenalties),
      joinedAt: Number(raw.joinedAt),
    };
  }

  _toBaseUnits(amount, decimals) {
    // toFixed avoids scientific notation ("1e-7") and over-precise input,
    // both of which parseUnits rejects
    return ethers.parseUnits(Number(amount).toFixed(decimals), decimals);
  }

  /**
   * What the connected wallet actually holds, as opposed to what it has saved.
   * Deposits fail inside the ERC20 transfer otherwise, which reads as a
   * contract bug rather than "you don't have that much".
   */
  async _assertWalletBalance(tokenAddress, rawAmount, suffix = "") {
    const isNative = !tokenAddress || tokenAddress === this.ETH_ADDRESS;
    const { symbol, decimals } = await this._resolveTokenMeta(isNative ? null : tokenAddress);

    const balance = isNative
      ? await this.provider.getBalance(this.userAddress)
      : await new ethers.Contract(tokenAddress, ERC20ABI, this.provider).balanceOf(
          this.userAddress,
        );

    this._assertSufficientBalance(
      rawAmount,
      balance,
      symbol,
      decimals,
      suffix ? `your wallet ${suffix}` : "your wallet",
    );
  }

  _toRawLimit(value, limitsArePercentage, decimals) {
    if (!value || value <= 0) return 0n;
    if (limitsArePercentage) return BigInt(Math.round(value * 100)); // percent -> bps
    return this._toBaseUnits(value, decimals);
  }

  async createVault({
    name,
    description = "",
    vaultType = "Personal",
    tokenMint = null,
    dailyLimit = 0,
    weeklyLimit = 0,
    monthlyLimit = 0,
    penaltyRateBps = 2000,
    limitsArePercentage = false,
  }) {
    const vaultModule = await this._getVaultModule();
    const token = tokenMint || ethers.ZeroAddress;
    const { decimals } = await this._resolveTokenMeta(tokenMint);

    const tx = await vaultModule.createVault({
      name,
      description,
      vaultType: vaultType === "Community" ? 1 : 0,
      token,
      dailyLimit: this._toRawLimit(dailyLimit, limitsArePercentage, decimals),
      weeklyLimit: this._toRawLimit(weeklyLimit, limitsArePercentage, decimals),
      monthlyLimit: this._toRawLimit(monthlyLimit, limitsArePercentage, decimals),
      limitsArePercentage,
      penaltyRateBps,
    });
    const receipt = await tx.wait();

    let vaultId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = vaultModule.interface.parseLog(log);
        if (parsed?.name === "VaultCreated") {
          vaultId = parsed.args.vaultId.toString();
          break;
        }
      } catch {
        // Log from another contract — ignore
      }
    }
    if (!vaultId) throw new Error("Vault creation event not found");
    return { signature: tx.hash, vaultAddress: vaultId };
  }

  async joinVault(vaultAddress) {
    const vaultModule = await this._getVaultModule();
    const tx = await vaultModule.joinVault(vaultAddress);
    await tx.wait();
    return tx.hash;
  }

  async leaveVault(vaultAddress) {
    const vaultModule = await this._getVaultModule();
    const tx = await vaultModule.leaveVault(vaultAddress);
    await tx.wait();
    return tx.hash;
  }

  async updateVaultRules(vaultAddress, rules = {}) {
    const vaultModule = await this._getVaultModule();
    // Merge against the raw on-chain values so untouched limits keep their
    // exact stored amounts (Number round-trips lose wei-level precision).
    const current = await vaultModule.getVault(vaultAddress);

    const limitsArePercentage = rules.limitsArePercentage ?? current.limitsArePercentage;
    if (
      limitsArePercentage !== current.limitsArePercentage &&
      (rules.dailyLimit == null || rules.weeklyLimit == null || rules.monthlyLimit == null)
    ) {
      // Stored raw limits are meaningless under the other mode, so a mode
      // switch must respecify every limit
      throw this._userError("Provide daily, weekly and monthly limits when changing the limit type");
    }
    const token = current.token === ethers.ZeroAddress ? null : current.token;
    const { decimals } = await this._resolveTokenMeta(token);
    const mergeLimit = (value, rawCurrent) =>
      value != null ? this._toRawLimit(value, limitsArePercentage, decimals) : rawCurrent;

    const tx = await vaultModule.updateVaultRules(
      vaultAddress,
      mergeLimit(rules.dailyLimit, current.dailyLimit),
      mergeLimit(rules.weeklyLimit, current.weeklyLimit),
      mergeLimit(rules.monthlyLimit, current.monthlyLimit),
      limitsArePercentage,
      rules.penaltyRateBps ?? current.penaltyRateBps
    );
    await tx.wait();
    return tx.hash;
  }

  async depositToVault(vaultAddress, amount) {
    const vaultModule = await this._getVaultModule();
    const vault = await this.getVaultInfo(vaultAddress);
    if (!vault) throw this._userError("Vault not found");

    const rawAmount = this._toBaseUnits(amount, vault.tokenDecimals);
    if (vault.isNativeToken) {
      const tx = await vaultModule.deposit(vaultAddress, rawAmount, { value: rawAmount });
      await tx.wait();
      return tx.hash;
    }

    const token = new ethers.Contract(vault.tokenMint, ERC20ABI, this.signer);
    const moduleAddress = await vaultModule.getAddress();
    const allowance = await token.allowance(this.userAddress, moduleAddress);
    if (allowance < rawAmount) {
      if (allowance > 0n) {
        // Tokens like USDT reject raising a non-zero allowance directly
        const resetTx = await token.approve(moduleAddress, 0);
        await resetTx.wait();
      }
      const approveTx = await token.approve(moduleAddress, rawAmount);
      await approveTx.wait();
    }
    const tx = await vaultModule.deposit(vaultAddress, rawAmount);
    await tx.wait();
    return tx.hash;
  }

  async _withdrawFromVault(vaultAddress, amount, withPenalty) {
    const vaultModule = await this._getVaultModule();
    const vault = await this.getVaultInfo(vaultAddress);
    if (!vault) throw this._userError("Vault not found");

    const rawAmount = this._toBaseUnits(amount, vault.tokenDecimals);
    const membership = await this.getVaultMemberInfo(vaultAddress);
    if (!membership) throw this._userError("You are not a member of this vault");
    this._assertSufficientBalance(
      rawAmount,
      membership.balance,
      vault.tokenSymbol,
      vault.tokenDecimals,
    );

    const tx = withPenalty
      ? await vaultModule.withdrawWithPenalty(vaultAddress, rawAmount)
      : await vaultModule.withdraw(vaultAddress, rawAmount);
    await tx.wait();
    return tx.hash;
  }

  async withdrawFromVault(vaultAddress, amount) {
    return this._withdrawFromVault(vaultAddress, amount, false);
  }

  async withdrawFromVaultWithPenalty(vaultAddress, amount) {
    return this._withdrawFromVault(vaultAddress, amount, true);
  }

  async claimVaultPenaltyRewards(vaultAddress) {
    const vaultModule = await this._getVaultModule();
    const tx = await vaultModule.claimPenaltyRewards(vaultAddress);
    await tx.wait();
    return tx.hash;
  }

  // ---- Permanent per-vault deposit addresses ----

  async getVaultDepositAddress(vaultId) {
    const vaultModule = await this._getVaultModule();
    const address = await vaultModule.getVaultDepositAddress(vaultId);
    return address === ethers.ZeroAddress ? null : address;
  }

  async deployVaultDepositAddress(vaultId) {
    const vaultModule = await this._getVaultModule();
    const tx = await vaultModule.deployVaultDepositAddress(vaultId);
    await tx.wait();
    return this.getVaultDepositAddress(vaultId);
  }

  /** Forward any funds sitting on the vault's deposit address into the vault. */
  async checkAndSweepVaultProxy(vaultId) {
    try {
      const proxyAddress = await this.getVaultDepositAddress(vaultId);
      if (!proxyAddress) return;
      const vault = await this.getVaultInfo(vaultId);
      if (!vault) return;

      const proxy = new ethers.Contract(
        proxyAddress,
        ["function sweepETH() external", "function sweepERC20(address token) external"],
        this.signer,
      );

      if (vault.isNativeToken) {
        // receive() forwards ETH automatically; sweep only catches strays
        const balance = await this.provider.getBalance(proxyAddress);
        if (balance > 0n) await (await proxy.sweepETH()).wait();
      } else {
        const token = new ethers.Contract(vault.tokenMint, ERC20ABI, this.provider);
        const balance = await token.balanceOf(proxyAddress);
        if (balance > 0n) await (await proxy.sweepERC20(vault.tokenMint)).wait();
      }
    } catch (error) {
      console.warn("Vault proxy sweep check failed:", error.message);
    }
  }

  async getVaultInfo(vaultAddress) {
    const vaultModule = await this._getVaultModule();
    let raw;
    try {
      raw = await vaultModule.getVault(vaultAddress);
    } catch {
      // getVault reverts with "Vault not found" for unknown ids
      return null;
    }
    const token = raw.token === ethers.ZeroAddress ? null : raw.token;
    const meta = await this._resolveTokenMeta(token);
    return this._mapVault(vaultAddress, raw, meta);
  }

  async getVaultMemberInfo(vaultAddress, memberAddress = null) {
    const vaultModule = await this._getVaultModule();
    const member = memberAddress || this.userAddress;
    const raw = await vaultModule.getVaultMember(vaultAddress, member);
    if (!raw.exists) return null;
    return this._mapVaultMember(vaultAddress, member, raw);
  }

  async getUserVaults() {
    const vaultModule = await this._getVaultModule();
    const vaultIds = await vaultModule.getUserVaultIds(this.userAddress);

    const results = [];
    for (const vaultId of vaultIds) {
      const vault = await this.getVaultInfo(vaultId.toString());
      const membership = await this.getVaultMemberInfo(vaultId.toString());
      if (vault && membership) {
        results.push({ vault, membership });
      }
    }
    return results;
  }

  async discoverVaults({ tokenMint = null, vaultType = null } = {}) {
    const vaultModule = await this._getVaultModule();
    const count = Number(await vaultModule.getVaultCount());

    const vaults = [];
    for (let vaultId = 1; vaultId <= count; vaultId++) {
      const vault = await this.getVaultInfo(vaultId.toString());
      if (!vault || !vault.isActive) continue;
      if (vaultType && vault.vaultType !== vaultType) continue;
      if (tokenMint && vault.tokenMint !== tokenMint) continue;
      vaults.push(vault);
    }
    return vaults;
  }

  async getVaultMembers(vaultAddress) {
    const vaultModule = await this._getVaultModule();
    const addresses = await vaultModule.getVaultMembers(vaultAddress);

    const members = [];
    for (const address of addresses) {
      const membership = await this.getVaultMemberInfo(vaultAddress, address);
      if (membership) members.push(membership);
    }
    return members;
  }
}
