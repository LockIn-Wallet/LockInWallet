import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme.js';

// Step wizard styles extracted from App.js
export const stepStyles = {
  // Step containers
  stepContainer: {
    marginBottom: spacing.xxl,
    padding: spacing.xxl,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
  },

  // Step 1 container (Spending Limits)
  step1Container: {
    marginBottom: spacing.xxl,
    padding: spacing.xxl,
    border: `2px solid ${colors.success.main}`, // Active green border during setup
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
  },

  // Step 2 container (Withdrawal Addresses)
  step2Container: {
    marginBottom: spacing.xxl,
    padding: spacing.xxl,
    border: `3px solid ${colors.warning.dark}`, // Always active during setup
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
  },

  // Step 3 container (Lock In) - conditional styling
  step3ContainerActive: {
    marginBottom: spacing.xxl,
    padding: spacing.xxl,
    border: `3px solid ${colors.warning.dark}`, // Highlighted border for active step
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
    boxShadow: shadows.glow,
  },

  step3ContainerComplete: {
    marginBottom: spacing.xxl,
    padding: spacing.xxl,
    border: `2px solid ${colors.success.main}`,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
  },

  step3ContainerInactive: {
    marginBottom: spacing.xxl,
    padding: spacing.xxl,
    border: `2px solid ${colors.border.light}`,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
  },

  // Step headers
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },

  // Step titles
  stepTitle: {
    color: colors.success.light,
    margin: 0,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
  },

  step1Title: {
    color: colors.success.light,
    margin: 0,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
  },

  step2Title: {
    color: colors.success.light,
    margin: 0,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
  },

  step3Title: {
    color: colors.success.main,
    margin: `0 0 ${spacing.xl} 0`,
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.semibold,
  },

  // Step status badges
  stepStatus: {
    fontSize: fontSize.sm,
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: borderRadius.md,
    fontWeight: fontWeight.medium,
  },

  stepStatusComplete: {
    color: colors.success.light,
    backgroundColor: colors.background.darkBlue,
    border: `1px solid ${colors.success.border}`,
  },

  stepStatusRequired: {
    color: colors.warning.light,
    backgroundColor: colors.warning.bg,
    border: `1px solid ${colors.warning.dark}`,
  },

  stepStatusActive: {
    color: colors.warning.light,
    backgroundColor: colors.warning.bg,
    border: `1px solid ${colors.warning.dark}`,
  },

  // Step descriptions
  stepDescription: {
    fontSize: fontSize.normal,
    color: colors.text.light,
    marginBottom: spacing.xl,
    lineHeight: '1.5',
  },

  // Prerequisites section
  prerequisitesCard: {
    backgroundColor: colors.background.darker,
    border: `1px solid ${colors.warning.main}`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },

  prerequisitesTitle: {
    color: colors.success.light, // Changes based on completion
    margin: `0 0 ${spacing.md} 0`,
  },

  prerequisitesItem: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    fontSize: fontSize.md,
  },

  prerequisitesItemComplete: {
    color: colors.success.light,
  },

  prerequisitesItemIncomplete: {
    color: colors.error.light,
  },

  // Step navigation
  stepNavigation: {
    textAlign: 'center',
    marginTop: spacing.xl,
  },

  // Step progress tips
  progressTip: {
    color: colors.text.muted,
    backgroundColor: colors.background.dark,
    borderLeft: `3px solid ${colors.warning.light}`,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    fontSize: fontSize.normal,
    lineHeight: '1.5',
  },

  // Lock-in confirmation section
  lockInSection: {
    textAlign: 'center',
  },

  lockInButton: {
    padding: `${spacing.xl} ${spacing.xxxxl}`,
    borderRadius: borderRadius.xl,
    border: 'none',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  lockInButtonActive: {
    backgroundColor: colors.success.main,
    color: colors.text.primary,
    boxShadow: shadows.md,
    opacity: 1,
  },

  lockInButtonDisabled: {
    backgroundColor: colors.button.disabled,
    color: colors.text.primary,
    cursor: 'not-allowed',
    opacity: 0.5,
    boxShadow: 'none',
  },

  // Success confirmation
  successConfirmation: {
    padding: spacing.xxl,
    backgroundColor: colors.background.darkBlue,
    borderRadius: borderRadius.xl,
    border: `2px solid ${colors.success.main}`,
    textAlign: 'center',
  },

  successIcon: {
    fontSize: '3em',
    marginBottom: spacing.md,
  },

  successTitle: {
    color: colors.success.light,
    margin: `0 0 ${spacing.md} 0`,
  },

  successMessage: {
    color: colors.text.secondary,
    margin: 0,
    fontSize: fontSize.normal,
    lineHeight: '1.5',
  },
};

// Step conditional styling helpers
export const getStepContainerStyle = (stepNumber, currentStep, isSetupCommitted, stepValidation) => {
  const baseStyle = stepStyles.stepContainer;

  if (stepNumber === 1) {
    return {
      ...baseStyle,
      border: !isSetupCommitted
        ? `2px solid ${colors.success.main}`
        : `2px solid ${colors.border.light}`,
    };
  }

  if (stepNumber === 2) {
    return {
      ...baseStyle,
      border: !isSetupCommitted
        ? `3px solid ${colors.warning.dark}`
        : `2px solid ${colors.border.light}`,
    };
  }

  if (stepNumber === 3) {
    if (!isSetupCommitted && currentStep === 3) {
      return stepStyles.step3ContainerActive;
    } else if (stepValidation?.step1Complete) {
      return stepStyles.step3ContainerComplete;
    } else {
      return stepStyles.step3ContainerInactive;
    }
  }

  return baseStyle;
};

export const getStepTitleColor = (stepNumber, isSetupCommitted, stepValidation) => {
  if (stepNumber === 2 && !isSetupCommitted) {
    return colors.warning.light; // Always active during setup
  }
  return colors.success.light;
};

// ---- Setup path choice (first screen after connecting) ----
// Two ways to lock in, presented as a fork rather than a default with an
// alternative buried underneath: neither is the "normal" one.
export const setupPathStyles = {
  container: {
    marginBottom: spacing.xxl,
    padding: spacing.xxl,
    border: `2px solid ${colors.success.main}`,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
    textAlign: "left",
  },

  title: {
    margin: `0 0 ${spacing.sm} 0`,
    color: colors.success.light,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
  },

  lede: {
    margin: `0 0 ${spacing.xxl} 0`,
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    lineHeight: 1.6,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: spacing.lg,
  },

  card: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.md,
    padding: spacing.xl,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.secondary,
  },

  cardTitle: {
    margin: 0,
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },

  cardBody: {
    margin: 0,
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    lineHeight: 1.6,
    flexGrow: 1,
  },

  footnote: {
    margin: `${spacing.xl} 0 0 0`,
    color: colors.text.muted,
    fontSize: fontSize.xs,
    lineHeight: 1.6,
  },

  backRow: {
    marginBottom: spacing.lg,
    textAlign: "left",
  },
};

export default stepStyles;