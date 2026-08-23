import React from "react";

import LandingNav from "../organisms/landing/LandingNav.js";
import LandingHero from "../organisms/landing/LandingHero.js";
import RulePreview from "../organisms/landing/RulePreview.js";
import ProblemSection from "../organisms/landing/ProblemSection.js";
import HowItWorks from "../organisms/landing/HowItWorks.js";
import LockedComparison from "../organisms/landing/LockedComparison.js";
import MoneySection from "../organisms/landing/MoneySection.js";
import GrowthSection from "../organisms/landing/GrowthSection.js";
import WhoItsFor from "../organisms/landing/WhoItsFor.js";
import FaqSection from "../organisms/landing/FaqSection.js";
import LandingClosing from "../organisms/landing/LandingClosing.js";
import LandingFooter from "../organisms/landing/LandingFooter.js";

import { landingStyles } from "../../styles";

import { HERO, HOME_FAQ, CLOSING, HOME_SEO } from "../../utils/landingContent.js";
import { usePageSeo } from "../../hooks/usePageSeo.js";

/**
 * WalletConnectionPrompt - the logged-out landing page, written for someone
 * who has never held crypto. The argument runs in order: the rules in your
 * own hands (hero widget), why every other tool fails at 2am, the three
 * decisions, what "locked" means here, where the money actually is, the
 * optional growth, who it's for, the questions everyone asks, then setup.
 * Everything chain-native lives on /crypto instead.
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
  usePageSeo(HOME_SEO);

  const isEVMDisconnected = !provider && networkType !== "solana";
  const isSolanaDisconnected =
    networkType === "solana" && (!solanaConnected || !solanaWallet);

  if (!(isEVMDisconnected || isSolanaDisconnected)) {
    return null;
  }

  const onLaunch = onSignInWithPasskey || connectWallet;

  const heroContent = {
    ...HERO,
    ctaSecondaryHref: "#how-it-works",
  };

  return (
    <div className="landing-shell" style={landingStyles.page}>
      <LandingNav onLaunch={onLaunch} />

      <LandingHero content={heroContent} onLaunch={onLaunch}>
        <RulePreview onLaunch={onLaunch} />
      </LandingHero>

      <ProblemSection />

      <HowItWorks />

      <LockedComparison />

      <MoneySection />

      <GrowthSection />

      <WhoItsFor />

      <FaqSection title="Questions people actually ask" items={HOME_FAQ} />

      <LandingClosing
        content={CLOSING}
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
