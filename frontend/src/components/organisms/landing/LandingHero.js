import React from "react";

import Icon from "../../atoms/Icon.js";
import EnforcementConsole from "./EnforcementConsole.js";

import { landingStyles } from "../../../styles";

/**
 * LandingHero - the thesis. The headline names who the wallet protects you
 * from, and the console underneath demonstrates it refusing a withdrawal
 * before the visitor has connected anything.
 */
const LandingHero = ({ onLaunch, onUseOwnWallet }) => (
  <section style={landingStyles.hero}>
    <div style={landingStyles.heroGlow} aria-hidden="true" />

    <div style={landingStyles.heroCopy}>
      <span style={landingStyles.badge}>
        <Icon name="shield" size={13} />
        TIME-LOCKED ON-CHAIN WALLET
      </span>

      <h1 style={landingStyles.heroTitle}>
        Protect your savings from everyone.
        <br />
        <span style={landingStyles.heroAccent}>Even yourself.</span>
      </h1>

      <p style={landingStyles.heroSubtitle}>
        Set withdrawal limits. Wallet enforces it on-chain.
      </p>

      <div style={landingStyles.ctaRowCenter}>
        <button
          type="button"
          style={landingStyles.ctaPrimary}
          onClick={onLaunch}
        >
          Sign in — it&apos;s free
        </button>
        <a href="#compare" style={landingStyles.ctaSecondary}>
          See the comparison
        </a>
      </div>

      {onUseOwnWallet && (
        <button
          type="button"
          style={landingStyles.ctaAlternate}
          onClick={onUseOwnWallet}
        >
          Already have a wallet? Connect it
        </button>
      )}
    </div>

    <EnforcementConsole />
  </section>
);

export default LandingHero;
