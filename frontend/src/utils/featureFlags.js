/**
 * Central feature flags for the frontend.
 *
 * Solana login is disabled until the Solana programs are deployed.
 * Opt back in locally with REACT_APP_ENABLE_SOLANA=true.
 */
export const isSolanaEnabled = () =>
  process.env.REACT_APP_ENABLE_SOLANA === "true";

/**
 * The PoolTogether prize pool (vault toggle, prize claims and the
 * /prize-savings page) is unfinished, so it stays hidden — route, navigation
 * and wallet UI alike. Hardcoded rather than read from the environment: it is
 * off for everyone until the feature ships, so flip this line to bring it back.
 */
const PRIZE_POOL_ENABLED = false;

export const isPrizePoolEnabled = () => PRIZE_POOL_ENABLED;

/**
 * Nav-link predicate: an entry carrying a `flag` only shows while that flag
 * is on. Shared so every nav surface hides the same links.
 */
export const isLinkVisible = (link) => !link.flag || link.flag();
