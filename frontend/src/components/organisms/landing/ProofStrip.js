import React from "react";

import { landingStyles } from "../../../styles";

import { PROOF_POINTS } from "../../../utils/securityContent.js";

/**
 * ProofStrip - three facts a reader can check for themselves, stated without
 * adjectives. Only the one that carries the core guarantee takes the accent.
 */
const ProofStrip = () => (
  <section style={landingStyles.section}>
    <div style={{ ...landingStyles.inner, ...landingStyles.proofGrid }}>
      {PROOF_POINTS.map((point) => (
        <div key={point.label}>
          <div style={landingStyles.proofLabel}>{point.label}</div>
          <div
            style={
              point.accent
                ? {
                    ...landingStyles.proofValue,
                    ...landingStyles.proofValueAccent,
                  }
                : landingStyles.proofValue
            }
          >
            {point.value}
          </div>
          <div style={landingStyles.proofNote}>{point.note}</div>
        </div>
      ))}
    </div>
  </section>
);

export default ProofStrip;
