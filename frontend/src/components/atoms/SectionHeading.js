import React from "react";

import { landingStyles } from "../../styles";

/**
 * SectionHeading - eyebrow, title and optional lede, centred.
 * The eyebrow names what kind of claim the section makes, so it carries
 * information rather than decorating the heading.
 */
const SectionHeading = ({ eyebrow, title, lede, id }) => (
  <div style={landingStyles.sectionHead}>
    {eyebrow && <p style={landingStyles.eyebrow}>{eyebrow}</p>}
    <h2 id={id} style={landingStyles.sectionTitle}>
      {title}
    </h2>
    {lede && <p style={landingStyles.sectionLede}>{lede}</p>}
  </div>
);

export default SectionHeading;
