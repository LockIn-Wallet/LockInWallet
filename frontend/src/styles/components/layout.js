import { colors, spacing, borderRadius, fontSize } from '../theme.js';

// Layout styles extracted from App.js
export const layoutStyles = {
  // Main app container
  appContainer: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: spacing.xxl,
  },

  // Section containers
  section: {
    marginBottom: spacing.xxl,
  },

  sectionSmall: {
    marginBottom: spacing.xl,
  },

  // Header sections
  headerSection: {
    marginBottom: spacing.xxxl,
  },

  // Flex layouts
  flexBetween: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  flexBetweenWrap: {
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
    justifyContent: 'center',
  },

  flexStart: {
    display: 'flex',
    alignItems: 'flex-start',
  },

  flexColumn: {
    display: 'flex',
    flexDirection: 'column',
  },

  flexGap: {
    display: 'flex',
    gap: spacing.md,
  },

  flexGapSmall: {
    display: 'flex',
    gap: spacing.sm,
  },

  flexGapLarge: {
    display: 'flex',
    gap: spacing.lg,
  },

  flexAlignCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.lg,
  },

  flexAlignCenterSmall: {
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

  // Content positioning
  textCenter: {
    textAlign: 'center',
  },

  textLeft: {
    textAlign: 'left',
  },

  // Spacing utilities
  marginBottom: {
    marginBottom: spacing.xl,
  },

  marginBottomSmall: {
    marginBottom: spacing.lg,
  },

  marginBottomLarge: {
    marginBottom: spacing.xxl,
  },

  marginTop: {
    marginTop: spacing.xl,
  },

  marginTopSmall: {
    marginTop: spacing.lg,
  },

  marginRight: {
    marginRight: spacing.sm,
    marginTop: spacing.sm,
  },

  // Padding utilities
  padding: {
    padding: spacing.xxl,
  },

  paddingSmall: {
    padding: spacing.lg,
  },

  paddingVertical: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // Position utilities
  relative: {
    position: 'relative',
  },

  absolute: {
    position: 'absolute',
  },

  // Z-index utilities
  zIndex10: {
    zIndex: 10,
  },

  // Width utilities
  fullWidth: {
    width: '100%',
  },

  // Connection status layout
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Network selection layout
  networkSelection: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },

  networkSelectionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  },

  // Status badge layout
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.lg,
  },

  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Withdrawal destination layout
  withdrawalDestination: {
    marginBottom: spacing.sm,
  },

  withdrawalDestinationItem: {
    display: 'flex',
    alignItems: 'flex-start',
    cursor: 'pointer',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },

  withdrawalDestinationContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flex: 1,
  },

  withdrawalDestinationInfo: {
    flex: 1,
  },

  // Address display layout
  addressContainer: {
    display: 'flex',
    gap: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  // Icon containers
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Loading states
  loadingContainer: {
    textAlign: 'center',
    color: colors.text.muted,
    padding: spacing.xxl,
  },

  // Empty states
  emptyState: {
    textAlign: 'center',
    color: colors.text.placeholder,
    padding: spacing.xxl,
  },

  // Separator
  separator: {
    borderTop: `1px solid ${colors.border.default}`,
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
  },

  // Border utilities
  borderTop: {
    borderTop: `1px solid ${colors.border.default}`,
  },

  borderBottom: {
    borderBottom: `1px solid ${colors.border.default}`,
  },

  borderLeft: {
    borderLeft: `3px solid ${colors.warning.light}`,
  },

  // Overlay
  overlay: {
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

  // Responsive utilities
  hiddenOnMobile: {
    '@media (max-width: 768px)': {
      display: 'none',
    },
  },

  stackOnMobile: {
    '@media (max-width: 768px)': {
      flexDirection: 'column',
      gap: spacing.lg,
    },
  },
};

export default layoutStyles;