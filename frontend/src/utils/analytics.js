// Google Analytics, wired so it can never see a wallet address.
//
// Every address on this chain is public: hand one to an analytics vendor and
// you have joined a person's real balance and full transaction history to
// their IP, device and browsing. That is the opposite of what this wallet
// promises, so the rule is absolute — no address, tx hash or amount ever
// reaches GA, in a URL, an event name or a property.
//
// Two things enforce it:
//
// 1. Load order. The tag used to sit in index.html and fire before React
//    mounted, so a `?ref=<address>` link was reported before anything could
//    scrub it. It now boots from here, after captureReferrerFromUrl() has
//    taken the parameter out of the address bar — which also keeps it out of
//    the `Referer` header GA's own request carries.
// 2. A redacting sanitiser, below, as the backstop for anything that slips
//    into a URL later.

const GA_MEASUREMENT_ID = "G-EZS61DFP72";

// 0x + 40 hex — an EVM address anywhere in the string, path or query alike
const ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}/g;
const REDACTED = "0xREDACTED";

/**
 * The current URL with any wallet address blanked out.
 * @param {string} [href] URL to sanitise; defaults to the current location
 * @returns {string} the URL, safe to report
 */
export const sanitizeAnalyticsUrl = (href) => {
  const raw = href || window.location.href;
  return raw.replace(ADDRESS_PATTERN, REDACTED);
};

/**
 * Loads and configures GA. Safe to call more than once.
 *
 * Google Signals and ad personalisation are both off: they are what would
 * otherwise fold this visit into Google's cross-site advertising profile for
 * the person, which is a heavier trade than page counts are worth here.
 */
export const initAnalytics = () => {
  if (!GA_MEASUREMENT_ID || window.gtag) return;

  window.dataLayer = window.dataLayer || [];
  // GA requires the real `arguments` object here — an arrow function's
  // rest-args array is not the shape gtag.js reads back off dataLayer
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(tag);

  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID, {
    page_location: sanitizeAnalyticsUrl(),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
};
