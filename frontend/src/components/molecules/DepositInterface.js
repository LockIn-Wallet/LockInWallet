import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { ethers } from "ethers";

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

// Import utility functions
import { getCurrentNetwork } from "../../utils/walletUtils.js";
import { useVaultTokens, filterToVaultTokens } from "../../hooks/useVaultTokens.js";
import { trackEvent } from "../../utils/posthog.js";

// Network configuration constants
const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * DepositInterface component - Complete deposit interface for multi-token deposits
 * Handles deposits from connected wallet and direct deposits from exchanges
 *
 * Features:
 * - Direct wallet deposits with multi-token support
 * - Proxy address deployment for exchange deposits
 * - Internal state management for loading states
 * - Service injection pattern for blockchain operations
 */
const DepositInterface = ({
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

  // Token state from parent (shared with withdrawal)
  selectedToken,
  setSelectedToken,
  activeVaultAddress = null,

  // Callbacks for App.js state updates
  onBalanceUpdate,
}) => {
  // The coins this vault takes. Null while unknown, which leaves the full list
  // on offer rather than an empty picker.
  const vaultTokens = useVaultTokens(transactionManager, activeVaultAddress);

  // Internal state for deposit operations
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [depositAddress, setDepositAddress] = useState("");
  const [isProxyDeployed, setIsProxyDeployed] = useState(false);

  // Proxy status checking — the transaction manager resolves the deposit
  // address for the currently selected vault
  const checkProxyStatus = async () => {
    if (!transactionManager) {
      console.log("❌ No transaction manager available for proxy check");
      return;
    }

    try {
      const userAddress = await transactionManager.getAddress();
      console.log(`🔍 Checking deposit address status for user: ${userAddress}`);

      const proxyDeployed = await transactionManager.isProxyDeployed(userAddress);
      const depositAddress = await transactionManager.getDepositAddress(userAddress);

      console.log(`✅ Deposit address status: deployed=${proxyDeployed}, address=${depositAddress}`);

      setIsProxyDeployed(proxyDeployed);
      setDepositAddress(proxyDeployed ? depositAddress : "");
    } catch (error) {
      console.error("❌ Error checking deposit address status:", error);
      setIsProxyDeployed(false);
      setDepositAddress("");
    }
  };

  // Load proxy status when dependencies change
  useEffect(() => {
    checkProxyStatus();
  }, [transactionManager, savingsContract, signer, networkType, solanaConnected]);

  // Deposit function (moved from App.js)
  const deposit = async (selectedTokenParam = selectedToken, amount) => {
    // Validate basic requirements
    if (!selectedTokenParam || !amount) {
      alert("Please select a token and enter an amount");
      return;
    }

    // Set loading state
    setIsDepositing(true);

    try {
      // Get current network configuration
      const currentNetwork = getCurrentNetwork(networkType, selectedNetwork);

      // Check if we have a transaction manager
      if (!transactionManager) {
        alert(
          "Transaction manager not initialized. Please refresh the page and try again."
        );
        return;
      }

      // Check network connection
      if (!(await transactionManager.isCorrectNetwork())) {
        alert(`Please switch to ${currentNetwork.name} to make deposits`);
        return;
      }

      // Check wallet connection
      if (!(await transactionManager.isConnected())) {
        alert("Please connect your wallet first");
        return;
      }

      // Determine token details based on blockchain type and selection
      let tokenAddress;
      let decimals;
      let tokenSymbol;

      if (networkType === "evm") {
        // EVM token logic
        if (selectedTokenParam === "ETH") {
          tokenAddress = ETH_ADDRESS;
          decimals = 18;
          tokenSymbol = "ETH";
        } else if (currentNetwork.tokens[selectedTokenParam]) {
          const token = currentNetwork.tokens[selectedTokenParam];
          if (token.address === "0x0000000000000000000000000000000000000000") {
            alert(`${token.symbol} is not available on ${currentNetwork.name}`);
            return;
          }
          tokenAddress = token.address;
          decimals = token.decimals;
          tokenSymbol = token.symbol;
        } else {
          alert("Please select a valid token");
          return;
        }
      } else if (networkType === "solana") {
        // Solana token logic
        if (selectedTokenParam === "SOL") {
          tokenAddress = "native"; // Solana native token
          decimals = 9;
          tokenSymbol = "SOL";
        } else if (
          currentNetwork.tokens &&
          currentNetwork.tokens[selectedTokenParam]
        ) {
          const token = currentNetwork.tokens[selectedTokenParam];
          tokenAddress = token.address; // Unified token address field
          decimals = token.decimals;
          tokenSymbol = token.symbol;
        } else {
          alert("Please select a valid token");
          return;
        }
      } else {
        alert("Unsupported network type");
        return;
      }

      // Validate amount
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        alert("Please enter a valid deposit amount");
        return;
      }

      console.log(`🚀 Starting ${networkType.toUpperCase()} deposit:`, {
        tokenSymbol: selectedTokenParam,
        amount: amount,
        tokenAddress,
        decimals,
      });

      // Execute deposit through TransactionManager
      const result = await transactionManager.deposit(
        tokenAddress,
        amount,
        decimals
      );

      console.log(
        `✅ ${networkType.toUpperCase()} deposit successful:`,
        result
      );

      // Show success message
      const message = `Deposit of ${amount} ${selectedTokenParam} successful!${
        result.hash ? `\nTransaction: ${result.hash}` : ""
      }`;
      alert(message);

      trackEvent("deposit_completed");

      // Clear form and notify parent to refresh balances
      setDepositAmount("");
      if (onBalanceUpdate) {
        await onBalanceUpdate();
      }
    } catch (error) {
      console.error(`${networkType.toUpperCase()} deposit error:`, error);
      // The adapter already phrased this for the user
      alert(error.message);
    } finally {
      // Always reset loading state
      setIsDepositing(false);
    }
  };

  // Deploy proxy function (moved from App.js)
  const deployProxy = async () => {
    if (networkType === "evm") {
      // EVM proxy deployment
      if (!transactionManager) {
        alert("Please connect your wallet first");
        return;
      }

      if (isProxyDeployed) {
        alert("Proxy already deployed!");
        return;
      }

      try {
        setIsDeploying(true);
        console.log("Deploying EVM user proxy...");

        const result = await transactionManager.deployProxy();
        console.log("EVM proxy deployment result:", result);

        // Refresh proxy status
        await checkProxyStatus();
        trackEvent("deposit_address_deployed");

        alert(
          "🎉 Your permanent deposit address is ready. It is tied to your wallet for good — use it for every future deposit from an exchange."
        );
      } catch (error) {
        console.error("Error deploying EVM proxy:", error);
        alert(error.message);
      } finally {
        setIsDeploying(false);
      }
    } else if (networkType === "solana") {
      if (!transactionManager || !solanaConnected) {
        alert("Please connect your Solana wallet first");
        return;
      }

      if (isProxyDeployed) {
        alert("Deposit address already active!");
        return;
      }

      try {
        setIsDeploying(true);
        alert("Your vault address is your deposit address. Complete setup to activate.");
      } catch (error) {
        console.error("Error with Solana deposit setup:", error);
        if (
          error.message.includes("already exists") ||
          error.message.includes("already deployed")
        ) {
          console.log(
            "Solana proxy was already deployed, refreshing status..."
          );
          await checkProxyStatus();
          alert(
            "✅ Your permanent deposit address is ready! This address is permanently tied to your wallet and you can use it for all deposits from exchanges."
          );
        } else if (error.message.includes("user rejected")) {
          alert("Transaction cancelled by user");
        } else {
          alert(`Failed to deploy Solana proxy: ${error.message}`);
        }
      } finally {
        setIsDeploying(false);
      }
    }
  };

  // Wrapper function to call internal deposit function with local amount
  const handleDeposit = () => {
    deposit(selectedToken, depositAmount);
  };
  return (
    <div
      style={{
        marginBottom: "20px",
        padding: "15px",
        backgroundColor: colors.background.primary,
        borderRadius: "8px",
        border: `1px solid ${colors.border.default}`,
      }}
    >
      <h3 style={{ color: colors.text.primary }}>
        Deposit from{" "}
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
            color: colors.text.light,
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
              border: `1px solid ${colors.border.default}`,
              backgroundColor: colors.background.secondary,
              color: "white",
              flex: "1",
              minWidth: "150px",
            }}
          >
            <option value="">Select Token</option>

            {/* Only what this vault actually takes. A vault is created holding
                a specific set of coins and refuses the rest, so offering the
                whole network's list would offer deposits guaranteed to revert. */}
            <optgroup label="🌟 Recommended Stablecoins">
              {Object.entries(
                filterToVaultTokens(
                  getCurrentNetwork(networkType, selectedNetwork).tokens,
                  vaultTokens,
                )
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

            {/* No native-coin option on purpose. This account applies one
                spending limit across everything it holds, denominated in
                dollars, and a coin whose value moves cannot be measured against
                it — so the contract refuses it. Offering it here would be a
                transaction guaranteed to fail. It belongs in a vault of its
                own, where limits are set in that coin. */}
          </select>

          <input
            type="number"
            placeholder="Amount"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "4px",
              border: `1px solid ${colors.border.default}`,
              backgroundColor: colors.background.secondary,
              color: "white",
              flex: "1",
              minWidth: "120px",
            }}
          />

          <button
            onClick={handleDeposit}
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
                  ? colors.background.secondary
                  : colors.background.secondary,
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
            color: colors.text.light,
            marginBottom: "15px",
          }}
        >
          Generate a permanent deposit address for direct deposits from
          exchanges or other wallets.
        </p>

        {!isProxyDeployed && !isDeploying && (
          <div
            style={{
              padding: "15px",
              backgroundColor: colors.background.dark,
              borderRadius: "4px",
              border: `1px solid ${colors.border.default}`,
              textAlign: "center",
            }}
          >
            <button
              onClick={deployProxy}
              style={{
                padding: "10px 20px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: colors.success.main,
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              🚀 Generate Permanent Deposit Address
            </button>

            <div
              style={{
                marginTop: "15px",
                fontSize: "0.8em",
                color: colors.text.gray,
              }}
            >
              <p style={{ margin: `${spacing.xs} 0` }}>
                ✨ One-time setup • free, you only pay gas
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
              backgroundColor: colors.background.dark,
              borderRadius: "4px",
              border: `1px solid ${colors.border.default}`,
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: "10px" }}>
              <span style={{ fontSize: "24px" }}>⏳</span>
            </div>
            <p style={{ margin: "0 0 10px 0", color: colors.text.secondary }}>
              Deploying your personal deposit address...
            </p>
            <p style={{ margin: 0, fontSize: "0.8em", color: colors.text.muted }}>
              This may take 30-60 seconds
            </p>
          </div>
        )}

        {/* Deployed address display */}
        {depositAddress && (
          <div
            style={{
              padding: "15px",
              backgroundColor: colors.background.darkBlue,
              border: `2px solid ${colors.border.success}`,
              borderRadius: "4px",
              textAlign: "center",
            }}
          >
            <h5
              style={{
                margin: "0 0 10px 0",
                color: colors.success.light,
                fontSize: "1.1em",
              }}
            >
              ✅ Your Permanent Deposit Address
            </h5>
            <div
              style={{
                padding: "10px",
                backgroundColor: colors.background.primary,
                borderRadius: "4px",
                border: `1px solid ${colors.border.default}`,
                marginBottom: "15px",
                wordBreak: "break-all",
                fontFamily: "monospace",
                fontSize: "0.9em",
                color: colors.text.secondary,
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
                backgroundColor: colors.background.secondary,
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
                color: colors.text.muted,
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

DepositInterface.propTypes = {
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

  // Token state from parent (shared with withdrawal)
  selectedToken: PropTypes.string.isRequired,
  setSelectedToken: PropTypes.func.isRequired,

  // Callbacks for App.js state updates
  onBalanceUpdate: PropTypes.func,
};

export default DepositInterface;