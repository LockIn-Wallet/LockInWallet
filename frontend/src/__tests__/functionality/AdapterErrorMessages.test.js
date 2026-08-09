/**
 * Error translation — no raw chain failure should ever reach the UI.
 *
 * EVM hands back a page-long ethers blob wrapped around a require() string and
 * Solana hands back "custom program error: 0x1771"; both must leave the adapter
 * as a sentence the user can act on. Chain-free: no node or validator needed.
 */

const { EVMAdapter } = require("../../adapters/EVMAdapter.js");
const { SolanaAdapter } = require("../../adapters/SolanaAdapter.js");

const USER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const USDT = "0x09635F643e140090A9A8Dcd712eD6285858ceBef";

function makeEvmAdapter() {
  const adapter = new EVMAdapter({
    chainId: 31337,
    savingsContract: "0x" + "1".repeat(40),
    tokens: { USDT: { address: USDT, symbol: "USDT", decimals: 6 } },
  });
  adapter.userAddress = USER;
  adapter.savingsContract = {};
  return adapter;
}

// The shape ethers v6 throws for a reverting estimateGas
function revert(reason) {
  const error = new Error(
    `execution reverted: "${reason}" (action="estimateGas", data="0x08c379a0…", ` +
      `reason="${reason}", code=CALL_EXCEPTION, version=6.15.0)`,
  );
  error.reason = reason;
  error.code = "CALL_EXCEPTION";
  return error;
}

describe("EVM revert translation", () => {
  const cases = [
    ["Exceeds limit", "This is over one of your spending limits — request a bypass to withdraw it"],
    ["Not a vault member", "You are not a member of this vault"],
    ["Address already exists", "That address is already on your list"],
    ["Cannot set own address as destination", "Your own address is always available — no need to add it"],
    ["Request still in timelock", "The waiting period is not over yet"],
    ["Setup committed - use proposals", "Your setup is locked in — changing a limit takes a proposal"],
    ["Account is frozen", "This account is frozen — its recovery key can unfreeze it"],
    ["Insufficient shares", "That is more than you have in the prize pool"],
    ["No vault for token", "The prize pool does not accept this token"],
  ];

  test.each(cases)("%s is rewritten for the user", (reason, expected) => {
    expect(makeEvmAdapter()._translateError(revert(reason)).message).toBe(expected);
  });

  const yieldCases = [
    [
      "Insufficient strategy liquidity",
      "The savings protocol is temporarily out of liquidity — try a smaller amount, or try again shortly",
    ],
    ["Yield module not configured", "Earning on savings is not switched on for this network yet"],
    ["Strategy asset mismatch", "That earning strategy does not match this vault's token"],
    ["No strategy for token", "This vault's token cannot earn yield yet"],
    ["Strategies paused", "Earning is paused right now — your savings are untouched"],
    [
      "Community yield immutable",
      "A community vault's earning setting is fixed when it is created",
    ],
    ["Pending yield not zero", "Collect your earnings before leaving the vault"],
    ["Yield mode unchanged", "That is already your setting"],
    ["Fee above maximum", "That fee is above the allowed maximum"],
  ];

  test.each(yieldCases)("earning revert %s is rewritten for the user", (reason, expected) => {
    expect(makeEvmAdapter()._translateError(revert(reason)).message).toBe(expected);
  });

  // The table is scanned in order, so a short entry placed above a longer one
  // that contains it would swallow the longer message. These are the pairs that
  // actually overlap.
  test("a longer earning revert is not shadowed by a shorter one it contains", () => {
    const adapter = makeEvmAdapter();
    expect(adapter._translateError(revert("Strategy change not ready")).message).toBe(
      "That strategy change is still in its waiting period",
    );
    expect(adapter._translateError(revert("Strategy change not queued")).message).toBe(
      "That strategy change has not been queued yet",
    );
    // "No vault for token" (prize pool) must not capture "No strategy for token"
    expect(adapter._translateError(revert("No strategy for token")).message).toBe(
      "This vault's token cannot earn yield yet",
    );
  });

  test("keeps the ethers blob out of the message when nothing matches", () => {
    const error = new Error("execution reverted: Something unmapped (action=…, data=0x…)");
    error.shortMessage = "execution reverted: Something unmapped";

    const translated = makeEvmAdapter()._translateError(error, "Withdrawal failed");

    expect(translated.message).toBe(
      "Withdrawal failed: execution reverted: Something unmapped",
    );
    expect(translated.message).not.toContain("action=");
  });

  test("reads the reason out of the nested provider payload", () => {
    const error = new Error("Internal JSON-RPC error.");
    error.info = { error: { message: 'execution reverted: "Only creator"' } };

    expect(makeEvmAdapter()._translateError(error).message).toBe(
      "Only the vault's creator can do this",
    );
  });

  test("a rejected signature is not reported as a failure", () => {
    const error = new Error("MetaMask Tx Signature: User denied transaction signature.");
    error.code = 4001;

    expect(makeEvmAdapter()._translateError(error).message).toBe(
      "Transaction cancelled in your wallet",
    );
  });

  test("names a gas shortfall rather than the raw provider text", () => {
    const error = new Error("insufficient funds for intrinsic transaction cost");

    expect(makeEvmAdapter()._translateError(error).message).toBe(
      "Not enough ETH in your wallet to pay the network fee",
    );
  });

  test("never re-wraps a message already written for the user", () => {
    const adapter = makeEvmAdapter();
    const original = adapter._userError("Not enough USDT in your wallet — you have 0 USDT available");

    expect(adapter._translateError(original, "Deposit failed")).toBe(original);
  });

  test("write methods leave the adapter already translated", async () => {
    const adapter = makeEvmAdapter();
    adapter._getVaultModule = jest.fn().mockResolvedValue({
      joinVault: jest.fn().mockRejectedValue(revert("Personal vault")),
    });

    await expect(adapter.joinVault("1")).rejects.toThrow("A personal vault cannot be joined");
  });
});

describe("EVM deposit balance guard", () => {
  function makeDepositFixture(walletBalance) {
    const adapter = makeEvmAdapter();
    adapter._resolveTokenMeta = jest
      .fn()
      .mockResolvedValue({ symbol: "USDT", decimals: 6, isNative: false });
    adapter.provider = {};
    adapter.approveToken = jest.fn();
    adapter.savingsContract = {
      "deposit(address,uint256)": jest.fn(),
    };
    // ethers.Contract(...).balanceOf() reads through the provider
    jest
      .spyOn(require("ethers").ethers, "Contract")
      .mockImplementation(() => ({ balanceOf: jest.fn().mockResolvedValue(walletBalance) }));
    return adapter;
  }

  afterEach(() => jest.restoreAllMocks());

  test("refuses before spending gas on the doomed approval", async () => {
    const adapter = makeDepositFixture(5000000n); // 5 USDT in the wallet

    await expect(adapter.deposit(USDT, "500", 6)).rejects.toThrow(
      "Not enough USDT in your wallet — you have 5 USDT available",
    );
    expect(adapter.approveToken).not.toHaveBeenCalled();
    expect(adapter.savingsContract["deposit(address,uint256)"]).not.toHaveBeenCalled();
  });

  test("an affordable deposit still goes through", async () => {
    const adapter = makeDepositFixture(600000000n); // 600 USDT
    adapter.savingsContract["deposit(address,uint256)"] = jest
      .fn()
      .mockResolvedValue({ hash: "0xhash", wait: jest.fn().mockResolvedValue({}) });

    await expect(adapter.deposit(USDT, "500", 6)).resolves.toMatchObject({ success: true });
    expect(adapter.approveToken).toHaveBeenCalled();
  });
});

describe("Solana program error translation", () => {
  const adapter = new SolanaAdapter({}, null, null);

  test("decodes the error code the RPC reports", () => {
    const error = new Error(
      "failed to send transaction: Transaction simulation failed: Error processing " +
        "Instruction 0: custom program error: 0x1773",
    );

    expect(adapter._translateError(error).message).toBe(
      "This is over your spending limit — request a bypass to withdraw it",
    );
  });

  test("prefers the message anchor prints, since codes restart per program", () => {
    const error = new Error("Transaction simulation failed");
    error.logs = [
      "Program log: AnchorError occurred. Error Code: BalanceNotZero. Error Number: 6013. " +
        "Error Message: Member balance must be zero to leave.",
    ];

    expect(adapter._translateError(error).message).toBe(
      "Member balance must be zero to leave",
    );
  });

  test("decodes the structured instruction error from confirmation", () => {
    expect(
      adapter._translateError({ err: { InstructionError: [0, { Custom: 6002 }] } }).message,
    ).toBe("That is more than your balance");
  });

  test("names a missing fee balance", () => {
    const error = new Error("Attempt to debit an account but found no record of a prior credit.");

    expect(adapter._translateError(error).message).toBe(
      "Not enough SOL in your wallet to pay the network fee",
    );
  });

  test("falls back without leaking the simulation dump", () => {
    const error = new Error("Something the program did not name");

    expect(adapter._translateError(error, "Withdrawal failed").message).toBe(
      "Withdrawal failed: Something the program did not name",
    );
  });

  test("an unmapped code does not invent a message", () => {
    const error = new Error("custom program error: 0x9999");

    expect(adapter._translateError(error, "Deposit failed").message).toContain("Deposit failed");
  });
});
