// Demo data and pure helpers powering the logged-out homepage showcase.
// All figures are illustrative — they demonstrate product mechanics, not live chain data.

export const DEMO_VAULT_BALANCE = 100000;
export const DEMO_HOURLY_LIMIT = 500;
export const DEMO_POOL_TVL = 10000000;
export const DEMO_GRAND_PRIZE = 100000;
export const DEMO_PRIZE_APY = 0.04;

export const SLIDER_MIN_DEPOSIT = 50;
export const SLIDER_MAX_DEPOSIT = 1000000;

export const PERIOD_SECONDS = {
  hour: 3600,
  day: 86400,
  week: 604800,
};

// Prize tiers mirror PoolTogether-style draws: pools grow continuously and
// pay out when the countdown hits zero.
export const PRIZE_TIERS = [
  {
    key: "hourly",
    label: "Hourly Draw",
    emoji: "⚡",
    boundary: "hour",
    baseAmount: 40,
    growthPerSecond: 0.045,
    blurb: "Small prizes, every hour",
  },
  {
    key: "daily",
    label: "Daily Draw",
    emoji: "🌙",
    boundary: "day",
    baseAmount: 600,
    growthPerSecond: 0.021,
    blurb: "Bigger prizes, every day",
  },
  {
    key: "weekly",
    label: "Weekly Grand Prize",
    emoji: "🏆",
    boundary: "week",
    baseAmount: 84000,
    growthPerSecond: 0.0265,
    grand: true,
    blurb: "The jackpot, every week",
  },
];

// Mixed EVM / Solana style handles for the simulated winner feed
const WINNER_HANDLES = [
  "0x7fA3…c21D",
  "9xKq…P3vX",
  "0x54eD…9A0b",
  "GmZw…qL8s",
  "0xB612…44Fe",
  "3nVt…xR7p",
  "0x08cC…D1a9",
  "Fh2d…mW5k",
];

export const secondsIntoPeriod = (boundary, date = new Date()) => {
  const daySeconds =
    date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();

  if (boundary === "hour") {
    return date.getMinutes() * 60 + date.getSeconds();
  }
  if (boundary === "day") {
    return daySeconds;
  }
  // Week starts Monday 00:00 local time
  const mondayIndex = (date.getDay() + 6) % 7;
  return mondayIndex * PERIOD_SECONDS.day + daySeconds;
};

export const secondsUntilBoundary = (boundary, date = new Date()) =>
  PERIOD_SECONDS[boundary] - secondsIntoPeriod(boundary, date);

// Deterministic "live" pool value: grows through the period, resets at payout
export const prizePoolValue = (tier, date = new Date()) =>
  tier.baseAmount +
  secondsIntoPeriod(tier.boundary, date) * tier.growthPerSecond;

// Full pool value at the moment of payout (end of period)
export const prizePayoutValue = (tier) =>
  tier.baseAmount + PERIOD_SECONDS[tier.boundary] * tier.growthPerSecond;

export const randomWinner = () =>
  WINNER_HANDLES[Math.floor(Math.random() * WINNER_HANDLES.length)];

// Weighted random winner event for the simulated live feed
const TIER_PRIZE_RANGES = {
  hourly: [15, 220],
  daily: [250, 2600],
  weekly: [25000, DEMO_GRAND_PRIZE],
};

export const randomPrizeEvent = () => {
  const roll = Math.random();
  const tier =
    roll < 0.7 ? PRIZE_TIERS[0] : roll < 0.95 ? PRIZE_TIERS[1] : PRIZE_TIERS[2];
  const [min, max] = TIER_PRIZE_RANGES[tier.key];
  return {
    handle: randomWinner(),
    amount: Math.round(min + Math.random() * (max - min)),
    tier,
  };
};

// Chain rollout shown on the homepage. `live` chains can be used today.
export const SUPPORTED_CHAINS = [
  {
    key: "base",
    name: "Base",
    live: true,
    status: "Live now",
    tagline: "Where new wallets start",
    detail:
      "An Ethereum layer 2, so your funds inherit Ethereum's security while a transaction costs cents and confirms in seconds. It is where a bank card can buy dollars directly, which is why new wallets begin here.",
    bestFor: "Start here if you are new",
  },
  {
    key: "optimism",
    name: "Optimism",
    live: true,
    status: "Live now",
    tagline: "Fast, cheap, Ethereum-secured",
    detail:
      "Optimism settles back to Ethereum on the same terms, so your funds inherit Ethereum's security while transactions cost cents. Savings already here stay here — the two work identically, and you can hold a wallet on either.",
    bestFor: "Ideal for your first $10K of savings",
  },
  {
    key: "ethereum",
    name: "Ethereum",
    live: false,
    status: "Underway",
    tagline: "For larger balances",
    detail:
      "Ethereum mainnet support is in progress, for balances where paying more gas per withdrawal is worth settling directly on L1.",
    bestFor: "Built for bigger amounts",
  },
  // {
  //   key: "solana",
  //   name: "Solana",
  //   live: false,
  //   status: "Underway",
  //   tagline: "Same vault, different chain",
  //   detail:
  //     "The Solana program mirrors the same limits and 24-hour timelocks. It's built and being hardened ahead of launch.",
  //   bestFor: "Coming soon",
  // },
];

// Bypassing a limit is gated by a flat on-chain delay, whatever period you
// are bypassing (BypassSystemModule) — as is changing a limit
// (ProposalSystemModule). Waiting for a bucket to refill is the other route,
// and for the short periods it is the faster one.
export const TIMELOCK_HOURS = 24;

export const timelockSeconds = () => TIMELOCK_HOURS * PERIOD_SECONDS.hour;

// Illustrative limit buckets. Every withdrawal is checked against — and
// debited from — every active period at the same time, so the tightest
// bucket is what you actually feel.
export const DEMO_LIMIT_BUCKETS = [
  {
    key: "hourly",
    name: "Hourly",
    emoji: "⏱️",
    limit: 50,
    boundary: "hour",
    refillWait: "1 hour",
  },
  {
    key: "daily",
    name: "Daily",
    emoji: "🌗",
    limit: 150,
    boundary: "day",
    refillWait: "24 hours",
  },
  {
    key: "weekly",
    name: "Weekly",
    emoji: "📅",
    limit: 1000,
    boundary: "week",
    refillWait: "7 days",
  },
];

// Withdrawal attempts replayed in the explainer loop: two that fit, then one
// that busts the tightest bucket and gets rejected on-chain.
export const DEMO_WITHDRAWALS = [
  { atMs: 1500, amount: 30 },
  { atMs: 4000, amount: 20 },
  { atMs: 6500, amount: 20 },
];

// Explainer simulation timings (ms within one loop)
export const LIMIT_SIM = {
  loopMs: 22000,
  tickMs: 100,
  // The period clock starts on the first withdrawal, not when the bucket runs
  // out — on-chain the reset is `lastReset + duration`.
  refillStartMs: DEMO_WITHDRAWALS[0].atMs,
  refillEndMs: 17000, // bucket refills, allowance is back
  flashMs: 1000, // how long a withdrawal stays highlighted
};

// The tightest bucket is the one the user actually bumps into
export const tightestBucket = () => DEMO_LIMIT_BUCKETS[0];

export const getLimitTimeline = (elapsed) => {
  const { refillStartMs, refillEndMs, flashMs } = LIMIT_SIM;
  const tightest = tightestBucket();

  let spent = 0;
  let event = null;

  DEMO_WITHDRAWALS.forEach((withdrawal) => {
    if (elapsed < withdrawal.atMs) return;

    const accepted = DEMO_LIMIT_BUCKETS.every(
      (bucket) => spent + withdrawal.amount <= bucket.limit,
    );
    if (accepted) spent += withdrawal.amount;

    event = {
      ...withdrawal,
      accepted,
      isFresh: elapsed - withdrawal.atMs < flashMs,
    };
  });

  const waiting = elapsed >= refillStartMs && elapsed < refillEndMs;
  const refilled = elapsed >= refillEndMs;
  const progress = refilled
    ? 1
    : waiting
    ? (elapsed - refillStartMs) / (refillEndMs - refillStartMs)
    : 0;

  return {
    spent,
    event,
    waiting,
    refilled,
    // Countdown to the tightest bucket's own reset — one hour, not a timelock
    refillSecondsRemaining: Math.ceil(
      PERIOD_SECONDS[tightest.boundary] * (1 - progress),
    ),
  };
};

// Seconds until each bucket's own reset. On-chain every period resets at
// `lastReset + duration` independently, so the same elapsed time eats a whole
// hour of the hourly window but barely dents the weekly one — which is the
// point the demo is making.
export const bucketResetSeconds = (elapsed) => {
  const { refillStartMs, refillEndMs } = LIMIT_SIM;
  const span = refillEndMs - refillStartMs;
  const progress = Math.max(0, Math.min(1, (elapsed - refillStartMs) / span));

  // The refill window represents exactly one hour passing
  const secondsElapsed = PERIOD_SECONDS.hour * progress;

  return DEMO_LIMIT_BUCKETS.reduce((all, bucket) => {
    const duration = PERIOD_SECONDS[bucket.boundary];
    all[bucket.key] = Math.max(0, Math.ceil(duration - secondsElapsed));
    return all;
  }, {});
};

// Per-bucket usage. Buckets in `refilledKeys` have hit their own reset and
// start from zero again, while the slower buckets keep the spend on record.
export const bucketState = (spent, refilledKeys = []) =>
  DEMO_LIMIT_BUCKETS.map((bucket) => {
    const used = refilledKeys.includes(bucket.key)
      ? 0
      : Math.min(spent, bucket.limit);

    const remaining = bucket.limit - used;

    return {
      ...bucket,
      used,
      remaining,
      // The bar shows headroom: full when untouched, draining as you spend
      percentRemaining: (remaining / bucket.limit) * 100,
      percentUsed: (used / bucket.limit) * 100,
      isEmpty: remaining <= 0,
    };
  });

// Beat 3: the two ways past a limit, side by side. Waiting wins on the short
// periods; the bypass only pays off on the long ones — and costs you a full
// day in the open either way.
export const ESCAPE_ROUTES = DEMO_LIMIT_BUCKETS.map((bucket) => {
  const refillHours = PERIOD_SECONDS[bucket.boundary] / PERIOD_SECONDS.hour;

  return {
    key: bucket.key,
    name: bucket.name,
    emoji: bucket.emoji,
    refillWait: bucket.refillWait,
    bypassWait: `${TIMELOCK_HOURS} hours`,
    refillWins: refillHours < TIMELOCK_HOURS,
    tie: refillHours === TIMELOCK_HOURS,
  };
});

export const formatUSD = (amount, withCents = false) =>
  amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  });

// Log-scale mapping for the deposit slider: 0..100 → $50..$1,000,000,
// rounded to two significant digits so values read naturally.
export const depositFromSlider = (value) => {
  const raw =
    SLIDER_MIN_DEPOSIT *
    Math.pow(SLIDER_MAX_DEPOSIT / SLIDER_MIN_DEPOSIT, value / 100);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / magnitude) * magnitude;
};

export const weeklyWinOdds = (deposit) =>
  Math.max(1, Math.round((DEMO_POOL_TVL + deposit) / deposit));

export const yearlyPrizeEstimate = (deposit) => deposit * DEMO_PRIZE_APY;
