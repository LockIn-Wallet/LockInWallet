/**
 * Copy for the earning feature, kept out of the components so the wording can
 * change without touching layout — the same split as walletOnboardingContent.
 *
 * Two rules the wording here has to keep:
 * - never imply the yield is risk-free. Funds sit in a third-party lending
 *   protocol, and that is a real risk the user is entitled to know about.
 * - never quote a variable rate as if it were fixed.
 */

export const YIELD_SECTION_TITLE = "Earn on your savings";

export const YIELD_LEDE =
  "Your locked savings can earn interest while they sit. You choose how, you can " +
  "switch it off whenever you like, and nothing moves until your next deposit.";

/** Shown against every option, so the fee is never a surprise. */
export const YIELD_FEE_NOTE =
  "We keep one percentage point of the rate — and never more than what your savings " +
  "actually earned. A month that earns nothing costs you nothing. Your deposit is " +
  "never the source of our fee.";

export const YIELD_RISK_NOTE =
  "Earning means your balance is supplied to an outside lending protocol. That is " +
  "not risk-free: if the protocol suffers losses, so could your savings. Switching " +
  "earning off returns everything to your vault.";

export const YIELD_APY_CAVEAT =
  "Rates are variable and set by the protocol, not by us. They change constantly.";

export const YIELD_OFF_REASSURANCE =
  "Your savings sit still in your vault. No outside protocol touches them.";

export const YIELD_MODAL_EYEBROW = "Earning";
export const YIELD_MODAL_TITLE = "How should your savings earn?";

/**
 * The three options, in the order they are offered. `requiresPrizePool` marks
 * the ones gated behind the prize-pool feature flag.
 */
export const YIELD_OPTIONS = [
  {
    key: "stable",
    title: "Stable earning",
    badge: "Recommended",
    blurb:
      "Your balance earns interest on Aave, one of the largest and longest-running " +
      "lending protocols on this network.",
    detail: "Withdraw any time, under your usual spending limits.",
    requiresPrizePool: false,
  },
  {
    key: "prize",
    title: "Prize savings",
    badge: "Coming soon",
    // Deliberately not "a lower steady rate": a prize vault pays no steady rate
    // at all. Every bit of the interest funds the draw, so most months pay
    // nothing. Saying otherwise would set up exactly the wrong expectation.
    blurb:
      "Your interest funds a shared prize draw instead of landing in your balance. " +
      "Your deposit is never at stake — but most months you win nothing, and " +
      "occasionally you win a lot.",
    detail: "Prizes are shared across everyone saving this way.",
    requiresPrizePool: true,
  },
  {
    key: "off",
    title: "No earning",
    badge: null,
    blurb: YIELD_OFF_REASSURANCE,
    detail: "Nothing leaves your vault, and no rate applies.",
    requiresPrizePool: false,
  },
];

/** Short label for the current setting, shown on the collapsed section. */
export const YIELD_MODE_LABELS = {
  stable: "Stable earning",
  prize: "Prize savings",
  off: "Not earning",
};
