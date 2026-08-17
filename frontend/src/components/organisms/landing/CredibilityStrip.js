import React from "react";

import LandingLink from "../../atoms/LandingLink.js";

import { landingStyles } from "../../../styles";

import { CREDIBILITY } from "../../../utils/landingContent.js";

/**
 * CredibilityStrip - the rest of the landing page is written for somebody who
 * has never held crypto, which is exactly the register a scam is written in.
 * This block is the correction: no adjectives, the remaining trust assumption
 * named out loud, and three links that lead out of the marketing and into the
 * source. It is the shortest section on the page and the one a sceptic reads
 * first.
 */
const CredibilityStrip = () => (
  <section style={landingStyles.section}>
    <div style={landingStyles.inner}>
      <div style={landingStyles.credibilityCard}>
        <h2 style={landingStyles.credibilityTitle}>{CREDIBILITY.title}</h2>
        <p style={landingStyles.credibilityBody}>{CREDIBILITY.body}</p>

        <div style={landingStyles.credibilityLinks}>
          {CREDIBILITY.links.map((link) => (
            <LandingLink
              key={link.label}
              href={link.href}
              internal={link.internal}
              external={link.external}
              style={landingStyles.credibilityLink}
            >
              {link.label} →
            </LandingLink>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default CredibilityStrip;
