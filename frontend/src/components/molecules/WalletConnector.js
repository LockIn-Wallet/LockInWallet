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

import {
  isEmbeddedWallet,
  getInjectedWalletName,
} from "../../utils/walletProvider.js";

/**
 * WalletConnector component - Wallet connection status and controls
 * Shows connected wallet info and provides wallet connection buttons
 */
/**
 * What to call the wallet someone is actually connected with.
 *
 * This was hardcoded to "MetaMask" for every EVM wallet, which was true while
 * an extension was the only way in. Someone who signed in with a passkey has no
 * MetaMask at all, and telling them they are using one is simply wrong — and
 * confusing in exactly the place they would look to check.
 */
const connectedWalletName = (networkType) => {
  if (networkType === "solana") return "Phantom";
  if (isEmbeddedWallet()) return "Passkey";
  return getInjectedWalletName() || "Wallet";
};

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
        <span style={utilityStyles.caption}>({connectedWalletName(networkType)})</span>
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