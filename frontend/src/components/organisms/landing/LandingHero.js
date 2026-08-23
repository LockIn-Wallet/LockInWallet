import React from "react";

import Icon from "../../atoms/Icon.js";

import { landingStyles } from "../../../styles";

/**
 * LandingHero - the thesis, shared by the main page and /crypto. Each page
 * passes its own copy and its own proof widget as children, so the two heroes
 * stay one layout with two voices.
 */
const LandingHero = ({ content, onLaunch, children }) => (
  <section style={landingStyles.hero}>
    <div style={landingStyles.heroGlow} aria-hidden="true" />

    <div style={landingStyles.heroCopy}>
      <span style={landingStyles.badge}>
        <Icon name="shield" size={13} />
        {content.badge}
      </span>

      <h1 style={landingStyles.heroTitle}>
        {content.titleStart}
        <br />
        <span style={landingStyles.heroAccent}>{content.titleAccent}</span>
      </h1>

      <p style={landingStyles.heroSubtitle}>{content.subtitle}</p>

      <div style={landingStyles.ctaRowCenter}>
        <button
          type="button"
          style={landingStyles.ctaPrimary}
          onClick={onLaunch}
        >
          {content.ctaPrimary}
        </button>
        <a href={content.ctaSecondaryHref} style={landingStyles.ctaSecondary}>
          {content.ctaSecondary}
        </a>
      </div>

      {content.note && <p style={landingStyles.heroNote}>{content.note}</p>}
    </div>

    {children}
  </section>
);

export default LandingHero;
