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

export const APP_VERSION = RELEASE_NOTES[0].version;
