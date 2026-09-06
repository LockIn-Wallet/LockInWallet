/**
 * Locked vaults — adapter interface compliance and draft validation.
 *
 * Chain-free: checks the unified adapter surface (base defaults for chains
 * without a lock factory, the EVM adapter exposing the business methods, the
 * TransactionManager passthrough) and the pure rules a lock draft must pass
 * before anything is signed. The contracts themselves are covered in
 * ethereum/test/LockedVaults.ts.
 */

const { BlockchainAdapter } = require("../../adapters/BlockchainAdapter.js");
const { EVMAdapter } = require("../../adapters/EVMAdapter.js");
const { TransactionManager } = require("../../adapters/TransactionManager.js");
const {
  LOCK_RULE_TYPES,
  MAX_LOCK_HORIZON_SECONDS,
  validateLockDraft,
  describeRule,
  lockStatus,
  daysUntil,
  lockProofPath,
  findPriceFeed,
} = require("../../utils/locks.js");

const ZERO = "0x0000000000000000000000000000000000000000";
const FACTORY = "0x0000000000000000000000000000000000000002";
const NOW = 1_800_000_000;
const DAY = 86400;

const LOCK_METHODS = ["supportsLocks", "getLocks", "getLock", "createLock", "depositToLock", "releaseLock"];
const LOCK_WRITES = ["createLock", "depositToLock", "releaseLock"];

describe("Locked vault adapter interface", () => {
  test("base adapter reports locks as unsupported and reads as empty", async () => {
    const adapter = new BlockchainAdapter({});
    expect(adapter.supportsLocks()).toBe(false);
    expect(await adapter.getLocks("0xabc")).toEqual([]);
    expect(await adapter.getLock("0xabc")).toBeNull();
  });

  test("base adapter write methods fail with a business-friendly message", async () => {
    const adapter = new BlockchainAdapter({});
    for (const method of LOCK_WRITES) {
      await expect(adapter[method]()).rejects.toThrow("Locked vaults are not available on this network yet");
    }
  });

  test("EVM adapter implements the full lock interface", () => {
    const adapter = new EVMAdapter({ savingsContract: "0x0000000000000000000000000000000000000001" });
    for (const method of LOCK_METHODS) {
      expect(typeof adapter[method]).toBe("function");
    }
  });

  test("EVM adapter only supports locks when the network has a factory", () => {
    const without = new EVMAdapter({ lockedVaultFactory: ZERO });
    const withFactory = new EVMAdapter({ lockedVaultFactory: FACTORY });
    expect(without.supportsLocks()).toBe(false);
    expect(withFactory.supportsLocks()).toBe(true);
  });

  test("EVM adapter refuses an unknown price feed before touching the chain", async () => {
    const adapter = new EVMAdapter({ lockedVaultFactory: FACTORY, priceFeeds: [] });
    await expect(
      adapter.createLock({ ruleType: LOCK_RULE_TYPES.price, feed: "0xfeed", threshold: 1, deadline: NOW + DAY }),
    ).rejects.toThrow("not one this app verifies");
  });

  test("TransactionManager degrades to unsupported without an adapter method", async () => {
    const tm = new TransactionManager();
    tm.adapter = {};
    tm.networkType = "evm";
    expect(tm.supportsLocks()).toBe(false);
    expect(await tm.getLocks()).toEqual([]);
    expect(await tm.getLock("0xabc")).toBeNull();
  });

  test("TransactionManager forwards lock calls with the owner's address", async () => {
    const adapter = {
      supportsLocks: () => true,
      getAddress: jest.fn().mockResolvedValue("0xowner"),
      getLocks: jest.fn().mockResolvedValue([{ address: "0xlock" }]),
      createLock: jest.fn().mockResolvedValue({ lockAddress: "0xlock" }),
      depositToLock: jest.fn().mockResolvedValue("0xtx"),
      releaseLock: jest.fn().mockResolvedValue("0xtx"),
    };
    const tm = new TransactionManager();
    tm.adapter = adapter;
    tm.networkType = "evm";

    expect(await tm.getLocks()).toEqual([{ address: "0xlock" }]);
    expect(adapter.getLocks).toHaveBeenCalledWith("0xowner");
    await tm.createLock({ ruleType: "date" });
    expect(adapter.createLock).toHaveBeenCalledWith({ ruleType: "date" });
    await tm.depositToLock("0xlock", ZERO, "1");
    expect(adapter.depositToLock).toHaveBeenCalledWith("0xlock", ZERO, "1");
    await tm.releaseLock("0xlock", ZERO);
    expect(adapter.releaseLock).toHaveBeenCalledWith("0xlock", ZERO);
  });
});

describe("Lock draft validation", () => {
  const date = (unlockAt) => ({ ruleType: LOCK_RULE_TYPES.date, unlockAt });
  const price = (overrides) => ({
    ruleType: LOCK_RULE_TYPES.price,
    feed: "0xfeed",
    threshold: 5000,
    above: true,
    deadline: NOW + 365 * DAY,
    ...overrides,
  });

  test("a date lock needs a future date within ten years", () => {
    expect(validateLockDraft(date(NOW + DAY), NOW)).toBeNull();
    expect(validateLockDraft(date(NOW), NOW)).toMatch(/future/);
    expect(validateLockDraft(date(null), NOW)).toMatch(/Choose the date/);
    expect(validateLockDraft(date(NOW + MAX_LOCK_HORIZON_SECONDS + 1), NOW)).toMatch(/ten years/);
  });

  test("a price lock needs a feed, a positive price and a future deadline", () => {
    expect(validateLockDraft(price({}), NOW)).toBeNull();
    expect(validateLockDraft(price({ feed: "" }), NOW)).toMatch(/price to watch/);
    expect(validateLockDraft(price({ threshold: 0 }), NOW)).toMatch(/price that opens/);
    expect(validateLockDraft(price({ deadline: NOW - 1 }), NOW)).toMatch(/future/);
    expect(validateLockDraft(price({ deadline: NOW + MAX_LOCK_HORIZON_SECONDS + 1 }), NOW)).toMatch(/ten years/);
  });

  test("an unknown rule type is rejected", () => {
    expect(validateLockDraft({ ruleType: "coinflip" }, NOW)).toMatch(/how the lock opens/);
  });
});

describe("Lock presentation", () => {
  const deadline = Date.UTC(2027, 2, 12) / 1000;

  test("describes a date lock by its deadline alone", () => {
    expect(describeRule({ deadline, condition: null })).toMatch(/^Opens on .*2027\.$/);
  });

  test("describes a price lock with its feed, direction and fallback date", () => {
    const text = describeRule({
      deadline,
      condition: { kind: "Price", feedLabel: "ETH / USD", threshold: 5000, above: true },
    });
    expect(text).toContain("ETH / USD rises to or above 5,000");
    expect(text).toMatch(/2027 at the latest\.$/);
  });

  test("status follows unlock state and balance", () => {
    expect(lockStatus({ unlocked: false, hasBalance: true })).toBe("locked");
    expect(lockStatus({ unlocked: true, hasBalance: true })).toBe("ready");
    expect(lockStatus({ unlocked: true, hasBalance: false })).toBe("released");
  });

  test("days until never goes negative", () => {
    expect(daysUntil(NOW + 2 * DAY, NOW)).toBe(2);
    expect(daysUntil(NOW - DAY, NOW)).toBe(0);
  });

  test("proof path and feed lookup", () => {
    expect(lockProofPath("base", "0xlock")).toBe("/lock/base/0xlock");
    const config = { priceFeeds: [{ label: "ETH / USD", address: "0xABC", decimals: 8 }] };
    expect(findPriceFeed(config, "0xabc").label).toBe("ETH / USD");
    expect(findPriceFeed(config, "0xdef")).toBeNull();
  });
});
