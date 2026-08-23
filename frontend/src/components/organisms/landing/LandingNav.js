import React from "react";

import LandingLink from "../../atoms/LandingLink.js";

import logo from "../../../assets/images/logo-mint-nav.png";

import { landingStyles } from "../../../styles";

import { NAV_LINKS, GITHUB_URL } from "../../../utils/landingContent.js";
import { isLinkVisible } from "../../../utils/featureFlags.js";

/**
 * LandingNav - top bar for the logged-out pages. The GitHub link is set in
 * mono because it points at the machine-readable version of every claim
 * below it. /crypto passes its own links and button label; the main page
 * gets the plain-language defaults.
 */
const LandingNav = ({ onLaunch, links = NAV_LINKS, ctaLabel = "Sign in" }) => (
  <nav style={landingStyles.nav}>
    <LandingLink href="/" internal style={landingStyles.brand}>
      <img src={logo} alt="LockIn" style={landingStyles.brandLogo} />
    </LandingLink>

    <div className="landing-nav-links" style={landingStyles.navLinks}>
      {links.filter(isLinkVisible).map((link) => (
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
      {ctaLabel}
    </button>
  </nav>
);

export default LandingNav;
