// Savings Visualiser simulation — ported from the FutureMirror project
// (github.com/bogomazov/FutureMirror). Projects wealth and life quality year
// by year from a chosen allocation between risky trades, stable crypto,
// cash/bonds and self investment.
//
// All figures are illustrative projections, not financial advice.

export const DEFAULT_INPUTS = {
  ageStart: 25,
  ageEnd: 65,
  annualIncome: 30000,
  allocRisk: 0.25,
  allocStable: 0.3,
  allocCash: 0.25,
  allocSelf: 0.2,
  goalAmount: 500000,
};

export const ALLOCATION_FIELDS = [
  "allocRisk",
  "allocStable",
  "allocCash",
  "allocSelf",
];

// Slider metadata for the allocation controls
export const ALLOCATIONS = [
  {
    field: "allocRisk",
    emoji: "🎲",
    label: "Risky Trades",
    sublabel: "Leverage / memecoins / degen",
    hint: "High risk, high reward… and high stress",
    max: 0.8,
    tone: "risk",
  },
  {
    field: "allocStable",
    emoji: "₿",
    label: "Stable Crypto",
    sublabel: "BTC / ETH / blue chips",
    hint: "A hedge against inflation",
    max: 0.6,
    tone: "stable",
  },
  {
    field: "allocCash",
    emoji: "💵",
    label: "TradFi",
    sublabel: "Cash / bonds / index funds",
    hint: "Traditional investments, locked until retirement",
    max: 0.5,
    tone: "cash",
  },
  {
    field: "allocSelf",
    emoji: "🧠",
    label: "Self Investment",
    sublabel: "Skills / health / hobbies",
    hint: "The guaranteed 1000× — compounds income growth and well-being",
    max: 0.3,
    tone: "self",
  },
];

export const PRESET_SCENARIOS = [
  {
    key: "degen",
    emoji: "🎲",
    label: "All In Risk",
    description: "YOLO degen mode",
    allocation: {
      allocRisk: 0.7,
      allocStable: 0.15,
      allocCash: 0.1,
      allocSelf: 0.05,
    },
  },
  {
    key: "balanced",
    emoji: "⚖️",
    label: "Balanced",
    description: "Moderate risk",
    allocation: {
      allocRisk: 0.25,
      allocStable: 0.3,
      allocCash: 0.25,
      allocSelf: 0.2,
    },
  },
  {
    key: "lockin",
    emoji: "🔒",
    label: "Lock-In Life",
    description: "Peace & stability",
    allocation: {
      allocRisk: 0.05,
      allocStable: 0.35,
      allocCash: 0.3,
      allocSelf: 0.3,
    },
  },
];

export const GOAL_PRESETS = [
  { label: "Emergency Fund", value: 25000 },
  { label: "House Deposit", value: 100000 },
  { label: "Freedom Fund", value: 500000 },
  { label: "Early Retirement", value: 1000000 },
];

const BASE_INCOME_GROWTH = 0.03;
const CASH_RETURN = 0.02;
const INFLATION_RATE = 0.03;
const SAFE_WITHDRAWAL_RATE = 0.04;
const STRESS_BURNOUT_THRESHOLD = 70;

// Deterministic PRNG (mulberry32) so the same inputs always draw the same
// projection. The upstream project used Math.random(), which reshuffled the
// chart on every keystroke and showed different futures to different visitors.
const createRandom = (seed) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Stable hash of the inputs — the same scenario always seeds the same run
export const seedFromInputs = (inputs) => {
  const signature = [
    inputs.ageStart,
    inputs.ageEnd,
    inputs.annualIncome,
    ...ALLOCATION_FIELDS.map((field) => Math.round(inputs[field] * 100)),
    inputs.goalAmount,
  ].join("|");

  let hash = 2166136261;
  for (let i = 0; i < signature.length; i++) {
    hash ^= signature.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

// Box-Muller transform against the seeded stream
const normal = (random, mean, stdev) => {
  const u = 1 - random();
  const v = random();
  return mean + stdev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const scenarioKey = (inputs) =>
  ALLOCATION_FIELDS.map((field) => inputs[field]).join("-");

export const totalAllocated = (inputs) =>
  ALLOCATION_FIELDS.reduce((sum, field) => sum + (inputs[field] || 0), 0);

/**
 * Project wealth and life quality from ageStart to ageEnd.
 * Returns the yearly timeline plus the headline figures.
 */
export const simulateFuture = ({
  ageStart = DEFAULT_INPUTS.ageStart,
  ageEnd = DEFAULT_INPUTS.ageEnd,
  annualIncome = DEFAULT_INPUTS.annualIncome,
  allocRisk = DEFAULT_INPUTS.allocRisk,
  allocStable = DEFAULT_INPUTS.allocStable,
  allocCash = DEFAULT_INPUTS.allocCash,
  allocSelf = DEFAULT_INPUTS.allocSelf,
  marketVol = 0.8,
  goalAmount = DEFAULT_INPUTS.goalAmount,
} = {}) => {
  const random = createRandom(
    seedFromInputs({
      ageStart,
      ageEnd,
      annualIncome,
      allocRisk,
      allocStable,
      allocCash,
      allocSelf,
      goalAmount,
    })
  );

  let riskyAssets = 0;
  let stableAssets = 0;
  let cashAssets = 0;
  let totalWealth = 0;

  let health = 75;
  let happiness = 60;
  let stress = 40;
  let currentIncome = annualIncome;

  const timeline = [];
  let goalAchievedAge = null;

  for (let age = ageStart; age <= ageEnd; age++) {
    // Risky crypto: high expected return, extreme volatility
    const riskyReturn = normal(random, 0.2, marketVol);
    riskyAssets = Math.max(
      0,
      riskyAssets * (1 + riskyReturn) + currentIncome * allocRisk
    );

    // Stable crypto: moderate return, moderate volatility
    const stableReturn = normal(random, 0.07, 0.15);
    stableAssets = stableAssets * (1 + stableReturn) + currentIncome * allocStable;

    // Cash and bonds: low but dependable
    cashAssets = cashAssets * (1 + CASH_RETURN) + currentIncome * allocCash;

    totalWealth = riskyAssets + stableAssets + cashAssets;

    // Self investment compounds future income
    currentIncome *= 1 + BASE_INCOME_GROWTH + allocSelf * 0.05;

    // Life quality: risk drives stress, self investment buys it back
    const stressFromRisk = allocRisk * 60;
    const healthFromSelf = allocSelf * 50;
    const happinessFromBalance = Math.max(
      0,
      40 - Math.abs(allocRisk - 0.2) * 120
    );

    health = clamp(
      health + healthFromSelf - stressFromRisk * 0.3 + normal(random, 0, 2),
      20,
      100
    );
    stress = clamp(
      30 + stressFromRisk - allocSelf * 40 + normal(random, 0, 3),
      0,
      100
    );
    happiness = clamp(
      happiness +
        happinessFromBalance +
        allocSelf * 30 -
        stressFromRisk * 0.2 +
        normal(random, 0, 2),
      10,
      100
    );

    // Burnout costs you income growth
    if (stress > STRESS_BURNOUT_THRESHOLD) {
      currentIncome *= 0.98;
    }

    if (!goalAchievedAge && totalWealth >= goalAmount) {
      goalAchievedAge = age;
    }

    timeline.push({
      age,
      risky: Math.round(riskyAssets),
      stable: Math.round(stableAssets),
      cash: Math.round(cashAssets),
      totalWealth: Math.round(totalWealth),
      health: Math.round(health),
      happiness: Math.round(happiness),
      stress: Math.round(stress),
      income: Math.round(currentIncome),
      goalAchieved: totalWealth >= goalAmount,
      sleeplessNight: stress > STRESS_BURNOUT_THRESHOLD,
    });
  }

  const average = (key) =>
    Math.round(
      timeline.reduce((sum, year) => sum + year[key], 0) / timeline.length
    );

  return {
    timeline,
    finalWealth: Math.round(totalWealth),
    finalRisky: Math.round(riskyAssets),
    finalStable: Math.round(stableAssets),
    finalCash: Math.round(cashAssets),
    goalAchievedAge,
    yearsToGoal: goalAchievedAge ? goalAchievedAge - ageStart : null,
    avgHealth: average("health"),
    avgStress: average("stress"),
    avgHappiness: average("happiness"),
    sleeplessYears: timeline.filter((year) => year.sleeplessNight).length,
  };
};

// Financial independence measured against what you live on today
export const freedomMetrics = (finalWealth, annualExpenses) => {
  const monthlyExpenses = Math.max(annualExpenses, 1) / 12;
  const monthlyPassiveIncome = (finalWealth * SAFE_WITHDRAWAL_RATE) / 12;

  return {
    monthlyPassiveIncome: Math.round(monthlyPassiveIncome),
    freedomScore: Math.round(
      Math.min((monthlyPassiveIncome / monthlyExpenses) * 100, 100)
    ),
    canRetire: monthlyPassiveIncome >= monthlyExpenses,
    yearsOfExpenses: Math.round(finalWealth / Math.max(annualExpenses, 1)),
  };
};

export const stressLevel = (riskRate, finalWealth) =>
  clamp(riskRate * 60 - Math.min(finalWealth / 100000, 1) * 40 + 20, 0, 100);

// What a future amount is worth in today's money
export const presentValue = (futureValue, years) =>
  Math.round(futureValue / Math.pow(1 + INFLATION_RATE, years));

export const formatMoney = (value) => {
  if (!Number.isFinite(value)) return "$0";
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
};

// Keep allocations from summing past 100% by trimming the others
export const rebalanceAllocations = (inputs, changedField, newValue) => {
  const updated = { ...inputs, [changedField]: newValue };
  const excess = totalAllocated(updated) - 1;

  if (excess <= 0) return updated;

  const others = ALLOCATION_FIELDS.filter((field) => field !== changedField);
  let left = excess;

  others.forEach((field, index) => {
    const share = left / (others.length - index);
    const reduction = Math.min(updated[field], share);
    updated[field] = Math.max(0, updated[field] - reduction);
    left -= reduction;
  });

  return updated;
};

export const SLEEP_QUALITY_TIERS = [
  { threshold: 0.5, emoji: "😵", label: "Chronic insomnia", tone: "bad" },
  { threshold: 0.3, emoji: "😴", label: "Poor sleep", tone: "warn" },
  { threshold: 0.1, emoji: "😐", label: "Restless nights", tone: "mild" },
  { threshold: 0, emoji: "😴", label: "Good sleep", tone: "good" },
];

export const sleepQuality = (sleeplessYears, totalYears) => {
  const ratio = totalYears > 0 ? sleeplessYears / totalYears : 0;
  return (
    SLEEP_QUALITY_TIERS.find((tier) => ratio >= tier.threshold) ||
    SLEEP_QUALITY_TIERS[SLEEP_QUALITY_TIERS.length - 1]
  );
};

export const OUTCOMES = [
  {
    key: "dream",
    emoji: "🌟",
    title: "Living the dream",
    message:
      "Financial security, excellent health and peaceful sleep. You invested in yourself and it paid off.",
    matches: ({ wealth, freedom, health }) =>
      wealth >= 500000 && freedom >= 80 && health >= 80,
  },
  {
    key: "comfortable",
    emoji: "😌",
    title: "Comfortable & healthy",
    message:
      "Solid wealth with good health. Manageable stress levels let you sleep well.",
    matches: ({ wealth, freedom, health }) =>
      wealth >= 100000 && freedom >= 50 && health >= 60,
  },
  {
    key: "gettingBy",
    emoji: "😐",
    title: "Getting by",
    message:
      "Some security achieved, but your health is starting to suffer from years of stress.",
    matches: ({ wealth, health }) => wealth >= 50000 && health >= 40,
  },
  {
    key: "crisis",
    emoji: "🤒",
    title: "Health crisis",
    message:
      "High stress led to chronic sleep issues and serious health problems. Wealth can't buy back your health.",
    matches: ({ stress, sleeplessRatio }) =>
      stress >= 70 || sleeplessRatio >= 0.3,
  },
  {
    key: "struggling",
    emoji: "😰",
    title: "Struggling",
    message:
      "Limited financial security with declining health and constant worry about the future.",
    matches: () => true,
  },
];

export const outcomeFor = (metrics) =>
  OUTCOMES.find((outcome) => outcome.matches(metrics));
