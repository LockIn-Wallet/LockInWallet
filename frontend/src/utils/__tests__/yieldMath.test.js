// Rate conversions for the earning feature. Pure maths, so these are exact.
const {
  aprBpsToApyPercent,
  netApyPercent,
  formatApyPercent,
  SECONDS_PER_YEAR,
} = require("../yieldMath.js");

describe("aprBpsToApyPercent", () => {
  test("compounds a 5% APR into its per-second APY", () => {
    // (1 + 0.05/n)^n - 1 approaches e^0.05 - 1 = 5.127%
    expect(aprBpsToApyPercent(500)).toBeCloseTo(5.127, 2);
  });

  test("is always at least the APR, never less", () => {
    for (const bps of [1, 50, 300, 500, 1200, 5000]) {
      expect(aprBpsToApyPercent(bps)).toBeGreaterThanOrEqual(bps / 100);
    }
  });

  test("reports an unknown or absent rate as zero rather than guessing", () => {
    // Strategies return 0 when the protocol's rate cannot be read.
    expect(aprBpsToApyPercent(0)).toBe(0);
    expect(aprBpsToApyPercent(-100)).toBe(0);
    expect(aprBpsToApyPercent(undefined)).toBe(0);
    expect(aprBpsToApyPercent(null)).toBe(0);
    expect(aprBpsToApyPercent(NaN)).toBe(0);
  });

  test("accepts the bigint a contract call actually returns", () => {
    expect(aprBpsToApyPercent(500n)).toBeCloseTo(aprBpsToApyPercent(500), 10);
  });

  test("uses the same year length as the contracts", () => {
    expect(SECONDS_PER_YEAR).toBe(365 * 24 * 60 * 60);
  });
});

describe("netApyPercent", () => {
  test("takes one percentage point off the rate, matching the fee model", () => {
    // The headline promise: a 5% rate leaves the user 4%.
    expect(netApyPercent(5, 100)).toBeCloseTo(4, 10);
  });

  test("never returns a negative rate when the fee exceeds the yield", () => {
    expect(netApyPercent(0.5, 100)).toBe(0);
  });

  test("returns the gross rate when there is no fee", () => {
    expect(netApyPercent(5, 0)).toBe(5);
  });

  test("treats a missing rate as zero", () => {
    expect(netApyPercent(0, 100)).toBe(0);
  });
});

describe("formatApyPercent", () => {
  test("always shows two decimals, so a rate never reads as exact", () => {
    expect(formatApyPercent(5)).toBe("5.00");
    expect(formatApyPercent(5.127)).toBe("5.13");
  });

  test("falls back to zero for unusable input", () => {
    expect(formatApyPercent(undefined)).toBe("0.00");
    expect(formatApyPercent(-1)).toBe("0.00");
  });
});
