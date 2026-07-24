// Withdrawal requests service - handles fetching pending withdrawal address requests
// Supports both EVM and Solana networks

import { safeDataFetch, validateServiceParams } from './utils/errorHandler.js';
import { isSolanaAddress } from './utils/addressValidation.js';

/**
 * Fetches pending withdrawal address requests for a user across networks
 * @param {Object} params - Service parameters
 * @param {Object} params.transactionManager - Transaction manager instance
 * @param {string} params.networkType - "evm" or "solana"
 * @param {string} params.userAddress - User's address
 * @param {Function} params.getCurrentUserAddress - Function to get current user address
 * @returns {Promise<Array>} - Array of formatted withdrawal requests
 */
export async function fetchPendingWithdrawalRequests(params) {
  const requiredKeys = ['networkType'];
  validateServiceParams(params, requiredKeys);

  const {
    transactionManager,
    networkType,
    userAddress,
    getCurrentUserAddress
  } = params;

  return safeDataFetch(
    async () => {
      // Get current user address using provided function or fallback to passed address
      const currentUserAddress = getCurrentUserAddress ? getCurrentUserAddress() : userAddress;

      // Unified adapter pattern - both networks use transactionManager
      if (!transactionManager?.getPendingWithdrawalDestinationRequests) {
        console.log(`❌ ${networkType.toUpperCase()} withdrawal destination requests method not available in transaction manager`);
        return [];
      }

      console.log(`🔄 Calling ${networkType.toUpperCase()} transactionManager.getPendingWithdrawalDestinationRequests()...`);
      const targetAddress = currentUserAddress || await transactionManager.getAddress();
      const withdrawalRequests = await transactionManager.getPendingWithdrawalDestinationRequests(targetAddress);
      console.log(`✅ Fetched ${networkType.toUpperCase()} withdrawal requests for ${targetAddress}:`, withdrawalRequests);

      return withdrawalRequests;
    },
    [], // Default to empty array on error
    `${networkType.toUpperCase()} withdrawal requests fetch`
  );
}

/**
 * Fetches Solana pending withdrawal requests using the transaction manager
 * @param {Object} params - Solana-specific parameters
 * @returns {Promise<Array>} - Array of formatted Solana withdrawal requests
 */
async function fetchSolanaWithdrawalRequests(params) {
  const { transactionManager, userAddress } = params;

  if (!transactionManager) {
    console.log('⏭️ Skipping fetchPendingWithdrawalRequests for Solana - missing adapter');
    return [];
  }

  if (!userAddress) {
    console.log('⏭️ Skipping fetchPendingWithdrawalRequests for Solana - no user address available');
    return [];
  }

  console.log(`🔍 [Withdrawal Requests] Using Solana address: ${userAddress}`);

  // Validate Solana address format
  if (!isSolanaAddress(userAddress)) {
    console.error(`❌ Invalid Solana address format detected: ${userAddress}`);
    console.log('📭 Skipping fetchPendingWithdrawalRequests - wrong address format');
    return [];
  }

  const solanaAdapter = transactionManager.getCurrentAdapter();
  const requests = await solanaAdapter.getPendingWithdrawalDestinationRequests(userAddress);

  // Format Solana requests to match EVM format
  const formattedRequests = requests.map((request) => ({
    requestId: request.requestId,
    title: request.title,
    destination: request.address,
    executeAfter: request.executeAfter,
    submittedDate: new Date(request.createdAt * 1000).toLocaleDateString(),
    networkType: 'solana'
  }));

  console.log(`📋 Loaded ${formattedRequests.length} Solana pending withdrawal destination requests for ${userAddress}`);
  return formattedRequests;
}

/**
 * Validates withdrawal requests data structure
 * @param {Array} requestsData - Array of withdrawal requests
 * @returns {boolean} - True if data structure is valid
 */
export function validateWithdrawalRequestsData(requestsData) {
  if (!Array.isArray(requestsData)) {
    return false;
  }

  return requestsData.every(request => {
    return (
      request &&
      typeof request === 'object' &&
      typeof request.requestId !== 'undefined' &&
      typeof request.title === 'string' &&
      typeof request.destination === 'string' &&
      typeof request.networkType === 'string'
    );
  });
}

/**
 * Formats withdrawal requests data for consistent display
 * @param {Array} requestsData - Raw requests data from blockchain
 * @param {string} networkType - "evm" or "solana"
 * @returns {Array} - Array of formatted withdrawal requests
 */
export function formatWithdrawalRequestsData(requestsData, networkType) {
  if (!Array.isArray(requestsData)) {
    console.warn('Invalid withdrawal requests data:', requestsData);
    return [];
  }

  return requestsData.map(request => ({
    ...request,
    networkType,
    // Ensure consistent data types
    requestId: request.requestId?.toString() || '',
    title: request.title || 'Unnamed Request',
    destination: request.destination || '',
    executeAfter: Number(request.executeAfter) || 0,
    submittedDate: request.submittedDate || 'Unknown date'
  }));
}

/**
 * Gets the count of pending withdrawal requests for display
 * @param {Array} requests - Array of request objects
 * @returns {number} - Number of pending requests
 */
export function getPendingWithdrawalRequestsCount(requests) {
  if (!Array.isArray(requests)) {
    return 0;
  }

  return requests.length; // All fetched requests are pending by definition
}

/**
 * Finds a withdrawal request by ID
 * @param {Array} requests - Array of withdrawal requests
 * @param {string|number} requestId - Request ID to find
 * @returns {Object|null} - Found request or null
 */
export function findWithdrawalRequestById(requests, requestId) {
  if (!Array.isArray(requests) || !requestId) {
    return null;
  }

  return requests.find(request =>
    request.requestId.toString() === requestId.toString()
  ) || null;
}