import React from "react";

import SectionHeading from "../../atoms/SectionHeading.js";

import { landingStyles } from "../../../styles";

import { LOCKED_COMPARISON } from "../../../utils/landingContent.js";

/**
 * LockedComparison - one question asked of every place people park money.
 * A real table so the single "no" reads against a column of "yes"es.
 */
const LockedComparison = () => (
  <section id="compare" style={landingStyles.section}>
    <div style={landingStyles.inner}>
      <SectionHeading
        eyebrow={LOCKED_COMPARISON.eyebrow}
        title={LOCKED_COMPARISON.title}
      />

      <div style={landingStyles.tableScroll}>
        <table style={landingStyles.tableTwoCol}>
          <caption className="sr-only">
            Whether each way of putting money aside lets you take it back
            early
          </caption>
          <thead>
            <tr>
              <th scope="col" style={landingStyles.tableCorner}>
                <span className="sr-only">Where the money is</span>
              </th>
              <th scope="col" style={landingStyles.tableHead}>
                {LOCKED_COMPARISON.question}
              </th>
            </tr>
          </thead>
          <tbody>
            {LOCKED_COMPARISON.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" style={landingStyles.tableRowLabel}>
                  {row.label}
                </th>
                <td
                  style={
                    row.ours
                      ? landingStyles.tableCellOurs
                      : landingStyles.tableCell
                  }
                >
                  {row.answer}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={landingStyles.footnote}>{LOCKED_COMPARISON.caption}</p>
    </div>
  </section>
);

export default LockedComparison;
