import React from "react";

// Import Solana wallet components
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

// Import styles
import {
  layoutStyles,
  spacing,
  buttonStyles,
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
  // Show EVM wallet connection prompt
  if (!provider && networkType !== "solana") {
    return (
      <div style={layoutStyles.emptyState}>
        <p>Please connect your MetaMask wallet to access the savings features.</p>
        <div style={{ marginTop: spacing.md }}>
          <button
            onClick={connectWallet}
            style={buttonStyles.primary}
          >
            Connect MetaMask
          </button>
        </div>
      </div>
    );
  }

  // Show Solana wallet connection prompt
  if (networkType === "solana" && (!solanaConnected || !solanaWallet)) {
    return (
      <div style={layoutStyles.emptyState}>
        <p>Please connect your Solana wallet to access the savings features.</p>
        <div style={{ marginTop: spacing.md }}>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  // If wallet is connected, don't show prompt
  return null;
};

export default WalletConnectionPrompt;