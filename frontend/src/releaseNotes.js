/**
 * Plain-language release notes shown on the in-app Governance page.
 *
 * This is the user-facing voice of CHANGELOG.md — no jargon, no contract
 * internals, just what changed for the person using the wallet. Update BOTH
 * files for every release: CHANGELOG.md for the technical record, this file
 * for the humans. Newest release first.
 */

export const RELEASE_NOTES = [
  {
    version: "Unreleased",
    date: "",
    title: "A home page you can check",
    highlights: [
      {
        emoji: "🔍",
        text: "The home page has been rebuilt around one idea: every claim on it should be something you can verify. It opens with a live vault refusing a withdrawal that breaks its own limit, and links straight to the source, the security model and the governance queue.",
      },
      {
        emoji: "📋",
        text: "We removed the claim that there are 'zero admin keys' — it wasn't true. Upgrades are still executed by a single maintainer key today, and the page now says so plainly, alongside the protection that does hold: you can always start a full exit and be out within 24 hours.",
      },
      {
        emoji: "🎨",
        text: "The whole app moves to one design system — a dark, near-neutral palette with a single green accent that only ever means 'enforced on-chain', and a monospaced typeface for anything the contract says: amounts, countdowns, addresses.",
      },
    ],
  },
  {
    version: "0.3.1",
    date: "2026-07-26",
    title: "Clearer recovery story",
    highlights: [
      {
        emoji: "🛟",
        text: "The home page now walks through exactly what happens if your key is ever stolen — and how a recovery key lets you freeze the account and take your savings back.",
      },
      {
        emoji: "✅",
        text: "Setting a recovery key is now a two-step handshake: propose it, then confirm once from the recovery wallet itself. This catches typos and proves your backup actually works — before you ever need it.",
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-07-26",
    title: "Recovery protection",
    highlights: [
      {
        emoji: "🛟",
        text: "New recovery protection: add a backup key (like a hardware wallet you keep offline) that can instantly freeze your account and move your savings to a new address if your main wallet is ever stolen. A thief with your seed phrase can't remove the backup key — trying starts a 30-day public countdown your backup key can always cancel.",
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-07-25",
    title: "Referrals, stronger locks, and public governance",
    highlights: [
      {
        emoji: "🤝",
        text: "Invite friends with your personal link — who you invited (never their full address) shows up in your new Invite & Earn section, and your referrals are recorded for future rewards.",
      },
      {
        emoji: "🔒",
        text: "Your limits are truly locked now: once you lock in, no path can change a spending limit instantly — every change waits 24 hours in the open, where you can see and cancel it.",
      },
      {
        emoji: "🏛️",
        text: "This Governance page is new: every planned contract change is announced here with a countdown before it can happen, and you always keep enough time to withdraw everything first if you disagree.",
      },
      {
        emoji: "🛠️",
        text: "Under the hood the contracts were reorganized to be leaner and safer to maintain — your balances, limits and settings carried over untouched.",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-02-14",
    title: "First release",
    highlights: [
      {
        emoji: "🚀",
        text: "The savings wallet launched: lock in spending limits, timelocked withdrawal addresses, emergency 24h exit, permanent deposit addresses, and savings vaults on Optimism and Solana.",
      },
    ],
  },
];

// Latest shipped version — entries still in development (no numeric version
// yet) don't define the app version
export const APP_VERSION = RELEASE_NOTES.find((r) => /^\d/.test(r.version)).version;
