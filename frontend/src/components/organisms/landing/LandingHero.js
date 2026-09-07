import React from "react";

import Icon from "../../atoms/Icon.js";

import { landingStyles } from "../../../styles";

import { HOME_HERO } from "../../../utils/landingContent.js";

/**
 * LandingHero - the thesis, in the words of the search that brings people
 * here. Nothing technical: the headline says what the account does and the
 * lede says the one rule that makes it work.
 */
const LandingHero = ({ onLaunch }) => (
  <section style={landingStyles.heroStandalone}>
    <div style={landingStyles.heroGlow} aria-hidden="true" />

    <div style={landingStyles.heroCopy}>
      <span style={landingStyles.badge}>
        <Icon name="lock" size={13} />
        {HOME_HERO.badge}
      </span>

      <h1 style={landingStyles.heroTitle}>
        {HOME_HERO.title}
        <br />
        <span style={landingStyles.heroAccent}>{HOME_HERO.accent}</span>
      </h1>

      <p style={landingStyles.heroSubtitle}>{HOME_HERO.lede}</p>

      <div style={landingStyles.ctaRowCenter}>
        <button
          type="button"
          style={landingStyles.ctaPrimary}
          onClick={onLaunch}
        >
          {HOME_HERO.primaryCta}
        </button>
        <a href="#how-it-works" style={landingStyles.ctaSecondary}>
          {HOME_HERO.secondaryCta}
        </a>
      </div>
    </div>
  </section>
);

export default LandingHero;
