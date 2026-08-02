import {
  colors,
  space,
  borderRadius,
  type,
  fontFamily,
  fontWeight,
  letterSpacing,
  transitions,
  shadows,
} from "../theme.js";

// Overlay dialog styles.
//
// The panel is the same near-neutral card as everywhere else — a dialog is a
// surface that arrived on top, not a different product. Only the backdrop is
// new: it dims the page rather than hiding it, so the user keeps their place.
//
// Every text style states `textAlign` outright: index.css centres bare h1-h3
// and p globally, and that rule beats anything inherited from the panel.

const alignLeft = { textAlign: "left" };

export const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: space[4],
    backgroundColor: "rgba(4, 6, 7, 0.78)",
    backdropFilter: "blur(3px)",
  },

  panel: {
    position: "relative",
    width: "100%",
    maxWidth: "560px",
    maxHeight: "88vh",
    overflowY: "auto",
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.xxl,
    boxShadow: shadows.md,
    padding: `${space[6]} ${space[5]} ${space[5]}`,
    textAlign: "left",
  },

  close: {
    position: "absolute",
    top: space[3],
    right: space[3],
    width: "30px",
    height: "30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    color: colors.text.muted,
    border: `1px solid ${colors.border.hairline}`,
    borderRadius: borderRadius.sm,
    fontSize: type.body,
    lineHeight: 1,
    cursor: "pointer",
    transition: transitions.normal,
  },

  eyebrow: {
    ...alignLeft,
    fontFamily: fontFamily.mono,
    fontSize: type.caption,
    color: colors.primary.main,
    letterSpacing: letterSpacing.wide,
    textTransform: "uppercase",
    margin: `0 0 ${space[2]} 0`,
  },

  title: {
    ...alignLeft,
    fontSize: type.h3,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
    color: colors.text.primary,
    margin: `0 0 ${space[2]} 0`,
    lineHeight: 1.25,
  },

  lede: {
    ...alignLeft,
    fontSize: type.body,
    color: colors.text.muted,
    lineHeight: 1.6,
    margin: `0 0 ${space[5]} 0`,
  },

  // ---- Explainer blocks ---------------------------------------------------
  block: {
    display: "flex",
    gap: space[3],
    padding: `${space[4]} 0`,
    borderTop: `1px solid ${colors.border.hairline}`,
  },

  blockIcon: {
    flexShrink: 0,
    width: "34px",
    height: "34px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: type.h4,
    backgroundColor: colors.background.secondary,
    border: `1px solid ${colors.border.hairline}`,
    borderRadius: borderRadius.md,
  },

  blockTitle: {
    ...alignLeft,
    fontSize: type.body,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    margin: `0 0 ${space[1]} 0`,
  },

  blockText: {
    ...alignLeft,
    fontSize: type.body,
    color: colors.text.muted,
    lineHeight: 1.6,
    margin: 0,
  },

  // ---- Numbered steps -----------------------------------------------------
  steps: {
    listStyle: "none",
    counterReset: "modal-step",
    margin: `${space[4]} 0 0 0`,
    padding: 0,
    display: "grid",
    gap: space[3],
  },

  // index.css gives every bare <li> a card of its own — 80% wide, centred, on
  // its own background. A step here is a line of text, so all of that is undone
  step: {
    ...alignLeft,
    display: "flex",
    gap: space[3],
    alignItems: "flex-start",
    width: "100%",
    maxWidth: "none",
    margin: 0,
    padding: 0,
    backgroundColor: "transparent",
    fontSize: type.body,
    color: colors.text.secondary,
    lineHeight: 1.5,
  },

  stepNumber: {
    flexShrink: 0,
    fontFamily: fontFamily.mono,
    fontSize: type.caption,
    color: colors.primary.main,
    border: `1px solid ${colors.border.accent}`,
    backgroundColor: colors.background.darkBlue,
    borderRadius: borderRadius.pill,
    width: "22px",
    height: "22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "1px",
  },

  // ---- Warning note -------------------------------------------------------
  note: {
    ...alignLeft,
    display: "flex",
    gap: space[3],
    marginTop: space[5],
    padding: space[4],
    backgroundColor: colors.warning.bgAlt,
    border: `1px solid ${colors.warning.dark}`,
    borderRadius: borderRadius.lg,
    fontSize: type.small,
    color: colors.warning.light,
    lineHeight: 1.6,
  },

  // ---- Footer -------------------------------------------------------------
  footer: {
    display: "flex",
    gap: space[3],
    flexWrap: "wrap",
    marginTop: space[5],
  },

  footnote: {
    ...alignLeft,
    fontFamily: fontFamily.mono,
    fontSize: type.micro,
    color: colors.text.gray,
    margin: `${space[4]} 0 0 0`,
  },
};

export default modalStyles;
