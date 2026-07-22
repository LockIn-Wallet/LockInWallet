/**
 * Central feature flags for the frontend.
 *
 * Solana login is disabled until the Solana programs are deployed.
 * Opt back in locally with REACT_APP_ENABLE_SOLANA=true.
 */
export const isSolanaEnabled = () =>
  process.env.REACT_APP_ENABLE_SOLANA === "true";
