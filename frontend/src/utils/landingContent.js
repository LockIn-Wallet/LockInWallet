// Copy for the logged-out landing page, kept as data so wording lives in one
// place.
//
// This page is written for somebody who has never held crypto. It makes one
// claim — you choose the limit, and after that nobody can exceed it — shows it
// happening, and asks for a sign-in. Anything that needs prior knowledge to be
// meaningful (chain names, wallet categories, the upgrade model) belongs on
// /how-it-works instead, not here.
//
// Every claim is traceable to SECURITY.md, GOVERNANCE.md or the contracts.
// Nothing on this page may promise a protection the contracts do not enforce.

import { PRIZE_SAVINGS_PATH } from "./prizeSavingsContent.js";
import { HOW_IT_WORKS_PATH } from "./howItWorksContent.js";
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
  { label: "How it works", href: HOW_IT_WORKS_PATH, internal: true },
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
  badge: "SAVINGS THAT PUSH BACK",
  title: "Protect your savings from everyone.",
  titleAccent: "Even yourself.",
  subtitle:
    "You choose how much money can leave, and how often. After that the wallet enforces it — no one can take more, not a thief who has your password, not us, and not you at 2am.",
  primaryCta: "Sign in — it's free",
  secondaryCta: "How it works →",
  secondaryCtaHref: HOW_IT_WORKS_PATH,
  consoleCaption:
    "Nothing here is connected to anything. Watch the wallet refuse a withdrawal that breaks the rules.",
};

// The attack demo, framed as the thing a newcomer actually pictures: someone
// getting into their account. "Private key" is the mechanism, not the fear.
export const BREACH_SECTION = {
  eyebrow: "If someone gets in",
  title: "A stolen password can't empty your wallet",
  lede: "Whoever gets into your account is stuck with the same limit you set. That gap is the time you need to notice and lock them out.",
};

export const HOW_IT_WORKS = [
  {
    title: "Sign in",
    body: "No sign-up form, no email address, no personal details. Nothing about you is stored anywhere.",
  },
  {
    title: "Choose your limits",
    body: "How much can leave per hour, per day, per week — whatever periods suit you, with a cap on each. This is the only real decision.",
  },
  {
    title: "Lock it in",
    body: "Add your money and confirm. From that moment the rules are enforced by the wallet itself, not by your willpower.",
  },
  {
    title: "Spend under the limit",
    body: "Anything within your limits goes through instantly. Anything over waits for the delay you chose — 24 hours at the shortest, up to 3 months — and nobody can shorten it. Not even us.",
  },
];

// The one block on the page written for a sceptic rather than a beginner. It
// exists so that somebody who already holds crypto has a reason to keep
// reading: no adjectives, the remaining trust assumption named out loud, and
// three links straight out of the marketing and into the source.
export const CREDIBILITY = {
  title: "Not a promise. A contract.",
  body: "Every rule above is enforced by open-source code, and we never hold your money. The contracts are upgradeable and we say so plainly — including who can upgrade them today, why that still can't trap your funds, and the fact that nobody has audited them yet.",
  links: [
    { label: "Read the contracts", href: GITHUB_URL, external: true },
    { label: "Security model", href: SECURITY_URL, external: true },
    { label: "The technical version", href: HOW_IT_WORKS_PATH, internal: true },
  ],
};

export const CLOSING = {
  body: "Your limits. Your money. Enforced by code, not by us.",
};

export const FOOTER_COLUMNS = [
  {
    title: "PRODUCT",
    links: [
      { label: "How it works", href: HOW_IT_WORKS_PATH, internal: true },
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
