/**
 * Contract deployment verification utilities
 * Helps prevent "missing revert data" errors by verifying contracts are deployed
 */

// Environment and network debugging
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Log deployment verification details for debugging
 * @param {string} networkName - Human-readable network name
 * @param {string} contractAddress - Contract address being verified
 * @param {string} rpcUrl - RPC URL being used
 */
const logVerificationAttempt = (networkName, contractAddress, rpcUrl) => {
  console.log(`🔍 Verifying contract deployment:`);
  console.log(`   Network: ${networkName}`);
  console.log(`   Contract: ${contractAddress}`);
  console.log(`   RPC: ${rpcUrl ? rpcUrl.substring(0, 50) + '...' : 'Unknown'}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
};

/**
 * Verify if an EVM contract is deployed at the given address with retry logic
 * @param {object} provider - Ethers provider instance
 * @param {string} contractAddress - Contract address to verify
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {boolean} True if contract is deployed, false otherwise
 */
export const verifyEVMContractDeployment = async (provider, contractAddress, maxRetries = 3) => {
  if (!provider || !contractAddress) {
    console.warn("Missing provider or contract address");
    return false;
  }

  // Check if address is zero address (not deployed)
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  if (contractAddress === ZERO_ADDRESS) {
    console.log(`Contract deployment check for ${contractAddress}: NOT DEPLOYED (zero address)`);
    return false;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Contract verification attempt ${attempt}/${maxRetries} for ${contractAddress}`);

      // Get the bytecode at the address
      const code = await provider.getCode(contractAddress);

      // Contract is deployed if bytecode exists (not just '0x' or '0x0')
      const isDeployed = code !== '0x' && code !== '0x0' && code.length > 2;

      if (isDeployed) {
        console.log(`✅ Contract deployment check for ${contractAddress}: DEPLOYED (bytecode length: ${code.length})`);
        return true;
      } else {
        console.log(`❌ Contract deployment check for ${contractAddress}: NOT DEPLOYED (bytecode: ${code})`);

        // If this isn't the last attempt, wait before retrying
        if (attempt < maxRetries) {
          console.log(`Retrying in ${attempt * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    } catch (error) {
      console.error(`Contract verification error (attempt ${attempt}):`, error.message);

      // If this is an RPC error and not the last attempt, try again
      if (attempt < maxRetries && (
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('502') ||
        error.message.includes('503') ||
        error.message.includes('rate limit')
      )) {
        console.log(`Network error detected, retrying in ${attempt * 2000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        continue;
      } else {
        // For non-network errors or final attempt, return false
        break;
      }
    }
  }

  console.log(`❌ Final result for ${contractAddress}: NOT DEPLOYED (after ${maxRetries} attempts)`);
  return false;
};

/**
 * Enhanced contract verification with network context for better debugging
 * @param {object} provider - Ethers provider instance
 * @param {string} contractAddress - Contract address to verify
 * @param {string} networkName - Human-readable network name
 * @param {string} rpcUrl - RPC URL being used (optional, for logging)
 * @returns {boolean} True if contract is deployed, false otherwise
 */
export const verifyContractWithNetworkContext = async (provider, contractAddress, networkName, rpcUrl = null) => {
  logVerificationAttempt(networkName, contractAddress, rpcUrl);

  const result = await verifyEVMContractDeployment(provider, contractAddress);

  if (!result && isProduction) {
    console.error(`🚨 PRODUCTION CONTRACT VERIFICATION FAILED:`);
    console.error(`   This should not happen in production!`);
    console.error(`   Network: ${networkName}`);
    console.error(`   Address: ${contractAddress}`);
    console.error(`   Please check RPC connectivity and contract deployment status.`);
  }

  return result;
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