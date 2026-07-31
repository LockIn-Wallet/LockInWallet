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
- Card purchases (Transak) that pay out **directly into the locked wallet**.
  The provider delivers USDC to the user's permanent deposit address with the
  payout address form disabled server-side, so bought funds land inside savings
  under the existing spending limits and never pass through a wallet the user
  can spend from; the `UserProxy` sweep credits them on the next balance
  refresh. **On-chain:** no contract change — this reuses the deterministic
  deposit address and `sweepERC20` already deployed. Needs the serverless
  endpoint `frontend/api/transak/session.js`, because Transak mints widget URLs
  server-side from an API secret; without `TRANSAK_API_KEY`,
  `TRANSAK_API_SECRET` and `REACT_APP_ENABLE_ONRAMP=true` the feature is absent
  from the UI. Offered only where the provider sells USDC **and** our contracts
  are deployed, and disabled outright if the provider's token address disagrees
  with `networkConfig.json` (a mismatch would strand the purchase at an address
  the contracts do not sweep).
- **Base (chain 8453) deployed** — `SavingsCore` at `0xA827CDB73b986e987fA88B8f5471ECa25E8b9d63` with all nine modules registered, `developmentMode` off, and the deposit-address fee set to 0.001 ETH in native ETH (matching Optimism). Also added: `hardhat.config.ts` network entry,
  a frontend `networkConfig.json` entry with on-chain verified native
  USDC/USDT/DAI addresses, and inclusion in the production network list. Base
  is what makes card purchases possible — Transak sells no stablecoin on
  Optimism, only ETH. **On-chain:** fresh deployment, not an upgrade; Optimism
  is untouched and stays the default network, so existing users are unaffected.
  Base's core happens to share Optimism's address because the deployer's nonce
  sequence lined up across the two chains — they are independent deployments
  with their own storage. Upgrades on Base still run off the single deployer key
  until governance is deployed there.
- `deploy-modular.js` gates mock contracts on the network being localhost
  rather than on the `PRODUCTION` env flag. A fresh deploy to any live chain
  previously deployed `MockUSDT` and wrote that address into the frontend as
  real USDT, and set the deposit-address fee to 3 of those unobtainable mock
  tokens — with or without `PRODUCTION=true`. Live chains now keep the token
  addresses already in `networkConfig.json` and charge the fee in native ETH
  (`PROXY_FEE_ETH`, default 0.001), which a user arriving with only a card can
  actually pay.
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

- **Disconnect** button next to the connected address in the status header,
  on both EVM and Solana. It clears the session, drops that wallet's cached
  network and vault entries (`clearNetworkStorage`, `clearVaultCache`) and
  returns to the logged-out home page. Because neither MetaMask nor the
  Solana wallet adapter can be told to forget a site, a `wallet_logged_out`
  flag (`frontend/src/utils/walletSession.js`) suppresses the silent
  auto-connect and the adapter's `autoConnect` until the user connects
  again — otherwise a reload would re-attach the same wallet within seconds.
  Frontend only — no contract change.

### Security
- Removing a spending limit now serves that period's unlock delay instead of
  executing immediately. `proposeLimitRemoval` wrote an `executeAfter` of
  `block.timestamp`, so the timelock check in `executeLimitProposal` could
  never fail — anyone holding the account key could strip every limit in two
  transactions and drain the account, defeating the whole point of locking
  in. Its sibling `proposeLimitChange` had always set a real delay.
  **On-chain:** upgrade `ProposalSystemModule` in place; no storage change.

- Account recovery now carries the spending limits onto the recovered
  address instead of leaving them behind. Recovery moved the balances to a
  fresh address that had no limits and no committed setup, so the whole
  balance could be withdrawn instantly — the recovery key bypassed every
  lock rather than just replacing the key that controls the account. Spent
  counters and window starts carry across too, so recovering cannot reset a
  daily allowance that was already used up. **On-chain:** upgrade
  `TimePeriodLimitsModule` (new `migratePeriodsTo`), `ProposalSystemModule`
  (new `migrateSetupTo`) and `RecoverySystemModule`; both migrations are
  module-only and refuse a target that already carries rules.
- Recovery into an address that is already locked in is rejected outright.
  The rules cannot migrate onto a wallet that has its own, so the balances
  would otherwise have arrived subject to *that* wallet's limits — letting
  anyone with the recovery key move funds into a second wallet locked under
  looser terms and walk straight out of the tighter ones. An account can now
  only ever be recovered to a single address; repeat calls for the remaining
  tokens must name that same address. **On-chain:** `RecoverySystemModule`
  gains an appended `recoveredTo` mapping.


- A spending period added **after** lock-in now always takes the standard
  24-hour wait; a caller-supplied value is ignored. Adding a period stays
  instant because it only tightens the wallet, but the two together let
  anyone holding the key add a dust-sized hourly limit with a year-long
  wait and freeze the account for that year — every withdrawal has to clear
  every active period, and undoing the hostile one waited its own delay.
  The wait can still be lengthened afterwards through the timelocked
  proposal, so nothing legitimate is lost. Waits chosen during initial
  setup are unaffected. **On-chain:** upgrade `TimePeriodLimitsModule` in
  place; no storage change.
- The maximum unlock delay drops from 365 days to **90 days**, bounding how
  long any wait — chosen by mistake or set hostilely — can keep someone out
  of their own funds. Accounts with no recovery key have no faster way back,
  so this ceiling is their real worst case. The defaults top out at 30 days,
  so nothing in normal use changes. **On-chain:** upgrade
  `TimePeriodLimitsModule` in place; existing delays above the new ceiling
  are not rewritten, but no path can set one again.

### Changed
- Referrers can no longer see **which** wallets they invited — only how many.
  `ReferralModule.getReferredUsers()` (a paginated dump of every invitee
  address) is gone, the invitee no longer appears in the `ReferralRecorded`
  event, and `getReferrer()` now answers only for the caller's own address or
  for an authorized module (fee hooks resolve the referrer at collection time).
  Without this, anyone handing out a referral link could list their invitees and
  read those people's savings balances straight off the chain.
  **On-chain:** in-place `ReferralModule` upgrade (`upgrade-module-proxy.js`),
  no proxy replacement — executed on Optimism, implementation
  `0x31E14c27F8E8ad7f86E7b0B72F14D4174eE84c12`, proxy
  `0x3aa6Df41E3dB7CeeeA335352724B2FE963A2ba06` unchanged. Storage stays
  layout-compatible: the invitee list remains declared but is never written
  again, and `getReferralCount()` sums the new counter with the retired list's
  length, so referrals recorded before the upgrade still count (a full log scan
  of the proxy found none — nothing had to migrate). **Event signature change**
  — `ReferralRecorded(address indexed user, address indexed referrer, uint256
  timestamp)` becomes `ReferralRecorded(address indexed referrer, uint256
  referralCount, uint256 timestamp)`; any indexer reading the old signature must
  be updated.
  This is deliberate friction, not cryptographic privacy — contract storage and
  the lock-in transaction's calldata remain public, so a chain analyst can still
  reconstruct the link. See
  [REFERRAL_INCENTIVES.md](REFERRAL_INCENTIVES.md#8-invitee-privacy) for what is
  and isn't protected, and for the blinded-attribution design that closes the
  rest.
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
- The Ethereum mainnet USDC address in `networkConfig.json` was not USDC
  (`0xA0b86a33…C96f`); corrected to
  `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. Ethereum has no deployed core
  contract, so no user funds were ever routed through the wrong address.
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
- Withdrawing more than you hold now names the shortfall ("Not enough USDT
  in your savings wallet — you have 0 USDT available") instead of surfacing
  the raw revert "Invalid amount". Both adapters check the saved balance
  before sending, on the legacy account and vault paths alike. *Frontend
  only — no contract change.*
- Every failed transaction now leaves the adapter as a sentence, not a raw
  chain failure. EVM revert reasons (~130 of them) and Solana anchor error
  codes are mapped to plain wording, wallet rejections are no longer reported
  as errors, and both adapters wrap their write methods from one declarative
  table so a new method can't silently skip translation. Removes the
  contract-string matching that had crept into `DepositInterface`,
  `WithdrawalInterface` and `WithdrawalAddressSetupStep`, and folds the
  recovery- and limit-specific translators into the shared one. *Frontend
  only — no contract change.*
- Depositing more than your wallet holds is refused before the ERC20
  approval, instead of asking you to sign an approval and then reverting
  inside the transfer with "Failed to deposit. Please check the token
  selection and amount." The same check covers the USDT deposit-address fee
  and Solana deposits. *Frontend only — no contract change.*
