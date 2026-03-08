/**
 * Contract deployment verification utilities
 * Uses MetaMask provider when available, falls back to public RPCs
 */

import { verifyContractDeployment, getBestProvider, ensureCorrectNetwork } from './providerManager.js';

// Environment debugging
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Verify if an EVM contract is deployed at the given address
 * Uses MetaMask provider when available, falls back to public RPCs
 * @param {string} contractAddress - Contract address to verify
 * @param {string} networkKey - Network key (e.g., "optimism")
 * @returns {boolean} True if contract is deployed, false otherwise
 */
export const verifyEVMContractDeployment = async (contractAddress, networkKey = 'optimism') => {
  // Check if address is zero address (not deployed)
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  if (!contractAddress || contractAddress === ZERO_ADDRESS) {
    console.log(`Contract verification: Invalid or zero address ${contractAddress}`);
    return false;
  }

  try {
    // Use the new provider manager
    const result = await verifyContractDeployment(contractAddress, networkKey);
    return result.isDeployed;
  } catch (error) {
    console.error('Contract verification failed:', error.message);
    return false;
  }
};

/**
 * Enhanced contract verification with network context and automatic provider selection
 * @param {string} contractAddress - Contract address to verify
 * @param {string} networkKey - Network key (e.g., "optimism")
 * @param {string} networkName - Human-readable network name (optional, for logging)
 * @returns {boolean} True if contract is deployed, false otherwise
 */
export const verifyContractWithNetworkContext = async (contractAddress, networkKey, networkName = null) => {
  const displayName = networkName || networkKey;

  console.log(`🔍 Enhanced contract verification for ${displayName}:`);
  console.log(`   Contract: ${contractAddress}`);
  console.log(`   Network: ${networkKey}`);

  try {
    // Attempt to ensure we're on the correct network (if MetaMask is available)
    await ensureCorrectNetwork(networkKey);

    // Verify the contract using the best available provider
    const result = await verifyEVMContractDeployment(contractAddress, networkKey);

    if (!result && isProduction) {
      console.error(`🚨 PRODUCTION CONTRACT VERIFICATION FAILED:`);
      console.error(`   This should not happen in production!`);
      console.error(`   Network: ${displayName}`);
      console.error(`   Address: ${contractAddress}`);
      console.error(`   Recommendation: Check MetaMask network and contract deployment status.`);
    }

    return result;
  } catch (error) {
    console.error(`❌ Enhanced contract verification failed:`, error.message);
    return false;
  }
};

/**
 * Get deployment instructions for the current network type
 * @param {string} networkType - 'evm' or 'solana'
 * @returns {string} Deployment command instructions
 */
export const getDeploymentInstructions = (networkType) => {
  if (networkType === 'evm') {
    return 'Run: npm run deploy-modular --workspace=ethereum';
  } else if (networkType === 'solana') {
    return 'Run: npm run solana:deploy-reliable';
  }
  return 'Unknown network type';
};

/**
 * Verify multiple contract addresses
 * @param {object} provider - Ethers provider instance
 * @param {object} addresses - Object with contract addresses
 * @returns {object} Object with deployment status for each contract
 */
export const verifyMultipleContracts = async (provider, addresses) => {
  const results = {};

  for (const [name, address] of Object.entries(addresses)) {
    if (address) {
      results[name] = await verifyEVMContractDeployment(provider, address);
    } else {
      results[name] = false;
    }
  }

  return results;
};

/**
 * Create user-friendly error message when contracts aren't deployed
 * @param {string} networkType - 'evm' or 'solana'
 * @param {string} contractName - Name of the missing contract
 * @returns {string} User-friendly error message
 */
export const createDeploymentErrorMessage = (networkType, contractName) => {
  const instructions = getDeploymentInstructions(networkType);
  return `⚠️ ${contractName} contract not found on ${networkType} network.\n\nPlease deploy contracts first:\n${instructions}`;
};