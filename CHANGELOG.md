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
