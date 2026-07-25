const { TransactionManager } = require('../../adapters/TransactionManager.js');

/**
 * TransactionManager active-vault restore tests
 *
 * The active vault selection is persisted per wallet in localStorage and can
 * outlive the chain it was made on (e.g. a local chain reset). A stale vault
 * must be dropped on restore, otherwise every vault-scoped read (spending
 * limits, balances) silently fails while the UI reports setup as committed.
 */

const WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const VAULT = '7';
const KEY = `active_vault_address_${WALLET}`;

function makeTm(adapter) {
  const tm = new TransactionManager();
  tm.networkType = 'evm';
  tm.adapter = adapter;
  return tm;
}

describe('TransactionManager active-vault restore', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(KEY, VAULT);
  });

  test('restores a vault that still resolves on-chain', async () => {
    const tm = makeTm({
      userAddress: WALLET,
      getVaultInfo: jest.fn().mockResolvedValue({ address: VAULT, vaultType: 'Personal' }),
    });

    await tm._restoreActiveVault();

    expect(tm.activeVaultAddress).toBe(VAULT);
    expect(localStorage.getItem(KEY)).toBe(VAULT);
  });

  test('drops a stale vault that no longer exists (e.g. after a chain reset)', async () => {
    const tm = makeTm({
      userAddress: WALLET,
      getVaultInfo: jest.fn().mockRejectedValue(new Error('vault not found')),
    });

    await tm._restoreActiveVault();

    expect(tm.activeVaultAddress).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
    // Legacy account becomes the target again, so spending limits resolve
    expect(tm._usesLegacyAccount()).toBe(true);
  });

  test('does nothing when no selection is stored', async () => {
    localStorage.clear();
    const getVaultInfo = jest.fn();
    const tm = makeTm({ userAddress: WALLET, getVaultInfo });

    await tm._restoreActiveVault();

    expect(tm.activeVaultAddress).toBeNull();
    expect(getVaultInfo).not.toHaveBeenCalled();
  });
});
