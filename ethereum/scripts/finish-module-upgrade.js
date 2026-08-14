/**
 * Point a module proxy at a freshly prepared implementation.
 *
 * `upgrade-module-proxy.js` does this in one step via the upgrades plugin. On
 * some RPC/plugin combinations the plugin's own `upgradeToAndCall` goes out
 * with a stale nonce and is rejected, *after* the new implementation has
 * already been deployed and validated. That leaves the work half done: a good
 * implementation on-chain and a proxy still pointing at the old one.
 *
 * This finishes the job. It still calls `prepareUpgrade`, so the storage-layout
 * validation runs exactly as before and an already-deployed implementation is
 * reused rather than paid for twice — the only difference is that the proxy
 * call is sent directly, with the nonce read fresh from the chain.
 *
 * Idempotent: if the proxy already points at the target, it does nothing.
 *
 * Usage:
 *   MODULE=VaultDepositAddressModule \
 *     npx hardhat run scripts/finish-module-upgrade.js --network optimism
 */

const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const MODULE_IDS = {
  TimePeriodLimitsModule: "TIME_PERIOD_LIMITS",
  ProposalSystemModule: "PROPOSAL_SYSTEM",
  BypassSystemModule: "BYPASS_SYSTEM",
  ApprovalSystemModule: "APPROVAL_SYSTEM",
  ProxyDeploymentModule: "PROXY_DEPLOYMENT",
  PoolTogetherModule: "POOL_TOGETHER",
  VaultSystemModule: "VAULT_SYSTEM",
  ReferralModule: "REFERRAL",
  RecoverySystemModule: "RECOVERY_SYSTEM",
  YieldModule: "YIELD_SYSTEM",
  VaultRulesModule: "VAULT_RULES",
  SavingsVaultModule: "SAVINGS_VAULTS",
  VaultDepositAddressModule: "VAULT_DEPOSIT_ADDRESSES",
  VaultYieldModule: "VAULT_YIELD",
};

// ERC-1967 implementation slot
const IMPL_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const CONFIRM_ATTEMPTS = 10;
const CONFIRM_DELAY_MS = 3000;

const UUPS_ABI = [
  "function upgradeToAndCall(address newImplementation, bytes data) payable",
  "function owner() view returns (address)",
];

async function readImplementation(proxyAddress) {
  const raw = await ethers.provider.getStorage(proxyAddress, IMPL_SLOT);
  return ethers.getAddress(`0x${raw.slice(26)}`);
}

async function main() {
  const moduleName = process.env.MODULE;
  // SavingsCore is the kernel, not a registry entry — its proxy IS the address
  // the registry is read from, so it is looked up differently and upgraded the
  // same way.
  const isCore = moduleName === "SavingsCore";
  if (!moduleName || (!isCore && !MODULE_IDS[moduleName])) {
    console.log("Usage: MODULE=<module-name> npx hardhat run scripts/finish-module-upgrade.js --network <network>");
    console.log("Available:", ["SavingsCore", ...Object.keys(MODULE_IDS)].join(", "));
    process.exit(1);
  }

  const network = hre.network.name === "hardhat" ? "localhost" : hre.network.name;
  const configPath = path.join(__dirname, "../../frontend/src/networkConfig.json");
  const coreAddress = JSON.parse(fs.readFileSync(configPath, "utf8")).evm?.[network]
    ?.savingsContract;

  if (!coreAddress) {
    console.log(`No SavingsCore address found for network: ${network}`);
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  console.log(`Network:  ${network}`);
  console.log(`Signer:   ${signer.address}`);
  console.log(`Core:     ${coreAddress}`);

  let proxyAddress = coreAddress;
  if (!isCore) {
    const core = await ethers.getContractAt("SavingsCore", coreAddress);
    const moduleId = ethers.keccak256(ethers.toUtf8Bytes(MODULE_IDS[moduleName]));
    proxyAddress = await core.getModule(moduleId);

    if (proxyAddress === ethers.ZeroAddress) {
      console.log(`Module ${moduleName} is not registered on this deployment`);
      process.exit(1);
    }
  }
  console.log(`Proxy:    ${proxyAddress}`);

  const owner = await new ethers.Contract(proxyAddress, UUPS_ABI, ethers.provider).owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log(`\nProxy owner is ${owner}, not the signer.`);
    console.log("Queue this upgrade through governance instead.");
    process.exit(1);
  }

  const before = await readImplementation(proxyAddress);
  console.log(`Current implementation: ${before}`);

  // Validates the storage layout and reuses an implementation already deployed
  // for this bytecode, so a retry after a failed proxy call costs nothing.
  const factory = await ethers.getContractFactory(moduleName);
  const target = ethers.getAddress(
    await upgrades.prepareUpgrade(proxyAddress, factory, { kind: "uups" })
  );
  console.log(`Target implementation:  ${target}`);

  if (before.toLowerCase() === target.toLowerCase()) {
    console.log("\nAlready pointing at the target — nothing to do.");
    return;
  }

  const nonce = await ethers.provider.getTransactionCount(signer.address, "latest");
  console.log(`\nUpgrading with nonce ${nonce}...`);

  const proxy = new ethers.Contract(proxyAddress, UUPS_ABI, signer);
  const tx = await proxy.upgradeToAndCall(target, "0x", { nonce });
  console.log(`Sent: ${tx.hash}`);
  await tx.wait();

  // A public RPC can serve state from a node that has not caught up yet, so a
  // single read right after the receipt reports the old implementation for a
  // transaction that landed perfectly well. Poll before believing it failed.
  let after = null;
  for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
    after = await readImplementation(proxyAddress);
    if (after.toLowerCase() === target.toLowerCase()) break;
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_DELAY_MS));
  }

  if (after.toLowerCase() !== target.toLowerCase()) {
    console.log(`Implementation is ${after}, expected ${target} — upgrade did not stick.`);
    process.exit(1);
  }

  console.log(`\n${moduleName} now runs ${after}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
