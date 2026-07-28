const {
  SPENDING_PERIODS,
  UNLOCK_DELAY_OPTIONS,
  MIN_UNLOCK_DELAY,
  MAX_UNLOCK_DELAY,
  SECONDS,
  getPeriod,
  getPeriodDuration,
  getDefaultUnlockDelay,
  sortPeriodNames,
  formatDuration,
  createEmptyLimitEdits,
  toPeriodEntries,
  validatePeriodEntries,
} = require("../spendingPeriods.js");

const { HOUR, DAY, WEEK, MONTH, YEAR } = SECONDS;

describe("spending period catalog", () => {
  it("covers hourly through yearly", () => {
    expect(SPENDING_PERIODS.map((period) => period.name)).toEqual([
      "Hourly",
      "Daily",
      "Weekly",
      "Monthly",
      "Yearly",
    ]);
  });

  it("uses the agreed default wait for each period", () => {
    expect(getDefaultUnlockDelay("Hourly")).toBe(DAY);
    expect(getDefaultUnlockDelay("Daily")).toBe(DAY);
    expect(getDefaultUnlockDelay("Weekly")).toBe(WEEK);
    expect(getDefaultUnlockDelay("Monthly")).toBe(MONTH);
    expect(getDefaultUnlockDelay("Yearly")).toBe(MONTH);
  });

  it("falls back to 24 hours for an unknown period", () => {
    expect(getPeriod("Quarterly")).toBeNull();
    expect(getPeriodDuration("Quarterly")).toBeNull();
    expect(getDefaultUnlockDelay("Quarterly")).toBe(DAY);
  });

  it("keeps every offered wait inside the contract's bounds", () => {
    for (const option of UNLOCK_DELAY_OPTIONS) {
      expect(option.seconds).toBeGreaterThanOrEqual(MIN_UNLOCK_DELAY);
      expect(option.seconds).toBeLessThanOrEqual(MAX_UNLOCK_DELAY);
    }
  });

  it("orders periods shortest window first", () => {
    expect(sortPeriodNames(["Yearly", "Hourly", "Weekly"])).toEqual([
      "Hourly",
      "Weekly",
      "Yearly",
    ]);
  });
});

describe("formatDuration", () => {
  it("names whole units", () => {
    expect(formatDuration(HOUR)).toBe("1 hour");
    expect(formatDuration(DAY)).toBe("1 day");
    expect(formatDuration(3 * DAY)).toBe("3 days");
    expect(formatDuration(WEEK)).toBe("1 week");
    expect(formatDuration(2 * WEEK)).toBe("2 weeks");
    expect(formatDuration(MONTH)).toBe("1 month");
    expect(formatDuration(YEAR)).toBe("1 year");
  });

  it("falls back to hours for values that fit no whole unit", () => {
    expect(formatDuration(90 * 60)).toBe("2 hours");
  });

  it("handles missing or nonsensical input", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(-1)).toBe("—");
  });
});

describe("createEmptyLimitEdits", () => {
  it("seeds every period with its default wait and no amount", () => {
    const edits = createEmptyLimitEdits(["Daily", "Yearly"]);

    expect(Object.keys(edits)).toEqual(["Daily", "Yearly"]);
    expect(edits.Daily).toEqual({
      value: "",
      unlockDelay: DAY,
      isActive: false,
      isEditing: false,
    });
    expect(edits.Yearly.unlockDelay).toBe(MONTH);
  });
});

describe("toPeriodEntries", () => {
  it("keeps only the periods with an amount, shortest window first", () => {
    const entries = toPeriodEntries({
      Yearly: { value: "5000", unlockDelay: MONTH },
      Daily: { value: "50", unlockDelay: DAY },
      Weekly: { value: "", unlockDelay: WEEK },
      Monthly: { value: "0", unlockDelay: MONTH },
    });

    expect(entries).toEqual([
      { name: "Daily", limit: 50, duration: DAY, unlockDelay: DAY },
      { name: "Yearly", limit: 5000, duration: YEAR, unlockDelay: MONTH },
    ]);
  });

  it("falls back to the default wait when none was chosen", () => {
    const entries = toPeriodEntries({ Weekly: { value: "100" } });
    expect(entries[0].unlockDelay).toBe(WEEK);
  });

  it("drops unrecognised periods and non-numeric amounts", () => {
    expect(toPeriodEntries({ Quarterly: { value: "10" } })).toEqual([]);
    expect(toPeriodEntries({ Daily: { value: "abc" } })).toEqual([]);
    expect(toPeriodEntries({})).toEqual([]);
    expect(toPeriodEntries(null)).toEqual([]);
  });
});

describe("validatePeriodEntries", () => {
  const entry = (name, limit) => ({
    name,
    limit,
    duration: getPeriodDuration(name),
    unlockDelay: getDefaultUnlockDelay(name),
  });

  it("requires at least one limit", () => {
    expect(validatePeriodEntries([])).toBe("Please set at least one spending limit");
    expect(validatePeriodEntries(null)).toBe("Please set at least one spending limit");
  });

  it("accepts limits that grow with the window", () => {
    expect(
      validatePeriodEntries([
        entry("Daily", 50),
        entry("Weekly", 300),
        entry("Monthly", 1000),
        entry("Yearly", 10000),
      ]),
    ).toBeNull();
  });

  it("accepts equal limits across windows", () => {
    expect(validatePeriodEntries([entry("Daily", 100), entry("Weekly", 100)])).toBeNull();
  });

  it("rejects a shorter window allowing more than a longer one", () => {
    expect(validatePeriodEntries([entry("Daily", 500), entry("Weekly", 300)])).toBe(
      "Daily limit cannot exceed weekly limit",
    );
    expect(validatePeriodEntries([entry("Monthly", 5000), entry("Yearly", 1000)])).toBe(
      "Monthly limit cannot exceed yearly limit",
    );
  });
});
