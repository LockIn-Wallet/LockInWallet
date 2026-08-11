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

// getAddress is async on EVM. Mocking it that way is the point: using it
// synchronously stored everything under the string "[object Promise]".
const creatingAdapter = () => ({
  createVault: jest.fn().mockResolvedValue({ vaultAddress: "7", signature: "0xsig" }),
  getAddress: jest.fn().mockResolvedValue("0xwallet"),
  userAddress: "0xwallet",
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

  test("stores the vault under the wallet's address, not a stringified promise", async () => {
    const tm = evmManager(creatingAdapter());
    await tm.commitSetup(PERIODS, {});

    // getAddress is async here. Read synchronously it yields "[object Promise]"
    // — one key shared by every wallet, and never the one a reload looks under.
    const keys = Object.keys(localStorage);
    expect(keys.some((key) => key.includes("[object Promise]"))).toBe(false);
    expect(keys.some((key) => key.endsWith("0xwallet"))).toBe(true);
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

  test("reports not set up until a vault exists", () => {
    const tm = evmManager(creatingAdapter());
    // The pre-vault account used to answer this on EVM. It is gone: a savings
    // vault is the only thing that counts as being locked in.
    expect(tm.isSetupCommitted()).toBe(false);
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

describe("knowing the savings vault is there after a reload", () => {
  const WALLET = "0xAbC0000000000000000000000000000000000001";
  const savingsVault = {
    address: "7",
    vaultType: "Personal",
    creator: WALLET,
    tokens: [{ address: USDC, symbol: "USDC", decimals: 6, isNative: false }],
  };

  const restoringAdapter = (overrides = {}) => ({
    connect: jest.fn(),
    getAddress: jest.fn().mockResolvedValue(WALLET),
    userAddress: WALLET,
    getVaultInfo: jest.fn().mockResolvedValue(savingsVault),
    getUserVaults: jest.fn().mockResolvedValue([{ vault: savingsVault, membership: {} }]),
    getIsSetupCommitted: jest.fn().mockResolvedValue(false),
    ...overrides,
  });

  test("finds the vault on EVM, not just on Solana", async () => {
    // Without this the app reloads knowing nothing about the vault it just
    // made, decides setup never happened, and locks in again — one more vault
    // every time.
    const tm = evmManager(restoringAdapter());
    await tm._loadPersonalVault();

    expect(tm.getPersonalVaultAddress()).toBe("7");
  });

  test("matches the creator whatever case the address arrived in", async () => {
    const tm = evmManager(
      restoringAdapter({
        getAddress: jest.fn().mockResolvedValue(WALLET.toLowerCase()),
        userAddress: WALLET.toLowerCase(),
      }),
    );
    await tm._loadPersonalVault();

    // A checksummed address from the contract and a lowercase one from the
    // wallet are the same address.
    expect(tm.getPersonalVaultAddress()).toBe("7");
  });

  test("counts as locked in without asking the account", async () => {
    const tm = evmManager(restoringAdapter());
    await tm._loadPersonalVault();

    await expect(tm.getIsSetupCommitted(WALLET)).resolves.toBe(true);
    expect(tm.adapter.getIsSetupCommitted).not.toHaveBeenCalled();
  });

  test("never falls back to the pre-vault account", async () => {
    const tm = evmManager(
      restoringAdapter({
        getUserVaults: jest.fn().mockResolvedValue([]),
        getVaultInfo: jest.fn().mockResolvedValue(null),
        // Even an account that says it is committed no longer counts. Its
        // balance lives in SavingsCore, which cannot earn and which the app no
        // longer routes to at all.
        getIsSetupCommitted: jest.fn().mockResolvedValue(true),
      }),
    );
    await tm._loadPersonalVault();

    await expect(tm.getIsSetupCommitted(WALLET)).resolves.toBe(false);
    expect(tm.adapter.getIsSetupCommitted).not.toHaveBeenCalled();
  });

  test("refuses to lock in a second time", async () => {
    const tm = evmManager(creatingAdapter());
    await tm.commitSetup(PERIODS, {});

    // Unguarded this is silent: it just makes another vault and splits the
    // money across them.
    await expect(tm.commitSetup(PERIODS, {})).rejects.toThrow("already locked in");
    expect(tm.adapter.createVault).toHaveBeenCalledTimes(1);
  });
});
