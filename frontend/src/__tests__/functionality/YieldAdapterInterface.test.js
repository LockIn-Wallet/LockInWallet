/**
 * Earning on savings — adapter interface compliance tests.
 *
 * Chain-free: verifies the unified adapter surface (base defaults for chains
 * without a yield module, the EVM adapter exposing the business methods, and the
 * TransactionManager's optional-capability probe) without a running node.
 */

const { BlockchainAdapter } = require("../../adapters/BlockchainAdapter.js");
const { EVMAdapter } = require("../../adapters/EVMAdapter.js");
const { TransactionManager } = require("../../adapters/TransactionManager.js");

const ZERO = "0x0000000000000000000000000000000000000000";

const YIELD_METHODS = [
  "supportsYield",
  "getYieldStatus",
  "getYieldOptions",
  "setYieldMode",
  "compoundVaultYield",
  "getClaimablePrizes",
  "claimVaultPrizes",
];

const YIELD_WRITES = ["setYieldMode", "compoundVaultYield", "claimVaultPrizes"];

describe("Yield adapter interface", () => {
  test("base adapter reports earning as unsupported", async () => {
    const adapter = new BlockchainAdapter({});
    expect(adapter.supportsYield()).toBe(false);
    expect(await adapter.getYieldStatus("1")).toEqual({ supported: false });
    expect(await adapter.getYieldOptions(ZERO)).toEqual([]);
  });

  test("base adapter write methods fail with a business-friendly message", async () => {
    const adapter = new BlockchainAdapter({});
    for (const method of YIELD_WRITES) {
      await expect(adapter[method]()).rejects.toThrow(
        "Earning on your savings is not available on this network yet",
      );
    }
  });

  test("EVM adapter implements the full earning interface", () => {
    const adapter = new EVMAdapter({ savingsContract: "0x0000000000000000000000000000000000000001" });
    for (const method of YIELD_METHODS) {
      expect(typeof adapter[method]).toBe("function");
    }
    expect(adapter.supportsYield()).toBe(true);
  });

  test("EVM adapter reports unsupported when the module is not registered", async () => {
    const adapter = new EVMAdapter({});
    adapter.savingsContract = { getModule: async () => ZERO };

    expect(await adapter.getYieldStatus("1")).toEqual({ supported: false });
    expect(await adapter.getYieldOptions(ZERO)).toEqual([]);
  });

  test("EVM adapter reports unsupported when there is no vault to configure", async () => {
    // The legacy EVM savings account holds its balance in SavingsCore, which
    // does not earn — the section has to hide rather than offer a broken toggle.
    const adapter = new EVMAdapter({});
    adapter.savingsContract = {
      getModule: async () => "0x0000000000000000000000000000000000000009",
    };
    adapter.signer = {};

    const status = await adapter.getYieldStatus(null);
    expect(status.supported).toBe(false);
    expect(status.reason).toBe("no-vault");
  });
});

describe("Solana adapter", () => {
  // Required lazily: importing SolanaAdapter pulls in @solana/web3.js, which is
  // pointless for the other cases in this file.
  test("reports earning as unsupported", async () => {
    const { SolanaAdapter } = require("../../adapters/SolanaAdapter.js");
    const adapter = Object.create(SolanaAdapter.prototype);

    expect(adapter.supportsYield()).toBe(false);
    expect(await adapter.getYieldStatus()).toEqual({ supported: false });
    expect(await adapter.getYieldOptions()).toEqual([]);
  });
});

describe("TransactionManager capability probe", () => {
  /** A manager wired to a bare stub, bypassing initialize()'s chain work. */
  function managerWith(adapter) {
    const manager = Object.create(TransactionManager.prototype);
    manager.adapter = adapter;
    manager.getAdapter = () => adapter;
    manager.getActiveVaultAddress = () => "1";
    return manager;
  }

  test("degrades to unsupported for an adapter that lacks the methods entirely", async () => {
    const manager = managerWith({});
    expect(manager.supportsYield()).toBe(false);
    expect(await manager.getYieldStatus()).toEqual({ supported: false });
    expect(await manager.getYieldOptions(ZERO)).toEqual([]);
  });

  test("delegates to the adapter when it does support earning", async () => {
    const calls = [];
    const manager = managerWith({
      supportsYield: () => true,
      getYieldStatus: async (vaultAddress) => {
        calls.push(vaultAddress);
        return { supported: true, mode: "stable" };
      },
      setYieldMode: async (vaultAddress, mode) => `tx:${vaultAddress}:${mode}`,
    });

    expect(manager.supportsYield()).toBe(true);
    expect(await manager.getYieldStatus()).toEqual({ supported: true, mode: "stable" });
    // The active vault is supplied by the manager, not the component.
    expect(calls).toEqual(["1"]);
    expect(await manager.setYieldMode("off")).toBe("tx:1:off");
  });
});
