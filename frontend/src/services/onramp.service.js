import { Transak } from "@transak/ui-js-sdk";
import networkConfig from "../networkConfig.json";
import onrampConfig from "../onrampConfig.json";
import { isOnrampEnabled } from "../utils/featureFlags.js";
import { isNetworkDeployed } from "../utils/networkFilter.js";

/**
 * Card-to-savings on-ramp.
 *
 * A card purchase pays out to the user's permanent deposit address rather than
 * to their own wallet, so bought funds land inside the locked savings wallet and
 * are subject to the same spending limits as everything else. The payout address
 * is fixed server-side, so the purchase cannot be redirected to a spendable
 * wallet from the browser.
 *
 * The provider only sells the stablecoin on some of the chains we support, so
 * availability is a lookup in onrampConfig.json rather than a hardcoded chain.
 */

const SESSION_ENDPOINT = "/api/transak/session";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const WIDGET_SIZE = { widgetWidth: "100%", widgetHeight: "700px" };

// The SDK's listeners are static and cannot be removed, so they are registered
// once here and dispatched to whichever purchase is currently open
let activeSession = null;

// Availability is checked on every render, so a config mismatch is reported once
// rather than on a loop
const reportedMismatches = new Set();

/**
 * The token a card purchase would deliver on the given network, or null when
 * the provider does not sell it there.
 *
 * Cross-checks the provider's token address against our own network config: if
 * the two ever disagree the purchase would deliver a token the contracts do not
 * sweep, stranding the funds, so that config mismatch disables the feature
 * instead of silently losing money.
 *
 * @param {string} networkType "evm" or "solana"
 * @param {string} selectedNetwork Network key, e.g. "base"
 * @returns {{tokenKey: string, symbol: string, address: string}|null}
 */
export const getOnrampToken = (networkType, selectedNetwork) => {
  if (!isOnrampEnabled()) return null;

  const provider = onrampConfig.networks[selectedNetwork];
  if (!provider) return null;

  // Nothing to buy into on a chain where the savings contracts are not live
  if (!isNetworkDeployed(networkType, selectedNetwork)) return null;

  const token =
    networkConfig[networkType]?.[selectedNetwork]?.tokens?.[onrampConfig.tokenKey];
  if (!token?.address || token.address === ZERO_ADDRESS) return null;

  if (
    token.address.toLowerCase() !== provider.expectedTokenAddress.toLowerCase()
  ) {
    if (!reportedMismatches.has(selectedNetwork)) {
      reportedMismatches.add(selectedNetwork);
      console.error(
        `On-ramp disabled on ${selectedNetwork}: ${onrampConfig.tokenKey} is ` +
          `${token.address} in networkConfig but the provider delivers ` +
          `${provider.expectedTokenAddress}`,
      );
    }
    return null;
  }

  return {
    tokenKey: onrampConfig.tokenKey,
    symbol: token.symbol,
    address: token.address,
  };
};

/**
 * Whether card purchases can be offered on the given network.
 * @param {string} networkType "evm" or "solana"
 * @param {string} selectedNetwork Network key
 * @returns {boolean}
 */
export const isOnrampAvailable = (networkType, selectedNetwork) =>
  getOnrampToken(networkType, selectedNetwork) !== null;

/**
 * Asks the backend for a single-use widget URL for this purchase.
 * @param {{selectedNetwork: string, walletAddress: string, fiatAmount: number|undefined, partnerCustomerId: string|undefined}} params
 * @returns {Promise<string>} The widget URL
 */
const requestWidgetUrl = async ({
  selectedNetwork,
  walletAddress,
  fiatAmount,
  partnerCustomerId,
}) => {
  const response = await fetch(SESSION_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      network: selectedNetwork,
      cryptoCurrencyCode: onrampConfig.cryptoCurrencyCode,
      walletAddress,
      fiatAmount,
      partnerCustomerId,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || !body.widgetUrl) {
    throw new Error(body.error || "Could not start the purchase. Please try again.");
  }

  return body.widgetUrl;
};

/**
 * Closes whichever purchase widget is open, if any.
 */
export const closeOnramp = () => {
  if (!activeSession) return;
  const { widget } = activeSession;
  activeSession = null;
  widget.close();
};

Transak.on(Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL, (order) => {
  // Bought funds arrive at the deposit address; the balance refresh sweeps them
  // into savings
  activeSession?.onPurchase?.(order);
});

Transak.on(Transak.EVENTS.TRANSAK_WIDGET_CLOSE, () => {
  const session = activeSession;
  activeSession = null;
  session?.onClose?.();
});

/**
 * Opens the card-purchase widget, paying out into the user's locked deposit
 * address. Resolves once the widget is on screen.
 *
 * @param {object} params
 * @param {object} params.transactionManager Connected transaction manager
 * @param {string} params.networkType "evm" or "solana"
 * @param {string} params.selectedNetwork Network key
 * @param {number} [params.fiatAmount] Amount the user wants to spend
 * @param {Function} [params.onPurchase] Called when the purchase completes
 * @param {Function} [params.onClose] Called when the widget closes
 * @returns {Promise<{depositAddress: string}>}
 */
export const startOnrampPurchase = async ({
  transactionManager,
  networkType,
  selectedNetwork,
  fiatAmount,
  onPurchase,
  onClose,
}) => {
  const token = getOnrampToken(networkType, selectedNetwork);
  if (!token) {
    throw new Error("Card purchases are not available on this network");
  }

  if (!transactionManager) {
    throw new Error("Please connect your wallet first");
  }

  const userAddress = await transactionManager.getAddress();
  const depositAddress = await transactionManager.getDepositAddress(userAddress);

  if (!depositAddress || depositAddress === ZERO_ADDRESS) {
    throw new Error(
      "Your deposit address isn't ready yet. Generate it first, then buy.",
    );
  }

  const widgetUrl = await requestWidgetUrl({
    selectedNetwork,
    walletAddress: depositAddress,
    fiatAmount,
    // Lets the provider's dashboard tie an order back to a wallet during support
    partnerCustomerId: userAddress,
  });

  closeOnramp();

  const widget = new Transak({ widgetUrl, ...WIDGET_SIZE });
  activeSession = { widget, onPurchase, onClose };
  widget.init();

  return { depositAddress };
};
