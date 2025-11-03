// Withdrawal addresses service - handles fetching approved withdrawal addresses
// Supports both EVM and Solana networks

import { safeDataFetch, validateServiceParams } from './utils/errorHandler.js';
import { isSolanaAddress } from './utils/addressValidation.js';
import { formatWithdrawalAddress } from './utils/dataFormatters.js';

/**
 * Fetches approved withdrawal addresses for a user across networks
 * @param {Object} params - Service parameters
 * @param {Object} params.transactionManager - Transaction manager instance
 * @param {Object} params.savingsContract - EVM savings contract (for EVM)
 * @param {string} params.networkType - "evm" or "solana"
 * @param {string} params.userAddress - User's address
 * @param {string} params.solanaPublicKey - Solana public key (for Solana)
 * @returns {Promise<Array>} - Array of formatted withdrawal addresses
 */
export async function fetchWithdrawalAddresses(params) {
  const requiredKeys = ['networkType'];
  validateServiceParams(params, requiredKeys);

  const {
    transactionManager,
    savingsContract,
    networkType,
    userAddress,
    solanaPublicKey
  } = params;

  return safeDataFetch(
    async () => {
      if (networkType === "solana") {
        return await fetchSolanaWithdrawalAddresses({
          transactionManager,
          userAddress,
          solanaPublicKey
        });
      } else {
        return await fetchEvmWithdrawalAddresses({
          savingsContract,
          userAddress
        });
      }
    },
    [], // Default to empty array on error
    `${networkType.toUpperCase()} withdrawal addresses fetch`
  );
}

/**
 * Fetches Solana withdrawal addresses using the transaction manager
 * @param {Object} params - Solana-specific parameters
 * @returns {Promise<Array>} - Array of formatted Solana withdrawal addresses
 */
async function fetchSolanaWithdrawalAddresses(params) {
  const { transactionManager, userAddress, solanaPublicKey } = params;

  if (!transactionManager) {
    console.log('⏭️ Skipping fetchWithdrawalAddresses for Solana - no transaction manager');
    return [];
  }

  const adapter = transactionManager.getCurrentAdapter();

  // Get the correct Solana address
  let solanaUserAddress = userAddress;
  if (!solanaUserAddress) {
    if (adapter && adapter.wallet?.publicKey) {
      solanaUserAddress = adapter.wallet.publicKey.toString();
    } else {
      solanaUserAddress = solanaPublicKey?.toString();
    }
  }

  console.log(`🔍 [Withdrawal Addresses] Using Solana address: ${solanaUserAddress}`);

  // Validate Solana address format
  if (!isSolanaAddress(solanaUserAddress)) {
    console.error(`❌ [Withdrawal Addresses] Invalid Solana address format detected: ${solanaUserAddress}`);
    console.log('📭 Skipping fetchWithdrawalAddresses - wrong address format');
    return [];
  }

  const addresses = await adapter.fetchWithdrawalAddresses(solanaUserAddress);

  // Transform to standardized format
  const formattedAddresses = addresses.map((addr) => ({
    title: addr.title,
    destination: addr.destination,
    addedTimestamp: addr.addedAt,
    addedDate: new Date(addr.addedAt * 1000).toLocaleDateString(),
    networkType: 'solana'
  }));

  console.log(`📋 Loaded ${formattedAddresses.length} Solana withdrawal addresses for ${solanaUserAddress}`);
  return formattedAddresses;
}

/**
 * Fetches EVM withdrawal addresses using the savings contract
 * @param {Object} params - EVM-specific parameters
 * @returns {Promise<Array>} - Array of formatted EVM withdrawal addresses
 */
async function fetchEvmWithdrawalAddresses(params) {
  const { savingsContract, userAddress } = params;

  if (!savingsContract || !userAddress) {
    console.log('⏭️ Skipping fetchWithdrawalAddresses for EVM - missing contract or user');
    return [];
  }

  const addressData = await savingsContract.getUserWithdrawalAddresses();
  const [titles, destinations, timestamps] = addressData;

  const addresses = [];
  for (let i = 0; i < titles.length; i++) {
    addresses.push({
      title: titles[i],
      destination: destinations[i],
      addedTimestamp: Number(timestamps[i]),
      addedDate: new Date(Number(timestamps[i]) * 1000).toLocaleDateString(),
      networkType: 'evm'
    });
  }

  console.log(`📋 Loaded ${addresses.length} EVM withdrawal addresses for ${userAddress}`);
  return addresses;
}

/**
 * Helper function to get current user address based on network type
 * @param {Object} params - Parameters for address resolution
 * @returns {string|null} - User address for the current network
 */
export function getCurrentUserAddressForWithdrawal(params) {
  const { networkType, userAddress, solanaPublicKey, transactionManager } = params;

  if (networkType === 'solana') {
    // Try multiple sources for Solana address
    if (userAddress && isSolanaAddress(userAddress)) {
      return userAddress;
    }
    if (solanaPublicKey) {
      return solanaPublicKey.toString();
    }
    if (transactionManager) {
      const adapter = transactionManager.getCurrentAdapter();
      if (adapter?.wallet?.publicKey) {
        return adapter.wallet.publicKey.toString();
      }
    }
    return null;
  } else {
    // EVM networks
    return userAddress;
  }
}

/**
 * Validates withdrawal addresses data structure
 * @param {Array} addressesData - Array of withdrawal addresses
 * @returns {boolean} - True if data structure is valid
 */
export function validateWithdrawalAddressesData(addressesData) {
  if (!Array.isArray(addressesData)) {
    return false;
  }

  return addressesData.every(address => {
    return (
      address &&
      typeof address === 'object' &&
      typeof address.title === 'string' &&
      typeof address.destination === 'string' &&
      typeof address.networkType === 'string'
    );
  });
}

/**
 * Formats withdrawal addresses data for consistent display
 * @param {Array} addressesData - Raw addresses data from blockchain
 * @param {string} networkType - "evm" or "solana"
 * @returns {Array} - Array of formatted withdrawal addresses
 */
export function formatWithdrawalAddressesData(addressesData, networkType) {
  if (!Array.isArray(addressesData)) {
    console.warn('Invalid withdrawal addresses data:', addressesData);
    return [];
  }

  return addressesData.map(address => formatWithdrawalAddress(address, networkType));
}

/**
 * Finds a withdrawal address by destination
 * @param {Array} addresses - Array of withdrawal addresses
 * @param {string} destination - Destination address to find
 * @returns {Object|null} - Found address or null
 */
export function findWithdrawalAddressByDestination(addresses, destination) {
  if (!Array.isArray(addresses) || !destination) {
    return null;
  }

  return addresses.find(addr =>
    addr.destination.toLowerCase() === destination.toLowerCase()
  ) || null;
}

/**
 * Checks if a destination address is approved for withdrawal
 * @param {Array} addresses - Array of approved withdrawal addresses
 * @param {string} destination - Destination address to check
 * @returns {boolean} - True if address is approved
 */
export function isDestinationApproved(addresses, destination) {
  return findWithdrawalAddressByDestination(addresses, destination) !== null;
}