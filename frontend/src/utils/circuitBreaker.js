/**
 * Circuit Breaker and Exponential Backoff Utilities
 * Prevents MetaMask circuit breaker issues by controlling call frequency
 */

/**
 * Sleep utility for delays
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Exponential backoff utility
 * @param {number} attempt - Current attempt number (0-based)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000ms)
 * @param {number} maxDelay - Maximum delay in milliseconds (default: 30000ms)
 * @returns {number} Delay in milliseconds
 */
export const calculateBackoff = (attempt, baseDelay = 1000, maxDelay = 30000) => {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return Math.floor(delay + jitter);
};

/**
 * Circuit breaker class to manage call state
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Check if we should allow the call
   */
  shouldAllowCall() {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    if (this.state === 'HALF_OPEN') {
      return true;
    }

    return false;
  }

  /**
   * Record successful call
   */
  recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  /**
   * Record failed call
   */
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  /**
   * Get current state info
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      timeUntilReset: this.state === 'OPEN'
        ? Math.max(0, this.resetTimeout - (Date.now() - this.lastFailureTime))
        : 0
    };
  }
}

/**
 * Retry wrapper with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {object} options - Retry options
 * @returns {Promise} Result of successful function call
 */
export const withRetry = async (fn, options = {}) => {
  const maxAttempts = options.maxAttempts || 3;
  const baseDelay = options.baseDelay || 1000;
  const maxDelay = options.maxDelay || 30000;
  const shouldRetry = options.shouldRetry || ((error) => true);

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;

      // Don't retry if the error indicates we shouldn't
      if (!shouldRetry(error)) {
        throw error;
      }

      // Don't delay on last attempt
      if (attempt < maxAttempts - 1) {
        const delay = calculateBackoff(attempt, baseDelay, maxDelay);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
        await sleep(delay);
      }
    }
  }

  throw lastError;
};

/**
 * Debounced function wrapper to prevent rapid calls
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Debounce delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (fn, delay = 500) => {
  let timeoutId;
  let lastCallTime = 0;

  return function(...args) {
    const now = Date.now();

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Calculate minimum delay since last call
    const timeSinceLastCall = now - lastCallTime;
    const remainingDelay = Math.max(0, delay - timeSinceLastCall);

    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          lastCallTime = Date.now();
          const result = await fn.apply(this, args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, remainingDelay);
    });
  };
};

/**
 * Smart contract call wrapper with circuit breaker protection
 * @param {Function} contractCall - Contract call function
 * @param {CircuitBreaker} circuitBreaker - Circuit breaker instance
 * @param {object} options - Additional options
 * @returns {Promise} Result of contract call
 */
export const safeContractCall = async (contractCall, circuitBreaker, options = {}) => {
  // Check circuit breaker
  if (!circuitBreaker.shouldAllowCall()) {
    const state = circuitBreaker.getState();
    throw new Error(`Circuit breaker is ${state.state}. Time until reset: ${Math.ceil(state.timeUntilReset / 1000)}s`);
  }

  try {
    const result = await withRetry(contractCall, {
      maxAttempts: options.maxAttempts || 2,
      baseDelay: options.baseDelay || 1000,
      shouldRetry: (error) => {
        // Don't retry on user rejection or circuit breaker errors
        if (error.message?.includes('User denied') ||
            error.message?.includes('user rejected') ||
            error.message?.includes('circuit breaker')) {
          return false;
        }
        // Retry on network errors and contract errors
        return true;
      }
    });

    circuitBreaker.recordSuccess();
    return result;
  } catch (error) {
    circuitBreaker.recordFailure();
    throw error;
  }
};

/**
 * Create circuit breaker instances for different operation types
 */
export const createCircuitBreakers = () => ({
  contracts: new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 60000 // 1 minute
  }),
  balance: new CircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 30000 // 30 seconds
  }),
  network: new CircuitBreaker({
    failureThreshold: 2,
    resetTimeout: 120000 // 2 minutes
  })
});