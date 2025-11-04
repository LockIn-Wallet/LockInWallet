import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";

// Import styles
import {
  cardStyles,
  layoutStyles,
  buttonStyles,
  colors,
  spacing,
  fontSize,
} from "../../styles";

// Import utility functions
import { getCurrentNetwork } from "../../utils/walletUtils.js";

// Import services
import {
  fetchUserBalances as fetchUserBalancesService,
} from "../../services";

/**
 * BalanceDisplay component - Shows token balances and educational content
 * Displays user's token balances with refresh functionality and setup mode education
 * Now with encapsulated balance domain logic and service injection pattern
 */
const BalanceDisplay = ({
  // Blockchain services (dependency injection)
  transactionManager,
  savingsContract,
  signer,
  connection,

  // Network and wallet props
  networkType,
  selectedNetwork,
  userAddress,
  solanaPublicKey,
  solanaConnected,

  // Setup state
  isSetupCommitted,
  // Wallet state
  provider,
  solanaWallet,

  // Callbacks for App.js state updates
  onBalanceUpdate,
  connectWallet,
}) => {
  // Internal balance state (moved from App.js)
  const [balances, setBalances] = useState({});

  // Unified balance refresh function (moved from App.js)
  const refreshBalances = async (txManager = transactionManager) => {
    try {
      const fetchedBalances = await fetchUserBalancesService({
        transactionManager: txManager,
        savingsContract,
        signer,
        connection,
        networkType,
        selectedNetwork,
        getCurrentNetwork,
        userAddress,
        solanaPublicKey
      });

      setBalances(fetchedBalances);
      console.log("✅ BalanceDisplay: Balances refreshed:", fetchedBalances);

      // Notify parent component of balance update
      if (onBalanceUpdate) {
        onBalanceUpdate(fetchedBalances);
      }
    } catch (error) {
      console.error("❌ BalanceDisplay: Error refreshing balances:", error);
      setBalances({});

      // Still notify parent even on error (with empty balances)
      if (onBalanceUpdate) {
        onBalanceUpdate({});
      }
    }
  };

  // Load balances when dependencies change
  useEffect(() => {
    const loadBalances = async () => {
      if (networkType === "solana") {
        // For Solana, check if wallet is connected and transaction manager is available
        if (solanaConnected && transactionManager) {
          await refreshBalances();
        }
      } else {
        // For EVM, check if provider and signer are available
        if (provider && signer && savingsContract) {
          await refreshBalances();
        }
      }
    };

    loadBalances();
  }, [transactionManager, savingsContract, signer, provider, solanaConnected, networkType, selectedNetwork]);

  // Set default balances for immediate display
  useEffect(() => {
    if (networkType === "solana" && Object.keys(balances).length === 0) {
      setBalances({ SOL: 0 });
    }
  }, [networkType, balances]);
  return (
    <>
      {/* Multi-token balance display - ALWAYS SHOWN */}
      <div
        style={{
          ...cardStyles.balanceCard,
          border: !isSetupCommitted
            ? `2px solid ${colors.success.main}`
            : `2px solid ${colors.border.default}`, // Active green border during setup
          opacity: 1, // Always fully visible
          position: "relative",
        }}
      >
        {/* Balances section now active during setup mode */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <h3 style={{ color: "white", margin: 0 }}>💰 Your Balances</h3>
          {(provider ||
            (networkType === "solana" && solanaWallet?.connected)) && (
            <button
              onClick={() => refreshBalances()}
              style={{
                ...buttonStyles.primary,
                padding: `${spacing.xs} ${spacing.md}`,
                fontSize: fontSize.xs,
              }}
            >
              🔄 Refresh
            </button>
          )}
        </div>

        {/* Educational Introduction for Setup Mode */}
        {!isSetupCommitted && (
          <div
            style={{
              marginBottom: "20px",
              padding: "16px",
              backgroundColor: "#1a365d",
              border: "2px solid #48bb78",
              borderRadius: "8px",
              color: "white",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "12px",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: fontSize.xl }}>🛡️</span>
              <h4
                style={{
                  margin: 0,
                  color: "#9ae6b4",
                  fontSize: "1.1em",
                  fontWeight: "600",
                }}
              >
                Protect your Bankroll/Savings/Profits even from yourself
              </h4>
            </div>
            <div
              style={{ fontSize: "0.9em", lineHeight: "1.6", color: "#e2e8f0" }}
            >
              <p style={{ margin: `0 0 ${spacing.sm} 0` }}>
                <strong>🏦 No-trading & no-staking wallet:</strong> Designed for
                storing stablecoins for your peace of mind.
              </p>
              <p style={{ margin: `0 0 ${spacing.sm} 0` }}>
                <strong>🔐 Set up withdrawal allowance:</strong> Changes to
                allowance or bypassing withdrawal limits are timelocked to combat spending/risking impulses.
              </p>
              <p style={{ margin: `0 0 ${spacing.sm} 0` }}>
                <strong>🛡️ Compromise-Resistant:</strong> Funds are safe even
                when your private key is compromised (coming soon)
              </p>
              <p style={{ margin: "0" }}>
                <strong>⛓️ Fully On-Chain:</strong> No intermediaries
              </p>
            </div>
          </div>
        )}

        {!provider ? (
          <div style={layoutStyles.emptyState}>
            <p>Connect your wallet to view balances</p>
            <button
              onClick={connectWallet}
              style={{
                padding: "12px 24px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#3182ce",
                color: "white",
                cursor: "pointer",
                fontSize: "1em",
                fontWeight: "bold",
                marginTop: "10px",
              }}
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          // Show balance section immediately when wallet is connected, even if balances are empty
          // This eliminates the "Loading balances..." state
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px",
            }}
          >
            {/* Show stablecoins */}
            {Object.entries(getCurrentNetwork(networkType, selectedNetwork).tokens)
              .filter(([_, token]) => token.recommended) // Only show recommended tokens (excludes SOL)
              .sort(([keyA], [keyB]) => {
                // Sort by balance: non-zero balances first
                const balanceA = parseFloat(balances[keyA] || "0");
                const balanceB = parseFloat(balances[keyB] || "0");
                if (balanceA > 0 && balanceB === 0) return -1;
                if (balanceA === 0 && balanceB > 0) return 1;
                return 0; // Keep original order for same balance status
              })
              .map(([key, token]) => (
                <div
                  key={key}
                  style={{
                    padding: "12px",
                    backgroundColor: token.recommended ? "#2f855a" : "#4a5568",
                    borderRadius: "6px",
                    border: token.recommended ? "2px solid #48bb78" : "none",
                    color: "white",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.8em",
                      color: token.recommended ? "#9ae6b4" : "#a0aec0",
                      marginBottom: "4px",
                    }}
                  >
                    {token.symbol}
                    {token.recommended && (
                      <span style={{ marginLeft: "5px" }}>✓</span>
                    )}
                  </div>
                  <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
                    {balances[key] || "0"}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </>
  );
};

BalanceDisplay.propTypes = {
  // Blockchain services (dependency injection)
  transactionManager: PropTypes.object,
  savingsContract: PropTypes.object,
  signer: PropTypes.object,
  connection: PropTypes.object,

  // Network and wallet props
  networkType: PropTypes.string.isRequired,
  selectedNetwork: PropTypes.string.isRequired,
  userAddress: PropTypes.string,
  solanaPublicKey: PropTypes.object,
  solanaConnected: PropTypes.bool,

  // Setup state
  isSetupCommitted: PropTypes.bool.isRequired,
  // Wallet state
  provider: PropTypes.object,
  solanaWallet: PropTypes.object,

  // Callbacks for App.js state updates
  onBalanceUpdate: PropTypes.func,
  connectWallet: PropTypes.func.isRequired,
};

export default BalanceDisplay;