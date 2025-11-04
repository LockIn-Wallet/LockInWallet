import React from "react";
import PropTypes from "prop-types";

// Import styles
import {
  stepStyles,
  layoutStyles,
  colors,
  spacing,
  fontSize,
  getStepContainerStyle,
} from "../../styles";

/**
 * SetupCommitStep Component
 *
 * Handles Step 3 of the setup wizard - "Lock In Your Wallet"
 * Includes:
 * - Prerequisites validation display
 * - Lock-in button functionality
 * - Setup committed confirmation
 * - Conditional rendering based on setup state
 */
const SetupCommitStep = ({
  // Setup state
  isSetupCommitted,
  stepValidation,
  currentStep,

  // Action handlers
  commitSetup,
}) => {
  return (
    <div
      style={getStepContainerStyle(
        3,
        currentStep,
        isSetupCommitted,
        stepValidation
      )}
    >
      <h3 style={stepStyles.step3Title}>
        🧩 Step 3: Lock In Your Wallet
      </h3>

      <p style={stepStyles.stepDescription}>
        {isSetupCommitted
          ? "Your wallet is locked and all security features are active."
          : "Ready to activate your wallet security? This will enable all spending limits and withdrawal controls."}
      </p>

      {!isSetupCommitted ? (
        <div>
          <div
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #ed8936",
              borderRadius: "6px",
              padding: "12px",
              marginBottom: "15px",
            }}
          >
            <h5
              style={{
                ...stepStyles.prerequisitesTitle,
                color: stepValidation.step1Complete
                  ? colors.success.light
                  : colors.warning.light,
              }}
            >
              📝 Prerequisites
            </h5>
            <div
              style={{
                fontSize: fontSize.xs,
                color: colors.text.muted,
              }}
            >
              <div
                style={{
                  ...stepStyles.prerequisitesItem,
                  ...(stepValidation.step1Complete
                    ? stepStyles.prerequisitesItemComplete
                    : stepStyles.prerequisitesItemIncomplete),
                }}
              >
                {stepValidation.step1Complete ? "✅" : "❌"}
                Set at least one spending limit
              </div>
            </div>
          </div>

          <div style={layoutStyles.textCenter}>
            <button
              onClick={commitSetup}
              disabled={!stepValidation.step1Complete}
              style={{
                ...stepStyles.lockInButton,
                ...(stepValidation.step1Complete
                  ? stepStyles.lockInButtonActive
                  : stepStyles.lockInButtonDisabled),
              }}
            >
              🔒 Lock In My Wallet
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "20px",
            backgroundColor: "#1a365d",
            borderRadius: "8px",
            border: "2px solid #48bb78",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3em", marginBottom: "10px" }}>
            🛡️
          </div>
          <h3
            style={{
              color: colors.success.light,
              margin: `0 0 ${spacing.md} 0`,
            }}
          >
            Wallet Secured
          </h3>
          <p
            style={{
              color: "#e2e8f0",
              margin: 0,
              fontSize: "0.9em",
              lineHeight: "1.5",
            }}
          >
            Your spending limits are active and withdrawal controls are
            enforced. All security features are now protecting your
            funds.
          </p>
        </div>
      )}
    </div>
  );
};

SetupCommitStep.propTypes = {
  // Setup state
  isSetupCommitted: PropTypes.bool.isRequired,
  stepValidation: PropTypes.shape({
    step1Complete: PropTypes.bool.isRequired,
  }).isRequired,
  currentStep: PropTypes.number.isRequired,

  // Action handlers
  commitSetup: PropTypes.func.isRequired,
};

export default SetupCommitStep;