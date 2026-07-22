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
  tier.baseAmount + secondsIntoPeriod(tier.boundary, date) * tier.growthPerSecond;

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
