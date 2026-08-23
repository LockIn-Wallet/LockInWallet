import React from "react";

import Icon from "../atoms/Icon.js";
import LandingLink from "../atoms/LandingLink.js";
import SectionHeading from "../atoms/SectionHeading.js";
import LandingNav from "../organisms/landing/LandingNav.js";
import LandingHero from "../organisms/landing/LandingHero.js";
import EnforcementConsole from "../organisms/landing/EnforcementConsole.js";
import ProofStrip from "../organisms/landing/ProofStrip.js";
import TrustGrid from "../organisms/landing/TrustGrid.js";
import WalletComparison from "../organisms/landing/WalletComparison.js";
import FaqSection from "../organisms/landing/FaqSection.js";
import LandingClosing from "../organisms/landing/LandingClosing.js";
import LandingFooter from "../organisms/landing/LandingFooter.js";
import TimeLockShowcase from "../organisms/TimeLockShowcase.js";
import ChainAvailability from "../organisms/ChainAvailability.js";

import { landingStyles } from "../../styles";

import { GITHUB_URL } from "../../utils/landingContent.js";
import {
  CRYPTO_NAV_LINKS,
  CRYPTO_HERO,
  ARCHITECTURE_SECTION,
  THREAT_MODEL_SECTION,
  YIELD_SECTION,
  CONTRACTS_SECTION,
  CRYPTO_FAQ,
  CRYPTO_CLOSING,
  CRYPTO_SEO,
} from "../../utils/cryptoContent.js";
import { usePageSeo } from "../../hooks/usePageSeo.js";

/**
 * CryptoLanding - the crypto-native landing (/crypto). The main page speaks
 * to someone who has never held crypto; this page holds every chain-level
 * term, demo and disclosure that used to live there — moved, not deleted.
 */
const CryptoLanding = ({
  networkType,
  connectWallet,
  onConnectPhantom,
  onSignInWithPasskey,
  isSigningIn,
}) => {
  usePageSeo(CRYPTO_SEO);

  const onLaunch = onSignInWithPasskey || connectWallet;

  const heroContent = {
    ...CRYPTO_HERO,
    ctaSecondaryHref: GITHUB_URL,
  };

  return (
    <div className="landing-shell" style={landingStyles.page}>
      <LandingNav
        onLaunch={onLaunch}
        links={CRYPTO_NAV_LINKS}
        ctaLabel="Create wallet"
      />

      <LandingHero content={heroContent} onLaunch={onLaunch}>
        <EnforcementConsole />
      </LandingHero>

      <ProofStrip />

      <section id="architecture" style={landingStyles.section}>
        <div style={landingStyles.inner}>
          <SectionHeading
            eyebrow={ARCHITECTURE_SECTION.eyebrow}
            title={ARCHITECTURE_SECTION.title}
          />
          <div style={landingStyles.featureGrid}>
            {ARCHITECTURE_SECTION.cards.map((card) => (
              <article key={card.title} style={landingStyles.featureCard}>
                <span style={landingStyles.iconTile}>
                  <Icon name={card.icon} />
                </span>
                <h3 style={landingStyles.featureTitle}>{card.title}</h3>
                <p style={landingStyles.featureBody}>{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="threat-model" style={landingStyles.section}>
        <div style={landingStyles.inner}>
          <SectionHeading
            eyebrow={THREAT_MODEL_SECTION.eyebrow}
            title={THREAT_MODEL_SECTION.title}
            lede={THREAT_MODEL_SECTION.lede}
          />
          <TimeLockShowcase />
        </div>
      </section>

      <TrustGrid />

      <section style={landingStyles.section}>
        <div style={landingStyles.inner}>
          <SectionHeading
            eyebrow={YIELD_SECTION.eyebrow}
            title={YIELD_SECTION.title}
          />
          <div style={landingStyles.proseBlock}>
            {YIELD_SECTION.paragraphs.map((paragraph) => (
              <p key={paragraph} style={landingStyles.proseParagraph}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      <WalletComparison />

      <section id="contracts" style={landingStyles.section}>
        <div style={landingStyles.inner}>
          <SectionHeading
            eyebrow={CONTRACTS_SECTION.eyebrow}
            title={CONTRACTS_SECTION.title}
            lede={CONTRACTS_SECTION.lede}
          />
          <ChainAvailability />
          <div>
            {CONTRACTS_SECTION.deployments.map((deployment) => (
              <div key={deployment.chain} style={landingStyles.addressRow}>
                <span style={landingStyles.addressChain}>
                  {deployment.chain}
                </span>
                <LandingLink
                  href={deployment.explorerUrl}
                  external
                  style={landingStyles.addressMono}
                >
                  {deployment.address}
                </LandingLink>
              </div>
            ))}
          </div>
          <p style={landingStyles.footnote}>
            SavingsCore proxy — the same address on both chains.{" "}
            {CONTRACTS_SECTION.links.map((link) => (
              <React.Fragment key={link.label}>
                <LandingLink
                  href={link.href}
                  external
                  style={landingStyles.disclosureLink}
                >
                  {link.label} →
                </LandingLink>{" "}
              </React.Fragment>
            ))}
          </p>
        </div>
      </section>

      <FaqSection title="The technical questions" items={CRYPTO_FAQ} />

      <LandingClosing
        content={CRYPTO_CLOSING}
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

export default CryptoLanding;
