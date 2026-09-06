import React from "react";

import SectionHeading from "../../atoms/SectionHeading.js";

import { homeStyles, landingStyles } from "../../../styles";

import { HOME_PROMISES } from "../../../utils/landingContent.js";

/**
 * ProductPromise - the three behaviours a newcomer needs to understand before
 * anything else: an allowance, a wait, and nobody who can waive either.
 */
const ProductPromise = () => (
  <section id="what-it-does" style={landingStyles.section}>
    <div style={landingStyles.inner}>
      <SectionHeading
        eyebrow="What it does"
        title="Savings with a spend limit"
        lede="You still get at your money. You just can't get at all of it at once, and that is the whole idea."
      />
      <div style={homeStyles.stepsRow}>
        {HOME_PROMISES.map(({ emoji, title, text }) => (
          <article key={title} style={homeStyles.stepCard}>
            <div style={homeStyles.stepEmoji} aria-hidden="true">
              {emoji}
            </div>
            <h3 style={homeStyles.stepCardTitle}>{title}</h3>
            <p style={homeStyles.stepText}>{text}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default ProductPromise;
