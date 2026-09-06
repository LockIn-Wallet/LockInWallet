import React from "react";

import SectionHeading from "../atoms/SectionHeading.js";
import LandingLink from "../atoms/LandingLink.js";
import FaqList from "../molecules/FaqList.js";

import { usePageSeo } from "../../hooks/usePageSeo.js";

import { homeStyles, landingStyles } from "../../styles";

import {
  PROOF_OF_LOCK_SEO,
  PROOF_OF_LOCK_HERO,
  PROOF_OF_LOCK_STEPS,
  PROOF_OF_LOCK_FAQ,
  PROOF_GUARANTEES,
} from "../../utils/lockContent.js";
import { SECURITY_PAGE_PATH } from "../../utils/securityPageContent.js";

/**
 * ProofOfLock — /proof-of-lock
 *
 * The creators' front door. A different audience from the savings visitor:
 * they are not managing their own spending, they are proving something to
 * other people. So the page leads with the proof and says plainly what it
 * does and does not demonstrate.
 */
const ProofOfLock = () => {
  usePageSeo(PROOF_OF_LOCK_SEO);

  return (
    <div style={landingStyles.page}>
      <header style={landingStyles.sectionFlush}>
        <div style={landingStyles.inner}>
          <p style={landingStyles.eyebrow}>{PROOF_OF_LOCK_HERO.eyebrow}</p>
          <h1 style={homeStyles.pageTitle}>{PROOF_OF_LOCK_HERO.title}</h1>
          <p style={homeStyles.pageLede}>{PROOF_OF_LOCK_HERO.lede}</p>
          <div style={{ ...homeStyles.pageCtaRow, marginTop: landingStyles.sectionHead.marginBottom }}>
            <LandingLink href="/" internal style={landingStyles.ctaPrimary}>
              Create a lock
            </LandingLink>
            <LandingLink href={SECURITY_PAGE_PATH} internal style={landingStyles.ctaSecondary}>
              How it is enforced
            </LandingLink>
          </div>
        </div>
      </header>

      <section style={landingStyles.section} aria-labelledby="proof-steps">
        <div style={landingStyles.inner}>
          <SectionHeading id="proof-steps" eyebrow="Three steps" title="Lock, fund, share" />
          <div style={homeStyles.stepsRow}>
            {PROOF_OF_LOCK_STEPS.map(({ emoji, title, text }) => (
              <article key={title} style={homeStyles.stepCard}>
                <div style={homeStyles.stepEmoji} aria-hidden="true">
                  {emoji}
                </div>
                <h3 style={homeStyles.stepCardTitle}>{title}</h3>
                <p style={homeStyles.stepText}>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={landingStyles.section} aria-labelledby="proof-guarantees">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="proof-guarantees"
            eyebrow="What the page proves"
            title="Four things anyone can check"
          />
          <FaqList items={PROOF_GUARANTEES.map(({ title, text }) => ({ question: title, answer: text }))} />
        </div>
      </section>

      <section style={landingStyles.section} aria-labelledby="proof-faq">
        <div style={landingStyles.inner}>
          <SectionHeading id="proof-faq" eyebrow="Questions" title="Asked before locking" />
          <FaqList items={PROOF_OF_LOCK_FAQ} />
        </div>
      </section>
    </div>
  );
};

export default ProofOfLock;
