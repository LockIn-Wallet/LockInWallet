// Unit tests for feature flags and their effect on network availability
const {
  isSolanaEnabled,
  isPrizePoolEnabled,
  isYieldEnabled,
  isLinkVisible,
} = require("../featureFlags.js");
const { getAvailableNetworks } = require("../networkFilter.js");

const ORIGINAL_ENV = process.env.REACT_APP_ENABLE_SOLANA;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.REACT_APP_ENABLE_SOLANA;
  } else {
    process.env.REACT_APP_ENABLE_SOLANA = ORIGINAL_ENV;
  }
});

describe("isSolanaEnabled", () => {
  test("is off by default", () => {
    delete process.env.REACT_APP_ENABLE_SOLANA;
    expect(isSolanaEnabled()).toBe(false);
  });

  test("is off unless explicitly set to 'true'", () => {
    process.env.REACT_APP_ENABLE_SOLANA = "false";
    expect(isSolanaEnabled()).toBe(false);

    process.env.REACT_APP_ENABLE_SOLANA = "1";
    expect(isSolanaEnabled()).toBe(false);
  });

  test("is on when set to 'true'", () => {
    process.env.REACT_APP_ENABLE_SOLANA = "true";
    expect(isSolanaEnabled()).toBe(true);
  });
});

describe("isPrizePoolEnabled", () => {
  // Hardcoded off in featureFlags.js — this test is the tripwire that fails
  // if the prize pool is switched back on without the feature being ready
  test("is off while the feature is unfinished", () => {
    expect(isPrizePoolEnabled()).toBe(false);
  });
});

describe("isYieldEnabled", () => {
  // Hardcoded off in featureFlags.js — this test is the tripwire that fails if
  // earning is switched on before a YieldModule and strategy are live
  test("is off until the yield module is deployed and verified", () => {
    delete process.env.REACT_APP_ENABLE_YIELD;
    expect(isYieldEnabled()).toBe(false);
  });

  test("stays off for anything short of an explicit opt-in", () => {
    // Only the exact string turns it on, so a stray "1" or "yes" in an
    // environment file cannot ship the feature by accident.
    for (const value of ["1", "yes", "TRUE", ""]) {
      process.env.REACT_APP_ENABLE_YIELD = value;
      expect(isYieldEnabled()).toBe(false);
    }
    delete process.env.REACT_APP_ENABLE_YIELD;
  });

  test("can be switched on locally to look at it", () => {
    process.env.REACT_APP_ENABLE_YIELD = "true";
    expect(isYieldEnabled()).toBe(true);
    delete process.env.REACT_APP_ENABLE_YIELD;
  });
});

describe("isLinkVisible", () => {
  test("keeps links that carry no flag", () => {
    expect(isLinkVisible({ label: "Governance", href: "/governance" })).toBe(true);
  });

  test("follows the flag when a link carries one", () => {
    expect(isLinkVisible({ label: "On", flag: () => true })).toBe(true);
    expect(isLinkVisible({ label: "Off", flag: () => false })).toBe(false);
  });

  test("hides the prize pool link while its flag is off", () => {
    expect(isLinkVisible({ label: "Prize pool", flag: isPrizePoolEnabled })).toBe(
      false
    );
  });
});

describe("getAvailableNetworks with the Solana flag", () => {
  test("returns no Solana networks when the flag is off", () => {
    delete process.env.REACT_APP_ENABLE_SOLANA;
    expect(getAvailableNetworks("solana")).toEqual([]);
  });

  test("returns Solana networks when the flag is on", () => {
    process.env.REACT_APP_ENABLE_SOLANA = "true";
    expect(getAvailableNetworks("solana").length).toBeGreaterThan(0);
  });

  test("EVM networks are unaffected by the flag", () => {
    delete process.env.REACT_APP_ENABLE_SOLANA;
    expect(getAvailableNetworks("evm").length).toBeGreaterThan(0);
  });
});
