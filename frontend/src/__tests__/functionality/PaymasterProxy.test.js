/**
 * The paymaster proxy.
 *
 * It exists to hold a key the browser must never see, and the behaviour worth
 * pinning is the refusal: a request that would spend our budget on somebody
 * else's contract has to be turned away before it reaches the provider.
 */

const { ethers } = require('ethers');
const networkConfig = require('../../networkConfig.json');

const CORE = networkConfig.evm.base.savingsContract;
const CHAIN_ID = networkConfig.evm.base.chainId;
const MODULE = '0x1111111111111111111111111111111111111111';
const DEPOSIT_PROXY = '0x2222222222222222222222222222222222222222';
const TOKEN = '0x3333333333333333333333333333333333333333';
const STRANGER = '0x9999999999999999999999999999999999999999';

const ACCOUNT_ABI = [
  'function execute(address to, uint256 value, bytes data)',
  'function executeBatch(tuple(address to, uint256 value, bytes data)[] calls)',
];
const ERC20_IFACE = new ethers.Interface(['function approve(address spender, uint256 amount)']);
const ACCOUNT_IFACE = new ethers.Interface(ACCOUNT_ABI);

const encodeExecute = (to, data = '0x1234') =>
  ACCOUNT_IFACE.encodeFunctionData('execute', [to, 0, data]);

const encodeBatch = (calls) =>
  ACCOUNT_IFACE.encodeFunctionData('executeBatch', [
    calls.map((c) => (Array.isArray(c) ? [c[0], 0, c[1]] : [c, 0, '0x1234'])),
  ]);

const encodeApprove = (spender, amount = 1000000n) =>
  ERC20_IFACE.encodeFunctionData('approve', [spender, amount]);

/** Stands in for the on-chain module registry. */
const mockGetModule = jest.fn();
/** Stands in for a deposit proxy's vaults() getter. */
const mockVaults = jest.fn();

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      JsonRpcProvider: jest.fn(() => ({ destroy: jest.fn() })),
      Contract: jest.fn(() => ({
        getModule: (...args) => mockGetModule(...args),
        vaults: (...args) => mockVaults(...args),
      })),
    },
  };
});

const makeResponse = () => {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
};

const rpc = (callData, { method = 'pm_getPaymasterData', chainId = CHAIN_ID } = {}) => ({
  method: 'POST',
  body: {
    jsonrpc: '2.0',
    id: 1,
    method,
    params: [{ callData }, '0xentrypoint', chainId, {}],
  },
});

describe('paymaster proxy', () => {
  let handler;
  const ORIGINAL_KEY = process.env.PIMLICO_API_KEY;

  beforeEach(() => {
    jest.resetModules();
    mockGetModule.mockReset().mockResolvedValue(MODULE);
    mockVaults.mockReset().mockRejectedValue(new Error('not a proxy'));
    process.env.PIMLICO_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { paymaster: '0xpm' } }),
    });
    handler = require('../../../api/paymaster.js');
  });

  afterAll(() => {
    process.env.PIMLICO_API_KEY = ORIGINAL_KEY;
  });

  describe('refusing what it should', () => {
    it('turns away a call into somebody else\'s contract', async () => {
      // The whole reason this endpoint exists.
      const res = makeResponse();
      await handler(rpc(encodeExecute(STRANGER)), res);

      expect(res.body.error.message).toMatch(/not eligible/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('turns away a batch where only one call is foreign', async () => {
      // Hiding a foreign call among legitimate ones must not get it through.
      const res = makeResponse();
      await handler(rpc(encodeBatch([CORE, STRANGER])), res);

      expect(res.body.error.message).toMatch(/not eligible/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('turns away an ERC20 approve to a stranger\'s contract', async () => {
      // An approve where the spender is not ours is not our deposit flow.
      const res = makeResponse();
      await handler(rpc(encodeExecute(TOKEN, encodeApprove(STRANGER))), res);

      expect(res.body.error.message).toMatch(/not eligible/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('turns away anything that is not a paymaster request', async () => {
      const res = makeResponse();
      await handler(rpc(encodeExecute(CORE), { method: 'eth_sendTransaction' }), res);

      expect(res.body.error.message).toMatch(/not a paymaster request/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('turns away a chain we do not sponsor', async () => {
      const res = makeResponse();
      await handler(rpc(encodeExecute(CORE), { chainId: 999 }), res);

      expect(res.body.error.message).toMatch(/not sponsored/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('turns away calldata it cannot read', async () => {
      // Unreadable is refused rather than waved through: we cannot say what it
      // would call, so we cannot say it is ours.
      const res = makeResponse();
      await handler(rpc('0xdeadbeef'), res);

      expect(res.body.error.message).toMatch(/could not read/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('answers the preflight the wallet sends', async () => {
      // The caller is the provider's signer domain, not our page, so every
      // request is cross-origin and preflighted. Without this, sponsorship
      // fails before the policy check is ever reached.
      const res = makeResponse();
      await handler({ method: 'OPTIONS' }, res);

      expect(res.statusCode).toBe(204);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    it('refuses a GET', async () => {
      const res = makeResponse();
      await handler({ method: 'GET' }, res);
      expect(res.statusCode).toBe(405);
    });
  });

  describe('forwarding what it should', () => {
    it('passes a call into the core through to the provider', async () => {
      const res = makeResponse();
      await handler(rpc(encodeExecute(CORE)), res);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(res.body.result).toEqual({ paymaster: '0xpm' });
    });

    it('passes a call into a registered module through', async () => {
      // Module addresses come from the on-chain registry, so an upgrade cannot
      // quietly stop its calls being sponsored.
      const res = makeResponse();
      await handler(rpc(encodeExecute(MODULE)), res);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('passes a sweep on a deposit proxy through', async () => {
      // A deposit proxy is not a registered module, but its vaults() getter
      // returns one of our module addresses — that is the proof it was deployed
      // by our factory and can only move funds into the vault.
      mockVaults.mockResolvedValue(MODULE);

      const res = makeResponse();
      await handler(rpc(encodeExecute(DEPOSIT_PROXY)), res);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(res.body.result).toEqual({ paymaster: '0xpm' });
    });

    it('passes an ERC20 approve to one of our modules through', async () => {
      // Every ERC20 deposit needs an approval first. The token contract is not
      // in the module registry, but the spender is — so this is safe to sponsor.
      const res = makeResponse();
      await handler(rpc(encodeExecute(TOKEN, encodeApprove(MODULE))), res);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(res.body.result).toEqual({ paymaster: '0xpm' });
    });

    it('passes a batch of approve + deposit through', async () => {
      // The common ERC20 deposit pattern: approve the vault module, then deposit.
      const res = makeResponse();
      await handler(
        rpc(encodeBatch([[TOKEN, encodeApprove(MODULE)], CORE])),
        res
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('keeps the key out of anything it returns', async () => {
      const res = makeResponse();
      await handler(rpc(encodeExecute(CORE)), res);

      expect(JSON.stringify(res.body)).not.toContain('test-key');
      // It belongs in the upstream URL and nowhere else.
      expect(global.fetch.mock.calls[0][0]).toContain('test-key');
    });
  });

  describe('resolving what is ours', () => {
    it('refuses rather than sponsoring on a half-resolved allowlist', async () => {
      // A throttled RPC used to look exactly like "this module does not
      // exist", leaving the allowlist holding only the core — so every real
      // call into a module was turned away as foreign. Failing loudly beats
      // caching a wrong answer.
      mockGetModule.mockRejectedValue(new Error('429 Too Many Requests'));

      const res = makeResponse();
      await handler(rpc(encodeExecute(MODULE)), res);

      expect(res.body.error.message).toMatch(/not configured/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('when it cannot do its job', () => {
    it('reports unavailable rather than sponsoring blind', async () => {
      delete process.env.PIMLICO_API_KEY;
      jest.resetModules();
      handler = require('../../../api/paymaster.js');

      const res = makeResponse();
      await handler(rpc(encodeExecute(CORE)), res);

      expect(res.statusCode).toBe(503);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('reports upstream failure rather than hanging', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

      const res = makeResponse();
      await handler(rpc(encodeExecute(CORE)), res);

      expect(res.statusCode).toBe(502);
    });
  });
});
