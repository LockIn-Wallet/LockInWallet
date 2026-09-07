import React from "react";

import { homeStyles } from "../../styles";

/**
 * FaqList - one FAQ rendering for every content page, so the markup that the
 * FAQPage JSON-LD describes is identical wherever it appears.
 */
const FaqList = ({ items }) => (
  <div style={homeStyles.faqList}>
    {items.map(({ question, answer }) => (
      <article key={question} style={homeStyles.faqItem}>
        <h3 style={homeStyles.faqQuestion}>{question}</h3>
        <p style={homeStyles.faqAnswer}>{answer}</p>
      </article>
    ))}
  </div>
);

export default FaqList;
