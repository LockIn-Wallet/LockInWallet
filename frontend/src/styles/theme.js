// Design tokens for LockIn Wallet.
//
// One accent (mint) carries every "verified / active / enforced" signal;
// everything else stays near-neutral so the accent reads as meaningful
// rather than decorative. Reading text is set in the system sans; anything
// that is the machine talking — amounts, clocks, addresses, status — is set
// in IBM Plex Mono, so users can tell our words from the contract's.

export const colors = {
  // Mint accent — the single carrier of "enforced / verified / active"
  primary: {
    main: "#7ee3b8",
    light: "#a2edcb",
    lighter: "#6fd9a8",
  },

  // Near-neutral surfaces, darkest to lightest
  background: {
    dark: "#0a0c0d", // recessed / nested inside a surface
    primary: "#0e1214", // default card surface
    secondary: "#12181a", // raised control
    darker: "#08090a", // deepest well
    darkBlue: "#12241c", // accent wash (mint-tinted surface)
    light: "#e8eaec",
  },

  text: {
    primary: "#e8eaec",
    secondary: "#c7cbce",
    light: "#a7afb5",
    muted: "#8b9298",
    gray: "#5b6469",
    dark: "#0b0d0f",
    onAccent: "#08130e", // text sitting on a mint fill
    placeholder: "#5b6469",
  },

  success: {
    main: "#6fd9a8",
    light: "#7ee3b8",
    bg: "#12241c",
    border: "#2a5a45",
  },

  // Amber, desaturated to sit in a near-neutral palette without shouting
  warning: {
    main: "#d9a961",
    light: "#e8c489",
    dark: "#a87f43",
    bg: "#241c10",
    bgAlt: "#1a150c",
  },

  // Negatives are stated, not alarmed — a soft clay red, never fire-engine
  error: {
    main: "#d98a8a",
    light: "#e0a4a4",
    alt: "#cf7f7f",
    dark: "#a35f5f",
    bg: "#241416",
  },

  button: {
    primary: "#7ee3b8",
    primaryHover: "#a2edcb",
    secondary: "#12181a",
    disabled: "#12181a",
  },

  border: {
    hairline: "#16191b",
    light: "#16191b",
    default: "#232b2e",
    strong: "#2a3236",
    accent: "#223a2e",
    active: "#d9a961",
    success: "#2a5a45",
    warning: "#a87f43",
    error: "#a35f5f",
    info: "#223a2e",
  },

  accent: {
    pink: "#dda5c0",
    purple: "#b49ae0",
    blue: "#8fb8dd",
    cyan: "#7ec9d3",
  },

  wallet: {
    metamask: "#F6851B",
    metamaskHover: "#E2761B",
    phantom: "#AB9FF2",
    phantomHover: "#9580E8",
  },
};

// Compact scale used by the in-app screens
export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "10px",
  lg: "12px",
  xl: "15px",
  xxl: "20px",
  xxxl: "25px",
  xxxxl: "30px",
};

// Wider scale for page-level composition (landing sections, section rhythm)
export const space = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "24px",
  6: "32px",
  7: "40px",
  8: "56px",
  9: "72px",
  10: "100px",
};

export const borderRadius = {
  sm: "6px",
  md: "8px",
  lg: "10px",
  xl: "12px",
  xxl: "16px",
  pill: "100px",
};

// Relative scale retained by the in-app screens (nests inside sized parents)
export const fontSize = {
  xs: "0.7em",
  sm: "0.8em",
  md: "0.85em",
  normal: "0.9em",
  lg: "1.1em",
  xl: "1.2em",
  xxl: "1.3em",
  xxxl: "1.4em",
  title: "2.2em",
  hero: "3em",
};

// Absolute type scale — page-level headings and data readouts
export const type = {
  micro: "11px",
  caption: "12px",
  small: "13px",
  body: "14.5px",
  bodyLg: "16px",
  lead: "18px",
  h4: "17px",
  h3: "19px",
  h2: "clamp(28px, 3.6vw, 42px)",
  h1: "clamp(36px, 5.6vw, 66px)",
  stat: "34px",
};

export const fontFamily = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif',
  // Reserved for machine output: amounts, clocks, addresses, status pills
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

export const fontWeight = {
  normal: "normal",
  medium: "500",
  semibold: "600",
  bold: "bold",
};

export const letterSpacing = {
  tight: "-0.02em",
  snug: "-0.01em",
  wide: "0.05em",
  wider: "0.08em",
};

export const shadows = {
  sm: "0 4px 6px rgba(0, 0, 0, 0.3)",
  md: "0 6px 20px rgba(0, 0, 0, 0.35)",
  glow: "0 0 0 1px rgba(126, 227, 184, 0.25)",
};

export const transitions = {
  fast: "all 0.15s ease",
  normal: "all 0.2s ease",
  slow: "all 0.3s ease",
};

// Page-level layout constants
export const layout = {
  pageMax: "1200px",
  contentMax: "1100px",
  proseMax: "600px",
  gutter: "48px",
  gutterMobile: "20px",
};

// Common style combinations
export const commonStyles = {
  card: {
    borderRadius: borderRadius.xxl,
    padding: spacing.xxl,
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.hairline}`,
  },

  button: {
    borderRadius: borderRadius.md,
    padding: `${spacing.xl} ${spacing.xxxxl}`,
    border: "none",
    cursor: "pointer",
    transition: transitions.normal,
    fontWeight: fontWeight.semibold,
  },

  input: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.secondary,
    color: colors.text.secondary,
  },

  mono: {
    fontFamily: fontFamily.mono,
  },

  flexCenter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  flexBetween: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
};

export default {
  colors,
  spacing,
  space,
  borderRadius,
  fontSize,
  type,
  fontFamily,
  fontWeight,
  letterSpacing,
  shadows,
  transitions,
  layout,
  commonStyles,
};
