// Wallet and network utility functions
// Extracted from App.js for better organization and reusability

import networkConfig from "../networkConfig.json";

// Network configuration - supports both EVM and Solana
const NETWORKS = {
  evm: networkConfig.evm,
  solana: networkConfig.solana
};

// Helper functions for network management
const getNetworkByChainId = (chainId) => {
  return Object.values(NETWORKS.evm).find(
    (network) => network.chainId === chainId
  );
};

const getCurrentNetwork = (networkType, selectedNetwork) => {
  if (networkType === "solana") {
    return NETWORKS.solana[selectedNetwork] || NETWORKS.solana.localhost;
  }
  return NETWORKS.evm[selectedNetwork] || NETWORKS.evm.localhost;
};

const isSolanaNetwork = (networkType) => {
  return networkType === "solana";
};

// Helper function to format countdown timer
const formatCountdown = (executeAfter, currentTime) => {
  const remainingSeconds = executeAfter - currentTime;

  if (remainingSeconds <= 0) {
    return { text: "Ready to execute!", ready: true, color: "#48bb78" };
  }

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  if (hours > 0) {
    return {
      text: `${hours}h ${minutes}m ${seconds}s remaining`,
      ready: false,
      color: "#fbb6ce",
    };
  } else if (minutes > 0) {
    return {
      text: `${minutes}m ${seconds}s remaining`,
      ready: false,
      color: "#ed8936",
    };
  } else {
    return {
      text: `${seconds}s remaining`,
      ready: false,
      color: "#e53e3e",
    };
  }
};

// Helper function to format time remaining (matches SolanaAdapter)
export const formatTimeRemaining = (seconds) => {
  if (seconds <= 0) return "Ready to execute";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
};

// Helper function to calculate instantly withdrawable amount
const calculateInstantWithdrawableAmount = (spendingLimits) => {
  if (!spendingLimits || spendingLimits.length === 0) {
    return { amount: 0, limitingPeriod: null };
  }

  let smallestRemaining = Infinity;
  let limitingPeriod = null;

  for (const limit of spendingLimits) {
    if (
      limit.active &&
      typeof limit.remaining === "number" &&
      limit.remaining < smallestRemaining
    ) {
      smallestRemaining = limit.remaining;
      limitingPeriod = limit.name;
    }
  }

  return {
    amount: smallestRemaining === Infinity ? 0 : Number(smallestRemaining) || 0,
    limitingPeriod,
  };
};

// Helper function to detect which period limit would be exceeded
const detectExceedingPeriod = (amount, spendingLimits) => {
  if (!spendingLimits || spendingLimits.length === 0 || !amount) {
    return null;
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return null;
  }

  // Find the first period that would be exceeded, prioritizing shorter periods
  const periodPriority = { Daily: 1, Weekly: 2, Monthly: 3 };

  const exceedingPeriods = spendingLimits
    .filter((limit) => limit.active && numericAmount > limit.remaining)
    .sort((a, b) => {
      const aPriority = periodPriority[a.name] || 999;
      const bPriority = periodPriority[b.name] || 999;
      return aPriority - bPriority;
    });

  return exceedingPeriods.length > 0 ? exceedingPeriods[0].name : null;
};

// Check if there's a pending proposal for a specific period name
const hasPendingProposalForPeriod = (periodName, pendingLimitProposals) => {
  return pendingLimitProposals.some(
    (proposal) => proposal.periodName === periodName
  );
};

// Export all utility functions
export {
  NETWORKS,
  getNetworkByChainId,
  getCurrentNetwork,
  isSolanaNetwork,
  formatCountdown,
  calculateInstantWithdrawableAmount,
  detectExceedingPeriod,
  hasPendingProposalForPeriod,
};