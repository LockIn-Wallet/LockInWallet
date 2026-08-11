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
 * Earning on vault balances is released.
 *
 * This flag no longer decides whether anyone sees it — the chain does. The
 * adapter reports `supported: false` when a network has no vault yield module
 * registered, and every earning surface renders nothing in that case. So on a
 * network where earning is not deployed, this being true changes nothing.
 *
 * Which means the real switch is now `registerModule("VAULT_YIELD", …)` on a
 * live chain, and that is the moment earning becomes visible to users there.
 * Two things must be true first, and neither is enforced by code:
 *   1. `SavingsVaultModule.setTreasury` points at the Safe, not the deployer.
 *   2. A verified Aave strategy is set for each coin that should earn.
 * See RELEASING.md.
 */
const YIELD_ENABLED = true;

export const isYieldEnabled = () => YIELD_ENABLED;

/**
 * Nav-link predicate: an entry carrying a `flag` only shows while that flag
 * is on. Shared so every nav surface hides the same links.
 */
export const isLinkVisible = (link) => !link.flag || link.flag();
