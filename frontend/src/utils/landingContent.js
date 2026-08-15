// Copy for the logged-out landing page, kept as data so wording lives in one
// place. Every claim here is traceable to SECURITY.md, GOVERNANCE.md or the
// contracts — see the note on each block. Nothing on this page may promise a
// protection the contracts do not enforce.

import { PRIZE_SAVINGS_PATH } from "./prizeSavingsContent.js";
import { isPrizePoolEnabled } from "./featureFlags.js";

export const GITHUB_URL = "https://github.com/LockIn-Wallet/LockInWallet";
export const SECURITY_URL = `${GITHUB_URL}/blob/main/SECURITY.md`;
export const GOVERNANCE_DOC_URL = `${GITHUB_URL}/blob/main/GOVERNANCE.md`;
export const CHANGELOG_URL = `${GITHUB_URL}/blob/main/CHANGELOG.md`;
export const DISCORD_URL = "https://discord.gg/ZjYQjZX5XS";

export const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Compare", href: "#compare" },
  { label: "Security", href: "#security" },
  {
    label: "Prize pool",
    href: PRIZE_SAVINGS_PATH,
    internal: true,
    flag: isPrizePoolEnabled,
  },
  { label: "Governance", href: "/governance", internal: true },
];

// Three facts, each one checkable by the reader. Deliberately not "zero admin
// keys" — upgrades run from a maintainer key today (SECURITY.md), and the real
// protection is the exit asymmetry, which is both true and stronger.
export const PROOF_POINTS = [
  {
    label: "SOURCE CODE",
    value: "100% public",
    accent: false,
    note: "Every contract that governs your vault is on GitHub.",
  },
  {
    label: "TIME TO EXIT",
    value: "24h–3 months",
    accent: true,
    note: "You set the wait when you set each limit. The emergency bypass then gets you completely out in exactly that time — nobody can extend it.",
  },
  {
    label: "LIVE ON",
    value: "Base & Optimism",
    accent: false,
    note: "Both are Ethereum layer 2s: they settle onto Ethereum itself, so they inherit its security, but a transaction costs cents instead of dollars. New wallets start on Base, where a bank card can buy dollars directly.",
  },
];

// Wallet categories, not named products — the footnote on the table says so.
export const COMPARISON_COLUMNS = [
  { key: "lockin", label: "LockIn Wallet", ours: true },
  { key: "custodial", label: "Custodial exchange account" },
  { key: "hot", label: "Standard hot wallet" },
];

export const COMPARISON_ROWS = [
  {
    label: "Source code you can read",
    lockin: "Yes",
    custodial: "No",
    hot: "Varies",
  },
  {
    label: "Drained instantly if your key leaks",
    lockin: "No — capped at your limit",
    custodial: "Yes, if your account is taken",
    hot: "Yes",
    negativeFor: ["custodial", "hot"],
  },
  {
    label: "Withdrawal limits enforced on-chain",
    lockin: "Yes",
    custodial: "Set by the platform",
    hot: "No",
  },
  {
    label: "Someone else holds your funds",
    lockin: "No — self-custody",
    custodial: "Yes",
    hot: "No",
    negativeFor: ["custodial"],
  },
  {
    label: "Protects you from your own 2am decision",
    lockin: "Yes",
    custodial: "No",
    hot: "No",
  },
  {
    label: "Recovery after your seed phrase leaks",
    lockin: "Cold recovery key",
    custodial: "Support ticket",
    hot: "None",
  },
];

// Each card states a protection that is live on-chain today, in the same terms
// SECURITY.md uses. No claim of audits — there have been none.
export const TRUST_POINTS = [
  {
    icon: "code",
    title: "Open source, end to end",
    body: "Every line that governs your vault is public. Read it yourself, fork it, or have someone you trust review it — you never have to take our word for it.",
  },
  {
    icon: "clock",
    title: "You can always leave, on your own clock",
    body: "The emergency bypass is the cornerstone: whatever happens — including an upgrade you disagree with — you can start withdrawing everything immediately. The wait is the one you chose for that limit, anywhere from 24 hours to 3 months, and nobody can lengthen it afterwards.",
  },
  {
    icon: "lock",
    title: "Self-custody, always",
    body: "Your funds sit in a contract you control, not an account we hold. Nobody can freeze them, seize them, or lose them on your behalf.",
  },
  {
    icon: "key",
    title: "A cold key that outranks a stolen seed",
    body: "Register an offline recovery key in advance and a leaked seed stops being fatal. Freezing is instant; moving the account to a fresh address is the recovery key's alone.",
  },
];

// The honest version of the upgrade story, stated on the page rather than
// buried in a doc. Mirrors SECURITY.md § "Upgrade trust model".
export const UPGRADE_DISCLOSURE = {
  eyebrow: "STATED PLAINLY",
  title: "What we can still do, and why it can't hurt you",
  body: "The contracts are upgradeable — that's what lets bugs get fixed. Today upgrades are executed by a single maintainer key; there is no multisig yet. An on-chain governance layer is rolling out that puts every upgrade in a public 48-hour timelock, and we hold the delay at twice the 24-hour bypass, so seeing a queued change always leaves you time to exit first.",
  linkLabel: "Read the full trust model",
};

export const HOW_IT_WORKS = [
  {
    title: "Connect a wallet",
    body: "Any Ethereum wallet. No sign-up, no email, no personal data.",
  },
  {
    title: "Name your periods",
    body: "Hourly, daily, weekly — whatever periods you choose, with a cap on each.",
  },
  {
    title: "Lock it in",
    body: "Deposit and commit. From that moment the contract enforces the caps, not your willpower.",
  },
  {
    title: "Spend under the cap",
    body: "Anything within your limits clears instantly. Anything over waits in the open for the delay you set — 24 hours at the shortest, up to 3 months.",
  },
];

export const FOOTER_COLUMNS = [
  {
    title: "PRODUCT",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Compare wallets", href: "#compare" },
      { label: "Savings visualiser", href: "/savings-visualiser", internal: true },
      { label: "What is a passkey?", href: "/passkeys", internal: true },
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
