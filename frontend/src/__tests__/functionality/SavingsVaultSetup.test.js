/**
 * Locking in creates the savings vault itself.
 *
 * The main wallet is a vault — the same primitive as any pot, with its rules in
 * the same modules — so what these cover is that lock-in produces one, that it
 * holds the coins the app treats as dollars, and that a vault holding several
 * coins never has to guess which one an instruction was about.
 */
const { TransactionManager } = require("../../adapters/TransactionManager.js");
const { getStablecoins, STABLECOIN_SYMBOLS } = require("../../utils/stablecoins.js");

const USDC = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";
const USDT = "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58";
const DAI = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
const ZERO = "0x0000000000000000000000000000000000000000";

const PERIODS = [{ name: "Daily", limit: 100, duration: 86400, unlockDelay: 86400 }];

const configWith = (tokens) => ({ tokens });

const fullConfig = configWith({
  USDC: { address: USDC, symbol: "USDC", decimals: 6 },
  USDT: { address: USDT, symbol: "USDT", decimals: 6 },
  DAI: { address: DAI, symbol: "DAI", decimals: 18 },
});

function evmManager(adapter, networkConfig = fullConfig) {
  const tm = new TransactionManager();
  tm.networkType = "evm";
  tm.networkConfig = networkConfig;
  tm.adapter = adapter;
  return tm;
}

const creatingAdapter = () => ({
  createVault: jest.fn().mockResolvedValue({ vaultAddress: "7", signature: "0xsig" }),
  getAddress: jest.fn().mockReturnValue("0xwallet"),
});

beforeEach(() => localStorage.clear());

describe("which coins count as dollars", () => {
  test("takes them from the network, in the app's own order", () => {
    expect(getStablecoins(fullConfig).map((t) => t.symbol)).toEqual(STABLECOIN_SYMBOLS);
  });

  test("leaves out a coin that is not deployed on this network", () => {
    // A local chain lists coins it has no contract for. A vault that accepted
    // one would take a coin nobody can actually send.
    const partial = configWith({
      USDT: { address: USDT, symbol: "USDT", decimals: 6 },
      USDC: { address: ZERO, symbol: "USDC", decimals: 6 },
      DAI: { address: ZERO, symbol: "DAI", decimals: 18 },
    });
    expect(getStablecoins(partial).map((t) => t.symbol)).toEqual(["USDT"]);
  });

  test("says nothing rather than guessing when the network has no tokens", () => {
    expect(getStablecoins(undefined)).toEqual([]);
  });
});

describe("locking in", () => {
  test("creates a stablecoins vault holding every dollar coin on the network", async () => {
    const tm = evmManager(creatingAdapter());

    const signature = await tm.commitSetup(PERIODS, {});

    expect(signature).toBe("0xsig");
    expect(tm.adapter.createVault).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Savings",
        kind: "stables",
        vaultType: "Personal",
        tokens: [USDC, USDT, DAI],
        periods: PERIODS,
        limitsArePercentage: false,
      }),
    );
  });

  test("remembers the vault, so the app has something to select", async () => {
    const tm = evmManager(creatingAdapter());
    await tm.commitSetup(PERIODS, {});

    expect(tm.getPersonalVaultAddress()).toBe("7");
    expect(tm.isSetupCommitted()).toBe(true);
  });

  test("refuses a percentage cap on a vault holding several coins", async () => {
    const tm = evmManager(creatingAdapter());

    // A percentage of a mixed balance would need the coins priced against each
    // other, which is exactly what a shared dollar cap avoids.
    await expect(tm.commitSetup(PERIODS, { limitsArePercentage: true })).rejects.toThrow(
      "capped in dollars",
    );
    expect(tm.adapter.createVault).not.toHaveBeenCalled();
  });

  test("says so plainly when the network has no dollar coins yet", async () => {
    const tm = evmManager(creatingAdapter(), configWith({}));

    await expect(tm.commitSetup(PERIODS, {})).rejects.toThrow("No stablecoins");
  });

  test("still reports the pre-vault account as unknown until it is asked", () => {
    const tm = evmManager(creatingAdapter());
    // Someone who locked in before vaults existed has their setup in the
    // account, and only the account can answer.
    expect(tm.isSetupCommitted()).toBeNull();
  });
});

describe("balances of a vault holding several coins", () => {
  const membership = {
    balances: {
      [USDC]: { raw: 1500000n, symbol: "USDC", decimals: 6 },
      [DAI]: { raw: 2000000000000000000n, symbol: "DAI", decimals: 18 },
    },
  };

  test("reports every coin, not just the first", async () => {
    const tm = evmManager({
      getVaultInfo: jest.fn().mockResolvedValue({ tokens: [] }),
      getVaultMemberInfo: jest.fn().mockResolvedValue(membership),
      checkAndSweepVaultProxy: jest.fn(),
    });
    tm.activeVaultAddress = "7";

    expect(await tm.getAllBalances("0xwallet")).toEqual({ USDC: "1.5", DAI: "2" });
  });
});

describe("naming the coin", () => {
  test("passes the chosen coin through to a deposit", async () => {
    const tm = evmManager({ depositToVault: jest.fn().mockResolvedValue("0xdep") });
    tm.activeVaultAddress = "7";

    await tm.deposit(USDC, "25", 6);

    // Dropping it here deposited whichever coin happened to be first.
    expect(tm.adapter.depositToVault).toHaveBeenCalledWith("7", 25, USDC);
  });

  test("passes the chosen coin and destination through to a withdrawal", async () => {
    const tm = evmManager({ withdrawFromVault: jest.fn().mockResolvedValue("0xwd") });
    tm.activeVaultAddress = "7";

    await tm.withdraw(10, DAI, "0xdestination");

    expect(tm.adapter.withdrawFromVault).toHaveBeenCalledWith("7", 10, DAI, "0xdestination");
  });
});
