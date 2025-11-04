import React from "react";
import PropTypes from "prop-types";

// Import components
import WithdrawalAddressSelector from "../WithdrawalAddressSelector.js";

// Import styles
import {
  layoutStyles,
  utilityStyles,
  colors,
  spacingUtilities,
} from "../../styles";

// Import utilities
import { formatCountdown } from "../../utils/walletUtils.js";

/**
 * WithdrawalInterface Component
 *
 * Handles all withdrawal-related functionality including:
 * - Token and amount selection
 * - Instant withdrawal calculation display
 * - Destination selection and management
 * - Withdrawal execution (instant vs bypass)
 * - Pending withdrawal and bypass requests management
 */
const WithdrawalInterface = ({
  // Network & config
  networkType,
  selectedNetwork,
  getCurrentUserAddress,
  getCurrentNetwork,

  // Withdrawal state
  selectedToken,
  setSelectedToken,
  withdrawalAmount,
  setWithdrawalAmount,
  selectedWithdrawalDestination,
  setSelectedWithdrawalDestination,

  // Calculated values
  instantWithdrawableAmount,
  limitingPeriod,
  exceedsInstantLimit,
  exceedingPeriod,

  // Data arrays
  withdrawalAddresses,
  pendingWithdrawalRequests,
  pendingBypassRequests,

  // Form state for address management
  showWithdrawalAddressForm,
  setShowWithdrawalAddressForm,

  // Action handlers
  withdrawToDestination,
  requestBypassForWithdrawal,
  removeWithdrawalAddress,
  executeWithdrawalRequest,
  cancelWithdrawalRequest,
  executeBypassRequest,
  cancelBypassRequest,

  // Utilities
  currentTime,
}) => {
  return (
    <div
      style={{
        marginBottom: "20px",
        padding: "15px",
        border: "1px solid #333",
        borderRadius: "5px",
        backgroundColor: "#2d3748",
        color: "white",
        position: "relative",
      }}
    >
      <h3 style={{ color: colors.text.primary }}>💸 Withdraw Funds</h3>
      <p
        style={{
          fontSize: "0.9em",
          color: "#cbd5e0",
          marginBottom: "15px",
        }}
      >
        Withdrawals are automatically checked against all your active
        spending limits. You can withdraw to your own wallet or to
        approved withdrawal addresses.
      </p>

      {/* Token and Amount Selection */}
      <div style={layoutStyles.marginBottom}>
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "10px",
            flexWrap: "wrap",
          }}
        >
          <select
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #4a5568",
              backgroundColor: "#4a5568",
              color: "white",
              flex: "1",
              minWidth: "120px",
            }}
          >
            <option value="ETH">ETH</option>
            {Object.entries(
              getCurrentNetwork(networkType, selectedNetwork).tokens
            )
              .filter(
                ([_, token]) =>
                  token.address !==
                  "0x0000000000000000000000000000000000000000"
              )
              .map(([key, token]) => (
                <option key={key} value={key}>
                  {token.symbol}
                </option>
              ))}
          </select>

          <input
            type="text"
            placeholder={`Amount (${selectedToken})`}
            value={withdrawalAmount}
            onChange={(e) => setWithdrawalAmount(e.target.value)}
            style={{
              flex: "2",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #4a5568",
              backgroundColor: "#4a5568",
              color: "white",
              minWidth: "150px",
            }}
          />
        </div>
      </div>

      {/* Instant Withdrawal Information */}
      <div
        style={{
          marginBottom: "15px",
          padding: "10px",
          backgroundColor: "#1a202c",
          borderRadius: "4px",
          border: "1px solid #4a5568",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "5px",
          }}
        >
          <span style={{ fontSize: "0.9em", color: "#cbd5e0" }}>
            💡 Instant Withdrawable:
          </span>
          <span style={{ fontWeight: "bold", color: "#48bb78" }}>
            {(typeof instantWithdrawableAmount === "number"
              ? instantWithdrawableAmount
              : 0
            ).toFixed(2)}{" "}
            {selectedToken}
          </span>
        </div>
        {limitingPeriod && (
          <div style={{ fontSize: "0.8em", color: "#a0aec0" }}>
            Limited by: {limitingPeriod} spending limit
          </div>
        )}
        {withdrawalAmount && exceedsInstantLimit && exceedingPeriod && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              backgroundColor: "#2d3748",
              borderRadius: "4px",
              border: "1px solid #ed8936",
            }}
          >
            <div
              style={{
                fontSize: "0.85em",
                color: "#ed8936",
                fontWeight: "bold",
              }}
            >
              ⚠️ Amount exceeds {exceedingPeriod} limit
            </div>
            <div
              style={{
                fontSize: "0.8em",
                color: "#a0aec0",
                marginTop: "2px",
              }}
            >
              This withdrawal will require a 24-hour approval period
            </div>
          </div>
        )}
      </div>

      {/* Destination Selection as Radio Buttons */}
      <WithdrawalAddressSelector
        mode="selection"
        selectedDestination={selectedWithdrawalDestination}
        onDestinationChange={setSelectedWithdrawalDestination}
        showAddButton={true}
        title="Withdraw To:"
        withdrawalAddresses={withdrawalAddresses}
        getCurrentUserAddress={getCurrentUserAddress}
        removeWithdrawalAddress={removeWithdrawalAddress}
        showWithdrawalAddressForm={showWithdrawalAddressForm}
        setShowWithdrawalAddressForm={setShowWithdrawalAddressForm}
      />

      {/* Dynamic Withdrawal Buttons */}
      <div
        style={{ ...layoutStyles.flexGap, ...layoutStyles.fullWidth }}
      >
        {!exceedsInstantLimit ? (
          <button
            onClick={withdrawToDestination}
            disabled={
              !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
            }
            style={{
              padding: "12px 24px",
              borderRadius: "4px",
              border: "none",
              backgroundColor:
                !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                  ? "#4a5568"
                  : "#48bb78",
              color: "white",
              cursor:
                !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                  ? "not-allowed"
                  : "pointer",
              fontWeight: "bold",
              flex: "1",
              fontSize: "1em",
              opacity:
                !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                  ? 0.5
                  : 1,
            }}
          >
            ⚡ Instant Withdraw {selectedToken}
          </button>
        ) : (
          <>
            <button
              disabled={true}
              style={{
                padding: "12px 24px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: "#4a5568",
                color: "#a0aec0",
                cursor: "not-allowed",
                fontWeight: "bold",
                flex: "1",
                fontSize: "1em",
                opacity: 0.5,
              }}
            >
              ⚡ Instant Withdraw
            </button>
            <button
              onClick={() => requestBypassForWithdrawal()}
              disabled={
                !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
              }
              style={{
                padding: "12px 24px",
                borderRadius: "4px",
                border: "none",
                backgroundColor:
                  !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                    ? "#4a5568"
                    : "#ed8936",
                color: "white",
                cursor:
                  !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                    ? "not-allowed"
                    : "pointer",
                fontWeight: "bold",
                flex: "1",
                fontSize: "0.9em",
                opacity:
                  !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                    ? 0.5
                    : 1,
              }}
            >
              🕐 Request Above {exceedingPeriod} Limit
            </button>
          </>
        )}
      </div>

      {/* Pending Withdrawal Address Requests */}
      {pendingWithdrawalRequests.length > 0 && (
        <div
          style={{
            marginTop: "15px",
            paddingTop: "15px",
            borderTop: "1px solid #4a5568",
          }}
        >
          <div>
            <h5
              style={{
                color: colors.warning.light,
                margin: `0 0 ${spacingUtilities.mb3} 0`,
              }}
            >
              ⏳ Pending Requests ({pendingWithdrawalRequests.length})
            </h5>
            <div style={{ ...utilityStyles.grid, gap: spacingUtilities.mb2 }}>
              {pendingWithdrawalRequests.map((request, index) => {
                const countdown = formatCountdown(
                  request.executeAfter,
                  currentTime
                );
                return (
                  <div
                    key={index}
                    style={{
                      padding: "10px",
                      backgroundColor: "#1a202c",
                      borderRadius: "6px",
                      border: countdown.ready
                        ? "1px solid #48bb78"
                        : "1px solid #ed8936",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "white",
                            fontWeight: "bold",
                          }}
                        >
                          📍 {request.title}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8em",
                            color: "#a0aec0",
                            fontFamily: "monospace",
                          }}
                        >
                          {request.destination}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {countdown.ready && (
                          <button
                            onClick={() =>
                              executeWithdrawalRequest(
                                request.requestId
                              )
                            }
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              border: "none",
                              backgroundColor: "#48bb78",
                              color: "white",
                              cursor: "pointer",
                              fontSize: "0.7em",
                              fontWeight: "bold",
                            }}
                          >
                            ⚡ Execute
                          </button>
                        )}
                        <button
                          onClick={() =>
                            cancelWithdrawalRequest(request.requestId)
                          }
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid #e53e3e",
                            backgroundColor: "transparent",
                            color: "#e53e3e",
                            cursor: "pointer",
                            fontSize: "0.7em",
                          }}
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "6px 10px",
                        backgroundColor: "#4a5568",
                        borderRadius: "4px",
                        textAlign: "center",
                        color: countdown.color,
                        fontWeight: "bold",
                        fontSize: "0.8em",
                      }}
                    >
                      {countdown.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pending Bypass Requests */}
      {pendingBypassRequests.length > 0 && (
        <div
          style={{
            marginTop: "15px",
            paddingTop: "15px",
            borderTop: "1px solid #4a5568",
          }}
        >
          <div>
            <h5
              style={{
                color: colors.warning.light,
                margin: `0 0 ${spacingUtilities.mb3} 0`,
              }}
            >
              🔒 Pending Bypass Requests ({pendingBypassRequests.length}
              )
            </h5>
            <div style={{ ...utilityStyles.grid, gap: spacingUtilities.mb2 }}>
              {pendingBypassRequests.map((request, index) => {
                const countdown = formatCountdown(
                  request.executeAfter,
                  currentTime
                );
                return (
                  <div
                    key={index}
                    style={{
                      padding: "10px",
                      backgroundColor: "#1a202c",
                      borderRadius: "6px",
                      border: countdown.ready
                        ? "1px solid #48bb78"
                        : "1px solid #ed8936",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "white",
                            fontWeight: "bold",
                          }}
                        >
                          🔒 {request.amount} {request.token}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8em",
                            color: "#a0aec0",
                          }}
                        >
                          Period: {request.period} • To:{" "}
                          {request.destination?.slice(0, 8)}...
                          {request.destination?.slice(-4)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {countdown.ready && (
                          <button
                            onClick={() =>
                              executeBypassRequest(request.requestId)
                            }
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              border: "none",
                              backgroundColor: "#48bb78",
                              color: "white",
                              cursor: "pointer",
                              fontSize: "0.7em",
                              fontWeight: "bold",
                            }}
                          >
                            ⚡ Execute
                          </button>
                        )}
                        <button
                          onClick={() =>
                            cancelBypassRequest(request.requestId)
                          }
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid #e53e3e",
                            backgroundColor: "transparent",
                            color: "#e53e3e",
                            cursor: "pointer",
                            fontSize: "0.7em",
                          }}
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "6px 10px",
                        backgroundColor: "#4a5568",
                        borderRadius: "4px",
                        textAlign: "center",
                        color: countdown.color,
                        fontWeight: "bold",
                        fontSize: "0.8em",
                      }}
                    >
                      {countdown.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

WithdrawalInterface.propTypes = {
  // Network & config
  networkType: PropTypes.string.isRequired,
  selectedNetwork: PropTypes.string.isRequired,
  getCurrentUserAddress: PropTypes.func.isRequired,
  getCurrentNetwork: PropTypes.func.isRequired,

  // Withdrawal state
  selectedToken: PropTypes.string.isRequired,
  setSelectedToken: PropTypes.func.isRequired,
  withdrawalAmount: PropTypes.string.isRequired,
  setWithdrawalAmount: PropTypes.func.isRequired,
  selectedWithdrawalDestination: PropTypes.string.isRequired,
  setSelectedWithdrawalDestination: PropTypes.func.isRequired,

  // Calculated values
  instantWithdrawableAmount: PropTypes.number.isRequired,
  limitingPeriod: PropTypes.string,
  exceedsInstantLimit: PropTypes.bool.isRequired,
  exceedingPeriod: PropTypes.string,

  // Data arrays
  withdrawalAddresses: PropTypes.array.isRequired,
  pendingWithdrawalRequests: PropTypes.array.isRequired,
  pendingBypassRequests: PropTypes.array.isRequired,

  // Form state for address management
  showWithdrawalAddressForm: PropTypes.bool.isRequired,
  setShowWithdrawalAddressForm: PropTypes.func.isRequired,

  // Action handlers
  withdrawToDestination: PropTypes.func.isRequired,
  requestBypassForWithdrawal: PropTypes.func.isRequired,
  removeWithdrawalAddress: PropTypes.func.isRequired,
  executeWithdrawalRequest: PropTypes.func.isRequired,
  cancelWithdrawalRequest: PropTypes.func.isRequired,
  executeBypassRequest: PropTypes.func.isRequired,
  cancelBypassRequest: PropTypes.func.isRequired,

  // Utilities
  currentTime: PropTypes.number.isRequired,
};

export default WithdrawalInterface;