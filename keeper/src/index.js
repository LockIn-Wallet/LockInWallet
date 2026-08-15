/**
 * The keeper: pays for the transactions a saver cannot yet afford.
 *
 * It holds no privilege. Every call it makes is permissionless — anyone could
 * make it, including the user. That is what keeps the fallback honest: if this
 * service is down, the app still works and the user simply pays their own gas.
 * Nothing here is on the critical path to anyone's money.
 *
 * Run it with:  NETWORK=base node keeper/src/index.js
 */

const { ethers } = require('ethers');
const { tokensFor, coreAddressFor, resolveModules } = require('./config');
const { Sender } = require('./sender');
const { reconcileOnce } = require('./reconcile');

const DEFAULTS = {
  intervalMs: 30_000,
  // Below this the keeper stops rather than firing transactions that will fail
  // and burn the remainder on gas. Reported loudly: an out-of-funds keeper is
  // invisible from the outside, since the app keeps working.
  minBalanceEth: '0.0005',
};

function log(message) {
  console.log(`[keeper ${new Date().toISOString()}] ${message}`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function buildContext() {
  const network = process.env.NETWORK || 'localhost';
  const rpcUrl = process.env.RPC_URL;
  const provider = rpcUrl
    ? new ethers.JsonRpcProvider(rpcUrl)
    : new ethers.JsonRpcProvider(
        network === 'localhost' ? 'http://127.0.0.1:8545' : undefined
      );

  const signer = new ethers.Wallet(requireEnv('KEEPER_PRIVATE_KEY'), provider);
  const coreAddress = coreAddressFor(network);
  const { vaults, depositAddresses } = await resolveModules(coreAddress, signer);
  const tokens = tokensFor(network);
  const sender = new Sender(signer, { log });

  log(`network        ${network}`);
  log(`keeper address ${await signer.getAddress()}`);
  log(`core           ${coreAddress}`);
  log(`watching       ${tokens.map((t) => t.symbol).join(', ')}`);

  // Contracts are connected to the keeper's signer throughout, so the nonce the
  // sender supplies always belongs to the account the transaction goes out from.
  return {
    provider,
    signer,
    vaults,
    depositAddresses,
    tokens,
    send: (build) => sender.send(build),
    log,
  };
}

/**
 * Refuse to run on fumes. A keeper that is out of gas fails silently from the
 * user's point of view — deposits simply stop arriving — so this has to be
 * noisy and it has to stop the cycle rather than retrying into the void.
 */
async function hasGas(context, minWei) {
  const address = await context.signer.getAddress();
  const balance = await context.provider.getBalance(address);

  if (balance < minWei) {
    log(
      `OUT OF GAS: ${ethers.formatEther(balance)} ETH left, need ` +
        `${ethers.formatEther(minWei)}. Top up ${address} — deposits are not being swept.`
    );
    return false;
  }
  return true;
}

async function main() {
  const context = await buildContext();
  const intervalMs = Number(process.env.INTERVAL_MS || DEFAULTS.intervalMs);
  const minWei = ethers.parseEther(
    process.env.MIN_BALANCE_ETH || DEFAULTS.minBalanceEth
  );

  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      log(`${signal} received, finishing this cycle then stopping`);
      stopping = true;
    });
  }

  while (!stopping) {
    try {
      if (await hasGas(context, minWei)) {
        const stats = await reconcileOnce(context);
        if (stats.swept || stats.deployed || stats.failed) {
          log(
            `cycle: ${stats.swept} swept, ${stats.deployed} deployed, ` +
              `${stats.raced} raced, ${stats.failed} failed`
          );
        }
      }
    } catch (error) {
      // Never let one bad cycle kill the process — an RPC blip must not take
      // the service down until somebody notices.
      log(`cycle failed: ${error.message}`);
    }

    if (stopping) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  log('stopped');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { buildContext, main };
