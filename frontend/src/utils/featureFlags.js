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
 * Earning on vault balances (the "Earn on your savings" section and its
 * configure dialog) stays hidden until the vault yield module and an Aave
 * strategy are deployed and verified on a live network.
 *
 * Off for everyone by default, and the default is what ships: flip this line to
 * release it. The environment override exists only so the feature can be looked
 * at on a local chain — a build with `REACT_APP_ENABLE_YIELD=true` is a
 * deliberate act, and the flag is still off in every build that does not set it.
 */
const YIELD_ENABLED = false;

export const isYieldEnabled = () =>
  YIELD_ENABLED || process.env.REACT_APP_ENABLE_YIELD === "true";

/**
 * Nav-link predicate: an entry carrying a `flag` only shows while that flag
 * is on. Shared so every nav surface hides the same links.
 */
export const isLinkVisible = (link) => !link.flag || link.flag();
