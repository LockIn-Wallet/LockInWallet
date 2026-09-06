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
- Sign in with a passkey. Face ID or a fingerprint creates a wallet — no
  extension, no seed phrase, no password — and the passkey follows the user to
  their other devices through the Google or Apple account already signing them
  in. It is a Coinbase Smart Wallet: an ERC-4337 account whose signer is the
  passkey, so the signer can be rotated later without the address, balance or
  deposit instructions changing. Pressing connect now asks which way in, but
  only when an extension is installed and there is a real choice to make;
  without one, signing in happens directly. *Frontend only — no contract
  change.*
- Sponsored network fees for signed-in users, via ERC-7677. A passkey user
  holds no ETH, so every action would otherwise ask them for a coin they have
  never heard of. `utils/sponsorship.js` wraps the signer at the single place
  one is created, so every contract call is sponsored without a call site
  changing, and returns the signer untouched whenever sponsorship is
  unavailable — a user who brought their own ETH is on exactly the path that
  already worked. **Requires `REACT_APP_PAYMASTER_URL` and, server-side,
  `PIMLICO_API_KEY`; absent, everyone simply pays their own fees.**
- `frontend/api/paymaster.js`, a proxy holding the paymaster key. A key in the
  bundle is public to every visitor, so it lives in a server environment
  variable instead. It also decodes what a user operation would call —
  unwrapping `execute` and `executeBatch` — and refuses anything targeting a
  contract that is not ours, reading the allowlist from the on-chain module
  registry so a module upgrade cannot silently stop its calls being sponsored.

### Added
- Locked vaults. New immutable contracts under `ethereum/contracts/locks/`:
  `LockedVault` (one per lock; holds any ERC20 or the native coin, releases
  everything to its owner once `isUnlocked()`, no owner or admin functions),
  `LockedVaultFactory` (CREATE2 deployer, ten-year horizon, and the registry
  of verified conditions), and the conditions `DateCondition`,
  `PriceCondition` (Chainlink feed, threshold, direction, staleness bound),
  `AllOfCondition` and `AnyOfCondition`. Every lock carries a hard deadline
  so a dead feed can only delay funds, never strand them. *New deployment,
  not a module: nothing is registered in `SavingsCore`, nothing is
  upgradeable, and no existing storage changes. The factory address lives in
  `frontend/src/networkConfig.json` as `lockedVaultFactory`; deploy with
  `npm run deploy-locks --workspace=ethereum`.*
- Locked vaults in the app: a "Locked vaults" section on the dashboard to
  create a lock (on a date, or when a verified price is reached), deposit any
  listed or custom token into it, and release it once open; a public proof
  page at `/lock/:chain/:address` readable without a wallet; and a creators
  landing page at `/proof-of-lock`. The adapter exposes `supportsLocks`,
  `getLocks`, `getLock`, `createLock`, `depositToLock` and `releaseLock`.
  *Frontend only beyond the contracts above.*
- A security and technology page at `/security`, holding every implementation
  detail the home page used to carry: the live enforcement console, the three
  checkable facts, the stolen-key simulation, the wallet comparison, the trust
  model with the upgrade disclosure, the chain list, and a technical FAQ that
  says plainly there has been no audit. *Frontend only — no contract change.*
- Two long-form guides, served as static HTML like the existing ones, for the
  searches "how to stop impulse buying" (`/impulse-buying`) and "how to stop
  impulse shopping" (`/impulse-shopping`). Each takes a different angle — the
  moment of purchase versus the browsing habit — and every static guide now
  cross-links the full set, links to `/security`, and no longer claims Solana
  support. Both are in the sitemap alongside `/security` and `/signing-in`,
  which were missing from it.
- A sign-in explainer at `/signing-in`, written for someone who has never held
  crypto: what happens when you press the button, how an email code and a
  passkey differ, using the same savings on a second device, and — the question
  everyone asks first — what to do when a phone is lost. Linked from the footer
  and from the dialog where the choice is made.

  It states the privacy consequence rather than burying it: an email code
  leaves Coinbase holding an email address linked to a public wallet address, a
  record that can be requested from them, whereas a passkey shares nothing that
  names anyone. And it says outright that we cannot verify what holds the
  signing key on the email path — Coinbase describes these wallets as
  self-custody with keys in secure hardware, and we link to their documentation
  rather than repeating a guarantee we have no way to check. *Frontend only —
  no contract change.*

### Changed
- SECURITY.md and GOVERNANCE.md state locked vaults as the deliberate
  exception to the exit-right invariant: no bypass, no penalty exit, and no
  upgrade path, so nothing to escape from. The home page and `/security` FAQ
  carry the same qualifier.
- The home page is rewritten for someone who has never held crypto and searched
  for "a savings account you can't withdraw from". It now says what the account
  does (an allowance, a wait, nobody who can waive either), the four setup
  steps, who it is for — each card leading to the matching guide — and a plain
  FAQ, and ends with a link to `/security`. The proof strip, enforcement
  console, stolen-key simulation, comparison table, trust grid and chain list
  moved to `/security` unchanged. The page title and metadata target the same
  search. *Frontend only — no contract change.*
- The connect dialog asks which kind of person you are rather than which
  technology you would like: "Email sign-in", badged *New to crypto*, against "I
  already use crypto — use MetaMask or another wallet", badged *Most private*.
  Each carries a logo and states its own cost. The easy one says outright that
  it needs no Coinbase account but leaves Coinbase holding an email address
  linked to a wallet; the private one says outright that losing your key is
  nobody else's problem to solve. Naming the trade-off is the point — a newcomer
  cannot weigh a choice whose consequences live only in a security document.

  The label reads "Most private" rather than "Anonymous" on purpose: no email
  and no account is genuinely the more private of the two, but a wallet address
  is public by design and its RPC still sees an IP, so anonymity is not on
  offer and is not claimed.

- Base is the default network instead of Optimism. Optimism was first because
  existing savings lived there and a moved default would have shown returning
  users an empty wallet; it now holds no vaults and Base does, so that
  reasoning has reversed. Base is also where a card on-ramp sells dollars
  directly, which is the route someone arriving without crypto takes. Nothing
  moves on its own — this only picks the starting network, and savings on
  Optimism stay there and remain one switch away.

### Fixed
- `window.ethereum` is no longer read directly from eighteen places. Which
  wallet the app is talking to now has one answer (`utils/walletProvider.js`),
  which is what let an embedded wallet drop in at all. Found while moving it:
  `getBestProvider` called `eth_accounts` without awaiting, so the branch never
  ran and every read quietly fell through to the public RPC instead of the
  connected wallet. *Frontend only — no contract change.*
- A wallet whose RPC is rate-limited no longer blocks the whole connection.
  Reads fall back to a configured endpoint that is probed before being adopted,
  and when nothing on that chain answers the error names the network rather
  than sending someone hunting through wallet settings.
- The app no longer sends the wallet to a local chain that is not running. In
  development it preferred localhost whenever `networkConfig` carried an
  address, which only records that some past deploy happened — anyone cloning
  this repo hit a dead chain they never configured.
- Every wallet is no longer called MetaMask. The connected-wallet label reads
  the wallet actually in use, and the copy across four screens says "wallet"
  rather than naming an extension a signed-in user does not have.

## [0.4.0] - 2026-08-13

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

- **Disconnect** button next to the connected address in the status header,
  on both EVM and Solana. It clears the session, drops that wallet's cached
  network and vault entries (`clearNetworkStorage`, `clearVaultCache`) and
  returns to the logged-out home page. Because neither MetaMask nor the
  Solana wallet adapter can be told to forget a site, a `wallet_logged_out`
  flag (`frontend/src/utils/walletSession.js`) suppresses the silent
  auto-connect and the adapter's `autoConnect` until the user connects
  again — otherwise a reload would re-attach the same wallet within seconds.
  Frontend only — no contract change.
- `VaultRulesModule` now serves the **unified vault**, not the old
  `VaultSystemModule`. It looked membership up in the old module, so changing a
  spending limit on a vault created by locking in reverted with "Not a vault
  member" — the timelocked rule change was unreachable for every new vault.
  A module cannot look membership up in two places at once, so rule changes for
  the old module's vaults are no longer served; those vaults hold nothing and
  the module is being retired behind the unified one.
- **Locking in now creates the savings vault itself.** The main wallet is a
  vault, so setup produces one rather than writing to a separate account with
  its own custody and its own copy of the limit logic. It is a stablecoins
  vault holding every dollar-pegged coin the network offers, under one dollar
  cap. Which coins count as dollars is a **frontend** list
  (`frontend/src/utils/stablecoins.js`) and deliberately not a contract's: a
  contract cannot know what is pegged without an oracle or a governed list, and
  both put something in the enforcement path. Adding a coin is one line there
  plus a `networkConfig` entry; coins the network has no address for are left
  out, so a vault never accepts something nobody can send. `createVault` takes
  the referrer so lock-in stays a single transaction — recorded best-effort, so
  a stale invite link can never be the reason someone cannot start saving.
  Percentage caps are refused for this vault, because a percentage of a mixed
  balance would need the coins priced against each other.
- The deposit and withdrawal coin pickers now offer only what the selected
  vault actually holds, and the native-coin option appears only for a vault
  that takes it. A vault refuses coins it was not created with, so the old
  full-network list offered transactions guaranteed to revert. A vault that has
  not loaded yet leaves the full list on offer rather than emptying the picker,
  because an empty picker blocks a deposit just as thoroughly as a wrong one.
- The logged-in vault list no longer fabricates a "Savings" card. Locking in
  creates the savings vault, so it is a real card with real limits and a real
  balance behind it. The placeholder card remains only for a wallet that locked
  in before vaults existed, whose balance is still held by the account.
- Vault balances are reported **per coin**. The old path formatted one symbol
  and one amount, which was only ever right for a one-coin vault and silently
  hid everything else. Deposits, withdrawals and penalty withdrawals now carry
  the coin the user chose instead of dropping it.
- **A stables vault can accept another coin after it exists**
  (`addAcceptedToken`). The accepted set was written only at creation, so a
  stablecoin added to the app's list later was reachable only by vaults created
  after it — everyone else would have had to start again. The cap does not
  change: it is denominated in dollars across whatever the vault holds, so a new
  coin shares the existing allowance rather than adding to it, and it starts
  with earning off like any other. Refused for a single-coin vault, whose one
  asset is what makes its cap mean anything, and for a community vault once
  anyone else has joined — people join under a cap spanning a known set of
  coins, and one that fails to hold its peg breaks that accounting for all of
  them.
- **The pre-vault account is no longer reachable from the app.** Locking in
  creates a savings vault, so `_usesLegacyAccount()` and its 28 branches are
  gone: balances, limits, deposits, withdrawals, proposals, bypasses and
  withdrawal addresses all go to the vault, with no second path behind them.
  `isSetupCommitted()` is now simply "do you have a vault" on both chains
  rather than returning null on EVM so the account could be asked. The
  fabricated "Savings" card is gone from the vault list.
  **A balance still sitting in `SavingsCore` is not destroyed** — it remains
  on-chain and a script can still reach it — but nothing in the UI will show or
  move it. Measured before removing: total custody across both chains was
  $0.0432, all of it one developer wallet.
  Removing the branch exposed a bug it had been hiding: the withdrawal-address
  methods were passing a vault address into adapter methods that take
  `(destination, title)`, so the vault landed in the destination's slot. That
  list is keyed by the member's own address and shared by every vault they own
  — where money may go is a property of the person, not the asset — so the
  interface no longer takes a vault at all.
- **Earning is released.** `isYieldEnabled()` is now true and no longer reads
  the environment. The flag was never the real gate: the adapter reports
  `supported: false` for a network with no vault yield module registered, and
  every earning surface renders nothing in that case — so on a chain where
  earning is not deployed, this changes nothing. The real switch is
  `registerModule("VAULT_YIELD", …)`, and `RELEASING.md` now spells out the
  order that has to precede it: treasury pointed at the Safe, then verified
  strategies, then registration. Done in the wrong order, money moves into a
  protocol before the guard rails exist. Prize savings stays off.
- **One savings primitive: `SavingsVaultModule`.** The main wallet and a
  single-coin pot are now the same thing — a vault — instead of a savings
  account with its own custody and its own copy of the limit logic sitting
  beside a separate vault system. A vault is one of two kinds, and the
  difference is forced by what a limit can honestly mean: STABLES holds
  several dollar-pegged assets under one cap (dividing out each token's
  decimals restates them all in the same dollars, so no price feed is
  involved), while COIN holds exactly one asset and caps it in that asset or
  as a share of the balance. Pricing volatile assets against each other would
  put an oracle in the enforcement path of a wallet whose whole promise is
  enforcement, so neither kind does it.
  **On-chain:** a **new** `SavingsVaultModule` proxy registered as
  `SAVINGS_VAULTS`. Limits, timelocked changes, bypasses and withdrawal
  addresses are not reimplemented — they are the savings account's own
  modules, keyed by a scope derived from `(vaultId, member)`, so a vault's
  rules behave exactly as an account's because they *are* an account's. The
  withdrawal-address list is keyed by the member's real address, so every
  vault a person owns shares one list: where money may go is a property of
  the person, not the asset.
- **Emergency bypass on the unified vault.** `requestBypass` /
  `executeBypass` / `cancelBypass` are the other way past a limit, and the
  honest one: instead of paying the penalty you wait, and the wait is the
  limit's own — a limit committed with a seven-day wait cannot be escaped in
  less than seven days. The request and its timer live in
  `BypassSystemModule` under the same scope as the vault's limits, so this is
  the account's bypass rather than a second implementation of it. Only the
  payout is in the vault module, because only it holds the money. A request
  records which coin it was made against, since a stables vault's amount is
  measured in dollars and the payout has to know what to send.
- **Permanent deposit addresses on the unified vault**
  (`SavingsVaultDepositProxy`). An exchange withdraws to an address, not to a
  contract call, so without one you have to route money through your own wallet
  first — two steps, and a window where the savings rules do not apply to it
  yet. The address is bound to a **member**, not to the vault, so in a shared
  vault an arriving transfer credits the person it came from rather than
  whoever created the pot. It is CREATE2-derived from `(vaultId, member)` and
  `depositAddressOf` answers before anything is deployed, so the address can be
  published first and paid for later; money that arrives in the meantime waits
  and is swept in. Sweeps are permissionless, because every path ends at the
  same beneficiary's balance in the same vault — which also means a stuck
  transfer can be rescued without the member needing gas. The factory lives in
  its own `VaultDepositAddressModule`: predicting an address means holding the
  proxy's whole creation code, which cost the vault module 2.7KB and left it
  inside 4KB of the 24KB ceiling — the same slope the old `VaultSystemModule`
  slid down until it would not deploy. Nothing in the factory can move money.
- **Early exit with a penalty, on the unified vault.** `withdrawWithPenalty`
  is the pressure valve that keeps a limit honest: a member can always get past
  it, but only at the rate the vault was created with, and the money goes to
  whoever stayed. Penalties are kept per **(vault, token)** for the same reason
  earning is — a stables vault charges the penalty in whichever coin was pulled
  out, and paying a USDC penalty out of the DAI pot would take from people who
  had nothing to do with it. A personal vault has nobody to share with, so its
  penalty goes to the treasury. Penalties are never invested: they sit outside
  `vaultTotals`, which is exactly the figure the yield module offers to a
  strategy, so `claimPenaltyRewards` never has to redeem anything to pay out.
- **Earning across the unified vault (`VaultYieldModule`).** Earning is now
  keyed per **(vault, token)** rather than per vault. A stables vault holds
  several assets at once and each earns in its own market — USDC's Aave
  reserve knows nothing about DAI's — so a single per-vault position could
  not represent it. Switching earning off divests the whole position,
  earnings included, rather than merely stopping new investment. A community
  vault's earning setting can only be chosen while the creator is still its
  only member, so nobody's money is routed into an outside protocol after
  they joined on other terms. The fee guarantee is carried over unchanged and
  is still structural: one percentage point of the rate, funded only from the
  surplus above principal, capped by the yield actually realized, with the
  shortfall waiting in `feeDebt` and a protocol loss repaid before any fee.
- **Earning on vault balances.** A vault holding a supported stablecoin can
  supply its idle balance to Aave v3 and share the interest across its members.
  The owner picks stable earning, prize savings or off from the new "Earn on your
  savings" section; the whole feature ships behind `isYieldEnabled()` in
  `frontend/src/utils/featureFlags.js`, currently off.
  **On-chain:** a **new** `YieldModule` proxy registered as `YIELD_SYSTEM`, plus
  a non-upgradeable `AaveV3Strategy` per token per mode. Strategies are
  owner-set, and *replacing* a live one must be queued and wait out
  `strategyChangeDelay` (7 days) first, so users can exit before their funds are
  pointed at a different protocol. `VaultSystemModule` is upgraded **in place**
  with exactly one appended storage slot (`yieldModule`) — nothing reordered, no
  struct changed, and custodied vault funds untouched. Deposits and withdrawals
  now route through the module: a deposit invests that vault's idle balance, a
  withdrawal redeems only the shortfall it cannot cover from that vault's own
  idle share (so one vault can never spend another's), and penalties awaiting a
  claim are never invested at all.
- **Yield fee: one percentage point of the rate, and never more than what was
  earned.** `managementFeeBps` (100, capped at 200 in code) accrues
  time-weighted on principal and is routed to the existing
  `VaultSystemModule.treasury` — no second treasury address. The cap is
  structural, not just arithmetic: the fee is funded exclusively from the
  surplus above principal, so there is no code path from a user's deposit to a
  fee. A period that earns nothing charges nothing; the shortfall waits in
  `feeDebt` and settles out of later yield. A realized protocol loss is recorded
  as a `deficit` and repaid from future yield **before** any fee, and never
  reduces a member's recorded balance.
- Yield is distributed per vault through an `accYieldPerShare` accumulator
  mirroring the existing penalty accumulator, at `1e18` precision (deliberately
  not the penalty accumulator's `1e12`, which would truncate a small harvest on a
  6-decimal stablecoin to zero and lose it). Settled yield becomes principal
  inside the same position, so it compounds with no extra transfer.
  `compoundYield(vaultId, member)` is permissionless.
- **Earning is on by default only for vaults created from the on-chain watermark
  forward** (`yieldEnabledFromVaultId`). Locking in does not create a vault on
  EVM, so there is no vault at that moment to attach a preference to; the
  watermark is what makes "on by default" possible without touching anything
  already in custody. Vaults that predate it stay off until their owner opts in,
  and in every case funds only move on the next deposit.
- Percentage spending limits now apply to compounded yield, because settled yield
  lands in `member.balance` — a 10% daily limit on a balance that grew to 1100 is
  110, not 100.
- `AaveV3Strategy` is verified against the **live** Aave v3 pool on Optimism over
  a fork (`npm run test:fork`, opt-in via `FORK_OPTIMISM=true` so the default
  suite stays offline). It pins the two things a mock cannot: that
  `AaveReserveData` still matches Aave's `getReserveData` struct — confirmed at
  15 words with `aTokenAddress` at index 8, so a future Aave reshape would be
  caught rather than silently quoting every user 0% — and that supply/withdraw
  round-trip through the real pool.
- **Fixed before shipping, found only by that fork test:** Aave reports
  `balanceOf` as `scaledBalance * liquidityIndex` rounded down, so supplying
  1,000,000,000 USDC leaves a position worth 999,999,999. The strategy's
  exact-receipt check rejected that, which would have made **every real deposit**
  fall back to idle. It now tolerates two units of rounding — still far below any
  fee-on-transfer loss — and issues shares against the amount actually credited,
  so the rounding cannot dilute other vaults in the same strategy. The unit is
  recorded as a deficit and repaid by the first interest, never taken from a
  member's balance. `MockAavePool.setSupplyShortfall` reproduces both this and a
  lossy token in the offline suite.
- **Community vaults are never defaulted into earning.** The watermark applies to
  personal vaults only. A community vault holds other people's money under rules
  fixed at creation, so defaulting it into Aave would commit members who never
  agreed and leave them no way out — `setVaultYieldMode` rejects community vaults
  once anyone else has joined. Its creator now opts in while still the only
  member, so members see the setting before joining, exactly as they do the
  penalty rate and the limits.
- Earning applies **regardless of balance or deposit size** — there is no minimum
  anywhere, by design. An amount too small to buy a single strategy share is left
  idle and swept in with the next deposit rather than stranded.
- `YieldDeficit` is only emitted once the shortfall exceeds a millionth of the
  vault's principal, so Aave's routine one-unit rounding no longer reads as a
  protocol loss in monitoring. The deficit itself is still recorded in full.
- **Prize savings**, via a new `PoolTogetherStrategy`. Two facts about
  PoolTogether v5, both verified against the live Optimism deployment rather than
  assumed, shaped it:
  - **Odds are per depositing address.** So each member gets their own
    `PrizePosition` (an EIP-1167 clone) and their own real odds, including a real
    shot at the grand prize. A shared position would have made every member one
    large depositor whose prizes had to be split — a variable bonus rate, not a
    lottery. This is why the yield hooks are now member-aware.
  - **Prizes are paid in a different token from the deposit** — WETH, not USDC
    (`prizeToken()` on the live pool) — and are *not* claimed by the depositor.
    Only the prize vault may call `claimPrize`, third-party claimer bots do it,
    and the token is transferred straight to the winner. So a position never
    claims; prizes simply arrive and are swept. Members' winnings are therefore
    tracked and claimed **separately** from their balance, never swapped and
    never folded into the USDC ledger.
  The prize fee is a flat share of each prize claimed (500 bps, capped at 1000),
  which is the only thing it could come from: a prize vault pays no rate. A
  member who never wins is never charged.
- Prize savings reuses the prize vault **already configured in production**:
  `PoolTogetherModule.prizeVaults(USDC)` on the live SavingsCore points at
  PoolTogether's `przUSDC` (`0x03D3CE84…`), sharing prize pool
  `0xF35fE10f…`. `add-yield-module.js` records both, so the new strategy points
  at the same venue rather than introducing a second one.
- `PoolTogetherStrategy` is verified against that **live** vault over a fork
  (`npm run test:fork` now runs both fork suites). It pins what a mock cannot:
  that the configured vault really is an ERC4626 over USDC sharing the expected
  prize pool, that prize-vault shares do **not** appreciate (1,000 USDC in →
  1,000 USDC withdrawable, because the yield funds the draw), and that two
  members hold genuinely separate positions against the real TWAB-tracking
  vault — the property the per-member design exists to buy.
- Corrected `IPrizePool`: the old module declared `claimPrize(address,uint8)`,
  whose selector is **absent** from the deployed v5 prize pool — it only ever
  worked against the mock. The real one takes six arguments, and we now do not
  call it at all.
- Escape hatches for the new third-party dependency: `pauseStrategies` stops new
  investment without affecting withdrawals, and `emergencyExitVault` /
  `emergencyExitToken` divest everything back into `VaultSystemModule` and set
  the vault to off. A withdrawal that the protocol cannot fund reverts
  ("Insufficient strategy liquidity") rather than paying out short, and a
  protocol that refuses a deposit leaves the funds idle rather than failing the
  user's deposit.

- **Base (chain 8453) as a deployment target**, selectable in the network
  dropdown alongside Optimism. The reason is the card on-ramp: Transak sells
  no stablecoin on Optimism — only ETH — so buying USDC directly into a
  locked wallet needs a chain where USDC is actually purchasable. **On-chain:**
  a new, independent deployment of the full module set at
  `0xA827CDB73b986e987fA88B8f5471ECa25E8b9d63`, tracked in
  `ethereum/.openzeppelin/base.json`. It shares Optimism's address only
  because the deployer's nonce sequence lined up; the two chains hold
  separate state and are upgraded separately. Optimism stays the default
  network so returning users are not silently moved off the chain their
  savings are on. Base USDC/USDT/DAI addresses were verified by calling
  `symbol()` and `decimals()` on Base mainnet.

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
- Pressing connect with no wallet extension installed now opens an onboarding
  dialog instead of `alert("Please install MetaMask!")`. It explains, in plain
  words, what MetaMask is, that it is the login, what a chain is, and why this
  one is Optimism — then links to the download and warns that the 12-word
  phrase is the money. The connect button also stays visible without an
  extension (it used to render nothing at all, leaving a first-time visitor
  with nothing to press). Copy lives in
  `frontend/src/utils/walletOnboardingContent.js`. Frontend only.

### Fixed
- **Referral links no longer leak a wallet address to Google Analytics.** A
  referral link is `/?ref=<referrer address>`, and the GA tag sat in
  `index.html`, firing before React could scrub it — so every visit from a
  referral link reported a real address to Google, joined to that visitor's IP
  and device, and put it in the `Referer` header of GA's own request. Because
  the chain is public, an address is not an anonymous token: it reads straight
  through to that person's balance and full history. This is the same leak
  closed on-chain by removing `getReferredUsers()`, left open in the browser.
  `?ref=` is now stripped from the address bar the moment it is captured (other
  query parameters and the hash survive), GA boots from
  `frontend/src/utils/analytics.js` only after that, any address in a reported
  URL is redacted as a backstop, and Google Signals plus ad personalisation are
  switched off. Frontend only; no contract change. **Note:** addresses already
  sent to GA stay in Google's data until the property's retention window
  expires — that clean-up is a console-side action, not a code change.

### Changed
- The home page no longer states a flat "24 hours" time to full exit. Since
  each limit carries its own wait, the proof strip, the trust card and the
  "how it works" step now say the exit takes the delay the user chose —
  24 hours to 3 months — and that nobody can lengthen it after the fact.
  The "Live on Optimism" note now explains what Optimism is: an Ethereum
  layer 2 that settles onto Ethereum for its security while costing cents
  per transaction. Copy only, no contract change.
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
- Native withdrawals to contract wallets no longer revert. Every native send in
  the core used `address.transfer()`, which forwards a 2300-gas stipend — enough
  for an EOA, but not for a contract wallet (a Safe, or an ERC-4337 account),
  whose `receive()` does real work. Any such account could deposit but could
  never withdraw its native balance. All five sends in `SavingsCore` and the one
  in `BypassSystemModule` now use OpenZeppelin's `Address.sendValue`, which
  forwards the remaining gas. **On-chain:** upgrade `SavingsCore` and
  `BypassSystemModule` in place; no storage changed. Because `sendValue`
  forwards all gas, the two module-facing entry points that lacked one
  (`withdraw(address,uint256,address)` and `withdrawAll(address)`) now carry
  `nonReentrant`; both already followed checks-effects-interactions.

  `UserProxy` carries the same pattern in `emergencyWithdraw` and is deliberately
  left alone: its creation code determines every user's CREATE2 deposit address,
  so changing it would move those addresses. Fixing it needs a migration, not an
  edit.

- A user's permanent deposit address is now read from the deployment record
  rather than recomputed on every call. `getUserDepositAddress` derived the
  CREATE2 address from `UserProxy`'s creation code as of the current
  deployment, so any future change to `UserProxy` would have silently shown
  every existing user an address other than the proxy they already hold — and
  deposits sent there would have been unreachable, since a second deployment is
  refused. It now returns the stored proxy whenever one exists and falls back to
  the counterfactual only before deployment. **On-chain:** upgrade
  `ProxyDeploymentModule` in place; no storage changed, and the address returned
  for every existing user is unchanged.

- `deploy-modular` no longer deploys mock tokens to live chains. It gated mock
  deployment on the `PRODUCTION` env flag, so a fresh deploy to any real
  network — with or without `PRODUCTION=true` — deployed `MockUSDT`, wrote
  that address into `networkConfig.json` as the real USDT, and priced the
  deposit-address fee at 3 of those unobtainable mock tokens, leaving the
  feature unusable. Mocks are now gated on the network being localhost. Live
  chains keep the token addresses already in `networkConfig.json`. (The fee
  itself has since been removed entirely — see Removed below.)

- The Ethereum mainnet `USDC` entry in `networkConfig.json` was not USDC —
  it pointed at an unrelated contract, and is corrected here. Nothing was
  ever routed through it: no core contract is deployed on Ethereum mainnet.

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
- The deposit-address fee, and the stale UI copy that advertised it. The deposit
  screen told users a permanent address cost "3 USDT", which had not been true
  since deposit addresses moved to `VaultDepositAddressModule` — the live path
  has always been free. The charge belonged to the older per-user
  `ProxyDeploymentModule` route, which the app no longer calls. The copy is
  corrected, and the legacy fee is removed rather than left lying around: fresh
  deployments set none, and `scripts/clear-deposit-address-fee.js` zeroes it on
  chains already carrying one (owner-only, so a governed deployment queues
  `setProxyDeploymentFee(0)` through the timelock instead).

  Both address factories can now be paid for by somebody else — a new
  `deployDepositAddressFor(vaultId, member)` on `VaultDepositAddressModule`, and
  `deployUserProxy` on `ProxyDeploymentModule` made permissionless while no fee
  is set. This is what lets a sponsor cover the one transaction a saver who
  arrives with a bank card and no coin cannot yet make. It is safe for the same
  reason the proxies' own sweeps are permissionless: each address is derived
  from its owner, and everything landing on it can only ever settle into that
  owner's balance. Membership is still checked, so an address cannot be created
  for a non-member. On `ProxyDeploymentModule`, a non-zero fee restricts
  deployment to the user and core again, so nobody can spend someone else's
  token approval. **On-chain:** upgrade `VaultDepositAddressModule` and
  `ProxyDeploymentModule` in place; no storage changed, and the fee machinery is
  retained and still owner-settable, so it is reversible without an upgrade.

- The prize pool is hidden behind a feature flag until it is finished: the
  `/prize-savings` page (route dropped from the sitemap and redirected home),
  its entries in the landing nav and the in-app top-right links, and the
  PoolTogether vault toggle, grand-prize line and claim button in the balance
  list. The switch is `PRIZE_POOL_ENABLED` in
  `frontend/src/utils/featureFlags.js` — hardcoded off rather than
  environment-driven, since it is off for every environment until it ships. The
  `PoolTogetherModule` contract and the adapter methods are untouched — this
  is UI visibility only, so any funds already in a vault stay withdrawable
  once the flag is on. No contract changes.
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
