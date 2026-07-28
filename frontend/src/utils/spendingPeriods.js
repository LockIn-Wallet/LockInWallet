// Spending period catalog — the single source of truth for which windows a
// limit can cover, how long each one runs, and how long the user must wait to
// bypass or change that limit.
//
// Adding a period (quarterly, a salary cycle) means adding one entry here: the
// contracts take periods as name/duration/limit/delay tuples, so nothing
// downstream is hardcoded to a fixed set.

const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export const SECONDS = { HOUR, DAY, WEEK, MONTH, YEAR };

/**
 * `unlockDelay` is the wait a bypass request or limit-change proposal for this
 * period has to serve. The defaults follow "wait one period", capped at a month
 * so the long windows stay usable: a daily cap costs 24 hours to move, a weekly
 * cap a week, and monthly or yearly caps a month.
 */
export const SPENDING_PERIODS = [
  { name: "Hourly", icon: "⏱️", duration: HOUR, defaultUnlockDelay: DAY },
  { name: "Daily", icon: "📅", duration: DAY, defaultUnlockDelay: DAY },
  { name: "Weekly", icon: "📊", duration: WEEK, defaultUnlockDelay: WEEK },
  { name: "Monthly", icon: "📈", duration: MONTH, defaultUnlockDelay: MONTH },
  { name: "Yearly", icon: "🗓️", duration: YEAR, defaultUnlockDelay: MONTH },
];

/** Periods shown by default — hourly is opt-in, most people don't want it. */
export const PRIMARY_PERIOD_NAMES = ["Daily", "Weekly", "Monthly", "Yearly"];

/** Wait times the user can pick from, matching the contract's 1h–90d bounds. */
export const UNLOCK_DELAY_OPTIONS = [
  { seconds: DAY, label: "24 hours" },
  { seconds: 3 * DAY, label: "3 days" },
  { seconds: WEEK, label: "1 week" },
  { seconds: 2 * WEEK, label: "2 weeks" },
  { seconds: MONTH, label: "1 month" },
  { seconds: 90 * DAY, label: "3 months" },
];

export const MIN_UNLOCK_DELAY = HOUR;
export const MAX_UNLOCK_DELAY = 90 * DAY;

/**
 * The wait a period gets when it has none of its own. Also the wait forced on
 * any period added after lock-in — the contract ignores a caller-chosen value
 * there, so a stolen key cannot add a dust-sized limit with a year-long wait
 * and freeze the wallet for that year.
 */
export const DEFAULT_UNLOCK_DELAY = DAY;

const periodsByName = new Map(SPENDING_PERIODS.map((period) => [period.name, period]));

export function getPeriod(name) {
  return periodsByName.get(name) || null;
}

export function getPeriodDuration(name) {
  return getPeriod(name)?.duration ?? null;
}

export function getDefaultUnlockDelay(name) {
  return getPeriod(name)?.defaultUnlockDelay ?? DAY;
}

/** Period names ordered shortest window first, as the contracts compare them. */
export function sortPeriodNames(names) {
  return [...names].sort(
    (a, b) => (getPeriodDuration(a) ?? 0) - (getPeriodDuration(b) ?? 0),
  );
}

/** Human-readable duration: 604800 -> "1 week". */
export function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return "—";

  const units = [
    { size: YEAR, one: "year", many: "years" },
    { size: MONTH, one: "month", many: "months" },
    { size: WEEK, one: "week", many: "weeks" },
    { size: DAY, one: "day", many: "days" },
    { size: HOUR, one: "hour", many: "hours" },
  ];

  for (const { size, one, many } of units) {
    if (total >= size && total % size === 0) {
      const count = total / size;
      return `${count} ${count === 1 ? one : many}`;
    }
  }
  return `${Math.round(total / HOUR)} hours`;
}

/**
 * Blank edit state for every period, pre-filled with each one's default wait.
 * Shape matches what the setup screens already expect, plus `unlockDelay`.
 */
export function createEmptyLimitEdits(periodNames = PRIMARY_PERIOD_NAMES) {
  return periodNames.reduce((edits, name) => {
    edits[name] = {
      value: "",
      unlockDelay: getDefaultUnlockDelay(name),
      isActive: false,
      isEditing: false,
    };
    return edits;
  }, {});
}

/**
 * Turn edit state into the period tuples the adapters take. Periods with no
 * amount entered are dropped.
 */
export function toPeriodEntries(limitEdits) {
  return sortPeriodNames(Object.keys(limitEdits || {}))
    .map((name) => {
      const edit = limitEdits[name];
      const limit = parseFloat(edit?.value);
      if (!Number.isFinite(limit) || limit <= 0) return null;
      return {
        name,
        limit,
        duration: getPeriodDuration(name),
        unlockDelay: Number(edit?.unlockDelay) || getDefaultUnlockDelay(name),
      };
    })
    .filter((entry) => entry !== null && entry.duration !== null);
}

/**
 * The same rule the contracts enforce: a shorter window may never allow more
 * spending than a longer one. Returns an error message, or null when valid.
 */
export function validatePeriodEntries(entries) {
  if (!entries || entries.length === 0) {
    return "Please set at least one spending limit";
  }
  for (const shorter of entries) {
    for (const longer of entries) {
      if (shorter.duration < longer.duration && shorter.limit > longer.limit) {
        return `${shorter.name} limit cannot exceed ${longer.name.toLowerCase()} limit`;
      }
    }
  }
  return null;
}
