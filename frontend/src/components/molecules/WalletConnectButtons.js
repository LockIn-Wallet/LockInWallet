import React from "react";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { homeStyles, buttonStyles, buttonHoverEffects } from "../../styles";

import { getAvailableNetworks } from "../../utils/networkFilter.js";
import { isSolanaEnabled } from "../../utils/featureFlags.js";

const hasMetaMaskInstalled = () => !!window.ethereum;
const hasPhantomInstalled = () =>
  !!(window.phantom?.solana || window.solana?.isPhantom);

const hasEvmNetworks = () =>
  getAvailableNetworks("evm").some((n) => n.deployed || n.isLocal);
const hasSolanaNetworks = () =>
  getAvailableNetworks("solana").some((n) => n.deployed || n.isLocal);

/**
 * WalletConnectButtons - the wallet connection CTA group (MetaMask /
 * Phantom / Solana wallet modal), reusable anywhere on the homepage.
 */
const WalletConnectButtons = ({ networkType, connectWallet, onConnectPhantom }) => {
  const canUseMetaMask = hasMetaMaskInstalled() && hasEvmNetworks();
  const canUsePhantom = hasPhantomInstalled() && hasSolanaNetworks();
  const isInSolanaMode = networkType === "solana" && isSolanaEnabled();

  const metaMaskButton = canUseMetaMask && (
    <button
      onClick={connectWallet}
      style={buttonStyles.metamask}
      onMouseEnter={buttonHoverEffects.metamaskHover}
      onMouseLeave={buttonHoverEffects.metamaskReset}
    >
      Connect MetaMask
    </button>
  );

  return (
    <div style={homeStyles.connectRow}>
      {isInSolanaMode ? (
        <>
          <WalletMultiButton />
          {metaMaskButton}
        </>
      ) : (
        <>
          {metaMaskButton}
          {canUsePhantom && onConnectPhantom && (
            <button
              onClick={onConnectPhantom}
              style={buttonStyles.phantom}
              onMouseEnter={buttonHoverEffects.phantomHover}
              onMouseLeave={buttonHoverEffects.phantomReset}
            >
              Connect Phantom
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default WalletConnectButtons;
