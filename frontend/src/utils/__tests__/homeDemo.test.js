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

describe("homeDemo formatting", () => {
  test("formats whole dollars by default", () => {
    expect(formatUSD(1234.5)).toBe("$1,235");
  });

  test("formats cents when requested", () => {
    expect(formatUSD(1234.5, true)).toBe("$1,234.50");
  });
});
