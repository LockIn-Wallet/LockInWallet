import {
  colors,
  spacing,
  space,
  borderRadius,
  fontSize,
  type,
  fontFamily,
  fontWeight,
  letterSpacing,
  transitions,
} from "../theme.js";

// Styles for the logged-out homepage showcase (hero, time-lock demo,
// no-loss prize savings section)
export const homeStyles = {
  // Page container
  container: {
    padding: `${spacing.xxl} 0`,
    color: colors.text.secondary,
  },

  // Hero
  hero: {
    textAlign: "center",
    marginBottom: spacing.xxxxl,
  },

  heroTitle: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    margin: `0 0 ${spacing.md} 0`,
    lineHeight: 1.25,
  },

  heroTypewriter: {
    color: colors.primary.light,
  },

  heroSubtitle: {
    fontSize: fontSize.lg,
    color: colors.text.light,
    margin: `0 auto ${spacing.xxl} auto`,
    maxWidth: "580px",
    lineHeight: 1.6,
  },

  connectRow: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: spacing.md,
  },

  // Generic showcase panel — the demo apparatus, framed like an instrument
  section: {
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.hairline}`,
    borderRadius: borderRadius.xxl,
    padding: space[6],
    textAlign: "left",
    color: colors.text.secondary,
  },

  sectionTitle: {
    fontSize: type.h3,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    margin: `0 0 ${space[2]} 0`,
    textAlign: "left",
  },

  sectionSubtitle: {
    fontSize: type.small,
    color: colors.text.muted,
    textAlign: "left",
    margin: `0 0 ${space[5]} 0`,
    maxWidth: "620px",
    lineHeight: 1.6,
  },

  demoBadge: {
    display: "inline-block",
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.background.dark,
    backgroundColor: colors.warning.light,
    borderRadius: borderRadius.sm,
    padding: `2px ${spacing.sm}`,
    marginLeft: spacing.sm,
    verticalAlign: "middle",
  },

  // Key-compromise simulation
  attackBanner: {
    textAlign: "center",
    fontSize: type.body,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },

  attackBannerDanger: {
    color: colors.error.light,
    borderColor: colors.error.main,
  },

  demoGrid: {
    display: "flex",
    gap: spacing.xl,
    flexWrap: "wrap",
    justifyContent: "center",
  },

  walletPanel: {
    flex: "1 1 280px",
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
  },

  walletPanelDanger: {
    borderColor: colors.error.main,
  },

  walletPanelSafe: {
    borderColor: colors.success.border,
  },

  panelTitle: {
    fontFamily: fontFamily.mono,
    letterSpacing: letterSpacing.wide,
    textTransform: "uppercase",
    fontSize: type.micro,
    fontWeight: fontWeight.semibold,
    color: colors.text.muted,
    margin: `0 0 ${spacing.sm} 0`,
    textAlign: "center",
  },

  panelBalance: {
    fontFamily: fontFamily.mono,
    fontSize: "26px",
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    margin: 0,
    transition: transitions.normal,
  },

  panelBalanceLost: {
    color: colors.error.light,
  },

  panelBalanceSafe: {
    color: colors.success.light,
  },

  barTrack: {
    height: "6px",
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    margin: `${spacing.md} 0`,
  },

  panelStatus: {
    fontSize: fontSize.md,
    color: colors.text.light,
    textAlign: "center",
    minHeight: "3em",
    lineHeight: 1.5,
    margin: 0,
  },

  // Always in flow: this appears part-way through the loop, and revealing it
  // on demand shoved the rest of the page down while someone was reading it.
  verdictRow: {
    display: "flex",
    gap: spacing.lg,
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: spacing.xl,
    transition: "opacity 0.25s ease",
  },

  verdictRowIdle: {
    opacity: 0,
    visibility: "hidden",
  },

  verdictLost: {
    fontSize: fontSize.normal,
    fontWeight: fontWeight.semibold,
    color: colors.error.light,
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.error.main}`,
    borderRadius: borderRadius.lg,
    padding: `${spacing.sm} ${spacing.lg}`,
  },

  verdictSaved: {
    fontSize: fontSize.normal,
    fontWeight: fontWeight.semibold,
    color: colors.success.light,
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.success.border}`,
    borderRadius: borderRadius.lg,
    padding: `${spacing.sm} ${spacing.lg}`,
  },

  captionText: {
    fontSize: type.small,
    color: colors.text.gray,
    textAlign: "left",
    lineHeight: 1.6,
    margin: `${space[5]} 0 0 0`,
    maxWidth: "620px",
  },

  // Sits under the connect buttons and says what actually separates them, so
  // the choice is legible without a second screen to explain it.
  connectNote: {
    fontSize: type.small,
    color: colors.text.gray,
    textAlign: "center",
    lineHeight: 1.6,
    margin: `${space[4]} auto 0 auto`,
    maxWidth: "440px",
  },

  // Prize cards
  prizeGrid: {
    display: "flex",
    gap: spacing.xl,
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },

  prizeCard: {
    flex: "1 1 220px",
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    textAlign: "center",
  },

  prizeCardGrand: {
    flex: "1 1 100%",
    borderColor: colors.border.active,
  },

  prizeTierLabel: {
    fontSize: fontSize.normal,
    fontWeight: fontWeight.semibold,
    color: colors.text.light,
    margin: `0 0 ${spacing.xs} 0`,
  },

  prizeTierBlurb: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    margin: `0 0 ${spacing.md} 0`,
  },

  poolAmount: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.primary.light,
    margin: `0 0 ${spacing.md} 0`,
  },

  poolAmountGrand: {
    fontSize: fontSize.hero,
    color: colors.warning.light,
  },

  countdownRow: {
    display: "flex",
    gap: spacing.sm,
    justifyContent: "center",
  },

  countdownSegment: {
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    padding: `${spacing.sm} ${spacing.md}`,
    minWidth: "44px",
  },

  countdownValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },

  countdownUnit: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    textTransform: "uppercase",
  },

  countdownCaption: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.md,
  },

  winnerOverlay: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: "110px",
  },

  winnerText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.warning.light,
    margin: 0,
  },

  confettiContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
  },

  // Winner ticker
  tickerBox: {
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    textAlign: "center",
    marginBottom: spacing.xxl,
  },

  tickerLabel: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: spacing.sm,
  },

  tickerEntry: {
    display: "inline-block",
    fontSize: fontSize.normal,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },

  tickerAmount: {
    color: colors.success.light,
    fontWeight: fontWeight.bold,
  },

  // ---- Prize savings page (/prize-savings) ------------------------------
  // Its own document rather than a homepage section, so it carries a page
  // heading and a readable FAQ underneath the demos.
  pageTitle: {
    fontSize: type.h1,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
    color: colors.text.primary,
    lineHeight: 1.1,
    margin: `0 0 ${space[4]} 0`,
    textAlign: "center",
  },

  pageLede: {
    fontSize: type.lead,
    color: colors.text.muted,
    lineHeight: 1.6,
    maxWidth: "720px",
    margin: "0 auto",
    textAlign: "center",
  },

  faqList: {
    display: "grid",
    gap: space[4],
    maxWidth: "820px",
    margin: "0 auto",
  },

  faqItem: {
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.hairline}`,
    borderRadius: borderRadius.xxl,
    padding: space[5],
    textAlign: "left",
  },

  faqQuestion: {
    fontSize: type.h4,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    margin: `0 0 ${space[2]} 0`,
  },

  faqAnswer: {
    fontSize: type.body,
    color: colors.text.muted,
    lineHeight: 1.65,
    margin: 0,
  },

  pageCtaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: space[3],
    justifyContent: "center",
  },

  // How-it-works steps
  stepsRow: {
    display: "flex",
    gap: spacing.lg,
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: spacing.xxl,
  },

  stepCard: {
    flex: "1 1 180px",
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    textAlign: "center",
  },

  stepEmoji: {
    fontSize: fontSize.xxxl,
    marginBottom: spacing.sm,
  },

  stepText: {
    fontSize: fontSize.sm,
    color: colors.text.light,
    lineHeight: 1.5,
    margin: 0,
  },

  // Time-lock explainer — shared block heading
  blockTitle: {
    fontSize: type.h4,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    textAlign: "left",
    margin: `0 0 ${space[3]} 0`,
  },

  blockSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: "center",
    lineHeight: 1.6,
    margin: `0 auto ${spacing.xl} auto`,
    maxWidth: "560px",
  },

  blockDivider: {
    border: "none",
    borderTop: `1px solid ${colors.border.default}`,
    margin: `${spacing.xxl} 0`,
  },

  // Withdrawal ticket + limit buckets
  withdrawTicket: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    transition: transitions.normal,
  },

  withdrawTicketAccepted: {
    borderColor: colors.success.border,
    color: colors.success.light,
  },

  withdrawTicketRejected: {
    borderColor: colors.error.main,
    color: colors.error.light,
  },

  bucketList: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.lg,
  },

  bucketRow: {
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    transition: transitions.normal,
  },

  bucketRowEmpty: {
    borderColor: colors.error.main,
  },

  bucketHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },

  bucketName: {
    fontSize: fontSize.normal,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },

  bucketNote: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginLeft: spacing.sm,
    fontWeight: fontWeight.normal,
  },

  bucketNumbers: {
    fontSize: type.small,
    fontFamily: fontFamily.mono,
    color: colors.text.light,
    whiteSpace: "nowrap",
  },

  bucketNumbersEmpty: {
    color: colors.error.light,
  },

  bucketRefill: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.warning.light,
    marginTop: spacing.sm,
  },

  bucketRefillDone: {
    color: colors.success.light,
  },

  bucketClock: {
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.lg,
  },

  // One-line bypass / limit-change strip with its 24h countdown
  bypassStrip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.lg,
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.warning.main}`,
    borderRadius: borderRadius.lg,
    padding: `${spacing.lg} ${spacing.xl}`,
  },

  bypassLabel: {
    fontSize: fontSize.normal,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },

  bypassClock: {
    fontSize: type.h3,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
    color: colors.warning.light,
    whiteSpace: "nowrap",
  },

  // Chain availability
  chainGrid: {
    display: "flex",
    gap: spacing.xl,
    flexWrap: "wrap",
    justifyContent: "center",
  },

  chainCard: {
    flex: "1 1 260px",
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
  },

  chainCardLive: {
    borderColor: colors.success.border,
  },

  chainHeader: {
    display: "flex",
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing.md,
  },

  chainLogoWrap: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },

  chainLogoMuted: {
    opacity: 0.45,
    filter: "grayscale(1)",
  },

  chainName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    lineHeight: 1.2,
  },

  chainTagline: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },

  chainBadge: {
    display: "inline-block",
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text.muted,
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.sm,
    padding: `2px ${spacing.sm}`,
    marginBottom: spacing.md,
  },

  chainBadgeLive: {
    color: colors.success.light,
    borderColor: colors.success.border,
  },

  chainDetail: {
    fontSize: fontSize.sm,
    color: colors.text.light,
    lineHeight: 1.6,
    margin: `0 0 ${spacing.md} 0`,
  },

  chainBestFor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    margin: 0,
  },

  // Deposit slider
  sliderBox: {
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    textAlign: "center",
  },

  sliderLabel: {
    fontSize: fontSize.normal,
    fontWeight: fontWeight.semibold,
    color: colors.text.light,
    margin: `0 0 ${spacing.md} 0`,
  },

  sliderDeposit: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.primary.light,
    margin: `0 0 ${spacing.md} 0`,
  },

  sliderInput: {
    display: "block",
    width: "100%",
    maxWidth: "480px",
    margin: `0 auto ${spacing.xl} auto`,
    accentColor: colors.primary.main,
    cursor: "pointer",
  },

  outcomeRow: {
    display: "flex",
    gap: spacing.lg,
    flexWrap: "wrap",
    justifyContent: "center",
  },

  outcomeCard: {
    flex: "1 1 170px",
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },

  outcomeCardBest: {
    borderColor: colors.border.active,
  },

  outcomeTitle: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: spacing.xs,
  },

  outcomeValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  outcomeNote: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    lineHeight: 1.5,
    margin: 0,
  },

  // Bottom media block
  mediaSection: {
    textAlign: "center",
    marginBottom: spacing.xl,
  },

  mediaImage: {
    maxWidth: "100%",
    height: "auto",
    maxHeight: "300px",
    borderRadius: borderRadius.lg,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
  },

  // Responsive 16:9 wrapper for embedded video
  mediaEmbed: {
    position: "relative",
    width: "100%",
    maxWidth: "700px",
    margin: "0 auto",
    paddingTop: "56.25%",
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
  },

  mediaEmbedFrame: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    border: "none",
  },

  mediaVideo: {
    maxWidth: "100%",
    height: "auto",
    maxHeight: "400px",
    borderRadius: borderRadius.lg,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
  },

  // Closing CTA
  ctaSection: {
    textAlign: "center",
    marginTop: spacing.xxxxl,
  },

  ctaTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    margin: `0 0 ${spacing.xl} 0`,
  },

  footerTagline: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    lineHeight: 1.6,
    textAlign: "center",
    margin: 0,
    padding: `0 ${spacing.lg}`,
  },
};

// Dynamic style helpers (values depend on runtime state)
export const getBarFillStyle = (percent, color) => ({
  height: "100%",
  width: `${Math.max(0, Math.min(100, percent))}%`,
  backgroundColor: color,
  transition: "width 0.3s linear",
});

const CONFETTI_COLORS = [
  colors.primary.main,
  colors.accent.blue,
  colors.accent.purple,
  colors.warning.light,
  colors.accent.pink,
];

export const getConfettiPieceStyle = (index) => ({
  position: "absolute",
  top: 0,
  left: `${(index * 83) % 100}%`,
  width: "8px",
  height: "8px",
  borderRadius: "2px",
  backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  animationDelay: `${(index % 6) * 0.27}s`,
});

export default homeStyles;
