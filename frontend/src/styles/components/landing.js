import {
  colors,
  space,
  borderRadius,
  type,
  fontFamily,
  fontWeight,
  letterSpacing,
  transitions,
  layout,
} from "../theme.js";

// Page-level styles for the logged-out landing page.
//
// Rhythm: every section is separated by a hairline rule rather than a colour
// change, so the page reads as one continuous surface with the mint accent as
// the only thing that ever raises its voice.

const sectionBase = {
  padding: `${space[8]} ${layout.gutter}`,
  borderTop: `1px solid ${colors.border.hairline}`,
};

const monoBase = {
  fontFamily: fontFamily.mono,
};

const cardBase = {
  backgroundColor: colors.background.primary,
  border: `1px solid ${colors.border.hairline}`,
  borderRadius: borderRadius.xxl,
};

export const landingStyles = {
  // ---- Page shell -------------------------------------------------------
  page: {
    maxWidth: layout.pageMax,
    margin: "0 auto",
    color: colors.text.primary,
    fontFamily: fontFamily.sans,
    textAlign: "left",
  },

  inner: {
    maxWidth: layout.contentMax,
    margin: "0 auto",
  },

  section: sectionBase,

  sectionFlush: {
    ...sectionBase,
    borderTop: "none",
  },

  sectionHead: {
    textAlign: "center",
    marginBottom: space[8],
  },

  eyebrow: {
    ...monoBase,
    textAlign: "center",
    fontSize: type.caption,
    color: colors.primary.main,
    letterSpacing: letterSpacing.wide,
    textTransform: "uppercase",
    margin: `0 0 ${space[3]} 0`,
  },

  sectionTitle: {
    fontSize: type.h2,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
    color: colors.text.primary,
    margin: `0 0 ${space[3]} 0`,
    lineHeight: 1.15,
  },

  sectionLede: {
    fontSize: type.bodyLg,
    color: colors.text.muted,
    lineHeight: 1.6,
    maxWidth: layout.proseMax,
    margin: "0 auto",
    textAlign: "center",
  },

  footnote: {
    ...monoBase,
    fontSize: type.micro,
    color: colors.text.gray,
    margin: `${space[4]} 0 0 0`,
    textAlign: "left",
  },

  // ---- Navigation -------------------------------------------------------
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[5],
    padding: `${space[5]} ${layout.gutter}`,
    flexWrap: "wrap",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    textDecoration: "none",
    color: colors.text.primary,
  },

  brandMark: {
    width: "28px",
    height: "28px",
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.darkBlue,
    border: `1px solid ${colors.border.accent}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  brandName: {
    fontSize: type.bodyLg,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.snug,
  },

  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: space[6],
    flexWrap: "wrap",
  },

  navLink: {
    fontSize: type.body,
    color: colors.text.light,
    textDecoration: "none",
    transition: transitions.fast,
  },

  navDivider: {
    width: "1px",
    height: "16px",
    backgroundColor: colors.border.default,
  },

  navMono: {
    ...monoBase,
    fontSize: type.caption,
    color: colors.text.light,
    textDecoration: "none",
  },

  // ---- Buttons ----------------------------------------------------------
  ctaPrimary: {
    display: "inline-flex",
    margin: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    backgroundColor: colors.primary.main,
    color: colors.text.onAccent,
    border: "none",
    padding: `15px ${space[5]}`,
    borderRadius: "9px",
    fontFamily: "inherit",
    fontSize: type.bodyLg,
    fontWeight: fontWeight.semibold,
    cursor: "pointer",
    textDecoration: "none",
    transition: transitions.normal,
  },

  ctaSecondary: {
    display: "inline-flex",
    margin: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    backgroundColor: "transparent",
    color: colors.text.primary,
    border: `1px solid ${colors.border.strong}`,
    padding: `15px ${space[5]}`,
    borderRadius: "9px",
    fontFamily: "inherit",
    fontSize: type.bodyLg,
    fontWeight: fontWeight.semibold,
    cursor: "pointer",
    textDecoration: "none",
    transition: transitions.normal,
  },

  ctaCompact: {
    display: "inline-flex",
    margin: 0,
    alignItems: "center",
    gap: space[2],
    backgroundColor: colors.text.primary,
    color: colors.text.dark,
    border: "none",
    padding: `10px ${space[4]}`,
    borderRadius: borderRadius.md,
    fontFamily: "inherit",
    fontSize: type.body,
    fontWeight: fontWeight.semibold,
    cursor: "pointer",
    textDecoration: "none",
    transition: transitions.normal,
  },

  ctaRow: {
    display: "flex",
    gap: space[3],
    flexWrap: "wrap",
  },

  ctaRowCenter: {
    display: "flex",
    gap: space[3],
    flexWrap: "wrap",
    justifyContent: "center",
  },

  // ---- Badges -----------------------------------------------------------
  badge: {
    ...monoBase,
    display: "inline-flex",
    alignItems: "center",
    gap: space[2],
    backgroundColor: colors.background.secondary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.pill,
    padding: `7px ${space[3]}`,
    fontSize: type.caption,
    color: colors.primary.main,
    letterSpacing: letterSpacing.wide,
  },

  liveDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: colors.primary.lighter,
    boxShadow: `0 0 6px ${colors.primary.lighter}`,
    flexShrink: 0,
  },

  // ---- Hero -------------------------------------------------------------
  hero: {
    padding: `${space[8]} ${layout.gutter} 0`,
    position: "relative",
  },

  heroGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "520px",
    background:
      "radial-gradient(ellipse 55% 100% at 50% 0%, #12241c 0%, transparent 70%)",
    opacity: 0.5,
    pointerEvents: "none",
  },

  heroCopy: {
    position: "relative",
    textAlign: "center",
    maxWidth: "920px",
    margin: `0 auto ${space[7]} auto`,
  },

  heroTitle: {
    fontSize: type.h1,
    lineHeight: 1.04,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
    color: colors.text.primary,
    margin: `${space[6]} 0 ${space[4]} 0`,
  },

  heroAccent: {
    color: colors.primary.main,
  },

  heroSubtitle: {
    fontSize: type.lead,
    lineHeight: 1.6,
    color: colors.text.light,
    maxWidth: layout.proseMax,
    margin: `0 auto ${space[6]} auto`,
    textAlign: "center",
  },

  // ---- Signature: the enforcement console -------------------------------
  console: {
    ...cardBase,
    position: "relative",
    maxWidth: "1000px",
    margin: "0 auto",
    border: `1px solid ${colors.border.default}`,
    overflow: "hidden",
  },

  consoleBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
    flexWrap: "wrap",
    padding: `${space[3]} ${space[5]}`,
    borderBottom: `1px solid ${colors.border.hairline}`,
    backgroundColor: colors.background.dark,
  },

  consoleLabel: {
    ...monoBase,
    fontSize: type.micro,
    color: colors.text.gray,
    letterSpacing: letterSpacing.wide,
  },

  consoleBody: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)",
    gap: space[6],
    padding: space[6],
    alignItems: "start",
  },

  consoleColumn: {
    minWidth: 0,
  },

  consoleColumnRight: {
    minWidth: 0,
    borderLeft: `1px solid ${colors.border.hairline}`,
    paddingLeft: space[6],
  },

  balanceLabel: {
    textAlign: "left",
    ...monoBase,
    fontSize: type.micro,
    color: colors.text.gray,
    letterSpacing: letterSpacing.wide,
    margin: `0 0 ${space[2]} 0`,
  },

  balanceAmount: {
    textAlign: "left",
    ...monoBase,
    fontSize: "32px",
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.snug,
    color: colors.text.primary,
    margin: 0,
  },

  balanceUnit: {
    fontSize: type.lead,
    fontWeight: fontWeight.normal,
    color: colors.text.gray,
  },

  balanceStatus: {
    textAlign: "left",
    fontSize: type.small,
    color: colors.primary.lighter,
    margin: `${space[2]} 0 ${space[5]} 0`,
  },

  // Buckets
  bucketList: {
    display: "flex",
    flexDirection: "column",
    gap: space[4],
  },

  bucketRow: {
    display: "block",
  },

  bucketHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space[3],
    marginBottom: "7px",
  },

  bucketName: {
    fontSize: type.small,
    color: colors.text.muted,
  },

  bucketNumbers: {
    ...monoBase,
    fontSize: type.small,
    color: colors.text.primary,
    whiteSpace: "nowrap",
  },

  bucketNumbersEmpty: {
    color: colors.error.light,
  },

  barTrack: {
    height: "6px",
    backgroundColor: colors.background.secondary,
    borderRadius: "4px",
    overflow: "hidden",
  },

  // The request ticket — the moment the contract answers
  ticket: {
    ...monoBase,
    display: "flex",
    alignItems: "center",
    gap: space[3],
    fontSize: type.small,
    color: colors.text.light,
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    padding: `${space[3]} ${space[4]}`,
    marginBottom: space[4],
    transition: transitions.normal,
    minHeight: "48px",
    boxSizing: "border-box",
  },

  ticketAccepted: {
    borderColor: colors.border.success,
    color: colors.primary.light,
  },

  ticketRejected: {
    borderColor: colors.error.dark,
    color: colors.error.light,
  },

  ticketVerdict: {
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wide,
  },

  // The 24h bypass clock, appearing only once a request is refused
  bypassStrip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
    flexWrap: "wrap",
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.warning}`,
    borderRadius: borderRadius.lg,
    padding: `${space[3]} ${space[4]}`,
    marginTop: space[4],
  },

  bypassLabel: {
    fontSize: type.small,
    color: colors.text.light,
  },

  bypassClock: {
    ...monoBase,
    fontSize: type.h3,
    fontWeight: fontWeight.semibold,
    color: colors.warning.light,
    whiteSpace: "nowrap",
  },

  consoleNote: {
    textAlign: "left",
    fontSize: type.small,
    color: colors.text.gray,
    lineHeight: 1.6,
    margin: `${space[5]} 0 0 0`,
  },

  // ---- Proof strip ------------------------------------------------------
  proofGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: space[6],
    textAlign: "center",
  },

  proofLabel: {
    ...monoBase,
    fontSize: type.caption,
    color: colors.text.gray,
    letterSpacing: letterSpacing.wide,
    marginBottom: space[3],
  },

  proofValue: {
    fontSize: type.stat,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.snug,
    color: colors.text.primary,
    lineHeight: 1.1,
  },

  proofValueAccent: {
    color: colors.primary.main,
  },

  proofNote: {
    fontSize: type.small,
    color: colors.text.muted,
    marginTop: space[2],
    lineHeight: 1.5,
  },

  // ---- Comparison table -------------------------------------------------
  tableScroll: {
    overflowX: "auto",
    border: `1px solid ${colors.border.hairline}`,
    borderRadius: borderRadius.xxl,
  },

  table: {
    width: "100%",
    minWidth: "760px",
    borderCollapse: "collapse",
    fontSize: type.body,
  },

  tableCorner: {
    padding: `${space[4]} ${space[5]}`,
    backgroundColor: colors.background.darker,
    textAlign: "left",
  },

  tableHeadOurs: {
    padding: `${space[4]} ${space[5]}`,
    backgroundColor: colors.background.darkBlue,
    borderLeft: `1px solid ${colors.border.hairline}`,
    color: colors.primary.main,
    fontSize: type.bodyLg,
    fontWeight: fontWeight.semibold,
    textAlign: "center",
  },

  tableHead: {
    padding: `${space[4]} ${space[5]}`,
    backgroundColor: colors.background.primary,
    borderLeft: `1px solid ${colors.border.hairline}`,
    color: colors.text.secondary,
    fontSize: type.bodyLg,
    fontWeight: fontWeight.semibold,
    textAlign: "center",
  },

  tableRowLabel: {
    padding: `${space[4]} ${space[5]}`,
    borderTop: `1px solid ${colors.border.hairline}`,
    color: colors.text.light,
    fontWeight: fontWeight.normal,
    textAlign: "left",
  },

  tableCellOurs: {
    padding: `${space[4]} ${space[5]}`,
    borderTop: `1px solid ${colors.border.hairline}`,
    borderLeft: `1px solid ${colors.border.hairline}`,
    backgroundColor: "#0e1512",
    color: colors.primary.main,
    textAlign: "center",
  },

  tableCell: {
    padding: `${space[4]} ${space[5]}`,
    borderTop: `1px solid ${colors.border.hairline}`,
    borderLeft: `1px solid ${colors.border.hairline}`,
    color: colors.text.gray,
    textAlign: "center",
  },

  tableCellNegative: {
    color: colors.error.light,
  },

  // ---- Feature / trust grid ---------------------------------------------
  featureGrid: {
    display: "grid",
    // Two columns exactly: at 340px the 1100px container fits three, leaving
    // the fourth card orphaned on its own row
    gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
    gap: "1px",
    backgroundColor: colors.border.hairline,
    border: `1px solid ${colors.border.hairline}`,
    borderRadius: borderRadius.xxl,
    overflow: "hidden",
  },

  featureCard: {
    backgroundColor: colors.background.primary,
    padding: space[7],
  },

  iconTile: {
    width: "40px",
    height: "40px",
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.darkBlue,
    border: `1px solid ${colors.border.accent}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[4],
  },

  featureTitle: {
    textAlign: "left",
    fontSize: type.h3,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    margin: `0 0 ${space[2]} 0`,
  },

  featureBody: {
    fontSize: type.body,
    lineHeight: 1.65,
    color: colors.text.muted,
    margin: 0,
    textAlign: "left",
  },

  disclosureEyebrow: {
    ...monoBase,
    textAlign: "left",
    fontSize: type.caption,
    color: colors.primary.main,
    letterSpacing: letterSpacing.wide,
    textTransform: "uppercase",
    margin: `0 0 ${space[3]} 0`,
  },

  // Standalone card for the remaining-trust disclosure
  disclosureCard: {
    ...cardBase,
    padding: space[7],
    marginTop: space[5],
  },

  disclosureLink: {
    ...monoBase,
    display: "inline-block",
    marginTop: space[4],
    fontSize: type.caption,
    color: colors.primary.main,
    textDecoration: "none",
  },

  // ---- Steps ------------------------------------------------------------
  stepsGrid: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: space[6],
    position: "relative",
  },

  stepsRule: {
    position: "absolute",
    top: "19px",
    left: "12%",
    right: "12%",
    height: "1px",
    backgroundColor: colors.border.hairline,
    zIndex: 0,
  },

  step: {
    position: "relative",
    zIndex: 1,
    // Neutralise the base-layer <li> treatment
    backgroundColor: "transparent",
    border: "none",
    borderRadius: 0,
    margin: 0,
    padding: 0,
    width: "auto",
    maxWidth: "none",
  },

  stepNumber: {
    ...monoBase,
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.strong}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: type.small,
    color: colors.primary.main,
    marginBottom: space[4],
  },

  stepTitle: {
    textAlign: "left",
    fontSize: type.h4,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    margin: `0 0 ${space[2]} 0`,
  },

  stepBody: {
    fontSize: type.small,
    color: colors.text.muted,
    lineHeight: 1.6,
    margin: 0,
    textAlign: "left",
  },

  // ---- Closing CTA ------------------------------------------------------
  closing: {
    ...sectionBase,
    paddingTop: space[10],
    paddingBottom: space[10],
    position: "relative",
    overflow: "hidden",
    textAlign: "center",
  },

  closingGlow: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(ellipse 50% 60% at 50% 40%, #12241c 0%, transparent 70%)",
    opacity: 0.5,
    pointerEvents: "none",
  },

  closingInner: {
    position: "relative",
    zIndex: 1,
    maxWidth: "640px",
    margin: "0 auto",
  },

  closingBody: {
    fontSize: type.bodyLg,
    color: colors.text.light,
    lineHeight: 1.6,
    margin: `0 0 ${space[6]} 0`,
    textAlign: "center",
  },

  // ---- Footer -----------------------------------------------------------
  footer: {
    padding: `${space[8]} ${layout.gutter} ${space[7]}`,
    borderTop: `1px solid ${colors.border.hairline}`,
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space[7],
  },

  footerBlurb: {
    fontSize: type.small,
    color: colors.text.gray,
    lineHeight: 1.6,
    margin: `${space[3]} 0 0 0`,
    maxWidth: "260px",
    textAlign: "left",
  },

  footerColumns: {
    display: "flex",
    gap: space[9],
    flexWrap: "wrap",
  },

  footerColTitle: {
    ...monoBase,
    fontSize: type.micro,
    color: colors.text.gray,
    letterSpacing: letterSpacing.wide,
    marginBottom: space[4],
  },

  footerLinks: {
    display: "flex",
    flexDirection: "column",
    gap: space[3],
  },

  footerLink: {
    fontSize: type.body,
    color: colors.text.light,
    textDecoration: "none",
  },

  footerBase: {
    padding: `0 ${layout.gutter} ${space[7]}`,
    fontSize: type.caption,
    color: colors.text.gray,
    textAlign: "left",
  },
};

// Dynamic helper — bar fills depend on runtime state
export const getBarFill = (percent, color = colors.primary.main) => ({
  height: "100%",
  width: `${Math.max(0, Math.min(100, percent))}%`,
  backgroundColor: color,
  borderRadius: "4px",
  transition: "width 0.3s linear",
});

export default landingStyles;
