/**
 * Transak Session Endpoint Tests - the backend that mints a purchase session
 *
 * These tests cover:
 * - Only supported network/token pairs and real addresses are accepted
 * - The payout address form is locked so a purchase cannot be redirected
 * - The API secret never leaves the server, on success or on failure
 * - The partner access token is reused while valid and dropped when rejected
 */

const DEPOSIT_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const API_KEY = "test-api-key";
const API_SECRET = "test-api-secret";
const ACCESS_TOKEN = "test-access-token";
const WIDGET_URL = "https://global.transak.com/?sessionId=abc";

const ORIGINAL_ENV = { ...process.env };

/** Minimal stand-in for the Vercel response object */
const mockResponse = () => {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader: (key, value) => {
      res.headers[key] = value;
    },
    status: (code) => {
      res.statusCode = code;
      return res;
    },
    json: (body) => {
      res.body = body;
      return res;
    },
  };
  return res;
};

const mockRequest = (body, method = "POST") => ({
  method,
  headers: { host: "savings.example", "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
  socket: { remoteAddress: "10.0.0.1" },
  body,
});

const validBody = (overrides = {}) => ({
  network: "base",
  cryptoCurrencyCode: "USDC",
  walletAddress: DEPOSIT_ADDRESS,
  ...overrides,
});

/**
 * Queues provider responses: the token refresh first, then the session call.
 * @param {object} options
 */
const mockProvider = ({
  tokenResponse = { ok: true, body: { data: { accessToken: ACCESS_TOKEN, expiresAt: Math.floor(Date.now() / 1000) + 604800 } } },
  sessionResponse = { ok: true, status: 200, body: { data: { widgetUrl: WIDGET_URL } } },
} = {}) => {
  global.fetch = jest.fn((url) => {
    const target = url.includes("refresh-token") ? tokenResponse : sessionResponse;
    return Promise.resolve({
      ok: target.ok,
      status: target.status || (target.ok ? 200 : 400),
      json: () => Promise.resolve(target.body),
    });
  });
};

/** Fresh handler per test so its cached access token never leaks between them */
const loadHandler = () => {
  let handler;
  jest.isolateModules(() => {
    handler = require("../../../api/transak/session.js");
  });
  return handler;
};

const callsTo = (fragment) =>
  global.fetch.mock.calls.filter(([url]) => url.includes(fragment));

const sessionPayload = () =>
  JSON.parse(callsTo("auth/session")[0][1].body).widgetParams;

describe("Transak session endpoint", () => {
  beforeEach(() => {
    process.env.TRANSAK_API_KEY = API_KEY;
    process.env.TRANSAK_API_SECRET = API_SECRET;
    process.env.TRANSAK_ENVIRONMENT = "STAGING";
    delete process.env.TRANSAK_REFERRER_DOMAIN;
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockProvider();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
    delete global.fetch;
  });

  describe("request validation", () => {
    test("rejects anything but POST", async () => {
      const res = mockResponse();
      await loadHandler()(mockRequest(validBody(), "GET"), res);

      expect(res.statusCode).toBe(405);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("rejects a network we do not offer card purchases on", async () => {
      const res = mockResponse();
      await loadHandler()(mockRequest(validBody({ network: "optimism" })), res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/not available/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("rejects a token other than the configured stablecoin", async () => {
      const res = mockResponse();
      await loadHandler()(
        mockRequest(validBody({ cryptoCurrencyCode: "ETH" })),
        res
      );

      expect(res.statusCode).toBe(400);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("rejects a malformed payout address", async () => {
      const handler = loadHandler();

      for (const walletAddress of ["", "not-an-address", "0x1234", DEPOSIT_ADDRESS.slice(0, -1)]) {
        const res = mockResponse();
        await handler(mockRequest(validBody({ walletAddress })), res);
        expect(res.statusCode).toBe(400);
      }

      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("reports a missing configuration as unavailable, not as a bad request", async () => {
      delete process.env.TRANSAK_API_SECRET;
      const res = mockResponse();
      await loadHandler()(mockRequest(validBody()), res);

      expect(res.statusCode).toBe(503);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("accepts a body that arrives as an unparsed JSON string", async () => {
      const res = mockResponse();
      await loadHandler()(mockRequest(JSON.stringify(validBody())), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.widgetUrl).toBe(WIDGET_URL);
    });
  });

  describe("the session it asks the provider for", () => {
    test("locks the payout to the deposit address it was given", async () => {
      const res = mockResponse();
      await loadHandler()(mockRequest(validBody()), res);

      expect(res.statusCode).toBe(200);
      const params = sessionPayload();
      expect(params.walletAddress).toBe(DEPOSIT_ADDRESS);
      expect(params.disableWalletAddressForm).toBe(true);
      expect(params.productsAvailed).toBe("BUY");
      expect(params.cryptoCurrencyCode).toBe("USDC");
      expect(params.network).toBe("base");
    });

    test("omits optional fields the caller did not supply", async () => {
      const res = mockResponse();
      await loadHandler()(mockRequest(validBody()), res);

      const params = sessionPayload();
      expect(params).not.toHaveProperty("fiatAmount");
      expect(params).not.toHaveProperty("fiatCurrency");
      expect(params).not.toHaveProperty("partnerCustomerId");
    });

    test("passes a spend amount through but ignores a nonsensical one", async () => {
      const handler = loadHandler();

      await handler(mockRequest(validBody({ fiatAmount: 250 })), mockResponse());
      expect(sessionPayload().fiatAmount).toBe(250);

      global.fetch.mockClear();
      await handler(mockRequest(validBody({ fiatAmount: -5 })), mockResponse());
      expect(sessionPayload()).not.toHaveProperty("fiatAmount");
    });

    test("uses the configured referrer domain over the request's host header", async () => {
      process.env.TRANSAK_REFERRER_DOMAIN = "https://savings.app";
      const res = mockResponse();
      await loadHandler()(mockRequest(validBody()), res);

      expect(sessionPayload().referrerDomain).toBe("https://savings.app");
    });

    test("forwards the originating user IP for the provider's own checks", async () => {
      await loadHandler()(mockRequest(validBody()), mockResponse());

      const headers = callsTo("auth/session")[0][1].headers;
      expect(headers["x-user-ip"]).toBe("203.0.113.7");
      expect(headers["access-token"]).toBe(ACCESS_TOKEN);
    });

    test("targets staging or production hosts as configured", async () => {
      await loadHandler()(mockRequest(validBody()), mockResponse());
      expect(callsTo("api-gateway-stg.transak.com")).toHaveLength(1);

      process.env.TRANSAK_ENVIRONMENT = "PRODUCTION";
      global.fetch.mockClear();
      await loadHandler()(mockRequest(validBody()), mockResponse());
      expect(callsTo("api-gateway.transak.com")).toHaveLength(1);
    });
  });

  describe("secrecy", () => {
    test("sends the API secret only to the token endpoint", async () => {
      await loadHandler()(mockRequest(validBody()), mockResponse());

      expect(callsTo("refresh-token")[0][1].headers["api-secret"]).toBe(API_SECRET);
      expect(callsTo("auth/session")[0][1].headers).not.toHaveProperty("api-secret");
    });

    test("never returns the secret or the access token to the browser", async () => {
      const res = mockResponse();
      await loadHandler()(mockRequest(validBody()), res);

      expect(JSON.stringify(res.body)).not.toContain(API_SECRET);
      expect(JSON.stringify(res.body)).not.toContain(ACCESS_TOKEN);
      expect(res.body).toEqual({ widgetUrl: WIDGET_URL });
    });

    test("keeps the secret out of the response when the provider fails", async () => {
      mockProvider({
        sessionResponse: {
          ok: false,
          status: 400,
          body: { error: { message: "Unsupported network" } },
        },
      });

      const res = mockResponse();
      await loadHandler()(mockRequest(validBody()), res);

      expect(res.statusCode).toBe(502);
      expect(JSON.stringify(res.body)).not.toContain(API_SECRET);
      expect(res.body.error).toBe("Unsupported network");
    });

    test("does not let a single-use widget URL be cached", async () => {
      const res = mockResponse();
      await loadHandler()(mockRequest(validBody()), res);

      expect(res.headers["Cache-Control"]).toBe("no-store");
    });
  });

  describe("access token handling", () => {
    test("reuses a valid token across purchases", async () => {
      const handler = loadHandler();

      await handler(mockRequest(validBody()), mockResponse());
      await handler(mockRequest(validBody()), mockResponse());

      expect(callsTo("refresh-token")).toHaveLength(1);
      expect(callsTo("auth/session")).toHaveLength(2);
    });

    test("refreshes when the provider reports the token expired already", async () => {
      mockProvider({
        tokenResponse: {
          ok: true,
          body: { data: { accessToken: ACCESS_TOKEN } },
        },
      });
      const handler = loadHandler();

      await handler(mockRequest(validBody()), mockResponse());
      await handler(mockRequest(validBody()), mockResponse());

      // No expiry given means the token is never trusted for a second call
      expect(callsTo("refresh-token")).toHaveLength(2);
    });

    test("drops a rejected token so the next purchase mints a fresh one", async () => {
      mockProvider({
        sessionResponse: {
          ok: false,
          status: 401,
          body: { error: { message: "Invalid or missing access-token." } },
        },
      });
      const handler = loadHandler();

      await handler(mockRequest(validBody()), mockResponse());
      await handler(mockRequest(validBody()), mockResponse());

      expect(callsTo("refresh-token")).toHaveLength(2);
    });

    test("fails clearly when the provider will not issue a token", async () => {
      mockProvider({
        tokenResponse: {
          ok: false,
          body: { error: { message: "Required field is missing" } },
        },
      });

      const res = mockResponse();
      await loadHandler()(mockRequest(validBody()), res);

      expect(res.statusCode).toBe(502);
      expect(callsTo("auth/session")).toHaveLength(0);
    });
  });
});
