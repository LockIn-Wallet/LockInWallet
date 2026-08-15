import React from "react";

import SectionHeading from "../atoms/SectionHeading.js";
import LandingLink from "../atoms/LandingLink.js";

import { usePageSeo } from "../../hooks/usePageSeo.js";

import { homeStyles, landingStyles } from "../../styles";

import {
  PASSKEY_SEO,
  PASSKEY_HERO,
  PASSKEY_BASICS,
  PASSKEY_MECHANISM,
  PASSKEY_DEVICES,
  PASSKEY_RECOVERY,
  PASSKEY_FAQ,
} from "../../utils/passkeyContent.js";

/**
 * PasskeyGuide — /passkeys
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
const PasskeyGuide = () => {
  usePageSeo(PASSKEY_SEO);

  return (
    <div style={landingStyles.page}>
      <header style={landingStyles.sectionFlush}>
        <div style={landingStyles.inner}>
          <p style={landingStyles.eyebrow}>{PASSKEY_HERO.eyebrow}</p>
          <h1 style={homeStyles.pageTitle}>{PASSKEY_HERO.title}</h1>
          <p style={homeStyles.pageLede}>{PASSKEY_HERO.lede}</p>
        </div>
      </header>

      <section style={landingStyles.section} aria-labelledby="passkey-basics">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="passkey-basics"
            eyebrow="The short version"
            title="No password, no seed phrase, nothing to lose down the back of a drawer"
            lede="If you already unlock your phone with your face or your thumb, you have used a passkey. This is the same thing, holding your savings instead of your phone."
          />
          <div style={homeStyles.stepsRow}>
            {PASSKEY_BASICS.map(({ emoji, title, text }) => (
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

      <section style={landingStyles.section} aria-labelledby="passkey-mechanism">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="passkey-mechanism"
            eyebrow="How it works"
            title="Two halves, and only one of them ever leaves"
            lede="You do not need this to use the wallet. It is here because a claim you cannot check is worth very little."
          />
          <ol style={homeStyles.orderedList}>
            {PASSKEY_MECHANISM.map(({ step, text }, index) => (
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

      <section style={landingStyles.section} aria-labelledby="passkey-devices">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="passkey-devices"
            eyebrow="More than one device"
            title="Your phone, your laptop, and the one you buy next year"
            lede="A passkey is not stuck on the device that made it. In most cases it follows you without you doing anything."
          />
          <div style={homeStyles.stepsRow}>
            {PASSKEY_DEVICES.map(({ emoji, title, text }) => (
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

      <section style={landingStyles.section} aria-labelledby="passkey-recovery">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="passkey-recovery"
            eyebrow="If you lose your phone"
            title="Three ways back in, in the order to try them"
            lede="Losing a phone is the question everybody asks first, and it deserves a real answer rather than reassurance."
          />
          <ol style={homeStyles.orderedList}>
            {PASSKEY_RECOVERY.map(({ step, text }, index) => (
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
            The one case none of this covers: no synced account, no second
            device, and no recovery key. Adding a second device takes a minute
            and is worth doing today rather than on the day you need it.
          </p>
        </div>
      </section>

      <section style={landingStyles.section} aria-labelledby="passkey-faq">
        <div style={landingStyles.inner}>
          <SectionHeading
            id="passkey-faq"
            eyebrow="Questions"
            title="Passkeys, answered plainly"
          />
          <div style={homeStyles.faqList}>
            {PASSKEY_FAQ.map(({ question, answer }) => (
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

export default PasskeyGuide;
