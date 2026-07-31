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
        emoji: "💳",
        text: "The wallet now runs on Base as well as Optimism, and on Base you can top up with a bank card — the money goes straight into your locked savings. You buy USDC through Transak and it is paid out to your permanent deposit address, never to a wallet you can spend from, so it arrives already under your spending limits. The card option stays hidden on Optimism because no stablecoin can be bought there. Transak runs the payment and its own identity checks, and charges its own fee. Your existing Optimism savings are untouched and Optimism is still the network you land on by default.",
      },
      {
        emoji: "🕵️",
        text: "Inviting someone no longer lets you watch their money. Before, anyone who shared a referral link could pull up the list of wallets that joined through it — and every balance on this chain is public, so that was a window into what those people had saved. Now you only ever see a number: how many people locked in through your link. Being paid for a referral and being able to spy on that person are two different things, and only one of them is part of the deal.",
      },
      {
        emoji: "🔐",
        text: "Removing a spending limit now waits, exactly like changing one does. It used to take effect the moment you asked — which meant anyone who got hold of your wallet key could delete every limit and empty the account in two steps. Now a removal sits in the open for that limit's waiting period, where you can see it and cancel it.",
      },
      {
        emoji: "🛟",
        text: "Recovering your account to a new address now brings your spending limits with it. Before, recovery handed the new address the money with no limits at all — so a stolen recovery key could empty everything at once. Now the new address inherits the same limits, including how much you have already spent today, and changing them still takes the same waiting period.",
      },
      {
        emoji: "🗓️",
        text: "You can now cap your spending over a year, not just a day, a week or a month — and an hourly cap is there too if you want one. Set as many as you like; a shorter period can never allow more than a longer one.",
      },
      {
        emoji: "⏳",
        text: "You choose how long it takes to break or change each limit. Before, everything waited 24 hours. Now a daily cap still unlocks in 24 hours by default, a weekly cap takes a week, and monthly or yearly caps take a month — and you can set your own wait, anywhere from an hour to a year.",
      },
      {
        emoji: "🔒",
        text: "Changing a wait time is itself subject to the wait. If your weekly limit takes a week to unlock, then shortening that week takes a week too. That is the point: a moment of temptation can't undo a decision you made carefully.",
      },
      {
        emoji: "🔍",
        text: "The home page has been rebuilt around one idea: every claim on it should be something you can verify. It opens with a live vault refusing a withdrawal that breaks its own limit, and links straight to the source, the security model and the governance queue.",
      },
      {
        emoji: "📋",
        text: "We removed the claim that there are 'zero admin keys' — it wasn't true. Upgrades are still executed by a single maintainer key today, and the page now says so plainly, alongside the protection that does hold: you can always start a full exit and be out within 24 hours.",
      },
      {
        emoji: "📊",
        text: "The wallet screen now opens with what you can actually withdraw right now — each of your limits, how much is left in it, and when it resets. Withdrawing moved above the limits themselves, since taking money out is the everyday action and changing a limit is the rare one.",
      },
      {
        emoji: "🎁",
        text: "The no-loss prize pool now has a page of its own — find it as 'Prize pool' in the menu, next to the Savings Visualiser. You can opt in to a shared pool where only the interest is drawn as prizes: win and you gain, don't win and you lose nothing, because your deposit is never at stake. The page keeps the live draw countdowns and lets you simulate what any deposit could win.",
      },
      {
        emoji: "🎨",
        text: "The whole app moves to one design system — a dark, near-neutral palette with a single green accent that only ever means 'enforced on-chain', and a monospaced typeface for anything the contract says: amounts, countdowns, addresses.",
      },
      {
        emoji: "💬",
        text: "Trying to withdraw more than you have now says so — it tells you how much is actually in your wallet, instead of the blank 'Invalid amount' the contract used to throw back.",
      },
      {
        emoji: "🗣️",
        text: "Every error in the app now reads as a sentence. Where you used to get a wall of transaction data, or an error code like '0x1771', you get what actually went wrong and what to do: you are not a member of this vault, the waiting period is not over yet, that address is already on your list. Cancelling a transaction in your wallet is no longer reported as a failure.",
      },
      {
        emoji: "🛑",
        text: "Depositing more than your wallet holds is caught before anything is signed. Previously you approved the tokens first, paid the fee for it, and only then watched the deposit fail.",
      },
      {
        emoji: "🚪",
        text: "You can log out. A Disconnect button now sits next to your address at the top of the app — it takes you back to the home page and stays logged out when you reload, so you can hand over the screen or connect a different wallet. Your savings are untouched; only this browser forgets the connection.",
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
