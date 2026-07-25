/**
 * Recovery protection — adapter interface compliance tests.
 *
 * Chain-free: verifies the unified adapter surface (base defaults for
 * networks without the recovery module, and the EVM adapter exposing the
 * same business methods) without needing a running validator or node.
 */

const { BlockchainAdapter } = require("../../adapters/BlockchainAdapter.js");
const { EVMAdapter } = require("../../adapters/EVMAdapter.js");

const RECOVERY_METHODS = [
  "getRecoveryStatus",
  "setRecoveryAddress",
  "freezeAccount",
  "unfreezeAccount",
  "requestRecoveryKeyChange",
  "executeRecoveryKeyChange",
  "cancelRecoveryKeyChange",
  "recoverAccount",
];

describe("Recovery adapter interface", () => {
  test("base adapter reports recovery as unsupported", async () => {
    const adapter = new BlockchainAdapter({});
    const status = await adapter.getRecoveryStatus("someAddress");
    expect(status).toEqual({ supported: false });
  });

  test("base adapter write methods fail with a business-friendly message", async () => {
    const adapter = new BlockchainAdapter({});
    for (const method of RECOVERY_METHODS.filter((m) => m !== "getRecoveryStatus")) {
      await expect(adapter[method]()).rejects.toThrow(
        "Recovery protection is not available on this network yet",
      );
    }
  });

  test("EVM adapter implements the full recovery interface", () => {
    const adapter = new EVMAdapter({ savingsContract: "0x0000000000000000000000000000000000000001" });
    for (const method of RECOVERY_METHODS) {
      expect(typeof adapter[method]).toBe("function");
    }
  });

  test("EVM adapter reports unsupported when the module is not registered", async () => {
    const adapter = new EVMAdapter({});
    // Simulate a connected adapter whose chain has no recovery module
    adapter.savingsContract = {
      getModule: async () => "0x0000000000000000000000000000000000000000",
    };
    const status = await adapter.getRecoveryStatus("0x0000000000000000000000000000000000000002");
    expect(status).toEqual({ supported: false });
  });

  test("EVM adapter recovery token list always includes the native token", () => {
    const adapter = new EVMAdapter({
      tokens: {
        USDT: { address: "0x0000000000000000000000000000000000000123" },
        BROKEN: {},
      },
    });
    const tokens = adapter._recoveryTokenAddresses();
    expect(tokens[0]).toBe("0x0000000000000000000000000000000000000000");
    expect(tokens).toContain("0x0000000000000000000000000000000000000123");
    expect(tokens).toHaveLength(2);
  });

  test("EVM adapter translates contract errors to business messages", () => {
    const adapter = new EVMAdapter({});
    const cases = [
      [{ message: "execution reverted: Only recovery key" }, "Only the account's recovery key can do this"],
      [{ message: "execution reverted: Account is frozen" }, "This account is frozen"],
      [{ message: "execution reverted: Still in timelock" }, "The waiting period is not over yet"],
      [{ code: 4001, message: "user rejected" }, "Transaction cancelled by user"],
    ];
    for (const [input, expected] of cases) {
      expect(adapter._translateRecoveryError(input, "fallback").message).toBe(expected);
    }
  });
});
