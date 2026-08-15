import { colors, spacing, borderRadius, fontSize, fontWeight, transitions, shadows } from '../theme.js';

// Button styles extracted from App.js
export const buttonStyles = {
  // Primary action buttons
  primary: {
    padding: `${spacing.xl} ${spacing.xxxxl}`,
    borderRadius: borderRadius.xl,
    border: 'none',
    backgroundColor: colors.button.primary,
    color: colors.text.onAccent,
    cursor: 'pointer',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    transition: transitions.normal,
  },

  primaryHover: {
    backgroundColor: colors.button.primaryHover,
  },

  // Secondary buttons
  secondary: {
    padding: `${spacing.lg} ${spacing.xxl}`,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.secondary,
    color: colors.text.secondary,
    cursor: 'pointer',
    fontSize: fontSize.normal,
    transition: transitions.normal,
  },

  // Success button (Lock In, Continue, etc.)
  success: {
    padding: `${spacing.xl} ${spacing.xxxxl}`,
    borderRadius: borderRadius.xl,
    border: 'none',
    backgroundColor: colors.success.main,
    color: colors.text.onAccent,
    cursor: 'pointer',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    transition: transitions.normal,
    boxShadow: shadows.md,
  },

  // Disabled state
  disabled: {
    backgroundColor: colors.button.disabled,
    color: colors.text.muted,
    cursor: 'not-allowed',
    opacity: 0.5,
    boxShadow: 'none',
  },

  // Warning button (Emergency, etc.)
  warning: {
    padding: `${spacing.lg} ${spacing.xxl}`,
    borderRadius: borderRadius.lg,
    border: 'none',
    backgroundColor: colors.warning.main,
    color: colors.text.dark,
    cursor: 'pointer',
    fontSize: fontSize.normal,
    fontWeight: fontWeight.bold,
    transition: transitions.normal,
  },

  // Danger button (Remove, Delete, etc.)
  danger: {
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.error.main}`,
    backgroundColor: 'transparent',
    color: colors.error.main,
    cursor: 'pointer',
    fontSize: fontSize.sm,
    transition: transitions.normal,
    marginRight: spacing.sm,
    marginTop: spacing.sm,
  },

  // Small buttons
  small: {
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.secondary,
    color: colors.text.secondary,
    cursor: 'pointer',
    fontSize: fontSize.sm,
    transition: transitions.fast,
  },

  // Connect wallet button
  connect: {
    padding: `${spacing.lg} ${spacing.xxl}`,
    borderRadius: borderRadius.lg,
    border: 'none',
    backgroundColor: colors.button.primary,
    color: colors.text.onAccent,
    cursor: 'pointer',
    fontSize: fontSize.normal,
    fontWeight: fontWeight.semibold,
    transition: transitions.normal,
  },

  // Step navigation buttons
  stepNext: {
    padding: `${spacing.lg} ${spacing.xxl}`,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.button.primary}`,
    backgroundColor: colors.button.primary,
    color: colors.text.onAccent,
    cursor: 'pointer',
    fontSize: fontSize.normal,
    fontWeight: fontWeight.semibold,
    transition: transitions.normal,
  },

  // Refresh button
  refresh: {
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.secondary,
    color: colors.text.secondary,
    cursor: 'pointer',
    fontSize: fontSize.sm,
    transition: transitions.fast,
  },

  // Copy button
  copy: {
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.secondary,
    color: colors.text.primary,
    cursor: 'pointer',
    fontSize: fontSize.sm,
    transition: transitions.fast,
  },

  // Wallet connection buttons. These carry the page's primary action, so they
  // take the accent rather than each wallet's brand colour — two vendor colours
  // competing at the CTA is the loudest thing on an otherwise near-neutral page.
  metamask: {
    padding: `${spacing.xl} ${spacing.xxxxl}`,
    borderRadius: borderRadius.md,
    border: 'none',
    backgroundColor: colors.primary.main,
    color: colors.text.onAccent,
    cursor: 'pointer',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    transition: transitions.normal,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  phantom: {
    padding: `${spacing.xl} ${spacing.xxxxl}`,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border.strong}`,
    backgroundColor: 'transparent',
    color: colors.text.primary,
    cursor: 'pointer',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    transition: transitions.normal,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
};

// Button hover effects
export const buttonHoverEffects = {
  primaryHover: (e) => {
    e.target.style.backgroundColor = colors.button.primaryHover;
  },
  primaryReset: (e) => {
    e.target.style.backgroundColor = colors.button.primary;
  },

  metamaskHover: (e) => {
    e.target.style.backgroundColor = colors.primary.light;
  },
  metamaskReset: (e) => {
    e.target.style.backgroundColor = colors.primary.main;
  },

  phantomHover: (e) => {
    e.target.style.borderColor = colors.primary.main;
  },
  phantomReset: (e) => {
    e.target.style.borderColor = colors.border.strong;
  },

  refreshHover: (e) => {
    e.target.style.color = colors.text.secondary;
    e.target.style.borderColor = colors.text.gray;
  },
  refreshReset: (e) => {
    e.target.style.color = colors.text.muted;
    e.target.style.borderColor = colors.border.default;
  },
};

export default buttonStyles;
/**
 * The on/off switch.
 *
 * Sized in absolute pixels rather than the relative `fontSize` scale, because a
 * switch has to stay a fixed hit target wherever it is dropped — the in-app
 * screens nest `em` inside sized parents, and a track that shrank with its
 * context would end up unhittable on a phone.
 */
export const toggleStyles = {
  track: {
    position: "relative",
    width: "44px",
    height: "24px",
    padding: 0,
    margin: 0,
    borderRadius: borderRadius.pill,
    cursor: "pointer",
    transition: "background-color 0.15s, border-color 0.15s",
    flexShrink: 0,
  },
  trackOn: {
    backgroundColor: colors.success.main,
    border: `1px solid ${colors.success.main}`,
  },
  trackOff: {
    backgroundColor: colors.background.secondary,
    border: `1px solid ${colors.border.strong}`,
  },
  trackInactive: {
    cursor: "not-allowed",
    opacity: 0.6,
  },
  knob: {
    position: "absolute",
    top: "2px",
    width: "18px",
    height: "18px",
    borderRadius: borderRadius.pill,
    backgroundColor: colors.text.primary,
    transition: "left 0.15s",
  },
  knobOn: { left: "23px", backgroundColor: colors.text.onAccent },
  knobOff: { left: "2px", backgroundColor: colors.text.muted },
};
