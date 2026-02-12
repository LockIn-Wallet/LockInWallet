import React from "react";

// Import Solana wallet components
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

// Import styles
import {
  layoutStyles,
  spacing,
  buttonStyles,
  colors,
  fontSize,
  fontWeight,
  borderRadius,
} from "../../styles";

/**
 * WalletConnectionPrompt component - Prompts for wallet connection
 * Shows appropriate connection prompts based on network type and wallet status
 */
const WalletConnectionPrompt = ({
  provider,
  networkType,
  solanaConnected,
  solanaWallet,
  connectWallet,
}) => {
  // Check if wallet is disconnected
  const isEVMDisconnected = !provider && networkType !== "solana";
  const isSolanaDisconnected =
    networkType === "solana" && (!solanaConnected || !solanaWallet);
  const showPrompt = isEVMDisconnected || isSolanaDisconnected;

  if (!showPrompt) {
    return null;
  }

  return (
    <div style={layoutStyles.emptyState}>
      <div style={{ textAlign: "center", marginBottom: spacing.xxxxl }}>
        {isSolanaDisconnected ? (
          <WalletMultiButton />
        ) : (
          <button onClick={connectWallet} style={buttonStyles.primary}>
            Connect MetaMask
          </button>
        )}
      </div>
      {/* Hero Image */}
      <div
        style={{
          textAlign: "center",
          marginTop: spacing.xl,
          marginBottom: spacing.xl,
        }}
      >
        <img
          src={require("../../assets/images/lockinwallet.jpg")}
          alt="LockIn Wallet"
          style={{
            maxWidth: "100%",
            height: "auto",
            maxHeight: "300px",
            borderRadius: borderRadius.lg,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
          }}
        />
      </div>

      {/* Descriptive Text */}
      <div
        style={{
          textAlign: "center",
          marginBottom: spacing.xl,
          padding: `0 ${spacing.lg}`,
        }}
      >
        <p
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.medium,
            color: colors.text.primary,
            lineHeight: "1.6",
            margin: 0,
          }}
        >
          Fully on chain timelocked wallet that limits the amount you can
          withdraw to keep you alive in real life.
        </p>
      </div>

      {/* Connection Instructions */}
      {/* <p
        style={{
          textAlign: "center",
          color: colors.text.secondary,
          marginBottom: spacing.lg,
          fontSize: fontSize.normal,
        }}
      >
        Please connect your {isSolanaDisconnected ? "Solana" : "MetaMask"}{" "}
        wallet to access the savings features.
      </p> */}

      {/* Connection Button */}
    </div>
  );
};

export default WalletConnectionPrompt;
