const { fetchWithdrawalAddresses } = require('../../services/withdrawalAddress.service.js');

/**
 * Withdrawal address service regression tests
 *
 * The EVM dispatch once omitted transactionManager from the helper params, so
 * the destinations list silently came back empty even though the address was
 * recorded on-chain. The manager must flow through to the EVM helper.
 */

const DESTINATION = '0xC0ffee254729296a45a3885639AC7E10F9d54979';

describe('fetchWithdrawalAddresses (EVM)', () => {
  test('returns the on-chain destinations through the transaction manager', async () => {
    const transactionManager = {
      getWithdrawalAddresses: jest.fn().mockResolvedValue([
        { title: 'test', destination: DESTINATION, addedAt: 1784978118 },
      ]),
    };

    const addresses = await fetchWithdrawalAddresses({
      networkType: 'evm',
      transactionManager,
      savingsContract: {},
      userAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    });

    expect(transactionManager.getWithdrawalAddresses).toHaveBeenCalled();
    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toMatchObject({
      title: 'test',
      destination: DESTINATION,
      addedTimestamp: 1784978118,
      networkType: 'evm',
    });
  });

  test('returns an empty list when no transaction manager is available', async () => {
    const addresses = await fetchWithdrawalAddresses({
      networkType: 'evm',
      savingsContract: {},
      userAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    });

    expect(addresses).toEqual([]);
  });

  test('tolerates manager errors by falling back to an empty list', async () => {
    const transactionManager = {
      getWithdrawalAddresses: jest.fn().mockRejectedValue(new Error('rpc down')),
    };

    const addresses = await fetchWithdrawalAddresses({
      networkType: 'evm',
      transactionManager,
      savingsContract: {},
      userAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    });

    expect(addresses).toEqual([]);
  });
});
