// Transaction history service - fetches on-chain events for user activity
import { safeDataFetch } from './utils/errorHandler.js';
import { ethers } from 'ethers';

const EVENT_TYPES = {
  Deposited: { label: 'Deposit', icon: '📥' },
  DepositedTo: { label: 'Deposit (Proxy)', icon: '📥' },
  Withdrawal: { label: 'Withdrawal', icon: '📤' },
  BypassExecuted: { label: 'Bypass Withdrawal', icon: '⚡' },
  WithdrawalAddressAdded: { label: 'Address Added', icon: '📋' },
  WithdrawalAddressRemoved: { label: 'Address Removed', icon: '🗑️' },
  SetupCommitted: { label: 'Setup Committed', icon: '🔒' },
  DepositedToVault: { label: 'Pool Deposit', icon: '🎰' },
  WithdrawnFromVault: { label: 'Pool Withdraw', icon: '🎰' },
  PrizeClaimed: { label: 'Prize Won', icon: '🏆' },
};

function parseEventToTransaction(event, eventName, tokens) {
  const { label, icon } = EVENT_TYPES[eventName] || { label: eventName, icon: '📝' };
  const args = event.args || [];

  const base = {
    txHash: event.transactionHash,
    blockNumber: event.blockNumber,
    eventName,
    label,
    icon,
    timestamp: null,
  };

  switch (eventName) {
    case 'Deposited':
      return {
        ...base,
        token: resolveTokenSymbol(args[1], tokens),
        amount: args[2],
        tokenAddress: args[1],
      };
    case 'DepositedTo':
      return {
        ...base,
        token: 'ETH',
        amount: args[2],
      };
    case 'Withdrawal':
      return {
        ...base,
        category: args[1],
        amount: args[2],
        token: resolveTokenSymbol(args[3], tokens),
        tokenAddress: args[3],
      };
    case 'BypassExecuted':
      return {
        ...base,
        amount: args[3],
        token: resolveTokenSymbol(args[4], tokens),
        tokenAddress: args[4],
      };
    case 'DepositedToVault':
    case 'WithdrawnFromVault':
      return {
        ...base,
        token: resolveTokenSymbol(args[1], tokens),
        amount: args[2],
        tokenAddress: args[1],
      };
    case 'PrizeClaimed':
      return {
        ...base,
        token: resolveTokenSymbol(args[1], tokens),
        amount: args[2],
        tokenAddress: args[1],
      };
    case 'SetupCommitted':
      return { ...base };
    case 'WithdrawalAddressAdded':
      return { ...base, destination: args[1], title: args[2] };
    case 'WithdrawalAddressRemoved':
      return { ...base, destination: args[1] };
    default:
      return base;
  }
}

function resolveTokenSymbol(address, tokens) {
  if (!address || !tokens) return 'Unknown';
  const zeroAddr = '0x0000000000000000000000000000000000000000';
  if (address === zeroAddr) return 'ETH';
  for (const [symbol, token] of Object.entries(tokens)) {
    if (token.address && token.address.toLowerCase() === address.toLowerCase()) {
      return symbol;
    }
  }
  return address.slice(0, 6) + '...' + address.slice(-4);
}

function tryCreateFilter(contract, eventName, ...filterArgs) {
  try {
    if (!contract.filters[eventName]) return null;
    return contract.filters[eventName](...filterArgs);
  } catch {
    return null;
  }
}

/**
 * Fetches transaction history for a user from on-chain events
 * @param {Object} params
 * @param {Object} params.savingsContract - ethers.js contract instance
 * @param {string} params.userAddress - User's wallet address
 * @param {Object} params.tokens - Token config map from networkConfig
 * @param {number} params.fromBlock - Starting block (default: 0)
 * @returns {Promise<Array>} Sorted transaction list (newest first)
 */
export async function fetchTransactionHistory(params) {
  const { savingsContract, userAddress, tokens, fromBlock = 0 } = params;

  if (!savingsContract || !userAddress) return [];

  return safeDataFetch(
    async () => {
      const eventNames = [
        'Deposited',
        'DepositedTo',
        'Withdrawal',
        'BypassExecuted',
        'SetupCommitted',
        'WithdrawalAddressAdded',
        'WithdrawalAddressRemoved',
        'DepositedToVault',
        'WithdrawnFromVault',
        'PrizeClaimed',
      ];

      const eventQueries = [];
      for (const name of eventNames) {
        const filter = tryCreateFilter(savingsContract, name, userAddress);
        if (filter) {
          eventQueries.push({ name, filter });
        }
      }

      const allEvents = [];

      await Promise.all(
        eventQueries.map(async ({ name, filter }) => {
          try {
            const events = await savingsContract.queryFilter(filter, fromBlock, 'latest');
            for (const event of events) {
              allEvents.push(parseEventToTransaction(event, name, tokens));
            }
          } catch (err) {
            console.warn(`Failed to query ${name} events:`, err.message);
          }
        })
      );

      // Fetch timestamps for each unique block
      const blockNumbers = [...new Set(allEvents.map(e => e.blockNumber))];
      const blockTimestamps = {};
      const provider = savingsContract.runner?.provider || savingsContract.provider;

      if (provider) {
        await Promise.all(
          blockNumbers.map(async (bn) => {
            try {
              const block = await provider.getBlock(bn);
              if (block) blockTimestamps[bn] = block.timestamp;
            } catch {
              // Skip timestamp on failure
            }
          })
        );
      }

      for (const event of allEvents) {
        event.timestamp = blockTimestamps[event.blockNumber] || null;
      }

      allEvents.sort((a, b) => b.blockNumber - a.blockNumber);
      return allEvents;
    },
    [],
    'Transaction history fetch'
  );
}

/**
 * Formats a transaction amount for display
 * @param {BigInt|string} amount - Raw amount
 * @param {number} decimals - Token decimals
 * @returns {string} Formatted amount
 */
export function formatTxAmount(amount, decimals = 6) {
  if (!amount) return '';
  try {
    return parseFloat(ethers.formatUnits(amount, decimals)).toFixed(4);
  } catch {
    return amount.toString();
  }
}

/**
 * Formats a timestamp for display
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date/time
 */
export function formatTxTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
