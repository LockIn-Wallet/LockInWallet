// Pure helpers for locked vaults: the rule a lock can carry, what a draft
// must satisfy before it is sent, and how a rule reads in plain words.
//
// A locked vault is an immutable contract that releases everything to its
// owner when its rule is met. Every lock also carries a deadline: however the
// rule is built, the money is released on that date at the latest, so no
// oracle failure can ever strand it.

const DAY = 86400;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export const LOCK_RULE_TYPES = { date: "date", price: "price" };

// Mirrors LockedVaultFactory.MAX_LOCK_HORIZON (3650 days).
export const MAX_LOCK_HORIZON_SECONDS = 3650 * DAY;

// Mirrors the factory's ConditionKind enum, by index.
export const CONDITION_KINDS = ["None", "Date", "Price", "AllOf", "AnyOf"];

// A price feed that has not updated for a day is treated as locked. Chainlink
// heartbeats are minutes to an hour, so a day of silence means the feed is
// gone, and the deadline is what releases the money then.
export const DEFAULT_PRICE_STALENESS_SECONDS = DAY;

export const DATE_PRESETS = [
  { label: "3 months", seconds: 3 * MONTH },
  { label: "6 months", seconds: 6 * MONTH },
  { label: "1 year", seconds: YEAR },
  { label: "2 years", seconds: 2 * YEAR },
];

export const PRICE_DIRECTIONS = [
  { value: "above", label: "rises to or above" },
  { value: "below", label: "falls to or below" },
];

/** Price feeds the app will mark as verified on this network. */
export const getPriceFeeds = (networkConfig) => networkConfig?.priceFeeds || [];

export const findPriceFeed = (networkConfig, feedAddress) =>
  getPriceFeeds(networkConfig).find(
    (feed) => feed.address.toLowerCase() === String(feedAddress || "").toLowerCase(),
  ) || null;

export const lockProofPath = (chainKey, lockAddress) => `/lock/${chainKey}/${lockAddress}`;

/** Unix seconds → "12 Mar 2027". */
export const formatLockDate = (unixSeconds) =>
  new Date(Number(unixSeconds) * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Unix seconds → "yyyy-mm-dd" for a date input. */
export const toDateInputValue = (unixSeconds) =>
  new Date(Number(unixSeconds) * 1000).toISOString().slice(0, 10);

/** "yyyy-mm-dd" from a date input → unix seconds at midnight UTC. */
export const fromDateInputValue = (value) => {
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
};

/** Whole days between two unix timestamps, never negative. */
export const daysUntil = (unixSeconds, now = Math.floor(Date.now() / 1000)) =>
  Math.max(0, Math.ceil((Number(unixSeconds) - now) / DAY));

/**
 * Validate a lock draft before anything is signed. Returns an error sentence
 * or null. `now` is injectable so the rules are testable.
 */
export const validateLockDraft = (draft, now = Math.floor(Date.now() / 1000)) => {
  const { ruleType, unlockAt, feed, threshold, deadline } = draft;
  const latest = now + MAX_LOCK_HORIZON_SECONDS;

  if (ruleType === LOCK_RULE_TYPES.date) {
    if (!unlockAt) return "Choose the date the lock opens.";
    if (unlockAt <= now) return "The unlock date has to be in the future.";
    if (unlockAt > latest) return "A lock can run for at most ten years.";
    return null;
  }

  if (ruleType === LOCK_RULE_TYPES.price) {
    if (!feed) return "Choose the price to watch.";
    if (!(Number(threshold) > 0)) return "Enter the price that opens the lock.";
    if (!deadline) return "Choose the date the lock opens at the latest.";
    if (deadline <= now) return "The latest unlock date has to be in the future.";
    if (deadline > latest) return "A lock can run for at most ten years.";
    return null;
  }

  return "Choose how the lock opens.";
};

/**
 * Plain-language description of a decoded lock, for the dashboard and the
 * public proof page alike.
 * @param {{deadline:number, condition:null|{kind:string, unlockAt?:number, feed?:string, threshold?:number, above?:boolean, feedLabel?:string}}} lock
 */
export const describeRule = (lock) => {
  const deadlineText = `on ${formatLockDate(lock.deadline)}`;
  const condition = lock.condition;

  if (!condition || condition.kind === "None" || condition.kind === "Date") {
    return `Opens ${deadlineText}.`;
  }

  if (condition.kind === "Price") {
    const feed = condition.feedLabel || "the price";
    const direction = condition.above ? "rises to or above" : "falls to or below";
    return `Opens when ${feed} ${direction} ${formatThreshold(condition.threshold)}, or ${deadlineText} at the latest.`;
  }

  const joiner = condition.kind === "AllOf" ? "all" : "any";
  return `Opens when ${joiner} of ${condition.members?.length || 0} conditions are met, or ${deadlineText} at the latest.`;
};

export const formatThreshold = (value) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });

/** How a lock reads at a glance: locked, ready to release, or released. */
export const lockStatus = (lock) => {
  if (!lock.unlocked) return "locked";
  return lock.hasBalance ? "ready" : "released";
};
