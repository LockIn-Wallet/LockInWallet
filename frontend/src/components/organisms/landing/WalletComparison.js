import React from "react";

import SectionHeading from "../../atoms/SectionHeading.js";

import { landingStyles } from "../../../styles";

import {
  COMPARISON_COLUMNS,
  COMPARISON_ROWS,
} from "../../../utils/landingContent.js";

const cellStyle = (column, row) => {
  if (column.ours) return landingStyles.tableCellOurs;
  return row.negativeFor?.includes(column.key)
    ? { ...landingStyles.tableCell, ...landingStyles.tableCellNegative }
    : landingStyles.tableCell;
};

/**
 * WalletComparison - a real table, so the comparison is readable by a screen
 * reader and scrollable on a phone rather than collapsing into nonsense.
 */
const WalletComparison = () => (
  <section id="compare" style={landingStyles.section}>
    <div style={landingStyles.inner}>
      <SectionHeading
        eyebrow="Compare"
        title="Not all wallets protect you the same way"
        lede="Most wallets can be emptied the moment a key leaks, and most ask you to trust code you cannot read."
      />

      <div style={landingStyles.tableScroll}>
        <table style={landingStyles.table}>
          <caption className="sr-only">
            How LockIn Wallet compares to custodial exchange accounts and
            standard hot wallets
          </caption>
          <thead>
            <tr>
              <th scope="col" style={landingStyles.tableCorner}>
                <span className="sr-only">Protection</span>
              </th>
              {COMPARISON_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={
                    column.ours
                      ? landingStyles.tableHeadOurs
                      : landingStyles.tableHead
                  }
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row" style={landingStyles.tableRowLabel}>
                  {row.label}
                </th>
                {COMPARISON_COLUMNS.map((column) => (
                  <td key={column.key} style={cellStyle(column, row)}>
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={landingStyles.footnote}>
        Compares typical wallet categories, not any specific named product.
      </p>
    </div>
  </section>
);

export default WalletComparison;
