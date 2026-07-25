const { EVMAdapter } = require('../../adapters/EVMAdapter.js');

/**
 * EVMAdapter regression tests
 *
 * Guards against bugs found after the Pattern B refactor (modules are called
 * directly; SavingsCore is a custody kernel without per-feature forwarders):
 *
 * 1. Setup status must resolve through the ProposalSystemModule — the core
 *    forwarder isSetupCommitted() no longer exists, and calling it crashed
 *    the app after a MetaMask account switch.
 * 2. Balances must display without trailing zeros ("200", not "200.0").
 * 3. Timelock-gated executes must refresh the local dev chain clock first —
 *    Hardhat only mines on transactions, so gas estimation on an idle chain
 *    fails elapsed timelocks with "Request still in timelock".
 */

const USER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const USDT = '0x09635F643e140090A9A8Dcd712eD6285858ceBef';

function makeAdapter(networkConfig = {}) {
  const adapter = new EVMAdapter({
    chainId: 31337,
    rpcUrls: ['http://127.0.0.1:8545'],
    savingsContract: '0x' + '1'.repeat(40),
    ...networkConfig,
  });
  adapter.userAddress = USER;
  adapter.savingsContract = {}; // truthy — module lookups are stubbed per test
  return adapter;
}

const txResult = { hash: '0xhash', wait: jest.fn().mockResolvedValue({}) };

describe('EVMAdapter setup status (no core forwarder)', () => {
  test('resolves isSetupCommitted through the ProposalSystemModule', async () => {
    const adapter = makeAdapter();
    const proposalModule = { isSetupCommitted: jest.fn().mockResolvedValue(true) };
    adapter._getModuleContract = jest.fn().mockResolvedValue(proposalModule);

    const committed = await adapter.getIsSetupCommitted();

    expect(committed).toBe(true);
    expect(adapter._getModuleContract).toHaveBeenCalledWith('proposalSystem');
    expect(proposalModule.isSetupCommitted).toHaveBeenCalledWith(USER);
  });

  test('reports false instead of crashing when the module lookup fails', async () => {
    const adapter = makeAdapter();
    adapter._getModuleContract = jest.fn().mockRejectedValue(new Error('not registered'));

    await expect(adapter.getIsSetupCommitted()).resolves.toBe(false);
  });
});

describe('EVMAdapter balance formatting', () => {
  test('trims trailing zeros so both display paths render identically', async () => {
    const adapter = makeAdapter({
      tokens: { USDT: { address: USDT, symbol: 'USDT', decimals: 6 } },
    });
    adapter.checkAndSweepProxy = jest.fn().mockResolvedValue(undefined);
    adapter.savingsContract = {
      getTokenBalance: jest.fn().mockResolvedValue(200000000n), // 200 USDT raw
    };

    const balances = await adapter.getAllBalances(USER);

    expect(balances.USDT).toBe('200'); // not "200.0"
  });

  test('keeps genuine decimals intact', async () => {
    const adapter = makeAdapter({
      tokens: { USDT: { address: USDT, symbol: 'USDT', decimals: 6 } },
    });
    adapter.checkAndSweepProxy = jest.fn().mockResolvedValue(undefined);
    adapter.savingsContract = {
      getTokenBalance: jest.fn().mockResolvedValue(200500000n), // 200.5 USDT raw
    };

    const balances = await adapter.getAllBalances(USER);

    expect(balances.USDT).toBe('200.5');
  });
});

describe('EVMAdapter dev chain clock refresh', () => {
  function makeExecuteFixture() {
    const adapter = makeAdapter();
    adapter._refreshDevChainClock = jest.fn().mockResolvedValue(undefined);
    const modules = {
      approvalSystem: { executeWithdrawalAddressRequest: jest.fn().mockResolvedValue(txResult) },
      bypassSystem: { executeBypassWithdrawal: jest.fn().mockResolvedValue(txResult) },
      proposalSystem: { executeLimitProposal: jest.fn().mockResolvedValue(txResult) },
    };
    adapter._getModuleContract = jest.fn((key) => Promise.resolve(modules[key]));
    return { adapter, modules };
  }

  test('executeWithdrawalAddressRequest refreshes the clock before estimating', async () => {
    const { adapter } = makeExecuteFixture();
    await adapter.executeWithdrawalAddressRequest('0xrequest');
    expect(adapter._refreshDevChainClock).toHaveBeenCalled();
  });

  test('executeBypassWithdrawal refreshes the clock before estimating', async () => {
    const { adapter } = makeExecuteFixture();
    await adapter.executeBypassWithdrawal('0xrequest');
    expect(adapter._refreshDevChainClock).toHaveBeenCalled();
  });

  test('executeLimitProposal refreshes the clock before estimating', async () => {
    const { adapter } = makeExecuteFixture();
    await adapter.executeLimitProposal('0xproposal');
    expect(adapter._refreshDevChainClock).toHaveBeenCalled();
  });

  test('the refresh is a no-op off the local dev chain', async () => {
    const adapter = makeAdapter({ chainId: 10 }); // Optimism
    // Would throw on any RPC attempt — a no-op resolves cleanly
    await expect(adapter._refreshDevChainClock()).resolves.toBeUndefined();
  });
});
