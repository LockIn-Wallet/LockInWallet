/**
 * Paying someone else's network fee.
 *
 * Someone who signed in with a passkey holds no ETH, so every action they take
 * — creating their vault, setting their limits — asks them for a fee in a coin
 * they have never heard of and do not have. Sponsorship is what closes that
 * gap, and without it signing in only ever produces an account nobody can use.
 *
 * This is a different mechanism from the keeper, and the two do not overlap.
 * The keeper pays for calls *anyone* may make, on behalf of someone who is not
 * here. A paymaster pays for calls the user themselves authorises, which is
 * everything gated by `msg.sender` and therefore everything the keeper
 * structurally cannot touch.
 *
 * It works by wrapping the signer rather than changing any call site. Every
 * contract call in the adapters keeps being written the ordinary way and is
 * sponsored on the way out, so nothing downstream needs to know this exists —
 * the same reasoning that keeps chain differences inside the adapters.
 */

import { AbstractSigner } from 'ethers';
import networkConfig from '../networkConfig.json';

/** Configured per deployment; absent means nobody is offering to pay. */
const PAYMASTER_URL = process.env.REACT_APP_PAYMASTER_URL || '';

/**
 * The paymaster endpoint for a chain.
 *
 * Most providers address chains separately — Pimlico's URL carries the network
 * in its path — so the configured value may contain a `{chain}` placeholder,
 * filled from the same network key the rest of the app uses. A URL without one
 * is used as given, for providers that route by chainId in the request body.
 *
 * The result is always absolute. This URL is not fetched by us: it is handed to
 * the wallet, which calls it from its own origin — a smart wallet's signer runs
 * on the provider's domain, not ours. A relative path would therefore be
 * resolved against *their* host and quietly 404, so sponsorship would fail with
 * no sign that the address was ever wrong.
 */
const paymasterUrlFor = (chainId) => {
  if (!PAYMASTER_URL) return '';

  let url = PAYMASTER_URL;

  if (url.includes('{chain}')) {
    const key = Object.entries(networkConfig.evm || {}).find(
      ([, config]) => config.chainId === Number(chainId)
    )?.[0];

    // No name for this chain means no endpoint to build; the caller treats an
    // empty URL as "nobody is paying", which is the safe reading.
    if (!key) return '';
    url = url.replace('{chain}', key);
  }

  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === 'undefined') return '';
  return new URL(url, window.location.origin).toString();
};

// EIP-5792 reports bundle status two ways depending on its version: the newer
// spec uses numbers (1xx pending, 2xx confirmed, above that failed) and 1.0 —
// which is the version we send, and what this wallet answers in — uses strings.
// Reading only the numbers meant a confirmed bundle parsed as NaN, never
// matched, and timed out: the transaction had landed, and we reported failure.
const CONFIRMED = 200;
const STRING_STATUS = {
  CONFIRMED: 200,
  PENDING: 100,
  FAILED: 500,
};

const statusCodeOf = (status) => {
  if (typeof status === 'string') {
    const known = STRING_STATUS[status.toUpperCase()];
    // An unrecognised string is not progress; keep waiting rather than
    // declaring either outcome.
    return known ?? 100;
  }
  const numeric = Number(status);
  return Number.isFinite(numeric) ? numeric : 100;
};
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 90_000;

const toHexChainId = (chainId) => `0x${Number(chainId).toString(16)}`;

export const isSponsorshipConfigured = () => !!PAYMASTER_URL;

/**
 * Whether this wallet will let someone else pay, on this chain.
 *
 * An extension answers no — it has no bundle API and its user brought their own
 * ETH anyway. A smart wallet answers yes, and only then is there anything to
 * offer.
 */
export const canSponsor = async (provider, chainId) => {
  if (!paymasterUrlFor(chainId) || !provider?.request) return false;

  try {
    const from = (await provider.request({ method: 'eth_accounts' }))?.[0];
    if (!from) return false;

    const capabilities = await provider.request({
      method: 'wallet_getCapabilities',
      params: [from],
    });

    return !!capabilities?.[toHexChainId(chainId)]?.paymasterService?.supported;
  } catch {
    // A wallet that does not implement the method throws, which is itself the
    // answer. Not being able to sponsor is never an error worth surfacing.
    return false;
  }
};

/**
 * Wait for a submitted bundle to land.
 *
 * Returns the first receipt, because everything here sends one call at a time —
 * batching several into one signature is a separate change, and this shape
 * keeps `tx.wait()` behaving exactly as callers already expect.
 */
const waitForBundle = async (provider, id) => {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const result = await provider.request({
      method: 'wallet_getCallsStatus',
      params: [id],
    });

    const status = statusCodeOf(result?.status);

    if (status >= CONFIRMED) {
      const receipt = result?.receipts?.[0];
      if (status > 299 || receipt?.status === '0x0') {
        throw new Error(`Sponsored transaction failed (status ${status})`);
      }
      return receipt;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Sponsored transaction timed out');
};

/**
 * A signer that sends through the wallet's bundle API with a paymaster
 * attached, and is otherwise the signer it wraps.
 */
class SponsoredSigner extends AbstractSigner {
  constructor(inner, walletProvider, chainId) {
    super(inner.provider);
    this.inner = inner;
    this.walletProvider = walletProvider;
    this.chainId = chainId;
  }

  async getAddress() {
    return this.inner.getAddress();
  }

  connect(provider) {
    return new SponsoredSigner(
      this.inner.connect(provider),
      this.walletProvider,
      this.chainId
    );
  }

  async signMessage(message) {
    return this.inner.signMessage(message);
  }

  async signTypedData(domain, types, value) {
    return this.inner.signTypedData(domain, types, value);
  }

  async signTransaction(tx) {
    return this.inner.signTransaction(tx);
  }

  async sendTransaction(tx) {
    const from = await this.getAddress();

    const params = [
      {
        version: '1.0',
        chainId: toHexChainId(this.chainId),
        from,
        calls: [
          {
            to: tx.to,
            data: tx.data || '0x',
            value: tx.value ? `0x${BigInt(tx.value).toString(16)}` : '0x0',
          },
        ],
        capabilities: {
          // Flat, with `url` directly on the object. Current ERC-7677 keys
          // this by chain id, and this wallet does not: keyed, it answers
          // "Paymaster service must have a url" — it is looking for `.url`
          // right here and finds an object instead.
          paymasterService: { url: paymasterUrlFor(this.chainId) },
        },
      },
    ];

    const id = await this.walletProvider.request({
      method: 'wallet_sendCalls',
      params,
    });

    const bundleId = typeof id === 'string' ? id : id?.id;
    const receipt = await waitForBundle(this.walletProvider, bundleId);
    const hash = receipt?.transactionHash || bundleId;

    // Shaped like an ethers TransactionResponse, because every caller does
    // `const tx = await contract.method(); await tx.wait()` and none of them
    // should have to learn a second shape.
    return {
      hash,
      from,
      to: tx.to,
      wait: async () => ({
        hash,
        status: receipt?.status === '0x0' ? 0 : 1,
        blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : undefined,
        logs: receipt?.logs || [],
      }),
    };
  }
}

/**
 * Wrap a signer so its transactions are paid for, when that is possible.
 *
 * Returns the original signer untouched when it is not — no paymaster
 * configured, or a wallet that cannot use one. Sponsorship is an improvement
 * on the normal path, never a requirement for it: a user who brought their own
 * ETH must keep working exactly as before, and so must everyone if the
 * paymaster is down.
 */
export const withSponsorship = async (signer, walletProvider, chainId) => {
  const url = paymasterUrlFor(chainId);

  if (!(await canSponsor(walletProvider, chainId))) {
    // Said out loud because the alternative is invisible: without sponsorship
    // the user is simply asked for gas, which looks identical to a paymaster
    // that is configured and refusing. Naming which of the two it is turns a
    // guess into a five-second check.
    console.info(
      `💸 Sponsorship off for chain ${chainId} — ` +
        (url
          ? 'the wallet did not offer paymasterService (an extension never does)'
          : 'no REACT_APP_PAYMASTER_URL in this build')
    );
    return signer;
  }

  console.info(`💸 Sponsorship on for chain ${chainId} via ${url}`);
  return new SponsoredSigner(signer, walletProvider, chainId);
};
