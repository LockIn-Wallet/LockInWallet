import React from "react";
import { Link } from "react-router-dom";

// Import styles
import {
  styles,
  cardStyles,
  layoutStyles,
  utilityStyles,
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
} from "../../styles";

// Import utility functions
import {
  getCurrentNetwork,
  isCorrectNetwork,
} from "../../utils/walletUtils.js";

// Import other components
import NetworkSelector from "./NetworkSelector.js";
import WalletConnector from "./WalletConnector.js";
import TypewriterText from "../atoms/TypewriterText.js";

/**
 * StatusHeader component - Main header with logo and status information
 * Displays wallet connection status, network info, and setup progress
 */
const StatusHeader = ({
  // Network state
  networkType,
  selectedNetwork,
  isNetworkSwitching,
  currentChainId,
  // Wallet state
  provider,
  solanaWallet,
  solanaConnected,
  solanaPublicKey,
  userAddress,
  // Setup state
  isSetupCommitted,
  currentStep,
  // Functions
  switchNetworkType,
  switchNetwork,
}) => {
  // Local wrapper functions using imported utilities
  const getNetworkInfo = () => getCurrentNetwork(networkType, selectedNetwork);
  const checkCorrectNetwork = () =>
    isCorrectNetwork(
      networkType,
      selectedNetwork,
      solanaConnected,
      currentChainId,
    );
  return (
    <div style={layoutStyles.headerSection}>
      {/* Main Logo — doubles as the link home */}
      <Link to="/" aria-label="LockIn Wallet home">
        <img
          src={require("../../assets/images/logo.png")}
          alt="LockIn Wallet"
          style={styles.app.logo}
          onError={(e) => {
            e.target.style.display = "none";
            e.target.parentElement.nextSibling.style.display = "block";
          }}
        />
      </Link>
      <h1 style={{ ...styles.app.title, display: "none", textAlign: "center" }}>
        🔒 LockIn Wallet
      </h1>

      {/* Tagline - Only show when wallet is disconnected */}
      {/* {(!provider && networkType !== "solana") ||
      (networkType === "solana" && (!solanaConnected || !solanaWallet)) ? (
        <div
          style={{
            textAlign: "center",
            marginTop: spacing.sm,
            marginBottom: spacing.lg,
          }}
        >
          <p
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.medium,
              color: colors.text.secondary,
              margin: 0,
              fontStyle: "italic",
            }}
          >
            Protect{" "}
            <TypewriterText
              words={["profits", "bankroll", "savings"]}
              typingSpeed={120}
              deletingSpeed={60}
              delayBetweenWords={2500}
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.medium,
                color: colors.success.main,
              }}
            />
            even from yourself
          </p>
        </div>
      ) : null} */}

      {/* Status Info Card */}
      {(provider || (networkType === "solana" && solanaWallet)) && (
        <div style={cardStyles.statusCard}>
          {/* Top Row: Connection & Status */}
          <div style={layoutStyles.flexBetweenWrap}>
            {/* Wallet Connection Info */}
            <WalletConnector
              networkType={networkType}
              solanaConnected={solanaConnected}
              solanaPublicKey={solanaPublicKey}
              userAddress={userAddress}
            />
          </div>

          {/* Second Row: Network & Status Badge */}
          <div style={layoutStyles.flexBetweenWrap}>
            {/* Network Selection */}
            <NetworkSelector
              networkType={networkType}
              selectedNetwork={selectedNetwork}
              isNetworkSwitching={isNetworkSwitching}
              switchNetworkType={switchNetworkType}
              switchNetwork={switchNetwork}
            />

            {/* Dynamic Status Badge */}
            <div style={layoutStyles.statusBadge}>
              <span style={utilityStyles.label}>Status:</span>
              <div
                style={{
                  ...layoutStyles.statusIndicator,
                  padding: spacing.sm + " " + spacing.md,
                  borderRadius: borderRadius.md,
                  backgroundColor: isSetupCommitted
                    ? colors.background.darkBlue
                    : colors.warning.bg,
                  border: `1px solid ${
                    isSetupCommitted
                      ? colors.success.border
                      : colors.warning.dark
                  }`,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                }}
                title={
                  isSetupCommitted
                    ? "Your wallet is locked and secure. All features are active."
                    : `You're in setup mode — configure limits & addresses before activating your wallet security. Step ${currentStep} of 3.`
                }
              >
                <span
                  style={{
                    color: isSetupCommitted
                      ? colors.success.light
                      : colors.warning.light,
                  }}
                >
                  {!isSetupCommitted ? "⚙️ Setup Wallet" : "🔒 Locked-In"}
                </span>
                {/* Step counter removed per user request */}
              </div>
            </div>
          </div>

          {/* Connection Status Indicator */}
          <div style={layoutStyles.connectionStatus}>
            <div
              style={{
                ...utilityStyles.statusIndicator,
                backgroundColor: checkCorrectNetwork()
                  ? colors.success.main
                  : colors.error.main,
              }}
            />
            <span
              style={{
                fontSize: fontSize.xs,
                color: checkCorrectNetwork()
                  ? colors.success.light
                  : colors.error.light,
                cursor:
                  !checkCorrectNetwork() && networkType === "evm"
                    ? "pointer"
                    : "default",
                textDecoration:
                  !checkCorrectNetwork() && networkType === "evm"
                    ? "underline"
                    : "none",
              }}
              onClick={async () => {
                if (!checkCorrectNetwork() && networkType === "evm") {
                  console.log(
                    `🔄 User clicked to switch to ${getNetworkInfo().name}...`,
                  );
                  try {
                    // Import the network switching function dynamically
                    const { ensureCorrectNetwork } = await import(
                      "../../utils/providerManager.js"
                    );
                    const switched = await ensureCorrectNetwork(
                      selectedNetwork,
                    );
                    if (switched) {
                      console.log(
                        `✅ Successfully switched to ${getNetworkInfo().name}`,
                      );
                    } else {
                      alert(
                        `Please manually switch MetaMask to ${
                          getNetworkInfo().name
                        } network`,
                      );
                    }
                  } catch (error) {
                    console.error("Network switch failed:", error);
                    alert(`Failed to switch network: ${error.message}`);
                  }
                }
              }}
              title={
                !checkCorrectNetwork() && networkType === "evm"
                  ? `Click to switch to ${getNetworkInfo().name}`
                  : ""
              }
            >
              {checkCorrectNetwork()
                ? `Connected to ${getNetworkInfo().name}`
                : networkType === "solana"
                ? `Connect Solana wallet`
                : `Wrong network - Click to switch to ${getNetworkInfo().name}`}
            </span>
          </div>
        </div>
      )}

      {/* Contract Deployment Warning */}
      {provider &&
        getCurrentNetwork(networkType, selectedNetwork).savingsContract ===
          "0x0000000000000000000000000000000000000000" && (
          <div
            style={{
              ...cardStyles.warningCard,
              marginTop: spacing.xl,
            }}
          >
            <h4
              style={{
                margin: `0 0 ${spacing.md} 0`,
                color: colors.error.main,
              }}
            >
              ⚠️ Contract Not Deployed
            </h4>
            <p style={{ margin: 0, fontSize: fontSize.sm }}>
              The Savings contract is not yet deployed on{" "}
              {getCurrentNetwork(networkType, selectedNetwork).name}. Please
              switch to Localhost for development or wait for mainnet
              deployment.
            </p>
          </div>
        )}
    </div>
  );
};

export default StatusHeader;
