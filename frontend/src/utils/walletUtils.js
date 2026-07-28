// Wallet and network utility functions
// Extracted from App.js for better organization and reusability

import networkConfig from "../networkConfig.json";
import { getPeriodDuration } from "./spendingPeriods.js";

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

  // For EVM networks, use direct config (MetaMask provider approach, no private RPC needed)
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
const formatTimeRemaining = (seconds) => {
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

  // Find the first period that would be exceeded, prioritizing shorter periods.
  // Ordering comes from the period's own window, so a custom period sorts
  // correctly alongside the standard ones.
  const windowOf = (limit) =>
    Number(limit.duration) || getPeriodDuration(limit.name) || Number.MAX_SAFE_INTEGER;

  const exceedingPeriods = spendingLimits
    .filter((limit) => limit.active && numericAmount > limit.remaining)
    .sort((a, b) => windowOf(a) - windowOf(b));

  return exceedingPeriods.length > 0 ? exceedingPeriods[0].name : null;
};

// Check if there's a pending proposal for a specific period name
const hasPendingProposalForPeriod = (periodName, pendingLimitProposals) => {
  return pendingLimitProposals.some(
    (proposal) => proposal.periodName === periodName
  );
};

// Check if user is on the correct network
const isCorrectNetwork = (networkType, selectedNetwork, solanaConnected, currentChainId) => {
  if (networkType === "solana") {
    // For Solana, consider connected if wallet is connected
    return solanaConnected;
  }

  // For EVM networks
  const expectedNetwork = getCurrentNetwork(networkType, selectedNetwork);
  return currentChainId === expectedNetwork.chainId;
};

// Export all utility functions
export {
  NETWORKS,
  getNetworkByChainId,
  getCurrentNetwork,
  isSolanaNetwork,
  formatCountdown,
  formatTimeRemaining,
  calculateInstantWithdrawableAmount,
  detectExceedingPeriod,
  hasPendingProposalForPeriod,
  isCorrectNetwork,
};