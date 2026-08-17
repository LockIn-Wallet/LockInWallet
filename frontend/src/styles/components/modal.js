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

  // Same shape as `note`, in the error palette — used when a save fails and
  // the dialog stays open.
  errorNote: {
    ...alignLeft,
    display: "flex",
    gap: space[3],
    alignItems: "flex-start",
    margin: `${space[4]} 0 0 0`,
    padding: space[4],
    backgroundColor: colors.error.bg,
    border: `1px solid ${colors.error.dark}`,
    borderRadius: borderRadius.lg,
    fontSize: type.small,
    color: colors.error.light,
    lineHeight: 1.6,
  },

  // index.css gives every bare <button> `margin: 10px auto`, and auto margins on
  // a flex item push the footer's buttons to opposite ends. Spread this onto
  // each one so the gap above is what actually separates them.
  footerButton: {
    margin: 0,
  },

  footnote: {
    ...alignLeft,
    fontFamily: fontFamily.mono,
    fontSize: type.micro,
    color: colors.text.gray,
    margin: `${space[4]} 0 0 0`,
  },

  // ---- Option grid --------------------------------------------------------
  //
  // A one-per-row stack rather than side-by-side columns: these options are
  // read and compared, not scanned, and the panel is only 560px wide.
  optionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: space[3],
    margin: `${space[4]} 0 0 0`,
  },

  // A choice presented as two panels rather than two buttons: each one needs a
  // sentence of its own, because what separates them is not obvious from a
  // label and picking wrongly is annoying to undo.
  option: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: space[4],
    borderRadius: "10px",
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.secondary,
    color: colors.text.primary,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "border-color 0.15s, background-color 0.15s",
  },

  optionRecommended: {
    borderColor: colors.primary.main,
  },

  // A logo beside the heading, so the two options are told apart before either
  // is read. The text still carries the meaning; the mark only speeds up the
  // glance.
  optionHead: {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    marginBottom: space[2],
  },

  optionTitle: {
    display: "block",
    margin: 0,
    fontSize: type.bodyLg,
    fontWeight: 600,
  },

  optionText: {
    display: "block",
    margin: `${space[2]} 0 0 0`,
    fontSize: type.small,
    color: colors.text.gray,
    lineHeight: 1.6,
  },

  // The second option's badge names a property rather than an audience, so it
  // is deliberately quieter than the accent one — otherwise two badges compete
  // and the recommendation stops reading as a recommendation.
  optionBadgeNeutral: {
    color: colors.text.secondary,
    borderColor: colors.border.strong,
  },

  optionBadge: {
    display: "inline-block",
    margin: `0 0 ${space[2]} 0`,
    padding: `2px ${space[2]}`,
    borderRadius: "999px",
    fontSize: type.tiny || type.small,
    color: colors.primary.main,
    border: `1px solid ${colors.primary.main}`,
  },
};

export default modalStyles;
