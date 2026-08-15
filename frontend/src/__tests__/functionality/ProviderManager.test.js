/**
 * Building a provider and signer from whatever wallet is connected.
 *
 * The case worth pinning is the unhealthy one. Wallets ship with shared public
 * endpoints that rate-limit under load, and a throttled *read* used to abort
 * the entire connection — so a working wallet, on the right network, with money
 * in it, could not get past the front page because a block-number lookup was
 * busy.
 */

const mockGetBlockNumber = jest.fn();
const mockGetSigner = jest.fn();
const mockGetNetwork = jest.fn();
// Whether a configured fallback RPC answers when probed.
const mockFallbackBlockNumber = jest.fn();
const jsonRpcInstances = [];

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return { ...actual, BrowserProvider: jest.fn(), JsonRpcProvider: jest.fn() };
});

// Identity by default: sponsorship has its own tests, and mixing the two would
// make a failure here ambiguous.
jest.mock('../../utils/sponsorship', () => ({ withSponsorship: jest.fn() }));

const ethers = require('ethers');
const { withSponsorship } = require('../../utils/sponsorship');
const walletProvider = require('../../utils/walletProvider');
const { createProviderAndSigner } = require('../../utils/providerManager');

const OPTIMISM_HEX = '0xa';
const signer = { __kind: 'signer' };

const makeWallet = () => ({
  request: jest.fn(async ({ method }) => {
    if (method === 'eth_chainId') return OPTIMISM_HEX;
    if (method === 'eth_accounts') return ['0xabc'];
    throw new Error(`Unexpected ${method}`);
  }),
});

describe('createProviderAndSigner', () => {
  beforeEach(() => {
    // Create React App turns on `resetMocks`, which strips implementations set
    // in a `jest.mock` factory before every test — so the constructors have to
    // be re-established here rather than once at module scope.
    ethers.BrowserProvider.mockImplementation(() => ({
      getBlockNumber: mockGetBlockNumber,
      getSigner: mockGetSigner,
      getNetwork: mockGetNetwork,
      __kind: 'browser',
    }));
    ethers.JsonRpcProvider.mockImplementation((url) => {
      const instance = {
        url,
        getNetwork: mockGetNetwork,
        getBlockNumber: mockFallbackBlockNumber,
        __kind: 'jsonrpc',
      };
      jsonRpcInstances.push(instance);
      return instance;
    });
    withSponsorship.mockImplementation(async (s) => s);

    jsonRpcInstances.length = 0;
    walletProvider.setEmbeddedProvider(null);
    delete window.ethereum;

    mockGetSigner.mockResolvedValue(signer);
    mockGetNetwork.mockResolvedValue({ chainId: 10n });
  });

  it('refuses when no wallet is connected', async () => {
    await expect(createProviderAndSigner()).rejects.toThrow('No wallet connected');
  });

  it('uses the wallet for reads when its RPC is healthy', async () => {
    window.ethereum = makeWallet();
    mockGetBlockNumber.mockResolvedValue(123);

    const { provider, signer: returned } = await createProviderAndSigner();

    expect(provider.__kind).toBe('browser');
    expect(returned).toBe(signer);
    expect(jsonRpcInstances).toHaveLength(0);
  });

  it('reads through the app\'s own RPC when the wallet\'s is throttled', async () => {
    // The reported failure: MetaMask answering "RPC endpoint returned too many
    // errors" and the app refusing to connect at all.
    window.ethereum = makeWallet();
    mockGetBlockNumber.mockRejectedValue(
      new Error('RPC endpoint returned too many errors')
    );

    const { provider, signer: returned } = await createProviderAndSigner();

    expect(provider.__kind).toBe('jsonrpc');
    expect(jsonRpcInstances).toHaveLength(1);
    // Signing is unaffected — that goes through the wallet's own UI.
    expect(returned).toBe(signer);
  });

  it('asks the wallet for the chain, not the endpoint that just failed', async () => {
    window.ethereum = makeWallet();
    mockGetBlockNumber.mockRejectedValue(new Error('throttled'));

    await createProviderAndSigner();

    // eth_chainId is answered by the wallet itself, so it still works when the
    // endpoint behind it does not.
    expect(window.ethereum.request).toHaveBeenCalledWith({ method: 'eth_chainId' });
  });

  it('names the network when nothing there is reachable', async () => {
    // The reported case: a wallet pointed at Localhost with no node running.
    // The configured fallback for that chain is the same dead endpoint, so
    // handing it back unchecked swapped one failure for a stranger one.
    window.ethereum = { request: jest.fn(async () => '0x7a69') }; // 31337
    mockGetBlockNumber.mockRejectedValue(new Error('throttled'));
    mockFallbackBlockNumber.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(createProviderAndSigner()).rejects.toThrow(/Localhost/);
  });

  it('skips a configured RPC that does not answer', async () => {
    window.ethereum = makeWallet();
    mockGetBlockNumber.mockRejectedValue(new Error('throttled'));
    mockFallbackBlockNumber.mockRejectedValue(new Error('down'));

    // No working endpoint anywhere, so it must not hand back a dead one.
    await expect(createProviderAndSigner()).rejects.toThrow(/nothing there is responding/);
  });
});
