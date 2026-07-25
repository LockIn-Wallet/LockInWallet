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
| Spending limits (daily/weekly/monthly) | — | An attacker with your key can only drain at your chosen rate |
| Limit increase / removal | 24h proposal timelock | Instant raising of your own limits by an attacker |
| Post-lock limits freeze | — | All instant limit-override paths revert after lock-in |
| New withdrawal address | 24h request timelock | An attacker adding their own destination and draining to it |
| Emergency bypass (full withdrawal) | 24h request timelock | Guarantees *you* can always exit completely within a day |
| Vault penalty withdrawal | instant (penalty applies) | Immediate exit from vaults at a known cost |
| Referral record | written once at lock-in, immutable | Retroactive tampering with attribution |

The emergency bypass is the cornerstone: whatever happens — including a
contract upgrade you disagree with — you can start a full exit immediately
and have your funds out in 24 hours.

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
  probes the core kernel and all 8 modules through the on-chain registry.
