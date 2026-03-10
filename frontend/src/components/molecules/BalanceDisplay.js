import React, { useState, useEffect, useCallback } from "react";
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

import { ethers } from "ethers";

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

  // Balance state from parent (App.js)
  balances,

  // Callbacks for App.js state updates
  onBalanceUpdate,
  connectWallet,
}) => {
  // PoolTogether state
  const [vaultStates, setVaultStates] = useState({});
  const [grandPrizeWeth, setGrandPrizeWeth] = useState("0");
  const [ethPrice, setEthPrice] = useState(0);
  const [vaultAvailable, setVaultAvailable] = useState({});

  const loadPoolTogetherData = useCallback(async () => {
    if (networkType !== "evm" || !transactionManager) return;
    try {
      const network = getCurrentNetwork(networkType, selectedNetwork);
      const tokens = Object.entries(network.tokens).filter(([, t]) => t.recommended);
      const newVaultStates = {};
      const newVaultAvailable = {};

      await Promise.all(tokens.map(async ([key, token]) => {
        try {
          const hasVault = await transactionManager.hasPoolTogetherVault(token.address);
          newVaultAvailable[key] = hasVault;
          if (hasVault) {
            const result = await transactionManager.getPoolTogetherBalance(token.address);
            const inVault = result.shares > BigInt(0);
            newVaultStates[key] = {
              inVault,
              shares: result.shares,
              assets: ethers.formatUnits(result.assets, token.decimals),
              loading: false,
            };
          }
        } catch (e) {
          newVaultAvailable[key] = false;
        }
      }));

      setVaultStates(newVaultStates);
      setVaultAvailable(newVaultAvailable);

      try {
        const prize = await transactionManager.getPoolTogetherGrandPrize();
        setGrandPrizeWeth(ethers.formatUnits(prize, 18));
      } catch (e) {
        setGrandPrizeWeth("0");
      }

      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
        const data = await res.json();
        setEthPrice(data.ethereum.usd);
      } catch (e) {
        setEthPrice(0);
      }
    } catch (err) {
      console.error("PoolTogether data load error:", err);
    }
  }, [transactionManager, networkType, selectedNetwork]);

  useEffect(() => {
    loadPoolTogetherData();
  }, [loadPoolTogetherData]);

  const handlePoolTogetherToggle = async (key, token) => {
    if (!transactionManager) return;
    const state = vaultStates[key];
    const isInVault = state && state.inVault;

    setVaultStates(function (prev) {
      return { ...prev, [key]: { ...prev[key], loading: true } };
    });

    try {
      if (isInVault) {
        await transactionManager.withdrawFromPoolTogether(token.address, state.shares);
      } else {
        const balance = balances[key];
        if (!balance || parseFloat(balance) === 0) {
          alert("No balance to deposit");
          return;
        }
        const amount = ethers.parseUnits(balance, token.decimals);
        await transactionManager.depositToPoolTogether(token.address, amount);
      }
      await refreshBalances();
      await loadPoolTogetherData();
    } catch (err) {
      console.error("PoolTogether toggle error:", err);
      alert("PoolTogether " + (isInVault ? "withdrawal" : "deposit") + " failed: " + err.message);
    } finally {
      setVaultStates(function (prev) {
        return { ...prev, [key]: { ...prev[key], loading: false } };
      });
    }
  };

  // Unified balance refresh function - updates parent state via onBalanceUpdate
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

      console.log("✅ BalanceDisplay: Balances refreshed:", fetchedBalances);

      // Update parent component state
      if (onBalanceUpdate) {
        onBalanceUpdate(fetchedBalances);
      }
    } catch (error) {
      console.error("❌ BalanceDisplay: Error refreshing balances:", error);

      // Notify parent even on error (with empty balances)
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

  // No default balance setting needed - balances come from parent props
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
                <strong>🏦 No-trading wallet:</strong> Designed for
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
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "4px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.8em",
                        color: token.recommended ? "#9ae6b4" : "#a0aec0",
                      }}
                    >
                      {token.symbol}
                      {token.recommended && (
                        <span style={{ marginLeft: "5px" }}>✓</span>
                      )}
                    </div>
                    {vaultAvailable[key] && networkType === "evm" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.65em",
                          cursor: (vaultStates[key] && vaultStates[key].loading) ? "wait" : "pointer",
                          opacity: (vaultStates[key] && vaultStates[key].loading) ? 0.6 : 1,
                        }}
                        title={(vaultStates[key] && vaultStates[key].inVault) ? "Withdraw from PoolTogether" : "Deposit to PoolTogether"}
                      >
                        <span>🎰</span>
                        <div
                          onClick={function () { if (!(vaultStates[key] && vaultStates[key].loading)) handlePoolTogetherToggle(key, token); }}
                          style={{
                            width: "32px",
                            height: "16px",
                            borderRadius: "8px",
                            backgroundColor: (vaultStates[key] && vaultStates[key].inVault) ? "#805ad5" : "#4a5568",
                            position: "relative",
                            transition: "background-color 0.2s",
                          }}
                        >
                          <div
                            style={{
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              backgroundColor: "white",
                              position: "absolute",
                              top: "2px",
                              left: (vaultStates[key] && vaultStates[key].inVault) ? "18px" : "2px",
                              transition: "left 0.2s",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
                    {balances[key] || "0"}
                  </div>
                  {vaultStates[key] && vaultStates[key].inVault && (
                    <div style={{ fontSize: "0.7em", marginTop: "4px", color: "#d6bcfa" }}>
                      {"🎰 In vault: "}{parseFloat(vaultStates[key].assets || "0").toFixed(2)}{" "}{token.symbol}
                    </div>
                  )}
                  {vaultAvailable[key] && !(vaultStates[key] && vaultStates[key].inVault) && parseFloat(balances[key] || "0") > 0 && (
                    <div style={{ fontSize: "0.65em", marginTop: "4px", color: "#a0aec0" }}>
                      {"🎰 Toggle to earn prizes"}
                    </div>
                  )}
                  {vaultAvailable[key] && parseFloat(grandPrizeWeth) > 0 && ethPrice > 0 && (
                    <div style={{ fontSize: "0.65em", marginTop: "2px", color: "#fbd38d" }}>
                      {"🏆 Grand prize: ~"}{(parseFloat(grandPrizeWeth) * ethPrice).toFixed(0)}{" "}{token.symbol}{" / 3 months"}
                    </div>
                  )}
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

  // Balance state from parent
  balances: PropTypes.object.isRequired,

  // Callbacks for App.js state updates
  onBalanceUpdate: PropTypes.func,
  connectWallet: PropTypes.func.isRequired,
};

export default BalanceDisplay;