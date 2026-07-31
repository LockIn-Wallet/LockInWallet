const onrampConfig = require("../../src/onrampConfig.json");

/**
 * Mints a Transak widget URL for a card purchase that pays out straight into a
 * user's locked savings deposit address.
 *
 * Transak made this a server-side step: the session call needs a partner access
 * token derived from the API secret, the returned widgetUrl is single-use and
 * expires after five minutes, and Transak expects the call to come from the
 * partner's own backend. The secret therefore never reaches the browser — the
 * frontend only ever sees the finished widgetUrl.
 */

const TRANSAK_HOSTS = {
  STAGING: {
    partners: "https://api-stg.transak.com",
    gateway: "https://api-gateway-stg.transak.com",
  },
  PRODUCTION: {
    partners: "https://api.transak.com",
    gateway: "https://api-gateway.transak.com",
  },
};

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

// Refreshed tokens last 7 days; renew a little early so a warm function never
// sends one that expires mid-request
const TOKEN_EXPIRY_MARGIN_MS = 60 * 1000;

// Cached across invocations of a warm function so we are not minting a new
// partner token for every single purchase
let cachedToken = null;

const hostsFor = (environment) =>
  TRANSAK_HOSTS[environment] || TRANSAK_HOSTS.PRODUCTION;

/** Signals a deployment/config problem rather than a bad request. */
class ConfigError extends Error {}

/**
 * Reads and validates the server-side Transak credentials.
 * @returns {{apiKey: string, apiSecret: string, environment: string, referrerDomain: string|undefined}}
 */
const readCredentials = () => {
  const apiKey = process.env.TRANSAK_API_KEY;
  const apiSecret = process.env.TRANSAK_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new ConfigError(
      "Card purchases are not configured on this deployment",
    );
  }

  return {
    apiKey,
    apiSecret,
    environment:
      process.env.TRANSAK_ENVIRONMENT === "STAGING" ? "STAGING" : "PRODUCTION",
    referrerDomain: process.env.TRANSAK_REFERRER_DOMAIN,
  };
};

/**
 * Partner access token, minted from the API secret and reused until it expires.
 * @param {{apiKey: string, apiSecret: string, environment: string}} credentials
 * @returns {Promise<string>}
 */
const getAccessToken = async ({ apiKey, apiSecret, environment }) => {
  if (cachedToken && cachedToken.expiresAtMs > Date.now()) {
    return cachedToken.accessToken;
  }

  const response = await fetch(
    `${hostsFor(environment).partners}/partners/api/v2/refresh-token`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-secret": apiSecret,
      },
      body: JSON.stringify({ apiKey }),
    },
  );

  const body = await response.json().catch(() => ({}));
  const data = body.data || body;

  if (!response.ok || !data.accessToken) {
    throw new Error(
      body.error?.message || "Could not authenticate with the payment provider",
    );
  }

  cachedToken = {
    accessToken: data.accessToken,
    // expiresAt is in seconds; treat a missing value as immediately stale so we
    // simply refresh next time rather than trusting an unknown lifetime
    expiresAtMs: data.expiresAt
      ? data.expiresAt * 1000 - TOKEN_EXPIRY_MARGIN_MS
      : 0,
  };

  return data.accessToken;
};

/**
 * Validates the purchase request against the networks and token we support.
 * @param {object} body Parsed request body
 * @returns {{transakNetwork: string, walletAddress: string, fiatAmount: number|undefined, fiatCurrency: string|undefined, partnerCustomerId: string|undefined}}
 */
const validateRequest = (body) => {
  const { network, cryptoCurrencyCode, walletAddress } = body || {};

  const networkConfig = onrampConfig.networks[network];
  if (!networkConfig) {
    throw new Error(`Card purchases are not available on ${network || "this network"}`);
  }

  if (cryptoCurrencyCode !== onrampConfig.cryptoCurrencyCode) {
    throw new Error(
      `Card purchases only support ${onrampConfig.cryptoCurrencyCode}`,
    );
  }

  if (!EVM_ADDRESS_PATTERN.test(walletAddress || "")) {
    throw new Error("A valid deposit address is required");
  }

  const fiatAmount = Number(body.fiatAmount);

  return {
    transakNetwork: networkConfig.transakNetwork,
    walletAddress,
    fiatAmount: Number.isFinite(fiatAmount) && fiatAmount > 0 ? fiatAmount : undefined,
    fiatCurrency: typeof body.fiatCurrency === "string" ? body.fiatCurrency : undefined,
    partnerCustomerId:
      typeof body.partnerCustomerId === "string" ? body.partnerCustomerId : undefined,
  };
};

/**
 * The originating user IP, which Transak wants passed through for its own
 * fraud and geo checks.
 * @param {object} req
 * @returns {string|undefined}
 */
const clientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || undefined;
};

/**
 * Reads the JSON body, tolerating hosts that hand it over unparsed.
 * @param {object} req
 * @returns {object}
 */
const readBody = (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.length > 0) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let credentials;
  let purchase;
  try {
    credentials = readCredentials();
    purchase = validateRequest(readBody(req));
  } catch (error) {
    const status = error instanceof ConfigError ? 503 : 400;
    if (status === 503) console.error("Transak session config error:", error.message);
    return res.status(status).json({ error: error.message });
  }

  try {
    const accessToken = await getAccessToken(credentials);
    const referrerDomain =
      credentials.referrerDomain || `https://${req.headers.host}`;

    const response = await fetch(
      `${hostsFor(credentials.environment).gateway}/api/v2/auth/session`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-api-key": credentials.apiKey,
          "access-token": accessToken,
          ...(clientIp(req) ? { "x-user-ip": clientIp(req) } : {}),
        },
        body: JSON.stringify({
          widgetParams: {
            apiKey: credentials.apiKey,
            referrerDomain,
            productsAvailed: "BUY",
            cryptoCurrencyCode: onrampConfig.cryptoCurrencyCode,
            network: purchase.transakNetwork,
            walletAddress: purchase.walletAddress,
            // The whole point of the integration: the payout address is the
            // user's locked deposit address and they must not be able to
            // redirect it to a spendable wallet
            disableWalletAddressForm: true,
            ...(purchase.fiatAmount ? { fiatAmount: purchase.fiatAmount } : {}),
            ...(purchase.fiatCurrency
              ? { fiatCurrency: purchase.fiatCurrency }
              : {}),
            ...(purchase.partnerCustomerId
              ? { partnerCustomerId: purchase.partnerCustomerId }
              : {}),
          },
        }),
      },
    );

    const body = await response.json().catch(() => ({}));
    const widgetUrl = (body.data || body).widgetUrl;

    if (!response.ok || !widgetUrl) {
      // A stale cached token is the likeliest cause of a 401 — drop it so the
      // next attempt mints a fresh one
      if (response.status === 401) cachedToken = null;
      console.error(
        "Transak session request failed:",
        response.status,
        body.error?.message || "no widgetUrl in response",
      );
      return res.status(502).json({
        error:
          body.error?.message || "The payment provider could not start a purchase",
      });
    }

    // Single-use and valid for five minutes, so there is nothing to cache
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ widgetUrl });
  } catch (error) {
    console.error("Transak session error:", error.message);
    return res
      .status(502)
      .json({ error: "Could not start the purchase. Please try again." });
  }
};
