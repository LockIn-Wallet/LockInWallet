// Copy for the logged-out landing page, kept as data so wording lives in one
// place.
//
// This page is written for somebody who has never held crypto. It makes one
// claim — you choose the limit, and after that nobody can exceed it — shows it
// happening, and asks for a sign-in. Anything that needs prior knowledge to be
// meaningful (chain names, wallet categories, the upgrade model) belongs on
// /security instead, not here.
//
// Every claim is traceable to SECURITY.md, GOVERNANCE.md or the contracts.
// Nothing on this page may promise a protection the contracts do not enforce.

import { PRIZE_SAVINGS_PATH } from "./prizeSavingsContent.js";
import { SECURITY_PATH } from "./securityContent.js";
import { isPrizePoolEnabled } from "./featureFlags.js";
import { GITHUB_URL, SECURITY_URL, CHANGELOG_URL, DISCORD_URL } from "./siteLinks.js";

export {
  GITHUB_URL,
  SECURITY_URL,
  GOVERNANCE_DOC_URL,
  CHANGELOG_URL,
  DISCORD_URL,
} from "./siteLinks.js";

export const NAV_LINKS = [
  { label: "Security", href: SECURITY_PATH, internal: true },
  {
    label: "Prize pool",
    href: PRIZE_SAVINGS_PATH,
    internal: true,
    flag: isPrizePoolEnabled,
  },
  { label: "Governance", href: "/governance", internal: true },
];

// The whole proposition, in the words somebody uses before they know any of
// ours. "On-chain" appears nowhere above the fold on purpose.
export const HERO = {
  badge: "SAVINGS NOBODY CAN TAKE",
  title: "Protect your savings from everyone.",
  titleAccent: "Even yourself.",
  subtitle:
    "You set how much can leave, and how often. Nobody can take more — not a thief with your password, not us, not you.",
  primaryCta: "Sign in — it's free",
  secondaryCta: "How it's enforced →",
  secondaryCtaHref: SECURITY_PATH,
  consoleCaption: "A demo. Watch the wallet refuse a withdrawal over the limit.",
};

// "Password" rather than "private key": the key is the mechanism, the fear is
// somebody else reaching your money. The precise term is on /security.
export const BREACH_SECTION = {
  eyebrow: "If someone gets in",
  title: "A stolen password can't empty your wallet",
  lede: "A thief is stuck with the limit you set. That gap is your time to notice and lock them out.",
};

export const HOW_IT_WORKS = [
  {
    title: "Sign in",
    body: "No sign-up form, no personal details, nothing to install.",
  },
  {
    title: "Choose your limits",
    body: "How much can leave per hour, per day, per week. The only real decision you make.",
  },
  {
    title: "Lock it in",
    body: "Add your money and confirm. From here the wallet enforces the rules, not your willpower.",
  },
  {
    title: "Spend under the limit",
    body: "Under the limit, instant. Over it, waits the delay you chose — 24 hours to 3 months. Nobody can shorten it.",
  },
];

// The one block written for a sceptic rather than a beginner: no adjectives,
// the remaining trust assumption named, and links out to the source.
export const CREDIBILITY = {
  title: "Not a promise. A contract.",
  body: "Open-source code enforces every rule above, and we never hold your money. The contracts are upgradeable and nobody has audited them yet. Who can upgrade them, and why that still can't trap your funds, is written out in full.",
  links: [
    { label: "Read the contracts", href: GITHUB_URL, external: true },
    { label: "Security model", href: SECURITY_URL, external: true },
    { label: "The technical version", href: SECURITY_PATH, internal: true },
  ],
};

export const CLOSING = {
  body: "Your limits. Your money. Enforced by code.",
};

export const FOOTER_COLUMNS = [
  {
    title: "PRODUCT",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Security", href: SECURITY_PATH, internal: true },
      { label: "Savings visualiser", href: "/savings-visualiser", internal: true },
      { label: "How signing in works", href: "/signing-in", internal: true },
    ],
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
