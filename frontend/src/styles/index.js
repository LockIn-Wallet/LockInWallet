// Main styles export file - Clean import/export pattern
// This file aggregates all style modules for easy importing

// =====================================
// DIRECT RE-EXPORTS (No renaming needed)
// =====================================

// Theme and base styles
export {
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
  // Aliased: `layout` is already taken by the layout style module below
  layout as layoutTokens,
  commonStyles,
  default as theme,
} from "./theme.js";

// Component styles
export {
  buttonStyles,
  buttonHoverEffects,
  default as buttons,
} from "./components/buttons.js";

export {
  cardStyles,
  layoutStyles as cardLayoutStyles,
  default as cards,
} from "./components/cards.js";

export {
  formStyles,
  formHandlers,
  default as forms,
} from "./components/forms.js";

export {
  stepStyles,
  getStepContainerStyle,
  getStepTitleColor,
  default as steps,
} from "./components/steps.js";

export { layoutStyles, default as layout } from "./components/layout.js";

export { modalStyles, default as modal } from "./components/modal.js";

export {
  appStyles,
  getAllowanceFill,
  default as app,
} from "./components/app.js";

export {
  landingStyles,
  getBarFill,
  default as landing,
} from "./components/landing.js";

export {
  homeStyles,
  getBarFillStyle,
  getConfettiPieceStyle,
  default as home,
} from "./components/home.js";

// Utility styles
export {
  utilityStyles,
  spacingUtilities,
  default as utilities,
} from "./utilities.js";

// =====================================
// NAMESPACE IMPORTS (For convenience objects)
// =====================================

import * as theme from "./theme.js";
import * as buttons from "./components/buttons.js";
import * as cards from "./components/cards.js";
import * as forms from "./components/forms.js";
import * as steps from "./components/steps.js";
import * as layout from "./components/layout.js";
import * as home from "./components/home.js";
import * as landing from "./components/landing.js";
import * as app from "./components/app.js";
import * as utilities from "./utilities.js";

// =====================================
// CONVENIENCE EXPORTS (Clean references)
// =====================================

// Convenience exports for commonly used styles
export const styles = {
  // App structure
  app: {
    container: {
      maxWidth: "800px",
      margin: "0 auto",
      padding: theme.spacing.xxl,
      position: "relative", // Allow absolute positioning within container
    },
    // Wider shell for dashboard-style pages (e.g. the Savings Visualiser)
    containerWide: {
      maxWidth: "1400px",
      margin: "0 auto",
      padding: theme.spacing.xxl,
      position: "relative",
    },
    // The landing page brings its own nav, gutters and footer, so the shell
    // gets out of its way entirely
    containerLanding: {
      width: "100%",
      margin: 0,
      padding: 0,
      position: "relative",
    },
    title: {
      margin: `0 0 ${theme.spacing.xxl} 0`,
      fontSize: theme.fontSize.title,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.primary.main,
    },
    logo: {
      height: theme.fontSize.hero, // Bigger than title (2.5em vs 2.2em)
      width: 'auto',
      margin: `0 auto ${theme.spacing.xxl} auto`, // Center horizontally and bottom spacing
      maxWidth: '400px', // Allow for bigger logos
      display: 'block', // Ensure proper spacing and centering
    },
  },

  // Social media links
  socialLinks: {
    container: {
      position: "absolute",
      top: theme.spacing.lg,
      right: theme.spacing.lg,
      display: "flex",
      gap: theme.spacing.md,
      zIndex: 10,
    },
    link: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      transition: "all 0.2s ease",
      textDecoration: "none",
      border: `1px solid ${theme.colors.border.default}`,
      '&:hover': {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        transform: "translateY(-1px)",
      },
    },
    icon: {
      width: "18px",
      height: "18px",
      fill: theme.colors.text.secondary,
    },
  },

  // Common buttons
  buttons: {
    primary: buttons.buttonStyles.primary,
    secondary: buttons.buttonStyles.secondary,
    success: buttons.buttonStyles.success,
    warning: buttons.buttonStyles.warning,
    danger: buttons.buttonStyles.danger,
    disabled: buttons.buttonStyles.disabled,
  },

  // Common cards
  cards: {
    main: cards.cardStyles.statusCard,
    balance: cards.cardStyles.balanceCard,
    section: cards.cardStyles.depositCard,
    success: cards.cardStyles.successCard,
    warning: cards.cardStyles.warningCard,
  },

  // Common forms
  forms: {
    input: forms.formStyles.input,
    select: forms.formStyles.select,
    label: forms.formStyles.label,
    description: forms.formStyles.description,
  },

  // Common layouts
  layout: {
    flexBetween: layout.layoutStyles.flexBetween,
    flexCenter: layout.layoutStyles.flexCenter,
    flexGap: layout.layoutStyles.flexGap,
    section: layout.layoutStyles.section,
    textCenter: layout.layoutStyles.textCenter,
  },

  // Common text styles
  text: {
    primary: utilities.utilityStyles.textPrimary,
    secondary: utilities.utilityStyles.textSecondary,
    muted: utilities.utilityStyles.textMuted,
    success: utilities.utilityStyles.textSuccess,
    warning: utilities.utilityStyles.textWarning,
    error: utilities.utilityStyles.textError,
  },
};

// =====================================
// DEFAULT EXPORT (Clean structure)
// =====================================

// Default export with all styles
export default {
  // Organized namespaces
  theme,
  buttons,
  cards,
  forms,
  steps,
  layout,
  home,
  landing,
  app,
  utilities,

  // Convenience object
  styles,

  // Direct access to theme values (for compatibility)
  colors: theme.colors,
  spacing: theme.spacing,
  borderRadius: theme.borderRadius,
  fontSize: theme.fontSize,
  fontWeight: theme.fontWeight,
  shadows: theme.shadows,
  transitions: theme.transitions,

  // Direct access to style objects (for compatibility)
  buttonStyles: buttons.buttonStyles,
  cardStyles: cards.cardStyles,
  formStyles: forms.formStyles,
  stepStyles: steps.stepStyles,
  layoutStyles: layout.layoutStyles,
  homeStyles: home.homeStyles,
  landingStyles: landing.landingStyles,
  appStyles: app.appStyles,
  utilityStyles: utilities.utilityStyles,
};
