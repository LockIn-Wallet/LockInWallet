import React from "react";

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

// Import other components
import NetworkSelector from "./NetworkSelector.js";
import WalletConnector from "./WalletConnector.js";

/**
 * StatusHeader component - Main header with logo and status information
 * Displays wallet connection status, network info, and setup progress
 */
const StatusHeader = ({
  // Network state
  networkType,
  selectedNetwork,
  isNetworkSwitching,
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
  getCurrentNetwork,
  isCorrectNetwork,
}) => {
  return (
    <div style={layoutStyles.headerSection}>
      {/* Main Logo */}
      <img
        src={require("../../assets/images/logo.png")}
        alt="LockIn Wallet"
        style={styles.app.logo}
        onError={(e) => {
          e.target.style.display = "none";
          e.target.nextSibling.style.display = "block";
        }}
      />
      <h1
        style={{ ...styles.app.title, display: "none", textAlign: "center" }}
      >
        🔒 LockIn Wallet
      </h1>

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
                backgroundColor: isCorrectNetwork()
                  ? colors.success.main
                  : colors.error.main,
              }}
            />
            <span
              style={{
                fontSize: fontSize.xs,
                color: isCorrectNetwork()
                  ? colors.success.light
                  : colors.error.light,
              }}
            >
              {isCorrectNetwork()
                ? `Connected to ${
                    getCurrentNetwork(networkType, selectedNetwork).name
                  }`
                : networkType === "solana"
                ? `Connect Solana wallet`
                : `Wrong network - Switch to ${
                    getCurrentNetwork(networkType, selectedNetwork).name
                  }`}
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