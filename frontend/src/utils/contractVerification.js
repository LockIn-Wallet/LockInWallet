/**
 * Contract deployment verification utilities
 * Helps prevent "missing revert data" errors by verifying contracts are deployed
 */

/**
 * Verify if an EVM contract is deployed at the given address
 * @param {object} provider - Ethers provider instance
 * @param {string} contractAddress - Contract address to verify
 * @returns {boolean} True if contract is deployed, false otherwise
 */
export const verifyEVMContractDeployment = async (provider, contractAddress) => {
  try {
    if (!provider || !contractAddress) {
      console.warn("Missing provider or contract address");
      return false;
    }

    // Get the bytecode at the address
    const code = await provider.getCode(contractAddress);

    // Contract is deployed if bytecode exists (not just '0x' or '0x0')
    const isDeployed = code !== '0x' && code !== '0x0' && code.length > 2;

    console.log(`Contract deployment check for ${contractAddress}: ${isDeployed ? 'DEPLOYED' : 'NOT DEPLOYED'}`);

    return isDeployed;
  } catch (error) {
    console.error('Contract verification error:', error);
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