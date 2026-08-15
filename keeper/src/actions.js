/**
 * The two things the keeper does on-chain, and nothing else.
 *
 * Both are permissionless: the keeper holds no role and no privilege, it just
 * pays for calls anyone could make. That is deliberate. The moment a sponsored
 * operation requires the keeper, the keeper becomes a single point of failure
 * between users and their money — and the fallback stops being "the user pays
 * their own gas", which is the whole reason this design degrades gracefully.
 *
 * Every function here is idempotent and returns an outcome rather than
 * throwing on a lost race. See outcomes.js for why that distinction matters.
 */

const { ethers } = require('ethers');
const { OUTCOME, isRace } = require('./outcomes');

const PROXY_ABI = [
  'function sweep(address token) external',
  'function sweepNative() external',
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
];

/**
 * Make sure `member` has a deposit address for `vaultId`, paying for it.
 *
 * `addressModule` must be connected to the keeper's signer — the nonce the
 * sender supplies belongs to that account, and handing it to a contract
 * connected to anyone else produces a transaction from the wrong address with
 * a nonce that does not apply to it.
 *
 * @returns {Promise<{outcome: string, address: string, hash?: string}>}
 */
async function ensureDepositAddress(addressModule, vaultId, member, send) {
  const address = await addressModule.depositAddressOf(vaultId, member);

  if (await addressModule.isDepositAddressDeployed(vaultId, member)) {
    return { outcome: OUTCOME.IDLE, address };
  }

  try {
    const receipt = await send((overrides) =>
      addressModule.deployDepositAddressFor(vaultId, member, overrides)
    );
    return { outcome: OUTCOME.DONE, address, hash: receipt.hash };
  } catch (error) {
    // The user pressed the button while we were mid-flight, or another keeper
    // instance won. Either way the address exists, which is all we wanted.
    if (isRace(error)) return { outcome: OUTCOME.RACED, address };
    throw error;
  }
}

/**
 * Push whatever ERC20 balance is sitting on a deposit address into the vault.
 *
 * Native coin needs no keeper: the proxy's `receive()` forwards it in the same
 * transaction that delivered it. ERC20 has no such hook — a token transfer
 * notifies nobody — so this is the only way a card or exchange deposit reaches
 * the vault without the user paying for it.
 */
async function sweepToken(proxyAddress, tokenAddress, signer, send) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const balance = await token.balanceOf(proxyAddress);

  if (balance === 0n) {
    return { outcome: OUTCOME.IDLE, amount: 0n };
  }

  // Built on the signer, not the provider: a provider-connected contract can
  // read but cannot send, and this call has to send.
  const proxy = new ethers.Contract(proxyAddress, PROXY_ABI, signer);

  try {
    const receipt = await send((overrides) => proxy.sweep(tokenAddress, overrides));
    return { outcome: OUTCOME.DONE, amount: balance, hash: receipt.hash };
  } catch (error) {
    // "Nothing to sweep" means the balance went in without us — the user swept
    // it themselves, or another instance did.
    if (isRace(error)) return { outcome: OUTCOME.RACED, amount: 0n };
    throw error;
  }
}

module.exports = { ensureDepositAddress, sweepToken, PROXY_ABI, ERC20_ABI };
