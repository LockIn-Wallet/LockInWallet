import { ethers } from "ethers";
import { BlockchainAdapter } from "./BlockchainAdapter.js";
import SavingsABI from "../SavingsABI.json";
import MockUSDT_ABI from "../MockUSDT_ABI.json";
import ProxyDeploymentModuleABI from "../ProxyDeploymentModuleABI.json";

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

    const fetchedLimits = [];
    for (let i = 0; i < names.length; i++) {
      fetchedLimits.push({
        name: names[i],
        limit: this.formatAmount(limits[i], 6),
        spent: this.formatAmount(spent[i], 6),
        remaining: Number(this.formatAmount(remaining[i], 6)),
        duration: durations[i].toString(),
        active: active[i],
      });
    }

    // Get setup committed status from contract
    const isSetupCommitted = await this.getIsSetupCommitted();

    // Return unified format that matches the service expectation
    return {
      limits: fetchedLimits,
      isSetupCommitted: isSetupCommitted,
    };
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
}
