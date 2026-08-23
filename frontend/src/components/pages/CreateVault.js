import React, { useState } from "react";
import {
  buttonStyles,
  formStyles,
  colors,
  spacing,
  fontSize,
  borderRadius,
} from "../../styles";
import { getTokenMeta, isStablecoin } from "../../utils/tokenUtils.js";
import LimitModeToggle from "../molecules/LimitModeToggle.js";
import LimitPeriodCards from "../molecules/LimitPeriodCards.js";
import { trackEvent } from "../../utils/posthog.js";

const EVM_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function CreateVault({ transactionManager, navigate, networkConfig }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tokenValue, setTokenValue] = useState(null);
  const [customToken, setCustomToken] = useState("");
  const [limitMode, setLimitMode] = useState("percent");
  const [modeTouched, setModeTouched] = useState(false);
  const [limits, setLimits] = useState({ Daily: "5", Weekly: "", Monthly: "" });
  const [penaltyPct, setPenaltyPct] = useState("20");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const nativeMeta = getTokenMeta(networkConfig, null);
  const tokenOptions = [
    { label: `${nativeMeta.symbol} (Native)`, value: null, symbol: nativeMeta.symbol },
    ...(networkConfig?.tokens
      ? Object.entries(networkConfig.tokens)
          .filter(([, t]) => t.address && t.address !== "native" && t.address !== EVM_ZERO_ADDRESS)
          .map(([symbol, t]) => ({ label: symbol, value: t.address, symbol }))
      : []),
    { label: "Custom token address", value: "custom", symbol: null },
  ];

  const resolvedToken = tokenValue === "custom" ? customToken.trim() || null : tokenValue;
  const selectedMeta = getTokenMeta(networkConfig, resolvedToken);
  const isPercent = limitMode === "percent";

  const handleTokenChange = (value) => {
    setTokenValue(value);
    // Suggest the mode that fits the token unless the user chose one explicitly:
    // fixed amounts for stablecoins, percentages for volatile assets.
    if (!modeTouched && value !== "custom") {
      const meta = getTokenMeta(networkConfig, value);
      setLimitMode(isStablecoin(meta.symbol) ? "fixed" : "percent");
    }
  };

  const handleModeChange = (mode) => {
    setLimitMode(mode);
    setModeTouched(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("Vault name is required"); return; }
    if (tokenValue === "custom" && !customToken.trim()) {
      setError("Enter the token address, or pick a listed token");
      return;
    }
    const dailyVal = parseFloat(limits.Daily) || 0;
    const weeklyVal = parseFloat(limits.Weekly) || 0;
    const monthlyVal = parseFloat(limits.Monthly) || 0;
    if (!dailyVal && !weeklyVal && !monthlyVal) {
      setError("At least one withdrawal limit is required");
      return;
    }
    if (isPercent && (dailyVal > 100 || weeklyVal > 100 || monthlyVal > 100)) {
      setError("Percentage limits cannot exceed 100%");
      return;
    }

    try {
      setLoading(true);
      const result = await transactionManager.createVault({
        name: name.trim(),
        description: description.trim(),
        vaultType: "Personal",
        tokenMint: resolvedToken,
        dailyLimit: dailyVal,
        weeklyLimit: weeklyVal,
        monthlyLimit: monthlyVal,
        penaltyRateBps: Math.round(parseFloat(penaltyPct || "20") * 100),
        limitsArePercentage: isPercent,
      });
      trackEvent("vault_created");
      // Switch the main wallet flow to the new vault and go home
      transactionManager.setActiveVault(result.vaultAddress);
      navigate("/");
    } catch (err) {
      console.error("Create vault failed:", err);
      setError(err.message || "Failed to create vault");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    ...formStyles.input,
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <button
        style={{ ...buttonStyles.secondary, marginBottom: spacing.lg }}
        onClick={() => navigate("/")}
      >
        &larr; Back
      </button>

      <h2 style={{ color: "white", marginBottom: spacing.xl }}>Create Vault</h2>

      <form onSubmit={handleSubmit}>
        {/* Name */}
        <div style={{ marginBottom: spacing.lg }}>
          <label style={formStyles.label}>Vault Name *</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Personal Savings, Gambling Budget"
            maxLength={32}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: spacing.lg }}>
          <label style={formStyles.label}>Description</label>
          <textarea
            style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional vault description"
            maxLength={256}
          />
        </div>

        {/* Token */}
        <div style={{ marginBottom: spacing.lg }}>
          <label style={formStyles.label}>Token</label>
          <select
            style={inputStyle}
            value={tokenValue || "null"}
            onChange={(e) => handleTokenChange(e.target.value === "null" ? null : e.target.value)}
          >
            {tokenOptions.map((opt) => (
              <option key={opt.value || "null"} value={opt.value || "null"}>
                {opt.label}
              </option>
            ))}
          </select>
          {tokenValue === "custom" && (
            <input
              style={{ ...inputStyle, marginTop: spacing.sm }}
              value={customToken}
              onChange={(e) => setCustomToken(e.target.value)}
              placeholder="Token contract / mint address"
            />
          )}
        </div>

        {/* Withdrawal Limits — same UI as the initial wallet setup */}
        <div style={{ marginBottom: spacing.lg }}>
          <label style={formStyles.label}>Withdrawal Limits</label>
          <LimitModeToggle mode={limitMode} onChange={handleModeChange} />
          <LimitPeriodCards
            values={limits}
            onChange={(period, value) => setLimits((prev) => ({ ...prev, [period]: value }))}
            unit={isPercent ? "%" : selectedMeta.symbol}
          />
          <p style={{ fontSize: fontSize.xs, color: colors.text.secondary, marginTop: spacing.sm }}>
            Set at least one limit. Leave empty to skip a period. Daily ≤ Weekly ≤ Monthly.
          </p>
        </div>

        {/* Penalty Rate */}
        <div style={{ marginBottom: spacing.xl }}>
          <label style={formStyles.label}>Penalty Rate %</label>
          <input
            style={{ ...inputStyle, maxWidth: "120px" }}
            type="number"
            step="any"
            min="0.01"
            max="50"
            value={penaltyPct}
            onChange={(e) => setPenaltyPct(e.target.value)}
          />
          <p style={{ fontSize: fontSize.xs, color: colors.text.secondary, marginTop: spacing.sm }}>
            Fee charged for withdrawals that bypass limits. Sent to platform treasury.
          </p>
        </div>

        {error && (
          <div style={{
            padding: spacing.md,
            marginBottom: spacing.lg,
            backgroundColor: "rgba(229,62,62,0.1)",
            border: `1px solid ${colors.border.error}`,
            borderRadius: borderRadius.sm,
            color: colors.error.light,
            fontSize: fontSize.sm,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          style={{ ...buttonStyles.primary, width: "100%", opacity: loading ? 0.6 : 1 }}
          disabled={loading}
        >
          {loading ? "Creating Vault..." : "Create Vault"}
        </button>
      </form>
    </div>
  );
}

export default CreateVault;
