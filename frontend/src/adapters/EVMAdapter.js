import { ethers } from "ethers";
import { BlockchainAdapter } from "./BlockchainAdapter.js";
import SavingsABI from "../SavingsABI.json";
import MockUSDT_ABI from "../MockUSDT_ABI.json";
import ProxyDeploymentModuleABI from "../ProxyDeploymentModuleABI.json";
import TimePeriodLimitsModuleABI from "../TimePeriodLimitsModuleABI.json";
import VaultSystemModuleABI from "../VaultSystemModuleABI.json";
import ERC20ABI from "../ERC20ABI.json";
import { getTokenMeta } from "../utils/tokenUtils.js";

const VAULT_SYSTEM_MODULE_ID = ethers.keccak256(ethers.toUtf8Bytes("VAULT_SYSTEM"));
const VAULT_TYPE_NAMES = ["Personal", "Community"];

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

    const proxyAddress = await this.savingsContract.getUserProxy(
      await this.getAddress(),
    );
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
      const isDeployed = await this.savingsContract.isProxyDeployed(
        userAddress,
      );
      console.log(
        "🚀 ~ EVMAdapter ~ checkAndSweepProxy ~ isDeployed:",
        isDeployed,
      );
      if (!isDeployed) return;

      const proxyAddress = await this.savingsContract.getUserProxy(userAddress);
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
            balances[key] = this.formatAmount(tokenBalance, token.decimals);
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

    const amountWei = this.parseAmount(amount, 6); // Assuming USDT decimals

    let tx;
    if (destination) {
      tx = await this.savingsContract.withdrawTo(
        amountWei,
        tokenAddress,
        destination,
      );
    } else {
      tx = await this.savingsContract.withdraw(amountWei, tokenAddress);
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
    if (!this.savingsContract) throw new Error("Contract not initialized");
    return await this.savingsContract.isProxyDeployed(userAddress);
  }

  async getDepositAddress(userAddress) {
    if (!this.savingsContract) throw new Error("Contract not initialized");
    return await this.savingsContract.getUserDepositAddress(userAddress);
  }

  async getProxyDeploymentFee() {
    if (!this.savingsContract) throw new Error("Contract not initialized");
    return await this.savingsContract.getProxyDeploymentFee();
  }

  async deployProxy() {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    // Approve USDT fee before deploying
    const fee = await this.savingsContract.getProxyDeploymentFee();
    if (fee > 0n) {
      if (!this.proxyDeploymentModule)
        throw new Error("ProxyDeploymentModule not initialized");
      const paymentTokenAddress =
        await this.proxyDeploymentModule.paymentToken();
      await this.approveToken(
        paymentTokenAddress,
        this.proxyDeploymentModule.target,
        fee,
      );
    }

    const tx = await this.savingsContract.deployUserProxy();
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

    const spendingData = await this.savingsContract.getUserSpendingLimits(
      userAddress,
    );
    const [names, limits, spent, remaining, durations, active] = spendingData;

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
      const TIME_PERIOD_LIMITS_ID = ethers.keccak256(
        ethers.toUtf8Bytes("TIME_PERIOD_LIMITS"),
      );
      const moduleAddress = await this.savingsContract.getModule(TIME_PERIOD_LIMITS_ID);
      if (!moduleAddress || moduleAddress === ethers.ZeroAddress) {
        return names.map(() => 0);
      }
      const limitsModule = new ethers.Contract(
        moduleAddress,
        TimePeriodLimitsModuleABI,
        this.signer,
      );
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

    const tx = await this.savingsContract.setCommonPeriodLimits(
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
  }

  async addSpendingLimit(periodName, limit) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    const limitWei = ethers.parseUnits(limit.toString(), 6);

    // Determine duration based on period name
    const durations = {
      Daily: 86400, // 1 day
      Weekly: 604800, // 7 days
      Monthly: 2592000, // 30 days
    };

    const duration = durations[periodName];
    if (!duration) {
      throw new Error("Invalid period name. Must be Daily, Weekly, or Monthly");
    }

    const tx = await this.savingsContract.addTimePeriodLimit(
      periodName,
      limitWei,
      duration,
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
    const tx = await this.savingsContract.proposeLimitChange(
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
      ] = await this.savingsContract.getUserPendingProposals();

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

        proposals.push({
          proposalId: proposalIds[i], // Keep as bytes32 string
          periodName: categories[i],
          newLimit: limitInTokens.toString(),
          executeAfter: executeAfterTimestamp,
          executed: false, // This method only returns pending proposals
          isIncrease: isIncreaseFlags[i],
          createdAt: executeAfterTimestamp - 24 * 60 * 60, // Estimate created time
          action: "change",
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

      // Call the contract method to execute the proposal
      const tx = await this.savingsContract.executeLimitProposal(proposalId);
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
      const tx = await this.savingsContract.cancelLimitProposal(proposalId);
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
   * Unified method that sets spending limits and commits setup in a single transaction
   * @param {number} dailyLimit Daily spending limit (0 to disable)
   * @param {number} weeklyLimit Weekly spending limit (0 to disable)
   * @param {number} monthlyLimit Monthly spending limit (0 to disable)
   * @returns {Promise<string>} Transaction hash
   */
  async commitSetup(dailyLimit, weeklyLimit, monthlyLimit) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    // Convert to Wei (contract expects 6 decimal places for USDT-compatible amounts)
    const dailyWei =
      dailyLimit > 0 ? ethers.parseUnits(dailyLimit.toString(), 6) : 0;
    const weeklyWei =
      weeklyLimit > 0 ? ethers.parseUnits(weeklyLimit.toString(), 6) : 0;
    const monthlyWei =
      monthlyLimit > 0 ? ethers.parseUnits(monthlyLimit.toString(), 6) : 0;

    try {
      // Call the unified commitSetup method we added to the contract
      const tx = await this.savingsContract.commitSetup(
        dailyWei,
        weeklyWei,
        monthlyWei,
      );
      await tx.wait(); // Wait for transaction confirmation

      return tx.hash; // Return consistent format (transaction hash as string)
    } catch (error) {
      // Translate EVM errors to business-friendly messages
      if (error.message.includes("Daily limit too high")) {
        throw new Error("Daily limit exceeds weekly limit");
      } else if (error.message.includes("Weekly limit too high")) {
        throw new Error("Weekly limit exceeds monthly limit");
      } else if (error.code === 4001) {
        throw new Error("Transaction cancelled by user");
      } else {
        throw new Error(`Setup failed: ${error.message}`);
      }
    }
  }

  // Private Methods
  async _initializeContracts() {
    if (!this.signer || !this.networkConfig.savingsContract) return;

    // Drop caches tied to the previous network/signer
    this.vaultModule = null;
    this._tokenMetaCache = null;

    // Initialize savings contract
    this.savingsContract = new ethers.Contract(
      this.networkConfig.savingsContract,
      SavingsABI,
      this.signer,
    );

    // Initialize ProxyDeploymentModule by looking up its registered address
    try {
      const PROXY_DEPLOYMENT_ID = ethers.keccak256(
        ethers.toUtf8Bytes("PROXY_DEPLOYMENT"),
      );
      const proxyModuleAddress = await this.savingsContract.getModule(
        PROXY_DEPLOYMENT_ID,
      );
      if (proxyModuleAddress && proxyModuleAddress !== ethers.ZeroAddress) {
        this.proxyDeploymentModule = new ethers.Contract(
          proxyModuleAddress,
          ProxyDeploymentModuleABI,
          this.signer,
        );
      }
    } catch (e) {
      console.warn("Could not initialize ProxyDeploymentModule:", e.message);
    }
  }

  // Bypass Requests (unified adapter pattern)
  async fetchPendingBypassRequests(userAddress = null) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    // Note: getUserActiveBypassRequests() uses msg.sender, so no user parameter needed
    const bypassData = await this.savingsContract.getUserActiveBypassRequests();
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

  // Withdrawal Destination Requests (unified adapter pattern)
  async getPendingWithdrawalDestinationRequests(userAddress = null) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    const targetAddress = userAddress || (await this.getAddress());

    try {
      console.log(
        "🔍 EVMAdapter: Fetching withdrawal destination requests for",
        targetAddress,
      );
      const result =
        await this.savingsContract.getUserPendingWithdrawalRequests();
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
      const result = await this.savingsContract.getUserWithdrawalAddresses();
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
      const tx = await this.savingsContract.requestWithdrawalAddress(
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
      const tx = await this.savingsContract.addWithdrawalAddressDirect(
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
      const tx = await this.savingsContract.executeWithdrawalAddressRequest(
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

  async removeWithdrawalAddress(destination) {
    if (!this.savingsContract) throw new Error("Contract not initialized");

    try {
      const tx = await this.savingsContract.removeWithdrawalAddress(
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
    if (!this.savingsContract) throw new Error("Contract not initialized");

    try {
      console.log("🔍 EVMAdapter: Calling contract.isSetupCommitted()...");
      const result = await this.savingsContract.isSetupCommitted();
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
    if (!this.savingsContract) throw new Error("Contract not initialized");
    const tx = await this.savingsContract.depositToPoolTogether(tokenAddress, amount);
    await tx.wait();
    return tx.hash;
  }

  async withdrawFromPoolTogether(tokenAddress, shares) {
    if (!this.savingsContract) throw new Error("Contract not initialized");
    const tx = await this.savingsContract.withdrawFromPoolTogether(tokenAddress, shares);
    await tx.wait();
    return tx.hash;
  }

  async getPoolTogetherBalance(tokenAddress) {
    if (!this.savingsContract) throw new Error("Contract not initialized");
    const [shares, assets] = await this.savingsContract.getPoolTogetherBalance(
      this.userAddress,
      tokenAddress
    );
    return { shares, assets };
  }

  async getPoolTogetherGrandPrize() {
    if (!this.savingsContract) throw new Error("Contract not initialized");
    return await this.savingsContract.getPoolTogetherGrandPrize();
  }

  async hasPoolTogetherVault(tokenAddress) {
    if (!this.savingsContract) throw new Error("Contract not initialized");
    return await this.savingsContract.hasPoolTogetherVault(tokenAddress);
  }

  async claimPoolTogetherPrize(tokenAddress, tier = 3) {
    if (!this.savingsContract) throw new Error("Contract not initialized");
    const tx = await this.savingsContract.claimPoolTogetherPrize(tokenAddress, tier);
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
      throw new Error("Provide daily, weekly and monthly limits when changing the limit type");
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
    if (!vault) throw new Error("Vault not found");

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
    if (!vault) throw new Error("Vault not found");

    const rawAmount = this._toBaseUnits(amount, vault.tokenDecimals);
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
