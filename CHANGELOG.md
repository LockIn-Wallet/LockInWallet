# Changelog

All notable changes to LockIn Wallet are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Because this project ships **upgradeable smart contracts**, every entry that
touches a contract also states the on-chain effect (which module, upgrade vs.
new deployment, storage impact). Users can verify queued upgrades against
these notes on the in-app **Governance** page before they execute.

## How releases work

1. Every user-facing or contract change lands in `[Unreleased]` with its PR.
2. Cutting a release: rename `[Unreleased]` to a version + date, tag the
   commit (`git tag vX.Y.Z`), and open a GitHub Release pointing at the tag.
3. Contract upgrades are queued through the on-chain timelock **referencing
   the release tag**, wait out the public delay, and only then execute —
   users always have the full window to read these notes and exit if they
   disagree (see [SECURITY.md](SECURITY.md)).
4. The frontend deploys in the same window as the contract execution.

## [Unreleased]

### Added
- Yearly spending limits, plus an hourly window, alongside the existing
  daily/weekly/monthly. Periods are now defined in one catalog
  (`frontend/src/utils/spendingPeriods.js`) and passed to the contracts as
  name/duration/limit/wait tuples, so adding another period (quarterly, a
  salary cycle) needs no contract change. **On-chain:** upgrade
  `TimePeriodLimitsModule` in place — new array-based `setPeriodLimits` and
  `setPeriodLimit` entry points; the existing `setCommonPeriodLimits` and
  `addTimePeriodLimit` keep working. No storage was reordered.
- Per-period unlock delays. Each limit carries its own wait, which governs
  both bypassing that limit and changing it, replacing the fixed 24 hours.
  Defaults: hourly 24h, daily 24h, weekly 7d, monthly 30d, yearly 30d;
  the user picks their own at setup, within 1 hour – 365 days.
  **On-chain:** upgrade `TimePeriodLimitsModule` (delays live in a new
  appended `mapping(address => mapping(bytes32 => uint256))`, so a period
  with no stored delay reads back as 24 hours and every limit committed
  before this upgrade keeps the wait it was committed under),
  `BypassSystemModule` (bypass timelock now reads the period's delay) and
  `ProposalSystemModule` (limit-change proposals use the period's delay).
- Changing a wait time after lock-in goes through the proposal timelock in
  both directions — lengthening and shortening alike serve out the period's
  *current* wait first, so a wait can never be shortened on the spot.
  **On-chain:** `ProposalSystemModule.proposeUnlockDelayChange`, executed
  through the existing `executeLimitProposal`; `CategoryUpdateProposal`
  gains two appended fields (safe — the struct is only reached through a
  mapping). New `commitSetupWithPeriods` commits any set of periods in one
  transaction.

- Dedicated **no-loss prize pool page** at `/prize-savings`, linked from the
  home nav and from the in-app links next to the Savings Visualiser. It
  explains the opt-in prize pool, keeps the live draw countdowns and winner
  feed, and gives the "what if I locked $X" simulation a section of its own.
  Frontend only — no contract change. The page manages its own title,
  description, canonical URL, Open Graph tags and `FAQPage` structured data
  through a new `usePageSeo` hook (`frontend/src/utils/seo.js`), and both it
  and the visualiser are now listed in `sitemap.xml`.

### Changed
- The prize pool section was **moved off the home page** onto
  `/prize-savings`. The home page keeps its focus on the withdrawal limits
  and the trust model; prize savings is an optional add-on and now reads as
  one.
- Design system: `frontend/src/styles/theme.js` is rebuilt on the LockIn
  tokens — a near-neutral dark surface ramp with a single mint accent
  reserved for "enforced / verified / active", plus an absolute type scale,
  `IBM Plex Mono` for machine output (amounts, clocks, addresses, status),
  and page-level spacing/radius scales. Every existing token key keeps its
  name, so all screens pick up the new palette without call-site changes.
  Global element styles in `index.css` were retuned to the same tokens and a
  visible `:focus-visible` ring plus an `.sr-only` utility were added.
- Home page rebuilt on the new system: nav, hero, proof strip, wallet
  comparison table, trust grid, chain rollout, how-it-works and footer, with
  the existing time-lock, recovery, chain and prize demos restyled into it.
  Emoji removed from the trust-carrying sections in favour of a line-icon
  set (`components/atoms/Icon.js`). The logged-out home page now renders in
  a full-width shell with its own nav and footer.
- Wallet connect buttons use the accent instead of each wallet's brand
  colour, so a single accent carries the primary action.
- Savings Visualiser palette remapped onto the design tokens via
  `tailwind.config.js`, so the embedded projection matches the rest of the
  page.

### Fixed
- Home page copy no longer claims "zero admin keys". The page now states the
  actual upgrade trust model from [SECURITY.md](SECURITY.md) — upgrades are
  executed by a single maintainer key today, an on-chain 48h timelock is
  rolling out, and the guarantee that holds regardless is the 24h emergency
  bypass. The removed "audits" link is replaced by links to the source, the
  security model and the Governance page.

- The logged-in app now uses the same design tokens as the home page. All
  231 remaining hardcoded palette values across 16 component files were
  converted to token references, mapped by (CSS property, hex) because the
  same value carried different meanings — `#4a5568` was a border 27 times
  and a background 18 times.
- New `AllowanceBar` at the top of the vault view: remaining allowance per
  active period, in mono, with a reset countdown. Answers "what can I
  withdraw right now" without scrolling.
- Once the wallet is locked, **Withdraw funds** sits above **Spending
  limits** — withdrawing is the routine act, changing a limit is rare and
  deliberately slow (24h timelock).
- Collapsible sections use the line-icon set and no longer repeat the
  heading that the component beneath them already renders.

### Removed
- The in-app tutorial card shown during setup. It re-sold the product to
  users who had already connected, duplicating the home page, and claimed
  compromise resistance was "coming soon" — the recovery system shipped in
  v0.3.0.

No contract changes; frontend only.

## [0.3.1] - 2026-07-26

### Added
- Home page: the "stolen key" demo now ends with a recovery-protection
  explainer — freeze instantly, move to a fresh key, and why the thief
  always loses the 30-day race. Frontend copy only, no contract changes.

### Changed
- **Recovery keys must prove themselves before activating**: registering,
  rotating, or timelock-changing a recovery key now only *proposes* it —
  the proposed key must call `acceptRecoveryRole` once (Ownable2Step
  pattern). Prevents a typo'd or dead recovery key from turning a freeze
  into a permanent lock, and verifies the key can actually transact before
  it's trusted; removal via the 30-day path needs no acceptance. *On-chain:
  `RecoverySystemModule` upgraded in place with an appended
  `pendingRecoveryKeys` mapping; already-active recovery keys are
  unaffected.*

## [0.3.0] - 2026-07-26

### Added
- **Seed-compromise recovery system** (EVM): users can register a cold
  recovery key that can instantly freeze the account, veto recovery-key
  changes, and move the whole account (core balances) to a fresh address via
  the new `RecoverySystemModule`. The hot key can only replace the recovery
  key through a 30-day cancellable timelock, so an attacker holding the seed
  can never outrun the real owner's cold key. While frozen, all outgoing
  paths are blocked — withdrawals, bypass requests/executions,
  withdrawal-address requests/executions, and vault withdrawals — while
  deposits keep working. *On-chain: new `RecoverySystemModule` proxy +
  registration; in-place upgrades of `SavingsCore`, `BypassSystemModule`,
  `ApprovalSystemModule`, and `VaultSystemModule` adding freeze checks; no
  storage migration; accounts without a recovery key are unaffected.*
- **Recovery Protection section** in the app: register a recovery key
  (before or after lock-in), see frozen/pending-change status, freeze
  instantly, veto or apply recovery-key changes — plus a recovery-key
  console to freeze/unfreeze a protected account and move it to a fresh
  address when this wallet is its cold key. Unified adapter interface with
  graceful no-op on chains without the module (Solana parity later).

## [0.2.0] - 2026-07-25

### Added
- **Referral system** (EVM): who invited each user is recorded permanently
  and atomically at wallet lock-in via the new `ReferralModule`; referral
  links (`?ref=<address>`), an in-app "Invite & Earn" dashboard with an
  anonymized invitee list, and an incentives design
  ([REFERRAL_INCENTIVES.md](REFERRAL_INCENTIVES.md)). *On-chain: new module
  proxy + registration; setup commit flow gains an optional referrer.*
- **Governance layer**: `SavingsTimelock` (OpenZeppelin TimelockController)
  owns the core and every module, with a Gnosis Safe as proposer — no
  custom multisig code; upgrade tooling (`deploy-governance.js`,
  `governance-upgrade.js` incl. Safe Transaction Builder payloads).
  *On-chain: new timelock contract; opt-in ownership handover.*
- **Governance page & upgrade banner** in the app: live timelock queue with
  countdowns, change history, the user protections table, and the exit
  runbook for users who disagree with a queued change.

### Changed
- **Pattern B architecture**: every module is now self-authenticating
  (`msg.sender`), users call modules directly, and `SavingsCore` slimmed to
  a custody kernel (25,229 → 8,611 bytes — back under the EIP-170 mainnet
  size limit, also thanks to compiling with `viaIR`). *On-chain: in-place
  upgrades of core + all modules; all user data preserved; frontend must
  deploy in the same window.*
- **Post-lock limits are frozen**: after lock-in, spending limits can only
  change through the 24h proposal flow — the previous instant-override paths
  (`setCommonPeriodLimits`, re-"adding" an existing period) now revert.
  *On-chain: TimePeriodLimitsModule upgrade; security tightening.*

### Fixed
- Setup status crash after switching MetaMask accounts.
- Stale vault selection after a chain reset silently emptying spending
  limits and balances.
- Post-lock withdrawal address adds now route through the 24h timelock
  request instead of failing.
- Executing timelocked requests on an idle local dev chain no longer fails
  gas estimation ("Request still in timelock").
- Executed withdrawal destinations appear in the destinations list.
- Balance display trailing zeros ("200.0" → "200").
