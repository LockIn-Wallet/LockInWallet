import React, { useState } from "react";
import PropTypes from "prop-types";

// Import components
import WithdrawalAddressSelector from "../WithdrawalAddressSelector.js";

// Import styles
import {
  stepStyles,
  layoutStyles,
  colors,
  spacing,
  fontSize,
  fontWeight,
  utilityStyles,
  cardStyles,
  formStyles,
  buttonStyles,
  getStepContainerStyle,
  getStepTitleColor,
} from "../../styles";

/**
 * WithdrawalAddressSetupStep Component
 *
 * Handles Step 2 of the setup wizard - "Add Withdrawal Addresses"
 * This component manages withdrawal destination setup before wallet commitment
 *
 * Features:
 * - Withdrawal address management during setup
 * - Add new withdrawal address form
 * - Pending withdrawal address requests display
 * - Network-aware address validation (Ethereum vs Solana)
 * - Integration with step wizard validation
 */
const WithdrawalAddressSetupStep = ({
  // Step wizard state
  currentStep,
  isSetupCommitted,
  stepValidation,
  spendingLimits,

  // Withdrawal data
  withdrawalAddresses,
  pendingWithdrawalRequests,

  // Network context
  networkType,

  // Withdrawal actions
  getCurrentUserAddress,
  removeWithdrawalAddress,
  requestWithdrawalAddress,

  // Step navigation
  goToNextStep,
}) => {
  // Component-specific form state
  const [showWithdrawalAddressForm, setShowWithdrawalAddressForm] = useState(false);
  const [newWithdrawalTitle, setNewWithdrawalTitle] = useState("");
  const [newWithdrawalAddress, setNewWithdrawalAddress] = useState("");

  // Calculate step validation for this step
  const step2Validation = {
    step1Complete: Object.keys(spendingLimits).length > 0,
  };

  // Handle form submission
  const handleRequestWithdrawalAddress = async () => {
    try {
      await requestWithdrawalAddress(newWithdrawalTitle, newWithdrawalAddress);
      // Clear form fields after successful submission
      setNewWithdrawalTitle("");
      setNewWithdrawalAddress("");
      setShowWithdrawalAddressForm(false);
    } catch (error) {
      console.error("Error requesting withdrawal address:", error);
      // Keep form open on error so user can retry
    }
  };

  return (
    <div
      style={getStepContainerStyle(2, currentStep, isSetupCommitted, step2Validation)}
    >
      {/* Step Header */}
      <div style={stepStyles.stepHeader}>
        <div style={layoutStyles.flexAlignCenter}>
          <h3
            style={{
              ...stepStyles.step2Title,
              color: getStepTitleColor(2, isSetupCommitted, step2Validation),
            }}
          >
            🔑 Step 2: Add Withdrawal Addresses
          </h3>
        </div>

        {!isSetupCommitted &&
          stepValidation.step2Complete &&
          currentStep === 2 && (
            <button
              onClick={goToNextStep}
              style={buttonStyles.primary}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = colors.primary.dark;
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = colors.primary.main;
              }}
            >
              Proceed to Lock-In →
            </button>
          )}
      </div>

      {/* Step Description */}
      <p style={stepStyles.stepDescription}>
        {isSetupCommitted
          ? "Manage your approved withdrawal addresses. New addresses require 24-48 hour approval after wallet is locked."
          : "Add addresses where you'll be able to withdraw funds. After lock-in, new addresses will require 24-48 hour approval for security."}
      </p>

      {/* Progress Tips for Setup Mode */}
      {!isSetupCommitted && currentStep === 2 && (
        <div
          style={{
            ...cardStyles.warningCard,
            marginBottom: spacing.md,
            borderLeft: `3px solid ${colors.warning.light}`,
          }}
        >
          <span style={{ fontSize: fontSize.sm, color: colors.text.secondary }}>
            💡 <strong>Tip:</strong> "My Wallet" is automatically added.
            Add other addresses you'll withdraw to (exchanges, hardware
            wallets, etc.).
          </span>
        </div>
      )}

      {/* Withdrawal Address Management */}
      {!isSetupCommitted && (
        <div>
          <WithdrawalAddressSelector
            mode="management"
            title="Your Withdrawal Addresses:"
            withdrawalAddresses={withdrawalAddresses}
            getCurrentUserAddress={getCurrentUserAddress}
            removeWithdrawalAddress={removeWithdrawalAddress}
            showWithdrawalAddressForm={showWithdrawalAddressForm}
            setShowWithdrawalAddressForm={setShowWithdrawalAddressForm}
          />

          {/* Add New Withdrawal Address Form */}
          {showWithdrawalAddressForm && (
            <div
              style={{
                ...cardStyles.baseCard,
                marginTop: spacing.md,
              }}
            >
              <h5
                style={{
                  color: colors.warning.light,
                  margin: `0 0 ${spacing.md} 0`
                }}
              >
                📍 Add New Withdrawal Address
              </h5>

              <div
                style={{
                  display: "grid",
                  gap: spacing.sm,
                  marginBottom: spacing.md,
                }}
              >
                {/* Address Title Input */}
                <div>
                  <label style={formStyles.label}>
                    Address Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 'Hardware Wallet', 'Exchange Account'"
                    value={newWithdrawalTitle}
                    onChange={(e) => setNewWithdrawalTitle(e.target.value)}
                    style={formStyles.input}
                  />
                </div>

                {/* Address Input */}
                <div>
                  <label style={formStyles.label}>
                    {networkType === "solana"
                      ? "Solana Address"
                      : "Ethereum Address"}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      networkType === "solana"
                        ? "Solana address..."
                        : "0x..."
                    }
                    value={newWithdrawalAddress}
                    onChange={(e) => setNewWithdrawalAddress(e.target.value)}
                    style={{
                      ...formStyles.input,
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleRequestWithdrawalAddress}
                disabled={
                  !newWithdrawalTitle.trim() ||
                  !newWithdrawalAddress.trim()
                }
                style={{
                  ...buttonStyles.warning,
                  ...((!newWithdrawalTitle.trim() || !newWithdrawalAddress.trim())
                    ? buttonStyles.disabled
                    : {}),
                  width: "100%",
                }}
              >
                📍 Add Withdrawal Address
              </button>
            </div>
          )}

          {/* Pending Withdrawal Address Requests */}
          {pendingWithdrawalRequests.length > 0 && (
            <div style={{ marginTop: spacing.md }}>
              <h5
                style={{
                  color: colors.warning.light,
                  margin: `0 0 ${spacing.md} 0`,
                }}
              >
                ⏳ Pending New Addresses ({pendingWithdrawalRequests.length})
              </h5>

              <div style={{ ...utilityStyles.grid, gap: spacing.sm }}>
                {pendingWithdrawalRequests.map((request, index) => (
                  <div
                    key={index}
                    style={{
                      ...cardStyles.warningCard,
                      padding: spacing.sm,
                    }}
                  >
                    <div style={layoutStyles.flexBetween}>
                      <div>
                        <div
                          style={{
                            color: colors.text.primary,
                            fontWeight: fontWeight.bold,
                          }}
                        >
                          📍 {request.title}
                        </div>
                        <div
                          style={{
                            fontSize: fontSize.xs,
                            color: colors.text.secondary,
                            fontFamily: "monospace",
                          }}
                        >
                          {request.destination.length > 50
                            ? `${request.destination.slice(0, 25)}...${request.destination.slice(-15)}`
                            : request.destination}
                        </div>
                        <div
                          style={{
                            fontSize: fontSize.xs,
                            color: colors.warning.light,
                            marginTop: "4px",
                          }}
                        >
                          ⏰ Will be available after setup is locked
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

WithdrawalAddressSetupStep.propTypes = {
  // Step wizard state
  currentStep: PropTypes.number.isRequired,
  isSetupCommitted: PropTypes.bool.isRequired,
  stepValidation: PropTypes.shape({
    step2Complete: PropTypes.bool,
  }).isRequired,
  spendingLimits: PropTypes.object.isRequired,

  // Withdrawal data
  withdrawalAddresses: PropTypes.array.isRequired,
  pendingWithdrawalRequests: PropTypes.array.isRequired,

  // Network context
  networkType: PropTypes.string.isRequired,

  // Withdrawal actions
  getCurrentUserAddress: PropTypes.func.isRequired,
  removeWithdrawalAddress: PropTypes.func.isRequired,
  requestWithdrawalAddress: PropTypes.func.isRequired,

  // Step navigation
  goToNextStep: PropTypes.func.isRequired,
};

export default WithdrawalAddressSetupStep;