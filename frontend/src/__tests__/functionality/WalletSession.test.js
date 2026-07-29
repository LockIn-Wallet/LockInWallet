/**
 * Wallet logout session state.
 *
 * Neither MetaMask nor the Solana wallet adapter can be told to forget the
 * site, so a logout is only durable because of the flag these helpers own —
 * without it the silent auto-connect re-attaches the wallet on the next load.
 */
const {
  isWalletLoggedOut,
  markWalletLoggedOut,
  clearWalletLoggedOut,
} = require("../../utils/walletSession.js");
const { clearVaultCache } = require("../../adapters/TransactionManager.js");

describe("walletSession", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("defaults to connected when nothing was stored", () => {
    expect(isWalletLoggedOut()).toBe(false);
  });

  test("remembers a logout and forgets it on reconnect", () => {
    markWalletLoggedOut();
    expect(isWalletLoggedOut()).toBe(true);

    clearWalletLoggedOut();
    expect(isWalletLoggedOut()).toBe(false);
  });

  test("survives a page reload (value lives in localStorage)", () => {
    markWalletLoggedOut();
    expect(localStorage.getItem("wallet_logged_out")).toBe("true");
  });
});

describe("clearVaultCache", () => {
  const MINE = "0xaaa";
  const OTHER = "0xbbb";

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(`personal_vault_address_${MINE}`, "vault-1");
    localStorage.setItem(`active_vault_address_${MINE}`, "vault-2");
    localStorage.setItem(`personal_vault_address_${OTHER}`, "vault-3");
  });

  test("drops both cached vault keys for the wallet logging out", () => {
    clearVaultCache(MINE);

    expect(localStorage.getItem(`personal_vault_address_${MINE}`)).toBeNull();
    expect(localStorage.getItem(`active_vault_address_${MINE}`)).toBeNull();
  });

  test("leaves other wallets' cached vaults alone", () => {
    clearVaultCache(MINE);

    expect(localStorage.getItem(`personal_vault_address_${OTHER}`)).toBe("vault-3");
  });

  test("is a no-op without an address", () => {
    expect(() => clearVaultCache(null)).not.toThrow();
    expect(localStorage.getItem(`personal_vault_address_${MINE}`)).toBe("vault-1");
  });
});
