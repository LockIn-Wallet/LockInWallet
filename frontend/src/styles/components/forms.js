import { colors, spacing, borderRadius, fontSize, fontWeight, transitions } from '../theme.js';

// Form and input styles extracted from App.js
export const formStyles = {
  // Input fields
  input: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.primary,
    color: colors.text.secondary,
    fontSize: fontSize.normal,
    transition: transitions.fast,
    width: '100%',
  },

  // Input hover/focus states
  inputHover: {
    color: colors.text.secondary,
    borderColor: colors.text.gray,
  },

  inputFocus: {
    color: colors.text.secondary,
    borderColor: colors.text.gray,
    outline: 'none',
  },

  // Select dropdowns
  select: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.secondary,
    color: colors.text.primary,
    fontSize: fontSize.normal,
    cursor: 'pointer',
    marginLeft: spacing.md,
  },

  // Large select dropdowns
  selectLarge: {
    padding: `${spacing.lg} ${spacing.xl}`,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.secondary,
    color: colors.text.primary,
    fontSize: fontSize.lg,
    cursor: 'pointer',
    minWidth: '200px',
  },

  // Labels
  label: {
    display: 'block',
    fontSize: fontSize.normal,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },

  // Form sections
  formSection: {
    marginBottom: spacing.xl,
  },

  // Input containers
  inputContainer: {
    marginBottom: spacing.xl,
  },

  inputContainerSmall: {
    marginBottom: spacing.sm,
  },

  // Form groups with flex layout
  formGroup: {
    display: 'flex',
    gap: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  formGroupVertical: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  // Amount input special styling
  amountInput: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.primary,
    color: colors.text.secondary,
    fontSize: fontSize.lg,
    textAlign: 'center',
    width: '120px',
  },

  // Token selection styling
  tokenSelect: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.secondary,
    color: colors.text.primary,
    fontSize: fontSize.normal,
    cursor: 'pointer',
    minWidth: '100px',
  },

  // Custom period inputs
  customPeriodInput: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.primary,
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    width: '80px',
    textAlign: 'center',
  },

  // Validation states
  inputError: {
    border: `1px solid ${colors.error.main}`,
    backgroundColor: colors.background.primary,
  },

  inputSuccess: {
    border: `1px solid ${colors.success.main}`,
    backgroundColor: colors.background.primary,
  },

  inputWarning: {
    border: `1px solid ${colors.warning.main}`,
    backgroundColor: colors.background.primary,
  },

  // Helper text
  helperText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },

  helperTextError: {
    fontSize: fontSize.sm,
    color: colors.error.main,
    marginTop: spacing.xs,
  },

  helperTextSuccess: {
    fontSize: fontSize.sm,
    color: colors.success.light,
    marginTop: spacing.xs,
  },

  // Field labels with icons
  fieldLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    fontSize: fontSize.normal,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    fontWeight: fontWeight.medium,
  },

  // Form descriptions
  description: {
    fontSize: fontSize.normal,
    color: colors.text.light,
    marginBottom: spacing.xl,
    lineHeight: '1.5',
  },

  descriptionMuted: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginBottom: spacing.lg,
    lineHeight: '1.4',
  },

  // Input with button combinations
  inputButtonGroup: {
    display: 'flex',
    gap: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  // Address display (read-only)
  addressDisplay: {
    padding: spacing.lg,
    backgroundColor: colors.background.dark,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.lg,
    color: colors.text.primary,
    fontFamily: 'monospace',
    fontSize: fontSize.sm,
    wordBreak: 'break-all',
    marginBottom: spacing.lg,
  },
};

// Form interaction handlers
export const formHandlers = {
  inputHover: (e) => {
    e.target.style.color = colors.text.secondary;
    e.target.style.borderColor = colors.text.gray;
  },

  inputBlur: (e) => {
    e.target.style.color = colors.text.muted;
    e.target.style.borderColor = colors.border.default;
  },

  inputFocus: (e) => {
    e.target.style.color = colors.text.secondary;
    e.target.style.borderColor = colors.text.gray;
  },
};

export default formStyles;