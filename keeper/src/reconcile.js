/**
 * Find money sitting on deposit addresses and push it into the vault.
 *
 * This walks the full membership every cycle rather than following events.
 * That is a deliberate choice, not a shortcut: reconciliation from current
 * state is the only approach that self-heals. A keeper that only reacts to
 * events misses everything that happened while it was down, and misses money
 * that arrived at an address before it was ever deployed — which is the normal
 * case here, since a member is shown their address and can hand it to an
 * exchange long before any contract exists there.
 *
 * The cost is O(members x tokens) reads per cycle. Reads are cheap, parallel,
 * and free; when the member count makes that bite, the fix is a log-based fast
 * path *in front of* this loop, keeping this as the periodic backstop. Do not
 * replace it — losing the self-healing property to save some RPC calls is a
 * bad trade for a service whose whole job is not losing deposits.
 */

const { ethers } = require('ethers');
const { OUTCOME } = require('./outcomes');
const { ensureDepositAddress, sweepToken, ERC20_ABI } = require('./actions');

/** Every (vaultId, member) pair the deployment currently knows about. */
async function listMemberships(vaults) {
  const count = await vaults.getVaultCount();
  const memberships = [];

  for (let vaultId = 1n; vaultId <= count; vaultId++) {
    const members = await vaults.getVaultMembers(vaultId);
    for (const member of members) {
      memberships.push({ vaultId, member });
    }
  }

  return memberships;
}

/**
 * Which tokens are actually sitting on this address right now.
 *
 * Reads only — safe to run in parallel, and nothing here spends gas. A token
 * that cannot be read at all (a bad address in config, a contract that is not
 * an ERC20) is treated as empty rather than being allowed to abort the whole
 * member: one misconfigured token must not stop the others landing.
 */
async function fundedTokens(runner, address, tokens) {
  const balances = await Promise.all(
    tokens.map(async (token) => {
      try {
        const erc20 = new ethers.Contract(token.address, ERC20_ABI, runner);
        return { token, balance: await erc20.balanceOf(address) };
      } catch {
        return { token, balance: 0n };
      }
    })
  );

  return balances.filter(({ balance }) => balance > 0n);
}

/**
 * One pass over everything.
 *
 * A failure against one member is logged and skipped rather than aborting the
 * cycle — one member's broken token must not stop everybody else's deposits
 * from landing.
 *
 * @returns {Promise<{swept: number, deployed: number, raced: number, failed: number}>}
 */
async function reconcileOnce({ signer, vaults, depositAddresses, tokens, send, log }) {
  const stats = { swept: 0, deployed: 0, raced: 0, failed: 0 };
  const memberships = await listMemberships(vaults);

  for (const { vaultId, member } of memberships) {
    try {
      const address = await depositAddresses.depositAddressOf(vaultId, member);
      const funded = await fundedTokens(signer, address, tokens);
      if (funded.length === 0) continue;

      // Only now is deploying worth paying for. Deploying an address nobody has
      // sent anything to would spend gas to no purpose.
      const ensured = await ensureDepositAddress(
        depositAddresses,
        vaultId,
        member,
        send
      );
      if (ensured.outcome === OUTCOME.DONE) {
        stats.deployed++;
        log(`deployed deposit address for vault ${vaultId} member ${member}`);
      } else if (ensured.outcome === OUTCOME.RACED) {
        stats.raced++;
      }

      for (const { token, balance } of funded) {
        const result = await sweepToken(address, token.address, signer, send);

        if (result.outcome === OUTCOME.DONE) {
          stats.swept++;
          const amount = ethers.formatUnits(balance, token.decimals);
          log(`swept ${amount} ${token.symbol} for vault ${vaultId} member ${member}`);
        } else if (result.outcome === OUTCOME.RACED) {
          stats.raced++;
          log(`${token.symbol} for vault ${vaultId} member ${member} was already swept`);
        }
      }
    } catch (error) {
      stats.failed++;
      log(`FAILED vault ${vaultId} member ${member}: ${error.message}`);
    }
  }

  return stats;
}

module.exports = { reconcileOnce, listMemberships, fundedTokens };
