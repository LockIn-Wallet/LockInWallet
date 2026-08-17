// Copy for the technical page (/how-it-works).
//
// The landing page states one thing — your limit is the limit, for everybody —
// and nothing else. This page is where that claim is taken apart for the reader
// who wants the mechanism: someone comparing wallets, someone who already holds
// crypto, or someone who simply does not take a landing page at its word.
//
// Every claim here is traceable to SECURITY.md, GOVERNANCE.md or the contracts.
// Nothing on this page may promise a protection the contracts do not enforce.

import { buildFaqJsonLd, absoluteUrl } from "./seo.js";

export const HOW_IT_WORKS_PATH = "/how-it-works";

export const HOW_IT_WORKS_HERO = {
  eyebrow: "The technical version",
  title: "How the limit is actually enforced",
  lede: "The short version is on the home page: you set a limit and nothing can exceed it. This is the long version — what the contracts do, what they cannot do, and what you are still trusting us with.",
};

// The mechanism in the order it runs, written so it survives a reader who does
// know what a contract call is. No metaphors here; the landing page has those.
export const MECHANISM_STEPS = [
  {
    title: "Your limits live in the contract, not the interface",
    body: "A limit is a period and a cap — $200 an hour, $1,000 a day, whatever you name. They are stored on-chain against your vault. Nothing in this website can change them; the interface only ever asks the contract, and the contract only ever answers to you.",
  },
  {
    title: "Every withdrawal is checked against every active period",
    body: "A withdrawal is charged against all of your periods at once, so the tightest one is the real constraint. If a $900 withdrawal fits your daily cap but not your hourly one, it does not execute. There is no ordering trick, no batching trick, and no path through the interface that skips the check.",
  },
  {
    title: "Going over is possible, and it is slow on purpose",
    body: "You can always take more than your limit — otherwise this would be a way to lose your own money. Exceeding a limit opens a request that sits in public for the delay you chose when you set that limit: 24 hours at the shortest, up to 3 months. The delay is fixed at that moment. Nobody can lengthen it afterwards, including us, and nobody can shorten it, including you.",
  },
  {
    title: "A cold recovery key outranks a stolen seed",
    body: "Register an offline recovery key in advance and a leaked seed stops being fatal. Freezing the account is instant. Moving it to a fresh address is the recovery key's alone — a thief holding your everyday key cannot do it, and neither can we.",
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
    note: "You set the wait when you set each limit. The emergency bypass then gets you completely out in exactly that time — nobody can extend it.",
  },
  {
    label: "LIVE ON",
    value: "Base & Optimism",
    accent: false,
    note: "Both are Ethereum layer 2s: they settle onto Ethereum itself, so they inherit its security, but a transaction costs cents instead of dollars. New wallets start on Base, where a bank card can buy dollars directly.",
  },
];

// The comparison is useless to anyone who does not already know what the
// columns mean, which is exactly why it left the landing page. Define the
// categories first, then show the table.
export const COMPARISON_INTRO = {
  eyebrow: "Compare",
  title: "Not all wallets protect you the same way",
  lede: "Two things you are being compared against. A custodial exchange account is one where a company holds the money for you and you hold a login — convenient, until the company freezes, fails, or somebody talks their support desk into a password reset. A standard hot wallet is software holding a key on your device: genuinely yours, and gone in one transaction the moment that key leaks.",
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
    body: "Every line that governs your vault is public. Read it yourself, fork it, or have someone you trust review it — you never have to take our word for it.",
  },
  {
    icon: "clock",
    title: "You can always leave, on your own clock",
    body: "The emergency bypass is the cornerstone: whatever happens — including an upgrade you disagree with — you can start withdrawing everything immediately. The wait is the one you chose for that limit, anywhere from 24 hours to 3 months, and nobody can lengthen it afterwards.",
  },
  {
    icon: "lock",
    title: "Self-custody, always",
    body: "Your funds sit in a contract you control, not an account we hold. Nobody can freeze them, seize them, or lose them on your behalf.",
  },
  {
    icon: "key",
    title: "A cold key that outranks a stolen seed",
    body: "Register an offline recovery key in advance and a leaked seed stops being fatal. Freezing is instant; moving the account to a fresh address is the recovery key's alone.",
  },
];

// The honest version of the upgrade story, stated on the page rather than
// buried in a doc. Mirrors SECURITY.md § "Upgrade trust model".
export const UPGRADE_DISCLOSURE = {
  eyebrow: "STATED PLAINLY",
  title: "What we can still do, and why it can't hurt you",
  body: "The contracts are upgradeable — that's what lets bugs get fixed. Today upgrades are executed by a single maintainer key; there is no multisig yet, and there has been no third-party audit. An on-chain governance layer is rolling out that puts every upgrade in a public 48-hour timelock, and we hold the delay at twice the 24-hour bypass, so seeing a queued change always leaves you time to exit first.",
  linkLabel: "Read the full trust model",
};

export const CHAIN_INTRO = {
  eyebrow: "Chains",
  title: "Live on Base and Optimism",
  // The card grid below already makes the gas argument — this says what a
  // layer 2 is, which is the part a newcomer to the ecosystem is missing.
  lede: "Both are Ethereum layer 2s: they settle onto Ethereum itself, so your funds inherit its security while a transaction costs cents instead of dollars.",
};

export const HOW_IT_WORKS_FAQ = [
  {
    question: "Can LockIn Wallet move my money?",
    answer:
      "No. Your funds sit in a vault contract that only your keys can withdraw from, and every withdrawal still has to pass your own limits. We hold no custody and there is no admin function that transfers user funds.",
  },
  {
    question: "What happens if someone steals my key?",
    answer:
      "They are bound by exactly the limits you set. Instead of losing everything in one transaction, you lose at most one period's cap while you notice and react — and a registered recovery key lets you freeze the account instantly and move it to a fresh address, which the thief cannot do.",
  },
  {
    question: "Can I get my money out in an emergency?",
    answer:
      "Yes, always. The emergency bypass lets you start withdrawing everything at any time. It takes the delay you chose when you set that limit — between 24 hours and 3 months — and that delay cannot be extended by anyone, including us.",
  },
  {
    question: "Who can change the limits I set?",
    answer:
      "Only you, and raising a limit is itself subject to the waiting period, so a stolen key cannot simply lift the cap and drain the vault. Lowering a limit takes effect immediately, because tightening your own protection is never the dangerous direction.",
  },
  {
    question: "Are the contracts audited?",
    answer:
      "No. There has been no third-party audit, and we say so rather than implying otherwise. The code is fully public and the emergency bypass means you can always exit on a clock nobody else controls, which is the protection we can actually guarantee today.",
  },
  {
    question: "Who can upgrade the contracts?",
    answer:
      "Today, a single maintainer key executes upgrades; there is no multisig yet. An on-chain governance layer is rolling out that puts every upgrade behind a public 48-hour timelock, held at twice the 24-hour emergency bypass so that a queued change always leaves you time to withdraw first.",
  },
];

export const HOW_IT_WORKS_SEO = {
  title: "How It Works — On-Chain Withdrawal Limits Explained | LockIn Wallet",
  description:
    "The mechanism behind LockIn Wallet: how withdrawal limits are enforced on-chain, why exceeding one takes a delay nobody can shorten, how a cold recovery key beats a stolen seed, and exactly what you still trust us with.",
  path: HOW_IT_WORKS_PATH,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl(HOW_IT_WORKS_PATH),
        url: absoluteUrl(HOW_IT_WORKS_PATH),
        name: HOW_IT_WORKS_HERO.title,
        description: HOW_IT_WORKS_HERO.lede,
        isPartOf: {
          "@type": "WebSite",
          name: "LockIn Wallet",
          url: absoluteUrl("/"),
        },
      },
      buildFaqJsonLd(HOW_IT_WORKS_FAQ),
    ],
  },
};
