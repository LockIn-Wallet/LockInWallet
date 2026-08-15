/**
 * Signing in with a passkey.
 *
 * What matters here is not that the SDK gets called — it is that the app is
 * never left believing there is a wallet when there is not, and that a person
 * who closes the popup is not shown a failure.
 */

const mockProvider = {
  request: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
};

const mockCreateSDK = jest.fn(() => ({ getProvider: () => mockProvider }));

jest.mock('@coinbase/wallet-sdk', () => ({
  createCoinbaseWalletSDK: (...args) => mockCreateSDK(...args),
}));

// Both modules are re-required together each test. `passkeyWallet` caches the
// SDK instance and `walletProvider` holds the active wallet in module state, so
// they have to come from the same fresh registry or the module under test would
// be talking to a different `walletProvider` than the assertions read.
let signInWithPasskey;
let restorePasskeySession;
let signOutOfPasskey;
let hasPasskeySession;
let isPasskeySupported;
let walletProvider;

describe('passkeyWallet', () => {
  beforeEach(() => {
    jest.resetModules();
    mockProvider.request.mockReset();
    mockProvider.disconnect.mockReset().mockResolvedValue(undefined);
    mockCreateSDK.mockReset().mockReturnValue({ getProvider: () => mockProvider });
    localStorage.clear();

    // jsdom has no WebAuthn, so stand it up — otherwise every test runs as
    // "this browser cannot hold a passkey", which is not the case under test.
    window.PublicKeyCredential = function PublicKeyCredential() {};
    navigator.credentials = {};

    walletProvider = require('../../utils/walletProvider');
    ({
      signInWithPasskey,
      restorePasskeySession,
      signOutOfPasskey,
      hasPasskeySession,
      isPasskeySupported,
    } = require('../../utils/passkeyWallet'));
  });

  describe('signing in', () => {
    it('registers the wallet so the whole app uses it', async () => {
      mockProvider.request.mockResolvedValue(['0xabc']);

      const address = await signInWithPasskey();

      expect(address).toBe('0xabc');
      // Everything downstream — providers, adapters, the network hook — reads
      // the active wallet, so registering it is what makes sign-in take effect.
      expect(walletProvider.getActiveProvider()).toBe(mockProvider);
      expect(walletProvider.isEmbeddedWallet()).toBe(true);
      expect(hasPasskeySession()).toBe(true);
    });

    it('offers the wallet only on chains the deployment is on', async () => {
      mockProvider.request.mockResolvedValue(['0xabc']);
      await signInWithPasskey();

      const config = mockCreateSDK.mock.calls[0][0];
      expect(config.appChainIds).toEqual(expect.arrayContaining([10, 8453]));
      // A smart wallet is a hosted signer and cannot reach a chain running on
      // someone's laptop.
      expect(config.appChainIds).not.toContain(31337);
      // Ethereum mainnet is in the config for completeness but has no contract
      // deployed. Signing in there would land someone on a chain where nothing
      // they came for exists.
      expect(config.appChainIds).not.toContain(1);
      expect(config.preference).toEqual({ options: 'smartWalletOnly' });
    });

    it('leaves no wallet behind when sign-in fails', async () => {
      // A half-connected provider would make the rest of the app believe there
      // is a wallet, and every later call would fail somewhere less obvious.
      mockProvider.request.mockRejectedValue(new Error('boom'));

      await expect(signInWithPasskey()).rejects.toThrow('Could not sign you in');
      expect(walletProvider.getActiveProvider()).toBeNull();
      expect(hasPasskeySession()).toBe(false);
    });

    it('leaves no wallet behind when no account comes back', async () => {
      mockProvider.request.mockResolvedValue([]);

      await expect(signInWithPasskey()).rejects.toThrow();
      expect(walletProvider.getActiveProvider()).toBeNull();
    });

    it('does not call a cancelled sign-in a failure', async () => {
      const cancelled = Object.assign(new Error('User denied request'), { code: 4001 });
      mockProvider.request.mockRejectedValue(cancelled);

      await expect(signInWithPasskey()).rejects.toThrow('Sign-in cancelled');
    });

    it('explains a blocked pop-up in terms of what to do', async () => {
      mockProvider.request.mockRejectedValue(new Error('popup blocked by browser'));

      await expect(signInWithPasskey()).rejects.toThrow(/Allow pop-ups/);
    });
  });

  describe('coming back later', () => {
    it('does not prompt someone who never signed in here', async () => {
      // Asking for a passkey unprompted on a first visit is a confusing thing
      // to do to someone who has not asked to sign in.
      expect(await restorePasskeySession()).toBeNull();
      expect(mockProvider.request).not.toHaveBeenCalled();
      expect(walletProvider.getActiveProvider()).toBeNull();
    });

    it('reconnects a returning visitor silently', async () => {
      localStorage.setItem('passkey_wallet_connected', 'true');
      mockProvider.request.mockResolvedValue(['0xabc']);

      expect(await restorePasskeySession()).toBe('0xabc');
      expect(walletProvider.isEmbeddedWallet()).toBe(true);
      // eth_accounts, not eth_requestAccounts — no prompt.
      expect(mockProvider.request).toHaveBeenCalledWith({ method: 'eth_accounts' });
    });

    it('forgets a session the wallet no longer honours', async () => {
      localStorage.setItem('passkey_wallet_connected', 'true');
      mockProvider.request.mockResolvedValue([]);

      expect(await restorePasskeySession()).toBeNull();
      expect(walletProvider.getActiveProvider()).toBeNull();
      expect(hasPasskeySession()).toBe(false);
    });
  });

  describe('signing out', () => {
    it('drops the wallet from this device', async () => {
      mockProvider.request.mockResolvedValue(['0xabc']);
      await signInWithPasskey();

      await signOutOfPasskey();

      expect(walletProvider.getActiveProvider()).toBeNull();
      expect(hasPasskeySession()).toBe(false);
    });

    it('signs out even if the wallet will not disconnect', async () => {
      // Whatever the SDK does, the app must stop treating them as signed in.
      mockProvider.request.mockResolvedValue(['0xabc']);
      await signInWithPasskey();
      mockProvider.disconnect.mockRejectedValue(new Error('already gone'));

      await expect(signOutOfPasskey()).resolves.toBeUndefined();
      expect(walletProvider.getActiveProvider()).toBeNull();
      expect(hasPasskeySession()).toBe(false);
    });
  });

  describe('browser support', () => {
    it('detects a browser that can hold a passkey', () => {
      expect(isPasskeySupported()).toBe(true);

      delete window.PublicKeyCredential;
      expect(isPasskeySupported()).toBe(false);
    });

    it('leaves an existing session alone on a browser that cannot use it', async () => {
      // Signed in on a phone, opening an old browser on a desktop: they are
      // still signed in elsewhere, so do not wipe the session here.
      localStorage.setItem('passkey_wallet_connected', 'true');
      delete window.PublicKeyCredential;

      expect(await restorePasskeySession()).toBeNull();
      expect(hasPasskeySession()).toBe(true);
    });
  });
});
