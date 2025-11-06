/**
 * Network Isolation Utilities
 * Ensures proper separation between EVM and Solana network states
 */

/**
 * Validate that network configuration matches expected network type
 * @param {string} networkType - 'evm' or 'solana'
 * @param {object} networkConfig - Network configuration object
 * @returns {boolean} True if valid, false otherwise
 */
export const validateNetworkConfig = (networkType, networkConfig) => {
  if (!networkConfig) {
    console.warn(`Invalid network config for ${networkType}: null/undefined`);
    return false;
  }

  if (networkType === 'evm') {
    const requiredEvmFields = ['chainId', 'name', 'nativeCurrency', 'rpcUrls'];
    const hasRequiredFields = requiredEvmFields.every(field => networkConfig[field]);

    if (!hasRequiredFields) {
      console.warn(`EVM network config missing required fields:`, {
        config: networkConfig,
        required: requiredEvmFields
      });
      return false;
    }

    // Validate EVM-specific structure
    if (!networkConfig.nativeCurrency?.symbol || !networkConfig.nativeCurrency?.decimals) {
      console.warn('EVM network config has invalid nativeCurrency structure');
      return false;
    }

    return true;
  }

  if (networkType === 'solana') {
    const requiredSolanaFields = ['network', 'name', 'rpcUrl'];
    const hasRequiredFields = requiredSolanaFields.every(field => networkConfig[field]);

    if (!hasRequiredFields) {
      console.warn(`Solana network config missing required fields:`, {
        config: networkConfig,
        required: requiredSolanaFields
      });
      return false;
    }

    // Validate Solana-specific structure
    if (!['localhost', 'devnet', 'testnet', 'mainnet-beta'].includes(networkConfig.network)) {
      console.warn(`Invalid Solana network: ${networkConfig.network}`);
      return false;
    }

    return true;
  }

  console.warn(`Unknown network type: ${networkType}`);
  return false;
};

/**
 * Get network-specific storage key
 * @param {string} networkType - 'evm' or 'solana'
 * @param {string} key - Storage key
 * @returns {string} Prefixed storage key
 */
export const getNetworkStorageKey = (networkType, key) => {
  return `${networkType}_${key}`;
};

/**
 * Clear network-specific storage
 * @param {string} networkType - 'evm' or 'solana'
 * @param {string[]} keys - Keys to clear
 */
export const clearNetworkStorage = (networkType, keys = []) => {
  const defaultKeys = [
    'balances',
    'userAddress',
    'lastConnectedWallet',
    'cachedTransactions',
    'spendingLimits',
    'pendingProposals'
  ];

  const keysToClean = keys.length > 0 ? keys : defaultKeys;

  keysToClean.forEach(key => {
    const storageKey = getNetworkStorageKey(networkType, key);
    localStorage.removeItem(storageKey);
  });

  console.log(`🧹 Cleared ${networkType} network storage:`, keysToClean);
};

/**
 * Get isolated network storage
 * @param {string} networkType - 'evm' or 'solana'
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if not found
 * @returns {any} Stored value or default
 */
export const getNetworkStorage = (networkType, key, defaultValue = null) => {
  try {
    const storageKey = getNetworkStorageKey(networkType, key);
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.warn(`Error reading network storage for ${networkType}:${key}:`, error);
    return defaultValue;
  }
};

/**
 * Set isolated network storage
 * @param {string} networkType - 'evm' or 'solana'
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 */
export const setNetworkStorage = (networkType, key, value) => {
  try {
    const storageKey = getNetworkStorageKey(networkType, key);
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    console.warn(`Error setting network storage for ${networkType}:${key}:`, error);
  }
};

/**
 * Validate wallet connection for network type
 * @param {string} networkType - 'evm' or 'solana'
 * @param {object} walletInfo - Wallet connection info
 * @returns {boolean} True if wallet connection is valid for network type
 */
export const validateWalletForNetwork = (networkType, walletInfo) => {
  if (networkType === 'evm') {
    return !!(walletInfo.provider && walletInfo.signer && walletInfo.userAddress);
  }

  if (networkType === 'solana') {
    return !!(walletInfo.connected && walletInfo.publicKey && walletInfo.connection);
  }

  return false;
};

/**
 * Get network-appropriate token list
 * @param {string} networkType - 'evm' or 'solana'
 * @param {object} networkConfig - Network configuration
 * @returns {object} Token list for the network
 */
export const getNetworkTokens = (networkType, networkConfig) => {
  if (!networkConfig || !networkConfig.tokens) {
    console.warn(`No tokens found for ${networkType} network`);
    return {};
  }

  const tokens = { ...networkConfig.tokens };

  // Add native token for each network type
  if (networkType === 'evm') {
    tokens.ETH = {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      recommended: true,
      native: true
    };
  } else if (networkType === 'solana') {
    // SOL is usually already in the config, but ensure it's marked as native
    if (tokens.SOL) {
      tokens.SOL.native = true;
    }
  }

  return tokens;
};

/**
 * Check if current state is compatible with network type
 * @param {string} networkType - Target network type
 * @param {object} currentState - Current application state
 * @returns {object} Validation result with issues
 */
export const validateNetworkCompatibility = (networkType, currentState) => {
  const issues = [];
  const warnings = [];

  // Check wallet compatibility
  if (networkType === 'evm') {
    if (currentState.solanaConnected && !currentState.provider) {
      warnings.push('Solana wallet connected but switching to EVM - will disconnect Solana');
    }
    if (!window.ethereum) {
      issues.push('MetaMask not installed - required for EVM networks');
    }
  } else if (networkType === 'solana') {
    if (currentState.provider && !currentState.solanaConnected) {
      warnings.push('EVM wallet connected but switching to Solana - will need Solana wallet');
    }
  }

  // Check for mixed state
  if (currentState.networkType !== networkType) {
    const hasEvmState = !!(currentState.provider || currentState.signer);
    const hasSolanaState = !!(currentState.solanaConnected || currentState.solanaPublicKey);

    if (hasEvmState && hasSolanaState) {
      warnings.push('Mixed EVM and Solana state detected - will clear on network switch');
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    canProceed: issues.length === 0
  };
};

/**
 * Create network-isolated state cleaner
 * @param {string} currentNetworkType - Current network type
 * @param {string} targetNetworkType - Target network type
 * @returns {function} State cleaner function
 */
export const createNetworkStateCleaner = (currentNetworkType, targetNetworkType) => {
  return (stateClearers) => {
    console.log(`🔄 Cleaning state for network switch: ${currentNetworkType} → ${targetNetworkType}`);

    // Clear storage for current network
    if (currentNetworkType) {
      clearNetworkStorage(currentNetworkType);
    }

    // Clear React state
    if (stateClearers) {
      if (typeof stateClearers === 'function') {
        stateClearers();
      } else if (typeof stateClearers === 'object') {
        // If stateClearers is an object with specific clearers
        Object.values(stateClearers).forEach(clearer => {
          if (typeof clearer === 'function') {
            clearer();
          }
        });
      }
    }

    console.log(`✅ State cleaned for ${targetNetworkType} network`);
  };
};