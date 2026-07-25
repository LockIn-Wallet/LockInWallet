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
