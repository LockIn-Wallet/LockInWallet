import React from "react";

import SectionHeading from "../../atoms/SectionHeading.js";

import { landingStyles } from "../../../styles";

/**
 * FaqSection - questions as people type them, answered in full sentences so
 * each stands alone as a search result. Shared by the main page and /crypto;
 * each passes its own items.
 */
const FaqSection = ({ eyebrow = "FAQ", title, items }) => (
  <section id="faq" style={landingStyles.section}>
    <div style={landingStyles.inner}>
      <SectionHeading eyebrow={eyebrow} title={title} />

      <div style={landingStyles.faqList}>
        {items.map((item) => (
          <article key={item.question} style={landingStyles.faqItem}>
            <h3 style={landingStyles.faqQuestion}>{item.question}</h3>
            <p style={landingStyles.faqAnswer}>{item.answer}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default FaqSection;
