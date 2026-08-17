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
  HOW_IT_WORKS_SEO,
  HOW_IT_WORKS_HERO,
  MECHANISM_STEPS,
  CHAIN_INTRO,
  HOW_IT_WORKS_FAQ,
} from "../../utils/howItWorksContent.js";
import { GITHUB_URL } from "../../utils/siteLinks.js";

/**
 * HowItWorksPage — /how-it-works
 *
 * The landing page deliberately says one thing and stops. This page is where
 * the rest goes, for the two readers that page cannot serve: somebody deciding
 * between wallets, and somebody who already holds crypto and reasonably
 * assumes a page this simple is hiding something.
 *
 * So the order is what a sceptic asks, not what sells: the mechanism first,
 * then the numbers, then the comparison — with its categories defined, because
 * a comparison table is noise to anyone who does not already know what it is
 * comparing against — then the trust model including what we can still do, and
 * only then where it runs.
 */
const HowItWorksPage = () => {
  usePageSeo(HOW_IT_WORKS_SEO);

  return (
    <div style={landingStyles.page}>
      <header style={landingStyles.sectionFlush}>
        <div style={landingStyles.inner}>
          <p style={landingStyles.eyebrow}>{HOW_IT_WORKS_HERO.eyebrow}</p>
          <h1 style={homeStyles.pageTitle}>{HOW_IT_WORKS_HERO.title}</h1>
          <p style={homeStyles.pageLede}>{HOW_IT_WORKS_HERO.lede}</p>
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

      <section style={landingStyles.section} aria-labelledby="how-it-works-faq">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="how-it-works-faq"
            eyebrow="Questions"
            title="Answered without hedging"
          />
          <div style={homeStyles.faqList}>
            {HOW_IT_WORKS_FAQ.map(({ question, answer }) => (
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
            lede="Nothing on this page has to be taken on trust — the contracts that enforce every claim above are public."
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

export default HowItWorksPage;
