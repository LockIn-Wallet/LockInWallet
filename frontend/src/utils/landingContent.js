// Copy for the logged-out landing page, kept as data so wording lives in one
// place. Every claim here is traceable to SECURITY.md, GOVERNANCE.md or the
// contracts — see the note on each block. Nothing on this page may promise a
// protection the contracts do not enforce.
//
// The home page is written for someone who has never held crypto and is
// searching for "a savings account you can't withdraw from". Everything about
// chains, keys, upgrades and timelocks lives on /security instead, so the
// blocks below are split by which page they belong to.

import { PRIZE_SAVINGS_PATH } from "./prizeSavingsContent.js";
import { SECURITY_PAGE_PATH } from "./securityPageContent.js";
import { PROOF_OF_LOCK_PATH } from "./lockContent.js";
import { isPrizePoolEnabled } from "./featureFlags.js";

export const GITHUB_URL = "https://github.com/LockIn-Wallet/LockInWallet";
export const SECURITY_URL = `${GITHUB_URL}/blob/main/SECURITY.md`;
export const GOVERNANCE_DOC_URL = `${GITHUB_URL}/blob/main/GOVERNANCE.md`;
export const CHANGELOG_URL = `${GITHUB_URL}/blob/main/CHANGELOG.md`;
export const DISCORD_URL = "https://discord.gg/ZjYQjZX5XS";

// Long-form guides served as static HTML from frontend/public. They are plain
// anchors, not router routes: Vercel serves the file before the SPA rewrite.
export const BEGINNER_GUIDE_PATH = "/how-it-works";

export const GUIDE_LINKS = [
  { label: "Stop impulse spending", href: "/impulse-spending" },
  { label: "Stop impulse buying", href: "/impulse-buying" },
  { label: "Stop impulse shopping", href: "/impulse-shopping" },
  { label: "Account you can't withdraw from", href: "/no-withdrawal-account" },
  { label: "Money in addiction recovery", href: "/addiction-recovery" },
  { label: "Gambling help", href: "/gambling-help" },
];

export const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Who it's for", href: "#who-its-for" },
  { label: "Security", href: SECURITY_PAGE_PATH, internal: true },
  { label: "For creators", href: PROOF_OF_LOCK_PATH, internal: true },
  {
    label: "Prize pool",
    href: PRIZE_SAVINGS_PATH,
    internal: true,
    flag: isPrizePoolEnabled,
  },
  { label: "Governance", href: "/governance", internal: true },
];

// ---- Home page ----------------------------------------------------------

// The headline answers the search that brings most people here. The lede
// says what the product does in one breath and nothing about how.
export const HOME_HERO = {
  badge: "A SAVING CRYPTO WALLET WITH A TIME LOCK ON IT",
  title: "A savings account",
  accent: "you can't withdraw from.",
  lede: "Put money in. Decide today how much you can take out per day, week or month. Anything more has to wait — and you pick the wait, from 24 hours to 3 months. There is no bank to phone and no button to override it.",
  primaryCta: "Start saving — it's free",
  secondaryCta: "See how it works",
};

// What the wallet does, in the order a person meets it. Every line is a
// behaviour the contract enforces (TimePeriodLimits, ProposalSystem, BypassSystem).
export const HOME_PROMISES = [
  {
    emoji: "🎯",
    title: "Spend limit: you set the allowance",
    text: "Choose how much you can take out each day, week or month. That amount is always yours, instantly. Anything more waits for a delay you chose in advance, 24 hours at the shortest.",
  },
  {
    emoji: "🔐",
    title: "Full lock: nothing moves until the date",
    text: "Or lock any coin completely until a date you pick, or until a price is reached. No allowance, no emergency exit, no exceptions. It opens when the rule is met and not before.",
  },
  {
    emoji: "🚫",
    title: "Nobody can shortcut either",
    text: "Not us, not a support line, and not you on a bad evening. The rules run on a public network rather than on a company's server, so there is nobody to talk into an exception.",
  },
];

// Each card leads to the long-form guide for that search intent.
export const HOME_USE_CASES = [
  {
    icon: "sliders",
    title: "You keep raiding your own savings",
    body: "Savings that are one tap away are not really saved. An allowance you set in advance gives you a spending budget and a locked pot in the same place.",
    linkLabel: "How to stop impulse spending",
    href: "/impulse-spending",
  },
  {
    icon: "clock",
    title: "You buy first and regret it later",
    body: "Late-night carts, flash sales, one-click checkout. A built-in waiting period beats willpower because it works when your willpower is already gone.",
    linkLabel: "How to stop impulse buying",
    href: "/impulse-buying",
  },
  {
    icon: "lock",
    title: "You need money kept out of reach",
    body: "Recovery from gambling or a shopping habit, a deposit you must not touch, a windfall you want to keep. Some money should be hard to get at, on purpose.",
    linkLabel: "Accounts you can't withdraw from",
    href: "/no-withdrawal-account",
  },
];

export const HOW_IT_WORKS = [
  {
    title: "Sign in",
    body: "Use your email, or your face or fingerprint. Nothing to install, no seed phrase to write down. If you already use a crypto wallet, connect that instead.",
  },
  {
    title: "Set your allowance",
    body: "Pick a daily, weekly or monthly amount you can always take out, and how long anything above it has to wait.",
  },
  {
    title: "Lock it in",
    body: "Deposit and commit. From that moment the rules are enforced for you, not by you.",
  },
  {
    title: "Live under the limit",
    body: "Anything within your allowance arrives instantly. Anything over it waits for the time you chose, in plain sight, where you can cancel it.",
  },
];

// Plain answers for a reader who has never held crypto. Anything technical
// points at /security rather than being explained here.
export const HOME_FAQ = [
  {
    question: "Do I need to understand crypto to use this?",
    answer:
      "No. You sign in with your email or a fingerprint, and you can put money in with a bank card. Your savings are held as digital dollars, so the price does not swing around. You never have to see a seed phrase or buy a coin.",
  },
  {
    question: "Is my money stuck?",
    answer:
      "Only if you asked for that. With a spend limit your allowance is always available, instantly, and everything above it is available after the wait you chose — 24 hours at the shortest, 3 months at the longest. With a full lock nothing moves until the date or price you set. Nobody, including us, can lengthen either.",
  },
  {
    question: "Who holds my money?",
    answer:
      "You do. It sits in an account that only you control, on a public network, not in an account at a company. There is no bank, no balance sheet, and no one who can freeze it or lose it on your behalf.",
  },
  {
    question: "What if I need all of it in an emergency?",
    answer:
      "With a spend limit, press the emergency exit: your whole balance starts leaving after the wait you set, and no one can stop or extend it. A full lock has no emergency exit at all — that is what makes it a lock — so only lock what you can do without until the date.",
  },
  {
    question: "What does it cost?",
    answer:
      "Nothing to sign up and nothing per month. We cover the small network fees when you sign in with email or a passkey. If you bring your own crypto wallet, you pay those fees yourself, which is usually a few cents.",
  },
  {
    question: "Is this a bank?",
    answer:
      "No. It is software you run for yourself, and the code is public. Deposits are not insured by any government scheme. If you want to know exactly what protects your money and what does not, the security page says so plainly.",
  },
];

export const HOME_DETAILS_TEASER = {
  eyebrow: "For the curious",
  title: "Want to know what's under the hood?",
  lede: "Which network it runs on, what happens if your key is stolen, what we can and cannot change, and how to check it all yourself.",
  linkLabel: "Read the security and technology page",
};

// ---- Security page (/security) -------------------------------------------

// Three facts, each one checkable by the reader. Deliberately not "zero admin
// keys" — upgrades run from a maintainer key today (SECURITY.md), and the real
// protection is the exit asymmetry, which is both true and stronger.
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

// Wallet categories, not named products — the footnote on the table says so.
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
    body: "For spend-limit vaults the emergency bypass is the cornerstone: whatever happens — including an upgrade you disagree with — you can start withdrawing everything immediately. The wait is the one you chose for that limit, anywhere from 24 hours to 3 months, and nobody can lengthen it afterwards. Locked vaults are the deliberate exception: they have no exit until their rule is met, and no upgrade path either, so there is nothing to escape from.",
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
  body: "The contracts are upgradeable — that's what lets bugs get fixed. Today upgrades are executed by a single maintainer key; there is no multisig yet. An on-chain governance layer is rolling out that puts every upgrade in a public 48-hour timelock, and we hold the delay at twice the 24-hour bypass, so seeing a queued change always leaves you time to exit first.",
  linkLabel: "Read the full trust model",
};

// ---- Footer ---------------------------------------------------------------

export const FOOTER_COLUMNS = [
  {
    title: "PRODUCT",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Security & technology", href: SECURITY_PAGE_PATH, internal: true },
      { label: "Proof of lock for creators", href: PROOF_OF_LOCK_PATH, internal: true },
      { label: "Beginner's guide", href: BEGINNER_GUIDE_PATH },
      { label: "Savings visualiser", href: "/savings-visualiser", internal: true },
      { label: "How signing in works", href: "/signing-in", internal: true },
    ],
  },
  {
    title: "GUIDES",
    links: GUIDE_LINKS,
  },
  {
    title: "VERIFY",
    links: [
      { label: "Source code", href: GITHUB_URL, external: true },
      { label: "Security model", href: SECURITY_URL, external: true },
      { label: "Governance", href: "/governance", internal: true },
      { label: "Changelog", href: CHANGELOG_URL, external: true },
    ],
  },
  {
    title: "COMMUNITY",
    links: [{ label: "Discord", href: DISCORD_URL, external: true }],
  },
];
