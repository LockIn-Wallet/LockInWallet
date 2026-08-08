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
        emoji: "🔵",
        text: "You can now lock in on Base as well as Optimism. The reason is simple: we want you to be able to buy savings with a bank card, and the card provider doesn't sell dollars on Optimism — only ETH. On Base it does. Optimism is still what you get by default, and nothing moves on its own: if your savings are on Optimism they stay there, and picking Base means starting a separate wallet on that chain.",
      },
      {
        emoji: "🌱",
        text: "Your savings can now earn interest while they sit locked. You pick how — a steady rate, or a prize draw instead of a rate — and you can switch it off whenever you like, which returns everything to your vault. Nothing moves until your next deposit, so no money already in your vault goes anywhere without you doing something first. Worth knowing: earning means your balance is lent out through an outside protocol, and that is not risk-free. If you would rather it sat still, leaving earning off is a perfectly good answer.",
      },
      {
        emoji: "🎟️",
        text: "Prize savings is here as a second way to earn. Instead of a steady rate, the interest your savings would have earned goes into a prize draw — and you get your own entry, so anything you win is yours alone rather than split with everyone else. Two things worth knowing. Your deposit is never at stake, only the interest it would have made. And prizes are paid in ETH rather than the coin you saved, so they arrive separately for you to claim instead of being added to your balance. Most months you win nothing; occasionally you win a lot. If that is not for you, steady earning is one tap away.",
      },
      {
        emoji: "🤝",
        text: "We keep one percentage point of the interest rate — so a 5% rate pays you 4%. On prize savings there is no rate at all, so instead we keep a small share of anything you actually win, and nothing whatsoever if you never win. Two promises about that. First, we never take more than what your savings actually earned: a month that earns nothing costs you nothing, and the shortfall waits for interest rather than coming out of your deposit. Second, your deposit is never the source of our fee, and that is enforced in the contract rather than promised in a document — there is no path in the code from your principal to our revenue.",
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
        text: "We removed the claim that there are 'zero admin keys' — it wasn't true. Upgrades are still executed by a single maintainer key today, and the page now says so plainly, alongside the protection that does hold: you can always start withdrawing everything, and nobody can make you wait longer than the delay you picked yourself.",
      },
      {
        emoji: "📊",
        text: "The wallet screen now opens with what you can actually withdraw right now — each of your limits, how much is left in it, and when it resets. Withdrawing moved above the limits themselves, since taking money out is the everyday action and changing a limit is the rare one.",
      },
      {
        emoji: "🦊",
        text: "If you've never done this before, pressing connect now explains it instead of telling you off. What MetaMask is, why there's no password here, what a chain is and why ours is Optimism — four short paragraphs, then the download link. It used to be a pop-up box reading 'Please install MetaMask!', which helps nobody who doesn't already know what that means.",
      },
      {
        emoji: "🎁",
        text: "The no-loss prize pool is hidden for now. It isn't finished, and we would rather show you nothing than a page of numbers that don't mean anything yet — so the 'Prize pool' menu entry and the prize controls in your balance list are gone until the real thing works. Nothing you hold is affected: no money was ever in it.",
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
