import React from "react";
import PropTypes from "prop-types";

import {
  stepStyles,
  layoutStyles,
  utilityStyles,
  colors,
  spacing,
  fontSize,
  getStepContainerStyle,
} from "../../styles";
import { getCurrentNetwork } from "../../utils/walletUtils.js";
import { getPendingReferrerFor } from "../../services/referral.service.js";
import { truncateAddress } from "../../utils/addressUtils.js";
import {
  toPeriodEntries,
  validatePeriodEntries,
} from "../../utils/spendingPeriods.js";

/**
 * SetupCommitStep Component
 *
 * Handles "Lock In Your Wallet" functionality
 * Includes:
 * - Simple spending limits validation
 * - Lock-in button functionality
 * - Setup committed confirmation
 * - Conditional rendering based on setup state
 * - Internal setup commit logic
 */
const SetupCommitStep = ({
  // Setup state
  isSetupCommitted,
  spendingLimits,
  limitEdits,

  // Blockchain services (dependency injection)
  transactionManager,
  savingsContract,
  networkType,
  solanaConnected,
  userAddress,

  // Callbacks for parent state updates
  onSetupCommitted,
  onSpendingLimitsRefresh,
  // onSaveSpendingLimits, // Temporarily disabled to prevent auto-triggering transactions

  // "fixed" or "percent" — how the entered limits should be interpreted
  limitsMode = "fixed",
}) => {
  // Check for both saved spending limits AND unsaved changes in limit edits
  const hasSavedSpendingLimits = spendingLimits &&
    spendingLimits.length > 0 &&
    spendingLimits.some(limit => limit.isActive && parseFloat(limit.limit) > 0);

  // Check for unsaved changes in limit edits (when user types values but hasn't saved yet)
  const hasUnsavedLimitEdits = limitEdits &&
    Object.values(limitEdits).some(edit =>
      edit.value &&
      edit.value.trim() !== "" &&
      !isNaN(parseFloat(edit.value)) &&
      parseFloat(edit.value) > 0
    );

  // Button should be enabled if there are either saved limits OR unsaved edits
  const hasSpendingLimits = hasSavedSpendingLimits || hasUnsavedLimitEdits;

  // Debug logging removed - button activation issue resolved
  // Flag to prevent multiple simultaneous commit attempts
  const [isCommitting, setIsCommitting] = React.useState(false);

  // Referrer captured from a ?ref= link, excluding self-referrals
  const pendingReferrer = getPendingReferrerFor(userAddress);

  // Internal commit setup function (moved from App.js)
  const commitSetup = async () => {
    if (isCommitting) {
      console.log("🔒 Commit already in progress, ignoring duplicate call");
      return;
    }
    setIsCommitting(true);
    // Check connection for both networks
    if (networkType === "solana" && (!transactionManager || !solanaConnected)) {
      alert("Please connect your Solana wallet first");
      setIsCommitting(false);
      return;
    }
    if (networkType === "evm" && !savingsContract) {
      alert("Please connect your wallet first");
      setIsCommitting(false);
      return;
    }

    try {
      // Every period the user filled in, with its own window and wait time
      const periods = toPeriodEntries(limitEdits);

      const validationError = validatePeriodEntries(periods);
      if (validationError) {
        alert(validationError);
        setIsCommitting(false);
        return;
      }

      console.log("🔄 Committing setup with spending limits...");

      const limitsArePercentage = limitsMode === "percent";
      if (limitsArePercentage && periods.some((period) => period.limit > 100)) {
        alert("Percentage limits cannot exceed 100%");
        setIsCommitting(false);
        return;
      }

      const selectedNetwork = localStorage.getItem("preferred_solana_network") || "localhost";
      const network = getCurrentNetwork("solana", selectedNetwork);
      const defaultToken = network?.tokens?.USDT;
      const tokenMint = defaultToken?.address || null;

      const txHash = await transactionManager.commitSetup(periods, {
        limitsArePercentage,
        tokenMint,
        referrer: pendingReferrer,
      });

      console.log("✅ Setup committed successfully:", txHash);
      alert("Setup locked in successfully! Your savings wallet is now active with spending limit protection.")

      // Mark setup as committed
      onSetupCommitted(true);

      // Refresh spending limits to reflect the changes (with small delay)
      if (onSpendingLimitsRefresh) {
        console.log('🔄 Waiting 2 seconds before refreshing spending limits...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('🔄 Now refreshing spending limits...');
        await onSpendingLimitsRefresh();
      }

      setIsCommitting(false);
    } catch (error) {
      console.error("Error committing setup:", error);
      alert(error.message);
      setIsCommitting(false);
    }
  };
  return (
    <div
      style={{
        backgroundColor: colors.background.primary,
        borderRadius: "8px",
        padding: "20px",
        margin: "20px 0",
        border: `1px solid ${colors.border.default}`,
      }}
    >
      <h3 style={{
        ...stepStyles.step3Title,
        fontSize: fontSize.lg,
        marginBottom: spacing.md,
      }}>
        🔒 Lock In Your Wallet
      </h3>

      <p style={{
        ...stepStyles.stepDescription,
        marginBottom: spacing.lg,
      }}>
        {isSetupCommitted
          ? "Your wallet is locked and all security features are active."
          : "Ready to activate your wallet security? This will enable all spending limits and withdrawal controls."}
      </p>

      {!isSetupCommitted ? (
        <div>
          {!hasSpendingLimits && (
            <div
              style={{
                backgroundColor: colors.warning.bg,
                border: `1px solid ${colors.border.active}`,
                borderRadius: "6px",
                padding: "12px",
                marginBottom: "15px",
                color: colors.warning.light,
              }}
            >
              ⚠️ Please set at least one spending limit before locking in your wallet.
            </div>
          )}

          {pendingReferrer && (
            <div style={{ ...utilityStyles.textSecondary, marginBottom: spacing.md }}>
              🤝 Referred by {truncateAddress(pendingReferrer)} — this will be
              recorded when you lock in.
            </div>
          )}

          <div style={layoutStyles.textCenter}>
            <button
              onClick={commitSetup}
              disabled={!hasSpendingLimits || isCommitting}
              style={{
                ...stepStyles.lockInButton,
                ...(hasSpendingLimits
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
            backgroundColor: colors.background.darkBlue,
            borderRadius: "8px",
            border: `2px solid ${colors.border.success}`,
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
              color: colors.text.secondary,
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
  spendingLimits: PropTypes.arrayOf(PropTypes.shape({
    isActive: PropTypes.bool,
    limit: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  })).isRequired,
  limitEdits: PropTypes.object,

  // Blockchain services (dependency injection)
  transactionManager: PropTypes.object,
  savingsContract: PropTypes.object,
  networkType: PropTypes.oneOf(['evm', 'solana']).isRequired,
  solanaConnected: PropTypes.bool,
  userAddress: PropTypes.string,

  // Callbacks for parent state updates
  onSetupCommitted: PropTypes.func.isRequired,
  onSpendingLimitsRefresh: PropTypes.func,
  // onSaveSpendingLimits: PropTypes.func, // Temporarily disabled
};

export default SetupCommitStep;