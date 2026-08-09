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
  test("is on — the chain decides who actually sees earning", () => {
    // A network without a vault yield module registered reports
    // `supported: false`, and every earning surface renders nothing. So this
    // being on does not expose earning where it is not deployed.
    expect(isYieldEnabled()).toBe(true);
  });

  test("ignores the environment now that it has shipped", () => {
    // The local-only override is gone: leaving it in would mean a build could
    // still differ from what everyone else gets.
    process.env.REACT_APP_ENABLE_YIELD = "false";
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
