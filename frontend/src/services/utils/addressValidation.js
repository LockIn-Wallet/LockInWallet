// Address validation utilities for multi-blockchain support
// Provides consistent address validation across EVM and Solana networks

/**
 * Validates if an address is a valid Solana public key
 * @param {string} address - Address to validate
 * @returns {boolean} - True if valid Solana address
 */
export function isSolanaAddress(address) {
  return address &&
         typeof address === 'string' &&
         !address.startsWith("0x") &&
         address.length >= 32 &&
         address.length <= 44;
}

/**
 * Validates if an address is a valid EVM address
 * @param {string} address - Address to validate
 * @returns {boolean} - True if valid EVM address
 */
export function isEvmAddress(address) {
  return address &&
         typeof address === 'string' &&
         address.startsWith("0x") &&
         address.length === 42;
}

/**
 * Validates if an address is valid for the specified network type
 * @param {string} address - Address to validate
 * @param {string} networkType - "evm" or "solana"
 * @returns {boolean} - True if address is valid for the network
 */
export function isValidAddressForNetwork(address, networkType) {
  if (!address || !networkType) {
    return false;
  }

  switch (networkType.toLowerCase()) {
    case 'solana':
      return isSolanaAddress(address);
    case 'evm':
    case 'ethereum':
      return isEvmAddress(address);
    default:
      console.warn(`Unknown network type: ${networkType}`);
      return false;
  }
}

/**
 * Gets the expected address format description for a network
 * @param {string} networkType - "evm" or "solana"
 * @returns {string} - Description of expected address format
 */
export function getAddressFormatDescription(networkType) {
  switch (networkType?.toLowerCase()) {
    case 'solana':
      return 'Base58 encoded public key (32-44 characters)';
    case 'evm':
    case 'ethereum':
      return 'Hexadecimal address starting with 0x (42 characters)';
    default:
      return 'Unknown address format';
  }
}

/**
 * Normalizes an address for consistent comparison
 * @param {string} address - Address to normalize
 * @param {string} networkType - "evm" or "solana"
 * @returns {string} - Normalized address
 */
export function normalizeAddress(address, networkType) {
  if (!address) return '';

  switch (networkType?.toLowerCase()) {
    case 'evm':
    case 'ethereum':
      return address.toLowerCase();
    case 'solana':
      return address; // Solana addresses are case-sensitive
    default:
      return address;
  }
}