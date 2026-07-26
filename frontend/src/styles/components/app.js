import {
  colors,
  space,
  borderRadius,
  type,
  fontFamily,
  fontWeight,
  letterSpacing,
} from "../theme.js";

// Styles for the logged-in app shell. The app keeps its single-page,
// collapsible-section shape — it has one subject (your vault), so a nav bar
// would be ceremony. What it needs instead is a fixed answer to "what can I
// take out right now?", which is what the allowance bar provides.

const monoBase = {
  fontFamily: fontFamily.mono,
};

export const appStyles = {
  // ---- Allowance bar ----------------------------------------------------
  allowanceBar: {
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.hairline}`,
    borderRadius: borderRadius.xxl,
    padding: space[5],
    marginBottom: space[4],
  },

  allowanceHead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space[3],
    flexWrap: "wrap",
    marginBottom: space[4],
  },

  allowanceLabel: {
    ...monoBase,
    fontSize: type.micro,
    color: colors.text.gray,
    letterSpacing: letterSpacing.wide,
    textTransform: "uppercase",
    margin: 0,
    textAlign: "left",
  },

  allowanceHint: {
    ...monoBase,
    fontSize: type.micro,
    color: colors.text.gray,
    margin: 0,
    textAlign: "right",
  },

  allowanceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: space[5],
  },

  period: {
    minWidth: 0,
  },

  periodHead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space[2],
    marginBottom: "7px",
  },

  periodName: {
    fontSize: type.small,
    color: colors.text.muted,
  },

  // The number a user is actually looking for, so it gets the mono treatment
  periodRemaining: {
    ...monoBase,
    fontSize: type.small,
    color: colors.text.primary,
    whiteSpace: "nowrap",
  },

  periodRemainingEmpty: {
    color: colors.error.light,
  },

  periodTrack: {
    height: "6px",
    backgroundColor: colors.background.secondary,
    borderRadius: "4px",
    overflow: "hidden",
  },

  periodReset: {
    ...monoBase,
    fontSize: type.micro,
    color: colors.text.gray,
    marginTop: "6px",
    textAlign: "left",
  },

  // Shown instead of the grid when no limits are active
  allowanceEmpty: {
    fontSize: type.small,
    color: colors.text.muted,
    margin: 0,
    textAlign: "left",
  },
};

export const getAllowanceFill = (percent, color = colors.primary.main) => ({
  height: "100%",
  width: `${Math.max(0, Math.min(100, percent))}%`,
  backgroundColor: color,
  borderRadius: "4px",
  transition: "width 0.3s linear",
});

export default appStyles;
