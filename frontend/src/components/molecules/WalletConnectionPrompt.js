import React from "react";

import SectionHeading from "../atoms/SectionHeading.js";
import LandingLink from "../atoms/LandingLink.js";
import FaqList from "./FaqList.js";
import LandingNav from "../organisms/landing/LandingNav.js";
import LandingHero from "../organisms/landing/LandingHero.js";
import ProductPromise from "../organisms/landing/ProductPromise.js";
import HowItWorks from "../organisms/landing/HowItWorks.js";
import UseCases from "../organisms/landing/UseCases.js";
import LandingClosing from "../organisms/landing/LandingClosing.js";
import LandingFooter from "../organisms/landing/LandingFooter.js";

import { homeStyles, landingStyles } from "../../styles";

import { HOME_FAQ, HOME_DETAILS_TEASER } from "../../utils/landingContent.js";
import { SECURITY_PAGE_PATH } from "../../utils/securityPageContent.js";

/**
 * WalletConnectionPrompt - the logged-out landing page.
 *
 * Written for someone who has never held crypto and searched for a savings
 * account they can't withdraw from. It says what the account does, how you
 * set it up, who it is for, and answers the plain questions. Everything
 * about chains, keys and upgrades lives on /security, linked at the end.
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

      <ProductPromise />

      <HowItWorks />

      <UseCases />

      <section style={landingStyles.section} aria-labelledby="home-faq">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="home-faq"
            eyebrow="Questions"
            title="The things people ask before they put money in"
          />
          <FaqList items={HOME_FAQ} />
        </div>
      </section>

      <section style={landingStyles.section}>
        <div style={landingStyles.inner}>
          <SectionHeading
            eyebrow={HOME_DETAILS_TEASER.eyebrow}
            title={HOME_DETAILS_TEASER.title}
            lede={HOME_DETAILS_TEASER.lede}
          />
          <div style={homeStyles.pageCtaRow}>
            <LandingLink
              href={SECURITY_PAGE_PATH}
              internal
              style={landingStyles.ctaSecondary}
            >
              {HOME_DETAILS_TEASER.linkLabel}
            </LandingLink>
          </div>
        </div>
      </section>

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
