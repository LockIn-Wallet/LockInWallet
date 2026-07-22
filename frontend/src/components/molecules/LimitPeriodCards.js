import React, { useState } from "react";

const PERIODS = [
  { name: "Daily", icon: "📅" },
  { name: "Weekly", icon: "📊" },
  { name: "Monthly", icon: "📈" },
];

/**
 * The Daily/Weekly/Monthly limit input cards from the initial wallet setup,
 * extracted so vault creation renders the identical UI. Purely presentational:
 * `values` maps period name to the current input string, `onChange(period,
 * value)` reports edits, `unit` labels the amounts ("%" or a token symbol).
 */
function LimitPeriodCards({ values, onChange, unit }) {
  const [cardStates, setCardStates] = useState({});

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
      {PERIODS.map(({ name, icon }) => {
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
                  ? "#3a5a6a"
                  : "#5a6578"
                : isBeingConfigured
                ? "#2a4a5a"
                : "#4a5568",
              border: isHighlighted
                ? "2px solid #9ae6b4"
                : isBeingConfigured
                ? "2px solid #9ae6b4"
                : "2px dashed #718096",
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
                  color: isBeingConfigured ? "#e2e8f0" : "#a0aec0",
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
                  color: "#a0aec0",
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
                border: "1px solid #4a5568",
                backgroundColor: "#4a5568",
                color: "white",
                fontSize: "1em",
                boxSizing: "border-box",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default LimitPeriodCards;
