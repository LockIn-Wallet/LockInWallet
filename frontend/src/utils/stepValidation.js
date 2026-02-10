// DEPRECATED: Step validation utilities for the savings wallet setup wizard
// These functions are no longer used - setup now uses simplified validation
// Kept for reference purposes only

/**
 * Validates Step 1: Spending Limits Configuration
 * @param {Array} spendingLimits - Array of spending limit objects
 * @param {Object} limitEdits - Current limit edit states
 * @param {string} customPeriodName - Custom period name
 * @param {string} customPeriodLimit - Custom period limit value
 * @returns {boolean} True if step 1 is complete
 */
export const validateStep1 = (spendingLimits, limitEdits, customPeriodName, customPeriodLimit) => {
  // Step 1 is complete if user has entered any spending limit values or custom period

  // Check if user entered numbers in any of the spending limit cards
  const hasLimitInput = Object.values(limitEdits).some(
    (edit) => edit.value && parseFloat(edit.value) > 0
  );

  // Check if user is creating/has created a custom period
  const hasCustomPeriodInput =
    customPeriodName.trim() ||
    (customPeriodLimit && parseFloat(customPeriodLimit) > 0);

  // Check if any existing limits are active (original logic)
  const hasActiveLimits = spendingLimits.some(
    (limit) => limit.isActive && parseFloat(limit.limit) > 0
  );

  return hasLimitInput || hasCustomPeriodInput || hasActiveLimits;
};

/**
 * Validates Step 2: Withdrawal Addresses Configuration
 * @param {Array} withdrawalAddresses - Array of withdrawal address objects
 * @param {Function} getCurrentUserAddress - Function to get current user address
 * @returns {boolean} True if step 2 is complete
 */
export const validateStep2 = (withdrawalAddresses, getCurrentUserAddress) => {
  // Step 2 is complete if user added at least one custom withdrawal address (not just "My Wallet")
  // My Wallet is automatically added, so we need more than just that
  const hasCustomAddresses = withdrawalAddresses.some(
    (addr) =>
      addr.title !== "My Wallet" &&
      addr.destination !== getCurrentUserAddress()
  );
  return hasCustomAddresses;
};

/**
 * Validates Step 3: Setup Commitment
 * @param {boolean} isSetupCommitted - Whether setup has been committed
 * @returns {boolean} True if step 3 is complete
 */
export const validateStep3 = (isSetupCommitted) => {
  // Step 3 is complete when setup is committed
  return isSetupCommitted;
};

/**
 * Updates step validation state
 * @param {Object} params - Validation parameters
 * @param {Function} setStepValidation - State setter for step validation
 */
export const updateStepValidation = (params, setStepValidation) => {
  const {
    spendingLimits,
    limitEdits,
    customPeriodName,
    customPeriodLimit,
    withdrawalAddresses,
    getCurrentUserAddress,
    isSetupCommitted
  } = params;

  setStepValidation({
    step1Complete: validateStep1(spendingLimits, limitEdits, customPeriodName, customPeriodLimit),
    step2Complete: validateStep2(withdrawalAddresses, getCurrentUserAddress),
    step3Complete: validateStep3(isSetupCommitted),
  });
};

/**
 * Navigates to the next step
 * @param {number} currentStep - Current step number
 * @param {Function} setCurrentStep - State setter for current step
 */
export const goToNextStep = (currentStep, setCurrentStep) => {
  if (currentStep < 3) {
    setCurrentStep(currentStep + 1);
  }
};

/**
 * Navigates to the previous step
 * @param {number} currentStep - Current step number
 * @param {Function} setCurrentStep - State setter for current step
 */
export const goToPreviousStep = (currentStep, setCurrentStep) => {
  if (currentStep > 1) {
    setCurrentStep(currentStep - 1);
  }
};