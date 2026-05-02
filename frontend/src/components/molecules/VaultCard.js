import React from "react";
import { colors, spacing, fontSize, borderRadius } from "../../styles";
import { getTokenDecimals, formatTokenAmount, formatLimit, formatPenalty } from "../../utils/formatUtils";

function VaultCard({ vault, membership, onClick }) {
  const isPersonal = vault.vaultType === "Personal";
  const borderColor = isPersonal ? colors.success.main : "#805ad5";
  const decimals = getTokenDecimals(vault);
  const tokenLabel = vault.isSolVault ? "SOL" : "USD";

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: colors.background.primary,
        border: `2px solid ${borderColor}`,
        borderRadius: borderRadius.md,
        padding: spacing.xl,
        cursor: "pointer",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.3)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
        <h3 style={{ margin: 0, color: "white", fontSize: fontSize.lg }}>
          {vault.name}
        </h3>
        <span style={{
          fontSize: fontSize.xs,
          padding: "2px 8px",
          borderRadius: borderRadius.sm,
          backgroundColor: isPersonal ? "rgba(72,187,120,0.2)" : "rgba(128,90,213,0.2)",
          color: isPersonal ? colors.success.light : "#d6bcfa",
        }}>
          {vault.vaultType}
        </span>
      </div>

      {/* Token */}
      <div style={{ fontSize: fontSize.sm, color: colors.text.secondary, marginBottom: spacing.md }}>
        {vault.isSolVault ? "SOL" : `SPL: ${vault.tokenMint.slice(0, 8)}...`}
      </div>

      {/* Your balance */}
      {membership && (
        <div style={{ marginBottom: spacing.md }}>
          <div style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>Your Balance</div>
          <div style={{ fontSize: fontSize.xl, color: "white", fontWeight: "bold" }}>
            {formatTokenAmount(membership.balance, decimals)} {tokenLabel}
          </div>
        </div>
      )}

      {/* Limits */}
      <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap", marginBottom: spacing.sm }}>
        {vault.dailyLimit > 0 && (
          <LimitBadge label="Daily" value={formatLimit(vault.dailyLimit, vault)} />
        )}
        {vault.weeklyLimit > 0 && (
          <LimitBadge label="Weekly" value={formatLimit(vault.weeklyLimit, vault)} />
        )}
        {vault.monthlyLimit > 0 && (
          <LimitBadge label="Monthly" value={formatLimit(vault.monthlyLimit, vault)} />
        )}
      </div>

      {/* Footer stats */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: fontSize.xs,
        color: colors.text.secondary,
        borderTop: `1px solid ${colors.border?.default || "#4a5568"}`,
        paddingTop: spacing.sm,
        marginTop: spacing.sm,
      }}>
        <span>{vault.memberCount} member{vault.memberCount !== 1 ? "s" : ""}</span>
        <span>Penalty: {formatPenalty(vault.penaltyRateBps)}</span>
      </div>
    </div>
  );
}

function LimitBadge({ label, value }) {
  return (
    <span style={{
      fontSize: fontSize.xs,
      padding: "2px 6px",
      borderRadius: borderRadius.sm,
      backgroundColor: "rgba(255,255,255,0.05)",
      color: colors.text.secondary,
    }}>
      {label}: {value}
    </span>
  );
}

export default VaultCard;
