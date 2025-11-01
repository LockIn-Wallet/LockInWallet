import React from "react";

// Import styles
import {
  cardStyles,
  layoutStyles,
  formStyles,
  buttonStyles,
  colors,
  spacing,
  fontSize,
  fontWeight,
} from "../../styles";

/**
 * DepositInterface component - Complete deposit interface for multi-token deposits
 * Handles deposits from connected wallet and direct deposits from exchanges
 */
const DepositInterface = ({
  // Network and wallet props
  networkType,
  selectedNetwork,
  userAddress,
  solanaPublicKey,
  getCurrentNetwork,

  // Token and deposit state
  selectedToken,
  setSelectedToken,
  depositAmount,
  setDepositAmount,
  isDepositing,

  // Deposit functions
  depositToSavings,

  // Exchange deposit state
  isDeploying,
  depositAddress,
  deployDepositAddress,
}) => {
  return (
    <div
      style={{
        marginBottom: "20px",
        padding: "15px",
        backgroundColor: "#2d3748",
        borderRadius: "8px",
        border: "1px solid #4a5568",
      }}
    >
      <h3 style={{ color: colors.text.primary }}>
        💰 Deposit from{" "}
        {networkType === "solana"
          ? solanaPublicKey
            ? `${solanaPublicKey
                .toString()
                .slice(0, 6)}...${solanaPublicKey.toString().slice(-4)}`
            : "Connected Wallet"
          : userAddress
          ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
          : "Connected Wallet"}
      </h3>

      {/* Direct Deposit from Connected Wallet */}
      <div style={layoutStyles.marginBottomLarge}>
        <h4
          style={{
            color: colors.success.light,
            margin: `0 0 ${spacing.md} 0`,
          }}
        >
          📱 From Connected Wallet
        </h4>
        <p
          style={{
            fontSize: "0.9em",
            color: "#cbd5e0",
            marginBottom: "15px",
          }}
        >
          Recommended: Use stablecoins (USDT, USDC, DAI) for consistent
          value
        </p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "15px",
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
              minWidth: "150px",
            }}
          >
            <option value="">Select Token</option>

            {/* Recommended Stablecoins Section */}
            <optgroup label="🌟 Recommended Stablecoins">
              {Object.entries(
                getCurrentNetwork(networkType, selectedNetwork).tokens
              )
                .filter(
                  ([_, token]) =>
                    token.recommended &&
                    token.address !==
                      "0x0000000000000000000000000000000000000000"
                )
                .map(([key, token]) => (
                  <option key={key} value={key}>
                    {token.symbol} - {token.name}
                  </option>
                ))}
            </optgroup>

            {/* Native Token Section */}
            <optgroup label="⚡ Native Token">
              {Object.entries(
                getCurrentNetwork(networkType, selectedNetwork).tokens
              )
                .filter(([_, token]) => !token.recommended)
                .map(([key, token]) => (
                  <option key={key} value={key}>
                    {token.symbol} - {token.name}
                  </option>
                ))}
            </optgroup>
          </select>

          <input
            type="number"
            placeholder="Amount"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #4a5568",
              backgroundColor: "#4a5568",
              color: "white",
              flex: "1",
              minWidth: "120px",
            }}
          />

          <button
            onClick={depositToSavings}
            disabled={
              !selectedToken ||
              !depositAmount ||
              parseFloat(depositAmount) <= 0 ||
              isDepositing
            }
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "none",
              backgroundColor:
                !selectedToken ||
                !depositAmount ||
                parseFloat(depositAmount) <= 0 ||
                isDepositing
                  ? "#718096"
                  : "#3182ce",
              color: "white",
              cursor: isDepositing ? "not-allowed" : "pointer",
              minWidth: "100px",
              fontWeight: "bold",
              opacity: isDepositing ? 0.7 : 1,
            }}
          >
            {isDepositing ? "⏳ Processing..." : "💰 Deposit Now"}
          </button>
        </div>
      </div>

      {/* Direct Deposit from Exchange/Other Wallet */}
      <div>
        <h4
          style={{
            color: colors.success.light,
            margin: `0 0 ${spacing.md} 0`,
          }}
        >
          🏦 Direct Deposit from Exchange
        </h4>
        <p
          style={{
            fontSize: "0.9em",
            color: "#cbd5e0",
            marginBottom: "15px",
          }}
        >
          Generate a permanent deposit address for direct deposits from
          exchanges or other wallets.
        </p>

        {!depositAddress && !isDeploying && (
          <div
            style={{
              padding: "15px",
              backgroundColor: "#1a202c",
              borderRadius: "4px",
              border: "1px solid #4a5568",
              textAlign: "center",
            }}
          >
            <button
              onClick={deployDepositAddress}
              style={{
                padding: "10px 20px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: "#48bb78",
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              🚀 Generate Deposit Address
            </button>

            <div
              style={{
                marginTop: "15px",
                fontSize: "0.8em",
                color: "#718096",
              }}
            >
              <p style={{ margin: `${spacing.xs} 0` }}>
                ✨ One-time setup • Gas fee required
              </p>
              <p style={{ margin: `${spacing.xs} 0` }}>
                🎯 Direct exchange withdrawals • Permanent address you
                can always use
              </p>
            </div>
          </div>
        )}

        {/* Deploying state */}
        {isDeploying && (
          <div
            style={{
              padding: "15px",
              backgroundColor: "#1a202c",
              borderRadius: "4px",
              border: "1px solid #4a5568",
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: "10px" }}>
              <span style={{ fontSize: "24px" }}>⏳</span>
            </div>
            <p style={{ margin: "0 0 10px 0", color: "#e2e8f0" }}>
              Deploying your personal deposit address...
            </p>
            <p style={{ margin: 0, fontSize: "0.8em", color: "#a0aec0" }}>
              This may take 30-60 seconds
            </p>
          </div>
        )}

        {/* Deployed address display */}
        {depositAddress && (
          <div
            style={{
              padding: "15px",
              backgroundColor: "#1a365d",
              border: "2px solid #48bb78",
              borderRadius: "4px",
              textAlign: "center",
            }}
          >
            <h5
              style={{
                margin: "0 0 10px 0",
                color: "#9ae6b4",
                fontSize: "1.1em",
              }}
            >
              ✅ Your Permanent Deposit Address
            </h5>
            <div
              style={{
                padding: "10px",
                backgroundColor: "#2d3748",
                borderRadius: "4px",
                border: "1px solid #4a5568",
                marginBottom: "15px",
                wordBreak: "break-all",
                fontFamily: "monospace",
                fontSize: "0.9em",
                color: "#e2e8f0",
              }}
            >
              {depositAddress}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(depositAddress)}
              style={{
                padding: "8px 16px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: "#3182ce",
                color: "white",
                cursor: "pointer",
                marginRight: "10px",
              }}
            >
              📋 Copy Address
            </button>
            <div
              style={{
                marginTop: "15px",
                fontSize: "0.8em",
                color: "#a0aec0",
              }}
            >
              <p style={{ margin: `${spacing.xs} 0` }}>
                💡 Save this address in your exchange for future deposits
              </p>
              <p style={{ margin: `${spacing.xs} 0` }}>
                🔄 All deposits to this address automatically go to your
                savings
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepositInterface;