import React from "react";

import Icon from "../../atoms/Icon.js";
import LandingLink from "../../atoms/LandingLink.js";
import EnforcementConsole from "./EnforcementConsole.js";

import { landingStyles } from "../../../styles";

import { HERO } from "../../../utils/landingContent.js";

/**
 * LandingHero - the thesis, in words that need no prior knowledge of crypto.
 * The headline names who the wallet protects you from, the subtitle states the
 * guarantee, and the console underneath demonstrates it refusing a withdrawal
 * before the visitor has connected anything. The secondary call to action
 * leads to the technical page rather than deeper into this one: a reader who
 * wants the mechanism should get all of it, and everyone else should not have
 * to walk past it.
 */
const LandingHero = ({ onLaunch }) => (
  <section style={landingStyles.hero}>
    <div style={landingStyles.heroGlow} aria-hidden="true" />

    <div style={landingStyles.heroCopy}>
      <span style={landingStyles.badge}>
        <Icon name="shield" size={13} />
        {HERO.badge}
      </span>

      <h1 style={landingStyles.heroTitle}>
        {HERO.title}
        <br />
        <span style={landingStyles.heroAccent}>{HERO.titleAccent}</span>
      </h1>

      <p style={landingStyles.heroSubtitle}>{HERO.subtitle}</p>

      <div style={landingStyles.ctaRowCenter}>
        <button
          type="button"
          style={landingStyles.ctaPrimary}
          onClick={onLaunch}
        >
          {HERO.primaryCta}
        </button>
        <LandingLink
          href={HERO.secondaryCtaHref}
          internal
          style={landingStyles.ctaSecondary}
        >
          {HERO.secondaryCta}
        </LandingLink>
      </div>
    </div>

    <EnforcementConsole />

    <p style={landingStyles.heroCaption}>{HERO.consoleCaption}</p>
  </section>
);

export default LandingHero;
