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
    // Two things this wording has to get right: a prize vault pays no steady
    // rate at all (every bit of the interest funds the draw), and each member
    // has their own entry rather than a share of a pooled one.
    blurb:
      "Your interest funds a shared prize draw instead of landing in your balance. " +
      "Your deposit is never at stake — but most months you win nothing, and " +
      "occasionally you win a lot.",
    detail: "You get your own entry, so anything you win is yours alone.",
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

/**
 * Shown on the legacy "Savings" account, which is not a vault: on EVM, locking
 * in writes spending limits and holds the balance in the core contract, so
 * there is no vault for earning to attach to.
 */
export const YIELD_NO_VAULT_NOTE =
  "Earning works on vaults. Your first Savings account isn't one — it was created " +
  "when you locked in, and its balance is held directly by the wallet contract. " +
  "Create a vault, or pick an existing one above, and its balance can start earning.";

/** Shown for a vault whose token has no strategy (ETH, or an unlisted token). */
export const YIELD_TOKEN_UNSUPPORTED_NOTE =
  "This vault's token can't earn yet. Earning is available on supported " +
  "stablecoins — a vault holding one of those can start earning straight away.";

/** The fee note for prize savings — a different fee from the stable one. */
export const YIELD_PRIZE_FEE_NOTE =
  "A prize vault pays no interest of its own, so there is no rate to charge on. " +
  "We keep a small share of anything you actually win, and nothing at all if you " +
  "never win. Your deposit is never touched.";

/** Shown above the claim button when a member has won something. */
export const YIELD_PRIZE_WON_NOTE =
  "Prizes are paid in the prize token, not the token you saved — so they arrive " +
  "separately rather than being added to your balance.";

/**
 * The earning switch that sits under the balance.
 *
 * Deliberately quieter than the panel below it: this is the everyday control,
 * so it states the rate and the one thing people worry about — that they can
 * still get their money — and leaves the explaining to the panel.
 */
export const BALANCE_EARNING = {
  toggleLabel: "Earn interest on your savings",
  on: (rate) => (rate ? `Earning ${rate.toFixed(2)}% a year` : "Earning"),
  off: (rate) => (rate ? `Earn ${rate.toFixed(2)}% a year` : "Earn interest"),
  mixed: "Earning on some of your coins",
  onDetail: "Through Aave. Withdraw any time, under your usual limits.",
  offDetail: "Your savings sit still. Switch this on to put them to work.",
};
