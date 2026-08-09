const { EVMAdapter } = require('../../adapters/EVMAdapter.js');
const { BlockchainAdapter } = require('../../adapters/BlockchainAdapter.js');
const { TransactionManager } = require('../../adapters/TransactionManager.js');
const ReferralModuleABI = require('../../ReferralModuleABI.json');

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
 * 4. Referrals must never expose invitee addresses — balances are public, so
 *    an invitee list is a window into what those people have saved.
 */

const USER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
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

describe('EVMAdapter withdrawal balance guard', () => {
  function makeWithdrawFixture(rawBalance) {
    const adapter = makeAdapter({
      tokens: { USDT: { address: USDT, symbol: 'USDT', decimals: 6 } },
    });
    adapter.savingsContract = {
      getTokenBalance: jest.fn().mockResolvedValue(rawBalance),
      withdrawTo: jest.fn().mockResolvedValue(txResult),
      withdraw: jest.fn().mockResolvedValue(txResult),
    };
    return adapter;
  }

  test('names the shortfall instead of reverting with "Invalid amount"', async () => {
    const adapter = makeWithdrawFixture(0n);

    await expect(adapter.withdraw(20, USDT, USER)).rejects.toThrow(
      'Not enough USDT in your savings wallet — you have 0 USDT available'
    );
    expect(adapter.savingsContract.withdrawTo).not.toHaveBeenCalled();
  });

  test('reports the partial balance available', async () => {
    const adapter = makeWithdrawFixture(5500000n); // 5.5 USDT

    await expect(adapter.withdraw(20, USDT, USER)).rejects.toThrow(
      'you have 5.5 USDT available'
    );
  });

  test('lets a withdrawal within the balance through', async () => {
    const adapter = makeWithdrawFixture(50000000n); // 50 USDT

    const result = await adapter.withdraw(20, USDT, USER);

    expect(result.success).toBe(true);
    expect(adapter.savingsContract.withdrawTo).toHaveBeenCalled();
  });

  test('vault withdrawals check the member balance for that coin', async () => {
    const adapter = makeAdapter();
    // The balance now comes from the vault module per coin, because a vault
    // holds several and one scalar could not say which.
    adapter._getVaultModule = jest.fn().mockResolvedValue({
      withdraw: jest.fn().mockResolvedValue(txResult),
      balanceOf: jest.fn().mockResolvedValue(1000000n), // 1 USDT
    });
    adapter.getVaultInfo = jest.fn().mockResolvedValue({
      tokens: [{ address: USDT, symbol: 'USDT', decimals: 6, isNative: false }],
      tokenSymbol: 'USDT',
      tokenDecimals: 6,
    });

    await expect(adapter.withdrawFromVault('1', 20)).rejects.toThrow(
      'you have 1 USDT available'
    );
  });

  test('refuses to guess which coin a multi-coin vault deposit is for', async () => {
    const adapter = makeAdapter();
    adapter._getVaultModule = jest.fn().mockResolvedValue({});
    adapter.getVaultInfo = jest.fn().mockResolvedValue({
      tokens: [
        { address: USDT, symbol: 'USDT', decimals: 6, isNative: false },
        { address: DAI, symbol: 'DAI', decimals: 18, isNative: false },
      ],
    });

    // Silently picking the first would move the wrong asset.
    await expect(adapter.depositToVault('1', 20)).rejects.toThrow(
      'Choose which coin this is for'
    );
  });

  test('refuses a coin the vault does not hold', async () => {
    const adapter = makeAdapter();
    adapter._getVaultModule = jest.fn().mockResolvedValue({});
    adapter.getVaultInfo = jest.fn().mockResolvedValue({
      tokens: [{ address: USDT, symbol: 'USDT', decimals: 6, isNative: false }],
    });

    await expect(adapter.depositToVault('1', 20, DAI)).rejects.toThrow(
      'does not hold that coin'
    );
  });
});

describe('Referral invitee privacy', () => {
  test('exposes the referral count and nothing that lists invitees', async () => {
    const adapter = makeAdapter();
    adapter._getReferralModule = jest.fn().mockResolvedValue({
      getReferralCount: jest.fn().mockResolvedValue(3n),
    });

    await expect(adapter.getReferralCount()).resolves.toBe(3);
    expect(adapter.getReferredUsers).toBeUndefined();
    expect(TransactionManager.prototype.getReferredUsers).toBeUndefined();
    expect(BlockchainAdapter.prototype.getReferredUsers).toBeUndefined();
  });

  test('reports zero when the referral module is not registered', async () => {
    const adapter = makeAdapter();
    adapter._getReferralModule = jest.fn().mockResolvedValue(null);

    await expect(adapter.getReferralCount()).resolves.toBe(0);
  });

  test('ships an ABI with no invitee-listing view', () => {
    const names = ReferralModuleABI.map((entry) => entry.name);

    expect(names).toContain('getReferralCount');
    expect(names).not.toContain('getReferredUsers');

    // The invitee must not be an event field — an indexed invitee turns the
    // referrer => invitee mapping into a one-call log query
    const recorded = ReferralModuleABI.find((entry) => entry.name === 'ReferralRecorded');
    expect(recorded.inputs.map((input) => input.name)).toEqual([
      'referrer',
      'referralCount',
      'timestamp',
    ]);
  });
});
