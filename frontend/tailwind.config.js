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
      colors: {
        primary: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
      },
    },
  },
  plugins: [],
};
