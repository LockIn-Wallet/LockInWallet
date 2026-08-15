import React from "react";

import SectionHeading from "../atoms/SectionHeading.js";
import LandingNav from "../organisms/landing/LandingNav.js";
import LandingHero from "../organisms/landing/LandingHero.js";
import ProofStrip from "../organisms/landing/ProofStrip.js";
import WalletComparison from "../organisms/landing/WalletComparison.js";
import TrustGrid from "../organisms/landing/TrustGrid.js";
import HowItWorks from "../organisms/landing/HowItWorks.js";
import LandingClosing from "../organisms/landing/LandingClosing.js";
import LandingFooter from "../organisms/landing/LandingFooter.js";

import TimeLockShowcase from "../organisms/TimeLockShowcase.js";
import ChainAvailability from "../organisms/ChainAvailability.js";

import { landingStyles } from "../../styles";

// Shares the lazy chunk with the standalone page, so chart.js still only
// downloads when this section is actually reached

/**
 * WalletConnectionPrompt - the logged-out landing page.
 *
 * The argument runs in order: the contract refuses a withdrawal (hero), three
 * checkable facts, then the demos that prove each claim, then the comparison,
 * the trust model including what we can still do, and finally setup.
 */
const WalletConnectionPrompt = ({
  provider,
  networkType,
  solanaConnected,
  solanaWallet,
  connectWallet,
  onConnectPhantom,
  onSignInWithPasskey,
  isSigningIn,
}) => {
  const isEVMDisconnected = !provider && networkType !== "solana";
  const isSolanaDisconnected =
    networkType === "solana" && (!solanaConnected || !solanaWallet);

  if (!(isEVMDisconnected || isSolanaDisconnected)) {
    return null;
  }

  return (
    <div className="landing-shell" style={landingStyles.page}>
      <LandingNav onLaunch={onSignInWithPasskey || connectWallet} />

      <LandingHero onLaunch={onSignInWithPasskey || connectWallet} />

      <ProofStrip />

      <section style={landingStyles.section}>
        <div style={landingStyles.inner}>
          <SectionHeading
            eyebrow="What a leaked key costs you"
            title="A stolen key can't empty your wallet"
            lede="Your limit is the attacker's limit too. That gap is the time you need to notice and take the account back."
          />
          <TimeLockShowcase />
        </div>
      </section>

      <WalletComparison />

      <TrustGrid />

      <section style={landingStyles.section}>
        <div style={landingStyles.inner}>
          <SectionHeading
            eyebrow="Chains"
            title="Live on Optimism, with Ethereum underway"
            lede="Cheap, fast transactions matter here: an hourly limit only makes sense if using it doesn't cost a fortune in gas."
          />
          <ChainAvailability />
        </div>
      </section>

      <HowItWorks />

      <LandingClosing
        networkType={networkType}
        connectWallet={connectWallet}
        onConnectPhantom={onConnectPhantom}
        onSignInWithPasskey={onSignInWithPasskey}
        isSigningIn={isSigningIn}
      />

      <LandingFooter />
    </div>
  );
};

export default WalletConnectionPrompt;
