/**
 * The one place that knows which wallet the app is talking to.
 *
 * Until now that answer was always `window.ethereum`, read directly from a
 * dozen places. It stops being true the moment someone signs in with Google:
 * an embedded wallet is an EIP-1193 provider like any other, but it does not
 * live on `window`, there is nothing to install, and it is already on the right
 * chain so there is no network to switch.
 *
 * Every one of those differences is an implementation detail, exactly like the
 * EVM/Solana differences the adapters already hide. Components should ask "is
 * there a wallet" and "what account", never "does window.ethereum exist" — the
 * same rule the adapter architecture applies to chains, applied to wallets.
 */

/**
 * Set by the embedded-wallet integration once a user signs in. Deliberately
 * module state rather than React state: `providerManager` and the adapters are
 * plain modules called from outside the component tree, and they need the same
 * answer as the UI does.
 */
let embeddedProvider = null;
let embeddedChainIds = [];
const listeners = new Set();

/**
 * Register the embedded wallet's EIP-1193 provider (or null on sign-out).
 *
 * `chainIds` is the set of chains it was created against. A signed-in wallet is
 * a hosted signer: it can move between the chains it knows and can never reach
 * any other, so this is what lets the app tell "switch networks" apart from
 * "that network is not reachable from this wallet".
 */
export const setEmbeddedProvider = (provider, { chainIds = [] } = {}) => {
  embeddedProvider = provider || null;
  embeddedChainIds = provider ? chainIds : [];
  listeners.forEach((notify) => notify());
};

/** Subscribe to the wallet being swapped, e.g. sign-in or sign-out. */
export const onWalletChanged = (handler) => {
  listeners.add(handler);
  return () => listeners.delete(handler);
};

/** The browser extension, if the user has one. */
export const getInjectedProvider = () =>
  (typeof window !== 'undefined' && window.ethereum) || null;

/**
 * The provider the app should use.
 *
 * An embedded wallet wins over an extension: someone who has just signed in
 * with Google means to use that account, even if MetaMask happens to be
 * installed and shouting.
 */
export const getActiveProvider = () => embeddedProvider || getInjectedProvider();

export const hasWallet = () => !!getActiveProvider();

/** Whether the visitor has a browser wallet installed at all. */
export const hasInjectedWallet = () => !!getInjectedProvider();

/**
 * What to call the installed extension.
 *
 * Only used to label a button, so an unrecognised wallet gets a generic name
 * rather than a wrong one.
 */
export const getInjectedWalletName = () => {
  const provider = getInjectedProvider();
  if (!provider) return null;
  if (provider.isMetaMask) return 'MetaMask';
  if (provider.isCoinbaseWallet) return 'Coinbase Wallet';
  if (provider.isRabby) return 'Rabby';
  if (provider.isBraveWallet) return 'Brave Wallet';
  return 'your wallet';
};

/**
 * The account the extension has already shared with this site, if any.
 *
 * Deliberately `eth_accounts` rather than `eth_requestAccounts`: this runs to
 * decorate a dialog, and asking for permission to draw a label would be a
 * prompt nobody asked for. An empty result simply means "installed, not
 * connected here", which is worth showing differently from "not installed".
 */
export const getInjectedAccount = async () => {
  const provider = getInjectedProvider();
  if (!provider?.request) return null;

  try {
    const accounts = await provider.request({ method: 'eth_accounts' });
    return accounts?.[0] || null;
  } catch {
    return null;
  }
};

/** True when the active wallet came from signing in rather than an extension. */
export const isEmbeddedWallet = () => !!embeddedProvider;

/**
 * Whether the app can offer a wallet at all. An extension is one route; being
 * able to sign in is another, and it needs no install.
 */
export const canConnectWallet = () => hasWallet() || !!embeddedProvider;

export const walletRequest = (args) => {
  const provider = getActiveProvider();
  if (!provider) {
    return Promise.reject(new Error('No wallet connected'));
  }
  return provider.request(args);
};

export const getAccounts = async () => {
  try {
    return await walletRequest({ method: 'eth_accounts' });
  } catch {
    return [];
  }
};

export const requestAccounts = () => walletRequest({ method: 'eth_requestAccounts' });

export const getChainId = async () => {
  const hex = await walletRequest({ method: 'eth_chainId' });
  return parseInt(hex, 16);
};

/**
 * Listen for a wallet event, returning an unsubscribe function.
 *
 * Not every provider emits these — an embedded wallet has no account switcher
 * and no network menu, so it may implement neither `on` nor `removeListener`.
 * Returning a no-op unsubscribe keeps the caller's cleanup honest either way,
 * rather than making each one re-check.
 */
export const onWalletEvent = (event, handler) => {
  const provider = getActiveProvider();
  if (!provider?.on) return () => {};

  provider.on(event, handler);
  return () => {
    if (provider.removeListener) provider.removeListener(event, handler);
  };
};

/**
 * Whether this wallet can be asked to change network at all.
 *
 * Both kinds can: a smart wallet implements `wallet_switchEthereumChain` just
 * as an extension does. What differs is the range — see `canReachChain`.
 */
export const supportsChainSwitching = () => hasWallet();

/**
 * Whether the active wallet can operate on this chain.
 *
 * An extension can be asked to add any network, so anything is reachable. A
 * signed-in wallet only knows the chains it was created against, and a local
 * dev chain is not among them and never can be — the signer is hosted and
 * cannot see a node running on your machine. Checking first turns a rejected
 * popup into something the app can explain.
 */
export const canReachChain = (chainId) => {
  if (!isEmbeddedWallet()) return true;
  return embeddedChainIds.includes(Number(chainId));
};

/** The chains a signed-in wallet was created against; empty for an extension. */
export const getEmbeddedChainIds = () => [...embeddedChainIds];
