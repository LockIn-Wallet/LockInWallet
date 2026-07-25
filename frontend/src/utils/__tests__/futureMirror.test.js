// Unit tests for the Savings Visualiser simulation (pure functions, no chain access)
const {
  DEFAULT_INPUTS,
  ALLOCATION_FIELDS,
  PRESET_SCENARIOS,
  simulateFuture,
  seedFromInputs,
  freedomMetrics,
  stressLevel,
  presentValue,
  formatMoney,
  rebalanceAllocations,
  totalAllocated,
  sleepQuality,
  outcomeFor,
} = require("../futureMirror.js");

describe("futureMirror simulation", () => {
  test("produces one timeline entry per year, inclusive", () => {
    const result = simulateFuture(DEFAULT_INPUTS);
    const expectedYears = DEFAULT_INPUTS.ageEnd - DEFAULT_INPUTS.ageStart + 1;

    expect(result.timeline).toHaveLength(expectedYears);
    expect(result.timeline[0].age).toBe(DEFAULT_INPUTS.ageStart);
    expect(result.timeline[expectedYears - 1].age).toBe(DEFAULT_INPUTS.ageEnd);
  });

  test("is deterministic — same inputs always give the same future", () => {
    const first = simulateFuture(DEFAULT_INPUTS);
    const second = simulateFuture({ ...DEFAULT_INPUTS });

    expect(second.finalWealth).toBe(first.finalWealth);
    expect(second.timeline).toEqual(first.timeline);
  });

  test("different inputs give a different future", () => {
    const balanced = simulateFuture(DEFAULT_INPUTS);
    const richer = simulateFuture({
      ...DEFAULT_INPUTS,
      annualIncome: DEFAULT_INPUTS.annualIncome * 2,
    });

    expect(seedFromInputs(DEFAULT_INPUTS)).not.toBe(
      seedFromInputs({
        ...DEFAULT_INPUTS,
        annualIncome: DEFAULT_INPUTS.annualIncome * 2,
      })
    );
    expect(richer.finalWealth).toBeGreaterThan(balanced.finalWealth);
  });

  test("total wealth is the sum of the three sleeves", () => {
    const { timeline } = simulateFuture(DEFAULT_INPUTS);

    timeline.forEach((year) => {
      expect(year.totalWealth).toBeCloseTo(
        year.risky + year.stable + year.cash,
        -1
      );
    });
  });

  test("saving nothing accumulates nothing", () => {
    const result = simulateFuture({
      ...DEFAULT_INPUTS,
      allocRisk: 0,
      allocStable: 0,
      allocCash: 0,
      allocSelf: 0,
    });

    expect(result.finalWealth).toBe(0);
    expect(result.goalAchievedAge).toBeNull();
  });

  test("life-quality scores stay within their bounds", () => {
    PRESET_SCENARIOS.forEach((preset) => {
      const { timeline } = simulateFuture({
        ...DEFAULT_INPUTS,
        ...preset.allocation,
      });

      timeline.forEach((year) => {
        expect(year.health).toBeGreaterThanOrEqual(20);
        expect(year.health).toBeLessThanOrEqual(100);
        expect(year.stress).toBeGreaterThanOrEqual(0);
        expect(year.stress).toBeLessThanOrEqual(100);
        expect(year.happiness).toBeGreaterThanOrEqual(10);
        expect(year.happiness).toBeLessThanOrEqual(100);
      });
    });
  });

  test("piling into risk costs more sleep than locking in", () => {
    const degen = simulateFuture({
      ...DEFAULT_INPUTS,
      ...PRESET_SCENARIOS.find((preset) => preset.key === "degen").allocation,
    });
    const lockin = simulateFuture({
      ...DEFAULT_INPUTS,
      ...PRESET_SCENARIOS.find((preset) => preset.key === "lockin").allocation,
    });

    expect(degen.avgStress).toBeGreaterThan(lockin.avgStress);
    expect(degen.sleeplessYears).toBeGreaterThan(lockin.sleeplessYears);
    expect(lockin.avgHealth).toBeGreaterThan(degen.avgHealth);
  });

  test("goalAchievedAge and yearsToGoal agree", () => {
    const result = simulateFuture(DEFAULT_INPUTS);

    if (result.goalAchievedAge) {
      expect(result.yearsToGoal).toBe(
        result.goalAchievedAge - DEFAULT_INPUTS.ageStart
      );
      const hit = result.timeline.find(
        (year) => year.age === result.goalAchievedAge
      );
      expect(hit.totalWealth).toBeGreaterThanOrEqual(DEFAULT_INPUTS.goalAmount);
    } else {
      expect(result.yearsToGoal).toBeNull();
    }
  });
});

describe("futureMirror allocation rebalancing", () => {
  test("leaves allocations alone when they still fit under 100%", () => {
    const inputs = {
      allocRisk: 0.1,
      allocStable: 0.1,
      allocCash: 0.1,
      allocSelf: 0.1,
    };
    const result = rebalanceAllocations(inputs, "allocRisk", 0.2);

    expect(result.allocRisk).toBe(0.2);
    expect(result.allocStable).toBe(0.1);
  });

  test("trims the other sleeves when a change would exceed 100%", () => {
    const inputs = {
      allocRisk: 0.3,
      allocStable: 0.3,
      allocCash: 0.2,
      allocSelf: 0.2,
    };
    const result = rebalanceAllocations(inputs, "allocRisk", 0.6);

    expect(result.allocRisk).toBe(0.6);
    expect(totalAllocated(result)).toBeCloseTo(1);
    ALLOCATION_FIELDS.forEach((field) => {
      expect(result[field]).toBeGreaterThanOrEqual(0);
    });
  });

  test("never drives another sleeve negative", () => {
    const inputs = {
      allocRisk: 0,
      allocStable: 0.05,
      allocCash: 0,
      allocSelf: 0,
    };
    const result = rebalanceAllocations(inputs, "allocRisk", 0.8);

    ALLOCATION_FIELDS.forEach((field) => {
      expect(result[field]).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("futureMirror freedom metrics", () => {
  test("applies the 4% withdrawal rule", () => {
    const metrics = freedomMetrics(1200000, 48000);

    expect(metrics.monthlyPassiveIncome).toBe(4000);
    expect(metrics.canRetire).toBe(true);
    expect(metrics.freedomScore).toBe(100);
  });

  test("scores below 100 when passive income falls short", () => {
    const metrics = freedomMetrics(120000, 48000);

    expect(metrics.canRetire).toBe(false);
    expect(metrics.freedomScore).toBeLessThan(100);
    expect(metrics.freedomScore).toBeGreaterThan(0);
  });

  test("survives a zero-income input without dividing by zero", () => {
    const metrics = freedomMetrics(100000, 0);

    expect(Number.isFinite(metrics.freedomScore)).toBe(true);
    expect(Number.isFinite(metrics.yearsOfExpenses)).toBe(true);
  });

  test("stress rises with risk and falls with wealth", () => {
    expect(stressLevel(0.8, 0)).toBeGreaterThan(stressLevel(0.1, 0));
    expect(stressLevel(0.8, 500000)).toBeLessThan(stressLevel(0.8, 0));
    expect(stressLevel(1, 0)).toBeLessThanOrEqual(100);
    expect(stressLevel(0, 500000)).toBeGreaterThanOrEqual(0);
  });
});

describe("futureMirror formatting and helpers", () => {
  test("formats money at each magnitude", () => {
    expect(formatMoney(950)).toBe("$950");
    expect(formatMoney(25000)).toBe("$25K");
    expect(formatMoney(1500000)).toBe("$1.5M");
    expect(formatMoney(undefined)).toBe("$0");
  });

  test("discounts future money at 3% a year", () => {
    expect(presentValue(1000, 0)).toBe(1000);
    expect(presentValue(1000, 40)).toBeLessThan(1000);
    expect(presentValue(1000, 40)).toBeGreaterThan(0);
  });

  test("sleep quality degrades as sleepless years pile up", () => {
    expect(sleepQuality(0, 40).tone).toBe("good");
    expect(sleepQuality(30, 40).tone).toBe("bad");
    expect(sleepQuality(40, 0).tone).toBe("good");
  });

  test("outcome always resolves, even at the extremes", () => {
    const best = outcomeFor({
      wealth: 5000000,
      freedom: 100,
      stress: 10,
      health: 95,
      sleeplessRatio: 0,
    });
    const worst = outcomeFor({
      wealth: 0,
      freedom: 0,
      stress: 95,
      health: 25,
      sleeplessRatio: 1,
    });

    expect(best.key).toBe("dream");
    expect(worst).toBeDefined();
    expect(typeof worst.message).toBe("string");
  });
});
