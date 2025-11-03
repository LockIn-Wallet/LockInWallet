// Data formatting utilities for service responses
// Provides consistent data transformation across all services

/**
 * Formats timestamp to a readable date string
 * @param {number|string} timestamp - Unix timestamp or date string
 * @returns {string} - Formatted date string
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';

  try {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  } catch (error) {
    console.warn('Failed to format timestamp:', timestamp);
    return 'Invalid date';
  }
}

/**
 * Formats a token amount with proper decimals
 * @param {string|number} amount - Token amount
 * @param {number} decimals - Token decimals (default: 6 for USDT)
 * @returns {string} - Formatted amount
 */
export function formatTokenAmount(amount, decimals = 6) {
  if (!amount) return '0';

  try {
    const numAmount = parseFloat(amount);
    return numAmount.toFixed(decimals);
  } catch (error) {
    console.warn('Failed to format token amount:', amount);
    return '0';
  }
}

/**
 * Formats spending limit data for consistent display
 * @param {Object} limitData - Raw limit data from blockchain
 * @param {string} periodName - Name of the time period
 * @returns {Object} - Formatted limit object
 */
export function formatSpendingLimit(limitData, periodName) {
  return {
    name: periodName,
    limit: formatTokenAmount(limitData.limit),
    spent: formatTokenAmount(limitData.spent),
    remaining: formatTokenAmount(limitData.remaining),
    isActive: limitData.isActive || false,
    lastReset: formatTimestamp(limitData.lastReset),
    nextReset: formatTimestamp(limitData.nextReset)
  };
}

/**
 * Formats bypass request data for consistent display
 * @param {Object} requestData - Raw bypass request data
 * @param {string} networkType - "evm" or "solana"
 * @returns {Object} - Formatted bypass request
 */
export function formatBypassRequest(requestData, networkType = 'solana') {
  const base = {
    id: requestData.id || requestData.proposalId,
    amount: formatTokenAmount(requestData.amount),
    token: requestData.token || 'Unknown',
    reason: requestData.reason || 'No reason provided',
    status: requestData.status || 'pending',
    submittedAt: formatTimestamp(requestData.submittedAt || requestData.timestamp),
    networkType
  };

  // Add network-specific fields
  if (networkType === 'solana') {
    return {
      ...base,
      executeAfter: requestData.executeAfter ? formatTimestamp(requestData.executeAfter) : null,
      approver: requestData.approver || null
    };
  } else {
    return {
      ...base,
      approvals: requestData.approvals || 0,
      requiredApprovals: requestData.requiredApprovals || 1
    };
  }
}

/**
 * Formats withdrawal address data for consistent display
 * @param {Object} addressData - Raw address data from blockchain
 * @param {string} networkType - "evm" or "solana"
 * @returns {Object} - Formatted withdrawal address
 */
export function formatWithdrawalAddress(addressData, networkType) {
  return {
    id: addressData.id || addressData.address,
    title: addressData.title || addressData.name || 'Unnamed Address',
    destination: addressData.destination || addressData.address,
    isActive: addressData.isActive !== false, // Default to true unless explicitly false
    addedAt: formatTimestamp(addressData.addedAt || addressData.timestamp),
    networkType
  };
}

/**
 * Formats proposal data for consistent display
 * @param {Object} proposalData - Raw proposal data from blockchain
 * @param {string} networkType - "evm" or "solana"
 * @returns {Object} - Formatted proposal
 */
export function formatProposal(proposalData, networkType) {
  return {
    id: proposalData.id || proposalData.proposalId,
    action: proposalData.action || 'change',
    periodName: proposalData.periodName || proposalData.period,
    newLimit: proposalData.newLimit ? formatTokenAmount(proposalData.newLimit) : null,
    submittedAt: formatTimestamp(proposalData.submittedAt || proposalData.timestamp),
    executeAfter: proposalData.executeAfter ? formatTimestamp(proposalData.executeAfter) : null,
    status: proposalData.status || 'pending',
    networkType
  };
}

/**
 * Formats balance data for consistent display
 * @param {Object} balanceData - Raw balance data from blockchain
 * @param {string} tokenSymbol - Token symbol (e.g., 'USDT', 'SOL')
 * @returns {Object} - Formatted balance
 */
export function formatBalance(balanceData, tokenSymbol) {
  return {
    token: tokenSymbol,
    amount: formatTokenAmount(balanceData.amount || balanceData.balance),
    decimals: balanceData.decimals || 6,
    symbol: tokenSymbol,
    lastUpdated: formatTimestamp(Date.now() / 1000)
  };
}