import { ethers } from "ethers";

/**
 * Referral capture service.
 *
 * A referral link looks like https://<app>/?ref=<referrer wallet address>.
 * The referrer is captured on app load (before any wallet is connected, hence
 * a global, non-wallet-suffixed key), persisted until the user locks in their
 * wallet, and recorded on-chain as part of the setup commit transaction.
 */

const PENDING_REFERRER_KEY = "pending_referrer";
const REF_QUERY_PARAM = "ref";

/**
 * Removes ?ref= from the address bar without reloading or adding history.
 *
 * The referrer is a real wallet address, and the chain is public: anyone who
 * reads that address can read that person's balance and whole history. Left in
 * the URL it reaches analytics, the `Referer` header of every third-party
 * request, bookmarks and shared links. It is captured to localStorage first,
 * so dropping it costs nothing.
 */
function stripReferrerFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(REF_QUERY_PARAM)) return;

  url.searchParams.delete(REF_QUERY_PARAM);
  const query = url.searchParams.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${query ? `?${query}` : ""}${url.hash}`
  );
}

/**
 * Reads ?ref= from the current URL and persists it as the pending referrer,
 * then scrubs the parameter from the address bar.
 * First capture wins: an already-stored valid referrer is never overwritten,
 * so an in-progress signup can't be hijacked by a later link click.
 * @returns {string|null} The pending referrer address after capture
 */
export function captureReferrerFromUrl() {
  const ref = new URLSearchParams(window.location.search).get(REF_QUERY_PARAM);
  if (ref && ethers.isAddress(ref) && !getPendingReferrer()) {
    localStorage.setItem(
      PENDING_REFERRER_KEY,
      JSON.stringify({ address: ethers.getAddress(ref), capturedAt: Date.now() })
    );
  }
  stripReferrerFromUrl();
  return getPendingReferrer();
}

/**
 * @returns {string|null} The stored pending referrer address, if valid
 */
export function getPendingReferrer() {
  try {
    const stored = JSON.parse(localStorage.getItem(PENDING_REFERRER_KEY));
    return stored && ethers.isAddress(stored.address) ? stored.address : null;
  } catch {
    return null;
  }
}

/**
 * Pending referrer usable by the given wallet — filters out self-referrals.
 * A missing or non-string wallet means the address isn't known yet, so the
 * self-check is skipped here; the adapter and the contract both reject
 * self-referral before anything is recorded.
 * @param {string|null} walletAddress The connected wallet address
 * @returns {string|null}
 */
export function getPendingReferrerFor(walletAddress) {
  const referrer = getPendingReferrer();
  if (!referrer) return null;
  if (
    typeof walletAddress === "string" &&
    referrer.toLowerCase() === walletAddress.toLowerCase()
  ) {
    return null;
  }
  return referrer;
}

export function clearPendingReferrer() {
  localStorage.removeItem(PENDING_REFERRER_KEY);
}

/**
 * Builds the shareable referral link for a user.
 * @param {string} address The referrer's wallet address
 * @returns {string} e.g. https://app.example.com/?ref=0x1234...
 */
export function buildReferralLink(address) {
  return `${window.location.origin}/?${REF_QUERY_PARAM}=${address}`;
}
