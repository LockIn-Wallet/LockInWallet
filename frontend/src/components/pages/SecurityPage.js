import React from "react";

import SectionHeading from "../atoms/SectionHeading.js";
import LandingLink from "../atoms/LandingLink.js";

import ProofStrip from "../organisms/landing/ProofStrip.js";
import WalletComparison from "../organisms/landing/WalletComparison.js";
import TrustGrid from "../organisms/landing/TrustGrid.js";
import ChainAvailability from "../organisms/ChainAvailability.js";

import { usePageSeo } from "../../hooks/usePageSeo.js";

import { homeStyles, landingStyles } from "../../styles";

import {
  SECURITY_SEO,
  SECURITY_HERO,
  MECHANISM_STEPS,
  CHAIN_INTRO,
  SECURITY_FAQ,
} from "../../utils/securityContent.js";
import { GITHUB_URL } from "../../utils/siteLinks.js";

/**
 * SecurityPage — /security
 *
 * Everything the landing page leaves out, for the two readers it cannot serve:
 * somebody comparing wallets, and somebody who assumes a page that simple is
 * hiding something. Ordered by what a sceptic asks rather than what sells —
 * mechanism, numbers, comparison (categories defined first, or the table is
 * noise), trust model including what we can still do, then where it runs.
 */
const SecurityPage = () => {
  usePageSeo(SECURITY_SEO);

  return (
    <div style={landingStyles.page}>
      <header style={landingStyles.sectionFlush}>
        <div style={landingStyles.inner}>
          <p style={landingStyles.eyebrow}>{SECURITY_HERO.eyebrow}</p>
          <h1 style={homeStyles.pageTitle}>{SECURITY_HERO.title}</h1>
          <p style={homeStyles.pageLede}>{SECURITY_HERO.lede}</p>
        </div>
      </header>

      <section style={landingStyles.section} aria-labelledby="mechanism">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="mechanism"
            eyebrow="The mechanism"
            title="Four rules, enforced by the contract"
          />
          <div style={landingStyles.featureGrid}>
            {MECHANISM_STEPS.map(({ title, body }) => (
              <article key={title} style={landingStyles.featureCard}>
                <h3 style={landingStyles.featureTitle}>{title}</h3>
                <p style={landingStyles.featureBody}>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ProofStrip />

      <WalletComparison />

      <TrustGrid />

      <section style={landingStyles.section} aria-labelledby="chains">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="chains"
            eyebrow={CHAIN_INTRO.eyebrow}
            title={CHAIN_INTRO.title}
            lede={CHAIN_INTRO.lede}
          />
          <ChainAvailability />
        </div>
      </section>

      <section style={landingStyles.section} aria-labelledby="security-faq">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="security-faq"
            eyebrow="Questions"
            title="Answered plainly"
          />
          <div style={homeStyles.faqList}>
            {SECURITY_FAQ.map(({ question, answer }) => (
              <article key={question} style={homeStyles.faqItem}>
                <h3 style={homeStyles.faqQuestion}>{question}</h3>
                <p style={homeStyles.faqAnswer}>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={landingStyles.section}>
        <div style={landingStyles.inner}>
          <SectionHeading
            eyebrow="Next"
            title="Read it, or start using it"
            lede="Every claim above is enforced by code you can read."
          />
          <div style={homeStyles.pageCtaRow}>
            <LandingLink href="/" internal style={landingStyles.ctaPrimary}>
              Start saving
            </LandingLink>
            <LandingLink
              href={GITHUB_URL}
              external
              style={landingStyles.ctaSecondary}
            >
              Read the contracts
            </LandingLink>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SecurityPage;
