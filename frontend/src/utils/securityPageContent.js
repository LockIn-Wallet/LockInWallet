// Copy for /security — the page that holds every implementation and security
// detail the home page no longer carries. Written for someone who wants to
// check the claims, so every answer says where to look.

import { absoluteUrl, buildFaqJsonLd } from "./seo.js";

export const SECURITY_PAGE_PATH = "/security";

export const SECURITY_HERO = {
  eyebrow: "Security & technology",
  title: "How the lock actually works",
  lede: "The home page tells you what the wallet does. This page tells you how, which network it runs on, what happens when something goes wrong, and exactly what we can and cannot do to your savings.",
};

export const SECURITY_CONSOLE = {
  eyebrow: "Watch it refuse",
  title: "The rules run on-chain, not in the app",
  lede: "Below is a live simulation of the contract handling withdrawals: within the limit they clear, above it they queue for the delay you set. Closing this website changes none of it.",
};

export const SECURITY_ATTACK = {
  eyebrow: "What a leaked key costs you",
  title: "A stolen key can't empty your wallet",
  lede: "Your limit is the attacker's limit too. That gap is the time you need to notice and take the account back.",
};

export const SECURITY_CHAINS = {
  eyebrow: "Chains",
  title: "Live on Base and Optimism, with Ethereum underway",
  lede: "Cheap, fast transactions matter here: an hourly limit only makes sense if using it doesn't cost a fortune in gas.",
};

// Every answer here is traceable to SECURITY.md or the contracts.
export const SECURITY_FAQ = [
  {
    question: "What is a smart contract, in this context?",
    answer:
      "A program that lives on a public network and holds your savings. Its rules — your limits, your waits, your exit — are executed by thousands of independent computers rather than by our servers, so nobody can quietly change how it behaves for you. The source is on GitHub and the deployed code can be compared against it.",
  },
  {
    question: "Which network are my savings on?",
    answer:
      "Base or Optimism, both Ethereum layer 2s. They settle onto Ethereum, so they inherit its security, while a transaction costs cents instead of dollars. New wallets start on Base because a bank card can buy dollars there directly. Ethereum mainnet support is underway for larger balances.",
  },
  {
    question: "Are the limits really enforced, or just displayed?",
    answer:
      "Enforced. Withdrawals above your allowance are refused by the contract itself, not hidden by the interface. A withdrawal above the limit becomes a public proposal that can only execute after the delay you set, and you can cancel it at any point before then.",
  },
  {
    question: "What happens if my key is stolen?",
    answer:
      "The thief is bound by the same limits you are. They can take your allowance and no more, and anything above it queues for your delay in plain view. If you registered a cold recovery key, you can freeze the account instantly and move everything to a fresh address. Without one, the delay is still your window to withdraw the rest first.",
  },
  {
    question: "Can you change the contracts?",
    answer:
      "Yes, and we say so on this page rather than in a footnote. The contracts are upgradeable so that bugs can be fixed. Upgrades are executed by a single maintainer key today; there is no multisig yet. A governance layer puts every upgrade in a public 48-hour timelock, twice the 24-hour minimum exit delay, so a queued change always leaves you time to leave first.",
  },
  {
    question: "Has the code been audited?",
    answer:
      "No. There has been no third-party audit yet, and we will not imply otherwise. What you have instead is public source, verified deployments, and an exit that nobody can lengthen. Treat it accordingly and start with an amount you are comfortable with.",
  },
  {
    question: "How is a locked vault different from a spend-limit vault?",
    answer:
      "A spend-limit vault lives in our upgradeable modules and always keeps an exit for you. A locked vault is a separate, tiny contract deployed per lock with no owner functions and no upgrade switch. It releases everything to its owner when its rule is met — a date, or a price with a deadline behind it — and cannot be opened early by anyone, us included. Its rule contract must come from our factory to count as verified, so nobody can pass off a switch they control as a lock.",
  },
  {
    question: "Where does the money sit when I sign in with email?",
    answer:
      "In a smart-contract wallet created for you by Coinbase's sign-in service, with the signing key held on your device or in secure hardware. We never hold it. The trade-off is that Coinbase sees sign-in requests and, on the email path, your email address. The signing-in page covers this in full.",
  },
];

export const SECURITY_PAGE_SEO = {
  title: "Security & Technology — How LockIn Wallet Enforces Limits | LockIn Wallet",
  description:
    "How LockIn Wallet enforces withdrawal limits on-chain: which networks it runs on, what a stolen key can and cannot do, the emergency exit, upgrade rules, and what we can and cannot change.",
  path: SECURITY_PAGE_PATH,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl(SECURITY_PAGE_PATH),
        url: absoluteUrl(SECURITY_PAGE_PATH),
        name: SECURITY_HERO.title,
        description: SECURITY_HERO.lede,
      },
      buildFaqJsonLd(SECURITY_FAQ),
    ],
  },
};
