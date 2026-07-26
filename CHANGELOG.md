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

Nothing yet.

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
