// Balance service - handles fetching user balances across networks
// Supports both EVM and Solana networks

import { safeDataFetch, validateServiceParams } from './utils/errorHandler.js';
import { isSolanaAddress } from './utils/addressValidation.js';

/**
 * Fetches user balances across networks
 * @param {Object} params - Service parameters
 * @param {Object} params.transactionManager - Transaction manager instance
 * @param {Object} params.savingsContract - EVM savings contract (for EVM)
 * @param {Object} params.signer - EVM signer (for EVM)
 * @param {Object} params.connection - Solana connection (for quick balance)
 * @param {string} params.networkType - "evm" or "solana"
 * @param {string} params.selectedNetwork - Selected network configuration
 * @param {Function} params.getCurrentNetwork - Function to get current network config
 * @param {string} params.userAddress - User's address
 * @param {Object} params.solanaPublicKey - Solana public key (for Solana)
 * @returns {Promise<Object>} - Object containing user balances
 */
export async function fetchUserBalances(params) {
  const requiredKeys = ['networkType'];
  validateServiceParams(params, requiredKeys);

  const {
    transactionManager,
    savingsContract,
    signer,
    connection,
    networkType,
    selectedNetwork,
    getCurrentNetwork,
    userAddress,
    solanaPublicKey
  } = params;

  return safeDataFetch(
    async () => {
      if (networkType === "solana") {
        return await fetchSolanaBalances({
          transactionManager,
          connection,
          selectedNetwork,
          userAddress,
          solanaPublicKey
        });
      } else {
        return await fetchEvmBalances({
          savingsContract,
          signer,
          selectedNetwork,
          getCurrentNetwork,
          userAddress
        });
      }
    },
    {}, // Default to empty object on error
    `${networkType.toUpperCase()} balance fetch`
  );
}

/**
 * Fetches Solana balances using the transaction manager
 * @param {Object} params - Solana-specific parameters
 * @returns {Promise<Object>} - Object containing Solana balances
 */
async function fetchSolanaBalances(params) {
  const { transactionManager, connection, selectedNetwork, userAddress, solanaPublicKey } = params;

  if (!transactionManager) {
    console.log('⏭️ Skipping Solana balance fetch - no transaction manager');

    // Try to get quick SOL balance if connection and public key are available
    if (connection && solanaPublicKey) {
      try {
        console.log('🚀 Attempting quick SOL balance from connection...');
        const solBalance = await connection.getBalance(solanaPublicKey);
        const quickBalances = {
          SOL: solBalance / 1000000000, // Convert lamports to SOL
        };
        console.log('✅ Quick SOL balance loaded:', quickBalances);
        return quickBalances;
      } catch (error) {
        console.log('⚠️ Quick balance loading failed:', error.message);
        return {};
      }
    }

    return {};
  }

  try {
    console.log("🔄 Fetching Solana balances...");
    const currentUserAddress = userAddress || await transactionManager.getAddress();

    if (!currentUserAddress) {
      console.warn(
        "❌ Cannot fetch Solana balances: wallet not connected or address unavailable"
      );
      return {};
    }

    const solanaBalances = await transactionManager.getAllBalances(currentUserAddress);
    console.log("✅ Solana balances fetched:", solanaBalances);
    return solanaBalances;
  } catch (error) {
    console.error("❌ Error fetching Solana balances:", error);
    return {};
  }
}

/**
 * Fetches EVM balances using the savings contract
 * @param {Object} params - EVM-specific parameters
 * @returns {Promise<Object>} - Object containing EVM balances
 */
async function fetchEvmBalances(params) {
  const { savingsContract, signer, selectedNetwork, getCurrentNetwork, userAddress } = params;

  if (!savingsContract || !signer) {
    console.log('⏭️ Skipping EVM balance fetch - missing contract or signer');
    return {};
  }

  try {
    const currentUserAddress = userAddress || (await signer.getAddress());
    const currentNetwork = getCurrentNetwork('evm', selectedNetwork);
    const newBalances = {};

    // Skip ETH balance - only fetch stablecoins

    // Fetch stablecoin balances using current network's token addresses
    for (const [key, token] of Object.entries(currentNetwork.tokens)) {
      if (token.address !== "0x0000000000000000000000000000000000000000") {
        try {
          const tokenBalance = await savingsContract.getTokenBalance(
            currentUserAddress,
            token.address
          );

          // Import ethers for formatting - this is safe as it's already available in the app
          const ethers = window.ethers || require('ethers');
          newBalances[key] = ethers.formatUnits(
            tokenBalance,
            token.decimals
          );
        } catch (err) {
          console.log(
            `Token ${key} not available on ${currentNetwork.name}:`,
            err.message
          );
          newBalances[key] = "0";
        }
      } else {
        newBalances[key] = "0";
      }
    }

    console.log("✅ EVM balances fetched:", newBalances);
    return newBalances;
  } catch (error) {
    console.error("Error fetching EVM balances:", error);
    return {};
  }
}

/**
 * Checks if balance data is valid
 * @param {Object} balanceData - Balance data object
 * @returns {boolean} - True if data structure is valid
 */
export function validateBalanceData(balanceData) {
  if (!balanceData || typeof balanceData !== 'object') {
    return false;
  }

  // Check if all values are either numbers or numeric strings
  return Object.values(balanceData).every(balance => {
    const num = Number(balance);
    return !isNaN(num) && isFinite(num);
  });
}

/**
 * Formats balance data for consistent display
 * @param {Object} balanceData - Raw balance data
 * @param {string} networkType - "evm" or "solana"
 * @returns {Object} - Formatted balance data
 */
export function formatBalanceData(balanceData, networkType) {
  if (!balanceData || typeof balanceData !== 'object') {
    console.warn('Invalid balance data:', balanceData);
    return {};
  }

  const formatted = {};
  for (const [token, balance] of Object.entries(balanceData)) {
    // Ensure consistent numeric formatting
    const numBalance = Number(balance);
    formatted[token] = isNaN(numBalance) ? '0' : numBalance.toString();
  }

  return formatted;
}

/**
 * Gets the total balance in USD equivalent (if conversion rates available)
 * @param {Object} balanceData - Balance data object
 * @param {Object} conversionRates - Token to USD conversion rates
 * @returns {number} - Total balance in USD
 */
export function getTotalBalanceUSD(balanceData, conversionRates = {}) {
  if (!balanceData || typeof balanceData !== 'object') {
    return 0;
  }

  let total = 0;
  for (const [token, balance] of Object.entries(balanceData)) {
    const rate = conversionRates[token] || 0;
    const numBalance = Number(balance) || 0;
    total += numBalance * rate;
  }

  return total;
}

/**
 * Checks if user has sufficient balance for an operation
 * @param {Object} balanceData - User's balance data
 * @param {string} token - Token symbol
 * @param {number} requiredAmount - Required amount
 * @returns {boolean} - True if sufficient balance
 */
export function hasSufficientBalance(balanceData, token, requiredAmount) {
  if (!balanceData || !token || requiredAmount <= 0) {
    return false;
  }

  const userBalance = Number(balanceData[token]) || 0;
  return userBalance >= requiredAmount;
}