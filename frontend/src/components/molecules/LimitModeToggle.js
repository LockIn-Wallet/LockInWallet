import React from "react";
import { colors, spacing, fontSize } from "../../styles";

const LIMIT_MODES = [
  {
    key: "fixed",
    label: "Fixed amount",
    hint: "A set amount per period — predictable, best for stablecoins.",
  },
  {
    key: "percent",
    label: "% of balance",
    hint: "Scales with your balance — best for volatile assets whose price moves a lot.",
  },
];

/**
 * Pill-style switch between fixed-amount and percent-of-balance withdrawal
 * limits. Shared by the initial wallet setup and vault creation so both flows
 * use the same control.
 */
function LimitModeToggle({ mode, onChange, disabled = false }) {
  const active = LIMIT_MODES.find((m) => m.key === mode) || LIMIT_MODES[0];

  return (
    <div style={{ marginBottom: spacing.lg }}>
      <div
        style={{
          display: "inline-flex",
          padding: "4px",
          gap: "4px",
          borderRadius: "999px",
          backgroundColor: "rgba(255,255,255,0.06)",
          border: "1px solid #4a5568",
        }}
      >
        {LIMIT_MODES.map((m) => {
          const isActive = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(m.key)}
              style={{
                padding: "8px 18px",
                borderRadius: "999px",
                border: "none",
                cursor: disabled ? "default" : "pointer",
                fontSize: fontSize.sm,
                fontWeight: isActive ? "bold" : "normal",
                backgroundColor: isActive ? colors.success.main : "transparent",
                color: isActive ? "#1a202c" : colors.text.secondary,
                transition: "all 0.2s ease",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <p
        style={{
          fontSize: fontSize.xs,
          color: colors.text.secondary,
          marginTop: spacing.sm,
          marginBottom: 0,
        }}
      >
        {active.hint}
      </p>
    </div>
  );
}

export default LimitModeToggle;
