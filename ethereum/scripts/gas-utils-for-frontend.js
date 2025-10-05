/**
 * Gas estimation utilities for frontend integration
 * These functions can be imported into React components to show real-time gas costs
 */

const { ethers } = require("ethers");

// Operation categories and gas estimates (can be updated from backend)
const OPERATION_GAS_ESTIMATES = {
  // User Setup
  "deployUserProxy": 250000,
  "setCommonPeriodLimits": 180000,
  "commitInitialSetup": 120000,
  "addApprovalAddress": 80000,

  // Deposits
  "deposit_ETH": 120000,
  "deposit_ERC20": 150000,

  // Withdrawals
  "withdraw_simple": 150000,
  "withdrawTo": 180000,

  // Pending Requests
  "requestLimitBypass": 200000,
  "proposeLimitRemoval": 120000,
  "requestWithdrawalAddress": 140000,

  // Execute Requests
  "executeBypassWithdrawal": 180000,
  "executeLimitProposal": 100000,
  "executeWithdrawalAddressRequest": 120000,

  // Management
  "revokeApprovalAddress": 60000,
  "addTimePeriodLimit": 120000,
  "removeTimePeriodLimit": 100000,
  "cancelLimitProposal": 80000,
  "cancelBypassRequest": 80000
};

// Setup strategies for cost calculation
const SETUP_STRATEGIES = {
  MINIMAL: {
    name: "Minimal Setup",
    operations: ["commitInitialSetup"],
    description: "Basic timelock protection only"
  },
  BASIC: {
    name: "Basic Setup",
    operations: ["setCommonPeriodLimits", "addApprovalAddress", "commitInitialSetup"],
    description: "Essential security without UserProxy"
  },
  ENHANCED: {
    name: "Enhanced Setup",
    operations: ["deployUserProxy", "setCommonPeriodLimits", "addApprovalAddress", "commitInitialSetup"],
    description: "Full setup with deposit address"
  }
};

// Request/Execute pairs with timelock info
const REQUEST_EXECUTE_PAIRS = {
  LIMIT_BYPASS: {
    name: "Limit Bypass",
    request: "requestLimitBypass",
    execute: "executeBypassWithdrawal",
    timelock: "24-72 hours",
    description: "Emergency withdrawal above limits"
  },
  LIMIT_CHANGE: {
    name: "Spending Limit Change",
    request: "proposeLimitRemoval",
    execute: "executeLimitProposal",
    timelock: "24-72 hours",
    description: "Remove or modify spending limits"
  },
  WITHDRAWAL_ADDRESS: {
    name: "Withdrawal Address",
    request: "requestWithdrawalAddress",
    execute: "executeWithdrawalAddressRequest",
    timelock: "24-72 hours",
    description: "Add new withdrawal destination"
  }
};

/**
 * Gas estimation utility class for frontend use
 */
class FrontendGasUtils {
  constructor() {
    this.provider = null;
    this.ethPrice = 2000; // Default ETH price, should be updated
    this.currentGasPrice = ethers.parseUnits("20", "gwei"); // Default gas price
  }

  /**
   * Initialize with provider and fetch current gas prices
   */
  async initialize(provider) {
    this.provider = provider;
    await this.updateGasPrice();
    await this.updateETHPrice();
  }

  /**
   * Update current gas price from provider
   */
  async updateGasPrice() {
    if (!this.provider) return;

    try {
      const feeData = await this.provider.getFeeData();
      this.currentGasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
    } catch (error) {
      console.warn("Could not fetch gas price:", error.message);
    }
  }

  /**
   * Update ETH price from external API
   */
  async updateETHPrice() {
    try {
      const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      const data = await response.json();
      this.ethPrice = data.ethereum?.usd || 2000;
    } catch (error) {
      console.warn("Could not fetch ETH price:", error.message);
    }
  }

  /**
   * Calculate cost for a single operation
   * @param {string} operationName - Name of operation
   * @param {number} congestionMultiplier - 1.0 for normal, 1.5 for busy, 2.5 for high, 5.0 for extreme
   * @returns {Object} Cost breakdown
   */
  calculateOperationCost(operationName, congestionMultiplier = 1.0) {
    const gasEstimate = OPERATION_GAS_ESTIMATES[operationName];
    if (!gasEstimate) {
      throw new Error(`Unknown operation: ${operationName}`);
    }

    const adjustedGasPrice = this.currentGasPrice * BigInt(Math.floor(congestionMultiplier * 100)) / BigInt(100);
    const costWei = BigInt(gasEstimate) * adjustedGasPrice;
    const costETH = parseFloat(ethers.formatEther(costWei));
    const costUSD = costETH * this.ethPrice;

    return {
      operation: operationName,
      gasEstimate,
      gasPriceGwei: parseFloat(ethers.formatUnits(adjustedGasPrice, "gwei")),
      costWei: costWei.toString(),
      costETH: costETH.toFixed(6),
      costUSD: costUSD.toFixed(2),
      congestionMultiplier
    };
  }

  /**
   * Calculate total cost for a setup strategy
   * @param {string} strategyName - MINIMAL, BASIC, or ENHANCED
   * @param {number} congestionMultiplier - Congestion level
   * @returns {Object} Strategy cost breakdown
   */
  calculateSetupCost(strategyName, congestionMultiplier = 1.0) {
    const strategy = SETUP_STRATEGIES[strategyName];
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyName}`);
    }

    const operations = strategy.operations.map(op =>
      this.calculateOperationCost(op, congestionMultiplier)
    );

    const totalCostWei = operations.reduce((sum, op) => sum + BigInt(op.costWei), BigInt(0));
    const totalCostETH = parseFloat(ethers.formatEther(totalCostWei));
    const totalCostUSD = totalCostETH * this.ethPrice;
    const totalGas = operations.reduce((sum, op) => sum + op.gasEstimate, 0);

    return {
      strategy: strategy.name,
      description: strategy.description,
      operations,
      totalGas,
      totalCostWei: totalCostWei.toString(),
      totalCostETH: totalCostETH.toFixed(6),
      totalCostUSD: totalCostUSD.toFixed(2),
      congestionMultiplier
    };
  }

  /**
   * Calculate cost for request+execute operation pair
   * @param {string} pairName - LIMIT_BYPASS, LIMIT_CHANGE, or WITHDRAWAL_ADDRESS
   * @param {number} congestionMultiplier - Congestion level
   * @returns {Object} Pair cost breakdown
   */
  calculateRequestExecuteCost(pairName, congestionMultiplier = 1.0) {
    const pair = REQUEST_EXECUTE_PAIRS[pairName];
    if (!pair) {
      throw new Error(`Unknown request/execute pair: ${pairName}`);
    }

    const requestCost = this.calculateOperationCost(pair.request, congestionMultiplier);
    const executeCost = this.calculateOperationCost(pair.execute, congestionMultiplier);

    const totalCostWei = BigInt(requestCost.costWei) + BigInt(executeCost.costWei);
    const totalCostETH = parseFloat(ethers.formatEther(totalCostWei));
    const totalCostUSD = totalCostETH * this.ethPrice;

    return {
      pair: pair.name,
      description: pair.description,
      timelock: pair.timelock,
      request: requestCost,
      execute: executeCost,
      totalCostWei: totalCostWei.toString(),
      totalCostETH: totalCostETH.toFixed(6),
      totalCostUSD: totalCostUSD.toFixed(2),
      congestionMultiplier
    };
  }

  /**
   * Get congestion level description
   * @param {number} gasPriceGwei - Current gas price in gwei
   * @returns {Object} Congestion info
   */
  getCongestionLevel(gasPriceGwei = null) {
    const currentGwei = gasPriceGwei || parseFloat(ethers.formatUnits(this.currentGasPrice, "gwei"));

    if (currentGwei < 10) {
      return { level: "LOW", name: "Low", multiplier: 1.0, color: "green", description: "Great time to transact" };
    } else if (currentGwei < 20) {
      return { level: "NORMAL", name: "Normal", multiplier: 1.0, color: "blue", description: "Good conditions" };
    } else if (currentGwei < 50) {
      return { level: "MEDIUM", name: "Busy", multiplier: 1.5, color: "orange", description: "Consider waiting" };
    } else if (currentGwei < 100) {
      return { level: "HIGH", name: "High", multiplier: 2.5, color: "red", description: "Expensive, wait if possible" };
    } else {
      return { level: "EXTREME", name: "Extreme", multiplier: 5.0, color: "red", description: "Wait for lower gas" };
    }
  }

  /**
   * Compare all setup strategies at current gas prices
   * @returns {Array} Array of strategy costs sorted by price
   */
  compareSetupStrategies() {
    const congestion = this.getCongestionLevel();
    const strategies = Object.keys(SETUP_STRATEGIES).map(strategyName =>
      this.calculateSetupCost(strategyName, congestion.multiplier)
    );

    return strategies.sort((a, b) => parseFloat(a.totalCostUSD) - parseFloat(b.totalCostUSD));
  }

  /**
   * Get all request/execute pairs with current costs
   * @returns {Array} Array of pair costs
   */
  getAllRequestExecuteCosts() {
    const congestion = this.getCongestionLevel();
    return Object.keys(REQUEST_EXECUTE_PAIRS).map(pairName =>
      this.calculateRequestExecuteCost(pairName, congestion.multiplier)
    );
  }

  /**
   * Format cost for display in UI
   * @param {string|number} costUSD - Cost in USD
   * @param {string|number} costETH - Cost in ETH (optional)
   * @returns {string} Formatted cost string
   */
  formatCostForUI(costUSD, costETH = null) {
    const usd = parseFloat(costUSD);

    if (usd < 0.01) {
      return "<$0.01";
    } else if (usd < 1) {
      return `$${usd.toFixed(2)}`;
    } else if (usd < 10) {
      return `$${usd.toFixed(2)}`;
    } else {
      return `$${Math.round(usd)}`;
    }
  }

  /**
   * Get current network status summary
   * @returns {Object} Network status for UI display
   */
  getNetworkStatus() {
    const gasPriceGwei = parseFloat(ethers.formatUnits(this.currentGasPrice, "gwei"));
    const congestion = this.getCongestionLevel(gasPriceGwei);

    return {
      gasPrice: gasPriceGwei.toFixed(1),
      gasPriceFormatted: `${gasPriceGwei.toFixed(1)} gwei`,
      ethPrice: this.ethPrice,
      ethPriceFormatted: `$${this.ethPrice.toLocaleString()}`,
      congestion,
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * React Hook for gas estimation (example implementation)
 */
const useGasEstimation = (provider) => {
  const [gasUtils, setGasUtils] = React.useState(null);
  const [networkStatus, setNetworkStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const initializeGasUtils = async () => {
      try {
        const utils = new FrontendGasUtils();
        await utils.initialize(provider);
        setGasUtils(utils);
        setNetworkStatus(utils.getNetworkStatus());
        setLoading(false);
      } catch (error) {
        console.error("Failed to initialize gas utils:", error);
        setLoading(false);
      }
    };

    if (provider) {
      initializeGasUtils();

      // Update every 30 seconds
      const interval = setInterval(async () => {
        if (gasUtils) {
          await gasUtils.updateGasPrice();
          await gasUtils.updateETHPrice();
          setNetworkStatus(gasUtils.getNetworkStatus());
        }
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [provider]);

  return {
    gasUtils,
    networkStatus,
    loading,
    calculateOperationCost: gasUtils?.calculateOperationCost.bind(gasUtils),
    calculateSetupCost: gasUtils?.calculateSetupCost.bind(gasUtils),
    calculateRequestExecuteCost: gasUtils?.calculateRequestExecuteCost.bind(gasUtils),
    compareSetupStrategies: gasUtils?.compareSetupStrategies.bind(gasUtils),
    formatCostForUI: gasUtils?.formatCostForUI.bind(gasUtils)
  };
};

// Example React component usage
const GasCostDisplay = ({ operationName, provider }) => {
  const { calculateOperationCost, networkStatus, loading } = useGasEstimation(provider);

  if (loading) return <div>Loading gas estimates...</div>;
  if (!calculateOperationCost) return <div>Gas estimation unavailable</div>;

  try {
    const cost = calculateOperationCost(operationName);
    return (
      <div className="gas-cost-display">
        <span className="operation-name">{operationName}</span>
        <span className="cost">{cost.costUSD} USD</span>
        <span className="gas">{cost.gasEstimate.toLocaleString()} gas</span>
        <div className="network-status" style={{ color: networkStatus.congestion.color }}>
          {networkStatus.congestion.name} congestion
        </div>
      </div>
    );
  } catch (error) {
    return <div>Error calculating cost: {error.message}</div>;
  }
};

// Node.js exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FrontendGasUtils,
    OPERATION_GAS_ESTIMATES,
    SETUP_STRATEGIES,
    REQUEST_EXECUTE_PAIRS,
    useGasEstimation,
    GasCostDisplay
  };
}

// Browser exports
if (typeof window !== 'undefined') {
  window.SavingsWalletGasUtils = {
    FrontendGasUtils,
    OPERATION_GAS_ESTIMATES,
    SETUP_STRATEGIES,
    REQUEST_EXECUTE_PAIRS,
    useGasEstimation,
    GasCostDisplay
  };
}