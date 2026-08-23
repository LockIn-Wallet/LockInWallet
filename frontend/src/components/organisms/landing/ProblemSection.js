import React from "react";

import SectionHeading from "../../atoms/SectionHeading.js";

import { landingStyles } from "../../../styles";

import { PROBLEM } from "../../../utils/landingContent.js";

/**
 * ProblemSection - names the failure mode of every other savings tool before
 * the page explains this one. The argument is two paragraphs, not cards: it
 * has to read like a person talking.
 */
const ProblemSection = () => (
  <section style={landingStyles.section}>
    <div style={landingStyles.inner}>
      <SectionHeading eyebrow={PROBLEM.eyebrow} title={PROBLEM.title} />
      <div style={landingStyles.proseBlock}>
        {PROBLEM.paragraphs.map((paragraph) => (
          <p key={paragraph} style={landingStyles.proseParagraph}>
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  </section>
);

export default ProblemSection;
