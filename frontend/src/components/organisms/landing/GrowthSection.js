import React from "react";

import LandingLink from "../../atoms/LandingLink.js";
import SectionHeading from "../../atoms/SectionHeading.js";

import { landingStyles } from "../../../styles";

import { GROWTH, CRYPTO_PATH } from "../../../utils/landingContent.js";

/**
 * GrowthSection - the optional-earning choice, two cards with equal visual
 * weight in neutral order. Neither card quotes a rate: the live one belongs
 * in the app, next to the decision.
 */
const GrowthSection = () => (
  <section style={landingStyles.section}>
    <div style={landingStyles.inner}>
      <SectionHeading
        eyebrow={GROWTH.eyebrow}
        title={GROWTH.title}
        lede={GROWTH.intro}
      />

      <div style={landingStyles.featureGrid}>
        {GROWTH.options.map((option) => (
          <article key={option.title} style={landingStyles.featureCard}>
            <h3 style={landingStyles.featureTitle}>{option.title}</h3>
            <p style={landingStyles.featureBody}>{option.body}</p>
          </article>
        ))}
      </div>

      <p style={landingStyles.footnote}>
        {GROWTH.caption}{" "}
        <LandingLink
          href={CRYPTO_PATH}
          internal
          style={landingStyles.disclosureLink}
        >
          The crypto page →
        </LandingLink>
      </p>
    </div>
  </section>
);

export default GrowthSection;
