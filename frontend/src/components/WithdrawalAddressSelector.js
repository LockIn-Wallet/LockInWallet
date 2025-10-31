import React from "react";

// Import styles
import {
  layoutStyles,
  formStyles,
  spacingUtilities,
  buttonStyles,
  colors,
  fontWeight,
  fontSize,
  spacing,
} from "../styles";

/**
 * Reusable WithdrawalAddressSelector component
 * Displays withdrawal addresses with support for selection and management modes
 */
const WithdrawalAddressSelector = ({
  mode = "selection", // "selection" or "management"
  selectedDestination,
  onDestinationChange,
  showAddButton = true,
  title = "Withdraw To:",
  // Data dependencies
  withdrawalAddresses,
  getCurrentUserAddress,
  // Management mode dependencies
  removeWithdrawalAddress,
  showWithdrawalAddressForm,
  setShowWithdrawalAddressForm,
}) => {
  return (
    <div style={layoutStyles.marginBottom}>
      <label
        style={{
          ...formStyles.label,
          display: "block",
          marginBottom: spacing.sm,
        }}
      >
        {title}
      </label>

      {/* My Wallet Option */}
      <div style={spacingUtilities.mb2}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            cursor: mode === "selection" ? "pointer" : "default",
            padding: "8px",
            borderRadius: "4px",
            backgroundColor:
              mode === "selection" && selectedDestination === "self"
                ? "#2d3748"
                : mode === "management"
                ? "#1a365d"
                : "transparent",
            border:
              mode === "management"
                ? "1px solid #2b77ad"
                : "1px solid #4a5568",
          }}
          onClick={() =>
            mode === "selection" &&
            onDestinationChange &&
            onDestinationChange("self")
          }
        >
          {mode === "selection" && (
            <input
              type="radio"
              name="withdrawalDestination"
              value="self"
              checked={selectedDestination === "self"}
              onChange={(e) =>
                onDestinationChange && onDestinationChange(e.target.value)
              }
              style={layoutStyles.marginRight}
            />
          )}
          <span
            style={{
              color: mode === "management" ? "#9ae6b4" : "white",
              fontSize: "0.9em",
            }}
          >
            🏠 My Wallet (
            {getCurrentUserAddress()
              ? `${getCurrentUserAddress().slice(
                  0,
                  6
                )}...${getCurrentUserAddress().slice(-4)}`
              : ""}
            )
          </span>
        </div>
      </div>

      {/* Withdrawal Addresses */}
      {withdrawalAddresses.map((addr, index) => (
        <div key={index} style={spacingUtilities.mb2}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              border: "1px solid #4a5568",
              borderRadius: "4px",
              backgroundColor:
                mode === "selection" &&
                selectedDestination === addr.destination
                  ? "#2d3748"
                  : "transparent",
              cursor: mode === "selection" ? "pointer" : "default",
            }}
            onClick={() =>
              mode === "selection" &&
              onDestinationChange &&
              onDestinationChange(addr.destination)
            }
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                padding: "8px",
                flex: 1,
              }}
            >
              {mode === "selection" && (
                <input
                  type="radio"
                  name="withdrawalDestination"
                  value={addr.destination}
                  checked={selectedDestination === addr.destination}
                  onChange={(e) =>
                    onDestinationChange && onDestinationChange(e.target.value)
                  }
                  style={layoutStyles.marginRight}
                />
              )}
              <div>
                <div
                  style={{
                    color: colors.text.primary,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  📍 {addr.title}
                </div>
                <div
                  style={{
                    fontSize: "0.8em",
                    color: "#a0aec0",
                    fontFamily: "monospace",
                  }}
                >
                  {addr.destination.length > 50
                    ? `${addr.destination.slice(
                        0,
                        25
                      )}...${addr.destination.slice(-15)}`
                    : addr.destination}
                </div>
                <div style={{ fontSize: "0.7em", color: "#718096" }}>
                  Added: {addr.addedDate}
                </div>
              </div>
            </div>
            {mode === "management" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeWithdrawalAddress(addr.destination);
                }}
                style={{
                  marginRight: "8px",
                  marginTop: "8px",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid #e53e3e",
                  backgroundColor: "transparent",
                  color: "#e53e3e",
                  cursor: "pointer",
                  fontSize: "0.7em",
                }}
              >
                🗑️ Remove
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add Address Button */}
      {showAddButton && (
        <div style={layoutStyles.marginTopSmall}>
          <button
            onClick={() =>
              setShowWithdrawalAddressForm(!showWithdrawalAddressForm)
            }
            style={{
              ...buttonStyles.secondary,
              fontSize: fontSize.xs,
              opacity: 0.7,
            }}
            onMouseEnter={(e) => {
              e.target.style.opacity = "1";
              e.target.style.color = "#e2e8f0";
              e.target.style.borderColor = "#718096";
            }}
            onMouseLeave={(e) => {
              e.target.style.opacity = "0.7";
              e.target.style.color = "#a0aec0";
              e.target.style.borderColor = "#4a5568";
            }}
          >
            ➕ Add Withdrawal Address
          </button>
        </div>
      )}
    </div>
  );
};

export default WithdrawalAddressSelector;