import React from "react";

import SectionHeading from "../../atoms/SectionHeading.js";

import { landingStyles } from "../../../styles";

import { HOW_IT_WORKS } from "../../../utils/landingContent.js";

/**
 * HowItWorks - numbered because setup genuinely is a sequence: each step is
 * only possible once the one before it is done.
 */
const HowItWorks = () => (
  <section id="how-it-works" style={landingStyles.section}>
    <div style={landingStyles.inner}>
      <SectionHeading
        eyebrow="How it works"
        title="Four steps, then it's out of your hands"
      />

      <ol style={landingStyles.stepsGrid}>
        <span
          className="landing-steps-rule"
          style={landingStyles.stepsRule}
          aria-hidden="true"
        />
        {HOW_IT_WORKS.map((step, index) => (
          <li key={step.title} style={landingStyles.step}>
            <span style={landingStyles.stepNumber} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 style={landingStyles.stepTitle}>{step.title}</h3>
            <p style={landingStyles.stepBody}>{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export default HowItWorks;
