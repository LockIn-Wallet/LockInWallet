/** @type {import('tailwindcss').Config} */
// Tailwind is scoped to the Savings Visualiser only. The rest of the app uses
// the design-token style system in src/styles, so:
//   - `content` lists just the visualiser files, keeping the generated CSS small
//   - `preflight` is off, because Tailwind's global reset would restyle every
//     other page in the app
module.exports = {
  content: [
    "./src/components/pages/SavingsVisualiser.js",
    "./src/components/molecules/Visualiser*.js",
    "./src/components/molecules/{WealthChart,GoalProgress,FutureSelfSnapshot,ScenarioComparison}.js",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      // The visualiser is embedded in the landing page, so its palette is
      // remapped onto the design tokens in src/styles/theme.js: `slate` is the
      // neutral surface/text ramp, and every accent ramp collapses onto the
      // single mint so the page keeps one accent.
      colors: {
        slate: {
          50: "#f1f3f4",
          100: "#e8eaec",
          200: "#c7cbce",
          300: "#a7afb5",
          400: "#8b9298",
          500: "#5b6469",
          600: "#2a3236",
          700: "#12181a",
          800: "#0e1214",
          900: "#0a0c0d",
          950: "#08090a",
        },
        primary: {
          50: "#e9faf3",
          100: "#c9f3e2",
          200: "#a2edcb",
          300: "#7ee3b8",
          400: "#6fd9a8",
          500: "#5cc795",
          600: "#3f9d72",
          700: "#2a5a45",
          800: "#1c3f30",
          900: "#12241c",
        },
        purple: {
          200: "#c9f3e2",
          300: "#a2edcb",
          400: "#7ee3b8",
          500: "#6fd9a8",
          600: "#3f9d72",
          700: "#2a5a45",
          800: "#1c3f30",
          900: "#12241c",
        },
        teal: {
          200: "#c9f3e2",
          300: "#a2edcb",
          400: "#7ee3b8",
          500: "#6fd9a8",
          600: "#3f9d72",
          700: "#2a5a45",
          800: "#1c3f30",
          900: "#12241c",
        },
      },
    },
  },
  plugins: [],
};
