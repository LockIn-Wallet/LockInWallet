# Security

LockIn Wallet is a self-custodial savings wallet whose core promise is:
**your own rules are enforced by contracts, and nobody — including the
maintainers — can change the rules faster than you can leave.**

This document describes the protections that are live today, the current
trust assumptions (stated honestly), and what to do if you find a
vulnerability.

## User-side protections (live, enforced on-chain)

| Mechanism | Delay | What it protects against |
|---|---|---|
| Spending limits (hourly → yearly) | — | An attacker with your key can only drain at your chosen rate |
| Limit increase / removal | that period's unlock delay (default 24h daily, 7d weekly, 30d monthly/yearly) | Instant raising of your own limits by an attacker |
| Unlock delay change | that period's **current** unlock delay, in both directions | Shortening your own wait on impulse, or an attacker doing it for you |
| Post-lock limits freeze | — | All instant limit-override paths revert after lock-in |
| New withdrawal address | 24h request timelock | An attacker adding their own destination and draining to it |
| Emergency bypass (full withdrawal) | that period's unlock delay (24h by default) | Guarantees *you* can always exit completely within your chosen wait |
| Vault penalty withdrawal | instant (penalty applies) | Immediate exit from vaults at a known cost |
| Referral record | written once at lock-in, immutable | Retroactive tampering with attribution |
| Account freeze (recovery key or account key) | instant | Stops every outgoing path the moment a compromise is noticed |
| Unfreeze / ownership recovery | instant, **recovery key only** | Moving the account to a fresh key that the attacker never held |
| Recovery key change from the account key | 30-day cancellable timelock | An attacker with your seed rotating out your recovery key |

The emergency bypass is the cornerstone: whatever happens — including a
contract upgrade you disagree with — you can start a full exit immediately
and have your funds out once that period's unlock delay elapses.

**Unlock delays are yours to choose, and they cut both ways.** Each period
carries its own wait, bounded to 1 hour – 365 days, applied identically to
bypassing that limit and to changing it. Defaults are 24h for hourly and
daily, 7 days for weekly, and 30 days for monthly and yearly. A longer wait
buys stronger protection against an attacker holding your key *and* against
your own impulses — at the cost of your own fast exit. If you set a 30-day
wait on the limit that binds your balance, your exit takes 30 days; the 24h
guarantee above holds only at the default. Choose deliberately: the wait is
itself timelocked, so shortening it later costs you the current wait first.
Delays are per period, so keeping one short-window limit at 24h preserves a
fast partial exit while longer windows stay firmly locked.

## Seed-compromise recovery model

Once a seed phrase leaks, signatures alone cannot distinguish the owner from
the attacker. The recovery system introduces the missing asymmetry: an
optional **cold recovery key** (hardware wallet or offline seed, registered
in advance and never used day-to-day).

Registration is a two-step handshake: the account proposes a recovery key,
and the key activates only after it accepts on-chain — proving the user
controls it and that it can transact. A typo'd or dead recovery key
therefore never gains (or blocks) any power.

The rules are ordered so that defensive actions always outrun offensive
ones:

- **Freeze is instant** and allowed from either key. Worst case an attacker
  freezes the account — that locks funds until the recovery key unfreezes;
  it never moves money.
- **Unfreeze and ownership recovery are recovery-key only.** Recovery moves
  the balances to a fresh address, permanently disables the old one, and
  cancels everything the attacker had queued.
- **The account key can only replace the recovery key through a 30-day
  public timelock** that the recovery key can cancel at any moment — an
  attacker can never outrun the cold key.

Trust assumptions, stated honestly: the protection only exists if the
recovery key was registered **before** the compromise, and it shifts trust
to that cold key — if *both* keys leak, the recovery key wins every race and
can take the account. Store it accordingly (hardware wallet or paper,
offline, separate location). Accounts that never register a recovery key
behave exactly as before. The recovery timelock (30 days) intentionally
dwarfs the 24h bypass and 48h governance delays. Note that a frozen account
deliberately blocks the emergency bypass too — while frozen, the exit path
is ownership recovery via the cold key, not the bypass.

## Upgrade trust model — current state, honestly

The contracts are UUPS-upgradeable. Upgradeability is what lets us fix bugs
and ship features, but it is also the strongest power over the system, so we
document its exact state:

**Today:** upgrades are executed by a single maintainer key. There is no
multisig yet. What protects users today is the *exit asymmetry*: any change
a maintainer makes is public on-chain, and every user can fully exit within
24 hours via the emergency bypass.

**Being rolled out (code complete, in this repository):** an on-chain
governance layer — a Gnosis Safe (audited industry-standard multisig) as
proposer of `SavingsTimelock` (OpenZeppelin TimelockController), which owns
all contracts. Once deployed:

- every upgrade must sit in a **public 48h timelock** before executing;
- the in-app **Governance page** shows the queue with countdowns;
- the invariant we commit to: **governance delay ≥ 2× the emergency bypass
  delay**, so seeing a queued change always leaves enough time to exit.

**Planned:** expanding from a single proposer to an M-of-N signer set — see
[GOVERNANCE.md](GOVERNANCE.md) for the signer-selection design (including
why signers are chosen by role and independence, not by token holdings).

## What an upgrade cannot do quietly

- It cannot execute before the timelock delay elapses (once governance is
  deployed) — the queue is public from the moment of scheduling.
- It cannot bypass the Safe's signature threshold (once expanded to M-of-N).
- It cannot retroactively change these guarantees without itself going
  through the same queue.

## Reporting a vulnerability

Please **do not open a public issue for security bugs**. Email the
maintainer (see the GitHub profile of the repository owner) or use GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guided-security-advisory-creation)
on this repository. We aim to acknowledge reports within 72 hours. Please
include a reproduction; testnet/localhost proofs-of-concept are ideal.

Scope: contracts under `ethereum/contracts/` and `solana/programs/`, plus
any frontend flow that could cause loss of funds. Out of scope: issues
requiring a compromised user device, and the documented trust assumptions
above.

## Verifying what you're running

- Contract addresses per network: `frontend/src/networkConfig.json`
- Release history with on-chain effects: [CHANGELOG.md](CHANGELOG.md)
- Deployment validation: `npm run validate-deployment --workspace=ethereum`
  probes the core kernel and all 9 modules through the on-chain registry.
