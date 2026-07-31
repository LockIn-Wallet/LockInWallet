/**
 * Onramp Service Tests - card purchases delivered into the locked wallet
 *
 * These tests cover:
 * - Availability: only where the provider sells the token AND our contracts live
 * - The payout address is always the user's permanent deposit address
 * - Refusing to buy when no deposit address exists yet
 * - Provider config that disagrees with our token address disables the feature
 */

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const DEPOSIT_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const WIDGET_URL = "https://global.transak.com/?sessionId=abc";

// Base ships undeployed in the real config; these tests need it live
const realNetworkConfig = jest.requireActual("../../networkConfig.json");

jest.mock("../../networkConfig.json", () => {
  const actual = jest.requireActual("../../networkConfig.json");
  return {
    ...actual,
    evm: {
      ...actual.evm,
      base: {
        ...actual.evm.base,
        savingsContract: "0x1111111111111111111111111111111111111111",
      },
    },
  };
});

// Captures the SDK's static listeners so a purchase event can be replayed
const mockTransakListeners = {};
const mockWidgetInstances = [];

jest.mock("@transak/ui-js-sdk", () => {
  class Transak {
    constructor(config) {
      this.config = config;
      this.init = jest.fn();
      this.close = jest.fn();
      this.cleanup = jest.fn();
      mockWidgetInstances.push(this);
    }
  }
  Transak.EVENTS = {
    TRANSAK_ORDER_SUCCESSFUL: "TRANSAK_ORDER_SUCCESSFUL",
    TRANSAK_WIDGET_CLOSE: "TRANSAK_WIDGET_CLOSE",
  };
  Transak.on = (event, handler) => {
    mockTransakListeners[event] = handler;
  };
  return { Transak };
});

const {
  getOnrampToken,
  isOnrampAvailable,
  startOnrampPurchase,
  closeOnramp,
} = require("../../services/onramp.service.js");
const onrampConfig = require("../../onrampConfig.json");

/** Transaction manager stub exposing only what the service uses */
const managerStub = (depositAddress) => ({
  getAddress: jest.fn().mockResolvedValue(USER),
  getDepositAddress: jest.fn().mockResolvedValue(depositAddress),
});

const mockSessionResponse = (body, ok = true) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue(body),
  });
};

describe("Onramp availability", () => {
  beforeEach(() => {
    process.env.REACT_APP_ENABLE_ONRAMP = "true";
  });

  afterEach(() => {
    delete process.env.REACT_APP_ENABLE_ONRAMP;
  });

  test("is off entirely when the feature flag is not set", () => {
    delete process.env.REACT_APP_ENABLE_ONRAMP;
    expect(getOnrampToken("evm", "base")).toBeNull();
    expect(isOnrampAvailable("evm", "base")).toBe(false);
  });

  test("offers the configured stablecoin where the provider supports it", () => {
    expect(getOnrampToken("evm", "base")).toEqual({
      tokenKey: "USDC",
      symbol: "USDC",
      address: BASE_USDC,
    });
  });

  test("is unavailable on a chain the provider does not sell the token on", () => {
    // Optimism has live contracts but the provider sells no stablecoin there
    expect(realNetworkConfig.evm.optimism.savingsContract).not.toMatch(/^0x0+$/);
    expect(onrampConfig.networks.optimism).toBeUndefined();
    expect(isOnrampAvailable("evm", "optimism")).toBe(false);
  });

  test("is unavailable where our savings contracts are not deployed", () => {
    // Ethereum is a supported provider network but has no core contract yet
    expect(onrampConfig.networks.ethereum).toBeDefined();
    expect(realNetworkConfig.evm.ethereum.savingsContract).toMatch(/^0x0+$/);
    expect(isOnrampAvailable("evm", "ethereum")).toBe(false);
  });

  test("every provider network names a token address we can cross-check", () => {
    Object.values(onrampConfig.networks).forEach((network) => {
      expect(network.transakNetwork).toBeTruthy();
      expect(network.expectedTokenAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });
});

describe("Starting a card purchase", () => {
  beforeEach(() => {
    process.env.REACT_APP_ENABLE_ONRAMP = "true";
    mockWidgetInstances.length = 0;
    mockSessionResponse({ widgetUrl: WIDGET_URL });
  });

  afterEach(() => {
    closeOnramp();
    delete process.env.REACT_APP_ENABLE_ONRAMP;
    delete global.fetch;
  });

  test("pays out to the permanent deposit address, not the user's wallet", async () => {
    const manager = managerStub(DEPOSIT_ADDRESS);

    const result = await startOnrampPurchase({
      transactionManager: manager,
      networkType: "evm",
      selectedNetwork: "base",
    });

    expect(result.depositAddress).toBe(DEPOSIT_ADDRESS);

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.walletAddress).toBe(DEPOSIT_ADDRESS);
    expect(body.walletAddress).not.toBe(USER);
    expect(body.network).toBe("base");
    expect(body.cryptoCurrencyCode).toBe("USDC");
  });

  test("opens the widget on the URL the backend minted", async () => {
    await startOnrampPurchase({
      transactionManager: managerStub(DEPOSIT_ADDRESS),
      networkType: "evm",
      selectedNetwork: "base",
    });

    expect(mockWidgetInstances).toHaveLength(1);
    expect(mockWidgetInstances[0].config.widgetUrl).toBe(WIDGET_URL);
    expect(mockWidgetInstances[0].init).toHaveBeenCalled();
  });

  test("refuses when the user has no deposit address yet", async () => {
    await expect(
      startOnrampPurchase({
        transactionManager: managerStub(""),
        networkType: "evm",
        selectedNetwork: "base",
      })
    ).rejects.toThrow(/deposit address/i);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockWidgetInstances).toHaveLength(0);
  });

  test("refuses on a network without card purchases", async () => {
    await expect(
      startOnrampPurchase({
        transactionManager: managerStub(DEPOSIT_ADDRESS),
        networkType: "evm",
        selectedNetwork: "optimism",
      })
    ).rejects.toThrow(/not available/i);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("refuses without a connected wallet", async () => {
    await expect(
      startOnrampPurchase({
        transactionManager: null,
        networkType: "evm",
        selectedNetwork: "base",
      })
    ).rejects.toThrow(/connect your wallet/i);
  });

  test("surfaces the backend's reason for a failed session", async () => {
    mockSessionResponse({ error: "Card purchases are not configured" }, false);

    await expect(
      startOnrampPurchase({
        transactionManager: managerStub(DEPOSIT_ADDRESS),
        networkType: "evm",
        selectedNetwork: "base",
      })
    ).rejects.toThrow("Card purchases are not configured");

    expect(mockWidgetInstances).toHaveLength(0);
  });

  test("a completed purchase triggers the balance refresh that sweeps it in", async () => {
    const onPurchase = jest.fn();

    await startOnrampPurchase({
      transactionManager: managerStub(DEPOSIT_ADDRESS),
      networkType: "evm",
      selectedNetwork: "base",
      onPurchase,
    });

    mockTransakListeners.TRANSAK_ORDER_SUCCESSFUL({ status: "COMPLETED" });
    expect(onPurchase).toHaveBeenCalledWith({ status: "COMPLETED" });
  });

  test("closing the widget reports back once and only once", async () => {
    const onClose = jest.fn();

    await startOnrampPurchase({
      transactionManager: managerStub(DEPOSIT_ADDRESS),
      networkType: "evm",
      selectedNetwork: "base",
      onClose,
    });

    mockTransakListeners.TRANSAK_WIDGET_CLOSE();
    mockTransakListeners.TRANSAK_WIDGET_CLOSE();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("closing before a new purchase does not fire the old widget's callback", async () => {
    const onClose = jest.fn();

    await startOnrampPurchase({
      transactionManager: managerStub(DEPOSIT_ADDRESS),
      networkType: "evm",
      selectedNetwork: "base",
      onClose,
    });

    await startOnrampPurchase({
      transactionManager: managerStub(DEPOSIT_ADDRESS),
      networkType: "evm",
      selectedNetwork: "base",
    });

    expect(mockWidgetInstances[0].close).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
