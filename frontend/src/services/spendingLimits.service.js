// Spending limits service - handles fetching spending limits data
// Supports both EVM and Solana networks

import { safeDataFetch, validateServiceParams, handleNetworkError } from './utils/errorHandler.js';
import { isSolanaAddress } from './utils/addressValidation.js';
import { formatSpendingLimit } from './utils/dataFormatters.js';

/**
 * Fetches spending limits for a user across networks
 * @param {Object} params - Service parameters
 * @param {Object} params.transactionManager - Transaction manager instance
 * @param {string} params.networkType - "evm" or "solana"
 * @returns {Promise<Object>} - Object containing limits array and setup status
 */
export async function fetchSpendingLimits(params) {
  const requiredKeys = ['networkType'];
  validateServiceParams(params, requiredKeys);

  const {
    transactionManager,
    networkType
  } = params;

  return safeDataFetch(
    async () => {
      // Unified adapter pattern - both networks use transactionManager
      if (!transactionManager?.getSpendingLimits) {
        console.log(`❌ ${networkType.toUpperCase()} spending limits method not available in transaction manager`);
        return { limits: [], isSetupCommitted: false };
      }

      console.log(`🔄 Calling ${networkType.toUpperCase()} transactionManager.getSpendingLimits()...`);
      const userAddress = await transactionManager.getAddress();
      const spendingData = await transactionManager.getSpendingLimits(userAddress);
      console.log(`✅ Fetched ${networkType.toUpperCase()} spending limits for ${userAddress}:`, spendingData);

      return spendingData;
    },
    { limits: [], isSetupCommitted: false }, // Default response structure
    `${networkType.toUpperCase()} spending limits fetch`
  );
}

/**
 * Fetches Solana spending limits using the transaction manager
 * @param {Object} params - Solana-specific parameters
 * @returns {Promise<Object>} - Object containing limits and setup status
 */
async function fetchSolanaSpendingLimits(params) {
  const { transactionManager } = params;

  console.log('🔵 Processing Solana spending limits with transaction manager...');

  if (!transactionManager?.getSpendingLimits) {
    console.log('❌ Solana spending limits method not available in transaction manager');
    console.log('Transaction manager state:', {
      exists: !!transactionManager,
      methods: transactionManager ? Object.keys(transactionManager) : 'none',
    });
    return { limits: [], isSetupCommitted: false };
  }

  console.log('🔄 Calling transactionManager.getSpendingLimits()...');
  const spendingData = await transactionManager.getSpendingLimits();
  console.log('✅ Fetched Solana spending limits:', spendingData);
  console.log('📊 Limits array length:', spendingData?.limits?.length || 0);

  // Convert Solana format to unified format (values are already in SOL)
  const fetchedLimits = spendingData.limits.map((limit) => ({
    name: limit.name,
    limit: limit.limit.toString(), // Already converted to SOL in SolanaAdapter
    spent: limit.spent.toString(),
    remaining: Math.max(0, limit.remaining),
    duration: limit.duration.toString(),
    active: limit.active,
    durationHours: Math.floor(Number(limit.duration) / 3600),
    durationDays: Math.floor(Number(limit.duration) / 86400),
  }));

  console.log('🔄 Converted limits for frontend:', fetchedLimits);
  console.log('📊 Setup committed status:', spendingData.isSetupCommitted);

  return {
    limits: fetchedLimits,
    isSetupCommitted: spendingData.isSetupCommitted
  };
}

/**
 * DEPRECATED: Fetches EVM spending limits using direct contract access
 * Replaced with unified adapter pattern - use transactionManager.getSpendingLimits() instead
 * Keeping for reference during transition period
 * @param {Object} params - EVM-specific parameters
 * @returns {Promise<Object>} - Object containing limits and setup status
 */
// eslint-disable-next-line no-unused-vars
async function fetchEvmSpendingLimits(params) {
  const { savingsContract, signer } = params;

  if (!savingsContract || !signer) {
    console.log('⏭️ Skipping EVM spending limits - missing contract or signer');
    return { limits: [], isSetupCommitted: false };
  }

  // Import ethers for formatting - this is safe as it's already available in the app
  const ethers = window.ethers || require('ethers');

  const userAddress = await signer.getAddress();

  // Get all user's spending limits from the smart contract
  const spendingData = await savingsContract.getUserSpendingLimits(userAddress);

  const fetchedLimits = [];
  const [names, limits, spent, remaining, durations, active] = spendingData;

  for (let i = 0; i < names.length; i++) {
    console.log(`📊 Limit ${i}: name="${names[i]}", active=${active[i]}, limit=${ethers.formatUnits(limits[i], 6)}`);

    // For debugging, include ALL limits (both active and inactive)
    fetchedLimits.push({
      name: names[i],
      limit: ethers.formatUnits(limits[i], 6),
      spent: ethers.formatUnits(spent[i], 6),
      remaining: Number(ethers.formatUnits(remaining[i], 6)),
      duration: durations[i].toString(),
      active: active[i], // Include active status for debugging
      // Helper fields for display
      durationHours: Math.floor(Number(durations[i]) / 3600),
      durationDays: Math.floor(Number(durations[i]) / 86400),
    });
  }

  // For EVM, we might need to check setup committed status separately
  // This would require an additional contract call if such a method exists
  let isSetupCommitted = false;
  try {
    console.log('🔍 Checking if savingsContract has isSetupCommitted method...');
    console.log('Contract methods available:', Object.getOwnPropertyNames(savingsContract));

    if (savingsContract.isSetupCommitted) {
      console.log('🔍 Calling isSetupCommitted()...');
      isSetupCommitted = await savingsContract.isSetupCommitted();
      console.log('✅ isSetupCommitted result:', isSetupCommitted);
    } else {
      console.log('❌ isSetupCommitted method not found on contract');
    }
  } catch (error) {
    console.error('❌ Error fetching setup committed status:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      reason: error.reason
    });
  }

  return {
    limits: fetchedLimits,
    isSetupCommitted
  };
}

/**
 * Legacy function for fetching spending limits with transaction manager
 * This maintains backward compatibility with the existing implementation
 * @param {Object} params - Service parameters
 * @returns {Promise<Object>} - Object containing limits and setup status
 */
export async function fetchSpendingLimitsWithTxManager(params) {
  const { transactionManager, networkType } = params;

  console.log('🚀 fetchSpendingLimitsWithTxManager called for network:', networkType);
  console.log('🔗 transactionManager available:', !!transactionManager);

  if (networkType === "solana") {
    return await fetchSolanaSpendingLimits({ transactionManager });
  } else {
    // For EVM, this function wouldn't typically be called with just transaction manager
    console.warn('fetchSpendingLimitsWithTxManager called for EVM - use fetchSpendingLimits instead');
    return { limits: [], isSetupCommitted: false };
  }
}

/**
 * Formats raw spending limit data for consistent display
 * @param {Array} limitsData - Raw limits data from blockchain
 * @param {string} networkType - "evm" or "solana"
 * @returns {Array} - Array of formatted spending limits
 */
export function formatSpendingLimitsData(limitsData, networkType) {
  if (!Array.isArray(limitsData)) {
    console.warn('Invalid spending limits data:', limitsData);
    return [];
  }

  return limitsData.map(limit => ({
    ...limit,
    networkType,
    // Ensure consistent data types
    limit: limit.limit?.toString() || '0',
    spent: limit.spent?.toString() || '0',
    remaining: Number(limit.remaining) || 0,
    duration: limit.duration?.toString() || '0',
    active: Boolean(limit.active),
    durationHours: Math.floor(Number(limit.duration || 0) / 3600),
    durationDays: Math.floor(Number(limit.duration || 0) / 86400),
  }));
}

/**
 * Validates spending limits data structure
 * @param {Object} spendingData - Data object from service
 * @returns {boolean} - True if data structure is valid
 */
export function validateSpendingLimitsData(spendingData) {
  if (!spendingData || typeof spendingData !== 'object') {
    return false;
  }

  if (!Array.isArray(spendingData.limits)) {
    return false;
  }

  if (typeof spendingData.isSetupCommitted !== 'boolean') {
    return false;
  }

  return true;
}