import React from "react";

import SectionHeading from "../atoms/SectionHeading.js";
import LandingLink from "../atoms/LandingLink.js";
import FaqList from "../molecules/FaqList.js";

import { usePageSeo } from "../../hooks/usePageSeo.js";

import { homeStyles, landingStyles } from "../../styles";

import {
  SIGNING_IN_SEO,
  SIGNING_IN_HERO,
  SIGNING_IN_BASICS,
  SIGNING_IN_METHODS,
  SIGNING_IN_DEVICES,
  SIGNING_IN_RECOVERY,
  SIGNING_IN_FAQ,
  COINBASE_SIGN_IN_HELP,
} from "../../utils/signingInContent.js";

/**
 * SigningInGuide — /signing-in
 *
 * Signing in without a seed phrase is the least familiar thing this wallet
 * asks of a newcomer, and "trust us, it's fine" is not an answer. So the page
 * exists to be read before there is money at stake, and links to from the one
 * screen where somebody is choosing.
 *
 * The order is what a worried person actually asks, in the order they ask it:
 * what is this, how does it work, will it be on my other devices, and what
 * happens when I lose my phone. The recovery section is the reason the page
 * exists, so nothing is allowed to push it below the fold of attention.
 */
const SigningInGuide = () => {
  usePageSeo(SIGNING_IN_SEO);

  return (
    <div style={landingStyles.page}>
      <header style={landingStyles.sectionFlush}>
        <div style={landingStyles.inner}>
          <p style={landingStyles.eyebrow}>{SIGNING_IN_HERO.eyebrow}</p>
          <h1 style={homeStyles.pageTitle}>{SIGNING_IN_HERO.title}</h1>
          <p style={homeStyles.pageLede}>{SIGNING_IN_HERO.lede}</p>
        </div>
      </header>

      <section style={landingStyles.section} aria-labelledby="signing-in-basics">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="signing-in-basics"
            eyebrow="The short version"
            title="No password, no seed phrase, nothing to lose down the back of a drawer"
            lede="You press sign in, prove it is you the way you already do elsewhere, and your savings are there. Which way you prove it depends on your device."
          />
          <div style={homeStyles.stepsRow}>
            {SIGNING_IN_BASICS.map(({ emoji, title, text }) => (
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

      <section style={landingStyles.section} aria-labelledby="signing-in-methods">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="signing-in-methods"
            eyebrow="The two ways in"
            title="One of them tells Coinbase who you are"
            lede="Coinbase runs the sign-in and offers what your device supports, so we cannot promise you one or the other. The difference between them is worth a minute of your time."
          />
          <ol style={homeStyles.orderedList}>
            {SIGNING_IN_METHODS.map(({ step, text }, index) => (
              <li key={step} style={homeStyles.orderedItem}>
                <span style={homeStyles.orderedNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3 style={homeStyles.orderedTitle}>{step}</h3>
                  <p style={homeStyles.orderedText}>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section style={landingStyles.section} aria-labelledby="signing-in-devices">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="signing-in-devices"
            eyebrow="More than one device"
            title="Your phone, your laptop, and the one you buy next year"
            lede="Your savings live on a public network, not on any device — so getting to them elsewhere is only a question of signing in again."
          />
          <div style={homeStyles.stepsRow}>
            {SIGNING_IN_DEVICES.map(({ emoji, title, text }) => (
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

      <section style={landingStyles.section} aria-labelledby="signing-in-recovery">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="signing-in-recovery"
            eyebrow="If you lose your phone"
            title="Three ways back in, in the order to try them"
            lede="This is the question everybody asks first, and it deserves a real answer rather than reassurance."
          />
          <ol style={homeStyles.orderedList}>
            {SIGNING_IN_RECOVERY.map(({ step, text }, index) => (
              <li key={step} style={homeStyles.orderedItem}>
                <span style={homeStyles.orderedNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3 style={homeStyles.orderedTitle}>{step}</h3>
                  <p style={homeStyles.orderedText}>{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p style={landingStyles.footnote}>
            The one case none of this covers: no access to your email, no
            synced passkey, and no recovery key. Adding a second way in takes a
            minute, and is worth doing today rather than on the day you need it.
            Coinbase manages the sign-in methods themselves — their guide is{" "}
            <a href={COINBASE_SIGN_IN_HELP} target="_blank" rel="noopener noreferrer">
              here
            </a>
            .
          </p>
        </div>
      </section>

      <section style={landingStyles.section} aria-labelledby="signing-in-faq">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="signing-in-faq"
            eyebrow="Questions"
            title="Signing in, answered plainly"
          />
          <FaqList items={SIGNING_IN_FAQ} />
        </div>
      </section>

      <section style={landingStyles.section}>
        <div style={landingStyles.inner}>
          <SectionHeading
            eyebrow="Next"
            title="Ready when you are"
            lede="Signing in takes one tap and costs nothing. You can add a second device, or your own wallet, whenever you like."
          />
          <div style={homeStyles.pageCtaRow}>
            <LandingLink href="/" internal style={landingStyles.ctaPrimary}>
              Start saving
            </LandingLink>
            <LandingLink
              href="/prize-savings"
              internal
              style={landingStyles.ctaSecondary}
            >
              See prize savings
            </LandingLink>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SigningInGuide;
