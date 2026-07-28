import React, { useState } from "react";


import { colors } from "../../styles";
import {
  SPENDING_PERIODS,
  PRIMARY_PERIOD_NAMES,
  UNLOCK_DELAY_OPTIONS,
  getDefaultUnlockDelay,
} from "../../utils/spendingPeriods";

/**
 * The spending-limit input cards from the initial wallet setup, extracted so
 * vault creation renders the identical UI. Purely presentational: `values` maps
 * period name to the current input string, `onChange(period, value)` reports
 * edits, `unit` labels the amounts ("%" or a token symbol).
 *
 * `periodNames` picks which windows to offer, so a network that only supports
 * daily/weekly/monthly passes those three. When `onDelayChange` is supplied,
 * each card also lets the user set that period's wait time — how long a bypass
 * or a change to that limit takes to go through.
 */
function LimitPeriodCards({
  values,
  onChange,
  unit,
  periodNames = PRIMARY_PERIOD_NAMES,
  delays,
  onDelayChange,
}) {
  const [cardStates, setCardStates] = useState({});
  const periods = SPENDING_PERIODS.filter((period) => periodNames.includes(period.name));

  const updateCardState = (periodName, updates) => {
    setCardStates((prev) => ({
      ...prev,
      [periodName]: { ...prev[periodName], ...updates },
    }));
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "15px",
        marginBottom: "15px",
      }}
    >
      {periods.map(({ name, icon }) => {
        const value = values[name] || "";
        const isBeingConfigured = value.trim() !== "";
        const { isHovered = false, isFocused = false } = cardStates[name] || {};
        const isHighlighted = isHovered || isFocused;

        return (
          <div
            key={name}
            style={{
              padding: "15px",
              borderRadius: "8px",
              backgroundColor: isHighlighted
                ? isBeingConfigured
                  ? colors.background.darkBlue
                  : colors.background.secondary
                : isBeingConfigured
                ? colors.background.darkBlue
                : colors.background.secondary,
              border: isHighlighted
                ? `2px solid ${colors.success.border}`
                : isBeingConfigured
                ? `2px solid ${colors.success.border}`
                : `2px dashed ${colors.border.default}`,
              opacity: isBeingConfigured ? 0.9 : 0.7,
              transition: "all 0.3s ease",
              boxShadow: isHighlighted
                ? "0 0 0 2px rgba(154, 230, 180, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15)"
                : isBeingConfigured
                ? "0 0 0 1px rgba(154, 230, 180, 0.3)"
                : "none",
              transform: isHighlighted ? "translateY(-1px)" : "none",
              cursor: "pointer",
            }}
            onMouseEnter={() => updateCardState(name, { isHovered: true })}
            onMouseLeave={() => updateCardState(name, { isHovered: false })}
          >
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
                  color: isBeingConfigured ? colors.text.secondary : colors.text.muted,
                  margin: 0,
                  fontSize: "1.1em",
                  fontWeight: "bold",
                }}
              >
                {icon} {name}
              </h5>
              <span
                style={{
                  fontSize: "0.8em",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(255,255,255,0.08)",
                  color: colors.text.muted,
                }}
              >
                {unit}
              </span>
            </div>
            <input
              type="text"
              placeholder={`Amount in ${unit} to activate`}
              value={value}
              onChange={(e) => onChange(name, e.target.value)}
              onFocus={() => updateCardState(name, { isFocused: true })}
              onBlur={() => updateCardState(name, { isFocused: false })}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "4px",
                border: `1px solid ${colors.border.default}`,
                backgroundColor: colors.background.secondary,
                color: "white",
                fontSize: "1em",
                boxSizing: "border-box",
              }}
            />
            {onDelayChange && (
              <label
                style={{
                  display: "block",
                  marginTop: "10px",
                  fontSize: "0.8em",
                  color: colors.text.muted,
                }}
              >
                Wait to bypass or change this limit
                <select
                  value={delays?.[name] ?? getDefaultUnlockDelay(name)}
                  onChange={(e) => onDelayChange(name, Number(e.target.value))}
                  disabled={!isBeingConfigured}
                  style={{
                    width: "100%",
                    marginTop: "4px",
                    padding: "8px",
                    borderRadius: "4px",
                    border: `1px solid ${colors.border.default}`,
                    backgroundColor: colors.background.secondary,
                    color: isBeingConfigured ? "white" : colors.text.muted,
                    fontSize: "0.95em",
                    boxSizing: "border-box",
                    cursor: isBeingConfigured ? "pointer" : "not-allowed",
                  }}
                >
                  {UNLOCK_DELAY_OPTIONS.map((option) => (
                    <option key={option.seconds} value={option.seconds}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default LimitPeriodCards;
