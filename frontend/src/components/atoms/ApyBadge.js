import React from "react";
import PropTypes from "prop-types";

import { colors, space, borderRadius, type, fontFamily, fontWeight } from "../../styles";
import { formatApyPercent } from "../../utils/yieldMath.js";
import { YIELD_APY_CAVEAT } from "../../utils/yieldContent.js";

/**
 * ApyBadge - a rate pill.
 *
 * Always two decimals and always the word "variable": these rates are set by
 * the lending protocol and move constantly, so presenting one as a fixed
 * headline number would misrepresent it.
 */
const ApyBadge = ({ apyPercent, rangeLabel = null, label = "a year", muted = false }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "baseline",
      gap: space[1],
      padding: `${space[1]} ${space[2]}`,
      borderRadius: borderRadius.pill,
      backgroundColor: muted ? colors.background.dark : colors.background.darkBlue,
      border: `1px solid ${muted ? colors.border.default : colors.success.border}`,
      fontFamily: fontFamily.mono,
      fontSize: type.caption,
      fontWeight: fontWeight.medium,
      color: muted ? colors.text.muted : colors.success.light,
      whiteSpace: "nowrap",
    }}
    title={YIELD_APY_CAVEAT}
  >
    {/* A vault holding several coins earns a different rate on each, and one
        of them is not the answer for all of them. */}
    <span>{rangeLabel || `${formatApyPercent(apyPercent)}%`}</span>
    <span style={{ color: colors.text.muted, fontWeight: fontWeight.normal }}>{label}</span>
  </span>
);

ApyBadge.propTypes = {
  apyPercent: PropTypes.number,
  /** Shown instead of the single rate, e.g. "3.47–4.13%". */
  rangeLabel: PropTypes.string,
  label: PropTypes.string,
  muted: PropTypes.bool,
};

export default ApyBadge;
