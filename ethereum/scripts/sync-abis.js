const fs = require("fs");
const path = require("path");

/**
 * Every contract whose ABI the frontend imports.
 *
 * One list, used by both the post-compile hook and the deploy script, because
 * two hand-maintained copies is how the frontend ends up running against a
 * stale ABI: the call fails at runtime with a decode error rather than
 * anything that points at the missing entry.
 *
 * `SavingsCore` lands as `SavingsABI.json` for historical reasons; everything
 * else is `<Name>ABI.json`. Names map to `contracts/<Name>.sol/<Name>.json`.
 */
const SYNCED_CONTRACTS = [
  "SavingsCore",
  "TimePeriodLimitsModule",
  "ProposalSystemModule",
  "BypassSystemModule",
  "ApprovalSystemModule",
  "ProxyDeploymentModule",
  "PoolTogetherModule",
  "VaultSystemModule",
  "ReferralModule",
  "RecoverySystemModule",
  "VaultRulesModule",
  "YieldModule",
  "SavingsVaultModule",
  "VaultYieldModule",
  "SavingsVaultDepositProxy",
  "VaultDepositAddressModule",
  "UserProxy",
  "MockUSDT",
];

const FILENAME_OVERRIDES = {
  SavingsCore: "SavingsABI.json",
  MockUSDT: "MockUSDT_ABI.json",
};

const FRONTEND_DIR = path.join(__dirname, "../../frontend/src");

/**
 * Copy every ABI into the frontend. A contract that has not been compiled yet
 * is skipped rather than fatal — the hook runs on partial compiles too, and
 * failing the whole build over one missing artifact helps nobody.
 */
function syncAbis({ quiet = false } = {}) {
  if (!fs.existsSync(FRONTEND_DIR)) {
    console.log("⚠️  Frontend source directory not found, skipping ABI sync");
    return 0;
  }

  let updated = 0;
  const missing = [];

  for (const name of SYNCED_CONTRACTS) {
    const artifactPath = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
    if (!fs.existsSync(artifactPath)) {
      missing.push(name);
      continue;
    }
    const { abi } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const target = path.join(FRONTEND_DIR, FILENAME_OVERRIDES[name] || `${name}ABI.json`);
    fs.writeFileSync(target, JSON.stringify(abi, null, 2));
    if (!quiet) console.log(`  ✅ ${name}`);
    updated++;
  }

  if (missing.length > 0) {
    console.log(`  ⚠️  Not compiled, skipped: ${missing.join(", ")}`);
  }
  return updated;
}

module.exports = { syncAbis, SYNCED_CONTRACTS };
