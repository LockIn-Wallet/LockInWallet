import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme.js';

// Card and container styles extracted from App.js
export const cardStyles = {
  // Main app container
  appContainer: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: spacing.xxl,
  },

  // Main title
  mainTitle: {
    margin: `0 0 ${spacing.xxl} 0`,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.text.dark,
  },

  // Status info card (wallet connection info)
  statusCard: {
    padding: spacing.xxl,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
    boxShadow: shadows.sm,
  },

  // Balance section card
  balanceCard: {
    marginBottom: spacing.xxl,
    padding: spacing.xl,
    border: `2px solid ${colors.success.main}`,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
  },

  // Educational intro card
  educationalCard: {
    marginBottom: spacing.xxl,
    padding: spacing.lg,
    backgroundColor: colors.background.darkBlue,
    border: `2px solid ${colors.success.main}`,
    borderRadius: borderRadius.xl,
    color: colors.text.primary,
  },

  // Individual balance token card
  tokenCard: {
    padding: spacing.lg,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
  },

  // Recommended token card
  tokenCardRecommended: {
    backgroundColor: colors.success.bg,
    border: `2px solid ${colors.success.main}`,
  },

  // Deposit section card
  depositCard: {
    marginBottom: spacing.xxl,
    padding: spacing.xl,
    border: `2px solid ${colors.border.light}`,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
    position: 'relative',
  },

  // Inactive overlay for deposit card
  depositCardInactive: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSize.lg,
    color: colors.text.muted,
    zIndex: 10,
  },

  // Proxy address card states
  proxyCardPending: {
    padding: spacing.xl,
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    textAlign: 'center',
  },

  proxyCardDeploying: {
    padding: spacing.xl,
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    textAlign: 'center',
  },

  proxyCardDeployed: {
    padding: spacing.xl,
    backgroundColor: colors.background.dark,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.success.main}`,
  },

  // Warning card
  warningCard: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    border: `2px solid ${colors.error.alt}`,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.error.bg,
    color: colors.error.dark,
  },

  // Spending limit card
  limitCard: {
    padding: spacing.xxl,
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xl,
  },

  // Spending limit card active state
  limitCardActive: {
    backgroundColor: colors.background.darkBlue,
    border: `2px solid ${colors.success.main}`,
  },

  // Custom period card
  customPeriodCard: {
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },

  // Progress tip card
  progressTipCard: {
    color: colors.text.muted,
    backgroundColor: colors.background.dark,
    borderLeft: `3px solid ${colors.warning.light}`,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },

  // Withdrawal info card
  withdrawalInfoCard: {
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },

  // Form section card
  formSectionCard: {
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },

  // Success confirmation card
  successCard: {
    padding: spacing.xxl,
    backgroundColor: colors.background.darkBlue,
    borderRadius: borderRadius.xl,
    border: `2px solid ${colors.success.main}`,
    textAlign: 'center',
  },

  // Error alert card
  errorCard: {
    backgroundColor: colors.warning.bgAlt,
    border: `1px solid ${colors.warning.main}`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
};

// Layout styles
export const layoutStyles = {
  // Flex layouts
  flexBetween: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxl,
    flexWrap: 'wrap',
    gap: spacing.xl,
  },

  flexCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.lg,
  },

  flexCenterSmall: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Grid layouts
  tokenGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: spacing.lg,
  },

  balanceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: spacing.lg,
  },

  // Section margins
  sectionMargin: {
    marginBottom: spacing.xxl,
  },

  smallSectionMargin: {
    marginBottom: spacing.xl,
  },
};

export default {
  cardStyles,
  layoutStyles,
};