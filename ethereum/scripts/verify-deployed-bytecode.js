/**
 * Check that the code running behind each proxy is the code in this repo.
 *
 * Compares the deployed bytecode at every proxy's implementation slot against
 * the locally compiled artifact. A match means the chain is running the source
 * you can read; a mismatch means it is running something else, which is worth
 * knowing before anyone trusts a release note.
 *
 * Usage:
 *   npx hardhat run scripts/verify-deployed-bytecode.js --network optimism
 *   CONTRACTS=SavingsCore,BypassSystemModule npx hardhat run ... --network base
 */

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

// Contract name => module id, or null for the kernel (its proxy is the core).
const TARGETS = {
  SavingsCore: null,
  BypassSystemModule: "BYPASS_SYSTEM",
  ProxyDeploymentModule: "PROXY_DEPLOYMENT",
  VaultDepositAddressModule: "VAULT_DEPOSIT_ADDRESSES",
  SavingsVaultModule: "SAVINGS_VAULTS",
  VaultYieldModule: "VAULT_YIELD",
  TimePeriodLimitsModule: "TIME_PERIOD_LIMITS",
  ApprovalSystemModule: "APPROVAL_SYSTEM",
  RecoverySystemModule: "RECOVERY_SYSTEM",
};

const IMPL_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

/**
 * Drop solc's trailing metadata.
 *
 * The compiler appends a CBOR blob ending in two bytes that give its length.
 * It carries a hash of the source paths and compiler settings, so the same
 * logic compiled from a different absolute path produces different metadata
 * and identical executable code. Comparing it would report a mismatch for
 * builds that behave identically, which is worse than useless — it trains you
 * to ignore the check.
 */
function stripMetadata(hex) {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (body.length < 4) return body;
  const declared = parseInt(body.slice(-4), 16);
  const total = declared * 2 + 4; // metadata bytes + the 2-byte length suffix
  if (!Number.isFinite(declared) || total > body.length) return body;
  return body.slice(0, body.length - total);
}

/**
 * Blank out the implementation's own address where it is baked into the code.
 *
 * UUPSUpgradeable holds `address private immutable __self = address(this)`, and
 * an immutable is written into the runtime code at deployment. The compiled
 * artifact carries zeros in that slot, because the value is not knowable until
 * the contract has an address. Zeroing it on the deployed side is what makes
 * the two comparable — it is not slack in the check: the value substituted is
 * the address we already read the code from.
 */
function neutralizeSelf(code, implAddress) {
  const bare = implAddress.toLowerCase().replace(/^0x/, "");
  return code.split(bare).join("0".repeat(bare.length));
}

async function main() {
  const network = hre.network.name === "hardhat" ? "localhost" : hre.network.name;
  const configPath = path.join(__dirname, "../../frontend/src/networkConfig.json");
  const coreAddress = JSON.parse(fs.readFileSync(configPath, "utf8")).evm?.[network]
    ?.savingsContract;

  if (!coreAddress) {
    console.log(`No SavingsCore address found for network: ${network}`);
    process.exit(1);
  }

  const only = process.env.CONTRACTS ? process.env.CONTRACTS.split(",") : null;
  const core = await ethers.getContractAt("SavingsCore", coreAddress);

  console.log(`Network: ${network}`);
  console.log(`Core:    ${coreAddress}\n`);

  let checked = 0;
  let mismatched = 0;

  for (const [name, moduleName] of Object.entries(TARGETS)) {
    if (only && !only.includes(name)) continue;

    const proxy =
      moduleName === null
        ? coreAddress
        : await core.getModule(ethers.keccak256(ethers.toUtf8Bytes(moduleName)));

    if (proxy === ethers.ZeroAddress) {
      console.log(`${name.padEnd(28)} not registered — skipped`);
      continue;
    }

    const raw = await ethers.provider.getStorage(proxy, IMPL_SLOT);
    const impl = ethers.getAddress(`0x${raw.slice(26)}`);
    const onChain = await ethers.provider.getCode(impl);
    const local = (await hre.artifacts.readArtifact(name)).deployedBytecode;

    const a = neutralizeSelf(stripMetadata(onChain).toLowerCase(), impl);
    const b = stripMetadata(local).toLowerCase();

    checked++;
    if (a === b) {
      const exact = onChain.toLowerCase() === local.toLowerCase();
      console.log(`${name.padEnd(28)} ✅ ${impl}${exact ? "" : "  (metadata differs)"}`);
    } else {
      mismatched++;
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      console.log(`${name.padEnd(28)} ❌ ${impl}`);
      console.log(`${"".padEnd(28)}    diverges at char ${i} of ${a.length}/${b.length}`);
    }
  }

  console.log(`\n${checked - mismatched}/${checked} match the local build`);
  if (mismatched > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
