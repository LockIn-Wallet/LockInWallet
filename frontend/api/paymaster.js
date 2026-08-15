/**
 * The paymaster, behind a door.
 *
 * A paymaster key spends real money, and anything the browser holds is public —
 * the bundle ships to every visitor, so a key in it can be read out of the
 * JavaScript in under a minute. Open source has nothing to do with it. So the
 * key lives here, in a server environment variable, and the browser talks to
 * this endpoint instead.
 *
 * What this buys is not secrecy for its own sake: it is the ability to say no.
 * A request that would sponsor a call into somebody else's contract is refused
 * before it ever reaches Pimlico, so the budget can only be spent on the thing
 * it was funded for.
 *
 * Deliberately stateless. Everything checked here is visible in the request
 * itself, so there is no store to keep, nothing to go stale, and no second
 * failure mode. Per-user quotas would need somewhere to count and are worth
 * adding only if abuse actually appears — see the note at the bottom.
 */

const { ethers } = require('ethers');
const networkConfig = require('../src/networkConfig.json');

/** ERC-7677. Anything else is not a paymaster request and is refused. */
const ALLOWED_METHODS = ['pm_getPaymasterStubData', 'pm_getPaymasterData'];

/**
 * How a smart account expresses "make these calls".
 *
 * The userOperation's callData is a call to the *account*, so the contract we
 * actually care about is one level in. Both shapes have to be unwrapped or the
 * check would only ever see the account itself and pass everything.
 */
const ACCOUNT_ABI = [
  'function execute(address to, uint256 value, bytes data)',
  'function executeBatch(tuple(address to, uint256 value, bytes data)[] calls)',
];

const MODULE_NAMES = [
  'TIME_PERIOD_LIMITS',
  'PROPOSAL_SYSTEM',
  'BYPASS_SYSTEM',
  'APPROVAL_SYSTEM',
  'PROXY_DEPLOYMENT',
  'SAVINGS_VAULTS',
  'VAULT_DEPOSIT_ADDRESSES',
  'VAULT_RULES',
  'VAULT_YIELD',
  'RECOVERY_SYSTEM',
  'REFERRAL',
  'POOL_TOGETHER',
  'YIELD_SYSTEM',
];

const CORE_ABI = ['function getModule(bytes32 moduleId) view returns (address)'];

// Cached per warm instance. Module addresses change only on an upgrade, and
// this life is short enough that one takes effect without a redeploy while
// sparing most requests the lookup entirely — which matters, because the
// wallet times the paymaster out in seconds.
const ADDRESS_CACHE_MS = 30 * 60 * 1000;
const addressCache = new Map();

const networkFor = (chainId) =>
  Object.entries(networkConfig.evm || {}).find(
    ([, config]) => config.chainId === Number(chainId)
  );

/**
 * Every contract of ours a user has business calling on this chain.
 *
 * Read from the on-chain registry rather than a list kept here, so upgrading a
 * module cannot silently stop its calls being sponsored — the same reason
 * nothing else in this project hardcodes a module address.
 */
const sponsorableAddresses = async (chainId) => {
  const cached = addressCache.get(chainId);
  if (cached && cached.expires > Date.now()) return cached.addresses;

  const entry = networkFor(chainId);
  if (!entry) return null;

  const [, config] = entry;
  const core = config.savingsContract;
  if (!core) return null;

  // Every configured endpoint, not just the first. A public RPC that throttles
  // this function is not an unusual event, and it must not be able to decide
  // what we will sponsor.
  for (const rpcUrl of config.rpcUrls || []) {
    const provider = new ethers.JsonRpcProvider(rpcUrl, Number(chainId), {
      staticNetwork: true,
    });
    const contract = new ethers.Contract(core, CORE_ABI, provider);
    const addresses = new Set([core.toLowerCase()]);

    // All at once. The wallet gives a paymaster only seconds to answer, and
    // thirteen sequential round trips on a cold start spends them — the fix
    // for one failure mode caused another.
    //
    // `allSettled`, not `all`: what broke this before was not concurrency, it
    // was treating a failed lookup as "no such module". Every rejection is
    // still counted and still disqualifies the whole answer.
    const results = await Promise.allSettled(
      MODULE_NAMES.map((name) =>
        contract.getModule(ethers.keccak256(ethers.toUtf8Bytes(name)))
      )
    );

    provider.destroy?.();

    let failed = false;
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(
          `Module lookup failed for ${MODULE_NAMES[index]} via ${rpcUrl}: ` +
            `${result.reason?.message || result.reason}`
        );
        failed = true;
        return;
      }
      const address = result.value;
      if (address && address !== ethers.ZeroAddress) {
        addresses.add(address.toLowerCase());
      }
    });

    if (!failed) {
      addressCache.set(chainId, {
        addresses,
        expires: Date.now() + ADDRESS_CACHE_MS,
      });
      return addresses;
    }
  }

  // A partial answer is worse than none: it would refuse real calls and cache
  // that refusal. Say so, and let the caller report the endpoint as unavailable.
  console.error(`Could not resolve modules for chain ${chainId} on any RPC`);
  return null;
};

/** The contracts a userOperation would actually call. */
const targetsOf = (callData) => {
  const iface = new ethers.Interface(ACCOUNT_ABI);

  try {
    const [to] = iface.decodeFunctionData('execute', callData);
    return [to.toLowerCase()];
  } catch {
    // Not a single call; try a batch.
  }

  try {
    const [calls] = iface.decodeFunctionData('executeBatch', callData);
    return calls.map((call) => call[0].toLowerCase());
  } catch {
    return null;
  }
};

const reject = (response, id, message) =>
  response.status(200).json({
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code: -32602, message },
  });

module.exports = async function handler(request, response) {
  // The caller is the wallet, not our own page: a smart wallet's signer runs on
  // the provider's domain and fetches this URL from there, so every request is
  // cross-origin and the browser will preflight it.
  //
  // Any origin is allowed, and that is not a gap. CORS only restrains browsers
  // — anyone can reach this with curl regardless — so it was never the defence
  // here. What actually protects the budget is the contract allowlist below and
  // the provider's spending cap, neither of which cares who is asking.
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.PIMLICO_API_KEY;
  if (!apiKey) {
    // Not configured is not an error the user can act on, and the frontend
    // treats a failure here as "nobody is paying" and falls back to the user's
    // own gas. Say so plainly in the logs instead.
    console.error('PIMLICO_API_KEY is not set; refusing to sponsor');
    return response.status(503).json({ error: 'Sponsorship unavailable' });
  }

  const body = request.body || {};
  const { id, method, params } = body;

  if (!ALLOWED_METHODS.includes(method)) {
    return reject(response, id, `Method ${method} is not a paymaster request`);
  }

  // ERC-7677: [userOperation, entryPoint, chainId, context]
  const userOperation = params?.[0];
  const chainId = Number(params?.[2] ?? 0) || Number(params?.[2]?.toString?.() ?? 0);

  const entry = networkFor(chainId);
  if (!entry) {
    return reject(response, id, `Chain ${chainId} is not sponsored`);
  }

  const targets = targetsOf(userOperation?.callData);
  if (!targets?.length) {
    return reject(response, id, 'Could not read what this operation would call');
  }

  const allowed = await sponsorableAddresses(chainId);
  if (!allowed) {
    return reject(response, id, `Chain ${chainId} is not configured`);
  }

  const foreign = targets.filter((target) => !allowed.has(target));
  if (foreign.length) {
    // The whole point of this endpoint. Someone pointing their own app at it
    // gets refused here, before a penny is spent.
    console.warn(`Refused sponsorship for foreign target(s): ${foreign.join(', ')}`);
    return reject(response, id, 'This operation is not eligible for sponsorship');
  }

  const [networkKey] = entry;
  const upstream = `https://api.pimlico.io/v2/${networkKey}/rpc?apikey=${apiKey}`;

  try {
    const result = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const payload = await result.json();

    // A JSON-RPC error rides inside a 200, so an upstream refusal looks like a
    // success from every angle except the user's — they just get asked for gas.
    // Say why here, or the only symptom is a popup quoting a fee.
    if (payload?.error) {
      console.warn(
        `Paymaster declined ${method}: ${JSON.stringify(payload.error).slice(0, 400)}`
      );
    }

    return response.status(200).json(payload);
  } catch (error) {
    console.error(`Paymaster upstream failed: ${error.message}`);
    return response.status(502).json({ error: 'Paymaster unavailable' });
  }
};

/**
 * What this does not stop.
 *
 * Someone can still make legitimate-looking calls into our own contracts from
 * many fresh addresses and burn the daily budget. The address check bounds what
 * the money can be spent on, not how often — so the provider-side spending cap
 * is not optional, it is the second half of this defence.
 *
 * If that turns out to be exploited, the next step is a per-address quota,
 * which needs somewhere to count (Vercel KV or similar). Left out deliberately:
 * it adds a store and a failure mode to guard against something that has not
 * happened yet.
 */
