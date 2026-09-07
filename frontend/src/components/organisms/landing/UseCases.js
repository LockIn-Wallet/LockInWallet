import React from "react";

import Icon from "../../atoms/Icon.js";
import LandingLink from "../../atoms/LandingLink.js";
import SectionHeading from "../../atoms/SectionHeading.js";

import { landingStyles } from "../../../styles";

import { HOME_USE_CASES } from "../../../utils/landingContent.js";

/**
 * UseCases - the three situations people arrive from, each with a link to
 * the guide written for that search. The guides are static pages, so the
 * links are plain anchors rather than router routes.
 */
const UseCases = () => (
  <section id="who-its-for" style={landingStyles.section}>
    <div style={landingStyles.inner}>
      <SectionHeading
        eyebrow="Who it's for"
        title="Built for the moment your willpower isn't there"
      />
      <div style={{ ...landingStyles.featureGrid, ...landingStyles.useCaseGrid }}>
        {HOME_USE_CASES.map((useCase) => (
          <article key={useCase.title} style={landingStyles.featureCard}>
            <span style={landingStyles.iconTile}>
              <Icon name={useCase.icon} />
            </span>
            <h3 style={landingStyles.featureTitle}>{useCase.title}</h3>
            <p style={landingStyles.featureBody}>{useCase.body}</p>
            <LandingLink href={useCase.href} style={landingStyles.disclosureLink}>
              {useCase.linkLabel} →
            </LandingLink>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default UseCases;
