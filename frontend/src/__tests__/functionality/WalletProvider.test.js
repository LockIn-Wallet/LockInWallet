/**
 * The wallet seam.
 *
 * Everything that used to read `window.ethereum` now asks this module instead,
 * so that signing in with Google can supply a wallet where there was no
 * extension at all. These tests pin the behaviour that makes that swap safe.
 */

const walletProvider = require('../../utils/walletProvider');

const {
  setEmbeddedProvider,
  getActiveProvider,
  getInjectedProvider,
  hasWallet,
  isEmbeddedWallet,
  supportsChainSwitching,
  onWalletEvent,
  onWalletChanged,
  getAccounts,
  getChainId,
  requestAccounts,
  walletRequest,
  hasInjectedWallet,
  getInjectedWalletName,
  getInjectedAccount,
  canReachChain,
} = walletProvider;

/** A minimal EIP-1193 provider. */
const makeProvider = (responses = {}, { events = true } = {}) => {
  const handlers = {};
  const provider = {
    request: jest.fn(({ method }) => {
      if (method in responses) return Promise.resolve(responses[method]);
      return Promise.reject(new Error(`Unsupported method: ${method}`));
    }),
    handlers,
  };
  if (events) {
    provider.on = jest.fn((event, handler) => {
      handlers[event] = handler;
    });
    provider.removeListener = jest.fn((event) => {
      delete handlers[event];
    });
  }
  return provider;
};

describe('walletProvider', () => {
  afterEach(() => {
    setEmbeddedProvider(null);
    delete window.ethereum;
  });

  describe('choosing a wallet', () => {
    it('reports no wallet when there is neither', () => {
      expect(hasWallet()).toBe(false);
      expect(getActiveProvider()).toBeNull();
    });

    it('uses the browser extension when that is all there is', () => {
      const injected = makeProvider();
      window.ethereum = injected;

      expect(getActiveProvider()).toBe(injected);
      expect(hasWallet()).toBe(true);
      expect(isEmbeddedWallet()).toBe(false);
    });

    it('prefers the signed-in wallet over an installed extension', () => {
      // Someone who has just signed in means to use that account, even if
      // MetaMask happens to be installed and shouting.
      const injected = makeProvider();
      const embedded = makeProvider();
      window.ethereum = injected;
      setEmbeddedProvider(embedded);

      expect(getActiveProvider()).toBe(embedded);
      expect(isEmbeddedWallet()).toBe(true);
      expect(getInjectedProvider()).toBe(injected);
    });

    it('falls back to the extension when the user signs out', () => {
      const injected = makeProvider();
      window.ethereum = injected;
      setEmbeddedProvider(makeProvider());
      setEmbeddedProvider(null);

      expect(getActiveProvider()).toBe(injected);
      expect(isEmbeddedWallet()).toBe(false);
    });
  });

  describe('talking to it', () => {
    it('reads accounts and chain id through whichever wallet is active', async () => {
      setEmbeddedProvider(
        makeProvider({
          eth_accounts: ['0xabc'],
          eth_chainId: '0x2105', // Base
          eth_requestAccounts: ['0xabc'],
        })
      );

      expect(await getAccounts()).toEqual(['0xabc']);
      expect(await getChainId()).toBe(8453);
      expect(await requestAccounts()).toEqual(['0xabc']);
    });

    it('reports no accounts rather than throwing when the wallet refuses', async () => {
      // Callers branch on "is anything connected", and an empty list answers
      // that. Throwing would make every caller wrap this in a try/catch.
      setEmbeddedProvider(makeProvider({}));
      expect(await getAccounts()).toEqual([]);
    });

    it('rejects a request when there is no wallet at all', async () => {
      await expect(walletRequest({ method: 'eth_accounts' })).rejects.toThrow(
        'No wallet connected'
      );
    });
  });

  describe('events', () => {
    it('subscribes and unsubscribes', () => {
      const injected = makeProvider();
      window.ethereum = injected;
      const handler = jest.fn();

      const unsubscribe = onWalletEvent('accountsChanged', handler);
      expect(injected.on).toHaveBeenCalledWith('accountsChanged', handler);

      unsubscribe();
      expect(injected.removeListener).toHaveBeenCalledWith('accountsChanged', handler);
    });

    it('survives a wallet that emits no events', () => {
      // An embedded wallet has no account switcher and no network menu, so it
      // may implement neither `on` nor `removeListener`. Callers must not have
      // to know that.
      setEmbeddedProvider(makeProvider({}, { events: false }));

      const unsubscribe = onWalletEvent('accountsChanged', jest.fn());
      expect(() => unsubscribe()).not.toThrow();
    });

    it('announces when the wallet is swapped', () => {
      // Signing in provides a wallet where there was none, so anything holding
      // a subscription has to re-bind against the new provider.
      const seen = jest.fn();
      const unsubscribe = onWalletChanged(seen);

      setEmbeddedProvider(makeProvider());
      expect(seen).toHaveBeenCalledTimes(1);

      setEmbeddedProvider(null);
      expect(seen).toHaveBeenCalledTimes(2);

      unsubscribe();
      setEmbeddedProvider(makeProvider());
      expect(seen).toHaveBeenCalledTimes(2);
    });
  });

  describe('recognising an installed extension', () => {
    // Whether one is installed decides whether the app asks which wallet to
    // use. With none, the second option leads nowhere and the question is a
    // detour between someone and the button they pressed.
    it('reports none when nothing is installed', async () => {
      expect(hasInjectedWallet()).toBe(false);
      expect(getInjectedWalletName()).toBeNull();
      expect(await getInjectedAccount()).toBeNull();
    });

    it('names the extension it found', () => {
      window.ethereum = { ...makeProvider(), isMetaMask: true };
      expect(hasInjectedWallet()).toBe(true);
      expect(getInjectedWalletName()).toBe('MetaMask');
    });

    it('gives an unfamiliar wallet a generic name rather than a wrong one', () => {
      window.ethereum = makeProvider();
      expect(getInjectedWalletName()).toBe('your wallet');
    });

    it('reads the account already shared with this site', async () => {
      window.ethereum = makeProvider({ eth_accounts: ['0xabc'] });
      expect(await getInjectedAccount()).toBe('0xabc');
    });

    it('asks for no permission just to draw a label', async () => {
      // eth_accounts, never eth_requestAccounts — prompting to decorate a
      // dialog would be a popup nobody asked for.
      const injected = makeProvider({ eth_accounts: [] });
      window.ethereum = injected;

      expect(await getInjectedAccount()).toBeNull();
      expect(injected.request).toHaveBeenCalledWith({ method: 'eth_accounts' });
      expect(injected.request).not.toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    });

    it('still reports the extension when a signed-in wallet is active', async () => {
      // The dialog is about choosing between them, so the one not currently
      // active still has to be visible.
      window.ethereum = { ...makeProvider({ eth_accounts: ['0xabc'] }), isMetaMask: true };
      setEmbeddedProvider(makeProvider());

      expect(hasInjectedWallet()).toBe(true);
      expect(await getInjectedAccount()).toBe('0xabc');
    });
  });

  describe('changing network', () => {
    it('lets either kind be asked', () => {
      // A smart wallet implements wallet_switchEthereumChain just as an
      // extension does; what differs is the range, not the ability.
      window.ethereum = makeProvider();
      expect(supportsChainSwitching()).toBe(true);

      setEmbeddedProvider(makeProvider(), { chainIds: [8453] });
      expect(supportsChainSwitching()).toBe(true);
    });

    it('treats every chain as reachable with an extension', () => {
      window.ethereum = makeProvider();
      expect(canReachChain(8453)).toBe(true);
      expect(canReachChain(31337)).toBe(true);
    });

    it('limits a signed-in wallet to the chains it was created against', () => {
      setEmbeddedProvider(makeProvider(), { chainIds: [10, 8453] });

      expect(canReachChain(10)).toBe(true);
      expect(canReachChain(8453)).toBe(true);
      // A hosted signer cannot see a node running on this machine, so a local
      // dev chain is not merely absent — it can never be added.
      expect(canReachChain(31337)).toBe(false);
    });

    it('forgets those chains on sign-out', () => {
      setEmbeddedProvider(makeProvider(), { chainIds: [8453] });
      setEmbeddedProvider(null);
      window.ethereum = makeProvider();

      expect(canReachChain(31337)).toBe(true);
    });
  });
});
