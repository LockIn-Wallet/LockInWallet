import React from "react";

import SectionHeading from "../atoms/SectionHeading.js";
import LandingNav from "../organisms/landing/LandingNav.js";
import LandingHero from "../organisms/landing/LandingHero.js";
import HowItWorks from "../organisms/landing/HowItWorks.js";
import CredibilityStrip from "../organisms/landing/CredibilityStrip.js";
import LandingClosing from "../organisms/landing/LandingClosing.js";
import LandingFooter from "../organisms/landing/LandingFooter.js";

import TimeLockShowcase from "../organisms/TimeLockShowcase.js";

import { landingStyles } from "../../styles";

import { BREACH_SECTION } from "../../utils/landingContent.js";

/**
 * WalletConnectionPrompt - the logged-out landing page.
 *
 * Written for somebody who has never held crypto, so it makes exactly one
 * claim and proves it: you choose the limit, and after that nobody can exceed
 * it. The order is the claim (hero), the claim demonstrated live (console),
 * the claim under attack (showcase), how you set it up, and one honest block
 * for the sceptic before the sign-in.
 *
 * Everything that needs prior knowledge to mean anything — chain names, wallet
 * categories, the upgrade and governance model, the proof numbers — lives on
 * /how-it-works. A visitor who wants it is one link away from all of it; a
 * visitor who does not never has to walk past it wondering what Optimism is.
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

      <section style={landingStyles.section}>
        <div style={landingStyles.inner}>
          <SectionHeading
            eyebrow={BREACH_SECTION.eyebrow}
            title={BREACH_SECTION.title}
            lede={BREACH_SECTION.lede}
          />
          <TimeLockShowcase />
        </div>
      </section>

      <HowItWorks />

      <CredibilityStrip />

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
