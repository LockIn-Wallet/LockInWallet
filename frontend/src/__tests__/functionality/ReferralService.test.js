const {
  captureReferrerFromUrl,
  getPendingReferrer,
  getPendingReferrerFor,
  clearPendingReferrer,
  buildReferralLink,
} = require('../../services/referral.service.js');
const { truncateAddress } = require('../../utils/addressUtils.js');
const { TransactionManager } = require('../../adapters/TransactionManager.js');

/**
 * ReferralService Tests - unit tests for referral link capture and threading
 *
 * These tests cover:
 * - Capturing ?ref= from the URL and persisting it until setup commit
 * - First-capture-wins and self-referral filtering rules
 * - TransactionManager forwarding the referrer to the EVM adapter only
 */

const USDC = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85';
const REFERRER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const OTHER_REFERRER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

function setUrl(search) {
  window.history.pushState({}, '', `/${search}`);
}

describe('Referral Service', () => {
  beforeEach(() => {
    localStorage.clear();
    setUrl('');
  });

  describe('captureReferrerFromUrl', () => {
    test('captures a valid referrer address from ?ref=', () => {
      setUrl(`?ref=${REFERRER}`);
      expect(captureReferrerFromUrl()).toBe(REFERRER);
      expect(getPendingReferrer()).toBe(REFERRER);
    });

    test('normalizes lowercase addresses to checksum form', () => {
      setUrl(`?ref=${REFERRER.toLowerCase()}`);
      expect(captureReferrerFromUrl()).toBe(REFERRER);
    });

    test('ignores an invalid address', () => {
      setUrl('?ref=not-an-address');
      expect(captureReferrerFromUrl()).toBeNull();
      expect(getPendingReferrer()).toBeNull();
    });

    test('captures nothing when no ref param is present', () => {
      expect(captureReferrerFromUrl()).toBeNull();
    });

    test('first capture wins over later links', () => {
      setUrl(`?ref=${REFERRER}`);
      captureReferrerFromUrl();
      setUrl(`?ref=${OTHER_REFERRER}`);
      expect(captureReferrerFromUrl()).toBe(REFERRER);
    });

    test('recovers from corrupted stored state', () => {
      localStorage.setItem('pending_referrer', 'not json');
      setUrl(`?ref=${REFERRER}`);
      expect(captureReferrerFromUrl()).toBe(REFERRER);
    });
  });

  describe('getPendingReferrerFor', () => {
    test('filters out self-referrals case-insensitively', () => {
      setUrl(`?ref=${REFERRER}`);
      captureReferrerFromUrl();
      expect(getPendingReferrerFor(REFERRER.toLowerCase())).toBeNull();
      expect(getPendingReferrerFor(OTHER_REFERRER)).toBe(REFERRER);
      expect(getPendingReferrerFor(null)).toBe(REFERRER);
    });

    test('tolerates a non-string wallet without throwing', () => {
      // EVMAdapter.getAddress() is async, so callers can hand over a Promise;
      // that must never crash the setup screen
      setUrl(`?ref=${REFERRER}`);
      captureReferrerFromUrl();
      expect(() => getPendingReferrerFor(Promise.resolve(REFERRER))).not.toThrow();
      expect(getPendingReferrerFor(Promise.resolve(REFERRER))).toBe(REFERRER);
      expect(getPendingReferrerFor(undefined)).toBe(REFERRER);
    });
  });

  describe('clearPendingReferrer', () => {
    test('removes the stored referrer', () => {
      setUrl(`?ref=${REFERRER}`);
      captureReferrerFromUrl();
      clearPendingReferrer();
      expect(getPendingReferrer()).toBeNull();
    });
  });

  describe('buildReferralLink', () => {
    test('builds an origin-based ?ref= link', () => {
      expect(buildReferralLink(REFERRER)).toBe(
        `${window.location.origin}/?ref=${REFERRER}`
      );
    });
  });
});

describe('truncateAddress', () => {
  test('shortens long addresses', () => {
    expect(truncateAddress(REFERRER)).toBe('0x7099...79C8');
  });

  test('passes short or empty values through', () => {
    expect(truncateAddress('0x1234')).toBe('0x1234');
    expect(truncateAddress(null)).toBe('');
  });
});

describe('TransactionManager referral threading', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Setup now takes the full period set, each with its own bypass/change wait
  const PERIODS = [
    { name: 'Daily', limit: 10, duration: 86400, unlockDelay: 86400 },
    { name: 'Weekly', limit: 50, duration: 604800, unlockDelay: 604800 },
    { name: 'Monthly', limit: 100, duration: 2592000, unlockDelay: 2592000 },
  ];

  function pendingReferrerStored() {
    localStorage.setItem(
      'pending_referrer',
      JSON.stringify({ address: REFERRER, capturedAt: 1 })
    );
  }

  // Locking in on EVM creates the savings vault itself, so the referrer rides
  // along with it rather than with a separate account commit.
  const evmManager = (adapter) => {
    const tm = new TransactionManager();
    tm.networkType = 'evm';
    tm.networkConfig = { tokens: { USDC: { address: USDC, symbol: 'USDC', decimals: 6 } } };
    tm.adapter = adapter;
    return tm;
  };

  test('forwards the referrer to the EVM adapter and clears it on success', async () => {
    pendingReferrerStored();
    const tm = evmManager({
      createVault: jest.fn().mockResolvedValue({ vaultAddress: '1', signature: '0xhash' }),
      getAddress: jest.fn().mockReturnValue('wallet111'),
    });

    const hash = await tm.commitSetup(PERIODS, { referrer: REFERRER });

    expect(hash).toBe('0xhash');
    expect(tm.adapter.createVault).toHaveBeenCalledWith(
      expect.objectContaining({ referrer: REFERRER, kind: 'stables' }),
    );
    expect(getPendingReferrer()).toBeNull();
  });

  test('keeps the pending referrer when the EVM commit fails', async () => {
    pendingReferrerStored();
    const tm = evmManager({
      createVault: jest.fn().mockRejectedValue(new Error('rejected')),
      getAddress: jest.fn().mockReturnValue('wallet111'),
    });

    await expect(tm.commitSetup(PERIODS, { referrer: REFERRER })).rejects.toThrow('rejected');
    expect(getPendingReferrer()).toBe(REFERRER);
  });

  test('ignores the referrer on Solana but still clears it after commit', async () => {
    pendingReferrerStored();
    const tm = new TransactionManager();
    tm.networkType = 'solana';
    tm.adapter = {
      createVault: jest.fn().mockResolvedValue({ vaultAddress: 'vault111', signature: 'sig111' }),
      getAddress: jest.fn().mockReturnValue('wallet111'),
      userAddress: 'wallet111',
    };

    const sig = await tm.commitSetup(PERIODS, { tokenMint: 'mint111', referrer: REFERRER });

    expect(sig).toBe('sig111');
    expect(tm.adapter.createVault).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(tm.adapter.createVault.mock.calls[0])).not.toContain(REFERRER);
    expect(getPendingReferrer()).toBeNull();
  });
});
