// Error handling utilities for data fetching services
// Provides consistent error handling patterns across all services

/**
 * Safely executes a data fetching function with consistent error handling
 * @param {Function} fetchFn - Function that performs the data fetch
 * @param {any} defaultValue - Default value to return on error (default: [])
 * @param {string} errorContext - Context for error logging
 * @returns {Promise<any>} - Result from fetchFn or defaultValue on error
 */
export async function safeDataFetch(fetchFn, defaultValue = [], errorContext = 'Data fetch') {
  try {
    const result = await fetchFn();
    return result;
  } catch (error) {
    console.error(`${errorContext} error:`, error);
    return defaultValue;
  }
}

/**
 * Handles network-specific errors with appropriate fallbacks
 * @param {Error} error - The error object
 * @param {string} networkType - "evm" or "solana"
 * @param {string} operation - Description of the operation that failed
 * @returns {any} - Appropriate default value based on context
 */
export function handleNetworkError(error, networkType, operation) {
  const errorMessage = error?.message || 'Unknown error';

  console.error(`${networkType.toUpperCase()} ${operation} error:`, errorMessage);

  // Return appropriate defaults based on operation type
  if (operation.includes('balance')) {
    return {};
  } else if (operation.includes('address')) {
    return [];
  } else if (operation.includes('request') || operation.includes('proposal')) {
    return [];
  } else {
    return null;
  }
}

/**
 * Validates required parameters for service functions
 * @param {Object} params - Parameters object to validate
 * @param {string[]} requiredKeys - Array of required parameter names
 * @throws {Error} - Throws error if required parameters are missing
 */
export function validateServiceParams(params, requiredKeys) {
  const missingKeys = requiredKeys.filter(key => !params[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Missing required parameters: ${missingKeys.join(', ')}`);
  }
}