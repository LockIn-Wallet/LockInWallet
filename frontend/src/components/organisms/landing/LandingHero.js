import React from "react";

import Icon from "../../atoms/Icon.js";
import EnforcementConsole from "./EnforcementConsole.js";

import { landingStyles } from "../../../styles";

/**
 * LandingHero - the thesis. The headline names who the wallet protects you
 * from, and the console underneath demonstrates it refusing a withdrawal
 * before the visitor has connected anything.
 */
const LandingHero = ({ onLaunch }) => (
  <section style={landingStyles.hero}>
    <div style={landingStyles.heroGlow} aria-hidden="true" />

    <div style={landingStyles.heroCopy}>
      <span style={landingStyles.badge}>
        <Icon name="shield" size={13} />
        TIME-LOCK WALLET
      </span>

      <h1 style={landingStyles.heroTitle}>
        Protect your savings from everyone.
        <br />
        <span style={landingStyles.heroAccent}>Even yourself.</span>
      </h1>

      <p style={landingStyles.heroSubtitle}>
        Set withdrawal limits. From then on a contract enforces it and bypassing the limits require 24.
      </p>

      <div style={landingStyles.ctaRowCenter}>
        <button
          type="button"
          style={landingStyles.ctaPrimary}
          onClick={onLaunch}
        >
          Connect wallet — it&apos;s free
        </button>
        <a href="#compare" style={landingStyles.ctaSecondary}>
          See the comparison
        </a>
      </div>
    </div>

    <EnforcementConsole />
  </section>
);

export default LandingHero;
