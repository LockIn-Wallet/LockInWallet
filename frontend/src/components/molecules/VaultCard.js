import React from "react";
import { colors, spacing, fontSize, borderRadius } from "../../styles";
import { getTokenSymbol, formatPenalty } from "../../utils/formatUtils";

function VaultCard({ vault, onClick, isSelected = false }) {
  const isPersonal = vault.vaultType === "Personal";
  const borderColor = isSelected
    ? colors.success.light
    : isPersonal
    ? colors.success.main
    : colors.accent.purple;
  // What the vault holds. A stables vault holds several coins under one dollar
  // cap, so it names them; a coin vault names its one coin. Falling back to a
  // truncated address is for a coin the app has no metadata for.
  const tokenLabel =
    vault.tokens && vault.tokens.length > 1
      ? vault.tokens.map((token) => token.symbol).join(" · ")
      : getTokenSymbol(vault);
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: colors.background.primary,
        border: `2px solid ${borderColor}`,
        borderRadius: borderRadius.md,
        padding: spacing.xl,
        cursor: isClickable ? "pointer" : "default",
        boxShadow: isSelected ? "0 0 0 2px rgba(154, 230, 180, 0.35)" : "none",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!isClickable) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.3)`;
      }}
      onMouseLeave={(e) => {
        if (!isClickable) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = isSelected
          ? "0 0 0 2px rgba(154, 230, 180, 0.35)"
          : "none";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
        <h3 style={{ margin: 0, color: "white", fontSize: fontSize.lg }}>
          {vault.name}
        </h3>
        <div style={{ display: "flex", gap: spacing.sm }}>
          {isSelected && (
            <span style={{
              fontSize: fontSize.xs,
              padding: "2px 8px",
              borderRadius: borderRadius.sm,
              backgroundColor: colors.success.main,
              color: colors.text.dark,
              fontWeight: "bold",
            }}>
              ✓ Current
            </span>
          )}
          <span style={{
            fontSize: fontSize.xs,
            padding: "2px 8px",
            borderRadius: borderRadius.sm,
            backgroundColor: isPersonal ? "rgba(72,187,120,0.2)" : "rgba(128,90,213,0.2)",
            color: isPersonal ? colors.success.light : colors.accent.purple,
          }}>
            {vault.vaultType}
          </span>
        </div>
      </div>

      {/* Token */}
      <div style={{ fontSize: fontSize.sm, color: colors.text.secondary }}>
        {tokenLabel !== "TOKEN" || !vault.tokenMint
          ? tokenLabel
          : `${vault.tokenMint.slice(0, 8)}...`}
      </div>

      {/* Footer stats (community only — members and penalty are meaningless on a personal vault) */}
      {!isPersonal && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: fontSize.xs,
          color: colors.text.secondary,
          borderTop: `1px solid ${colors.border?.default || "${colors.border.default}"}`,
          paddingTop: spacing.sm,
          marginTop: spacing.sm,
        }}>
          <span>{vault.memberCount} member{vault.memberCount !== 1 ? "s" : ""}</span>
          <span>Penalty: {formatPenalty(vault.penaltyRateBps)}</span>
        </div>
      )}
    </div>
  );
}

export default VaultCard;
