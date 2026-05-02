import React, { useState, useEffect, useCallback } from "react";

// Import styles directly from theme and components
import { colors, fontWeight } from "../../styles/theme.js";
import { layoutStyles } from "../../styles/components/layout.js";
import { stepStyles } from "../../styles/components/steps.js";

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

  // Internal state for card interactions (hover and focus)
  const [cardStates, setCardStates] = useState({
    Daily: { isHovered: false, isFocused: false },
    Weekly: { isHovered: false, isFocused: false },
    Monthly: { isHovered: false, isFocused: false },
  });

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
  const [limitEdits, setLimitEdits] = useState({
    Daily: { value: "", isActive: false, isEditing: false },
    Weekly: { value: "", isActive: false, isEditing: false },
    Monthly: { value: "", isActive: false, isEditing: false },
  });

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
  }, [transactionManager, savingsContract, solanaConnected, networkType]);

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
      // Extract limits from limitEdits - check for any valid input
      const daily = limitEdits.Daily.value ? parseFloat(limitEdits.Daily.value) : 0;
      const weekly = limitEdits.Weekly.value ? parseFloat(limitEdits.Weekly.value) : 0;
      const monthly = limitEdits.Monthly.value ? parseFloat(limitEdits.Monthly.value) : 0;

      // Check if user has entered any spending limit values
      if (daily === 0 && weekly === 0 && monthly === 0) {
        console.error("🚨 saveLimitChanges called with all zero values!", {
          daily, weekly, monthly,
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

      // Validate basic limit ordering - allow restrictive limits
      if (daily > 0 && weekly > 0 && daily > weekly) {
        alert("Daily limit cannot exceed weekly limit");
        return;
      }
      if (weekly > 0 && monthly > 0 && weekly > monthly) {
        alert("Weekly limit cannot exceed monthly limit");
        return;
      }
      if (daily > 0 && monthly > 0 && daily > monthly) {
        alert("Daily limit cannot exceed monthly limit");
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
      if (error.message.includes("Daily limit too high")) {
        alert("Daily limit is too high for the weekly limit");
      } else if (error.message.includes("Weekly limit too high")) {
        alert("Weekly limit is too high for the monthly limit");
      } else {
        alert(`Failed to save limit changes: ${error.message}`);
      }
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

      const vault = await transactionManager.getPersonalVault();
      const currentRules = {
        dailyLimit: vault?.dailyLimit || 0,
        weeklyLimit: vault?.weeklyLimit || 0,
        monthlyLimit: vault?.monthlyLimit || 0,
        penaltyRateBps: vault?.penaltyRateBps || 2000,
        limitsArePercentage: vault?.limitsArePercentage || false,
      };
      const decimals = vault?.isSolVault ? 9 : 6;
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
        const vault = await transactionManager.getPersonalVault();
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
      : `2px solid ${colors.border?.light || "#4a5568"}`,
    borderRadius: "12px",
    backgroundColor: colors.background?.primary || "#2d3748",
    color: colors.text?.primary || "white",
  };

  return (
    <div style={stepContainerStyle}>
      {/* Header */}
      <div style={stepStyles.stepHeader}>
        <h3
          style={{
            ...stepStyles.step1Title,
            color: colors.success?.light || "#9ae6b4",
          }}
        >
          💰 Spending Limits
        </h3>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: "0.9em",
          color: "#cbd5e0",
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
            color: "#a0aec0",
            backgroundColor: "#1a202c",
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "15px",
            borderLeft: "3px solid #f6ad55",
          }}
        >
          💡 <strong>Tip:</strong> Set at least one spending limit to
          continue. You can add multiple periods (daily + weekly +
          monthly) for layered protection.
        </div>
      )}

      {/* Daily/Weekly/Monthly Cards */}
      <div style={layoutStyles.marginBottomLarge}>
        <h4 style={{ color: "#9ae6b4", margin: "0 0 15px 0" }}>
          🎯 Standard Time Periods
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "15px",
            marginBottom: "15px",
          }}
        >
          {["Daily", "Weekly", "Monthly"].map((periodName) => {
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
                ? "#1a202c"
                : isBeingConfigured
                ? "#2a4a5a"
                : "#4a5568",
              border: isActive
                ? isAtLimit
                  ? "2px solid #e53e3e"
                  : isNearLimit
                  ? "2px solid #ed8936"
                  : "2px solid #48bb78"
                : isBeingConfigured || hasUnsavedChanges
                ? "2px solid #9ae6b4"
                : "2px dashed #718096",
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
                    ? "#2d3748"
                    : isBeingConfigured
                    ? "#3a5a6a"
                    : "#5a6578"
                  : cardStyle.backgroundColor,
              border:
                (isHovered || isFocused) && isInteractive
                  ? isActive
                    ? isAtLimit
                      ? "2px solid #fc8181"
                      : isNearLimit
                      ? "2px solid #f6ad55"
                      : "2px solid #68d391"
                    : "2px solid #9ae6b4"
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
                        ? "#e2e8f0"
                        : "#a0aec0",
                      margin: 0,
                      fontSize: "1.1em",
                      fontWeight: "bold",
                    }}
                  >
                    {periodName === "Daily"
                      ? "📅"
                      : periodName === "Weekly"
                      ? "📊"
                      : "📈"}{" "}
                    {periodName}
                  </h5>
                  {isActive && existingLimit && (
                    <span
                      style={{
                        fontSize: "0.8em",
                        padding: "4px 8px",
                        borderRadius: "12px",
                        backgroundColor: isAtLimit
                          ? "#e53e3e"
                          : isNearLimit
                          ? "#ed8936"
                          : "#48bb78",
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
                        border: "1px solid #4a5568",
                        backgroundColor: "#4a5568",
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
                        style={{ color: "#e2e8f0", fontSize: "0.9em" }}
                      >
                        Remaining
                      </span>
                      <span
                        style={{
                          color: isAtLimit ? "#fc8181" : "#9ae6b4",
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
                        color: "#a0aec0",
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
                        backgroundColor: "#4a5568",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(progressPercent, 100)}%`,
                          height: "100%",
                          backgroundColor: isAtLimit
                            ? "#e53e3e"
                            : isNearLimit
                            ? "#ed8936"
                            : "#48bb78",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  !isActive &&
                  isSetupCommitted && (
                    <div style={layoutStyles.marginBottomSmall}>
                      <div
                        style={{
                          color: "#a0aec0",
                          fontSize: "0.9em",
                          fontStyle: "italic",
                          textAlign: "center",
                          padding: "16px",
                          backgroundColor: "#2d3748",
                          borderRadius: "6px",
                          border: "1px solid #4a5568",
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
                            backgroundColor: "#ed8936",
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
                            backgroundColor: "#48bb78",
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
                          border: "1px solid #4a5568",
                          backgroundColor: "transparent",
                          color: "#e2e8f0",
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
                                border: "1px solid #4a5568",
                                backgroundColor: "#2d3748",
                                backgroundImage: "none",
                                color: hasPendingProposalForPeriod(
                                  periodName,
                                  pendingLimitProposals
                                )
                                  ? "#555"
                                  : "#a0aec0",
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
                                  e.target.style.color = "#e2e8f0";
                                  e.target.style.borderColor = "#718096";
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
                                  e.target.style.color = "#a0aec0";
                                  e.target.style.borderColor = "#4a5568";
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
                                  border: "1px solid #4a5568",
                                  backgroundColor: "#2d3748",
                                  backgroundImage: "none",
                                  color: hasPendingProposalForPeriod(
                                    periodName,
                                    pendingLimitProposals
                                  )
                                    ? "#555"
                                    : "#a0aec0",
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
                                    e.target.style.color = "#e2e8f0";
                                    e.target.style.borderColor =
                                      "#718096";
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
                                    e.target.style.color = "#a0aec0";
                                    e.target.style.borderColor =
                                      "#4a5568";
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
                            color: "#a0aec0",
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

        <div
          style={{
            fontSize: "0.8em",
            color: "#a0aec0",
            marginBottom: "15px",
          }}
        >
          💡 Tip: Daily ≤ Weekly ≤ Monthly for logical spending control
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
          <h4 style={{ color: "#fbb6ce", margin: 0 }}>
            ⚙️ Custom Time Periods
          </h4>
          <button
            onClick={() => setShowCustomPeriod(!showCustomPeriod)}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "1px solid #4a5568",
              backgroundColor: "transparent",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: "0.9em",
            }}
          >
            {showCustomPeriod ? "➖ Hide" : "➕ Add"} Custom Period
          </button>
        </div>

        {/* Custom Periods List */}
        {spendingLimits.filter(
          (limit) => !["Daily", "Weekly", "Monthly"].includes(limit.name)
        ).length > 0 && (
          <div style={layoutStyles.marginBottom}>
            <div style={{ display: "grid", gap: "10px" }}>
              {spendingLimits
                .filter(
                  (limit) =>
                    !["Daily", "Weekly", "Monthly"].includes(limit.name)
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
                          ? "1px solid #e53e3e"
                          : isNearLimit
                          ? "1px solid #ed8936"
                          : "1px solid #48bb78",
                        borderRadius: "6px",
                        backgroundColor: "#1a202c",
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
                              color: isAtLimit ? "#fc8181" : "#9ae6b4",
                              fontWeight: "bold",
                            }}
                          >
                            {formatAmount(limit.remaining)} {tokenSymbol} remaining
                          </span>
                        </div>
                        <div
                          style={{ fontSize: "0.8em", color: "#a0aec0" }}
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
                          border: "1px solid #e53e3e",
                          backgroundColor: "transparent",
                          color: "#e53e3e",
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
              backgroundColor: "#1a202c",
              borderRadius: "4px",
              border: "1px solid #4a5568",
            }}
          >
            <p
              style={{
                fontSize: "0.8em",
                color: "#a0aec0",
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
                    color: "#e2e8f0",
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
                    border: "1px solid #4a5568",
                    backgroundColor: "#4a5568",
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
                      color: "#e2e8f0",
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
                      border: "1px solid #4a5568",
                      backgroundColor: "#4a5568",
                      color: "white",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.9em",
                      color: "#e2e8f0",
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
                      border: "1px solid #4a5568",
                      backgroundColor: "#4a5568",
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
                backgroundColor: "#ed64a6",
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
          <h4 style={{ color: "#ed8936", margin: "0 0 15px 0" }}>
            ⏳ Pending Limit Changes ({pendingLimitProposals.length})
          </h4>
          <p
            style={{
              fontSize: "0.8em",
              color: "#a0aec0",
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
                      ? "1px solid #48bb78"
                      : "1px solid #ed8936",
                    borderRadius: "6px",
                    backgroundColor: "#1a202c",
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
                            ? "#48bb78"
                            : "#ed8936",
                          color: "white",
                          fontWeight: "bold",
                        }}
                      >
                        {isReady ? "✅ Ready" : `⏰ ${countdownText}`}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8em", color: "#a0aec0" }}>
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
                          backgroundColor: "#48bb78",
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
                        border: "1px solid #e53e3e",
                        backgroundColor: "transparent",
                        color: "#e53e3e",
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
              color: "#a0aec0",
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