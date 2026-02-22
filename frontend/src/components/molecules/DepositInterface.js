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

  // Callbacks for App.js state updates
  onBalanceUpdate,
}) => {
  // Internal state for deposit operations
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [depositAddress, setDepositAddress] = useState("");
  const [isProxyDeployed, setIsProxyDeployed] = useState(false);

  // Proxy status checking function (moved from App.js)
  const checkProxyStatus = async () => {
    if (networkType === "evm") {
      // EVM proxy status check
      if (!savingsContract || !signer) {
        console.log("❌ No contract or signer available for EVM proxy check");
        return;
      }

      try {
        const userAddress = await signer.getAddress();
        console.log(`🔍 Checking EVM proxy status for user: ${userAddress}`);

        const proxyDeployed = await savingsContract.isProxyDeployed(userAddress);
        const depositAddress = await savingsContract.getUserDepositAddress(userAddress);

        console.log(`✅ EVM proxy status: deployed=${proxyDeployed}, address=${depositAddress}`);

        setIsProxyDeployed(proxyDeployed);
        setDepositAddress(proxyDeployed ? depositAddress : "");
      } catch (error) {
        console.error("❌ Error checking EVM proxy status:", error);
        setIsProxyDeployed(false);
        setDepositAddress("");
      }
    } else if (networkType === "solana") {
      // Solana proxy status check
      if (!transactionManager) {
        console.log("❌ No transaction manager available for Solana proxy check");
        return;
      }

      try {
        const userAddress = await transactionManager.getAddress();
        console.log(`🔍 Checking Solana proxy status for user: ${userAddress}`);

        const proxyDeployed = await transactionManager.isProxyDeployed(userAddress);
        const depositAddress = await transactionManager.getDepositAddress(userAddress);

        console.log(`✅ Solana proxy status: deployed=${proxyDeployed}, address=${depositAddress}`);

        setIsProxyDeployed(proxyDeployed);
        setDepositAddress(proxyDeployed ? depositAddress : "");
      } catch (error) {
        console.error("❌ Error checking Solana proxy status:", error);
        setIsProxyDeployed(false);
        setDepositAddress("");
      }
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

      // Clear form and notify parent to refresh balances
      setDepositAmount("");
      if (onBalanceUpdate) {
        await onBalanceUpdate();
      }
    } catch (error) {
      console.error(`${networkType.toUpperCase()} deposit error:`, error);

      // Provide user-friendly error messages
      let errorMessage = "Failed to deposit. ";
      if (error.message.includes("User rejected")) {
        errorMessage += "Transaction was rejected.";
      } else if (error.message.includes("insufficient funds")) {
        errorMessage += "Insufficient funds.";
      } else if (error.message.includes("network")) {
        errorMessage += "Network error. Please check your connection.";
      } else if (error.message.includes("not connected")) {
        errorMessage += "Wallet not connected.";
      } else {
        errorMessage += "Please check the token selection and amount.";
      }

      alert(errorMessage);
    } finally {
      // Always reset loading state
      setIsDepositing(false);
    }
  };

  // Deploy proxy function (moved from App.js)
  const deployProxy = async () => {
    if (networkType === "evm") {
      // EVM proxy deployment
      if (!savingsContract || !signer) {
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

        // Call the deployUserProxy function
        const tx = await savingsContract.deployUserProxy();
        console.log("Transaction sent:", tx.hash);

        // Wait for transaction confirmation
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        // Refresh proxy status
        await checkProxyStatus();

        alert(
          "🎉 Permanent deposit address generated successfully! This address is permanently tied to your wallet and you can use it for all future deposits from exchanges."
        );
      } catch (error) {
        console.error("Error deploying EVM proxy:", error);
        alert(`Failed to deploy proxy: ${error.message}`);
      } finally {
        setIsDeploying(false);
      }
    } else if (networkType === "solana") {
      // Solana proxy deployment with payment activation
      if (!transactionManager || !solanaConnected) {
        alert("Please connect your Solana wallet first");
        return;
      }

      if (isProxyDeployed) {
        alert("Permanent deposit address already deployed!");
        return;
      }

      try {
        setIsDeploying(true);

        // Since no permanent address exists, user needs to pay first
        console.log("Processing activation payment for permanent address...");
        const fee = await transactionManager.currentAdapter.getActivationFee();
        const sufficientBalance =
          await transactionManager.currentAdapter.hasSufficientBalanceForActivation();

        if (!sufficientBalance) {
          alert(
            `💳 Insufficient Balance\n\nTo generate your permanent deposit address, you need to pay a one-time activation fee of ${(
              fee / 1000000000
            ).toFixed(
              3
            )} SOL (~$5 USD).\n\nPlease add more SOL to your wallet and try again.`
          );
          setIsDeploying(false);
          return;
        }

        // Initialize savings account if it doesn't exist (separate from spending limits account)
        console.log("Ensuring savings account exists...");
        const savingsAccountExists =
          await transactionManager.currentAdapter.isProxyDeployed(
            solanaConnected ? solanaPublicKey?.toString() : userAddress
          );

        if (!savingsAccountExists) {
          console.log("Creating savings account...");
          await transactionManager.currentAdapter.initializeSavingsAccount();
          console.log("✅ Savings account created");
        } else {
          console.log("✅ Savings account already exists");
        }

        console.log("Processing activation payment...");
        const paymentTxHash =
          await transactionManager.currentAdapter.activatePermanentAddressWithPayment();
        console.log("✅ Payment completed:", paymentTxHash);

        console.log("Deploying Solana permanent deposit address...");
        // Deploy proxy using transaction manager
        const result = await transactionManager.deployProxy();
        console.log("Solana proxy deployment result:", result);

        // Refresh proxy status
        await checkProxyStatus();

        alert(
          "🎉 Payment completed & permanent deposit address generated successfully! This address is permanently tied to your wallet and you can use it for all future deposits from exchanges."
        );
      } catch (error) {
        console.error("Error deploying Solana proxy:", error);

        // Handle specific error cases
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

        {!isProxyDeployed && !isDeploying && (
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
              onClick={deployProxy}
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
              🚀 Generate Permanent Deposit Address
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