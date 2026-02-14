import networkConfig from "../networkConfig.json";

/**
 * Network filtering utilities for production vs development environments
 */

// Zero address constant - indicates undeployed contract
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Check if a network has deployed contracts (non-zero addresses)
 * @param {string} networkType - "evm" or "solana"
 * @param {string} networkKey - Network key (e.g., "ethereum", "polygon", "localhost")
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
  const networks = networkConfig[networkType] || {};
  const networkList = Object.entries(networks).map(([key, config]) => ({
    key,
    name: config.name,
    deployed: isNetworkDeployed(networkType, key),
    chainId: config.chainId,
    isLocal: key === "localhost"
  }));

  // Check environment variables for production overrides
  const showLocalhost = process.env.REACT_APP_SHOW_LOCALHOST !== 'false';
  const showUndeployed = process.env.REACT_APP_SHOW_UNDEPLOYED_NETWORKS !== 'false';
  const isProduction = environment === "production" || process.env.REACT_APP_ENVIRONMENT === "production";

  console.log(`🌐 Network filtering - Environment: ${environment}, Production: ${isProduction}`);

  // In production, only show deployed networks (exclude localhost and undeployed)
  if (isProduction) {
    const filtered = networkList.filter(network => {
      // Always exclude localhost in production unless explicitly enabled
      if (network.isLocal && !showLocalhost) {
        console.log(`   Filtering out ${network.name} (localhost)`);
        return false;
      }

      // Exclude undeployed networks in production unless explicitly enabled
      if (!network.deployed && !showUndeployed) {
        console.log(`   Filtering out ${network.name} (not deployed)`);
        return false;
      }

      console.log(`   Including ${network.name} (deployed: ${network.deployed})`);
      return true;
    });

    console.log(`🎯 Production networks available: ${filtered.map(n => n.name).join(', ')}`);
    return filtered;
  }

  // In development, show all networks but mark deployment status
  console.log(`🔧 Development networks available: ${networkList.map(n => n.name).join(', ')}`);
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
  evm: ["ethereum", "polygon", "optimism"],
  solana: ["mainnet", "devnet"]
};

/**
 * Get the default network for a network type based on environment
 * @param {string} networkType - "evm" or "solana"
 * @returns {string} Default network key
 */
export const getDefaultNetwork = (networkType) => {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment) {
    // In development, prefer localhost if available
    return "localhost";
  }

  // In production, get the first available deployed network
  const availableNetworks = getAvailableNetworks(networkType, "production");
  if (availableNetworks.length > 0) {
    // Priority order for production defaults
    const priorities = {
      evm: ["ethereum", "polygon", "optimism"],
      solana: ["mainnet", "devnet"]
    };

    const priorityList = priorities[networkType] || [];
    for (const networkKey of priorityList) {
      const found = availableNetworks.find(n => n.key === networkKey);
      if (found) return networkKey;
    }

    // Fallback to first available
    return availableNetworks[0].key;
  }

  // Last resort fallback
  return networkType === "evm" ? "ethereum" : "mainnet";
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