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
import SavingsVaultModuleABI from "../SavingsVaultModuleABI.json";
import VaultDepositAddressModuleABI from "../VaultDepositAddressModuleABI.json";
import VaultYieldModuleABI from "../VaultYieldModuleABI.json";
import SavingsTimelockABI from "../SavingsTimelockABI.json";
import ReferralModuleABI from "../ReferralModuleABI.json";
import RecoverySystemModuleABI from "../RecoverySystemModuleABI.json";
import VaultRulesModuleABI from "../VaultRulesModuleABI.json";
import ERC20ABI from "../ERC20ABI.json";
import { getTokenMeta } from "../utils/tokenUtils.js";
import {
  SPENDING_PERIODS,
  getPeriodDuration,
  getDefaultUnlockDelay,
} from "../utils/spendingPeriods.js";
import { aprBpsToApyPercent, netApyPercent } from "../utils/yieldMath.js";

const SAVINGS_VAULTS_MODULE_ID = ethers.keccak256(ethers.toUtf8Bytes("SAVINGS_VAULTS"));
const REFERRAL_MODULE_ID = ethers.keccak256(ethers.toUtf8Bytes("REFERRAL"));
const RECOVERY_SYSTEM_MODULE_ID = ethers.keccak256(ethers.toUtf8Bytes("RECOVERY_SYSTEM"));

// Earning modes, mirroring YieldInterfaces.sol. The numbers stay inside this
// adapter — components only ever see the string names.
const YIELD_MODES = { off: 1, stable: 2, prize: 3 };

const YIELD_MODE_NAMES = { 0: "off", 1: "off", 2: "stable", 3: "prize" };

// User-facing modules are called directly (Pattern B): each authenticates the
// caller via msg.sender, so no calls route through SavingsCore forwarders
const MODULE_DEFS = {
  timePeriodLimits: { id: ethers.keccak256(ethers.toUtf8Bytes("TIME_PERIOD_LIMITS")), abi: TimePeriodLimitsModuleABI },
  proposalSystem: { id: ethers.keccak256(ethers.toUtf8Bytes("PROPOSAL_SYSTEM")), abi: ProposalSystemModuleABI },
  bypassSystem: { id: ethers.keccak256(ethers.toUtf8Bytes("BYPASS_SYSTEM")), abi: BypassSystemModuleABI },
  approvalSystem: { id: ethers.keccak256(ethers.toUtf8Bytes("APPROVAL_SYSTEM")), abi: ApprovalSystemModuleABI },
  proxyDeployment: { id: ethers.keccak256(ethers.toUtf8Bytes("PROXY_DEPLOYMENT")), abi: ProxyDeploymentModuleABI },
  poolTogether: { id: ethers.keccak256(ethers.toUtf8Bytes("POOL_TOGETHER")), abi: PoolTogetherModuleABI },
  // Vault rule changes moved out of the vault module: that contract custodies
  // funds and had reached the 24KB ceiling, so everything not needing custody
  // lives here instead — the same split the savings account already uses.
  vaultRules: { id: ethers.keccak256(ethers.toUtf8Bytes("VAULT_RULES")), abi: VaultRulesModuleABI },
  // Deploying a member's permanent deposit address means holding the proxy's
  // whole creation code, which is 2.7KB the custody module cannot spare.
  vaultDepositAddresses: {
    id: ethers.keccak256(ethers.toUtf8Bytes("VAULT_DEPOSIT_ADDRESSES")),
    abi: VaultDepositAddressModuleABI,
  },
  vaultYield: { id: ethers.keccak256(ethers.toUtf8Bytes("VAULT_YIELD")), abi: VaultYieldModuleABI },
};

// What a vault holds, and therefore how its limits read. Mirrors
// SavingsVaultModule; the numbers never leave this adapter.
const VAULT_KINDS = { coin: 0, stables: 1 };
const VAULT_KIND_NAMES = { 0: "Coin", 1: "Stables" };

// A stables vault's cap is in dollars, and every pegged coin is restated into
// them by dividing out its decimals — so the cap needs no price feed, and this
// is the scale it is kept at.
const DOLLAR_DECIMALS = 6;
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
  ["Exceeds limit", "This is over one of your spending limits — request a bypass to withdraw it"],

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
  // Vault protections
  ["Withdrawal address not approved", "That address is not on your saved withdrawal list"],
  ["Limits module not registered", "Spending limits are not set up on this network yet"],
  ["Proposal module not registered", "Rule changes are not set up on this network yet"],
  ["Bypass module not registered", "Bypasses are not set up on this network yet"],
  ["Invalid destination", "Choose a withdrawal address"],
  ["Not a vault member", "You are not a member of this vault"],
  // The unified vault: what a vault holds is what it accepts, and a limit can
  // only mean what its kind allows.
  ["Token not accepted here", "This vault does not hold that coin"],
  ["Community coins immutable", "A community vault's coins are fixed once anyone has joined"],
  ["Native coin belongs in its own vault", "A stablecoins vault cannot hold a coin whose value moves"],
  ["Duplicate token", "That coin is already in this vault"],
  ["Too many tokens", "This vault already holds as many coins as it can"],
  ["Coin vault takes one token", "A vault for a single coin takes exactly one coin"],
  ["Stables vault uses dollar limits", "A stablecoins vault caps dollars, not a percentage"],
  ["Not the vault creator", "Only the vault's creator can do this"],
  ["Rewards not claimed", "Claim your share of the penalties before leaving the vault"],
  ["Request not found", "That request no longer exists"],
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

  // Earning on savings. Longer strings come first so they are not shadowed by
  // a shorter one they contain.
  ["Insufficient strategy liquidity", "The savings protocol is temporarily out of liquidity — try a smaller amount, or try again shortly"],
  ["Yield module not configured", "Earning on savings is not switched on for this network yet"],
  ["Strategy deposit shortfall", "The savings protocol short-changed the deposit, so it was rejected — your funds stayed in your vault"],
  ["Strategy controller mismatch", "That earning strategy is not controlled by this wallet's contracts"],
  ["Strategy asset mismatch", "That earning strategy does not match this vault's coin"],
  ["Yield module not configured", "Earning on savings is not switched on for this network yet"],
  ["Strategy mode mismatch", "That earning strategy does not match the chosen option"],
  ["Strategy change not queued", "That strategy change has not been queued yet"],
  ["Strategy change not ready", "That strategy change is still in its waiting period"],
  ["Community yield immutable", "A community vault's earning setting is fixed when it is created"],
  ["Pending yield not zero", "Collect your earnings before leaving the vault"],
  ["Yield mode unchanged", "That is already your setting"],
  ["No strategy for token", "This vault's token cannot earn yield yet"],
  ["Strategies paused", "Earning is paused right now — your savings are untouched"],
  ["Fee above maximum", "That fee is above the allowed maximum"],
  ["Nothing invested", "This vault has nothing invested"],

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
  addVaultToken: "Could not add that coin to the vault",
  updateVaultRules: "Could not propose the vault rule change",
  executeVaultRuleChange: "Could not apply the vault rule change",
  cancelVaultRuleChange: "Could not cancel the vault rule change",
  requestVaultBypass: "Could not request the bypass",
  executeVaultBypass: "Could not execute the bypass",
  cancelVaultBypass: "Could not cancel the bypass request",
  depositToVault: "Deposit failed",
  withdrawFromVault: "Withdrawal failed",
  withdrawFromVaultWithPenalty: "Withdrawal failed",
  claimVaultPenaltyRewards: "Could not claim your rewards",
  deployVaultDepositAddress: "Could not create the vault deposit address",
  setYieldMode: "Could not change how your savings earn",
  compoundVaultYield: "Could not add your earnings to your balance",
  claimVaultPrizes: "Could not claim your winnings",
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
      const vaultAddress = await this.savingsContract.getModule(SAVINGS_VAULTS_MODULE_ID).catch(() => null);
      if (vaultAddress && vaultAddress !== ethers.ZeroAddress) moduleNames[vaultAddress.toLowerCase()] = "savingsVaults";
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
   * How many users the given address has referred. Only the count is available
   * on-chain — invitee addresses are not exposed, so a referrer can't use their
   * rewards as a window into an invitee's savings.
   * @returns {Promise<number>}
   */
  async getReferralCount(userAddress = null) {
    const module = await this._getReferralModule();
    if (!module) return 0;

    return Number(await module.getReferralCount(userAddress || this.userAddress));
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
    const moduleAddress = await this.savingsContract.getModule(SAVINGS_VAULTS_MODULE_ID);
    if (moduleAddress === ethers.ZeroAddress) {
      throw new Error("Vaults are not available on this network yet");
    }
    this.vaultModule = new ethers.Contract(moduleAddress, SavingsVaultModuleABI, this.signer);
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

  /**
   * A vault, in the shape the UI wants.
   *
   * A vault holds a set of tokens, not one, so `tokens` is the truth here. The
   * single-token fields below it are kept because a coin vault genuinely has
   * one asset and every amount in the UI is denominated in it — they are the
   * honest answer for that kind and deliberately blank for a stables vault,
   * rather than a first token pretending to speak for the rest.
   *
   * `limitDecimals` / `limitSymbol` are separate from the token's own, because
   * a limit is not always in a token: a stables cap is in dollars and a
   * percentage cap is in percent.
   */
  _mapVault(vaultId, raw, tokenMetas) {
    const kind = Number(raw.kind);
    const isStables = kind === VAULT_KINDS.stables;
    const tokens = raw.tokens.map((address, i) => ({
      address: address === ethers.ZeroAddress ? null : address,
      isNative: tokenMetas[i].isNative,
      symbol: tokenMetas[i].symbol,
      decimals: tokenMetas[i].decimals,
    }));
    const only = isStables ? null : tokens[0];

    return {
      address: vaultId.toString(),
      creator: raw.creator,
      kind: VAULT_KIND_NAMES[kind] || "Coin",
      vaultType: VAULT_TYPE_NAMES[Number(raw.vaultType)] || "Personal",
      name: raw.name,
      tokens,
      // Single-asset view. Null for a stables vault on purpose: there is no one
      // token, and code that quietly used the first would be wrong every time
      // the member held any of the others.
      tokenMint: only ? only.address : null,
      isNativeToken: only ? only.isNative : false,
      tokenSymbol: only ? only.symbol : "Stablecoins",
      tokenDecimals: only ? only.decimals : DOLLAR_DECIMALS,
      limitsArePercentage: raw.limitsArePercentage,
      limitDecimals: raw.limitsArePercentage ? 2 : (only ? only.decimals : DOLLAR_DECIMALS),
      limitSymbol: raw.limitsArePercentage ? "%" : (only ? only.symbol : "USD"),
      penaltyRateBps: Number(raw.penaltyRateBps),
      memberCount: Number(raw.memberCount),
      isActive: raw.isActive,
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

  /**
   * Which token an operation is about.
   *
   * A coin vault has one, so naming it is optional. A stables vault has
   * several and there is no sensible default — picking one would silently move
   * the wrong asset — so the caller has to say.
   */
  _resolveVaultToken(vault, tokenAddress) {
    const wanted = tokenAddress === this.ETH_ADDRESS ? null : tokenAddress;
    if (wanted == null) {
      if (vault.tokens.length === 1) return vault.tokens[0];
      throw this._userError("Choose which coin this is for");
    }
    const match = vault.tokens.find(
      (t) => (t.address || "").toLowerCase() === wanted.toLowerCase(),
    );
    if (!match) throw this._userError("This vault does not hold that coin");
    return match;
  }

  /** The on-chain address for a token entry, with native coin as the zero address. */
  _tokenArg(token) {
    return token.address || ethers.ZeroAddress;
  }

  async createVault({
    name,
    vaultType = "Personal",
    kind = null,
    tokenMint = null,
    tokens = null,
    periods = null,
    dailyLimit = 0,
    weeklyLimit = 0,
    monthlyLimit = 0,
    penaltyRateBps = 2000,
    limitsArePercentage = false,
    referrer = null,
  }) {
    const vaultModule = await this._getVaultModule();

    // A list of coins means a stables vault; one coin means a coin vault. The
    // caller can say outright, but the shape of what they passed already says it.
    const tokenList = tokens && tokens.length > 0 ? tokens : [tokenMint ?? null];
    const resolvedKind =
      kind != null
        ? VAULT_KINDS[String(kind).toLowerCase()] ?? VAULT_KINDS.coin
        : tokenList.length > 1
          ? VAULT_KINDS.stables
          : VAULT_KINDS.coin;

    const isStables = resolvedKind === VAULT_KINDS.stables;
    // A stables cap is in dollars across every coin; a coin cap is in that coin.
    const limitDecimals = isStables
      ? DOLLAR_DECIMALS
      : (await this._resolveTokenMeta(tokenList[0])).decimals;

    const schedule =
      periods && periods.length > 0
        ? periods
        : [
            { name: "Daily", limit: dailyLimit },
            { name: "Weekly", limit: weeklyLimit },
            { name: "Monthly", limit: monthlyLimit },
          ].filter((p) => p.limit > 0);
    if (schedule.length === 0) throw this._userError("Set at least one spending limit");

    const tx = await vaultModule.createVault(
      name,
      resolvedKind,
      vaultType === "Community" ? 1 : 0,
      tokenList.map((t) => t ?? ethers.ZeroAddress),
      limitsArePercentage,
      penaltyRateBps,
      schedule.map((p) => p.name),
      schedule.map((p) => this._toRawLimit(p.limit, limitsArePercentage, limitDecimals)),
      schedule.map((p) => getPeriodDuration(p.name)),
      schedule.map((p) => p.unlockDelay ?? getDefaultUnlockDelay(p.name)),
      // Recording a referrer must never block someone starting to save: an
      // unusable one becomes no referrer, and the contract shrugs off the rest.
      referrer && ethers.isAddress(referrer) ? referrer : ethers.ZeroAddress,
    );
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

  /**
   * Accept another dollar coin into an existing vault.
   *
   * The cap does not change — it is in dollars across whatever the vault holds
   * — so the new coin shares the existing allowance rather than adding to it.
   */
  async addVaultToken(vaultAddress, tokenAddress) {
    const vaultModule = await this._getVaultModule();
    const tx = await vaultModule.addAcceptedToken(vaultAddress, tokenAddress);
    await tx.wait();
    return tx.hash;
  }

  async leaveVault(vaultAddress) {
    const vaultModule = await this._getVaultModule();
    const tx = await vaultModule.leaveVault(vaultAddress);
    await tx.wait();
    return tx.hash;
  }

  /**
   * Change a vault's spending limits.
   *
   * A vault's rules live in the same modules as the savings account's, so
   * changing one goes through the same timelock rather than applying on the
   * spot. Each period is proposed separately, because that is how the proposal
   * module models a change — and it is what gives each window its own wait.
   *
   * @returns {Promise<Array<{period: string, txHash: string}>>} one entry per
   * period actually changed. Nothing takes effect until each is executed after
   * its wait; use getPendingVaultRuleChanges to see them.
   */
  async updateVaultRules(vaultAddress, rules = {}) {
    const vault = await this.getVaultInfo(vaultAddress);
    if (!vault) throw this._userError("Vault not found");

    const limitsArePercentage = rules.limitsArePercentage ?? vault.limitsArePercentage;
    if (limitsArePercentage !== vault.limitsArePercentage) {
      // The stored numbers mean different things under each mode, and the
      // proposal flow changes one limit at a time — so there is no coherent
      // way to switch mode partway through.
      throw this._userError(
        "Changing between fixed and percentage limits is not supported on an existing vault",
      );
    }

    const changes = (
      rules.periods ?? [
        { name: "Daily", limit: rules.dailyLimit },
        { name: "Weekly", limit: rules.weeklyLimit },
        { name: "Monthly", limit: rules.monthlyLimit },
      ]
    ).filter((p) => p.limit != null);
    if (changes.length === 0) throw this._userError("No limit changes to make");

    const rulesModule = await this._getModuleContract("vaultRules");
    const results = [];
    for (const { name, limit } of changes) {
      const raw = this._toRawLimit(limit, limitsArePercentage, vault.limitDecimals);
      const tx = await rulesModule.proposeVaultLimitChange(vaultAddress, name, raw);
      await tx.wait();
      results.push({ period: name, txHash: tx.hash });
    }
    return results;
  }

  /**
   * A vault's spending limits, in exactly the shape the savings account
   * returns — because they now come from exactly the same place.
   *
   * Vault rules live in TimePeriodLimitsModule under a per-member scope, so the
   * spent counters, remaining amounts and per-period waits are all real rather
   * than reconstructed. That is what lets one set of components render a vault
   * and the savings account without knowing which it is looking at.
   */
  async getVaultSpendingLimits(vaultAddress, memberAddress = null) {
    const vaultModule = await this._getVaultModule();
    const member = memberAddress || this.userAddress;
    const scope = await vaultModule.vaultScopeOf(vaultAddress, member);

    const vault = await this.getVaultInfo(vaultAddress);
    const decimals = vault?.limitDecimals ?? DOLLAR_DECIMALS;

    const limitsModule = await this._getModuleContract("timePeriodLimits");
    const [names, limits, spent, remaining, durations, active, unlockDelays] =
      await limitsModule.getUserSpendingLimits(scope);

    const resetData = await this._fetchLimitResetTimes(scope, names, durations, active);

    const fetchedLimits = [];
    for (let i = 0; i < names.length; i++) {
      fetchedLimits.push({
        name: names[i],
        limit: this.formatAmount(limits[i], decimals),
        spent: this.formatAmount(spent[i], decimals),
        remaining: Number(this.formatAmount(remaining[i], decimals)),
        duration: durations[i].toString(),
        active: active[i],
        resetAt: resetData[i],
        unlockDelay: Number(unlockDelays[i]),
      });
    }

    // A vault is committed the moment it is created, so its rules always go
    // through the timelock.
    return { limits: fetchedLimits, isSetupCommitted: true };
  }

  /** Queued rule changes for a vault, with when each can be applied. */
  async getPendingVaultRuleChanges(vaultAddress, memberAddress = null) {
    const rulesModule = await this._getModuleContract("vaultRules");
    const [ids, categories, newLimits, executeAfters] =
      await rulesModule.getPendingVaultRuleChanges(vaultAddress, memberAddress || this.userAddress);
    return ids.map((id, i) => ({
      proposalId: id,
      period: categories[i],
      newLimitRaw: newLimits[i],
      executeAfter: new Date(Number(executeAfters[i]) * 1000),
    }));
  }

  async executeVaultRuleChange(vaultAddress, proposalId) {
    const rulesModule = await this._getModuleContract("vaultRules");
    const tx = await rulesModule.executeVaultLimitProposal(vaultAddress, proposalId);
    await tx.wait();
    return tx.hash;
  }

  async cancelVaultRuleChange(vaultAddress, proposalId) {
    const rulesModule = await this._getModuleContract("vaultRules");
    const tx = await rulesModule.cancelVaultLimitProposal(vaultAddress, proposalId);
    await tx.wait();
    return tx.hash;
  }

  /** Ask to withdraw past one of a vault's limits, after that period's wait. */
  async requestVaultBypass(vaultAddress, amount, skipPeriod, tokenAddress = null) {
    const vaultModule = await this._getVaultModule();
    const vault = await this.getVaultInfo(vaultAddress);
    const token = this._resolveVaultToken(vault, tokenAddress);
    const raw = this._toBaseUnits(amount, token.decimals);
    const tx = await vaultModule.requestBypass(
      vaultAddress,
      this._tokenArg(token),
      raw,
      skipPeriod,
    );
    await tx.wait();
    return tx.hash;
  }

  async executeVaultBypass(vaultAddress, requestId, destination = null) {
    const vaultModule = await this._getVaultModule();
    const tx = await vaultModule.executeBypass(
      vaultAddress,
      requestId,
      destination || this.userAddress,
    );
    await tx.wait();
    return tx.hash;
  }

  async cancelVaultBypass(vaultAddress, requestId) {
    const vaultModule = await this._getVaultModule();
    const tx = await vaultModule.cancelBypass(vaultAddress, requestId);
    await tx.wait();
    return tx.hash;
  }

  async depositToVault(vaultAddress, amount, tokenAddress = null) {
    const vaultModule = await this._getVaultModule();
    const vault = await this.getVaultInfo(vaultAddress);
    if (!vault) throw this._userError("Vault not found");

    const token = this._resolveVaultToken(vault, tokenAddress);
    const rawAmount = this._toBaseUnits(amount, token.decimals);
    await this._assertWalletBalance(token.address, rawAmount);

    if (token.isNative) {
      const tx = await vaultModule.deposit(vaultAddress, ethers.ZeroAddress, rawAmount, {
        value: rawAmount,
      });
      await tx.wait();
      return tx.hash;
    }

    const erc20 = new ethers.Contract(token.address, ERC20ABI, this.signer);
    const moduleAddress = await vaultModule.getAddress();
    const allowance = await erc20.allowance(this.userAddress, moduleAddress);
    if (allowance < rawAmount) {
      if (allowance > 0n) {
        // Tokens like USDT reject raising a non-zero allowance directly
        const resetTx = await erc20.approve(moduleAddress, 0);
        await resetTx.wait();
      }
      const approveTx = await erc20.approve(moduleAddress, rawAmount);
      await approveTx.wait();
    }
    const tx = await vaultModule.deposit(vaultAddress, token.address, rawAmount);
    await tx.wait();
    return tx.hash;
  }

  async _withdrawFromVault(vaultAddress, amount, withPenalty, tokenAddress, destination) {
    const vaultModule = await this._getVaultModule();
    const vault = await this.getVaultInfo(vaultAddress);
    if (!vault) throw this._userError("Vault not found");

    const token = this._resolveVaultToken(vault, tokenAddress);
    const rawAmount = this._toBaseUnits(amount, token.decimals);
    const held = await vaultModule.balanceOf(vaultAddress, this.userAddress, this._tokenArg(token));
    this._assertSufficientBalance(rawAmount, held, token.symbol, token.decimals);

    const to = destination || this.userAddress;
    const tx = withPenalty
      ? await vaultModule.withdrawWithPenalty(vaultAddress, this._tokenArg(token), rawAmount, to)
      : await vaultModule.withdraw(vaultAddress, this._tokenArg(token), rawAmount, to);
    await tx.wait();
    return tx.hash;
  }

  async withdrawFromVault(vaultAddress, amount, tokenAddress = null, destination = null) {
    return this._withdrawFromVault(vaultAddress, amount, false, tokenAddress, destination);
  }

  async withdrawFromVaultWithPenalty(vaultAddress, amount, tokenAddress = null, destination = null) {
    return this._withdrawFromVault(vaultAddress, amount, true, tokenAddress, destination);
  }

  async claimVaultPenaltyRewards(vaultAddress, tokenAddress = null) {
    const vaultModule = await this._getVaultModule();
    const vault = await this.getVaultInfo(vaultAddress);
    const token = this._resolveVaultToken(vault, tokenAddress);
    const tx = await vaultModule.claimPenaltyRewards(vaultAddress, this._tokenArg(token));
    await tx.wait();
    return tx.hash;
  }

  // ---- Permanent per-member deposit addresses ----

  /**
   * The member's address for this vault. Answered even before the proxy is
   * deployed, which is the point: the address can be handed to an exchange
   * first, and anything that arrives waits there to be swept in.
   */
  async getVaultDepositAddress(vaultId, memberAddress = null) {
    const module = await this._getModuleContract("vaultDepositAddresses");
    return module.depositAddressOf(vaultId, memberAddress || this.userAddress);
  }

  async isVaultDepositAddressDeployed(vaultId, memberAddress = null) {
    const module = await this._getModuleContract("vaultDepositAddresses");
    return module.isDepositAddressDeployed(vaultId, memberAddress || this.userAddress);
  }

  async deployVaultDepositAddress(vaultId) {
    const module = await this._getModuleContract("vaultDepositAddresses");
    const tx = await module.deployDepositAddress(vaultId);
    await tx.wait();
    return this.getVaultDepositAddress(vaultId);
  }

  /** Forward anything sitting on the member's deposit address into the vault. */
  async checkAndSweepVaultProxy(vaultId) {
    try {
      if (!(await this.isVaultDepositAddressDeployed(vaultId))) return;
      const proxyAddress = await this.getVaultDepositAddress(vaultId);
      const vault = await this.getVaultInfo(vaultId);
      if (!vault) return;

      const proxy = new ethers.Contract(
        proxyAddress,
        ["function sweepNative() external", "function sweep(address token) external"],
        this.signer,
      );

      // Every coin the vault takes, because a stables vault can be paid in any
      // of them and sweeping only the first would strand the rest.
      for (const token of vault.tokens) {
        if (token.isNative) {
          // receive() forwards automatically; the sweep only catches strays
          const balance = await this.provider.getBalance(proxyAddress);
          if (balance > 0n) await (await proxy.sweepNative()).wait();
        } else {
          const erc20 = new ethers.Contract(token.address, ERC20ABI, this.provider);
          const balance = await erc20.balanceOf(proxyAddress);
          if (balance > 0n) await (await proxy.sweep(token.address)).wait();
        }
      }
    } catch (error) {
      console.warn("Vault deposit address sweep failed:", error.message);
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
    if (!raw.creator || raw.creator === ethers.ZeroAddress) return null;

    const metas = await Promise.all(
      raw.tokens.map((address) =>
        this._resolveTokenMeta(address === ethers.ZeroAddress ? null : address),
      ),
    );
    return this._mapVault(vaultAddress, raw, metas);
  }

  /**
   * What a member holds in a vault, per coin.
   *
   * There is no member struct on chain any more — balances are keyed by coin —
   * so this is assembled here. `balances` is the truth; `balance` is the single
   * number the older single-asset screens want, and for a stables vault that is
   * deliberately the dollar total rather than any one coin.
   */
  async getVaultMemberInfo(vaultAddress, memberAddress = null) {
    const vaultModule = await this._getVaultModule();
    const member = memberAddress || this.userAddress;
    const vault = await this.getVaultInfo(vaultAddress);
    if (!vault) return null;

    const members = await vaultModule.getVaultMembers(vaultAddress);
    const isMember = members.some((a) => a.toLowerCase() === member.toLowerCase());
    if (!isMember) return null;

    const balances = {};
    let single = 0n;
    for (const token of vault.tokens) {
      const raw = await vaultModule.balanceOf(vaultAddress, member, this._tokenArg(token));
      balances[token.address || this.ETH_ADDRESS] = {
        raw,
        symbol: token.symbol,
        decimals: token.decimals,
        formatted: this.formatAmount(raw, token.decimals),
      };
      if (vault.tokens.length === 1) single = raw;
    }
    if (vault.tokens.length > 1) {
      single = await vaultModule.dollarBalanceOf(vaultAddress, member);
    }

    return {
      vault: vaultAddress.toString(),
      member,
      balances,
      balance: single,
      balanceDecimals: vault.tokens.length > 1 ? DOLLAR_DECIMALS : vault.tokens[0].decimals,
    };
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
      // "Holds this coin", not "is this coin" — a stables vault holds several.
      if (
        tokenMint &&
        !vault.tokens.some((t) => (t.address || "").toLowerCase() === tokenMint.toLowerCase())
      ) {
        continue;
      }
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


  // ========== EARNING ON SAVINGS ==========

  /** EVM has a yield module; whether a given network has one is reported by getYieldStatus. */
  supportsYield() {
    return true;
  }

  /** Resolve the yield module, or null when this network has none registered. */
  async _getYieldModule() {
    if (this.vaultYieldModule !== undefined) return this.vaultYieldModule;
    try {
      this.vaultYieldModule = await this._getModuleContract("vaultYield");
    } catch {
      this.vaultYieldModule = null;
    }
    return this.vaultYieldModule;
  }

  async _requireYieldModule() {
    const module = await this._getYieldModule();
    if (!module) throw this._userError("Earning on savings is not switched on for this network yet");
    return module;
  }

  /**
   * The earning options for one coin, with live rates read from the strategy
   * itself. The gross rate is compounded into an APY here so no contract has to
   * do floating-point maths.
   *
   * @returns {Promise<Array<{key: string, protocol: string, apyPercent: number,
   *   netApyPercent: number, grandPrize: number|null, available: boolean}>>}
   */
  async getYieldOptions(tokenAddress) {
    const module = await this._getYieldModule();
    if (!module || !tokenAddress) return [];

    const feeBps = Number(await module.managementFeeBps());
    const strategy = await module.getStrategy(tokenAddress);
    const available = Boolean(strategy && strategy !== ethers.ZeroAddress);
    const gross = aprBpsToApyPercent(available ? await module.currentAprBps(tokenAddress) : 0);

    return [
      {
        key: "stable",
        protocol: "Aave",
        apyPercent: gross,
        netApyPercent: netApyPercent(gross, feeBps),
        grandPrize: null,
        available,
      },
      {
        // Prize savings has not been brought across to the per-coin positions
        // yet. Offered but unavailable, rather than hidden, so the choice the
        // product makes is still visible.
        key: "prize",
        protocol: "PoolTogether",
        apyPercent: 0,
        netApyPercent: 0,
        grandPrize: null,
        available: false,
      },
      // Switching earning off is always on offer.
      { key: "off", protocol: null, apyPercent: 0, netApyPercent: 0, grandPrize: null, available: true },
    ];
  }

  /** Not yet available on the per-coin positions. */
  async getClaimablePrizes() {
    return null;
  }

  async claimVaultPrizes() {
    throw this._userError("Prize savings is not available yet");
  }

  /**
   * Current earning setting and figures for a vault.
   *
   * Earning is per coin, because each coin earns in its own market — so
   * `tokens` is the real answer and the top-level figures are the vault's
   * totals. `mode` is "mixed" when a stables vault has some coins earning and
   * some not, which is a state the UI has to be able to say out loud rather
   * than round to one or the other.
   *
   * `supported: false` means "hide the earning UI": either this network has no
   * yield module, or there is no vault to configure.
   */
  async getYieldStatus(vaultAddress = null) {
    const module = await this._getYieldModule();
    if (!module) return { supported: false };
    if (!vaultAddress) return { supported: false, reason: "no-vault" };

    const vault = await this.getVaultInfo(vaultAddress);
    if (!vault) return { supported: false };

    const feeBps = Number(await module.managementFeeBps());
    const tokens = [];
    for (const token of vault.tokens) {
      // Native coin has no lending market here, so it can only ever be off.
      if (token.isNative) continue;
      const [modeRaw, position, pendingRaw, options] = await Promise.all([
        module.modeOf(vaultAddress, token.address),
        module.getPosition(vaultAddress, token.address),
        module.pendingYield(vaultAddress, token.address, this.userAddress),
        this.getYieldOptions(token.address),
      ]);
      const format = (raw) => ethers.formatUnits(raw, token.decimals);

      const canEarn = options.some((option) => option.key !== "off" && option.available);
      tokens.push({
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        // A coin with no strategy cannot earn whatever its stored mode says.
        // Reporting it as earning would put "0 DAI earning" in front of someone
        // whose DAI is doing nothing at all.
        mode: canEarn ? YIELD_MODE_NAMES[Number(modeRaw)] || "off" : "off",
        options,
        canEarn,
        // Raw values kept alongside the formatted strings: these are token
        // amounts, and Number() would quietly lose precision on large balances.
        investedRaw: position.principal,
        invested: format(position.principal),
        pendingYieldRaw: pendingRaw,
        pendingYield: format(pendingRaw),
        lifetimeYieldRaw: position.lifetimeYield,
        lifetimeYield: format(position.lifetimeYield),
      });
    }

    const earning = tokens.filter((t) => t.mode !== "off");
    const mode =
      earning.length === 0 ? "off" : earning.length === tokens.length ? earning[0].mode : "mixed";
    const sum = (field) => tokens.reduce((total, t) => total + Number(t[field]), 0).toString();

    // Each coin earns in its own market at its own rate, so a vault holding
    // several has no single rate. Quoting the first one would be quoting USDT's
    // rate for someone's DAI.
    const netRates = tokens
      .filter((t) => t.canEarn)
      .map((t) => t.options.find((o) => o.key === "stable")?.netApyPercent ?? 0);
    const lowest = netRates.length > 0 ? Math.min(...netRates) : 0;
    const highest = netRates.length > 0 ? Math.max(...netRates) : 0;
    const rangeLabel =
      lowest.toFixed(2) === highest.toFixed(2)
        ? null
        : `${lowest.toFixed(2)}\u2013${highest.toFixed(2)}%`;

    // The dialog shows one set of options for the vault, so its rate has to be
    // the whole range too.
    const dialogOptions = (tokens[0]?.options ?? []).map((option) =>
      option.key === "stable" ? { ...option, netApyPercent: highest, rangeLabel } : option,
    );

    return {
      supported: true,
      tokenSupported: tokens.some((t) => t.canEarn),
      // What the amounts below are counted in. Several pegged coins add up to
      // dollars — that is the whole basis of a stables vault — whereas one coin
      // counts in itself. "Stablecoins" names what is earning, not a unit, so
      // it must never end up suffixed to a number.
      amountSymbol: tokens.length === 1 ? tokens[0].symbol : "USD",
      invested: sum("invested"),
      // The one-coin view the single-asset screens read. For a stables vault
      // this is the vault's label rather than any one coin, which is honest:
      // there is no single coin to name.
      tokenSymbol: vault.tokenSymbol,
      tokens,
      mode,
      options: dialogOptions,
      netRateLow: lowest,
      netRateHigh: highest,
      netRateRangeLabel: rangeLabel,
      pendingYield: sum("pendingYield"),
      lifetimeYield: sum("lifetimeYield"),
      feeBps,
      // 100 bps of the rate reads to a user as "one percentage point".
      feePercentagePoints: feeBps / 100,
    };
  }

  /**
   * Switch a coin between stable earning and off.
   *
   * A stables vault holds several coins in several markets, so with no coin
   * named this applies to all of them — which is what "turn earning off" has to
   * mean for a vault, rather than off for whichever coin happened to be first.
   */
  async setYieldMode(vaultAddress, mode, tokenAddress = null) {
    await this._requireYieldModule();
    const modeValue = YIELD_MODES[mode];
    if (!modeValue) throw this._userError("Choose a valid earning option");
    if (mode === "prize") throw this._userError("Prize savings is not available yet");

    const vaultModule = await this._getVaultModule();
    const vault = await this.getVaultInfo(vaultAddress);
    const targets = tokenAddress
      ? [this._resolveVaultToken(vault, tokenAddress)]
      : vault.tokens.filter((t) => !t.isNative);
    if (targets.length === 0) throw this._userError("This vault's coin cannot earn yield yet");

    let lastHash = null;
    for (const token of targets) {
      const tx = await vaultModule.setYieldMode(vaultAddress, token.address, modeValue);
      await tx.wait();
      lastHash = tx.hash;
    }
    return lastHash;
  }

  /** Fold earned yield into the member's balance so it compounds. */
  async compoundVaultYield(vaultAddress, memberAddress = null) {
    await this._requireYieldModule();
    const vaultModule = await this._getVaultModule();
    const vault = await this.getVaultInfo(vaultAddress);
    const member = memberAddress || this.userAddress;

    let lastHash = null;
    for (const token of vault.tokens.filter((t) => !t.isNative)) {
      const tx = await vaultModule.compoundYield(vaultAddress, token.address, member);
      await tx.wait();
      lastHash = tx.hash;
    }
    return lastHash;
  }

}
