# Releasing

The operational checklist for shipping a release. One release = one version
across changelog, packages, git tag, GitHub Release, contracts, and
frontend.

## Where things live

| Artifact | Where | Audience |
|---|---|---|
| Technical changelog | `CHANGELOG.md` (source of truth) | contributors, auditors |
| GitHub Release | Releases tab — **auto-published from the changelog** when a `v*` tag is pushed (`.github/workflows/release.yml`) | watchers, integrators |
| Plain-language notes | `frontend/src/releaseNotes.js` → in-app Governance page | **users** (they never read GitHub) |
| Contract addresses | `frontend/src/networkConfig.json` | everyone |

## Checklist

### 1. Prepare
- [ ] `CHANGELOG.md`: move `[Unreleased]` content under `## [X.Y.Z] - date`;
      every contract entry states its on-chain effect
- [ ] `frontend/src/releaseNotes.js`: add the same release in plain language
- [ ] Bump `version` in root, `frontend/`, and `ethereum/` package.json
- [ ] CI green (contracts + size check, jest, production build)

### 2. Tag
```shell
git tag vX.Y.Z && git push origin vX.Y.Z
```
The release workflow publishes the GitHub Release with that version's
changelog section as the body.

### 3. Contracts (if the release touches them)
- **Before governance handover** (current state): fund the deployer, then
  `npx hardhat run scripts/deploy-modular.js --network optimism` —
  upgrades in place, preserves all data, refreshes ABIs + networkConfig.
- **After governance handover**: `governance-upgrade.js` schedule →
  load the printed transaction into the Safe UI, gather confirmations →
  public delay → `governance-upgrade.js` execute (open executor).
  Queue the operation referencing the release tag.
- [ ] `npx hardhat run scripts/validate-deployment.js --network optimism`
      — kernel + all 8 modules must respond

#### 3a. Turning earning on for a network — order matters

Registering `VAULT_YIELD` is the moment earning becomes visible and usable to
users on that chain. The frontend flag is already on; the adapter reports
`supported: false` while the module is absent, which is the only thing hiding
it. So the sequence below is not a preference — done out of order, real money
moves into a protocol before the guard rails exist.

- [ ] `SavingsVaultModule.setTreasury(<Safe>)` — a fresh deploy leaves this as
      the deployer, a hot key that also controls upgrades. `deploy-modular`
      prints a 🚨 when this is still the case. **Do this before the module is
      registered**, or the first fees accrue toward the wrong address.
- [ ] Deploy an `AaveV3Strategy` per coin against the real Aave v3 pool, and
      verify each with a small round trip on a fork before setting it.
- [ ] `VaultYieldModule.setStrategy(token, strategy)` for each coin. A coin with
      no strategy simply cannot earn — it is not a failure state, and its switch
      does not appear.
- [ ] Only now register `VAULT_YIELD`. Earning is live from this transaction.
- [ ] Confirm on production that a vault reports the expected **net** rate, and
      that principal is untouched after the first accrual.
- [ ] Schedule fee collection (`realizeFees` then `sweepFees`). Both are
      permissionless; nothing calls them on its own, so revenue sits
      uncollected until something does.

### 4. Frontend
- [ ] Deploy in the same window as the contract execution (old frontend
      calls removed contract functions; never leave them crossed).
      Vercel deploys from `main` — merge/push once contracts are live.
- [ ] Commit the refreshed `networkConfig.json` / ABIs from the deploy

### 5. Verify
- [ ] Governance page shows the new version under "What changed recently"
- [ ] Smoke test on production: connect, balances, limits render
- [ ] `[Unreleased]` in CHANGELOG.md is empty again ("Nothing yet.")

## Versioning

Semver-ish for a product: **major** = breaking trust-model or migration
events, **minor** = features / contract upgrades, **patch** = frontend-only
fixes. Contract-touching releases are always at least minor.
