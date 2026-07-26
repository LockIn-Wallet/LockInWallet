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
                ? colors.background.primary
                : mode === "management"
                ? colors.background.darkBlue
                : "transparent",
            border:
              mode === "management"
                ? `1px solid ${colors.border.info}`
                : `1px solid ${colors.border.default}`,
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
              color: mode === "management" ? colors.success.light : "white",
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
              border: `1px solid ${colors.border.default}`,
              borderRadius: "4px",
              backgroundColor:
                mode === "selection" &&
                selectedDestination === addr.destination
                  ? colors.background.primary
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
                    color: colors.text.muted,
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
                <div style={{ fontSize: "0.7em", color: colors.text.gray }}>
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
                  border: `1px solid ${colors.border.error}`,
                  backgroundColor: "transparent",
                  color: colors.error.main,
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
              e.target.style.color = colors.text.secondary;
              e.target.style.borderColor = colors.border.default;
            }}
            onMouseLeave={(e) => {
              e.target.style.opacity = "0.7";
              e.target.style.color = colors.text.muted;
              e.target.style.borderColor = colors.border.default;
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