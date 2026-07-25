// Unit tests for the homepage showcase demo helpers (pure functions, no chain access)
const {
  PERIOD_SECONDS,
  PRIZE_TIERS,
  DEMO_POOL_TVL,
  DEMO_GRAND_PRIZE,
  secondsIntoPeriod,
  secondsUntilBoundary,
  prizePoolValue,
  prizePayoutValue,
  randomPrizeEvent,
  formatUSD,
  depositFromSlider,
  weeklyWinOdds,
  yearlyPrizeEstimate,
  LIMIT_SIM,
  TIMELOCK_HOURS,
  DEMO_LIMIT_BUCKETS,
  DEMO_WITHDRAWALS,
  ESCAPE_ROUTES,
  timelockSeconds,
  getLimitTimeline,
  bucketState,
  tightestBucket,
  SUPPORTED_CHAINS,
} = require("../homeDemo.js");

describe("homeDemo period helpers", () => {
  // 2024-01-01 was a Monday
  const mondayMorning = new Date(2024, 0, 1, 5, 30, 15);

  test("secondsIntoPeriod for hour boundary", () => {
    expect(secondsIntoPeriod("hour", mondayMorning)).toBe(30 * 60 + 15);
  });

  test("secondsIntoPeriod for day boundary", () => {
    expect(secondsIntoPeriod("day", mondayMorning)).toBe(
      5 * 3600 + 30 * 60 + 15
    );
  });

  test("secondsIntoPeriod for week boundary starts Monday", () => {
    expect(secondsIntoPeriod("week", mondayMorning)).toBe(
      secondsIntoPeriod("day", mondayMorning)
    );

    const wednesday = new Date(2024, 0, 3, 5, 30, 15);
    expect(secondsIntoPeriod("week", wednesday)).toBe(
      2 * PERIOD_SECONDS.day + secondsIntoPeriod("day", wednesday)
    );
  });

  test("secondsUntilBoundary complements secondsIntoPeriod", () => {
    ["hour", "day", "week"].forEach((boundary) => {
      const total =
        secondsIntoPeriod(boundary, mondayMorning) +
        secondsUntilBoundary(boundary, mondayMorning);
      expect(total).toBe(PERIOD_SECONDS[boundary]);
    });
  });
});

describe("homeDemo prize pools", () => {
  const periodStart = new Date(2024, 0, 1, 0, 0, 0);

  test("pool equals base amount at period start", () => {
    PRIZE_TIERS.forEach((tier) => {
      expect(prizePoolValue(tier, periodStart)).toBe(tier.baseAmount);
    });
  });

  test("payout value is base plus full-period growth", () => {
    PRIZE_TIERS.forEach((tier) => {
      expect(prizePayoutValue(tier)).toBeCloseTo(
        tier.baseAmount + PERIOD_SECONDS[tier.boundary] * tier.growthPerSecond
      );
    });
  });

  test("weekly grand prize pays out around the advertised jackpot", () => {
    const grand = PRIZE_TIERS.find((tier) => tier.grand);
    expect(prizePayoutValue(grand)).toBeGreaterThanOrEqual(
      DEMO_GRAND_PRIZE * 0.95
    );
    expect(prizePayoutValue(grand)).toBeLessThanOrEqual(DEMO_GRAND_PRIZE * 1.05);
  });

  test("randomPrizeEvent returns a plausible winner", () => {
    for (let i = 0; i < 20; i++) {
      const event = randomPrizeEvent();
      expect(typeof event.handle).toBe("string");
      expect(PRIZE_TIERS).toContain(event.tier);
      expect(event.amount).toBeGreaterThan(0);
      expect(event.amount).toBeLessThanOrEqual(DEMO_GRAND_PRIZE);
    }
  });
});

describe("homeDemo deposit slider", () => {
  test("maps slider extremes to $50 and $1,000,000", () => {
    expect(depositFromSlider(0)).toBe(50);
    expect(depositFromSlider(100)).toBe(1000000);
  });

  test("is monotonically non-decreasing", () => {
    let previous = 0;
    for (let value = 0; value <= 100; value += 5) {
      const deposit = depositFromSlider(value);
      expect(deposit).toBeGreaterThanOrEqual(previous);
      previous = deposit;
    }
  });

  test("weeklyWinOdds scales with deposit size", () => {
    expect(weeklyWinOdds(1000000)).toBe(
      Math.round((DEMO_POOL_TVL + 1000000) / 1000000)
    );
    expect(weeklyWinOdds(50)).toBeGreaterThan(weeklyWinOdds(1000000));
  });

  test("yearlyPrizeEstimate uses the demo prize APY", () => {
    expect(yearlyPrizeEstimate(1000)).toBeCloseTo(40);
  });
});

describe("homeDemo limit buckets", () => {
  const tightest = tightestBucket();

  test("the tightest bucket is listed first", () => {
    const limits = DEMO_LIMIT_BUCKETS.map((bucket) => bucket.limit);
    expect([...limits].sort((a, b) => a - b)).toEqual(limits);
    expect(tightest).toBe(DEMO_LIMIT_BUCKETS[0]);
  });

  test("one withdrawal is debited from every bucket at once", () => {
    // Small enough to fit inside every bucket, including the tightest
    const amount = tightest.limit / 2;

    bucketState(amount).forEach((bucket) => {
      expect(bucket.used).toBe(amount);
      expect(bucket.remaining).toBe(bucket.limit - amount);
    });
  });

  test("the tightest bucket empties first while the others still have room", () => {
    const [hourly, , weekly] = bucketState(tightest.limit);
    expect(hourly).toMatchObject({
      isEmpty: true,
      remaining: 0,
      percentRemaining: 0,
    });
    expect(weekly.isEmpty).toBe(false);
    expect(weekly.remaining).toBeGreaterThan(0);
  });

  test("a refilled bucket resets while the slower buckets keep the spend", () => {
    const [hourly, daily] = bucketState(tightest.limit, [tightest.key]);
    expect(hourly).toMatchObject({ used: 0, isEmpty: false, percentRemaining: 100 });
    expect(hourly.remaining).toBe(tightest.limit);
    expect(daily.used).toBe(tightest.limit);
  });
});

describe("homeDemo limit simulation", () => {
  const { refillStartMs, refillEndMs, loopMs } = LIMIT_SIM;
  const tightest = tightestBucket();

  test("nothing is spent before the first withdrawal", () => {
    expect(getLimitTimeline(0)).toMatchObject({ spent: 0, event: null });
  });

  test("withdrawals within the limits are accepted and accumulate", () => {
    const [first, second] = DEMO_WITHDRAWALS;
    expect(getLimitTimeline(first.atMs)).toMatchObject({
      spent: first.amount,
      event: { accepted: true },
    });
    expect(getLimitTimeline(second.atMs).spent).toBe(
      first.amount + second.amount
    );
  });

  test("the withdrawal that busts the tightest limit is rejected", () => {
    const last = DEMO_WITHDRAWALS[DEMO_WITHDRAWALS.length - 1];
    const timeline = getLimitTimeline(last.atMs);

    expect(timeline.event).toMatchObject({
      amount: last.amount,
      accepted: false,
    });
    expect(timeline.spent).toBe(tightest.limit);
    expect(timeline.spent + last.amount).toBeGreaterThan(tightest.limit);
  });

  test("exactly two withdrawals fit, the third does not", () => {
    expect(DEMO_WITHDRAWALS).toHaveLength(3);

    const outcomes = DEMO_WITHDRAWALS.map(
      (withdrawal) => getLimitTimeline(withdrawal.atMs).event.accepted
    );
    expect(outcomes).toEqual([true, true, false]);
  });

  test("the clock starts on the first withdrawal, not when the bucket empties", () => {
    const [first] = DEMO_WITHDRAWALS;

    // Ticking already, even though this withdrawal fits inside the limit
    expect(getLimitTimeline(first.atMs)).toMatchObject({
      waiting: true,
      event: { accepted: true },
    });
    expect(getLimitTimeline(first.atMs).spent).toBeLessThan(tightest.limit);
    expect(getLimitTimeline(first.atMs - 100).waiting).toBe(false);
  });

  test("the refill countdown starts at one full period", () => {
    expect(getLimitTimeline(refillStartMs)).toMatchObject({
      waiting: true,
      refilled: false,
      refillSecondsRemaining: PERIOD_SECONDS[tightest.boundary],
    });
  });

  test("the refill countdown ticks down while waiting", () => {
    const midway = getLimitTimeline((refillStartMs + refillEndMs) / 2);
    expect(midway.refillSecondsRemaining).toBeGreaterThan(0);
    expect(midway.refillSecondsRemaining).toBeLessThan(
      getLimitTimeline(refillStartMs + 100).refillSecondsRemaining
    );
  });

  test("the bucket refills at zero and stays refilled to the end of the loop", () => {
    expect(getLimitTimeline(refillEndMs)).toMatchObject({
      waiting: false,
      refilled: true,
      refillSecondsRemaining: 0,
    });
    expect(getLimitTimeline(loopMs - 100).refilled).toBe(true);
  });
});

describe("homeDemo escape routes", () => {
  test("bypassing always costs the flat on-chain timelock", () => {
    expect(TIMELOCK_HOURS).toBe(24);
    expect(timelockSeconds()).toBe(24 * PERIOD_SECONDS.hour);
    ESCAPE_ROUTES.forEach((route) => {
      expect(route.bypassWait).toBe(`${TIMELOCK_HOURS} hours`);
    });
  });

  test("waiting beats bypassing on the tightest limit", () => {
    const [hourly] = ESCAPE_ROUTES;
    expect(hourly.key).toBe(tightestBucket().key);
    expect(hourly.refillWins).toBe(true);
    expect(hourly.refillWait).toBe("1 hour");
  });

  test("the daily limit is a dead heat, so bypassing buys nothing", () => {
    const daily = ESCAPE_ROUTES.find((route) => route.key === "daily");
    expect(daily.tie).toBe(true);
    expect(daily.refillWins).toBe(false);
  });

  test("only the longest limit makes bypassing the faster route", () => {
    const bypassWins = ESCAPE_ROUTES.filter(
      (route) => !route.refillWins && !route.tie
    ).map((route) => route.key);
    expect(bypassWins).toEqual(["weekly"]);
  });
});

describe("homeDemo supported chains", () => {
  test("Optimism is the only live chain and is listed first", () => {
    expect(SUPPORTED_CHAINS[0].key).toBe("optimism");
    expect(SUPPORTED_CHAINS.filter((chain) => chain.live)).toHaveLength(1);
    expect(SUPPORTED_CHAINS[0].live).toBe(true);
  });

  test("Ethereum and Solana are listed as upcoming", () => {
    const upcoming = SUPPORTED_CHAINS.filter((chain) => !chain.live).map(
      (chain) => chain.key
    );
    expect(upcoming).toEqual(["ethereum", "solana"]);
  });

  test("every chain has the copy the card renders", () => {
    SUPPORTED_CHAINS.forEach((chain) => {
      ["name", "status", "tagline", "detail", "bestFor"].forEach((field) => {
        expect(typeof chain[field]).toBe("string");
        expect(chain[field].length).toBeGreaterThan(0);
      });
    });
  });
});

describe("homeDemo formatting", () => {
  test("formats whole dollars by default", () => {
    expect(formatUSD(1234.5)).toBe("$1,235");
  });

  test("formats cents when requested", () => {
    expect(formatUSD(1234.5, true)).toBe("$1,234.50");
  });
});
