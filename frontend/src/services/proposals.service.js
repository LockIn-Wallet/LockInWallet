// Proposals service - handles fetching pending limit change proposals
// Supports both EVM and Solana networks

import { safeDataFetch, validateServiceParams } from './utils/errorHandler.js';
import { formatProposal } from './utils/dataFormatters.js';

/**
 * Fetches pending limit change proposals for a user across networks
 * @param {Object} params - Service parameters
 * @param {Object} params.transactionManager - Transaction manager instance
 * @param {Object} params.savingsContract - EVM savings contract (for EVM)
 * @param {string} params.networkType - "evm" or "solana"
 * @param {string} params.userAddress - User's address
 * @param {Function} params.getCurrentUserAddress - Function to get current user address
 * @returns {Promise<Array>} - Array of formatted proposal objects
 */
export async function fetchPendingLimitProposals(params) {
  const requiredKeys = ['networkType'];
  validateServiceParams(params, requiredKeys);

  const {
    transactionManager,
    savingsContract,
    networkType,
    userAddress,
    getCurrentUserAddress
  } = params;

  return safeDataFetch(
    async () => {
      // Get current user address using provided function or fallback to passed address
      const currentUserAddress = getCurrentUserAddress ? getCurrentUserAddress() : userAddress;

      if (!currentUserAddress) {
        console.log(`No user address available for fetching pending proposals on ${networkType} network`);
        return [];
      }

      if (networkType === "solana") {
        return await fetchSolanaProposals({
          transactionManager,
          userAddress: currentUserAddress
        });
      } else {
        return await fetchEvmProposals({
          savingsContract,
          userAddress: currentUserAddress,
          transactionManager
        });
      }
    },
    [], // Default to empty array on error
    `${networkType.toUpperCase()} proposals fetch`
  );
}

/**
 * Fetches Solana pending proposals using the transaction manager
 * @param {Object} params - Solana-specific parameters
 * @returns {Promise<Array>} - Array of formatted Solana proposals
 */
async function fetchSolanaProposals(params) {
  const { transactionManager, userAddress } = params;

  console.log("📋 Fetching Solana pending proposals from program...");

  if (!transactionManager) {
    console.log("❌ Transaction manager not available, skipping proposal fetch");
    return [];
  }

  const adapter = transactionManager.getCurrentAdapter();
  const rawProposals = await adapter.fetchPendingProposals(userAddress);

  console.log(`✅ Found ${rawProposals.length} pending proposals for Solana`);

  const vault = await transactionManager.getActiveVault().catch(() => null);
  const decimals = vault?.tokenDecimals ?? (vault?.isSolVault ? 9 : 6);
  const factor = 10 ** decimals;

  return rawProposals.map(proposal => {
    const periods = [
      { name: "Daily", proposed: proposal.newDailyLimit, current: vault?.dailyLimit },
      { name: "Weekly", proposed: proposal.newWeeklyLimit, current: vault?.weeklyLimit },
      { name: "Monthly", proposed: proposal.newMonthlyLimit, current: vault?.monthlyLimit },
    ];

    const changed = periods.find(p => p.proposed !== null && p.proposed !== p.current);

    const executeAfterMs = proposal.executeAfter * 1000;
    const submittedAtMs = proposal.createdAt * 1000;

    if (changed) {
      const isRemoval = changed.proposed === 0;
      return {
        ...proposal,
        networkType: 'solana',
        periodName: changed.name,
        action: isRemoval ? 'remove' : 'change',
        newLimit: isRemoval ? null : parseFloat((changed.proposed / factor).toFixed(2)),
        executeAfter: executeAfterMs,
        submittedAt: submittedAtMs,
      };
    }

    return {
      ...proposal,
      networkType: 'solana',
      periodName: 'Rules',
      action: 'change',
      newLimit: null,
      executeAfter: executeAfterMs,
      submittedAt: submittedAtMs,
    };
  });
}

/**
 * Fetches EVM pending proposals using the savings contract
 * @param {Object} params - EVM-specific parameters
 * @returns {Promise<Array>} - Array of formatted EVM proposals
 */
async function fetchEvmProposals(params) {
  const { savingsContract, userAddress, transactionManager } = params;

  console.log("📋 Fetching EVM pending proposals...");

  if (!savingsContract) {
    console.log("❌ Savings contract not available, skipping proposal fetch");
    return [];
  }

  // Vaults on EVM have no timelocked proposals yet — rule changes are immediate
  if (transactionManager?.getActiveVaultCapabilities &&
      !transactionManager.getActiveVaultCapabilities().proposals) {
    return [];
  }

  try {
    // Use the transaction manager to call the adapter method directly
    // This ensures consistent formatting across both networks
    if (transactionManager && transactionManager.getCurrentAdapter) {
      const adapter = transactionManager.getCurrentAdapter();
      if (adapter && adapter.fetchPendingProposals) {
        const proposals = await adapter.fetchPendingProposals(userAddress);
        return proposals.map(proposal => ({
          ...proposal,
          networkType: 'evm'
        }));
      }
    }

    console.log("❌ Transaction manager or adapter not available for EVM proposals");
    return [];
  } catch (error) {
    console.error("Error fetching EVM proposals:", error);
    return [];
  }
}

/**
 * Validates proposal data structure
 * @param {Array} proposalsData - Array of proposals
 * @returns {boolean} - True if data structure is valid
 */
export function validateProposalsData(proposalsData) {
  if (!Array.isArray(proposalsData)) {
    return false;
  }

  return proposalsData.every(proposal => {
    return (
      proposal &&
      typeof proposal === 'object' &&
      typeof proposal.id !== 'undefined' &&
      typeof proposal.networkType === 'string'
    );
  });
}

/**
 * Formats proposals data for consistent display
 * @param {Array} proposalsData - Raw proposals data from blockchain
 * @param {string} networkType - "evm" or "solana"
 * @returns {Array} - Array of formatted proposals
 */
export function formatProposalsData(proposalsData, networkType) {
  if (!Array.isArray(proposalsData)) {
    console.warn('Invalid proposals data:', proposalsData);
    return [];
  }

  return proposalsData.map(proposal => formatProposal(proposal, networkType));
}

/**
 * Gets the count of pending proposals for display
 * @param {Array} proposals - Array of proposal objects
 * @returns {number} - Number of pending proposals
 */
export function getPendingProposalsCount(proposals) {
  if (!Array.isArray(proposals)) {
    return 0;
  }

  return proposals.filter(proposal =>
    proposal.status === 'pending' || !proposal.status
  ).length;
}