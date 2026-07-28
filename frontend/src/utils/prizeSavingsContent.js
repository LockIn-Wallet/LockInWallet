// Copy and structured data for the no-loss prize savings page (/prize-savings).
// Kept out of the component so the page reads as layout and the wording — which
// is also what search engines index — lives in one editable place.

import { buildFaqJsonLd, absoluteUrl } from "./seo.js";

export const PRIZE_SAVINGS_PATH = "/prize-savings";

export const PRIZE_HERO = {
  eyebrow: "Optional add-on",
  title: "No-loss prize pool: win prizes without risking your savings",
  lede: "LockIn Wallet lets you opt in to a no-loss prize pool. Your locked deposit joins a shared pool, the pool's interest is paid out as prizes, and your deposit stays yours the whole time. Win and you gain; don't win and you lose nothing.",
};

// The three steps of the mechanism, in the order a new saver meets them
export const HOW_IT_WORKS_STEPS = [
  {
    emoji: "🔒",
    text: "Lock your savings, then opt in to the prize pool with one click.",
  },
  {
    emoji: "🌱",
    text: "Pooled deposits earn yield. The yield — not your money — becomes the prizes.",
  },
  {
    emoji: "🎉",
    text: "Winners are drawn hourly, daily and weekly. Don't win? You lose nothing.",
  },
];

// Written as questions people actually type, and answered in full sentences so
// each answer stands on its own as a search result.
export const PRIZE_FAQ = [
  {
    question: "What is a no-loss prize pool?",
    answer:
      "A no-loss prize pool is a savings lottery where the ticket is free. Deposits are pooled and earn interest, and that interest is paid out as prizes instead of being split evenly. Your deposit is never spent on prizes, so the worst outcome of any draw is that nothing happens to your balance.",
  },
  {
    question: "Can I lose money by opting in?",
    answer:
      "No. Prizes come only from the yield the pool earns. Your deposit stays withdrawable under the same spending limits and time locks you set for the rest of your savings. Opting in changes what your interest does, not what your principal does.",
  },
  {
    question: "Is joining the prize pool mandatory?",
    answer:
      "No. Prize savings is opt-in and reversible. A LockIn Wallet works exactly the same without it — your savings simply keep their own yield instead of entering the draws.",
  },
  {
    question: "How often are prizes drawn?",
    answer:
      "There are hourly draws for small prizes, a daily draw for bigger ones, and a weekly grand prize. Every draw runs on-chain, and the prize size depends on how large the pool is and how much yield it has earned since the last draw.",
  },
  {
    question: "What are my chances of winning?",
    answer:
      "Odds scale with your share of the pool: the more you have deposited, the more chances you hold in each draw. The simulator on this page estimates weekly odds and long-run average prizes for any deposit size.",
  },
  {
    question: "Can I still withdraw while I am in the prize pool?",
    answer:
      "Yes. Your withdrawal limits, approved destinations and the 24-hour emergency bypass all work unchanged. Leaving the pool takes one transaction and does not lock your funds for any extra period.",
  },
];

export const PRIZE_SIMULATION = {
  eyebrow: "Simulation",
  title: "See what locking in could win you",
  lede: "Drag the slider to any deposit size and compare the three outcomes: what you keep, what the pool pays on average, and the grand prize.",
};

export const PRIZE_SAVINGS_SEO = {
  title: "No-Loss Prize Pool — Win Prizes Without Risking Your Savings | LockIn",
  description:
    "Opt in to a no-loss prize pool: pooled savings earn yield, the yield is paid out as hourly, daily and weekly prizes, and your deposit is always yours. Simulate your odds and prizes.",
  path: PRIZE_SAVINGS_PATH,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl(PRIZE_SAVINGS_PATH),
        url: absoluteUrl(PRIZE_SAVINGS_PATH),
        name: PRIZE_HERO.title,
        description: PRIZE_HERO.lede,
        isPartOf: { "@type": "WebSite", name: "LockIn Wallet", url: absoluteUrl("/") },
      },
      buildFaqJsonLd(PRIZE_FAQ),
    ],
  },
};
