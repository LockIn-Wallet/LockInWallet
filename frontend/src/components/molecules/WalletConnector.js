import React from "react";

// Import Solana wallet components
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

// Import styles
import {
  buttonStyles,
  layoutStyles,
  utilityStyles,
  colors,
  spacing,
  borderRadius,
} from "../../styles";

/**
 * WalletConnector component - Wallet connection status and controls
 * Shows connected wallet info and provides wallet connection buttons
 */
const WalletConnector = ({
  networkType,
  solanaPublicKey,
  userAddress,
  onDisconnect,
}) => {
  return (
    <>
      {/* Connected Wallet Info */}
      <div style={layoutStyles.flexAlignCenter}>
        <span style={utilityStyles.statusText}>Connected:</span>
        <span
          style={{
            ...utilityStyles.addressText,
            color: colors.success.light,
            backgroundColor: colors.background.darkBlue,
            padding: spacing.xs + " " + spacing.sm,
            borderRadius: borderRadius.sm,
          }}
        >
          {networkType === "solana"
            ? solanaPublicKey
              ? `${solanaPublicKey
                  .toString()
                  .slice(0, 6)}...${solanaPublicKey
                  .toString()
                  .slice(-4)}`
              : "Loading..."
            : userAddress
            ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
            : "Loading..."}
        </span>
        <span style={utilityStyles.caption}>
          ({networkType === "solana" ? "Phantom" : "MetaMask"})
        </span>
      </div>

      <div style={layoutStyles.flexGap}>
        {/* Wallet picker for Solana */}
        {networkType === "solana" && <WalletMultiButton />}

        {/* Logging out works the same on every chain */}
        <button
          type="button"
          style={buttonStyles.small}
          onClick={onDisconnect}
          title="Disconnect this wallet and return to the home page"
        >
          Disconnect
        </button>
      </div>
    </>
  );
};

export default WalletConnector;