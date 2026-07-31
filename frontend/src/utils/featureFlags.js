/**
 * Central feature flags for the frontend.
 *
 * Solana login is disabled until the Solana programs are deployed.
 * Opt back in locally with REACT_APP_ENABLE_SOLANA=true.
 */
export const isSolanaEnabled = () =>
  process.env.REACT_APP_ENABLE_SOLANA === "true";

/**
 * Card purchases need the Transak credentials configured on the serverless
 * function, which the browser cannot see. This flag is how a deployment
 * declares that the backend half is in place.
 */
export const isOnrampEnabled = () =>
  process.env.REACT_APP_ENABLE_ONRAMP === "true";
