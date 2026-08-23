import React from "react";

import LandingLink from "../../atoms/LandingLink.js";
import SectionHeading from "../../atoms/SectionHeading.js";

import { landingStyles } from "../../../styles";

import { WHO_ITS_FOR } from "../../../utils/landingContent.js";

/**
 * WhoItsFor - three situations in the reader's own words. The recovery card
 * links out to real support resources; the product is a tool in a plan, and
 * the copy says so rather than posing as the plan.
 */
const WhoItsFor = () => (
  <section style={landingStyles.section}>
    <div style={landingStyles.inner}>
      <SectionHeading
        eyebrow={WHO_ITS_FOR.eyebrow}
        title={WHO_ITS_FOR.title}
      />

      <div style={landingStyles.whoGrid}>
        {WHO_ITS_FOR.cards.map((card) => (
          <article key={card.title} style={landingStyles.featureCard}>
            <h3 style={landingStyles.featureTitle}>{card.title}</h3>
            <p style={landingStyles.featureBody}>{card.body}</p>
            {card.link && (
              <LandingLink
                href={card.link.href}
                style={landingStyles.disclosureLink}
              >
                {card.link.label} →
              </LandingLink>
            )}
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default WhoItsFor;
