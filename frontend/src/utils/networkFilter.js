import networkConfig from "../networkConfig.json";
import { isSolanaEnabled } from "./featureFlags.js";

/**
 * Network filtering utilities for production vs development environments
 */

// Zero address constant - indicates undeployed contract
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Check if a network has deployed contracts (non-zero addresses)
 * @param {string} networkType - "evm" or "solana"
 * @param {string} networkKey - Network key (e.g., "ethereum", "optimism", "localhost")
 * @returns {boolean} True if network has deployed contracts
 */
export const isNetworkDeployed = (networkType, networkKey) => {
  const network = networkConfig[networkType]?.[networkKey];
  if (!network) return false;

  if (networkType === "evm") {
    // For EVM networks, check if savingsContract is deployed
    return network.savingsContract && network.savingsContract !== ZERO_ADDRESS;
  } else if (networkType === "solana") {
    // For Solana networks, check if programId exists and is valid
    return network.programId && network.programId.length > 0;
  }

  return false;
};

/**
 * Get available networks for a given network type, filtered by environment
 * @param {string} networkType - "evm" or "solana"
 * @param {string} environment - "development" or "production" (defaults to NODE_ENV)
 * @returns {Array} Array of {key, name, deployed} objects
 */
export const getAvailableNetworks = (networkType, environment = process.env.NODE_ENV) => {
  // Solana is feature-flagged off until its programs are deployed
  if (networkType === "solana" && !isSolanaEnabled()) {
    return [];
  }

  const networks = networkConfig[networkType] || {};
  const networkList = Object.entries(networks).map(([key, config]) => ({
    key,
    name: config.name,
    deployed: isNetworkDeployed(networkType, key),
    chainId: config.chainId,
    isLocal: key === "localhost"
  }));

  // Check environment variables for production overrides
  const isDevelopment = environment === "development" || process.env.NODE_ENV === "development";
  const isProduction = environment === "production" || process.env.NODE_ENV === "production" || process.env.REACT_APP_ENVIRONMENT === "production";

  // In production, default to hiding localhost and undeployed (secure defaults)
  // In development, default to showing everything (convenience defaults)
  const showLocalhost = isProduction
    ? process.env.REACT_APP_SHOW_LOCALHOST === 'true'  // Explicit opt-in for production
    : process.env.REACT_APP_SHOW_LOCALHOST !== 'false'; // Opt-out for development

  const showUndeployed = isProduction
    ? process.env.REACT_APP_SHOW_UNDEPLOYED_NETWORKS === 'true'  // Explicit opt-in for production
    : process.env.REACT_APP_SHOW_UNDEPLOYED_NETWORKS !== 'false'; // Opt-out for development

  // In production, only show deployed networks (exclude localhost and undeployed)
  if (isProduction) {
    const filtered = networkList.filter(network => {
      if (network.isLocal && !showLocalhost) return false;
      if (networkType === "solana" && (network.key === "devnet" || network.key === "mainnet")) return false;
      if (!network.deployed && !showUndeployed) return false;
      return true;
    });
    return filtered;
  }

  return networkList;
};

/**
 * Check if any production networks are available for a network type
 * @param {string} networkType - "evm" or "solana"
 * @returns {boolean} True if at least one network is deployed for production
 */
export const hasProductionNetworks = (networkType) => {
  const productionNetworks = getAvailableNetworks(networkType, "production");
  return productionNetworks.length > 0;
};

/**
 * Get network display name with deployment status
 * @param {string} networkType - "evm" or "solana"
 * @param {string} networkKey - Network key
 * @param {boolean} showStatus - Whether to append deployment status
 * @returns {string} Display name for the network
 */
export const getNetworkDisplayName = (networkType, networkKey, showStatus = false) => {
  const network = networkConfig[networkType]?.[networkKey];
  if (!network) return networkKey;

  const baseName = network.name;

  if (!showStatus) {
    return baseName;
  }

  const deployed = isNetworkDeployed(networkType, networkKey);
  const isDev = process.env.NODE_ENV === "development";

  // In development, show deployment status
  if (isDev && !deployed && networkKey !== "localhost") {
    return `${baseName} (Not Deployed)`;
  }

  return baseName;
};

/**
 * Production network constants - networks that should be available when deployed
 */
export const PRODUCTION_NETWORKS = {
  evm: ["ethereum", "optimism"],
  solana: [] // Solana networks excluded from production (devnet/mainnet removed)
};

/**
 * Get the default network for a network type based on environment
 * @param {string} networkType - "evm" or "solana"
 * @returns {string} Default network key
 */
export const getDefaultNetwork = (networkType) => {
  const environment = process.env.NODE_ENV;
  const isProduction = environment === "production" || process.env.REACT_APP_ENVIRONMENT === "production";

  if (!isProduction) {
    // In development, prefer localhost if available and deployed
    const localhostDeployed = isNetworkDeployed(networkType, "localhost");
    if (localhostDeployed) return "localhost";
  }

  // Get available networks for current environment
  const availableNetworks = getAvailableNetworks(networkType, environment);
  const deployedNetworks = availableNetworks.filter(n => n.deployed);

  if (deployedNetworks.length > 0) {
    // Priority order for deployed networks
    const priorities = {
      evm: ["optimism", "ethereum"],
      solana: ["localhost", "mainnet", "devnet"]
    };

    const priorityList = priorities[networkType] || [];
    for (const networkKey of priorityList) {
      const found = deployedNetworks.find(n => n.key === networkKey);
      if (found) return networkKey;
    }

    return deployedNetworks[0].key;
  }

  if (availableNetworks.length > 0) return availableNetworks[0].key;

  return networkType === "evm" ? "optimism" : "mainnet";
};

/**
 * Get all available networks across both EVM and Solana, unified in one list
 * @param {string} environment - "development" or "production" (defaults to NODE_ENV)
 * @returns {Array} Array of {value, label, networkType, networkKey, deployed} objects
 */
export const getAllNetworksUnified = (environment = process.env.NODE_ENV) => {
  const evmNetworks = getAvailableNetworks("evm", environment);
  const solanaNetworks = getAvailableNetworks("solana", environment);

  const unified = [];

  // Add EVM networks
  evmNetworks.forEach(network => {
    unified.push({
      value: `evm:${network.key}`,
      label: network.name,
      networkType: "evm",
      networkKey: network.key,
      deployed: network.deployed,
      isLocal: network.isLocal
    });
  });

  // Add Solana networks
  solanaNetworks.forEach(network => {
    unified.push({
      value: `solana:${network.key}`,
      label: network.name,
      networkType: "solana",
      networkKey: network.key,
      deployed: network.deployed,
      isLocal: network.isLocal
    });
  });

  return unified;
};