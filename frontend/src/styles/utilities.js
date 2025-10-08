import { colors, spacing, fontSize, fontWeight } from './theme.js';

// Utility styles for common patterns and typography
export const utilityStyles = {
  // Typography
  heading1: {
    margin: `0 0 ${spacing.xxl} 0`,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.text.dark,
  },

  heading2: {
    margin: `0 0 ${spacing.xl} 0`,
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.semibold,
    color: colors.success.main,
  },

  heading3: {
    margin: `0 0 ${spacing.xl} 0`,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
    color: colors.success.light,
  },

  heading4: {
    margin: `0 0 ${spacing.lg} 0`,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },

  heading5: {
    margin: `0 0 ${spacing.md} 0`,
    fontSize: fontSize.normal,
    fontWeight: fontWeight.semibold,
  },

  // Body text
  bodyText: {
    fontSize: fontSize.normal,
    lineHeight: '1.5',
    color: colors.text.secondary,
  },

  bodyTextMuted: {
    fontSize: fontSize.normal,
    lineHeight: '1.4',
    color: colors.text.muted,
  },

  bodyTextSmall: {
    fontSize: fontSize.sm,
    lineHeight: '1.4',
    color: colors.text.muted,
  },

  // Status text
  statusText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },

  // Labels and captions
  label: {
    fontSize: fontSize.normal,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },

  caption: {
    fontSize: fontSize.xs,
    color: colors.text.gray,
  },

  // Link styles
  link: {
    color: colors.button.primary,
    textDecoration: 'none',
    cursor: 'pointer',
  },

  linkHover: {
    color: colors.button.primaryHover,
    textDecoration: 'underline',
  },

  // Color utilities
  textPrimary: {
    color: colors.text.primary,
  },

  textSecondary: {
    color: colors.text.secondary,
  },

  textMuted: {
    color: colors.text.muted,
  },

  textLight: {
    color: colors.text.light,
  },

  textGray: {
    color: colors.text.gray,
  },

  textSuccess: {
    color: colors.success.light,
  },

  textWarning: {
    color: colors.warning.light,
  },

  textError: {
    color: colors.error.light,
  },

  textAccentPink: {
    color: colors.accent.pink,
  },

  // Background utilities
  bgPrimary: {
    backgroundColor: colors.background.primary,
  },

  bgSecondary: {
    backgroundColor: colors.background.secondary,
  },

  bgDark: {
    backgroundColor: colors.background.dark,
  },

  bgDarkBlue: {
    backgroundColor: colors.background.darkBlue,
  },

  bgSuccess: {
    backgroundColor: colors.success.bg,
  },

  bgWarning: {
    backgroundColor: colors.warning.bg,
  },

  bgError: {
    backgroundColor: colors.error.bg,
  },

  // Display utilities
  block: {
    display: 'block',
  },

  inlineBlock: {
    display: 'inline-block',
  },

  flex: {
    display: 'flex',
  },

  inlineFlex: {
    display: 'inline-flex',
  },

  grid: {
    display: 'grid',
  },

  hidden: {
    display: 'none',
  },

  // Text alignment
  textLeft: {
    textAlign: 'left',
  },

  textCenter: {
    textAlign: 'center',
  },

  textRight: {
    textAlign: 'right',
  },

  // Font weight utilities
  fontNormal: {
    fontWeight: fontWeight.normal,
  },

  fontMedium: {
    fontWeight: fontWeight.medium,
  },

  fontSemibold: {
    fontWeight: fontWeight.semibold,
  },

  fontBold: {
    fontWeight: fontWeight.bold,
  },

  // Cursor utilities
  pointer: {
    cursor: 'pointer',
  },

  default: {
    cursor: 'default',
  },

  notAllowed: {
    cursor: 'not-allowed',
  },

  // Word break utilities
  wordBreak: {
    wordBreak: 'break-all',
  },

  wordWrap: {
    wordWrap: 'break-word',
  },

  // Opacity utilities
  opacity0: {
    opacity: 0,
  },

  opacity25: {
    opacity: 0.25,
  },

  opacity50: {
    opacity: 0.5,
  },

  opacity75: {
    opacity: 0.75,
  },

  opacity100: {
    opacity: 1,
  },

  // Special utility combinations
  statusIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },

  statusIndicatorConnected: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: colors.success.main,
    display: 'inline-block',
  },

  statusIndicatorDisconnected: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: colors.error.main,
    display: 'inline-block',
  },

  // Address text (monospace)
  addressText: {
    fontFamily: 'monospace',
    fontSize: fontSize.sm,
    wordBreak: 'break-all',
  },

  // Loading state
  loadingText: {
    fontSize: fontSize.normal,
    color: colors.text.muted,
    fontStyle: 'italic',
  },

  // Truncated text
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // Responsive text
  textResponsive: {
    fontSize: fontSize.normal,
    '@media (max-width: 768px)': {
      fontSize: fontSize.sm,
    },
  },

  // Hover effects
  hoverScale: {
    transition: 'transform 0.2s ease',
    ':hover': {
      transform: 'scale(1.05)',
    },
  },

  hoverOpacity: {
    transition: 'opacity 0.2s ease',
    ':hover': {
      opacity: 0.8,
    },
  },
};

// Spacing utilities (margin and padding)
export const spacingUtilities = {
  // Margin utilities
  m0: { margin: 0 },
  m1: { margin: spacing.xs },
  m2: { margin: spacing.sm },
  m3: { margin: spacing.md },
  m4: { margin: spacing.lg },
  m5: { margin: spacing.xl },
  m6: { margin: spacing.xxl },

  // Margin top
  mt0: { marginTop: 0 },
  mt1: { marginTop: spacing.xs },
  mt2: { marginTop: spacing.sm },
  mt3: { marginTop: spacing.md },
  mt4: { marginTop: spacing.lg },
  mt5: { marginTop: spacing.xl },
  mt6: { marginTop: spacing.xxl },

  // Margin bottom
  mb0: { marginBottom: 0 },
  mb1: { marginBottom: spacing.xs },
  mb2: { marginBottom: spacing.sm },
  mb3: { marginBottom: spacing.md },
  mb4: { marginBottom: spacing.lg },
  mb5: { marginBottom: spacing.xl },
  mb6: { marginBottom: spacing.xxl },

  // Margin left
  ml0: { marginLeft: 0 },
  ml1: { marginLeft: spacing.xs },
  ml2: { marginLeft: spacing.sm },
  ml3: { marginLeft: spacing.md },
  ml4: { marginLeft: spacing.lg },
  ml5: { marginLeft: spacing.xl },

  // Margin right
  mr0: { marginRight: 0 },
  mr1: { marginRight: spacing.xs },
  mr2: { marginRight: spacing.sm },
  mr3: { marginRight: spacing.md },
  mr4: { marginRight: spacing.lg },
  mr5: { marginRight: spacing.xl },

  // Padding utilities
  p0: { padding: 0 },
  p1: { padding: spacing.xs },
  p2: { padding: spacing.sm },
  p3: { padding: spacing.md },
  p4: { padding: spacing.lg },
  p5: { padding: spacing.xl },
  p6: { padding: spacing.xxl },

  // Padding top
  pt0: { paddingTop: 0 },
  pt1: { paddingTop: spacing.xs },
  pt2: { paddingTop: spacing.sm },
  pt3: { paddingTop: spacing.md },
  pt4: { paddingTop: spacing.lg },
  pt5: { paddingTop: spacing.xl },
  pt6: { paddingTop: spacing.xxl },

  // Padding bottom
  pb0: { paddingBottom: 0 },
  pb1: { paddingBottom: spacing.xs },
  pb2: { paddingBottom: spacing.sm },
  pb3: { paddingBottom: spacing.md },
  pb4: { paddingBottom: spacing.lg },
  pb5: { paddingBottom: spacing.xl },
  pb6: { paddingBottom: spacing.xxl },
};

export default {
  utilityStyles,
  spacingUtilities,
};