import { colors, space, type, fontFamily, fontWeight, borderRadius } from "../theme.js";

// Locked vaults: the dashboard section and the public proof page. A lock is
// a small, serious object, so the card is quiet and the status pill is the
// only thing that carries colour.

const pillBase = {
  fontFamily: fontFamily.mono,
  fontSize: type.micro,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: `3px ${space[2]}`,
  borderRadius: borderRadius.pill,
  border: "1px solid",
};

export const lockStyles = {
  lede: {
    margin: `0 0 ${space[4]} 0`,
    fontSize: type.small,
    color: colors.text.secondary,
    lineHeight: 1.6,
    textAlign: "left",
  },

  list: {
    display: "grid",
    gap: space[3],
    marginBottom: space[5],
  },

  card: {
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    padding: space[4],
    textAlign: "left",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space[3],
    marginBottom: space[2],
  },

  rule: {
    margin: `0 0 ${space[2]} 0`,
    fontSize: type.body,
    color: colors.text.primary,
    lineHeight: 1.5,
  },

  meta: {
    margin: 0,
    fontFamily: fontFamily.mono,
    fontSize: type.caption,
    color: colors.text.muted,
    lineHeight: 1.6,
    wordBreak: "break-all",
  },

  balanceRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: space[2],
    margin: `${space[2]} 0`,
  },

  balance: {
    fontFamily: fontFamily.mono,
    fontSize: type.small,
    color: colors.success.light,
  },

  pillLocked: {
    ...pillBase,
    color: colors.warning.light,
    borderColor: colors.warning.main,
  },

  pillReady: {
    ...pillBase,
    color: colors.success.light,
    borderColor: colors.success.main,
  },

  pillReleased: {
    ...pillBase,
    color: colors.text.muted,
    borderColor: colors.border.default,
  },

  pillUnverified: {
    ...pillBase,
    color: colors.error.light,
    borderColor: colors.error.main,
  },

  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: space[2],
    marginTop: space[3],
  },

  form: {
    display: "grid",
    gap: space[3],
    textAlign: "left",
  },

  fieldRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: space[3],
  },

  presetRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: space[2],
  },

  warning: {
    backgroundColor: colors.background.secondary,
    border: `1px solid ${colors.warning.main}`,
    borderRadius: borderRadius.md,
    padding: space[3],
    fontSize: type.small,
    color: colors.text.secondary,
    lineHeight: 1.6,
  },

  error: {
    margin: 0,
    fontSize: type.small,
    color: colors.error.light,
  },

  // Public proof page
  proofCard: {
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.hairline}`,
    borderRadius: borderRadius.xxl,
    padding: space[6],
    maxWidth: "720px",
    margin: "0 auto",
    textAlign: "left",
  },

  proofRow: {
    display: "grid",
    gridTemplateColumns: "140px 1fr",
    gap: space[3],
    padding: `${space[3]} 0`,
    borderTop: `1px solid ${colors.border.hairline}`,
    fontSize: type.body,
    color: colors.text.primary,
  },

  proofLabel: {
    fontFamily: fontFamily.mono,
    fontSize: type.caption,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: colors.text.muted,
  },

  proofAmount: {
    fontFamily: fontFamily.mono,
    fontSize: type.stat,
    fontWeight: fontWeight.semibold,
    color: colors.success.light,
    margin: `${space[2]} 0`,
  },

  proofGuarantees: {
    margin: `${space[4]} 0 0 0`,
    paddingLeft: space[4],
    color: colors.text.secondary,
    fontSize: type.small,
    lineHeight: 1.7,
  },
};

export default lockStyles;
