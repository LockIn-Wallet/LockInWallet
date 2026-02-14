// Bypass requests service - handles fetching pending bypass withdrawal requests
// Supports both EVM and Solana networks

import { safeDataFetch, validateServiceParams, handleNetworkError } from './utils/errorHandler.js';
import { isSolanaAddress, isValidAddressForNetwork } from './utils/addressValidation.js';
import { formatBypassRequest, formatTimestamp } from './utils/dataFormatters.js';

/**
 * Fetches pending bypass requests for a user across networks
 * @param {Object} params - Service parameters
 * @param {Object} params.transactionManager - Transaction manager instance
 * @param {string} params.networkType - "evm" or "solana"
 * @param {string} params.userAddress - User's address
 * @param {string} params.solanaPublicKey - Solana public key (for Solana)
 * @returns {Promise<Array>} - Array of formatted bypass requests
 */
export async function fetchPendingBypassRequests(params) {
  const requiredKeys = ['networkType'];
  validateServiceParams(params, requiredKeys);

  const {
    transactionManager,
    networkType,
    userAddress,
    solanaPublicKey
  } = params;

  return safeDataFetch(
    async () => {
      // Unified adapter pattern - both networks use transactionManager
      if (!transactionManager?.fetchPendingBypassRequests) {
        console.log(`❌ ${networkType.toUpperCase()} bypass requests method not available in transaction manager`);
        return [];
      }

      console.log(`🔄 Calling ${networkType.toUpperCase()} transactionManager.fetchPendingBypassRequests()...`);
      const targetAddress = userAddress || await transactionManager.getAddress();
      const bypassRequests = await transactionManager.fetchPendingBypassRequests(targetAddress);
      console.log(`✅ Fetched ${networkType.toUpperCase()} bypass requests for ${targetAddress}:`, bypassRequests);

      return bypassRequests;
    },
    [], // Default to empty array on error
    `${networkType.toUpperCase()} bypass requests fetch`
  );
}

/**
 * Fetches Solana bypass requests using the transaction manager
 * @param {Object} params - Solana-specific parameters
 * @returns {Promise<Array>} - Array of formatted Solana bypass requests
 */
async function fetchSolanaBypassRequests(params) {
  const { transactionManager, userAddress, solanaPublicKey } = params;

  if (!transactionManager) {
    console.log('⏭️ Skipping fetchPendingBypassRequests for Solana - no transaction manager');
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

  console.log(`🔍 [Bypass Requests] Using Solana address: ${solanaUserAddress}`);

  // Validate Solana address format
  if (!isSolanaAddress(solanaUserAddress)) {
    console.error(`❌ [Bypass Requests] Invalid Solana address format detected: ${solanaUserAddress}`);
    console.log('📭 Skipping fetchPendingBypassRequests - wrong address format');
    return [];
  }

  const bypassRequests = await adapter.fetchPendingBypassRequests(solanaUserAddress);

  // Transform to standardized format
  const formattedRequests = bypassRequests.map((req) => {
    // Format amount using adapter's token-aware decimal conversion
    let formattedAmount = req.amount;
    try {
      formattedAmount = adapter
        .fromSmallestUnit(req.amount, req.tokenMint)
        .toString();
      console.log(
        `🔍 Amount conversion: ${req.amount} -> ${formattedAmount} (${adapter.getTokenDecimals(
          req.tokenMint
        )} decimals for ${req.tokenMint})`
      );
    } catch (error) {
      console.warn('Error formatting amount:', error);
    }

    // Format timestamp
    const submittedDate = (() => {
      try {
        let timestamp = req.createdAt;
        // Handle different timestamp formats
        if (timestamp > 10000000000) {
          timestamp = timestamp / 1000;
        }
        const date = new Date(timestamp * 1000);
        console.log(`🔍 Date conversion: ${req.createdAt} -> ${date.toLocaleDateString()}`);
        return date.toLocaleDateString();
      } catch (error) {
        console.warn('Error formatting date:', error);
        return 'Unknown date';
      }
    })();

    return {
      requestId: req.requestId,
      title: `${req.bypassingPeriod} Bypass`,
      destination: req.destination,
      executeAfter: req.executeAfter,
      submittedDate,
      amount: formattedAmount,
      tokenMint: req.tokenMint,
      bypassingPeriod: req.bypassingPeriod,
      canExecute: req.canExecute,
      status: req.status,
      networkType: 'solana'
    };
  });

  console.log(`📋 Loaded ${formattedRequests.length} Solana bypass requests for ${solanaUserAddress}`);
  return formattedRequests;
}

/**
 * DEPRECATED: Fetches EVM bypass requests using direct contract access
 * Replaced with unified adapter pattern - use transactionManager.fetchPendingBypassRequests() instead
 * Keeping for reference during transition period
 * @param {Object} params - EVM-specific parameters
 * @returns {Promise<Array>} - Array of formatted EVM bypass requests
 */
// eslint-disable-next-line no-unused-vars
async function fetchEvmBypassRequests(params) {
  const { savingsContract, userAddress } = params;

  if (!userAddress || !savingsContract) {
    console.log('⏭️ Skipping EVM bypass requests - missing contract or address');
    return [];
  }

  console.log('🔍 Fetching bypass requests for:', userAddress);

  // Get active bypass requests directly from contract
  const bypassData = await savingsContract.getUserActiveBypassRequests();
  console.log('📊 Raw bypass data:', bypassData);

  const [requestIds, amounts, skipPeriods, tokens, executeAfters] = bypassData;
  console.log('📊 Request IDs length:', requestIds.length);

  // Import ethers for formatting - this is safe as it's already available in the app
  const ethers = window.ethers || require('ethers');

  const requests = [];
  for (let i = 0; i < requestIds.length; i++) {
    // Determine token info for display
    let tokenSymbol = 'Unknown';
    let tokenDecimals = 18;

    const tokenAddress = tokens[i];
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      tokenSymbol = 'ETH';
      tokenDecimals = 18;
    } else {
      // Check if it's USDT or other known tokens
      try {
        const moduleAddresses = await import('../moduleAddresses.json');
        if (
          tokenAddress.toLowerCase() ===
          moduleAddresses.tokens.usdt.toLowerCase()
        ) {
          tokenSymbol = 'USDT';
          tokenDecimals = 6;
        }
      } catch (error) {
        console.warn('Could not load module addresses:', error);
      }
    }

    requests.push({
      requestId: requestIds[i],
      amount: ethers.formatUnits(amounts[i], tokenDecimals),
      period: skipPeriods[i],
      token: tokenSymbol,
      tokenAddress: tokenAddress,
      tokenDecimals: tokenDecimals,
      executeAfter: Number(executeAfters[i]),
      executed: false,
      exists: true,
      networkType: 'evm'
    });
  }

  console.log(`Found ${requests.length} active bypass requests for ${userAddress}`);
  console.log('📋 Requests array:', requests);

  return requests;
}

/**
 * Helper function to get current user address based on network type
 * @param {Object} params - Parameters for address resolution
 * @returns {string|null} - User address for the current network
 */
export function getCurrentUserAddressForBypass(params) {
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