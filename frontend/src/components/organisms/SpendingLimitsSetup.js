import React, { useState, useEffect, useCallback, useRef } from "react";

// Import styles directly from theme and components
import { colors, fontWeight } from "../../styles/theme.js";
import { layoutStyles } from "../../styles/components/layout.js";
import { stepStyles } from "../../styles/components/steps.js";
import { cardStyles } from "../../styles/components/cards.js";

// Import utility functions directly instead of passing as props
import {
  formatTimeRemaining,
  hasPendingProposalForPeriod,
} from "../../utils/walletUtils.js";

// Import services for data fetching
import {
  fetchSpendingLimits as fetchSpendingLimitsService,
  fetchPendingLimitProposals as fetchPendingLimitProposalsService,
} from "../../services";

import {
  createEmptyLimitEdits,
  toPeriodEntries,
  validatePeriodEntries,
  formatDuration,
  getDefaultUnlockDelay,
  getPeriod,
  UNLOCK_DELAY_OPTIONS,
} from "../../utils/spendingPeriods.js";

import LimitModeToggle from "../molecules/LimitModeToggle.js";
import LimitPeriodCards from "../molecules/LimitPeriodCards.js";

/**
 * SpendingLimitsSetup - Spending limits configuration component
 * Complete spending limits configuration component preserving all original styling
 */
const SpendingLimitsSetup = ({
  // Core data
  currentTime,
  networkType,
  isSetupCommitted,
  spendingLimits: parentSpendingLimits,

  // Blockchain access
  transactionManager,
  solanaConnected,
  savingsContract,

  // Helper functions (provided by parent)
  getCurrentUserAddress: getUserAddress,
  onSpendingLimitsUpdate,
  onSetSaveCallback, // New callback to set save function

  // Limit mode (fixed vs % of balance) during initial setup
  limitsMode = "fixed",
  onLimitsModeChange,
  showModeToggle = false,

  // Refetch when the selected vault changes
  activeVaultAddress,
}) => {
  // Use parent spending limits when available, otherwise internal state for loading
  const [spendingLimits, setSpendingLimits] = useState(parentSpendingLimits || []);
  const [pendingLimitProposals, setPendingLimitProposals] = useState([]);
  const [limitsLoaded, setLimitsLoaded] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState("USD");

  const formatAmount = (value) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "0";
    return num % 1 === 0 ? num.toFixed(0) : parseFloat(num.toFixed(4)).toString();
  };

  // Update local state when parent spending limits change
  useEffect(() => {
    if (parentSpendingLimits && parentSpendingLimits.length > 0) {
      setSpendingLimits(parentSpendingLimits);
      setLimitsLoaded(true);
    }
  }, [parentSpendingLimits]);

  // Notify parent whenever local spending limits change
  useEffect(() => {
    if (limitsLoaded && spendingLimits.length > 0 && onSpendingLimitsUpdate) {
      onSpendingLimitsUpdate(spendingLimits, limitEdits);
    }
  }, [spendingLimits, limitsLoaded, onSpendingLimitsUpdate]);

  // Which windows this network can enforce, and whether the user gets to pick
  // their own wait times — asked of the adapter rather than branched on network
  const supportedPeriods = transactionManager?.getSupportedSpendingPeriods?.() || [
    "Daily",
    "Weekly",
    "Monthly",
  ];
  const supportsCustomDelays = transactionManager?.supportsCustomUnlockDelays?.() || false;

  // Internal state for card interactions (hover and focus)
  const [cardStates, setCardStates] = useState({});

  // Internal state for custom period form
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);
  const [customPeriodName, setCustomPeriodName] = useState("");
  const [customPeriodLimit, setCustomPeriodLimit] = useState("");
  const [customPeriodDuration, setCustomPeriodDuration] = useState("86400"); // Default 1 day

  // Data fetching functions (moved from App.js)
  const fetchSpendingLimits = async () => {
    try {
      const spendingData = await fetchSpendingLimitsService({
        transactionManager,
        savingsContract,
        networkType
      });

      setSpendingLimits(spendingData.limits);
      if (spendingData.tokenSymbol) setTokenSymbol(spendingData.tokenSymbol);
      setLimitsLoaded(true);

      console.log(`✅ SpendingLimitsSetup: Loaded ${spendingData.limits.length} spending limits`);
    } catch (error) {
      console.error("Error fetching spending limits:", error);
      setSpendingLimits([]);
      setLimitsLoaded(true);
    }
  };

  const fetchPendingLimitProposals = async () => {
    const currentUserAddress = getUserAddress();

    try {
      const proposals = await fetchPendingLimitProposalsService({
        transactionManager,
        savingsContract,
        networkType,
        userAddress: currentUserAddress
      });

      setPendingLimitProposals(proposals);
      console.log(`✅ SpendingLimitsSetup: Loaded ${proposals.length} pending proposals`);
    } catch (error) {
      console.error("Error fetching pending proposals:", error);
      setPendingLimitProposals([]);
    }
  };

  // Internal state for limit edits
  const [limitEdits, setLimitEdits] = useState(() => createEmptyLimitEdits(supportedPeriods));

  // Internal limit editing functions
  const updateLimitEdit = (periodName, value) => {
    setLimitEdits((prev) => ({
      ...prev,
      [periodName]: {
        ...prev[periodName],
        value: value,
        isActive: value && parseFloat(value) > 0,
      },
    }));
  };

  const updateUnlockDelay = (periodName, unlockDelay) => {
    setLimitEdits((prev) => ({
      ...prev,
      [periodName]: { ...prev[periodName], unlockDelay },
    }));
  };

  const toggleEditMode = (periodName) => {
    setLimitEdits((prev) => ({
      ...prev,
      [periodName]: {
        ...prev[periodName],
        isEditing: !prev[periodName].isEditing,
      },
    }));
  };

  // Load data when dependencies change
  useEffect(() => {
    const loadData = async () => {
      if ((networkType === "solana" && transactionManager && solanaConnected) ||
          (networkType === "evm" && savingsContract)) {
        await fetchSpendingLimits();
        await fetchPendingLimitProposals();
      }
    };

    loadData();
  }, [transactionManager, savingsContract, solanaConnected, networkType, activeVaultAddress]);

  // Notify parent whenever limit edits change (for unsaved changes)
  useEffect(() => {
    if (limitsLoaded && onSpendingLimitsUpdate) {
      onSpendingLimitsUpdate(spendingLimits, limitEdits);
    }
  }, [limitEdits, limitsLoaded, onSpendingLimitsUpdate]);

  // Internal data refresh helper (updated to use internal functions)
  const refreshData = async () => {
    await fetchSpendingLimits();
    await fetchPendingLimitProposals();
  };

  // Auto-refresh when a spending limit countdown reaches zero
  const lastResetRefreshRef = useRef(0);
  useEffect(() => {
    if (!spendingLimits || spendingLimits.length === 0) return;
    const expiredLimit = spendingLimits.find(
      (l) => l.active && l.resetAt && l.resetAt <= currentTime && l.remaining <= 0,
    );
    if (expiredLimit && lastResetRefreshRef.current !== expiredLimit.resetAt) {
      lastResetRefreshRef.current = expiredLimit.resetAt;
      fetchSpendingLimits();
    }
  }, [currentTime, spendingLimits]);

  // Internal proposal and limit management functions
  const saveLimitChanges = useCallback(async (isUserInitiated = false) => {
    // Check connection for both networks
    if (networkType === "solana" && (!transactionManager || !solanaConnected)) {
      alert("Please connect your Solana wallet first");
      return;
    }
    if (networkType === "evm" && !savingsContract) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      // Every period the user actually filled in
      const periodEntries = toPeriodEntries(limitEdits);

      if (periodEntries.length === 0) {
        console.error("🚨 saveLimitChanges called with no limits set!", {
          limitEdits: limitEdits,
          isUserInitiated,
          callStack: new Error().stack
        });
        // Only show alert if this was a user-initiated action
        if (isUserInitiated) {
          alert("Please set at least one spending limit");
        }
        return;
      }

      // Same ordering rule the contracts enforce: a shorter window may never
      // allow more spending than a longer one
      const orderingError = validatePeriodEntries(periodEntries);
      if (orderingError) {
        alert(orderingError);
        return;
      }

      if (!isSetupCommitted) {
        setLimitEdits((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((key) => {
            updated[key] = { ...updated[key], isEditing: false };
          });
          return updated;
        });

        if (onSpendingLimitsUpdate) {
          onSpendingLimitsUpdate(spendingLimits, limitEdits);
        }
        alert("Spending limits saved. Click 'Lock In My Wallet' to activate.");
      } else {
        if (networkType === "solana") {
          alert("After setup lock, you can still add individual limits or remove existing ones on Solana");
        } else {
          alert("After setup lock, use individual Edit buttons for each limit to submit separate proposals");
        }
      }
    } catch (error) {
      console.error("Error saving limit changes:", error);
      alert(`Failed to save limit changes: ${error.message}`);
    }
  }, [networkType, transactionManager, solanaConnected, savingsContract, isSetupCommitted, limitEdits, spendingLimits, refreshData, onSpendingLimitsUpdate]);

  // Temporarily disable save callback to prevent auto-triggering on input
  // TODO: Re-implement this properly without causing transaction requests on every keystroke
  /*
  useEffect(() => {
    if (onSetSaveCallback) {
      onSetSaveCallback(saveLimitChanges);
    }
  }, [onSetSaveCallback]);
  */

  /**
   * Retune how long a bypass or a change to this limit takes. The change
   * itself serves out the period's current wait first, so it is never instant.
   */
  const submitUnlockDelayProposal = async (periodName, newUnlockDelay) => {
    const current = spendingLimits.find((limit) => limit.name === periodName);
    if (current?.unlockDelay === newUnlockDelay) return;

    const confirmed = window.confirm(
      `Change the ${periodName.toLowerCase()} wait time to ${formatDuration(newUnlockDelay)}?\n\n` +
        `This takes ${formatDuration(current?.unlockDelay)} to go through — the period's current wait.`,
    );
    if (!confirmed) return;

    try {
      await transactionManager.proposeUnlockDelayChange(periodName, newUnlockDelay);
      alert(
        `✅ Wait time change submitted. It becomes active in ${formatDuration(
          current?.unlockDelay,
        )}.`,
      );
      await refreshData();
    } catch (error) {
      console.error(`Error proposing ${periodName} wait time:`, error);
      alert(`Failed to change the ${periodName.toLowerCase()} wait time: ${error.message}`);
    }
  };

  const submitIndividualProposal = async (periodName) => {
    // Check connection for both networks
    if (networkType === "solana" && (!transactionManager || !solanaConnected)) {
      alert("Please connect your Solana wallet first");
      return;
    }
    if (networkType === "evm" && !savingsContract) {
      alert("Please connect your wallet first");
      return;
    }
    const edit = limitEdits[periodName];
    if (!edit?.value || parseFloat(edit.value) <= 0) {
      alert("Please enter a valid limit amount");
      return;
    }
    try {
      const newLimit = parseFloat(edit.value);

      const vault = await transactionManager.getActiveVault();
      const currentRules = {
        dailyLimit: vault?.dailyLimit || 0,
        weeklyLimit: vault?.weeklyLimit || 0,
        monthlyLimit: vault?.monthlyLimit || 0,
        penaltyRateBps: vault?.penaltyRateBps || 2000,
        limitsArePercentage: vault?.limitsArePercentage || false,
      };
      const decimals = vault?.tokenDecimals ?? (vault?.isSolVault ? 9 : 6);
      const factor = 10 ** decimals;
      const periodKey = periodName.toLowerCase() + "Limit";
      currentRules[periodKey] = Math.round(newLimit * factor);

      const txHash = await transactionManager.proposeRuleChange(currentRules);
      console.log("Proposal transaction:", txHash);

      alert(`✅ ${periodName} limit change proposal submitted! It will be executable after the timelock period.`);

      // Reset edit mode for this specific period
      setLimitEdits((prev) => ({
        ...prev,
        [periodName]: { ...prev[periodName], isEditing: false, value: "" },
      }));

      // Refresh data
      await refreshData();
    } catch (error) {
      console.error(`Error proposing ${periodName} limit:`, error);
      alert(`Failed to submit ${periodName} limit proposal: ${error.message}`);
    }
  };

  const executeProposal = async (proposal) => {
    // Check connection for both networks
    if (networkType === "solana" && (!transactionManager || !solanaConnected)) {
      alert("Please connect your Solana wallet first");
      return;
    }
    if (networkType === "evm" && !savingsContract) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      console.log("🔄 Executing proposal:", proposal);
      await transactionManager.executeRuleChange();
      alert(`✅ Executed ${proposal.action} proposal for ${proposal.periodName}!`);

      // Refresh data
      await refreshData();

      alert(`✅ ${proposal.action === "change" ? "Limit update" : "Limit removal"} executed successfully!`);
    } catch (error) {
      console.error("Error executing proposal:", error);
      alert(`Failed to execute proposal: ${error.message}`);
    }
  };

  const cancelProposal = async (proposal) => {
    try {
      await transactionManager.cancelRuleChange();

      // Refresh proposals
      await refreshData();

      alert(`Proposal for ${proposal.periodName} cancelled successfully`);
    } catch (error) {
      console.error("Error cancelling proposal:", error);
      alert(`Failed to cancel proposal: ${error.message}`);
    }
  };

  const removeLimitPeriod = async (periodName) => {
    // Network-aware connection check
    if (networkType === "solana" && (!transactionManager || !solanaConnected)) {
      alert("Please connect your Solana wallet first");
      return;
    }
    if (networkType === "evm" && !savingsContract) {
      alert("Please connect your MetaMask wallet first");
      return;
    }

    try {
      if (isSetupCommitted) {
        const vault = await transactionManager.getActiveVault();
        const currentRules = {
          dailyLimit: vault?.dailyLimit || 0,
          weeklyLimit: vault?.weeklyLimit || 0,
          monthlyLimit: vault?.monthlyLimit || 0,
          penaltyRateBps: vault?.penaltyRateBps || 2000,
          limitsArePercentage: vault?.limitsArePercentage || false,
        };
        const periodKey = periodName.toLowerCase() + "Limit";
        currentRules[periodKey] = 0;
        await transactionManager.proposeRuleChange(currentRules);
        alert(`✅ Removal proposal submitted for ${periodName}! It will be executable after the timelock period.`);
      } else {
        setLimitEdits((prev) => ({
          ...prev,
          [periodName]: { value: "", isActive: false, isEditing: false },
        }));
        alert(`✅ ${periodName} limit removed.`);
      }

      // Refresh data for both networks
      await refreshData();
    } catch (error) {
      console.error("Error removing limit:", error);
      alert(`Failed to remove ${periodName} limit: ${error.message}`);
    }
  };

  // Inline the step container style temporarily to fix runtime issue
  const stepContainerStyle = {
    marginBottom: "20px",
    padding: "20px",
    border: !isSetupCommitted
      ? `2px solid ${colors.success.main}`
      : `2px solid ${colors.border?.light || colors.border.default}`,
    borderRadius: "12px",
    backgroundColor: colors.background?.primary || colors.background.primary,
    color: colors.text?.primary || "white",
  };

  return (
    <div style={stepContainerStyle}>
      {/* Header — only during setup. Once committed this component is wrapped
          in a CollapsibleSection that already names the section. */}
      {!isSetupCommitted && (
        <div style={stepStyles.stepHeader}>
          <h3 style={{ ...stepStyles.step1Title, color: colors.text.primary }}>
            Spending limits
          </h3>
        </div>
      )}

      {/* Description */}
      <p
        style={{
          fontSize: "0.9em",
          color: colors.text.light,
          marginBottom: "15px",
          lineHeight: "1.5",
        }}
      >
        {isSetupCommitted
          ? "⚠️ Account locked: Changes require 24-hour timelock proposals. Edit individual limits or add new ones."
          : "Configure daily, weekly, or monthly spending limits to control your withdrawals. After wallet lock-in, updates will require a timelock for security."}
      </p>

      {/* Progress Tips for Setup Mode */}
      {!isSetupCommitted && (
        <div
          style={{
            fontSize: "0.8em",
            color: colors.text.muted,
            backgroundColor: colors.background.dark,
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "15px",
            borderLeft: `3px solid ${colors.warning.light}`,
          }}
        >
          💡 <strong>Tip:</strong> Set at least one spending limit to
          continue. You can stack several periods (daily + weekly +
          monthly + yearly) for layered protection.
        </div>
      )}

      {/* Daily/Weekly/Monthly Cards */}
      <div style={layoutStyles.marginBottomLarge}>
        <h4 style={{ color: colors.success.light, margin: "0 0 15px 0" }}>
          🎯 Standard Time Periods
        </h4>
        {!isSetupCommitted ? (
          <>
            {showModeToggle && onLimitsModeChange && (
              <LimitModeToggle mode={limitsMode} onChange={onLimitsModeChange} />
            )}
            <LimitPeriodCards
              periodNames={supportedPeriods}
              values={Object.fromEntries(
                supportedPeriods.map((name) => [name, limitEdits[name]?.value || ""]),
              )}
              onChange={updateLimitEdit}
              delays={Object.fromEntries(
                supportedPeriods.map((name) => [
                  name,
                  limitEdits[name]?.unlockDelay ?? getDefaultUnlockDelay(name),
                ]),
              )}
              onDelayChange={supportsCustomDelays ? updateUnlockDelay : undefined}
              unit={limitsMode === "percent" ? "%" : tokenSymbol}
            />
          </>
        ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "15px",
            marginBottom: "15px",
          }}
        >
          {supportedPeriods.map((periodName) => {
            const edit = limitEdits[periodName];
            const existingLimit = spendingLimits.find(
              (limit) => limit.name === periodName
            );
            const isActive =
              existingLimit !== undefined &&
              existingLimit.active !== false; // Check both existence and active field

            const progressPercent = existingLimit
              ? (parseFloat(existingLimit.spent) /
                  parseFloat(existingLimit.limit)) *
                100
              : 0;
            const isNearLimit = progressPercent > 80;
            const isAtLimit = progressPercent >= 100;
            const liveTimeRemaining =
              isAtLimit && existingLimit?.resetAt
                ? Math.max(0, existingLimit.resetAt - currentTime)
                : 0;

            // Determine card state for styling
            const isBeingConfigured =
              edit?.value && edit.value.trim() !== "" && !isActive;
            const hasUnsavedChanges =
              edit?.value &&
              edit.value.trim() !== "" &&
              isActive &&
              edit.value !== existingLimit?.limit;
            const isInteractive = !isActive || edit?.isEditing;

            const cardStyle = {
              padding: "15px",
              borderRadius: "8px",
              backgroundColor: isActive
                ? colors.background.dark
                : isBeingConfigured
                ? colors.background.darkBlue
                : colors.background.secondary,
              border: isActive
                ? isAtLimit
                  ? `2px solid ${colors.border.error}`
                  : isNearLimit
                  ? `2px solid ${colors.border.warning}`
                  : `2px solid ${colors.border.success}`
                : isBeingConfigured || hasUnsavedChanges
                ? `2px solid ${colors.success.border}`
                : `2px dashed ${colors.border.default}`,
              opacity: isActive ? 1 : isBeingConfigured ? 0.9 : 0.7,
              transition: "all 0.3s ease",
              boxShadow:
                isBeingConfigured || hasUnsavedChanges
                  ? "0 0 0 1px rgba(154, 230, 180, 0.3)"
                  : "none",
              cursor: isInteractive ? "pointer" : "default",
            };

            // Hover and focus enhancement styles
            const getEnhancedCardStyle = (
              isHovered = false,
              isFocused = false
            ) => ({
              ...cardStyle,
              backgroundColor:
                (isHovered || isFocused) && isInteractive
                  ? isActive
                    ? colors.background.primary
                    : isBeingConfigured
                    ? colors.background.darkBlue
                    : colors.background.secondary
                  : cardStyle.backgroundColor,
              border:
                (isHovered || isFocused) && isInteractive
                  ? isActive
                    ? isAtLimit
                      ? `2px solid ${colors.border.error}`
                      : isNearLimit
                      ? `2px solid ${colors.warning.light}`
                      : `2px solid ${colors.border.success}`
                    : `2px solid ${colors.success.border}`
                  : cardStyle.border,
              boxShadow:
                (isHovered || isFocused) && isInteractive
                  ? "0 0 0 2px rgba(154, 230, 180, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15)"
                  : cardStyle.boxShadow,
              transform:
                (isHovered || isFocused) && isInteractive
                  ? "translateY(-1px)"
                  : "none",
            });

            // Get current card state
            const currentCardState = cardStates[periodName] || {
              isHovered: false,
              isFocused: false,
            };
            const { isHovered, isFocused } = currentCardState;

            const updateCardState = (updates) => {
              setCardStates((prev) => ({
                ...prev,
                [periodName]: { ...prev[periodName], ...updates },
              }));
            };

            return (
              <div
                key={periodName}
                style={getEnhancedCardStyle(isHovered, isFocused)}
                onMouseEnter={() => updateCardState({ isHovered: true })}
                onMouseLeave={() => updateCardState({ isHovered: false })}
              >
                {/* Card Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <h5
                    style={{
                      color: isActive
                        ? "white"
                        : isBeingConfigured
                        ? colors.text.secondary
                        : colors.text.muted,
                      margin: 0,
                      fontSize: "1.1em",
                      fontWeight: "bold",
                    }}
                  >
                    {getPeriod(periodName)?.icon} {periodName}
                  </h5>
                  {isActive && existingLimit && (
                    <span
                      style={{
                        fontSize: "0.8em",
                        padding: "4px 8px",
                        borderRadius: "12px",
                        backgroundColor: isAtLimit
                          ? colors.error.main
                          : isNearLimit
                          ? colors.warning.main
                          : colors.success.main,
                        color: "white",
                        fontWeight: "bold",
                      }}
                    >
                      {progressPercent.toFixed(0)}% used
                    </span>
                  )}
                </div>

                {/* Input or Display */}
                {edit?.isEditing || (!isActive && !isSetupCommitted) ? (
                  <div style={layoutStyles.marginBottomSmall}>
                    <input
                      type="text"
                      placeholder={
                        isActive
                          ? `Update limit (${tokenSymbol})`
                          : "Enter amount to activate"
                      }
                      value={edit?.value || ""}
                      onChange={(e) =>
                        updateLimitEdit(periodName, e.target.value)
                      }
                      onFocus={() => updateCardState({ isFocused: true })}
                      onBlur={() => updateCardState({ isFocused: false })}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "4px",
                        border: `1px solid ${colors.border.default}`,
                        backgroundColor: colors.background.secondary,
                        color: "white",
                        fontSize: "1em",
                      }}
                    />
                  </div>
                ) : existingLimit ? (
                  <div style={layoutStyles.marginBottomSmall}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{ color: colors.text.secondary, fontSize: "0.9em" }}
                      >
                        Remaining
                      </span>
                      <span
                        style={{
                          color: isAtLimit ? colors.error.light : colors.success.light,
                          fontWeight: "bold",
                          fontSize: "1.1em",
                        }}
                      >
                        {formatAmount(existingLimit.remaining)} {tokenSymbol}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.8em",
                        color: colors.text.muted,
                        marginBottom: "8px",
                      }}
                    >
                      <span>Spent: {formatAmount(existingLimit.spent)} {tokenSymbol}</span>
                      <span>Limit: {formatAmount(existingLimit.limit)} {tokenSymbol}</span>
                    </div>
                    {/* Progress bar */}
                    <div
                      style={{
                        width: "100%",
                        height: "6px",
                        backgroundColor: colors.background.secondary,
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(progressPercent, 100)}%`,
                          height: "100%",
                          backgroundColor: isAtLimit
                            ? colors.error.main
                            : isNearLimit
                            ? colors.warning.main
                            : colors.success.main,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                    {isAtLimit && liveTimeRemaining > 0 && (
                      <div style={cardStyles.limitResetCountdown}>
                        <span style={cardStyles.limitResetText}>
                          Resets in {formatTimeRemaining(liveTimeRemaining)}
                        </span>
                      </div>
                    )}
                    {supportsCustomDelays && existingLimit.unlockDelay > 0 && (
                      <div
                        style={{
                          marginTop: "10px",
                          paddingTop: "10px",
                          borderTop: `1px solid ${colors.border.default}`,
                          fontSize: "0.8em",
                          color: colors.text.muted,
                        }}
                      >
                        <div style={{ marginBottom: "6px" }}>
                          🔒 Bypassing or changing this limit takes{" "}
                          <strong style={{ color: colors.text.secondary }}>
                            {formatDuration(existingLimit.unlockDelay)}
                          </strong>
                        </div>
                        <select
                          value={existingLimit.unlockDelay}
                          onChange={(e) =>
                            submitUnlockDelayProposal(periodName, Number(e.target.value))
                          }
                          style={{
                            width: "100%",
                            padding: "6px",
                            borderRadius: "4px",
                            border: `1px solid ${colors.border.default}`,
                            backgroundColor: colors.background.secondary,
                            color: "white",
                            fontSize: "0.95em",
                            cursor: "pointer",
                          }}
                        >
                          {UNLOCK_DELAY_OPTIONS.map((option) => (
                            <option key={option.seconds} value={option.seconds}>
                              Change wait to {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  !isActive &&
                  isSetupCommitted && (
                    <div style={layoutStyles.marginBottomSmall}>
                      <div
                        style={{
                          color: colors.text.muted,
                          fontSize: "0.9em",
                          fontStyle: "italic",
                          textAlign: "center",
                          padding: "16px",
                          backgroundColor: colors.background.primary,
                          borderRadius: "6px",
                          border: `1px solid ${colors.border.default}`,
                        }}
                      >
                        🔒 No {periodName.toLowerCase()} limit set. Use
                        "Edit" to add one via proposal system.
                      </div>
                    </div>
                  )
                )}

                {/* Action Buttons */}
                <div style={layoutStyles.flexGapSmall}>
                  {edit?.isEditing ? (
                    <>
                      {isSetupCommitted ? (
                        <button
                          onClick={() =>
                            submitIndividualProposal(periodName)
                          }
                          style={{
                            flex: 1,
                            padding: "8px",
                            borderRadius: "4px",
                            border: "none",
                            backgroundColor: colors.warning.main,
                            color: "white",
                            cursor: "pointer",
                            fontSize: "0.9em",
                            fontWeight: "bold",
                          }}
                        >
                          📝 Submit Proposal
                        </button>
                      ) : (
                        <button
                          onClick={() => saveLimitChanges(true)}
                          style={{
                            flex: 1,
                            padding: "8px",
                            borderRadius: "4px",
                            border: "none",
                            backgroundColor: colors.success.main,
                            color: "white",
                            cursor: "pointer",
                            fontSize: "0.9em",
                            fontWeight: "bold",
                          }}
                        >
                          💾 Save Changes
                        </button>
                      )}
                      <button
                        onClick={() => toggleEditMode(periodName)}
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: "4px",
                          border: `1px solid ${colors.border.default}`,
                          backgroundColor: "transparent",
                          color: colors.text.secondary,
                          cursor: "pointer",
                          fontSize: "0.9em",
                          minWidth: "70px",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {isActive || isSetupCommitted ? ( // Show Edit/Remove for active limits, or Add button for inactive limits when locked
                        <>
                          <span
                            title={
                              hasPendingProposalForPeriod(
                                periodName,
                                pendingLimitProposals
                              )
                                ? `Cannot ${
                                    isActive ? "edit" : "add"
                                  } ${periodName} limit: There is already a pending proposal for this period. Only one proposal per period is allowed.`
                                : ""
                            }
                            style={{ flex: 1, display: "block" }}
                          >
                            <button
                              onClick={() =>
                                !hasPendingProposalForPeriod(
                                  periodName,
                                  pendingLimitProposals
                                ) && toggleEditMode(periodName)
                              }
                              disabled={hasPendingProposalForPeriod(
                                periodName,
                                pendingLimitProposals
                              )}
                              style={{
                                width: "100%",
                                padding: "8px",
                                borderRadius: "4px",
                                border: `1px solid ${colors.border.default}`,
                                backgroundColor: colors.background.primary,
                                backgroundImage: "none",
                                color: hasPendingProposalForPeriod(
                                  periodName,
                                  pendingLimitProposals
                                )
                                  ? colors.text.gray
                                  : colors.text.muted,
                                cursor: hasPendingProposalForPeriod(
                                  periodName,
                                  pendingLimitProposals
                                )
                                  ? "not-allowed"
                                  : "pointer",
                                fontSize: "0.85em",
                                fontWeight: "normal",
                                opacity: hasPendingProposalForPeriod(
                                  periodName,
                                  pendingLimitProposals
                                )
                                  ? 0.3
                                  : 0.7,
                                transition: "all 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                if (
                                  !hasPendingProposalForPeriod(
                                    periodName,
                                    pendingLimitProposals
                                  )
                                ) {
                                  e.target.style.opacity = "1";
                                  e.target.style.color = colors.text.secondary;
                                  e.target.style.borderColor = colors.border.default;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (
                                  !hasPendingProposalForPeriod(
                                    periodName,
                                    pendingLimitProposals
                                  )
                                ) {
                                  e.target.style.opacity = "0.7";
                                  e.target.style.color = colors.text.muted;
                                  e.target.style.borderColor = colors.border.default;
                                }
                              }}
                            >
                              {isActive ? "✏️ Edit" : "➕ Add Limit"}
                            </button>
                          </span>
                          {isActive && (
                            <span
                              title={
                                hasPendingProposalForPeriod(
                                  periodName,
                                  pendingLimitProposals
                                )
                                  ? `Cannot remove ${periodName} limit: There is already a pending proposal for this period. Only one proposal per period is allowed.`
                                  : ""
                              }
                              style={{ flex: 1, display: "block" }}
                            >
                              <button
                                onClick={() =>
                                  !hasPendingProposalForPeriod(
                                    periodName,
                                    pendingLimitProposals
                                  ) && removeLimitPeriod(periodName)
                                }
                                disabled={hasPendingProposalForPeriod(
                                  periodName,
                                  pendingLimitProposals
                                )}
                                style={{
                                  width: "100%",
                                  padding: "8px",
                                  borderRadius: "4px",
                                  border: `1px solid ${colors.border.default}`,
                                  backgroundColor: colors.background.primary,
                                  backgroundImage: "none",
                                  color: hasPendingProposalForPeriod(
                                    periodName,
                                    pendingLimitProposals
                                  )
                                    ? colors.text.gray
                                    : colors.text.muted,
                                  cursor: hasPendingProposalForPeriod(
                                    periodName,
                                    pendingLimitProposals
                                  )
                                    ? "not-allowed"
                                    : "pointer",
                                  fontSize: "0.85em",
                                  fontWeight: "normal",
                                  opacity: hasPendingProposalForPeriod(
                                    periodName,
                                    pendingLimitProposals
                                  )
                                    ? 0.3
                                    : 0.7,
                                  transition: "all 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                  if (
                                    !hasPendingProposalForPeriod(
                                      periodName,
                                      pendingLimitProposals
                                    )
                                  ) {
                                    e.target.style.opacity = "1";
                                    e.target.style.color = colors.text.secondary;
                                    e.target.style.borderColor =
                                      colors.border.default;
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (
                                    !hasPendingProposalForPeriod(
                                      periodName,
                                      pendingLimitProposals
                                    )
                                  ) {
                                    e.target.style.opacity = "0.7";
                                    e.target.style.color = colors.text.muted;
                                    e.target.style.borderColor =
                                      colors.border.default;
                                  }
                                }}
                              >
                                🗑️ Remove
                              </button>
                            </span>
                          )}
                        </>
                      ) : (
                        <div
                          style={{
                            color: colors.text.muted,
                            fontSize: "0.9em",
                            fontStyle: "italic",
                            textAlign: "center",
                            padding: "8px",
                          }}
                        >
                          {isSetupCommitted
                            ? "🔒 Click Edit to add this limit via proposal system"
                            : "Enter an amount above to activate this limit"}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}

        <div
          style={{
            fontSize: "0.8em",
            color: colors.text.muted,
            marginBottom: "15px",
          }}
        >
          💡 Tip: a shorter period may never allow more spending than a longer
          one — daily ≤ weekly ≤ monthly ≤ yearly
        </div>
      </div>

      {/* Custom Periods Section - Hidden (not implemented) */}
      {false && (
      <div style={layoutStyles.marginBottomLarge}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <h4 style={{ color: colors.accent.pink, margin: 0 }}>
            ⚙️ Custom Time Periods
          </h4>
          <button
            onClick={() => setShowCustomPeriod(!showCustomPeriod)}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: `1px solid ${colors.border.default}`,
              backgroundColor: "transparent",
              color: colors.text.secondary,
              cursor: "pointer",
              fontSize: "0.9em",
            }}
          >
            {showCustomPeriod ? "➖ Hide" : "➕ Add"} Custom Period
          </button>
        </div>

        {/* Custom Periods List */}
        {spendingLimits.filter(
          (limit) => !supportedPeriods.includes(limit.name)
        ).length > 0 && (
          <div style={layoutStyles.marginBottom}>
            <div style={{ display: "grid", gap: "10px" }}>
              {spendingLimits
                .filter(
                  (limit) =>
                    !supportedPeriods.includes(limit.name)
                )
                .map((limit, index) => {
                  const progressPercent =
                    limit.limit > 0
                      ? (parseFloat(limit.spent) /
                          parseFloat(limit.limit)) *
                        100
                      : 0;
                  const isNearLimit = progressPercent > 80;
                  const isAtLimit = progressPercent >= 100;

                  return (
                    <div
                      key={index}
                      style={{
                        padding: "12px",
                        border: isAtLimit
                          ? `1px solid ${colors.border.error}`
                          : isNearLimit
                          ? `1px solid ${colors.border.warning}`
                          : `1px solid ${colors.border.success}`,
                        borderRadius: "6px",
                        backgroundColor: colors.background.dark,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "5px",
                          }}
                        >
                          <span
                            style={{
                              color: colors.text.primary,
                              fontWeight: fontWeight.bold,
                            }}
                          >
                            ⚙️ {limit.name}
                          </span>
                          <span
                            style={{
                              color: isAtLimit ? colors.error.light : colors.success.light,
                              fontWeight: "bold",
                            }}
                          >
                            {formatAmount(limit.remaining)} {tokenSymbol} remaining
                          </span>
                        </div>
                        <div
                          style={{ fontSize: "0.8em", color: colors.text.muted }}
                        >
                          Duration:{" "}
                          {limit.durationDays > 0
                            ? `${limit.durationDays} days`
                            : `${limit.durationHours} hours`}{" "}
                          • Limit: {formatAmount(limit.limit)} {tokenSymbol} • Spent:{" "}
                          {formatAmount(limit.spent)} {tokenSymbol}
                        </div>
                      </div>
                      <button
                        onClick={() => removeLimitPeriod(limit.name)}
                        style={{
                          marginLeft: "10px",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          border: `1px solid ${colors.border.error}`,
                          backgroundColor: "transparent",
                          color: colors.error.main,
                          cursor: "pointer",
                          fontSize: "0.8em",
                        }}
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Custom Period Form */}
        {showCustomPeriod && (
          <div
            style={{
              padding: "15px",
              backgroundColor: colors.background.dark,
              borderRadius: "4px",
              border: `1px solid ${colors.border.default}`,
            }}
          >
            <p
              style={{
                fontSize: "0.8em",
                color: colors.text.muted,
                marginBottom: "15px",
              }}
            >
              Create custom periods like "Salary Cycle", "Quarterly
              Budget", or any duration you need.
            </p>

            <div
              style={{
                display: "grid",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.9em",
                    color: colors.text.secondary,
                    marginBottom: "5px",
                  }}
                >
                  Period Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., 'Salary Cycle', 'Quarterly Budget'"
                  value={customPeriodName}
                  onChange={(e) => setCustomPeriodName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: `1px solid ${colors.border.default}`,
                    backgroundColor: colors.background.secondary,
                    color: "white",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.9em",
                      color: colors.text.secondary,
                      marginBottom: "5px",
                    }}
                  >
                    Limit (USDT)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 2000"
                    value={customPeriodLimit}
                    onChange={(e) => setCustomPeriodLimit(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: `1px solid ${colors.border.default}`,
                      backgroundColor: colors.background.secondary,
                      color: "white",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.9em",
                      color: colors.text.secondary,
                      marginBottom: "5px",
                    }}
                  >
                    Duration
                  </label>
                  <select
                    value={customPeriodDuration}
                    onChange={(e) =>
                      setCustomPeriodDuration(e.target.value)
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: `1px solid ${colors.border.default}`,
                      backgroundColor: colors.background.secondary,
                      color: "white",
                    }}
                  >
                    <option value="3600">Per Hour</option>
                    <option value="86400">Per Day</option>
                    <option value="604800">Per Week</option>
                    <option value="1209600">Bi-weekly (14 days)</option>
                    <option value="2592000">Per Month (30 days)</option>
                    <option value="7776000">Per Quarter (90 days)</option>
                    <option value="15552000">
                      Semi-annual (180 days)
                    </option>
                    <option value="31536000">Per Year (365 days)</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={addCustomPeriod}
              style={{
                padding: "10px 20px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: colors.accent.purple,
                color: "white",
                cursor: "pointer",
                fontSize: "0.9em",
                fontWeight: "bold",
                width: "100%",
              }}
            >
              ⚙️ Add Custom Period
            </button>
          </div>
        )}
      </div>
      )}

      {/* Pending Limit Proposals Section */}
      {pendingLimitProposals.length > 0 && (
        <div style={layoutStyles.marginBottomLarge}>
          <h4 style={{ color: colors.warning.main, margin: "0 0 15px 0" }}>
            ⏳ Pending Limit Changes ({pendingLimitProposals.length})
          </h4>
          <p
            style={{
              fontSize: "0.8em",
              color: colors.text.muted,
              marginBottom: "15px",
            }}
          >
            {/* Note: networkType would need to be passed as prop if this text needs to be dynamic */}
            These limit change proposals are waiting for the timelock period to expire before they can be executed.
          </p>

          <div style={{ display: "grid", gap: "10px" }}>
            {pendingLimitProposals.map((proposal, index) => {
              const isReady =
                proposal.executeAfter &&
                currentTime >= proposal.executeAfter;

              // Calculate real-time countdown
              const timeRemaining = proposal.executeAfter
                ? Math.max(0, proposal.executeAfter - currentTime)
                : 0;
              const countdownText = formatTimeRemaining(timeRemaining);

              return (
                <div
                  key={index}
                  style={{
                    padding: "12px",
                    border: isReady
                      ? `1px solid ${colors.border.success}`
                      : `1px solid ${colors.border.warning}`,
                    borderRadius: "6px",
                    backgroundColor: colors.background.dark,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "5px",
                      }}
                    >
                      <span
                        style={{
                          color: colors.text.primary,
                          fontWeight: fontWeight.bold,
                        }}
                      >
                        📝{" "}
                        {proposal.action === "change"
                          ? "Update"
                          : "Remove"}{" "}
                        {proposal.periodName}
                      </span>
                      <span
                        style={{
                          fontSize: "0.8em",
                          padding: "4px 8px",
                          borderRadius: "12px",
                          backgroundColor: isReady
                            ? colors.success.main
                            : colors.warning.main,
                          color: "white",
                          fontWeight: "bold",
                        }}
                      >
                        {isReady ? "✅ Ready" : `⏰ ${countdownText}`}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8em", color: colors.text.muted }}>
                      {proposal.action === "change" ? (
                        <>New Limit: {proposal.newLimit} {tokenSymbol}</>
                      ) : (
                        <>Action: Remove limit entirely</>
                      )}
                      {proposal.submittedAt && (
                        <>
                          {" "}
                          • Submitted:{" "}
                          {new Date(
                            proposal.submittedAt
                          ).toLocaleString()}
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginLeft: "10px",
                    }}
                  >
                    {isReady && (
                      <button
                        onClick={() => executeProposal(proposal)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "4px",
                          border: "none",
                          backgroundColor: colors.success.main,
                          color: "white",
                          cursor: "pointer",
                          fontSize: "0.8em",
                          fontWeight: "bold",
                        }}
                      >
                        ⚡ Execute
                      </button>
                    )}
                    <button
                      onClick={() => cancelProposal(proposal)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "4px",
                        border: `1px solid ${colors.border.error}`,
                        backgroundColor: "transparent",
                        color: colors.error.main,
                        cursor: "pointer",
                        fontSize: "0.8em",
                      }}
                    >
                      ❌ Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: "15px",
              fontSize: "0.8em",
              color: colors.text.muted,
            }}
          >
            💡 Proposals become executable after the timelock period for
            security. Execute them when ready.
          </div>
        </div>
      )}
    </div>
  );
};

export default SpendingLimitsSetup;