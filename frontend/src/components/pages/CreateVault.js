import React, { useState } from "react";
import {
  buttonStyles,
  formStyles,
  cardStyles,
  colors,
  spacing,
  fontSize,
  borderRadius,
} from "../../styles";

const TOKEN_OPTIONS = [
  { label: "SOL (Native)", value: null, decimals: 9 },
];

function CreateVault({ transactionManager, navigate, networkConfig }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vaultType, setVaultType] = useState("Personal");
  const [tokenMint, setTokenMint] = useState(null);
  const [customMint, setCustomMint] = useState("");
  const [dailyPct, setDailyPct] = useState("5");
  const [weeklyPct, setWeeklyPct] = useState("");
  const [monthlyPct, setMonthlyPct] = useState("");
  const [penaltyPct, setPenaltyPct] = useState("20");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Build token options from network config
  const splTokens = networkConfig?.tokens
    ? Object.entries(networkConfig.tokens)
        .filter(([, t]) => t.address && t.address !== "native")
        .map(([symbol, t]) => ({ label: symbol, value: t.address, decimals: t.decimals || 6 }))
    : [];
  const allTokenOptions = [...TOKEN_OPTIONS, ...splTokens, { label: "Custom SPL Token", value: "custom" }];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("Vault name is required"); return; }
    if (!dailyPct && !weeklyPct && !monthlyPct) {
      setError("At least one withdrawal limit is required");
      return;
    }

    const daily = dailyPct ? Math.round(parseFloat(dailyPct) * 100) : 0;
    const weekly = weeklyPct ? Math.round(parseFloat(weeklyPct) * 100) : 0;
    const monthly = monthlyPct ? Math.round(parseFloat(monthlyPct) * 100) : 0;
    const penalty = Math.round(parseFloat(penaltyPct || "20") * 100);

    const resolvedMint = tokenMint === "custom" ? customMint || null : tokenMint;

    try {
      setLoading(true);
      const result = await transactionManager.createVault({
        name: name.trim(),
        description: description.trim(),
        vaultType,
        tokenMint: resolvedMint,
        dailyLimit: daily,
        weeklyLimit: weekly,
        monthlyLimit: monthly,
        penaltyRateBps: penalty,
        limitsArePercentage: true,
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
            placeholder="e.g. My Savings, Diamond Hands BONK"
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
            value={tokenMint || "null"}
            onChange={(e) => setTokenMint(e.target.value === "null" ? null : e.target.value)}
          >
            {allTokenOptions.map((opt) => (
              <option key={opt.value || "null"} value={opt.value || "null"}>
                {opt.label}
              </option>
            ))}
          </select>
          {tokenMint === "custom" && (
            <input
              style={{ ...inputStyle, marginTop: spacing.sm }}
              value={customMint}
              onChange={(e) => setCustomMint(e.target.value)}
              placeholder="SPL token mint address"
            />
          )}
        </div>

        {/* Withdrawal Limits */}
        <div style={{ marginBottom: spacing.lg }}>
          <label style={formStyles.label}>Withdrawal Limits (% of balance)</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: spacing.md }}>
            <div>
              <label style={{ ...formStyles.label, fontSize: fontSize.xs }}>Daily %</label>
              <input
                style={inputStyle}
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={dailyPct}
                onChange={(e) => setDailyPct(e.target.value)}
                placeholder="e.g. 5"
              />
            </div>
            <div>
              <label style={{ ...formStyles.label, fontSize: fontSize.xs }}>Weekly %</label>
              <input
                style={inputStyle}
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={weeklyPct}
                onChange={(e) => setWeeklyPct(e.target.value)}
                placeholder="e.g. 20"
              />
            </div>
            <div>
              <label style={{ ...formStyles.label, fontSize: fontSize.xs }}>Monthly %</label>
              <input
                style={inputStyle}
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={monthlyPct}
                onChange={(e) => setMonthlyPct(e.target.value)}
                placeholder="e.g. 50"
              />
            </div>
          </div>
          <p style={{ fontSize: fontSize.xs, color: colors.text.secondary, marginTop: spacing.sm }}>
            Set at least one limit. Leave empty to skip a period.
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
