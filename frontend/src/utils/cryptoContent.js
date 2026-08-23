// Copy and structured data for the crypto-native landing (/crypto). The main
// page is written for someone who has never held crypto; every chain-level
// claim, term and demo lives here instead of being deleted. Same rule as
// landingContent.js applies: nothing may promise a protection the contracts
// do not enforce, and nothing planned may be presented as live.

import {
  GITHUB_URL,
  SECURITY_URL,
  GOVERNANCE_DOC_URL,
  CRYPTO_PATH,
} from "./landingContent.js";
import { buildFaqJsonLd, absoluteUrl } from "./seo.js";

export { CRYPTO_PATH };

export const CRYPTO_NAV_LINKS = [
  { label: "Architecture", href: "#architecture" },
  { label: "Threat model", href: "#threat-model" },
  { label: "Contracts", href: "#contracts" },
  { label: "Compare", href: "#compare" },
  { label: "Not a crypto person?", href: "/", internal: true },
];

// The honest crypto pitch: rate limits + unlock delays, not a maturity date.
export const CRYPTO_HERO = {
  badge: "TIME-LOCKED ON-CHAIN WALLET",
  titleStart: "A wallet that rate-limits everyone.",
  titleAccent: "Even you.",
  subtitle:
    "User-set withdrawal limits with per-period unlock delays, enforced by " +
    "contracts on Optimism and Base. Within your limits, withdrawals clear " +
    "instantly. Above them, an on-chain bypass request and a wait you chose " +
    "— 1 hour to 90 days — that no key, support ticket, or 2am conviction " +
    "can shorten.",
  ctaPrimary: "Create your wallet",
  ctaSecondary: "Read the contracts",
};

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

// What it is and why the design looks the way it does. Each block is a claim
// about shipped code, with the honest caveat stated in the same breath.
export const ARCHITECTURE_SECTION = {
  eyebrow: "Architecture",
  title: "What it actually is",
  cards: [
    {
      icon: "code",
      title: "A modular savings core",
      body: "SavingsCore holds balances; separate authorized modules enforce per-period limits, the bypass, withdrawal destinations, recovery and yield. Withdrawals are charged against every active period at once, so the tightest limit is the real speed limit.",
    },
    {
      icon: "key",
      title: "Deterministic deposit addresses",
      body: "Each user gets a CREATE2-derived deposit address, computable before it is deployed. Withdraw from an exchange straight to it and the funds land under your limits automatically — the address can pay into your savings and do nothing else.",
    },
    {
      icon: "clock",
      title: "Rate limits, not a maturity date",
      body: "There is deliberately no lock-until-date and no way to be locked in forever: the emergency bypass always exists, takes exactly the delay you chose for that period (1 hour to 90 days), and nobody — including the maintainers — can lengthen it once set.",
    },
    {
      icon: "shield",
      title: "Destinations with a cooling period",
      body: "Registered withdrawal addresses take a 24-hour delay to activate after your setup is committed. Your own connected address is always a valid destination by design — the guarantee is the rate limit plus the public wait, not an allowlist that pretends your signer can't be you.",
    },
  ],
};

export const THREAT_MODEL_SECTION = {
  eyebrow: "Threat model",
  title: "Why a leaked key isn't fatal",
  lede: "Your limit is the attacker's limit too. That gap is the time you need to notice and take the account back.",
};

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
  body: "The contracts are upgradeable — that's what lets bugs get fixed. Today upgrades are executed by a single maintainer key; there is no multisig yet, and there has been no third-party audit. An on-chain governance layer is rolling out that puts every upgrade in a public 48-hour timelock, and we hold the delay at twice the 24-hour bypass, so seeing a queued change always leaves you time to exit first.",
  linkLabel: "Read the full trust model",
};

// Yield facts come straight from YieldModule / VaultYieldModule and the
// strategies folder: Aave v3 live, PoolTogether prize strategy disabled,
// management fee 100 bps capped at 200 bps and collectable only out of
// realized surplus, prize fee 500 bps.
export const YIELD_SECTION = {
  eyebrow: "Yield",
  title: "Optional yield, priced in the open",
  paragraphs: [
    "Earning is off by default and opt-in per coin. The live strategy is " +
      "Aave v3 on the same chain your savings sit on; a PoolTogether prize " +
      "strategy exists in the codebase but is currently disabled.",
    "The fee is a management fee of up to 1% a year (hard-capped at 2% in " +
      "code), accrued time-weighted against invested principal and " +
      "collectable only out of realized surplus — if the strategy earns " +
      "nothing, the fee collects nothing, and principal is never touched. " +
      "Prize claims, when enabled, carry a 5% fee. With earning off there " +
      "is no fee at all.",
  ],
};

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

// The deployed SavingsCore proxy — same address on both chains. Stated on the
// page because "read the contracts" should not require a treasure hunt.
export const SAVINGS_CORE_ADDRESS =
  "0xA827CDB73b986e987fA88B8f5471ECa25E8b9d63";

export const CONTRACTS_SECTION = {
  eyebrow: "Contracts",
  title: "Live on Optimism and Base",
  lede: "Cheap, fast transactions matter here: an hourly limit only makes sense if using it doesn't cost a fortune in gas.",
  deployments: [
    {
      chain: "Optimism",
      address: SAVINGS_CORE_ADDRESS,
      explorerUrl: `https://optimistic.etherscan.io/address/${SAVINGS_CORE_ADDRESS}`,
    },
    {
      chain: "Base",
      address: SAVINGS_CORE_ADDRESS,
      explorerUrl: `https://basescan.org/address/${SAVINGS_CORE_ADDRESS}`,
    },
  ],
  links: [
    { label: "Source code", href: GITHUB_URL },
    { label: "Security model", href: SECURITY_URL },
    { label: "Governance", href: GOVERNANCE_DOC_URL },
  ],
};

export const CRYPTO_FAQ = [
  {
    question: "Does this stop me panic-selling my coins?",
    answer:
      "It stops the transfer that funds the sale. You can save ETH and dollar stablecoins (USDT, USDC, DAI); above your allowance, nothing can reach an exchange until the bypass delay you chose has publicly run out — which is usually longer than the panic.",
  },
  {
    question: "Is this a timelock until a date?",
    answer:
      "No — it's stricter where it matters and kinder where it doesn't. Instead of one maturity date, you set per-period spending limits with an unlock delay of 1 hour to 90 days on everything above them. You always have an exit, it just runs on a clock everyone can see and nobody can shorten.",
  },
  {
    question: "What if the maintainers turn malicious?",
    answer:
      "That's the honest residual risk: contracts are upgradeable and today upgrades run from a single maintainer key, with a public 48-hour governance timelock rolling out. The counterweight that already exists is the exit asymmetry — the emergency bypass gets you fully out in the delay you chose, and no upgrade can lengthen a wait already set. Watch the queue, and leave before anything you dislike executes.",
  },
  {
    question: "Has it been audited?",
    answer:
      "Not yet — no third-party audit has been completed or is in progress, and we won't claim otherwise. The contracts, the security model and the full change history are public, and the design leans on audited building blocks where they exist.",
  },
];

export const CRYPTO_CLOSING = {
  title: "Rate-limit your keys before someone else tests them.",
  body: "Connect a wallet or sign in with a passkey. Your limits, your delays, enforced on-chain.",
};

export const CRYPTO_SEO = {
  title: "Rate-Limit Your Own Crypto Wallet — On-Chain Withdrawal Limits | LockIn Wallet",
  description:
    "Self-custodial wallet with on-chain withdrawal limits and per-period unlock delays on Optimism and Base. A leaked key drains one allowance, not your balance — and no support ticket moves faster than the clock. Open source.",
  path: CRYPTO_PATH,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl(CRYPTO_PATH),
        url: absoluteUrl(CRYPTO_PATH),
        name: "A wallet that rate-limits everyone. Even you.",
        description:
          "On-chain withdrawal limits and unlock delays for people who know exactly how fast a wallet can be emptied.",
        isPartOf: {
          "@type": "WebSite",
          name: "LockIn Wallet",
          url: absoluteUrl("/"),
        },
      },
      buildFaqJsonLd(CRYPTO_FAQ),
    ],
  },
};
