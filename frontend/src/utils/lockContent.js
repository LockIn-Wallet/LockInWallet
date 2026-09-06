// Copy for locked vaults: the dashboard section, the confirmation before a
// lock is created, the public proof page, and the creators landing page.
// Every sentence describes what LockedVault.sol actually does.

import { absoluteUrl, buildFaqJsonLd } from "./seo.js";

export const LOCKS_SECTION_TITLE = "Locked vaults";

export const LOCKS_LEDE =
  "A locked vault holds any coin and releases all of it to you when its rule is met: a date, or a price with a latest date behind it. Until then nothing can move it — not you, not us, not an emergency. Each lock is its own small contract with no upgrade switch, so it sits outside anything we can change.";

export const LOCK_CONFIRMATION =
  "Nothing in this vault can be withdrawn before its rule is met. Not by you, not by us, and not in an emergency. There is no penalty exit and no bypass. If you lose access to your wallet, the coins release to that wallet's address, nowhere else. Anyone can send coins to a lock, and every deposit is locked on the same terms.";

export const LOCK_NO_FUNDS_NOTE =
  "Create the lock first, then send coins to its address or use the deposit button. The address is deterministic, so you can share it before funding it.";

export const PROOF_GUARANTEES = [
  {
    title: "No one can change it",
    text: "The vault is a standalone contract with no owner functions and no upgrade path.",
  },
  {
    title: "The rule is fixed",
    text: "Its rule and deadline are set at creation and cannot be changed by anyone.",
  },
  {
    title: "It only ever pays the owner",
    text: "Everything it holds releases only to the owner address, and only once the rule is met.",
  },
  {
    title: "It is public",
    text: "Anyone can read the balance and the rule on-chain at any time.",
  },
];

export const PROOF_UNVERIFIED_WARNING =
  "This lock's rule was not created by the LockIn factory, or it watches a price feed this app does not recognise. Read the rule's contract before trusting it.";

// ---- Creators page (/proof-of-lock) ----

export const PROOF_OF_LOCK_PATH = "/proof-of-lock";

export const PROOF_OF_LOCK_HERO = {
  eyebrow: "For creators and teams",
  title: "Prove your tokens are locked",
  lede: "Lock any amount of any coin in a contract nobody can open early, including you, and share one link that shows your audience the rule, the balance, and the date. No spreadsheet, no promise, no trust required.",
};

export const PROOF_OF_LOCK_STEPS = [
  {
    emoji: "🔐",
    title: "Create a lock",
    text: "Pick the coin, choose when it opens — a date, or a price target with a latest date behind it — and create the lock. The address is known before you fund it.",
  },
  {
    emoji: "📥",
    title: "Send the tokens",
    text: "Deposit from your wallet, or send straight to the lock's address from anywhere. Every deposit is locked on the same terms, whoever sent it.",
  },
  {
    emoji: "🔗",
    title: "Share the proof",
    text: "Your lock has a public page anyone can open without a wallet. It shows the owner, the rule, the balance and the deadline, read live from the chain.",
  },
];

export const PROOF_OF_LOCK_FAQ = [
  {
    question: "Can I withdraw early if I really need to?",
    answer:
      "No. That is the whole point of the proof. There is no penalty exit, no bypass and no support line. The lock opens when its rule is met and on its deadline at the latest, and not one minute before.",
  },
  {
    question: "Can LockIn open it, or change the rule?",
    answer:
      "No. Each lock is its own contract with no upgrade switch and no admin functions. Our other contracts are upgradeable through a public timelock; locks deliberately are not, so a compromised key on our side cannot touch them.",
  },
  {
    question: "What does the public page prove?",
    answer:
      "That these tokens, in this contract, cannot move until this rule is met, and that the rule was created by our factory rather than by a contract you control. It does not prove you hold nothing else, so show your audience the locked amount next to the total supply.",
  },
  {
    question: "What if the price feed breaks?",
    answer:
      "Every lock has a deadline. If a price feed goes stale or disappears, the lock simply stays closed until the deadline and opens then. Funds can be delayed by a broken feed, never lost to one.",
  },
  {
    question: "Which coins can I lock?",
    answer:
      "Any ERC20 token and the network's native coin. Locks run on Base and Optimism today.",
  },
  {
    question: "Is there a fee?",
    answer:
      "No fee from us. You pay the network's own transaction cost to create the lock and to deposit, which is cents on Base and Optimism.",
  },
];

export const PROOF_OF_LOCK_SEO = {
  title: "Proof of Lock — Lock Tokens Publicly Until a Date or Price | LockIn Wallet",
  description:
    "Lock any token in a contract nobody can open early, including you, and share a public proof page showing the rule, balance and deadline. For creators, teams and anyone who needs to show their tokens cannot move.",
  path: PROOF_OF_LOCK_PATH,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl(PROOF_OF_LOCK_PATH),
        url: absoluteUrl(PROOF_OF_LOCK_PATH),
        name: PROOF_OF_LOCK_HERO.title,
        description: PROOF_OF_LOCK_HERO.lede,
      },
      buildFaqJsonLd(PROOF_OF_LOCK_FAQ),
    ],
  },
};
