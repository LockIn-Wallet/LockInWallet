// Theme constants for LockIn Wallet
// Extracted from App.js inline styles for better maintainability

export const colors = {
  // Primary brand colors
  primary: {
    main: '#48bb78',
    light: '#9ae6b4',
    lighter: '#68d391',
  },

  // Background colors
  background: {
    primary: '#2d3748',
    secondary: '#4a5568',
    dark: '#1a202c',
    darker: '#1a1a1a',
    darkBlue: '#1a365d',
    light: '#e2e8f0',
  },

  // Text colors
  text: {
    primary: 'white',
    secondary: '#e2e8f0',
    muted: '#a0aec0',
    light: '#cbd5e0',
    gray: '#718096',
    dark: '#1a202c',
    placeholder: '#666',
  },

  // Status colors
  success: {
    main: '#48bb78',
    light: '#9ae6b4',
    bg: '#1a365d',
    border: '#48bb78',
  },

  warning: {
    main: '#ed8936',
    light: '#f6ad55',
    dark: '#d69e2e',
    bg: '#744210',
    bgAlt: '#2a1810',
  },

  error: {
    main: '#e53e3e',
    light: '#fc8181',
    alt: '#f56565',
    dark: '#c53030',
    bg: '#fed7d7',
  },

  // Interactive colors
  button: {
    primary: '#3182ce',
    primaryHover: '#2c5aa0',
    secondary: '#4a5568',
    disabled: '#4a5568',
  },

  // Border colors
  border: {
    default: '#4a5568',
    light: '#333',
    active: '#d69e2e',
    success: '#48bb78',
    warning: '#ed8936',
    error: '#e53e3e',
    info: '#2b77ad',
  },

  // Special colors
  accent: {
    pink: '#fbb6ce',
    purple: '#ed64a6',
    blue: '#63b3ed',
    cyan: '#2b77ad',
  },
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '10px',
  lg: '12px',
  xl: '15px',
  xxl: '20px',
  xxxl: '25px',
  xxxxl: '30px',
};

export const borderRadius = {
  sm: '4px',
  md: '5px',
  lg: '6px',
  xl: '8px',
};

export const fontSize = {
  xs: '0.7em',
  sm: '0.8em',
  md: '0.85em',
  normal: '0.9em',
  lg: '1.1em',
  xl: '1.2em',
  xxl: '1.3em',
  xxxl: '1.4em',
  title: '2.2em',
  hero: '2.5em',
};

export const fontWeight = {
  normal: 'normal',
  medium: '500',
  semibold: '600',
  bold: 'bold',
};

export const shadows = {
  sm: '0 4px 6px rgba(0, 0, 0, 0.1)',
  md: '0 4px 12px rgba(72, 187, 120, 0.4)',
  glow: '0 0 0 1px rgba(214, 158, 46, 0.3)',
};

export const transitions = {
  fast: 'all 0.15s ease',
  normal: 'all 0.2s ease',
  slow: 'all 0.3s ease',
};

// Common style combinations
export const commonStyles = {
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.default}`,
  },

  button: {
    borderRadius: borderRadius.xl,
    padding: `${spacing.xl} ${spacing.xxxxl}`,
    border: 'none',
    cursor: 'pointer',
    transition: transitions.normal,
    fontWeight: fontWeight.bold,
  },

  input: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.primary,
    color: colors.text.secondary,
  },

  flexCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  flexBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
};

export default {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  transitions,
  commonStyles,
};