# Governance

How changes to LockIn Wallet's contracts are proposed, reviewed, delayed in
public, and executed — and how the signer set is chosen as the project
decentralizes.

## The mechanism

```
M-of-N signers (Gnosis Safe — audited, battle-tested, full web UI)
   └─ SavingsTimelock    (public minDelay, OpenZeppelin TimelockController)
        └─ owner of SavingsCore + every module proxy
```

We deliberately do **not** run a custom multisig — the Safe is the
industry-standard, audited implementation and its UI is how signers review
and confirm. Every owner power — UUPS upgrades, module (de)registration,
cross-reference wiring, treasury configuration — flows through this chain:
the Safe's M-of-N confirmation schedules an action, it sits in **public
view for the full delay** (48h on production), and then **anyone** may
execute it (open executor role) — content approval stays M-of-N; only
timing is free, and the Safe can cancel any queued operation during the
delay.

The one inviolable invariant: **the governance delay must always be at
least 2× the emergency bypass delay (24h)**, so any user who disagrees with
a queued change can fully exit before it executes. That exit right — not
the signer set — is the ultimate user protection.

Tooling: `ethereum/scripts/deploy-governance.js` (timelock deploy +
ownership handover; pass the Safe as `GOV_PROPOSER`) and
`governance-upgrade.js` (validates + deploys the implementation, then
prints the exact transaction to load into the Safe's Transaction Builder;
after the delay it executes the ready operation). Signers review and
confirm in the Safe UI at app.safe.global.

## Release flow

1. Changes merge with entries in [CHANGELOG.md](CHANGELOG.md) `[Unreleased]`,
   stating the on-chain effect of each contract change.
2. Release cut: version + date in the changelog, git tag, GitHub Release.
3. Upgrade scheduled on the timelock, referencing the release tag. The
   in-app Governance page and the on-chain queue show it for the full delay.
4. After the delay: anyone executes the ready operation (open executor);
   frontend deploys in the same window; `validate-deployment` confirms all
   modules respond.

## Decentralization roadmap

| Phase | Proposer | Delay | Status |
|---|---|---|---|
| 0 (today) | single maintainer key, direct | none (users' 24h exit is the backstop) | live |
| 1 | single signer **through the timelock** | 48h public | code complete, rolling out |
| 2 | 2-of-3 Gnosis Safe | 48h public | planned |
| 3 | 3-of-5 Safe, majority external | 48h public | planned |

Phase 1 already changes the trust model meaningfully: even a fully honest
single signer can no longer change anything silently or instantly.

## Signer selection — resisting capture and sybil

The multisig is **identity-based, not stake-based** — and that is a
deliberate design decision. Signers are appointed people/organizations, not
"largest token holders" or "largest depositors." This is the first defense
against the capture scenarios worth worrying about:

**Why not stake-weighted?** If signer seats followed deposits or token
holdings, a whale (or one entity behind many wallets — the sybil case)
could simply buy control of upgrades over a system that holds user funds.
Wealth should buy exactly nothing here. Sybil resistance comes from the
fact that seats are granted to *verified, publicly-known identities* by the
existing signer set — creating ten wallets creates zero seats.

**Selection criteria for a seat:**

1. **Verified independent identity** — a publicly known person or org whose
   reputation is at stake; no anonymous seats.
2. **Independence from other signers** — different employer/organization,
   no financial dependence on another signer; the goal is that no single
   real-world event (company, household, country, hosting provider)
   compromises M seats at once.
3. **Competence to review** — able to actually read a queued upgrade's
   calldata and diff (the Safe UI's decoded transaction and the release
   notes), not just click confirm. At least one seat should be a security
   researcher / auditor profile.
4. **Key hygiene** — hardware wallet, dedicated key (not a daily-driver or
   deployer key), geographic distribution across signers.
5. **No conditional seats** — a seat must never be promised in exchange for
   deposits, investment, or listings; that reopens the whale door
   socially even if not technically.

**Recommended composition at 3-of-5:** 2 core maintainers, 1 external
security researcher, 1 established ecosystem builder unaffiliated with the
team, 1 community-elected member (elected by discussion + reputation, not
by token vote — again to keep wealth out of seat selection).

**Threshold guidance:** M must be > N/2 (no minority control), and N − M
must tolerate at least one lost/unavailable key (liveness). 2-of-3 and
3-of-5 both satisfy this; 2-of-2 (used in testing) does not tolerate key
loss and should not ship to production.

**Signer changes** are Safe owner changes — they require the Safe's own
M-of-N confirmation, so a compromised minority cannot rotate the set.
Changing the timelock's roles (e.g. pointing it at a new Safe) goes through
the timelock queue itself and is publicly visible for the full delay.

## What governance cannot do

- Execute anything without the public delay (once Phase 1 is live).
- Move user funds in one step — no owner function transfers user balances.
  The dangerous power is indirect: **registering a module grants it custody
  access**, which is exactly why `registerModule` sits behind the same
  M-of-N + delay as upgrades, visible in the queue like everything else.
- Shorten your exit: any delay reduction is itself a queued, delayed,
  publicly visible operation.
