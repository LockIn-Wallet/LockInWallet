/**
 * Treasury Configuration
 *
 * Handles different treasury addresses for different environments
 */

const TREASURY_CONFIG = {
  // Localhost/testing environment - uses random address
  localhost: {
    treasuryAddress: 'Aa1wdTb1h3NyRKVBZTahZhWBWMWKCS1bZgLJ7amVAzLd',
    network: 'localnet',
    rpcUrl: 'http://127.0.0.1:8899',
    activationFeeSol: 0.1,
    description: 'Random treasury address for localhost testing'
  },

  // Development/testnet environment
  devnet: {
    treasuryAddress: '4xo6a3qHYgtsDkKUAy1wMQhyN1zoXo3tKPR5foxa3hV4',
    network: 'devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    activationFeeSol: 0.1,
    description: 'Production treasury address for devnet'
  },

  // Production environment - your actual treasury
  mainnet: {
    treasuryAddress: '4xo6a3qHYgtsDkKUAy1wMQhyN1zoXo3tKPR5foxa3hV4',
    network: 'mainnet-beta',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    activationFeeSol: 0.1,
    description: 'Production treasury address for mainnet'
  }
};

/**
 * Get treasury configuration for environment
 * @param {string} environment - localhost, devnet, or mainnet
 * @returns {object} Treasury configuration
 */
function getTreasuryConfig(environment = 'localhost') {
  const config = TREASURY_CONFIG[environment];

  if (!config) {
    throw new Error(`Unknown environment: ${environment}. Valid options: ${Object.keys(TREASURY_CONFIG).join(', ')}`);
  }

  return config;
}

/**
 * Auto-detect environment based on RPC URL or explicit setting
 * @param {string} rpcUrl - Optional RPC URL to detect environment
 * @param {string} explicitEnv - Explicit environment override
 * @returns {string} Environment name
 */
function detectEnvironment(rpcUrl = null, explicitEnv = null) {
  if (explicitEnv) {
    return explicitEnv;
  }

  if (rpcUrl) {
    if (rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost')) {
      return 'localhost';
    } else if (rpcUrl.includes('devnet')) {
      return 'devnet';
    } else if (rpcUrl.includes('mainnet')) {
      return 'mainnet';
    }
  }

  // Default to localhost for development
  return 'localhost';
}

/**
 * Get treasury address for current environment
 * @param {string} environment - Optional environment override
 * @returns {string} Treasury address
 */
function getTreasuryAddress(environment = null) {
  const env = environment || detectEnvironment();
  return getTreasuryConfig(env).treasuryAddress;
}

/**
 * Get all treasury addresses for reference
 * @returns {object} All treasury addresses by environment
 */
function getAllTreasuryAddresses() {
  const addresses = {};
  Object.keys(TREASURY_CONFIG).forEach(env => {
    addresses[env] = TREASURY_CONFIG[env].treasuryAddress;
  });
  return addresses;
}

module.exports = {
  TREASURY_CONFIG,
  getTreasuryConfig,
  detectEnvironment,
  getTreasuryAddress,
  getAllTreasuryAddresses
};