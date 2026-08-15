import React from "react";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { homeStyles, buttonStyles, buttonHoverEffects } from "../../styles";

import { getAvailableNetworks } from "../../utils/networkFilter.js";
import { isSolanaEnabled } from "../../utils/featureFlags.js";
import { hasWallet } from "../../utils/walletProvider.js";
import { isPasskeySupported } from "../../utils/passkeyWallet.js";

const hasEvmWallet = () => hasWallet();
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
const WalletConnectButtons = ({
  networkType,
  connectWallet,
  onConnectPhantom,
  onSignInWithPasskey,
  isSigningIn = false,
}) => {
  const metaMaskInstalled = hasEvmWallet();
  const canUsePhantom = hasPhantomInstalled() && hasSolanaNetworks();
  const isInSolanaMode = networkType === "solana" && isSolanaEnabled();

  // Signing in needs nothing installed and no seed phrase, so for anyone
  // arriving without a wallet it is the only path that leads anywhere. It takes
  // the accent and connecting an existing wallet steps back to outlined.
  const canSignIn = Boolean(onSignInWithPasskey) && isPasskeySupported() && hasEvmNetworks();

  const passkeyButton = canSignIn && (
    <button
      onClick={onSignInWithPasskey}
      disabled={isSigningIn}
      style={isSigningIn ? { ...buttonStyles.passkey, ...buttonStyles.disabled } : buttonStyles.passkey}
      onMouseEnter={isSigningIn ? undefined : buttonHoverEffects.metamaskHover}
      onMouseLeave={isSigningIn ? undefined : buttonHoverEffects.metamaskReset}
    >
      {isSigningIn ? "Signing in…" : "Sign in"}
    </button>
  );

  // Says what actually separates the two, without overclaiming. Signing in is
  // not anonymous — the key never leaves the device, but a Coinbase-operated
  // service sees the requests and the IP behind them. Bringing your own wallet
  // is what puts you in control of that, and this page already learned once
  // that a privacy claim it cannot back does more harm than no claim at all.
  const connectNote = canSignIn && (
    <p style={homeStyles.connectNote}>
      Signing in creates a wallet held by a passkey on your device — no
      extension, no seed phrase. Your own wallet keeps every request between you
      and the network.
    </p>
  );

  // Without the extension the button still shows — pressing it opens the
  // onboarding dialog. Hiding it left first-time visitors on a page whose
  // whole purpose is the connect step, with nothing to press.
  const metaMaskButton = hasEvmNetworks() && (
    <button
      onClick={connectWallet}
      style={canSignIn ? buttonStyles.walletSecondary : buttonStyles.metamask}
      onMouseEnter={canSignIn ? buttonHoverEffects.phantomHover : buttonHoverEffects.metamaskHover}
      onMouseLeave={canSignIn ? buttonHoverEffects.phantomReset : buttonHoverEffects.metamaskReset}
    >
      {canSignIn
        ? "Use your own wallet"
        : metaMaskInstalled
          ? "Connect MetaMask"
          : "Connect wallet"}
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
          {passkeyButton}
          {metaMaskButton}
          {connectNote}
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
