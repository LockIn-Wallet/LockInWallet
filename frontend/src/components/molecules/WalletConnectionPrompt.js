import React from "react";

import bobbyLeeVideo from "../../assets/video/bobby_lee.mp4";
import lockinWalletImage from "../../assets/images/lockinwallet.jpg";

import TypewriterText from "../atoms/TypewriterText.js";
import WalletConnectButtons from "./WalletConnectButtons.js";
import TimeLockShowcase from "../organisms/TimeLockShowcase.js";
import TimeLockExplainer from "../organisms/TimeLockExplainer.js";
import ChainAvailability from "../organisms/ChainAvailability.js";
import PrizeSavingsShowcase from "../organisms/PrizeSavingsShowcase.js";

import { homeStyles } from "../../styles";

const HERO_TYPEWRITER_WORDS = [
  "Hackers can't drain it.",
  "You can't impulse spend it.",
  "Devs can't steal it.",
  "Your savings stay yours.",
  "And it can win prizes.",
];

/**
 * WalletConnectionPrompt - the logged-out homepage. Shows connect options
 * plus a product showcase: the time-lock security demo and the opt-in
 * no-loss prize savings demo.
 */
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

  return (
    <div style={homeStyles.container}>
      {/* Hero */}
      <div style={homeStyles.hero}>
        <h2 style={homeStyles.heroTitle}>
          Time-lock your crypto.
          <br />
          <TypewriterText
            words={HERO_TYPEWRITER_WORDS}
            style={homeStyles.heroTypewriter}
          />
        </h2>
        <p style={homeStyles.heroSubtitle}>
          LockInWallet keeps your savings behind on-chain time locks and
          spending limits you set yourself. Even a stolen private key can only
          leak a trickle — and your locked funds can join a no-loss prize pool
          while they sit safe.
        </p>
        <WalletConnectButtons
          networkType={networkType}
          connectWallet={connectWallet}
          onConnectPhantom={onConnectPhantom}
        />
      </div>

      {/* Feature demo: time-locked funds vs a stolen key */}
      <TimeLockShowcase />

      {/* Mechanics: withdrawal limits and the 24-hour bypass timelock */}
      <TimeLockExplainer />

      {/* Chain rollout: Optimism live, Ethereum and Solana underway */}
      <ChainAvailability />

      {/* Feature demo: PoolTogether-style no-loss prize savings */}
      <PrizeSavingsShowcase />

      {/* Brand media */}
      <div style={homeStyles.mediaSection}>
        <img
          src={lockinWalletImage}
          alt="LockIn Wallet"
          style={homeStyles.mediaImage}
        />
      </div>

      <div style={homeStyles.mediaSection}>
        <video
          src={bobbyLeeVideo}
          controls
          loop
          playsInline
          style={homeStyles.mediaVideo}
        />
      </div>

      <p style={homeStyles.footerTagline}>
        Fully on chain timelocked wallet that limits the amount you can
        withdraw to keep you alive and happy.
      </p>

      {/* Closing CTA */}
      <div style={homeStyles.ctaSection}>
        <h2 style={homeStyles.ctaTitle}>Ready to lock it in?</h2>
        <WalletConnectButtons
          networkType={networkType}
          connectWallet={connectWallet}
          onConnectPhantom={onConnectPhantom}
        />
      </div>
    </div>
  );
};

export default WalletConnectionPrompt;
