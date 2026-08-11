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
| Post-lock limits freeze | — | All instant limit-*loosening* paths revert after lock-in |
| New period added after lock-in | forced to the standard 24h wait | A stolen key adding a dust-sized limit with a year-long wait to freeze the account |
| New withdrawal address | 24h request timelock | An attacker adding their own destination and draining to it |
| Emergency bypass (full withdrawal) | that period's unlock delay (24h by default) | Guarantees *you* can always exit completely within your chosen wait |
| Vault penalty withdrawal | instant (penalty applies) | Immediate exit from vaults at a known cost |
| Referral record | written once at lock-in, immutable | Retroactive tampering with attribution |
| Referral views | count only; no invitee list, no invitee in the event | A referrer using their invite link to find and watch invitees' balances — friction only, not cryptographic ([design](REFERRAL_INCENTIVES.md#8-invitee-privacy)) |
| Account freeze (recovery key or account key) | instant | Stops every outgoing path the moment a compromise is noticed |
| Unfreeze / ownership recovery | instant, **recovery key only** | Moving the account to a fresh key that the attacker never held |
| Recovery key change from the account key | 30-day cancellable timelock | An attacker with your seed rotating out your recovery key |

The emergency bypass is the cornerstone: whatever happens — including a
contract upgrade you disagree with — you can start a full exit immediately
and have your funds out once that period's unlock delay elapses.

**Unlock delays are yours to choose, and they cut both ways.** Each period
carries its own wait, bounded to 1 hour – 90 days, applied identically to
bypassing that limit and to changing it. Defaults are 24h for hourly and
daily, 7 days for weekly, and 30 days for monthly and yearly. A longer wait
buys stronger protection against an attacker holding your key *and* against
your own impulses — at the cost of your own fast exit. If you set a 30-day
wait on the limit that binds your balance, your exit takes 30 days; the 24h
guarantee above holds only at the default. Choose deliberately: the wait is
itself timelocked, so shortening it later costs you the current wait first.
Delays are per period, so keeping one short-window limit at 24h preserves a
fast partial exit while longer windows stay firmly locked. The 90-day
ceiling bounds the worst case: for an account with no recovery key, that is
the longest anyone — including you, by mistake — can be kept from their own
funds.

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
  cancels everything the attacker had queued. It carries the spending limits
  across with them — including how much of each window is already spent — so
  recovery replaces the key that controls an account without ever loosening
  that account's rules. The recovered address is still locked in: changing
  those limits takes the same proposal timelock as before.
- **The account key can only replace the recovery key through a 30-day
  public timelock** that the recovery key can cancel at any moment — an
  attacker can never outrun the cold key.

Trust assumptions, stated honestly: the protection only exists if the
recovery key was registered **before** the compromise, and it shifts trust
to that cold key — **the recovery key alone is enough to move the account**,
the account key is not also required, so treat it as being as sensitive as
your seed. It cannot outrun your limits, though: a recovered account keeps
them, so a stolen recovery key still cannot drain faster than you chose. Store it accordingly (hardware wallet or paper,
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

## Third-party protocol exposure (earning on savings)

Earning is **off until you switch it on, per coin, and never on by default for
a community vault at all.** A vault holds several coins and each earns in its
own market, so the choice is made per coin rather than per vault — a coin with
a prize pool sitting beside one that has only a steady rate cannot be described
by a single setting. A
community vault holds other people's money under rules fixed at creation, so
defaulting it into an outside protocol would commit members who never agreed and
— since those rules cannot change afterwards — leave them no way out. Its creator
opts in explicitly while still its only member, so anyone joining can see the
setting first. While earning is on for a coin, that coin's balance is supplied
to an outside lending protocol (Aave v3). This is the one place where the wallet's
safety no longer depends only on our own contracts, so the honest statement of
the risk:

- **Your principal is exposed to that protocol.** If Aave suffers bad debt, an
  exploit or an oracle failure, savings supplied to it can lose value. Our
  accounting records such a loss as a `deficit` and repays it from future yield
  before anyone earns or is charged, and it never silently reduces your recorded
  balance — but that is bookkeeping, not insurance. **Earning is not
  risk-free.** Leaving it off is a legitimate choice, and the balance then never
  leaves the vault.
- **Withdrawal liquidity is not guaranteed.** Funds are redeemed on demand, with
  no buffer held back (a buffer would cost every user yield without surviving
  the case it is meant to cover). If Aave's reserve is fully utilized or paused,
  a withdrawal **reverts** rather than paying out short. A spending limit you
  cannot exercise is a real cost of earning, and it is why the emergency exits
  below exist.
- **The fee cannot reach your principal.** The management fee is one percentage
  point a year, capped in code at two, and it is funded exclusively from the
  surplus above principal — there is no code path from a deposit to a fee. A
  period that earns nothing is charged nothing, and the shortfall waits rather
  than being taken later from capital.
- **What that fee is as a share of your interest depends on the rate, and can be
  large.** One percentage point of principal is a fifth of a 5% return, but most
  of a 1.5% one. It is capped by what was actually earned, so it can never
  exceed your interest — but in a low-rate year it can be the majority of it.
  The app quotes the rate you receive, net of the fee, rather than the gross.
- **One vault can never spend another's funds, and neither can one coin.** What
  is available is derived from that vault's own recorded balance of that coin
  minus its own invested principal, never from the module's pooled token
  balance. Penalties awaiting a claim are never invested at all — they sit
  outside the figure the yield module is ever offered.
- **Escape hatches:** `pauseStrategies` halts new investment without affecting
  withdrawals; `emergencyExitVault` / `emergencyExitToken` divest everything back
  into the vault module and switch that vault to off. Any owner can switch their
  own vault off at any time, which fully divests it.
- **Prize savings is not available yet** on the unified vault, and the option is
  shown disabled rather than hidden so the choice the product makes is visible.
  What follows describes it as built for the earlier vault module, and applies
  again once it is brought across. **Prize savings carries the same protocol
  exposure, plus two differences worth stating.** Each member has their own position contract, so nobody else's win or
  loss touches theirs, and a member's prize can never be paid out of another
  member's deposit. Prizes are paid in a **different token** from the deposit
  (WETH, not USDC): they are tracked and claimed separately and are never
  swapped, so the wallet takes no price or slippage risk on your behalf. The
  prize fee is a share of what you actually win — a prize vault pays no interest
  of its own, so there is nothing else it could come from, and a member who never
  wins is never charged. A prize position also earns **no steady interest at all**:
  if you never win, you end with exactly what you put in, minus nothing.
- **Known simplification:** a member's yield is credited against the vault's
  recorded balance, which excludes yield not yet folded in. So interest earned
  *by* an unsettled member's interest is shared across all principal holders
  rather than going to that member alone. The effect is small (on the order of
  0.16% a year of principal, shared) and is why `compoundYield` is
  permissionless — anyone, including the app, can settle an idle member's
  accounting at any time.

## What an upgrade cannot do quietly

- It cannot execute before the timelock delay elapses (once governance is
  deployed) — the queue is public from the moment of scheduling.
- It cannot bypass the Safe's signature threshold (once expanded to M-of-N).
- It cannot retroactively change these guarantees without itself going
  through the same queue.
- It cannot take your principal as a yield fee. That is structural rather than
  procedural: the fee is only ever funded from realized surplus, and the rate is
  capped in the contract.
- It **can** point a token at a different yield protocol — this is a genuine new
  power that came with earning. Replacing a live strategy therefore has to be
  queued and wait out a 7-day delay first, so you can see it and switch earning
  off before your funds move. A first-time assignment for a token is immediate,
  because no funds are parked there yet.

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
