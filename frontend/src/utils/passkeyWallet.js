/**
 * Signing in with a passkey.
 *
 * Someone who has never held crypto taps Face ID and has a wallet. No
 * extension to install, no seed phrase to write down, no password to forget —
 * and the passkey follows them to every device through the Google or Apple
 * account they already have, which is the "sign in anywhere" property we
 * actually wanted.
 *
 * It is a Coinbase Smart Wallet: an ERC-4337 smart account whose signer is the
 * passkey. Two properties matter more than the brand.
 *
 * The account is a contract, not a key, and its signer set can change. So if
 * this ever needs replacing, we rotate the signer and the user keeps the same
 * address, the same balance and the same deposit instructions — nobody has to
 * move funds. That is why this is a smart account rather than a plain embedded
 * key, and it is what keeps the choice reversible.
 *
 * And it costs nothing to use. There is no account with anyone, no monthly
 * fee, no ceiling on how many people sign in — which matters for a product
 * whose revenue is a slice of yield that not every user opts into.
 */

import { createCoinbaseWalletSDK } from '@coinbase/wallet-sdk';
import networkConfig from '../networkConfig.json';
import { setEmbeddedProvider, getActiveProvider } from './walletProvider';

const APP_NAME = 'LockIn Wallet';
const SESSION_KEY = 'passkey_wallet_connected';

const NO_CONTRACT = '0x0000000000000000000000000000000000000000';

/**
 * Chains the wallet is offered on.
 *
 * Read from the deployment config rather than hardcoded, so a chain added
 * there is offered here automatically. Two exclusions:
 *
 * Localhost, because a smart wallet is a hosted signer and cannot reach a
 * chain running on your laptop.
 *
 * And any chain with no contract deployed — Ethereum mainnet is listed for
 * completeness but has none. Offering it would let someone sign in onto a
 * chain where nothing they came here to do exists.
 */
const supportedChainIds = () =>
  Object.entries(networkConfig.evm || {})
    .filter(
      ([key, config]) =>
        key !== 'localhost' &&
        config.chainId &&
        config.savingsContract &&
        config.savingsContract !== NO_CONTRACT
    )
    .map(([, config]) => config.chainId);

let sdk = null;

const getSdk = () => {
  if (!sdk) {
    sdk = createCoinbaseWalletSDK({
      appName: APP_NAME,
      appLogoUrl: `${window.location.origin}/favicon.png`,
      appChainIds: supportedChainIds(),
      // Smart wallet only. Offering the extension here too would put a second
      // "connect a wallet" path behind a button that says "sign in", which is
      // the opposite of what someone pressing it expects.
      preference: { options: 'smartWalletOnly' },
    });
  }
  return sdk;
};

/** True when this browser can hold a passkey at all. */
export const isPasskeySupported = () =>
  typeof window !== 'undefined' &&
  !!window.PublicKeyCredential &&
  !!navigator.credentials;

/**
 * Sign in, creating the wallet on first use.
 *
 * There is no separate sign-up: the same tap either creates the account or
 * opens the existing one, because the passkey already knows which it is.
 *
 * @returns {Promise<string>} the account address
 */
export const signInWithPasskey = async () => {
  const provider = getSdk().getProvider();

  // Registers the wallet before requesting accounts, so everything downstream
  // — providerManager, the adapters, the network hook — is already talking to
  // it by the time the address comes back.
  setEmbeddedProvider(provider, { chainIds: supportedChainIds() });

  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!accounts?.length) throw new Error('No account returned');

    localStorage.setItem(SESSION_KEY, 'true');
    return accounts[0];
  } catch (error) {
    // Leaving a half-connected provider in place would make the rest of the
    // app believe there is a wallet when there is not.
    setEmbeddedProvider(null);
    throw toUserError(error);
  }
};

/**
 * Reconnect a returning visitor without prompting.
 *
 * Only attempted when they signed in on this device before — asking for a
 * passkey unprompted, on a first visit, is a confusing thing to do to someone
 * who has not asked to sign in yet.
 */
export const restorePasskeySession = async () => {
  if (localStorage.getItem(SESSION_KEY) !== 'true') return null;
  if (!isPasskeySupported()) return null;

  const provider = getSdk().getProvider();
  setEmbeddedProvider(provider, { chainIds: supportedChainIds() });

  try {
    const accounts = await provider.request({ method: 'eth_accounts' });
    if (accounts?.length) return accounts[0];
  } catch {
    // Falls through to clearing the session below.
  }

  setEmbeddedProvider(null);
  localStorage.removeItem(SESSION_KEY);
  return null;
};

/** Sign out of this device. The wallet and its balance are untouched. */
export const signOutOfPasskey = async () => {
  const provider = getActiveProvider();
  localStorage.removeItem(SESSION_KEY);

  try {
    if (provider?.disconnect) await provider.disconnect();
  } catch {
    // Disconnecting is best-effort; dropping the provider is what signs them
    // out as far as this app is concerned.
  }

  setEmbeddedProvider(null);
};

export const hasPasskeySession = () =>
  localStorage.getItem(SESSION_KEY) === 'true';

/**
 * Say what went wrong in terms of what the person just did.
 *
 * Closing the popup is by far the most common outcome and is not a failure —
 * it must not read like one.
 */
const toUserError = (error) => {
  const message = (error?.message || '').toLowerCase();

  if (error?.code === 4001 || message.includes('denied') || message.includes('rejected')) {
    return new Error('Sign-in cancelled');
  }
  if (message.includes('popup') || message.includes('blocked')) {
    return new Error(
      'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
    );
  }
  if (message.includes('timeout')) {
    return new Error('Sign-in timed out. Please try again.');
  }
  return new Error(`Could not sign you in: ${error?.message || 'unknown error'}`);
};
