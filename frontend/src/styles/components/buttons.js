import { colors, spacing, borderRadius, fontSize, fontWeight, transitions, shadows } from '../theme.js';

// Button styles extracted from App.js
export const buttonStyles = {
  // Primary action buttons
  primary: {
    padding: `${spacing.xl} ${spacing.xxxxl}`,
    borderRadius: borderRadius.xl,
    border: 'none',
    backgroundColor: colors.button.primary,
    color: colors.text.primary,
    cursor: 'pointer',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
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
    color: colors.text.primary,
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
    color: colors.text.primary,
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
    color: colors.text.primary,
    cursor: 'pointer',
    fontSize: fontSize.normal,
    fontWeight: fontWeight.medium,
    transition: transitions.normal,
  },

  // Step navigation buttons
  stepNext: {
    padding: `${spacing.lg} ${spacing.xxl}`,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.button.primary}`,
    backgroundColor: colors.button.primary,
    color: colors.text.primary,
    cursor: 'pointer',
    fontSize: fontSize.normal,
    fontWeight: fontWeight.medium,
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
};

// Button hover effects
export const buttonHoverEffects = {
  primaryHover: (e) => {
    e.target.style.backgroundColor = colors.button.primaryHover;
  },
  primaryReset: (e) => {
    e.target.style.backgroundColor = colors.button.primary;
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