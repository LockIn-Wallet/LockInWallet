import React from "react";

import SectionHeading from "../atoms/SectionHeading.js";
import LandingLink from "../atoms/LandingLink.js";
import FaqList from "../molecules/FaqList.js";
import EnforcementConsole from "../organisms/landing/EnforcementConsole.js";
import ProofStrip from "../organisms/landing/ProofStrip.js";
import WalletComparison from "../organisms/landing/WalletComparison.js";
import TrustGrid from "../organisms/landing/TrustGrid.js";
import TimeLockShowcase from "../organisms/TimeLockShowcase.js";
import ChainAvailability from "../organisms/ChainAvailability.js";

import { usePageSeo } from "../../hooks/usePageSeo.js";

import { homeStyles, landingStyles } from "../../styles";

import {
  SECURITY_PAGE_SEO,
  SECURITY_HERO,
  SECURITY_CONSOLE,
  SECURITY_ATTACK,
  SECURITY_CHAINS,
  SECURITY_FAQ,
} from "../../utils/securityPageContent.js";
import { BEGINNER_GUIDE_PATH } from "../../utils/landingContent.js";

/**
 * SecurityPage — /security
 *
 * Everything the home page used to say about how the wallet works now lives
 * here: the live enforcement console, the three checkable facts, the
 * stolen-key simulation, the wallet comparison, the trust model including
 * what we can still do, and the chains. The argument runs in the same order
 * it did on the home page: the contract refuses a withdrawal, then the proof.
 */
const SecurityPage = () => {
  usePageSeo(SECURITY_PAGE_SEO);

  return (
    <div style={landingStyles.page}>
      <header style={landingStyles.sectionFlush}>
        <div style={landingStyles.inner}>
          <p style={landingStyles.eyebrow}>{SECURITY_HERO.eyebrow}</p>
          <h1 style={homeStyles.pageTitle}>{SECURITY_HERO.title}</h1>
          <p style={homeStyles.pageLede}>{SECURITY_HERO.lede}</p>
        </div>
      </header>

      <section style={landingStyles.section} aria-labelledby="security-console">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="security-console"
            eyebrow={SECURITY_CONSOLE.eyebrow}
            title={SECURITY_CONSOLE.title}
            lede={SECURITY_CONSOLE.lede}
          />
          <EnforcementConsole />
        </div>
      </section>

      <ProofStrip />

      <section style={landingStyles.section} aria-labelledby="security-attack">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="security-attack"
            eyebrow={SECURITY_ATTACK.eyebrow}
            title={SECURITY_ATTACK.title}
            lede={SECURITY_ATTACK.lede}
          />
          <TimeLockShowcase />
        </div>
      </section>

      <WalletComparison />

      <TrustGrid />

      <section style={landingStyles.section} aria-labelledby="security-chains">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="security-chains"
            eyebrow={SECURITY_CHAINS.eyebrow}
            title={SECURITY_CHAINS.title}
            lede={SECURITY_CHAINS.lede}
          />
          <ChainAvailability />
        </div>
      </section>

      <section style={landingStyles.section} aria-labelledby="security-faq">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="security-faq"
            eyebrow="Questions"
            title="The technical questions, answered plainly"
          />
          <FaqList items={SECURITY_FAQ} />
        </div>
      </section>

      <section style={landingStyles.section}>
        <div style={landingStyles.inner}>
          <SectionHeading
            eyebrow="Next"
            title="Satisfied? Start small"
            lede="Sign in, set an allowance, and put in an amount you would not mind waiting for. Everything above is checkable before a single dollar is at stake."
          />
          <div style={homeStyles.pageCtaRow}>
            <LandingLink href="/" internal style={landingStyles.ctaPrimary}>
              Start saving
            </LandingLink>
            <LandingLink href={BEGINNER_GUIDE_PATH} style={landingStyles.ctaSecondary}>
              Read the beginner&apos;s guide
            </LandingLink>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SecurityPage;
