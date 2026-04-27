import React from "react";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import bobbyLeeVideo from "../../assets/video/bobby_lee.mp4";

import {
  layoutStyles,
  spacing,
  buttonStyles,
  buttonHoverEffects,
  colors,
  fontSize,
  fontWeight,
  borderRadius,
} from "../../styles";

import { getAvailableNetworks } from "../../utils/networkFilter.js";

const hasMetaMaskInstalled = () => !!window.ethereum;
const hasPhantomInstalled = () =>
  !!(window.phantom?.solana || window.solana?.isPhantom);

const hasEvmNetworks = () =>
  getAvailableNetworks("evm").some((n) => n.deployed || n.isLocal);
const hasSolanaNetworks = () =>
  getAvailableNetworks("solana").some((n) => n.deployed || n.isLocal);

const WalletConnectionPrompt = ({
  provider,
  networkType,
  solanaConnected,
  solanaWallet,
  connectWallet,
  onConnectPhantom,
}) => {
  const isEVMDisconnected = !provider && networkType !== "solana";
  const isSolanaDisconnected =
    networkType === "solana" && (!solanaConnected || !solanaWallet);
  const showPrompt = isEVMDisconnected || isSolanaDisconnected;

  if (!showPrompt) {
    return null;
  }

  const canUseMetaMask = hasMetaMaskInstalled() && hasEvmNetworks();
  const canUsePhantom = hasPhantomInstalled() && hasSolanaNetworks();
  const isInSolanaMode = networkType === "solana";

  return (
    <div style={layoutStyles.emptyState}>
      <div
        style={{
          textAlign: "center",
          marginBottom: spacing.xxxxl,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        {isInSolanaMode ? (
          <>
            <WalletMultiButton />
            {canUseMetaMask && (
              <button
                onClick={connectWallet}
                style={buttonStyles.metamask}
                onMouseEnter={buttonHoverEffects.metamaskHover}
                onMouseLeave={buttonHoverEffects.metamaskReset}
              >
                🦊 Connect MetaMask
              </button>
            )}
          </>
        ) : (
          <>
            {canUseMetaMask && (
              <button
                onClick={connectWallet}
                style={buttonStyles.metamask}
                onMouseEnter={buttonHoverEffects.metamaskHover}
                onMouseLeave={buttonHoverEffects.metamaskReset}
              >
                🦊 Connect MetaMask
              </button>
            )}
            {canUsePhantom && onConnectPhantom && (
              <button
                onClick={onConnectPhantom}
                style={buttonStyles.phantom}
                onMouseEnter={buttonHoverEffects.phantomHover}
                onMouseLeave={buttonHoverEffects.phantomReset}
              >
                👻 Connect Phantom
              </button>
            )}
          </>
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

      {/* Video */}
      <div
        style={{
          textAlign: "center",
          marginBottom: spacing.xl,
        }}
      >
        <video
          src={bobbyLeeVideo}
          controls
          loop
          playsInline
          style={{
            maxWidth: "100%",
            height: "auto",
            maxHeight: "400px",
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
          withdraw to keep you alive and happy.
        </p>
      </div>
    </div>
  );
};

export default WalletConnectionPrompt;
