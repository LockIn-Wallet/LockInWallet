import { ethers } from 'ethers';
import { BlockchainAdapter } from './BlockchainAdapter.js';
import SavingsABI from '../SavingsABI.json';
import MockUSDT_ABI from '../MockUSDT_ABI.json';
import ApprovalSystemModuleABI from '../ApprovalSystemModuleABI.json';
import ProposalSystemModuleABI from '../ProposalSystemModuleABI.json';

/**
 * EVM Blockchain Adapter for MetaMask and ethers.js integration
 */
export class EVMAdapter extends BlockchainAdapter {
  constructor(networkConfig) {
    super(networkConfig);
    this.provider = null;
    this.signer = null;
    this.savingsContract = null;
    this.approvalModule = null;
    this.proposalModule = null;
    this.userAddress = null;
    this.ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
  }

  // Wallet Management
  async isConnected() {
    try {
      if (!window.ethereum) return false;
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      return accounts.length > 0 && this.provider && this.signer;
    } catch {
      return false;
    }
  }

  async connect() {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not found. Please install MetaMask to continue.');
      }

      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" });

      // Set up provider and signer
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.userAddress = await this.signer.getAddress();

      // Set up contracts
      await this._initializeContracts();

      return {
        address: this.userAddress,
        provider: this.provider,
        signer: this.signer
      };
    } catch (error) {
      console.error('Failed to connect to MetaMask:', error);
      throw error;
    }
  }

  async disconnect() {
    this.provider = null;
    this.signer = null;
    this.savingsContract = null;
    this.approvalModule = null;
    this.proposalModule = null;
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

  // Balance Management
  async getTokenBalance(userAddress, tokenAddress) {
    if (!this.savingsContract) throw new Error('Contract not initialized');

    const balance = await this.savingsContract.getTokenBalance(userAddress, tokenAddress);
    return balance;
  }

  async getAllBalances(userAddress) {
    if (!this.savingsContract || !userAddress) throw new Error('Contract or address not available');

    const balances = {};

    // Skip ETH balance - only fetch stablecoins

    // Fetch token balances
    if (this.networkConfig.tokens) {
      for (const [key, token] of Object.entries(this.networkConfig.tokens)) {
        if (token.address && token.address !== "0x0000000000000000000000000000000000000000") {
          try {
            const tokenBalance = await this.savingsContract.getTokenBalance(userAddress, token.address);
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
    if (!this.savingsContract) throw new Error('Contract not initialized');

    const amountWei = this.parseAmount(amount, tokenDecimals);

    // Handle ERC20 approval if not ETH
    if (tokenAddress !== this.ETH_ADDRESS) {
      await this.approveToken(tokenAddress, this.networkConfig.savingsContract, amountWei);
    }

    // Execute deposit
    const depositTx = await this.savingsContract["deposit(address,uint256)"](
      tokenAddress,
      amountWei,
      {
        value: tokenAddress === this.ETH_ADDRESS ? amountWei : 0,
      }
    );

    const receipt = await depositTx.wait();
    return {
      hash: depositTx.hash,
      receipt: receipt,
      success: true
    };
  }

  async approveToken(tokenAddress, spenderAddress, amount) {
    if (!this.signer) throw new Error('Signer not available');

    const tokenContract = new ethers.Contract(tokenAddress, MockUSDT_ABI, this.signer);
    const approvalTx = await tokenContract.approve(spenderAddress, amount);
    await approvalTx.wait();

    return {
      hash: approvalTx.hash,
      success: true
    };
  }

  // Withdrawal Operations
  async withdraw(amount, tokenAddress, destination = null) {
    if (!this.savingsContract) throw new Error('Contract not initialized');

    const amountWei = this.parseAmount(amount, 6); // Assuming USDT decimals

    let tx;
    if (destination) {
      tx = await this.savingsContract.withdrawTo(amountWei, tokenAddress, destination);
    } else {
      tx = await this.savingsContract.withdraw(amountWei, tokenAddress);
    }

    const receipt = await tx.wait();
    return {
      hash: tx.hash,
      receipt: receipt,
      success: true
    };
  }

  // Proxy Management
  async isProxyDeployed(userAddress) {
    if (!this.savingsContract) throw new Error('Contract not initialized');
    return await this.savingsContract.isProxyDeployed(userAddress);
  }

  async getDepositAddress(userAddress) {
    if (!this.savingsContract) throw new Error('Contract not initialized');
    return await this.savingsContract.getUserDepositAddress(userAddress);
  }

  async deployProxy() {
    if (!this.savingsContract) throw new Error('Contract not initialized');

    const tx = await this.savingsContract.deployUserProxy();
    const receipt = await tx.wait();

    return {
      hash: tx.hash,
      receipt: receipt,
      success: true
    };
  }

  // Spending Limits
  async getSpendingLimits(userAddress) {
    if (!this.savingsContract) throw new Error('Contract not initialized');

    const spendingData = await this.savingsContract.getUserSpendingLimits(userAddress);
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

    // Return unified format that matches the service expectation
    return {
      limits: fetchedLimits,
      isSetupCommitted: false // TODO: Get this from contract if method exists
    };
  }

  async setSpendingLimits(daily, weekly, monthly) {
    if (!this.savingsContract) throw new Error('Contract not initialized');

    const dailyLimitWei = daily > 0 ? this.parseAmount(daily.toString(), 6) : 0;
    const weeklyLimitWei = weekly > 0 ? this.parseAmount(weekly.toString(), 6) : 0;
    const monthlyLimitWei = monthly > 0 ? this.parseAmount(monthly.toString(), 6) : 0;

    const tx = await this.savingsContract.setCommonPeriodLimits(
      dailyLimitWei,
      weeklyLimitWei,
      monthlyLimitWei
    );

    const receipt = await tx.wait();
    return {
      hash: tx.hash,
      receipt: receipt,
      success: true
    };
  }

  async addSpendingLimit(periodName, limit) {
    if (!this.savingsContract) throw new Error('Contract not initialized');

    const limitWei = ethers.parseUnits(limit.toString(), 6);

    // Determine duration based on period name
    const durations = {
      'Daily': 86400,      // 1 day
      'Weekly': 604800,    // 7 days
      'Monthly': 2592000   // 30 days
    };

    const duration = durations[periodName];
    if (!duration) {
      throw new Error('Invalid period name. Must be Daily, Weekly, or Monthly');
    }

    const tx = await this.savingsContract.addTimePeriodLimit(
      periodName,
      limitWei,
      duration
    );

    await tx.wait();
    return tx.hash;
  }

  // Proposal Management
  async proposeLimitChange(periodName, newLimit) {
    if (!this.savingsContract) throw new Error('Savings contract not initialized');
    if (!this.userAddress) throw new Error('User not connected');

    const limitWei = ethers.parseUnits(newLimit.toString(), 6);
    const tx = await this.savingsContract.proposeLimitChange(
      periodName,
      limitWei
    );
    await tx.wait();

    return tx.hash;
  }

  // Fetch pending proposals from the contract
  async fetchPendingProposals(userAddress = null) {
    try {
      if (!this.savingsContract) {
        console.log('❌ Savings contract not available, skipping proposal fetch');
        return [];
      }

      const targetAddress = userAddress || this.userAddress;
      if (!targetAddress) {
        console.log('❌ No user address available for fetching pending proposals');
        return [];
      }

      console.log('📋 Fetching EVM pending proposals from contract...');

      // Call the contract method to get pending proposals
      const [proposalIds, categories, newLimits, executeAfters, isIncreaseFlags] =
        await this.savingsContract.getUserPendingProposals();

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
          createdAt: executeAfterTimestamp - (24 * 60 * 60), // Estimate created time
          action: 'change',
          networkType: 'evm',
          timeRemaining,
          canExecute,
          timeRemainingText: timeRemaining > 0 ? this.formatTimeRemaining(timeRemaining) : 'Ready to execute'
        });
      }

      console.log(`📋 Formatted ${proposals.length} EVM proposals for display`);
      return proposals;
    } catch (error) {
      console.error('Error fetching EVM pending proposals:', error);
      return [];
    }
  }

  // Helper function to format time remaining (matching Solana implementation)
  formatTimeRemaining(seconds) {
    if (seconds <= 0) return 'Ready to execute';

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
        throw new Error('Savings contract not initialized');
      }
      if (!this.userAddress) {
        throw new Error('User not connected');
      }

      console.log('🔄 Executing EVM proposal:', proposalId);

      // Call the contract method to execute the proposal
      const tx = await this.savingsContract.executeLimitProposal(proposalId);
      await tx.wait();

      console.log('✅ EVM proposal executed successfully:', tx.hash);
      return tx.hash;
    } catch (error) {
      console.error('❌ Error executing EVM proposal:', error);
      throw new Error(`Proposal execution failed: ${error.message}`);
    }
  }

  // Cancel a pending proposal
  async cancelLimitProposal(proposalId) {
    try {
      if (!this.savingsContract) {
        throw new Error('Savings contract not initialized');
      }
      if (!this.userAddress) {
        throw new Error('User not connected');
      }

      console.log('🔄 Cancelling EVM proposal:', proposalId);

      // Call the contract method to cancel the proposal
      const tx = await this.savingsContract.cancelLimitProposal(proposalId);
      await tx.wait();

      console.log('✅ EVM proposal cancelled successfully:', tx.hash);
      return tx.hash;
    } catch (error) {
      console.error('❌ Error cancelling EVM proposal:', error);
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
    if (!this.savingsContract) throw new Error('Contract not initialized');

    // Convert to Wei (contract expects 6 decimal places for USDT-compatible amounts)
    const dailyWei = dailyLimit > 0 ? ethers.parseUnits(dailyLimit.toString(), 6) : 0;
    const weeklyWei = weeklyLimit > 0 ? ethers.parseUnits(weeklyLimit.toString(), 6) : 0;
    const monthlyWei = monthlyLimit > 0 ? ethers.parseUnits(monthlyLimit.toString(), 6) : 0;

    try {
      // Call the unified commitSetup method we added to the contract
      const tx = await this.savingsContract.commitSetup(dailyWei, weeklyWei, monthlyWei);
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
      this.signer
    );

    // Initialize modules
    try {
      const moduleAddresses = await import('../moduleAddresses.json');

      // Initialize approval module
      const approvalModuleAddress = moduleAddresses.modules.approvalSystem;
      this.approvalModule = new ethers.Contract(
        approvalModuleAddress,
        ApprovalSystemModuleABI,
        this.signer
      );

      // Initialize proposal module
      const proposalModuleAddress = moduleAddresses.modules.proposalSystem;
      this.proposalModule = new ethers.Contract(
        proposalModuleAddress,
        ProposalSystemModuleABI,
        this.signer
      );
    } catch (error) {
      console.warn('Could not initialize modules:', error);
    }
  }

  // Bypass Requests (unified adapter pattern)
  async fetchPendingBypassRequests(userAddress = null) {
    if (!this.savingsContract) throw new Error('Contract not initialized');

    // Note: getUserActiveBypassRequests() uses msg.sender, so no user parameter needed
    const bypassData = await this.savingsContract.getUserActiveBypassRequests();
    const [requestIds, amounts, skipPeriods, tokens, executeAfters] = bypassData;

    const requests = [];
    for (let i = 0; i < requestIds.length; i++) {
      requests.push({
        requestId: requestIds[i],
        amount: this.formatAmount(amounts[i], 6), // Format to USDT units
        skipPeriod: skipPeriods[i],
        token: tokens[i],
        executeAfter: executeAfters[i].toString()
      });
    }

    return requests;
  }

  // Withdrawal Destination Requests (unified adapter pattern)
  async getPendingWithdrawalDestinationRequests(userAddress = null) {
    if (!this.savingsContract) throw new Error('Contract not initialized');

    const targetAddress = userAddress || await this.getAddress();

    try {
      // This would call a contract method like getUserPendingWithdrawalDestinationRequests
      // For now, returning empty array since the exact contract method needs to be confirmed
      console.log('🔍 EVMAdapter: Fetching withdrawal destination requests for', targetAddress);
      console.log('⚠️ EVMAdapter: getPendingWithdrawalDestinationRequests not yet implemented');
      return [];
    } catch (error) {
      console.error('❌ EVMAdapter: Error fetching withdrawal destination requests:', error);
      return [];
    }
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
}