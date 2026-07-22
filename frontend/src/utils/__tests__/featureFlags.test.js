// Unit tests for feature flags and their effect on network availability
const { isSolanaEnabled } = require("../featureFlags.js");
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
