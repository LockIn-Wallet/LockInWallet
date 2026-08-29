// Copy for the security page (/security) — the landing page's one claim taken
// apart, for a reader who wants the mechanism rather than the promise.
//
// Deliberately not /how-it-works: that URL already serves a static beginner's
// guide (public/how-it-works.html) and Vercel's cleanUrls makes the file win
// over any route we declare here.
//
// Every claim is traceable to SECURITY.md, GOVERNANCE.md or the contracts.
// Nothing here may promise a protection the contracts do not enforce.

import { buildFaqJsonLd, absoluteUrl } from "./seo.js";

export const SECURITY_PATH = "/security";

export const SECURITY_HERO = {
  eyebrow: "The technical version",
  title: "How the limit is actually enforced",
  lede: "What the contracts do, what they cannot do, and what you still trust us with.",
};

// The mechanism in the order it runs. No metaphors here — the landing page
// has those, and this reader knows what a contract call is.
export const MECHANISM_STEPS = [
  {
    title: "Your limits live in the contract, not the interface",
    body: "A limit is a period and a cap — $200 an hour, $1,000 a day — stored on-chain against your vault. Nothing in this website can change one. The interface only asks; the contract only answers to you.",
  },
  {
    title: "Every withdrawal is checked against every active period",
    body: "A withdrawal is charged against every period at once, so the tightest one binds. $900 that fits your daily cap but not your hourly one does not execute. No ordering trick, no batching trick, no path around the check.",
  },
  {
    title: "Going over is possible, and it is slow on purpose",
    body: "You can always take more than your limit — otherwise this would be a way to lose your own money. Going over opens a request that sits in public for the delay you chose: 24 hours to 3 months, fixed when you set the limit. Nobody can lengthen it, including us. Nobody can shorten it, including you.",
  },
  {
    title: "A cold recovery key outranks a stolen seed",
    body: "Register an offline recovery key in advance and a leaked seed stops being fatal. Freezing is instant. Moving the account to a fresh address is the recovery key's alone — not your everyday key's, and not ours.",
  },
];

// Three facts a reader can check for themselves, stated without adjectives.
// Only the one carrying the core guarantee takes the accent.
export const PROOF_POINTS = [
  {
    label: "SOURCE CODE",
    value: "100% public",
    accent: false,
    note: "Every contract that governs your vault is on GitHub.",
  },
  {
    label: "TIME TO EXIT",
    value: "24h–3 months",
    accent: true,
    note: "You set the wait when you set the limit. The emergency bypass gets you fully out in exactly that time, and nobody can extend it.",
  },
  {
    label: "LIVE ON",
    value: "Base & Optimism",
    accent: false,
    note: "Both settle onto Ethereum, so they inherit its security at cents per transaction. New wallets start on Base, where a bank card can buy dollars directly.",
  },
];

// Useless to anyone who does not already know what the columns mean, which is
// why it left the landing page. Categories first, then the table.
export const COMPARISON_INTRO = {
  eyebrow: "Compare",
  title: "Not all wallets protect you the same way",
  lede: "A custodial exchange account means a company holds the money and you hold a login — until it freezes, fails, or somebody talks its support desk into a password reset. A hot wallet holds a key on your device: genuinely yours, and gone in one transaction if that key leaks.",
};

export const COMPARISON_COLUMNS = [
  { key: "lockin", label: "LockIn Wallet", ours: true },
  { key: "custodial", label: "Custodial exchange account" },
  { key: "hot", label: "Standard hot wallet" },
];

export const COMPARISON_ROWS = [
  {
    label: "Source code you can read",
    lockin: "Yes",
    custodial: "No",
    hot: "Varies",
  },
  {
    label: "Drained instantly if your key leaks",
    lockin: "No — capped at your limit",
    custodial: "Yes, if your account is taken",
    hot: "Yes",
    negativeFor: ["custodial", "hot"],
  },
  {
    label: "Withdrawal limits enforced on-chain",
    lockin: "Yes",
    custodial: "Set by the platform",
    hot: "No",
  },
  {
    label: "Someone else holds your funds",
    lockin: "No — self-custody",
    custodial: "Yes",
    hot: "No",
    negativeFor: ["custodial"],
  },
  {
    label: "Protects you from your own 2am decision",
    lockin: "Yes",
    custodial: "No",
    hot: "No",
  },
  {
    label: "Recovery after your seed phrase leaks",
    lockin: "Cold recovery key",
    custodial: "Support ticket",
    hot: "None",
  },
];

// Each card states a protection that is live on-chain today, in the same terms
// SECURITY.md uses. No claim of audits — there have been none.
export const TRUST_POINTS = [
  {
    icon: "code",
    title: "Open source, end to end",
    body: "Every line that governs your vault is public. Read it, fork it, or have someone you trust review it.",
  },
  {
    icon: "clock",
    title: "You can always leave, on your own clock",
    body: "Whatever happens — including an upgrade you disagree with — you can start withdrawing everything immediately. The wait is the one you chose, 24 hours to 3 months, and nobody can lengthen it.",
  },
  {
    icon: "lock",
    title: "Self-custody, always",
    body: "Your funds sit in a contract you control, not an account we hold. Nobody can freeze, seize or lose them on your behalf.",
  },
  {
    icon: "key",
    title: "A cold key that outranks a stolen seed",
    body: "Register one in advance and a leaked seed stops being fatal. Freezing is instant; moving the account is the recovery key's alone.",
  },
];

// The upgrade story on the page rather than buried in a doc.
// Mirrors SECURITY.md § "Upgrade trust model".
export const UPGRADE_DISCLOSURE = {
  eyebrow: "STATED PLAINLY",
  title: "What we can still do, and why it can't hurt you",
  body: "The contracts are upgradeable — that is what lets bugs get fixed. Today a single maintainer key executes upgrades: no multisig, no third-party audit. A governance layer is rolling out that puts every upgrade in a public 48-hour timelock, twice the 24-hour bypass, so a queued change always leaves you time to exit first.",
  linkLabel: "Read the full trust model",
};

export const CHAIN_INTRO = {
  eyebrow: "Chains",
  title: "Live on Base and Optimism",
  // The cards below make the gas argument; this says what a layer 2 is.
  lede: "Both are Ethereum layer 2s: they settle onto Ethereum itself, so your funds inherit its security at cents per transaction.",
};

export const SECURITY_FAQ = [
  {
    question: "Can LockIn Wallet move my money?",
    answer:
      "No. Your funds sit in a vault contract only your keys can withdraw from, and every withdrawal still has to pass your own limits. There is no admin function that moves user funds.",
  },
  {
    question: "What happens if someone steals my key?",
    answer:
      "They are bound by the limits you set. Instead of losing everything in one transaction you lose at most one period's cap, and a registered recovery key lets you freeze the account and move it to a fresh address — which the thief cannot do.",
  },
  {
    question: "Can I get my money out in an emergency?",
    answer:
      "Yes, always. The emergency bypass lets you start withdrawing everything at any time. It takes the delay you chose — 24 hours to 3 months — and nobody can extend it, including us.",
  },
  {
    question: "Who can change the limits I set?",
    answer:
      "Only you. Raising a limit is itself subject to the waiting period, so a stolen key cannot lift the cap and drain the vault. Lowering one takes effect immediately — tightening your own protection is never the dangerous direction.",
  },
  {
    question: "Are the contracts audited?",
    answer:
      "No third-party audit, and we would rather say so than imply otherwise. The code is public, and the emergency bypass means you can always exit on a clock nobody else controls — that is the protection we can guarantee today.",
  },
  {
    question: "Who can upgrade the contracts?",
    answer:
      "Today a single maintainer key does, with no multisig. A governance layer is rolling out that puts every upgrade behind a public 48-hour timelock, twice the 24-hour bypass, so a queued change always leaves you time to withdraw first.",
  },
];

export const SECURITY_SEO = {
  title: "Security — How LockIn Wallet Enforces Your Limits | LockIn Wallet",
  description:
    "How LockIn Wallet enforces withdrawal limits on-chain, why going over takes a delay nobody can shorten, how a cold recovery key beats a stolen seed, and exactly what you still trust us with.",
  path: SECURITY_PATH,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl(SECURITY_PATH),
        url: absoluteUrl(SECURITY_PATH),
        name: SECURITY_HERO.title,
        description: SECURITY_HERO.lede,
        isPartOf: {
          "@type": "WebSite",
          name: "LockIn Wallet",
          url: absoluteUrl("/"),
        },
      },
      buildFaqJsonLd(SECURITY_FAQ),
    ],
  },
};
