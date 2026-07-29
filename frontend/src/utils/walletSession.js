/**
 * Wallet session state.
 *
 * MetaMask has no programmatic disconnect and the Solana wallet adapter
 * auto-connects, so "logged out" is something the app has to remember itself:
 * without this flag the silent auto-connect would re-attach the same wallet
 * within seconds of a reload and the user could never reach the logged-out
 * home page or pick a different wallet.
 */
const WALLET_LOGGED_OUT_KEY = "wallet_logged_out";

export const isWalletLoggedOut = () =>
  localStorage.getItem(WALLET_LOGGED_OUT_KEY) === "true";

export const markWalletLoggedOut = () =>
  localStorage.setItem(WALLET_LOGGED_OUT_KEY, "true");

export const clearWalletLoggedOut = () =>
  localStorage.removeItem(WALLET_LOGGED_OUT_KEY);
