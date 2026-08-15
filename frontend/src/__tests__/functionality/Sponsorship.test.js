/**
 * Paying someone else's network fee.
 *
 * The behaviour that matters is not that sponsorship works — it is that
 * everything still works when it does not. A user who brought their own ETH,
 * a wallet with no bundle API, a paymaster that is down or out of budget: none
 * of those may become a dead end, because sponsorship is an improvement on the
 * normal path rather than a replacement for it.
 */

const ORIGINAL_ENV = process.env.REACT_APP_PAYMASTER_URL;
const PAYMASTER_URL = 'https://paymaster.example/rpc';

const BASE_CHAIN_ID = 8453;
const BASE_HEX = '0x2105';

/** A wallet that answers capability and bundle calls. */
const makeWalletProvider = ({
  supported = true,
  accounts = ['0xabc'],
  statuses = [{ status: 200, receipts: [{ transactionHash: '0xdead', status: '0x1', blockNumber: '0x10' }] }],
} = {}) => {
  const remaining = [...statuses];
  return {
    request: jest.fn(async ({ method, params }) => {
      if (method === 'eth_accounts') return accounts;
      if (method === 'wallet_getCapabilities') {
        if (!supported) return {};
        return { [BASE_HEX]: { paymasterService: { supported: true } } };
      }
      if (method === 'wallet_sendCalls') {
        makeWalletProvider.lastSendCalls = params[0];
        return '0xbundle';
      }
      if (method === 'wallet_getCallsStatus') {
        return remaining.length > 1 ? remaining.shift() : remaining[0];
      }
      throw new Error(`Unexpected method ${method}`);
    }),
  };
};

const makeInnerSigner = () => ({
  provider: {},
  getAddress: jest.fn().mockResolvedValue('0xabc'),
  sendTransaction: jest.fn().mockResolvedValue({ hash: '0xown' }),
  signMessage: jest.fn().mockResolvedValue('0xsig'),
  connect: jest.fn(),
});

describe('sponsorship', () => {
  let withSponsorship;
  let canSponsor;
  let isSponsorshipConfigured;

  const load = () => {
    jest.resetModules();
    ({ withSponsorship, canSponsor, isSponsorshipConfigured } = require('../../utils/sponsorship'));
  };

  beforeEach(() => {
    process.env.REACT_APP_PAYMASTER_URL = PAYMASTER_URL;
    load();
  });

  afterAll(() => {
    process.env.REACT_APP_PAYMASTER_URL = ORIGINAL_ENV;
  });

  describe('deciding whether anyone will pay', () => {
    it('offers nothing when no paymaster is configured', async () => {
      process.env.REACT_APP_PAYMASTER_URL = '';
      load();

      expect(isSponsorshipConfigured()).toBe(false);
      expect(await canSponsor(makeWalletProvider(), BASE_CHAIN_ID)).toBe(false);
    });

    it('offers nothing to a wallet that cannot use a paymaster', async () => {
      // An extension has no bundle API, and its user brought their own ETH.
      expect(await canSponsor(makeWalletProvider({ supported: false }), BASE_CHAIN_ID)).toBe(false);
    });

    it('treats a wallet that does not know the method as simply unable', async () => {
      const provider = { request: jest.fn().mockRejectedValue(new Error('Unsupported method')) };
      // Not being able to sponsor is never an error worth surfacing.
      expect(await canSponsor(provider, BASE_CHAIN_ID)).toBe(false);
    });

    it('offers sponsorship to a smart wallet on a supported chain', async () => {
      expect(await canSponsor(makeWalletProvider(), BASE_CHAIN_ID)).toBe(true);
    });

    it('offers nothing on a chain the wallet did not list', async () => {
      expect(await canSponsor(makeWalletProvider(), 10)).toBe(false);
    });
  });

  describe('leaving the normal path alone', () => {
    it('returns the original signer when nobody will pay', async () => {
      const inner = makeInnerSigner();
      const wrapped = await withSponsorship(inner, makeWalletProvider({ supported: false }), BASE_CHAIN_ID);

      // Identity, not a wrapper that happens to delegate — a user with their
      // own ETH must be on exactly the path that already worked.
      expect(wrapped).toBe(inner);
    });

    it('returns the original signer when no paymaster is configured', async () => {
      process.env.REACT_APP_PAYMASTER_URL = '';
      load();

      const inner = makeInnerSigner();
      expect(await withSponsorship(inner, makeWalletProvider(), BASE_CHAIN_ID)).toBe(inner);
    });
  });

  describe('addressing the right chain', () => {
    it('fills the chain into a per-chain endpoint', async () => {
      // Pimlico and friends carry the network in the URL path, so one
      // configured value has to serve every chain the app is on.
      process.env.REACT_APP_PAYMASTER_URL = 'https://api.example/v2/{chain}/rpc?apikey=k';
      load();

      const signer = await withSponsorship(makeInnerSigner(), makeWalletProvider(), BASE_CHAIN_ID);
      await signer.sendTransaction({ to: '0xdef', data: '0x' });

      expect(makeWalletProvider.lastSendCalls.capabilities.paymasterService[BASE_HEX].url).toBe(
        'https://api.example/v2/base/rpc?apikey=k'
      );
    });

    it('offers nothing on a chain it cannot name', async () => {
      process.env.REACT_APP_PAYMASTER_URL = 'https://api.example/v2/{chain}/rpc?apikey=k';
      load();

      // 999 is in no config, so there is no endpoint to build — and an empty
      // URL has to read as "nobody is paying" rather than a malformed request.
      expect(await canSponsor(makeWalletProvider(), 999)).toBe(false);
    });
  });

  describe('sending a sponsored transaction', () => {
    it('sends through the bundle API with the paymaster attached', async () => {
      const wallet = makeWalletProvider();
      const signer = await withSponsorship(makeInnerSigner(), wallet, BASE_CHAIN_ID);

      const tx = await signer.sendTransaction({ to: '0xdef', data: '0x1234' });

      const sent = makeWalletProvider.lastSendCalls;
      expect(sent.chainId).toBe(BASE_HEX);
      expect(sent.from).toBe('0xabc');
      expect(sent.calls[0]).toMatchObject({ to: '0xdef', data: '0x1234', value: '0x0' });
      // Keyed by chain. The older flat shape is rejected by the wallet before
      // it ever calls the paymaster.
      expect(sent.capabilities.paymasterService).toEqual({
        [BASE_HEX]: { url: PAYMASTER_URL, optional: true },
      });
      expect(tx.hash).toBe('0xdead');
    });

    it('looks like an ordinary transaction to whoever awaits it', async () => {
      // Every caller does `const tx = await contract.method(); await tx.wait()`
      // and none of them should have to learn a second shape.
      const signer = await withSponsorship(makeInnerSigner(), makeWalletProvider(), BASE_CHAIN_ID);

      const tx = await signer.sendTransaction({ to: '0xdef', data: '0x' });
      const receipt = await tx.wait();

      expect(receipt.status).toBe(1);
      expect(receipt.hash).toBe('0xdead');
      expect(receipt.blockNumber).toBe(16);
    });

    it('waits for a bundle that is still pending', async () => {
      const wallet = makeWalletProvider({
        statuses: [
          { status: 100 },
          { status: 200, receipts: [{ transactionHash: '0xdead', status: '0x1' }] },
        ],
      });
      const signer = await withSponsorship(makeInnerSigner(), wallet, BASE_CHAIN_ID);

      const tx = await signer.sendTransaction({ to: '0xdef', data: '0x' });
      expect(tx.hash).toBe('0xdead');
    });

    it('reports a bundle the chain rejected', async () => {
      const wallet = makeWalletProvider({ statuses: [{ status: 500, receipts: [] }] });
      const signer = await withSponsorship(makeInnerSigner(), wallet, BASE_CHAIN_ID);

      await expect(signer.sendTransaction({ to: '0xdef', data: '0x' })).rejects.toThrow(
        /Sponsored transaction failed/
      );
    });

    it('reports a bundle that landed but reverted', async () => {
      const wallet = makeWalletProvider({
        statuses: [{ status: 200, receipts: [{ transactionHash: '0xdead', status: '0x0' }] }],
      });
      const signer = await withSponsorship(makeInnerSigner(), wallet, BASE_CHAIN_ID);

      await expect(signer.sendTransaction({ to: '0xdef', data: '0x' })).rejects.toThrow(
        /Sponsored transaction failed/
      );
    });

    it('passes a value transfer through as hex', async () => {
      const signer = await withSponsorship(makeInnerSigner(), makeWalletProvider(), BASE_CHAIN_ID);

      await signer.sendTransaction({ to: '0xdef', data: '0x', value: 1000n });
      expect(makeWalletProvider.lastSendCalls.calls[0].value).toBe('0x3e8');
    });
  });

  describe('the rest of the signer', () => {
    it('still answers for the same account', async () => {
      const inner = makeInnerSigner();
      const signer = await withSponsorship(inner, makeWalletProvider(), BASE_CHAIN_ID);

      expect(await signer.getAddress()).toBe('0xabc');
    });

    it('signs messages with the wallet, not the paymaster', async () => {
      // Signing is free and proves who you are; there is nothing to sponsor.
      const inner = makeInnerSigner();
      const signer = await withSponsorship(inner, makeWalletProvider(), BASE_CHAIN_ID);

      expect(await signer.signMessage('hello')).toBe('0xsig');
      expect(inner.signMessage).toHaveBeenCalledWith('hello');
    });
  });
});
