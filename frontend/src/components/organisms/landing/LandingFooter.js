import React from "react";

import LandingLink from "../../atoms/LandingLink.js";

import logo from "../../../assets/images/logo-mint-nav.png";

import { landingStyles } from "../../../styles";

import {
  FOOTER_COLUMNS,
  FOOTER_BLURB,
  FOOTER_LEGAL,
} from "../../../utils/landingContent.js";

/**
 * LandingFooter - the "Verify" column is deliberately first-class: the fastest
 * route from this page to the source is part of the product's argument.
 */
const LandingFooter = () => (
  <>
    <footer style={landingStyles.footer}>
      <div>
        <img
          src={logo}
          alt="LockIn Wallet"
          style={landingStyles.brandLogoFooter}
        />
        <p style={landingStyles.footerBlurb}>{FOOTER_BLURB}</p>
      </div>

      <div style={landingStyles.footerColumns}>
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title}>
            <div style={landingStyles.footerColTitle}>{column.title}</div>
            <div style={landingStyles.footerLinks}>
              {column.links.map((link) => (
                <LandingLink
                  key={link.label}
                  href={link.href}
                  internal={link.internal}
                  external={link.external}
                  style={landingStyles.footerLink}
                >
                  {link.label}
                </LandingLink>
              ))}
            </div>
          </div>
        ))}
      </div>
    </footer>

    <div className="landing-basebar" style={landingStyles.footerBase}>
      © {new Date().getFullYear()} LockIn Wallet. {FOOTER_LEGAL}
    </div>
  </>
);

export default LandingFooter;
