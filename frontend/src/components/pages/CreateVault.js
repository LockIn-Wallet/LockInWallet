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

const EVM_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const LIMIT_MODES = [
  {
    key: "percent",
    label: "% of balance",
    hint: "The limit scales with your balance — best for volatile assets whose price moves a lot.",
  },
  {
    key: "fixed",
    label: "Fixed amount",
    hint: "A predictable amount per period — best for stablecoins.",
  },
];

function CreateVault({ transactionManager, navigate, networkConfig }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vaultType, setVaultType] = useState("Personal");
  const [tokenValue, setTokenValue] = useState(null);
  const [customToken, setCustomToken] = useState("");
  const [limitMode, setLimitMode] = useState("percent");
  const [modeTouched, setModeTouched] = useState(false);
  const [daily, setDaily] = useState("5");
  const [weekly, setWeekly] = useState("");
  const [monthly, setMonthly] = useState("");
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
  const limitUnit = isPercent ? "%" : selectedMeta.symbol;

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
    const dailyVal = parseFloat(daily) || 0;
    const weeklyVal = parseFloat(weekly) || 0;
    const monthlyVal = parseFloat(monthly) || 0;
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
        vaultType,
        tokenMint: resolvedToken,
        dailyLimit: dailyVal,
        weeklyLimit: weeklyVal,
        monthlyLimit: monthlyVal,
        penaltyRateBps: Math.round(parseFloat(penaltyPct || "20") * 100),
        limitsArePercentage: isPercent,
      });
      navigate(`/vault/${result.vaultAddress}`);
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
        {/* Vault Type */}
        <div style={{ marginBottom: spacing.xl }}>
          <label style={formStyles.label}>Vault Type</label>
          <div style={{ display: "flex", gap: spacing.md }}>
            {["Personal", "Community"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setVaultType(type)}
                style={{
                  ...buttonStyles.secondary,
                  flex: 1,
                  border: `2px solid ${vaultType === type
                    ? (type === "Personal" ? colors.success.main : "#805ad5")
                    : "transparent"
                  }`,
                  backgroundColor: vaultType === type
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                  {type === "Personal" ? "Personal" : "Community"}
                </div>
                <div style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>
                  {type === "Personal"
                    ? "Only you. Mutable rules."
                    : "Shareable. Immutable rules."}
                </div>
              </button>
            ))}
          </div>
        </div>

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

        {/* Limit mode */}
        <div style={{ marginBottom: spacing.lg }}>
          <label style={formStyles.label}>Withdrawal Limit Type</label>
          <div style={{ display: "flex", gap: spacing.md }}>
            {LIMIT_MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => handleModeChange(mode.key)}
                style={{
                  ...buttonStyles.secondary,
                  flex: 1,
                  border: `2px solid ${limitMode === mode.key ? colors.success.main : "transparent"}`,
                  backgroundColor: limitMode === mode.key
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ fontWeight: "bold", marginBottom: "4px" }}>{mode.label}</div>
                <div style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>
                  {mode.hint}
                </div>
              </button>
            ))}
          </div>
          {!modeTouched && (
            <p style={{ fontSize: fontSize.xs, color: colors.text.secondary, marginTop: spacing.sm }}>
              Suggested automatically for the selected token — stablecoins default to fixed
              amounts, volatile assets to a share of your balance.
            </p>
          )}
        </div>

        {/* Withdrawal Limits */}
        <div style={{ marginBottom: spacing.lg }}>
          <label style={formStyles.label}>
            Withdrawal Limits ({isPercent ? "% of your balance" : selectedMeta.symbol})
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: spacing.md }}>
            {[
              { label: "Daily", value: daily, set: setDaily, placeholder: isPercent ? "e.g. 5" : "e.g. 100" },
              { label: "Weekly", value: weekly, set: setWeekly, placeholder: isPercent ? "e.g. 20" : "e.g. 500" },
              { label: "Monthly", value: monthly, set: setMonthly, placeholder: isPercent ? "e.g. 50" : "e.g. 2000" },
            ].map((field) => (
              <div key={field.label}>
                <label style={{ ...formStyles.label, fontSize: fontSize.xs }}>
                  {field.label} ({limitUnit})
                </label>
                <input
                  style={inputStyle}
                  type="number"
                  step="any"
                  min="0"
                  max={isPercent ? "100" : undefined}
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
          <p style={{ fontSize: fontSize.xs, color: colors.text.secondary, marginTop: spacing.sm }}>
            Set at least one limit. Leave empty to skip a period. Each period must allow at
            least as much as the shorter one.
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
            Fee charged for withdrawals that bypass limits.
            {vaultType === "Community"
              ? " Redistributed to other vault members."
              : " Sent to platform treasury."}
          </p>
        </div>

        {error && (
          <div style={{
            padding: spacing.md,
            marginBottom: spacing.lg,
            backgroundColor: "rgba(229,62,62,0.1)",
            border: "1px solid #e53e3e",
            borderRadius: borderRadius.sm,
            color: "#fc8181",
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
