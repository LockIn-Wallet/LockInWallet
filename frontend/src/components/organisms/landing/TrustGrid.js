import React from "react";

import Icon from "../../atoms/Icon.js";
import LandingLink from "../../atoms/LandingLink.js";
import SectionHeading from "../../atoms/SectionHeading.js";

import { landingStyles } from "../../../styles";

import {
  TRUST_POINTS,
  UPGRADE_DISCLOSURE,
  SECURITY_URL,
} from "../../../utils/landingContent.js";

/**
 * TrustGrid - the protections that are live on-chain today, followed by the
 * one thing we can still do. Naming the remaining trust assumption on the
 * page is the point: a security section that only lists strengths reads as
 * marketing.
 */
const TrustGrid = () => (
  <section id="security" style={landingStyles.section}>
    <div style={landingStyles.inner}>
      <SectionHeading
        eyebrow="Verify, don't trust"
        title="Nothing here asks for your faith"
      />

      <div style={landingStyles.featureGrid}>
        {TRUST_POINTS.map((point) => (
          <article key={point.title} style={landingStyles.featureCard}>
            <span style={landingStyles.iconTile}>
              <Icon name={point.icon} />
            </span>
            <h3 style={landingStyles.featureTitle}>{point.title}</h3>
            <p style={landingStyles.featureBody}>{point.body}</p>
          </article>
        ))}
      </div>

      <div style={landingStyles.disclosureCard}>
        <p style={landingStyles.disclosureEyebrow}>
          {UPGRADE_DISCLOSURE.eyebrow}
        </p>
        <h3 style={landingStyles.featureTitle}>{UPGRADE_DISCLOSURE.title}</h3>
        <p style={landingStyles.featureBody}>{UPGRADE_DISCLOSURE.body}</p>
        <LandingLink
          href={SECURITY_URL}
          external
          style={landingStyles.disclosureLink}
        >
          {UPGRADE_DISCLOSURE.linkLabel} →
        </LandingLink>
      </div>
    </div>
  </section>
);

export default TrustGrid;
