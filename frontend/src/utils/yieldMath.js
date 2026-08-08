/**
 * Rate conversions for the earning feature.
 *
 * Strategies report APR in basis points, because a contract has no business
 * doing floating-point compounding. Aave's supply rate compounds every second,
 * so the rate a user actually receives over a year is the compounded APY — and
 * quoting the APR as if it were the annual return understates it.
 */

export const SECONDS_PER_YEAR = 31536000; // 365 days, matching the contracts
export const MAX_BPS = 10000;

/**
 * Convert a strategy's APR in basis points into a compounded APY percentage.
 *
 * @param {number|bigint} aprBps annual rate in basis points (500 = 5% APR)
 * @returns {number} APY as a percentage (5% APR per-second compounded ≈ 5.13)
 */
export function aprBpsToApyPercent(aprBps) {
  const bps = Number(aprBps);
  // A missing or unreadable rate is reported as 0 rather than guessed at.
  if (!Number.isFinite(bps) || bps <= 0) return 0;

  const apr = bps / MAX_BPS;
  const apy = Math.pow(1 + apr / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1;
  return apy * 100;
}

/**
 * The rate the user keeps once the treasury's cut is taken. The fee is a share
 * of the rate, so it comes off the APY directly: 5% at a 100bps fee leaves 4%.
 *
 * @param {number} apyPercent gross APY percentage
 * @param {number|bigint} feeBps management fee in basis points of the rate
 * @returns {number} net APY percentage, never below zero
 */
export function netApyPercent(apyPercent, feeBps) {
  const gross = Number(apyPercent);
  const fee = Number(feeBps);
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  if (!Number.isFinite(fee) || fee <= 0) return gross;

  const net = gross - fee / 100;
  return net > 0 ? net : 0;
}

/** Display helper: "5.13" — always two decimals, so a rate never reads as exact. */
export function formatApyPercent(apyPercent) {
  const value = Number(apyPercent);
  if (!Number.isFinite(value) || value <= 0) return "0.00";
  return value.toFixed(2);
}
