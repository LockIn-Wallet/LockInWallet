// Copy for the logged-out landing page, kept as data so wording lives in one
// place. Every claim here is traceable to SECURITY.md, GOVERNANCE.md or the
// contracts — see the note on each block. Nothing on this page may promise a
// protection the contracts do not enforce.
//
// This page is written for someone who has never held crypto. Crypto-native
// vocabulary (chains, keys, contracts, custody) lives on /crypto — see
// cryptoContent.js — and is deliberately absent here.

import { buildFaqJsonLd, absoluteUrl } from "./seo.js";

export const GITHUB_URL = "https://github.com/LockIn-Wallet/LockInWallet";
export const SECURITY_URL = `${GITHUB_URL}/blob/main/SECURITY.md`;
export const GOVERNANCE_DOC_URL = `${GITHUB_URL}/blob/main/GOVERNANCE.md`;
export const CHANGELOG_URL = `${GITHUB_URL}/blob/main/CHANGELOG.md`;
export const DISCORD_URL = "https://discord.gg/ZjYQjZX5XS";

// Defined here rather than in cryptoContent.js so this file never imports
// from it — cryptoContent.js imports the URLs above, and a cycle between the
// two copy files would be easy to create by accident.
export const CRYPTO_PATH = "/crypto";

export const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Where your money is", href: "#security" },
  { label: "FAQ", href: "#faq" },
  { label: "For crypto users", href: CRYPTO_PATH, internal: true },
];

// The mechanic in one screen: an allowance that clears instantly, and a wait
// on everything else. "Announced" is the plain-language name for the bypass
// request, which is public on the network (BypassSystemModule).
export const HERO = {
  badge: "SAVINGS THAT MAKE YOU WAIT",
  titleStart: "Money you can't touch",
  titleAccent: "until you say so.",
  subtitle:
    "Give yourself an allowance and pick a waiting period. Your allowance " +
    "reaches you instantly. Everything above it has to be announced first " +
    "and then wait — a day, a week, up to three months — and there's no one " +
    "to call to skip the wait. That's the whole point.",
  ctaPrimary: "Start saving — it's free",
  ctaSecondary: "See how it works",
  note: "Sign in with your email or a fingerprint. No fees, any amount.",
};

// Interactive preview: pure client-side arithmetic, no sign-in, no network.
export const PREVIEW = {
  label: "TRY THE RULES · NOTHING IS REAL YET",
  amountLabel: "Money to protect",
  allowanceLabel: "Your weekly allowance",
  waitLabel: "Anything more waits",
  defaultAmount: 2000,
  defaultAllowance: 50,
  waitOptions: [
    { label: "24 hours", value: "24 hours" },
    { label: "3 days", value: "3 days" },
    { label: "a week", value: "a week" },
    { label: "a month", value: "a month" },
    { label: "3 months", value: "3 months" },
  ],
  cta: "Lock these rules in",
};

export const PROBLEM = {
  eyebrow: "Why this exists",
  title: "Every savings tool has an unlock button.",
  paragraphs: [
    "Your savings account moves money back in seconds. Budgeting apps let " +
      "you pause the rule. The bank will break your CD if you call and " +
      "accept a penalty. At 2am, when you've talked yourself into it, " +
      "that's the button you press.",
    "LockIn doesn't remove your money — it removes the moment. Spending " +
      "past your allowance means announcing it first and then waiting out " +
      "the delay you chose. At 2am the answer isn't yes; it's “come " +
      "back tomorrow.” And tomorrow-you gets the final say. You set " +
      "it up knowing that — and that's why it works.",
  ],
};

export const HOW_IT_WORKS = [
  {
    title: "Choose your allowance",
    body: "How much of your money can reach you per day, week, or month. You pick the numbers, and anything inside them is yours instantly, any time.",
  },
  {
    title: "Choose the wait",
    body: "Anything above the allowance has to wait — 24 hours at the shortest, up to three months. You pick this too, and once it's set nobody can change it behind your back. Not us. Not someone holding your phone. Not 2am-you.",
  },
  {
    title: "Lock it in",
    body: "Put money in and commit. From then on the rules run on their own — add more whenever you like, spend inside the allowance freely, and let everything bigger announce itself and wait.",
  },
];

// The everyday comparison. The LockIn row must stay honest: early access
// exists — it is the emergency bypass — so the claim is that nothing makes
// the clock run faster, not that there is no way out.
export const LOCKED_COMPARISON = {
  eyebrow: "Locked means locked",
  title: "What “locked” means here, versus everywhere else",
  question: "Can you get it early?",
  rows: [
    { label: "Savings account", answer: "Yes — instant transfer" },
    { label: "Budgeting app", answer: "Yes — pause the rule" },
    {
      label: "Certificate of deposit",
      answer: "Yes — call the bank, pay a penalty",
    },
    {
      label: "Someone you trust holds it",
      answer: "Yes — if you ask hard enough",
    },
    {
      label: "LockIn",
      answer:
        "Only after the wait you chose. Announcing it is the only way in, and nothing makes the clock run faster — not for you, not for us.",
      ours: true,
    },
  ],
  caption:
    "If that sounds scary, start small: an allowance you'd be comfortable living on, and a wait you could sit out in a real emergency. The point is that it works — not that it's strict.",
};

// "Where your money actually is" — the plain-language trust section. Each
// point maps to something the contracts enforce (SECURITY.md): self-custody,
// the rate limit + delay hitting a thief too, and no deposit insurance.
export const MONEY_SECTION = {
  eyebrow: "Where your money actually is",
  title: "We couldn't touch it if we wanted to",
  intro:
    "Your money is held as digital dollars — digital versions of ordinary " +
    "dollars, issued one-for-one against real ones by regulated companies — " +
    "inside a program on a public network. The program follows written " +
    "rules, the rules are published for anyone to read, and the money sits " +
    "in an account only you control. It never passes through us at all.",
  points: [
    {
      icon: "lock",
      title: "We don't hold your money",
      body: "We can't freeze it, borrow it, spend it, or hand it to anyone. It isn't in an account of ours — there is nothing on our side to take.",
    },
    {
      icon: "clock",
      title: "A thief moves at your speed",
      body: "Someone who steals your login gets your allowance, not your balance. Everything else makes them announce it and wait, in the open — time for you to notice, and, with a recovery key you set up in advance, to lock them out and move everything to safety.",
    },
    {
      icon: "shield",
      title: "It's not a bank",
      body: "It isn't government-insured, and it never lends your money out behind your back. It's a program that does one thing — follow the rules you set, without exceptions.",
    },
    {
      icon: "code",
      title: "Nothing here asks for your faith",
      body: "The rules are open source: anyone can read exactly what the program can and can't do, and anyone can check that this page tells the truth about it.",
    },
  ],
  cryptoLink: "Want the technical version? Read how it works under the hood",
};

// The honest version of the upgrade story, stated on the page rather than
// buried in a doc. Mirrors SECURITY.md § "Upgrade trust model" — the review
// delay is rolling out, not live, and the copy must keep saying so.
export const UPGRADE_DISCLOSURE = {
  eyebrow: "STATED PLAINLY",
  title: "What we can still do, and why it can't trap you",
  body: "The program is updatable — that's how bugs get fixed — and today updates are made with a single maintainer's key; there is no committee yet. A public review system is rolling out that shows every planned update at least 48 hours before it can happen. And whatever happens, the exit is yours: you can always start withdrawing everything, and nobody — including us — can lengthen the wait you chose.",
  linkLabel: "Read the full security model",
};

// Optional growth. The fee facts come from YieldModule/VaultYieldModule: up
// to 1%/yr, accrued only against money that is actually earning and
// collectable only out of realized surplus — never principal. Earning is off
// by default. No rate is quoted here; the app shows the live one.
export const GROWTH = {
  eyebrow: "Optional",
  title: "Let it grow while it's out of reach",
  intro:
    "Growing is off until you turn it on, and turning it on never changes " +
    "when money can reach you. Two options, both fine:",
  options: [
    {
      title: "Just save it",
      body: "Your $500 stays $500, ready the moment your rules allow it. No fees. Nothing else happens.",
    },
    {
      title: "Let it grow",
      body: "Your money earns interest from a public lending market — the kind where savers' deposits fund borrowers who pay interest. We charge up to 1% a year, and it only ever comes out of what your money earned. If it earns nothing, we take nothing.",
    },
  ],
  caption:
    "The exact rate moves with the market and is shown in the app before you decide. Which market, and how the fee is enforced, is on the crypto page.",
};

export const WHO_ITS_FOR = {
  eyebrow: "Who this is for",
  title: "Three people who already know why",
  cards: [
    {
      title: "“I keep spending money I meant to save.”",
      body: "Move it in the moment it lands. If it isn't reachable, it doesn't get spent — and the allowance means you're never locked out of your own life.",
    },
    {
      title: "“I need it out of reach — for real.”",
      body: "If you're stepping back from gambling or a habit that costs money, rules nobody can talk you out of are a different kind of tool. LockIn is one part of a plan, not a replacement for support.",
      link: { label: "Resources", href: "/gambling-help" },
    },
    {
      title: "“I'm saving for something and I know myself.”",
      body: "A deposit, a trip, a buffer. Set an allowance of zero and a long wait, and stop negotiating with yourself in between.",
    },
  ],
};

// Six questions on the page; each answer must stand on its own as a search
// result, and none may promise more than the contracts do.
export const HOME_FAQ = [
  {
    question: "What if I really need the money early?",
    answer:
      "Money inside your allowance is always yours, instantly. For anything more, you announce it and wait out the delay you chose — 24 hours at the shortest — and nothing makes that faster. So choose a wait you could genuinely sit out in an emergency, and start small. You can always add more; you can never skip the clock.",
  },
  {
    question: "Can LockIn unlock it faster if I explain?",
    answer:
      "No. There is no button on our side either. That isn't a policy we could bend if you asked nicely — the program doesn't have the feature, and because it's open source, you can check that for yourself.",
  },
  {
    question: "What if I lose access to my login?",
    answer:
      "You sign in through Coinbase with a passkey or a code sent to your email — keep either one working and a new phone just means signing in again. For the worst case, you can register a recovery key in advance and keep it offline: it can freeze the account and move your savings to a fresh start even if your everyday login is stolen. There's a plain-words page about exactly how signing in works.",
  },
  {
    question: "Is this a bank?",
    answer:
      "No. Your money is held as digital dollars in a program we don't control, and it isn't government-insured. We never hold it, which is also why we can't freeze it or open it early — see “Where your money actually is” above.",
  },
  {
    question: "Does it cost anything?",
    answer:
      "We charge nothing to sign up, put money in, hold it, or take it out. The public network the program runs on charges its own small fee per action, usually cents. If you turn on the optional growth, we charge up to 1% a year, taken only out of what your money earns — never out of your money.",
  },
  {
    question: "Why is crypto involved at all?",
    answer:
      "Because it's the only technology where money can follow rules that no one — including the company that wrote them — can quietly override. You don't need to own or understand crypto to use LockIn. If you do, there's a page written for you.",
  },
];

export const CLOSING = {
  title: "Lock in the first $20 and see how it feels.",
  body: "Sign in with your email. Two minutes, no fees, and the rules are yours.",
};

export const FOOTER_BLURB =
  "Savings with an allowance you choose and a wait nobody can skip — kept " +
  "by open-source code, not by good intentions.";

// Rendered after "© {year} LockIn Wallet." — the one place the full brand
// name appears on the main page.
export const FOOTER_LEGAL =
  "Software, not a bank or a financial adviser. Money is held as digital " +
  "dollars in an open-source program on a public network and is not " +
  "government-insured.";

// Anchor links are plain "/#…" hrefs rather than router links so they work
// identically from this page (same-document jump) and from /crypto (loads
// the home page at the anchor).
export const FOOTER_COLUMNS = [
  {
    title: "PRODUCT",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Where your money is", href: "/#security" },
      { label: "FAQ", href: "/#faq" },
      { label: "Savings visualiser", href: "/savings-visualiser", internal: true },
      { label: "How signing in works", href: "/signing-in", internal: true },
      { label: "For crypto users", href: CRYPTO_PATH, internal: true },
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

export const HOME_SEO = {
  title: "Money You Can't Touch Until You Say So | LockIn",
  description:
    "Give yourself an allowance and a waiting period. Anything above the allowance has to be announced and wait — a day to three months — and no one can skip the wait. Sign in with your email. Free to start, any amount.",
  path: "/",
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl("/"),
        url: absoluteUrl("/"),
        name: "Money you can't touch until you say so",
        description:
          "Every savings tool has an unlock button. This one makes you wait.",
        isPartOf: {
          "@type": "WebSite",
          name: "LockIn Wallet",
          url: absoluteUrl("/"),
        },
      },
      buildFaqJsonLd(HOME_FAQ),
    ],
  },
};
