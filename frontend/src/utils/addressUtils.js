/**
 * Shared address display helpers.
 */

/**
 * Shortens a blockchain address for display: 0x1234...abcd
 * @param {string} address Full address
 * @returns {string} Truncated address (or the input when too short/empty)
 */
export function truncateAddress(address) {
  if (!address || address.length <= 12) return address || "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
