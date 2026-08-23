import React from "react";

import Icon from "../../atoms/Icon.js";
import LandingLink from "../../atoms/LandingLink.js";
import SectionHeading from "../../atoms/SectionHeading.js";

import { landingStyles } from "../../../styles";

import {
  MONEY_SECTION,
  UPGRADE_DISCLOSURE,
  SECURITY_URL,
  CRYPTO_PATH,
} from "../../../utils/landingContent.js";

/**
 * MoneySection - "where your money actually is", in plain words. The section
 * ends with the one thing we can still do, stated on the page rather than
 * buried in a doc: a trust section that only lists strengths reads as
 * marketing.
 */
const MoneySection = () => (
  <section id="security" style={landingStyles.section}>
    <div style={landingStyles.inner}>
      <SectionHeading
        eyebrow={MONEY_SECTION.eyebrow}
        title={MONEY_SECTION.title}
        lede={MONEY_SECTION.intro}
      />

      <div style={landingStyles.featureGrid}>
        {MONEY_SECTION.points.map((point) => (
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

      <p style={landingStyles.footnote}>
        <LandingLink
          href={CRYPTO_PATH}
          internal
          style={landingStyles.disclosureLink}
        >
          {MONEY_SECTION.cryptoLink} →
        </LandingLink>
      </p>
    </div>
  </section>
);

export default MoneySection;
