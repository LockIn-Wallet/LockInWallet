import React from "react";

import SectionHeading from "../atoms/SectionHeading.js";
import LandingLink from "../atoms/LandingLink.js";
import FaqList from "../molecules/FaqList.js";
import PrizeSavingsShowcase from "../organisms/PrizeSavingsShowcase.js";
import DepositOutcomeSlider from "../molecules/DepositOutcomeSlider.js";

import { usePageSeo } from "../../hooks/usePageSeo.js";

import { homeStyles, landingStyles } from "../../styles";

import {
  PRIZE_SAVINGS_SEO,
  PRIZE_HERO,
  PRIZE_FAQ,
  PRIZE_SIMULATION,
} from "../../utils/prizeSavingsContent.js";

/**
 * PrizeSavings — /prize-savings
 *
 * The no-loss prize pool, lifted off the homepage into a page that can be
 * linked, indexed and shared on its own. Order follows what a reader needs:
 * the promise, the mechanism, a simulation they can drive, then the questions
 * that decide whether they opt in.
 */
const PrizeSavings = () => {
  usePageSeo(PRIZE_SAVINGS_SEO);

  return (
    <div style={landingStyles.page}>
      <header style={landingStyles.sectionFlush}>
        <div style={landingStyles.inner}>
          <p style={landingStyles.eyebrow}>{PRIZE_HERO.eyebrow}</p>
          <h1 style={homeStyles.pageTitle}>{PRIZE_HERO.title}</h1>
          <p style={homeStyles.pageLede}>{PRIZE_HERO.lede}</p>
        </div>
      </header>

      <section style={landingStyles.section} aria-labelledby="how-prize-savings-works">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="how-prize-savings-works"
            eyebrow="How it works"
            title="Your interest buys the tickets, your deposit never does"
            lede="Opt in and your locked savings join a shared pool. The pool earns yield, and that yield is drawn as prizes hourly, daily and weekly."
          />
          <PrizeSavingsShowcase />
        </div>
      </section>

      <section style={landingStyles.section} aria-labelledby="prize-simulation">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="prize-simulation"
            eyebrow={PRIZE_SIMULATION.eyebrow}
            title={PRIZE_SIMULATION.title}
            lede={PRIZE_SIMULATION.lede}
          />
          <DepositOutcomeSlider />
          <p style={landingStyles.footnote}>
            Figures are illustrative, based on a ~4% pool yield. Real prizes
            depend on live pool size and yield, and nothing here is financial
            advice.
          </p>
        </div>
      </section>

      <section style={landingStyles.section} aria-labelledby="prize-savings-faq">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="prize-savings-faq"
            eyebrow="Questions"
            title="No-loss prize savings, answered"
          />
          <FaqList items={PRIZE_FAQ} />
        </div>
      </section>

      <section style={landingStyles.section}>
        <div style={landingStyles.inner}>
          <SectionHeading
            eyebrow="Next"
            title="Prizes are the upside — the lock is the point"
            lede="Prize savings sits on top of a wallet built to make your money hard to take and hard to spend on impulse."
          />
          <div style={homeStyles.pageCtaRow}>
            <LandingLink href="/" internal style={landingStyles.ctaPrimary}>
              How LockIn Wallet works
            </LandingLink>
            <LandingLink
              href="/savings-visualiser"
              internal
              style={landingStyles.ctaSecondary}
            >
              Savings Visualiser →
            </LandingLink>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PrizeSavings;
