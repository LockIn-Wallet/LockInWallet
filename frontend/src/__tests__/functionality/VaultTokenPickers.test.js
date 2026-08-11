/**
 * The coin pickers offer only what the vault takes.
 *
 * A vault is created holding a specific set of coins and refuses the rest, so
 * offering the whole network's list means offering deposits that revert. What
 * matters most here is the "unknown" case: a vault that has not loaded must not
 * collapse the picker to nothing, because an empty picker blocks a deposit just
 * as thoroughly as a wrong one.
 */
const {
  filterToVaultTokens,
  vaultAcceptsNative,
} = require("../../hooks/useVaultTokens.js");

const USDC = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";
const USDT = "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58";
const DAI = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";

const NETWORK_TOKENS = {
  USDC: { address: USDC, symbol: "USDC", decimals: 6 },
  USDT: { address: USDT, symbol: "USDT", decimals: 6 },
  DAI: { address: DAI, symbol: "DAI", decimals: 18 },
};

describe("narrowing the picker to a vault's coins", () => {
  test("keeps only the coins the vault holds", () => {
    const vaultTokens = [
      { address: USDC, symbol: "USDC", decimals: 6, isNative: false },
      { address: DAI, symbol: "DAI", decimals: 18, isNative: false },
    ];

    expect(Object.keys(filterToVaultTokens(NETWORK_TOKENS, vaultTokens))).toEqual(["USDC", "DAI"]);
  });

  test("matches regardless of address casing", () => {
    const vaultTokens = [
      { address: USDC.toLowerCase(), symbol: "USDC", decimals: 6, isNative: false },
    ];

    expect(Object.keys(filterToVaultTokens(NETWORK_TOKENS, vaultTokens))).toEqual(["USDC"]);
  });

  test("leaves the full list alone while the vault is unknown", () => {
    // Null means "not loaded", not "accepts nothing". Treating it as the latter
    // would leave someone staring at an empty picker.
    expect(filterToVaultTokens(NETWORK_TOKENS, null)).toBe(NETWORK_TOKENS);
  });

  test("returns nothing when the vault genuinely holds none of them", () => {
    const vaultTokens = [
      { address: "0x1111111111111111111111111111111111111111", symbol: "WBTC", decimals: 8, isNative: false },
    ];

    expect(filterToVaultTokens(NETWORK_TOKENS, vaultTokens)).toEqual({});
  });
});

describe("whether native coin is on offer", () => {
  test("hides it from a vault that holds only stablecoins", () => {
    // A dollar cap cannot measure a coin whose value moves, so the contract
    // refuses it — offering it would be a guaranteed failure.
    const vaultTokens = [{ address: USDC, symbol: "USDC", decimals: 6, isNative: false }];

    expect(vaultAcceptsNative(vaultTokens)).toBe(false);
  });

  test("offers it to a vault that holds it", () => {
    const vaultTokens = [{ address: null, symbol: "ETH", decimals: 18, isNative: true }];

    expect(vaultAcceptsNative(vaultTokens)).toBe(true);
  });

  test("offers it while the vault is unknown", () => {
    expect(vaultAcceptsNative(null)).toBe(true);
  });
});
