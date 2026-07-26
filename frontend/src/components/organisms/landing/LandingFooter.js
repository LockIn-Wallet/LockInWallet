import React from "react";

import Icon from "../../atoms/Icon.js";
import LandingLink from "../../atoms/LandingLink.js";

import { landingStyles } from "../../../styles";

import { FOOTER_COLUMNS } from "../../../utils/landingContent.js";

/**
 * LandingFooter - the "Verify" column is deliberately first-class: the fastest
 * route from this page to the source is part of the product's argument.
 */
const LandingFooter = () => (
  <>
    <footer style={landingStyles.footer}>
      <div>
        <span style={landingStyles.brand}>
          <span style={landingStyles.brandMark}>
            <Icon name="lock" size={15} />
          </span>
          <span style={landingStyles.brandName}>LockIn</span>
        </span>
        <p style={landingStyles.footerBlurb}>
          A commitment savings account whose withdrawal limits are enforced by
          smart contracts, not by good intentions.
        </p>
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
      © {new Date().getFullYear()} LockIn Wallet. Self-custodial software, not
      financial advice.
    </div>
  </>
);

export default LandingFooter;
