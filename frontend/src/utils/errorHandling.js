/**
 * Centralized Error Handling Utilities
 * Provides consistent error handling and user-friendly messages
 */

/**
 * Error types for categorization
 */
export const ERROR_TYPES = {
  NETWORK: 'NETWORK',
  WALLET: 'WALLET',
  CONTRACT: 'CONTRACT',
  VALIDATION: 'VALIDATION',
  CIRCUIT_BREAKER: 'CIRCUIT_BREAKER',
  USER_REJECTION: 'USER_REJECTION',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Classify error based on message and context
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 * @returns {object} Error classification
 */
export const classifyError = (error, context = '') => {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code;

  // User rejection errors
  if (message.includes('user denied') ||
      message.includes('user rejected') ||
      message.includes('user cancelled') ||
      code === 4001) {
    return {
      type: ERROR_TYPES.USER_REJECTION,
      severity: 'info',
      userMessage: 'Transaction was cancelled by user.',
      shouldRetry: false
    };
  }

  // Circuit breaker errors
  if (message.includes('circuit breaker')) {
    return {
      type: ERROR_TYPES.CIRCUIT_BREAKER,
      severity: 'warning',
      userMessage: 'Too many failed requests. Please wait a moment before trying again.',
      shouldRetry: true,
      retryDelay: 30000 // 30 seconds
    };
  }

  // Network connection errors
  if (message.includes('network') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      code === 'NETWORK_ERROR') {
    return {
      type: ERROR_TYPES.NETWORK,
      severity: 'error',
      userMessage: 'Network connection error. Please check your internet connection and try again.',
      shouldRetry: true,
      retryDelay: 3000
    };
  }

  // Wallet connection errors
  if (message.includes('wallet') ||
      message.includes('metamask') ||
      message.includes('phantom') ||
      code === 'WALLET_NOT_CONNECTED') {
    return {
      type: ERROR_TYPES.WALLET,
      severity: 'warning',
      userMessage: 'Wallet connection issue. Please ensure your wallet is connected and try again.',
      shouldRetry: true,
      retryDelay: 1000
    };
  }

  // Contract deployment/call errors
  if (message.includes('contract') ||
      message.includes('revert') ||
      message.includes('execution reverted') ||
      message.includes('missing revert data')) {
    return {
      type: ERROR_TYPES.CONTRACT,
      severity: 'error',
      userMessage: 'Smart contract error. The contracts may not be deployed or there was an execution error.',
      shouldRetry: false
    };
  }

  // Insufficient funds
  if (message.includes('insufficient funds') ||
      message.includes('insufficient balance') ||
      message.includes('not enough')) {
    return {
      type: ERROR_TYPES.INSUFFICIENT_FUNDS,
      severity: 'warning',
      userMessage: 'Insufficient funds to complete this transaction.',
      shouldRetry: false
    };
  }

  // Validation errors
  if (message.includes('invalid') ||
      message.includes('validation') ||
      context.includes('validation')) {
    return {
      type: ERROR_TYPES.VALIDATION,
      severity: 'warning',
      userMessage: 'Invalid input or configuration. Please check your settings and try again.',
      shouldRetry: false
    };
  }

  // Default classification
  return {
    type: ERROR_TYPES.UNKNOWN,
    severity: 'error',
    userMessage: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
    shouldRetry: true,
    retryDelay: 2000
  };
};

/**
 * Format error for display to user
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 * @returns {object} Formatted error info
 */
export const formatUserError = (error, context = '') => {
  const classification = classifyError(error, context);

  return {
    ...classification,
    originalError: error.message,
    context,
    timestamp: new Date().toISOString(),
    id: Math.random().toString(36).substr(2, 9) // Simple error ID
  };
};

/**
 * Log error with appropriate level based on severity
 * @param {object} formattedError - Formatted error from formatUserError
 * @param {object} additionalContext - Additional context for logging
 */
export const logError = (formattedError, additionalContext = {}) => {
  const logData = {
    ...formattedError,
    additionalContext
  };

  switch (formattedError.severity) {
    case 'info':
      console.info('ℹ️ User Action:', logData);
      break;
    case 'warning':
      console.warn('⚠️ Warning:', logData);
      break;
    case 'error':
    default:
      console.error('❌ Error:', logData);
      break;
  }
};

/**
 * Create user-friendly error handler
 * @param {string} context - Context description
 * @param {function} onError - Optional error callback
 * @returns {function} Error handler function
 */
export const createErrorHandler = (context, onError = null) => {
  return (error) => {
    const formattedError = formatUserError(error, context);
    logError(formattedError);

    if (onError) {
      onError(formattedError);
    }

    return formattedError;
  };
};

/**
 * Retry wrapper with error classification
 * @param {function} fn - Function to retry
 * @param {object} options - Retry options
 * @returns {Promise} Result or throws final error
 */
export const retryWithErrorHandling = async (fn, options = {}) => {
  const maxAttempts = options.maxAttempts || 3;
  const context = options.context || 'operation';
  const onError = options.onError;

  let lastError;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;

      const formattedError = formatUserError(error, context);
      logError(formattedError, { attempt, maxAttempts });

      // Don't retry if error is not retryable
      if (!formattedError.shouldRetry) {
        break;
      }

      // Don't retry on last attempt
      if (attempt >= maxAttempts) {
        break;
      }

      // Wait before retry
      const delay = formattedError.retryDelay || 1000;
      console.log(`⏳ Retrying in ${delay}ms... (attempt ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Final error handling
  const finalError = formatUserError(lastError, context);
  logError(finalError, { finalAttempt: true, totalAttempts: attempt });

  if (onError) {
    onError(finalError);
  }

  throw lastError;
};

/**
 * Network-specific error messages
 */
export const NETWORK_ERRORS = {
  CONTRACT_NOT_DEPLOYED: {
    evm: 'Ethereum contracts are not deployed. Please run: npm run deploy-modular --workspace=ethereum',
    solana: 'Solana programs are not deployed. Please run: npm run solana:deploy-reliable'
  },
  WALLET_NOT_INSTALLED: {
    evm: 'MetaMask is not installed. Please install MetaMask browser extension.',
    solana: 'Solana wallet is not installed. Please install Phantom or another Solana wallet.'
  },
  WRONG_NETWORK: {
    evm: 'Please switch to the correct Ethereum network in MetaMask.',
    solana: 'Please check your Solana network connection.'
  }
};

/**
 * Get network-specific error message
 * @param {string} errorKey - Error key from NETWORK_ERRORS
 * @param {string} networkType - 'evm' or 'solana'
 * @returns {string} Network-specific error message
 */
export const getNetworkErrorMessage = (errorKey, networkType) => {
  return NETWORK_ERRORS[errorKey]?.[networkType] || NETWORK_ERRORS[errorKey]?.evm || 'Unknown network error';
};

/**
 * Create toast notification handler
 * @param {function} showToast - Toast notification function
 * @returns {function} Toast error handler
 */
export const createToastErrorHandler = (showToast) => {
  return (formattedError) => {
    const toastType = formattedError.severity === 'info' ? 'info' :
                     formattedError.severity === 'warning' ? 'warning' : 'error';

    showToast(formattedError.userMessage, toastType);
  };
};

/**
 * Development mode error details
 * @param {object} formattedError - Formatted error
 * @returns {string} Detailed error for development
 */
export const getDevErrorDetails = (formattedError) => {
  if (process.env.NODE_ENV !== 'development') {
    return '';
  }

  return `\n\nDevelopment Details:\n` +
         `- Type: ${formattedError.type}\n` +
         `- Context: ${formattedError.context}\n` +
         `- Original: ${formattedError.originalError}\n` +
         `- Error ID: ${formattedError.id}`;
};