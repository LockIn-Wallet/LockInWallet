import React from "react";

import LandingLink from "../../atoms/LandingLink.js";

import logo from "../../../assets/images/logo-mint-nav.png";

import { landingStyles } from "../../../styles";

import { NAV_LINKS, GITHUB_URL } from "../../../utils/landingContent.js";
import { isLinkVisible } from "../../../utils/featureFlags.js";

/**
 * LandingNav - top bar for the logged-out page. The GitHub link is set in
 * mono because it points at the machine-readable version of every claim
 * below it.
 */
const LandingNav = ({ onLaunch }) => (
  <nav style={landingStyles.nav}>
    <LandingLink href="/" internal style={landingStyles.brand}>
      <img src={logo} alt="LockIn Wallet" style={landingStyles.brandLogo} />
    </LandingLink>

    <div className="landing-nav-links" style={landingStyles.navLinks}>
      {NAV_LINKS.filter(isLinkVisible).map((link) => (
        <LandingLink
          key={link.label}
          href={link.href}
          internal={link.internal}
          style={landingStyles.navLink}
        >
          {link.label}
        </LandingLink>
      ))}
      <span style={landingStyles.navDivider} aria-hidden="true" />
      <LandingLink href={GITHUB_URL} external style={landingStyles.navMono}>
        GitHub →
      </LandingLink>
    </div>

    <button type="button" style={landingStyles.ctaCompact} onClick={onLaunch}>
      Sign in
    </button>
  </nav>
);

export default LandingNav;
