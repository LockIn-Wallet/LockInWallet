# Google sign-in, embedded wallets, and sponsored gas

**Status:** proposal — not yet approved or implemented
**Scope:** EVM only (Base first, then Optimism). Solana is out of scope.

## The goal

Someone who has never touched crypto signs in with Google, deposits money, and
starts saving. They never see a seed phrase, never buy ETH to pay a fee, and
never learn what an L2 is. As they get more comfortable — and as their balance
grows — they climb a security ladder at their own pace, ending at a cold
recovery key that the app itself cannot override.

Two questions drive the design:

1. **If the key comes from Google, what happens when they lose Google?**
2. **Who pays the transaction fees, and does that math actually work?**

Both are answerable. Neither is free.

---

## Recommendation in one paragraph

Use **Privy** for login (Google, email, Apple, passkey) and the embedded key it
provisions. Put the savings under an **ERC-4337 smart account** on **Base**,
whose signer set is mutable — so losing Google means rotating a signer, not
losing an account. Sponsor gas with a **paymaster funded from the management fee
already charged on yield**, under a policy that never lets a gas budget block a
withdrawal or a security action. Ship it in phases: the first phase touches no
contracts and gives you Google login on the existing flow.

---

## What you already have that makes this cheap

This codebase is unusually well-positioned for it, in three specific ways.

**A single signer seam.** `frontend/src/utils/providerManager.js:14`
(`createProviderAndSigner`) is the only place a signer is constructed, and
`App.js:734` is its only caller. Everything downstream — `EVMAdapter`,
`TransactionManager`, the whole `services/` layer — takes a signer and is
already agnostic about where it came from. An embedded wallet exposes an
EIP-1193 provider, exactly like MetaMask does. Phase 1 is genuinely small.

**A recovery system that already models the ladder.** `RecoverySystemModule.sol`
implements the hard part: a cold recovery key, instant freeze from either key,
30-day vetoable recovery-key changes from the hot key, and `recoverOwnership` to
a fresh address. The asymmetry documented at the top of that file — defensive
actions instant, offensive actions delayed — is exactly what you want when the
hot key is an OAuth-derived key sitting behind someone's Gmail password. The top
rung of the ladder is already built and tested.

**Permissionless deposit sweeping.** `UserProxy.sweepERC20` can be called by
anyone and always credits the owner. That means a keeper bot can pay the gas to
move an on-ramped deposit into savings — **gasless deposits with no ERC-4337, no
paymaster, and no contract changes at all.** This is the highest-leverage thing
in the whole plan and it lands in Phase 2.

---

## The custody model

The core move is separating *identity* from *keys* from *assets*:

| Layer | What it is | What happens if it's lost |
|---|---|---|
| Identity | Google / email / Apple / passkey login | Use another linked login method |
| Key | Embedded signer provisioned by Privy | Rotate it on the smart account |
| Assets | The ERC-4337 smart account address | Nothing — the address never changes |

Google is an *authentication factor*, not the key and not the account. This is
what makes "restore the wallet if they lose Google" answerable at all. If the
account address were derived from the Google identity, the answer would be "you
can't", and the product would be quietly custodial in the way that matters.

### The security ladder

Each rung is optional, reversible, and prompted by balance rather than by a
nag. The UI should show where someone is on it, and what the next rung buys.

| Rung | Action | Protects against | Prompt at |
|---|---|---|---|
| 0 | Google sign-in | nothing yet — this is the on-ramp | signup |
| 1 | Link a second login (email or Apple) | losing the Google account | first deposit |
| 2 | Add a passkey as a second signer | provider outage, phishing of the OAuth flow | ~$100 |
| 3 | Set a recovery key (`RecoverySystemModule`) | full compromise of the hot key | ~$1,000 |
| 4 | Export the key / self-custody | us | any time, always available |

Rung 1 is the one that actually answers the user's question, and it costs a
single UI screen. Rung 3 is where the product becomes genuinely
non-custodial-with-teeth, and it's already written.

Rung 4 must be present from day one, and must be findable. A product that
onboards people with Google and then makes leaving hard is a worse product, and
saying so in `SECURITY.md` is cheaper than being asked about it later.

### Why a smart account rather than a plain embedded EOA

With a plain EOA, "recovery" means `recoverOwnership` — moving balances to a new
address. That works, but it's lossy (see Blockers) and it changes the user's
deposit address, which breaks any on-ramp or exchange withdrawal they've saved.
With a smart account, recovery means rotating a signer: **same address, same
vault positions, same deposit instructions.** Keep `recoverOwnership` as the
last-resort path, not the primary one.

---

## Phases

> **Decision (superseding the phasing below):** go straight to smart accounts.
> Privy provisions smart wallets natively, so there is no reason to ship Google
> login on plain EOAs first — and doing so would create a cohort that later has
> to be moved between addresses, breaking saved deposit instructions. Phase 1
> and Phase 3 merge: the first auth release is bigger, but no user ever has to
> migrate. Read Phase 1 below as "the provider seam", not as a shippable step.

### Phase 1 — Google login, nothing else changes
*No contract changes.*

- Add Privy; read the app ID from `REACT_APP_PRIVY_APP_ID` and degrade to
  MetaMask-only when it's absent, so the repo stays runnable by anyone who
  clones it.
- Introduce `getActiveProvider()` alongside `createProviderAndSigner` and route
  the direct `window.ethereum` references through it — `App.js` (chain and
  account listeners, `eth_requestAccounts`, `eth_chainId`) and
  `utils/networkIsolation.js:199`. This is the same principle as the adapter
  rule in `CLAUDE.md`: components shouldn't know what kind of wallet they're
  talking to, any more than they know what chain they're on.
- Login screen: "Continue with Google" primary, "Connect a wallet" secondary.

**Done when:** a user signs in with Google and completes the existing setup flow
with an embedded EOA, funding gas manually. Useless as a product, but it proves
the seam.

### Phase 2 — Money in, gas-free
*No contract changes.*

- Fiat on-ramp (Coinbase Onramp or Stripe) delivering USDC straight to the
  user's `UserProxy` address.
- Keeper service watching proxy addresses and calling `sweepERC20` — the keeper
  pays gas, so deposits are free to the user immediately.
- Keeper needs: an idempotent job queue, a funded hot wallet with balance
  alerting, and a per-address rate limit.

**Done when:** someone signs in with Google, pays with a card, and has a savings
balance without ever holding ETH.

### Phase 3 — Smart account and paymaster
*Contract changes required — see Blockers first.*

- ZeroDev Kernel or Safe{Core} 4337 as the account; Pimlico or Alchemy for
  bundler and paymaster.
- Migration path for Phase 1/2 users from EOA to smart account. Non-trivial:
  balances must move via `recoverOwnership` or a fresh deposit, and the proxy
  address changes. Cheaper to hold Phase 1 in a limited beta than to migrate a
  large cohort — worth deciding before Phase 1 ships broadly.
- Batch approve + deposit into a single user operation.

*Alternative:* EIP-7702 delegation keeps the same address and gets batching and
sponsorship without a separate account. It's the smaller change. But the EOA key
stays a permanent root authority that can always re-delegate, which is precisely
the property you don't want when that key sits behind an OAuth session. For a
savings product, the mutable signer set is worth the extra work.

### Phase 4 — The ladder in the UI
Second login method, passkey as co-signer, recovery-key setup wired to
`RecoverySystemModule`, key export. Balance-triggered prompts, dismissible,
never blocking.

### Phase 5 — Economics and controls
Paymaster policy, budget caps, circuit breaker, monitoring, treasury refill
automation. Detailed below.

### Phase 6 — Documentation
Required by the release rules in `CLAUDE.md`, and genuinely load-bearing here:
`SECURITY.md` (new trust assumptions — Privy, the OAuth provider, the paymaster
operator), `GOVERNANCE.md` (who controls the paymaster policy and under what
delay), `CHANGELOG.md`, and `frontend/src/releaseNotes.js`.

---

## The gas economics

### What it costs

A sponsored ERC-4337 user operation on Base runs roughly **$0.02–$0.05** —
EntryPoint and verification overhead put it at 3–5× a bare transfer. It spikes
when the L1 blob market is congested, so budget on the high end. Use **$0.03**
as the planning number.

A typical saver, per year: ~12 deposits, ~4 configuration changes, ~2
withdrawals ≈ **18 operations ≈ $0.55/user/year**.

### What funds it

`VaultYieldModule` already charges a management fee on yield, capped at 200 bps
(`MAX_FEE_BPS`). That fee is the natural funding source — gas sponsorship is a
cost of holding AUM, and it should scale with AUM.

At 4% APY and a 2% management fee, revenue is **0.08% of balance per year**.

| Balance | Fee revenue/yr | Gas cost/yr | Net |
|---|---|---|---|
| $250 | $0.20 | $0.55 | −$0.35 |
| $700 | $0.56 | $0.55 | ~break-even |
| $2,000 | $1.60 | $0.55 | +$1.05 |
| $10,000 | $8.00 | $0.55 | +$7.45 |

**Break-even is around $700 at a 2% fee, or ~$1,400 at 1%.** Small balances are
subsidised by large ones, which is fine and normal — but it means unconditional
sponsorship is a real cost, not a rounding error, if you attract a lot of $50
accounts. Note also that the fee accrues in USDC while the paymaster spends ETH,
so the treasury needs a recurring swap, not just a balance.

### The policy

Three tiers. The first one is not negotiable.

**Always sponsored, no conditions, no budget check:**
withdrawals to an already-approved address, `freeze`, and every recovery
operation. A gas budget must never be the reason someone can't get their money
out or can't secure a compromised account. Fund this tier separately from the
growth budget so it cannot be exhausted by the other two.

**Sponsored while it pays for itself:**
deposits and configuration, when balance ≥ threshold (start at $250 and tune) or
within an onboarding allowance of the first 10 operations / 90 days. The
allowance is customer acquisition cost — about **$0.30 per signup**, which is
cheap next to any other acquisition channel.

**Paid in USDC otherwise:**
an ERC-20 paymaster deducts the gas from the user's balance. They still never
buy ETH; they just pay cents from money they already hold. Show it as an
explicit line item — a savings product that silently skims is not one people
should trust.

### Abuse controls

Sponsored gas is a public subsidy, so assume someone will try to drain it.

- Paymaster policy restricted to your contract addresses **and** an explicit
  function-selector allowlist. Not just the addresses.
- Per-account daily operation cap.
- Global daily budget with an automatic circuit breaker.
- Sybil deterrent: beyond the onboarding allowance, sponsorship requires a
  settled deposit.
- Alerting on paymaster ETH balance with automated top-up from treasury USDC.

---

## Blockers found in the current code

These are real and were verified in the source, not anticipated.

**1. `.transfer()` breaks smart accounts. — FIXED.** Seven sites sent ETH with
the 2300-gas stipend. The five in `SavingsCore` and the one in
`BypassSystemModule` now use `Address.sendValue`, covered by
`test/SmartAccountWithdrawals.ts`. `UserProxy.sol:71` is deliberately left
alone: its creation code determines every user's CREATE2 deposit address, so
changing it moves those addresses. Fixing it needs a migration — deploy every
outstanding counterfactual proxy under the old bytecode first, then upgrade —
and the only thing it costs today is `emergencyWithdraw` of native coin from a
proxy owned by a contract wallet, which is a rescue path for an asset the
product barely handles.

Found while fixing it: `getUserDepositAddress` recomputed the counterfactual on
every call rather than returning the deployed proxy, so *any* future change to
`UserProxy` would have silently handed existing users a different address than
the one they hold, with deposits sent there unreachable. Now fixed, which is
what makes a `UserProxy` migration feasible at all.

**2. `recoverOwnership` doesn't migrate everything.** `_migrateSpendingRules`
(`RecoverySystemModule.sol:269`) calls `migratePeriodsTo` and `migrateSetupTo`
only. Vault membership (`vaultMembers`, `userVaultIds` in `VaultSystemModule`),
withdrawal addresses, and yield positions are not carried across — even though
`ApprovalSystemModule` has `migrateWithdrawalAddresses` and
`migrateApprovalAddress` available and unused on this path. So a recovered user
keeps their limits but silently loses their vaults. This needs verifying against
the recovery tests, and it strengthens the case for signer rotation over address
migration as the primary recovery route.

**3. `window.ethereum` is referenced directly in several places** outside the
provider seam (`App.js` and `utils/networkIsolation.js:199`). Small, but it has
to be routed through the abstraction in Phase 1 or the embedded wallet will
half-work in confusing ways.

---

## Open questions

- **Privy vs. Turnkey.** Privy is faster to ship and handles login-method
  linking (rung 1) out of the box. Turnkey gives more control and less lock-in
  but is meaningfully more build. Recommendation: Privy for v1, with key export
  as the exit hatch.
- **Where does the deposit address get generated?** Firing a transaction the
  moment someone connects a wallet means an unexplained confirmation popup at
  the least welcome moment. Generating it inside a flow the user is already
  transacting in — setup commit, vault creation — costs them nothing extra.
  Once the keeper sponsors it, the question disappears: it happens invisibly.
- **Fee rate.** The break-even math above assumes 2%. At 1% the subsidy roughly
  doubles in duration.
- **Regulatory.** A fiat on-ramp plus gas sponsorship plus OAuth identity is a
  different posture than a pure self-custody DApp. The on-ramp provider handles
  KYC, but the Google identity ↔ address mapping is personal data under GDPR,
  and production OAuth verification requires a privacy policy and an owned
  domain regardless.

---

## On being open source

Being open source doesn't complicate any of this. A browser app uses Google's
public-client OAuth flow (authorization code + PKCE), where the client ID is
*meant* to ship in the bundle and there is no client secret to leak. Security
comes from the authorized-origin and redirect-URI allowlist in Google Cloud,
which someone forking the repo cannot change.

What must stay out of the repo is the same as in any closed-source app: keeper
and paymaster private keys, any confidential-client secret, and provider API
keys with billing attached. Read the Privy app ID and Google client ID from env
vars and degrade gracefully when absent, so a fork runs locally without them.
