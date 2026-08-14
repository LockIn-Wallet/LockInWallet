const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Module names mapping to their identifiers
const MODULE_IDS = {
  'TimePeriodLimitsModule': ethers.keccak256(ethers.toUtf8Bytes("TIME_PERIOD_LIMITS")),
  'ProposalSystemModule': ethers.keccak256(ethers.toUtf8Bytes("PROPOSAL_SYSTEM")),
  'BypassSystemModule': ethers.keccak256(ethers.toUtf8Bytes("BYPASS_SYSTEM")),
  'ApprovalSystemModule': ethers.keccak256(ethers.toUtf8Bytes("APPROVAL_SYSTEM")),
  'ProxyDeploymentModule': ethers.keccak256(ethers.toUtf8Bytes("PROXY_DEPLOYMENT")),
  'VaultSystemModule': ethers.keccak256(ethers.toUtf8Bytes("VAULT_SYSTEM")),
  'ReferralModule': ethers.keccak256(ethers.toUtf8Bytes("REFERRAL")),
  'RecoverySystemModule': ethers.keccak256(ethers.toUtf8Bytes("RECOVERY_SYSTEM")),
  'PoolTogetherModule': ethers.keccak256(ethers.toUtf8Bytes("POOL_TOGETHER")),
  'YieldModule': ethers.keccak256(ethers.toUtf8Bytes("YIELD_SYSTEM")),
  'VaultRulesModule': ethers.keccak256(ethers.toUtf8Bytes("VAULT_RULES")),
  // The vault generation. SavingsVaultModule custodies deposits, so this
  // script — which upgrades the implementation behind the existing proxy — is
  // the only way it may ever be changed.
  'SavingsVaultModule': ethers.keccak256(ethers.toUtf8Bytes("SAVINGS_VAULTS")),
  'VaultDepositAddressModule': ethers.keccak256(ethers.toUtf8Bytes("VAULT_DEPOSIT_ADDRESSES")),
  'VaultYieldModule': ethers.keccak256(ethers.toUtf8Bytes("VAULT_YIELD"))
};

// ERC-1967 implementation slot
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const CONFIRM_ATTEMPTS = 10;
const CONFIRM_DELAY_MS = 3000;

async function readImplementation(proxyAddress) {
  const raw = await ethers.provider.getStorage(proxyAddress, IMPL_SLOT);
  return ethers.getAddress(`0x${raw.slice(26)}`);
}

/**
 * The implementation slot is the only proof an upgrade landed. Public RPC
 * endpoints are load-balanced and will happily serve pre-transaction state
 * right after returning the receipt, so poll until the slot reads the address
 * we deployed and fail loudly if it never does — a silent "upgraded
 * successfully" on a proxy that did not move is worse than an error.
 */
async function confirmImplementation(proxyAddress, expectedImpl) {
  for (let attempt = 1; attempt <= CONFIRM_ATTEMPTS; attempt++) {
    const impl = await readImplementation(proxyAddress);
    if (impl === expectedImpl) return impl;

    if (attempt < CONFIRM_ATTEMPTS) {
      console.log(`  implementation reads ${impl}, expected ${expectedImpl} — re-checking (${attempt}/${CONFIRM_ATTEMPTS})`);
      await new Promise((resolve) => setTimeout(resolve, CONFIRM_DELAY_MS));
    }
  }

  throw new Error(
    `Upgrade not confirmed: ${proxyAddress} does not point at ${expectedImpl}. ` +
    `The transaction may have failed, or this RPC endpoint is serving stale state — ` +
    `verify the implementation slot against a second endpoint before re-running.`
  );
}

async function main() {
  // `hardhat run` rejects extra positional arguments, so the module name comes
  // from MODULE=; argv is still honoured for direct `node`/`ts-node` runs
  const moduleName = process.env.MODULE || process.argv[2];

  if (!moduleName) {
    console.log("Usage: MODULE=<module-name> npx hardhat run scripts/upgrade-module-proxy.js --network <network>");
    console.log("Available modules:", Object.keys(MODULE_IDS).join(", "));
    console.log("\nThe module proxy address is read from the SavingsCore module registry.");
    console.log("Example: MODULE=TimePeriodLimitsModule npx hardhat run scripts/upgrade-module-proxy.js --network localhost");
    process.exit(1);
  }

  if (!MODULE_IDS[moduleName]) {
    console.log(`Unknown module: ${moduleName}`);
    console.log("Available modules:", Object.keys(MODULE_IDS).join(", "));
    process.exit(1);
  }

  console.log(`Upgrading ${moduleName} implementation via UUPS proxy...\n`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  // Read SavingsCore address from frontend config
  const networkConfigPath = path.join(__dirname, "../../frontend/src/networkConfig.json");
  const networkConfig = JSON.parse(fs.readFileSync(networkConfigPath, "utf8"));
  const network = hre.network.name === "hardhat" ? "localhost" : hre.network.name;
  const coreAddress = networkConfig.evm?.[network]?.savingsContract;

  if (!coreAddress) {
    console.log(`No SavingsCore address found for network: ${network}`);
    process.exit(1);
  }

  console.log(`SavingsCore: ${coreAddress}`);

  const savingsCore = await ethers.getContractAt("SavingsCore", coreAddress);
  const moduleId = MODULE_IDS[moduleName];
  const proxyAddress = await savingsCore.getModule(moduleId);

  if (proxyAddress === ethers.ZeroAddress) {
    console.log(`Module ${moduleName} is not registered`);
    process.exit(1);
  }

  console.log(`Module proxy address: ${proxyAddress}`);

  // Get current implementation
  const currentImpl = await readImplementation(proxyAddress);
  console.log(`Current implementation: ${currentImpl}`);

  // Deploy (or reuse) the new implementation first: this validates the storage
  // layout and tells us exactly which address the proxy must end up pointing
  // at, so the confirmation below can't be fooled by a stale RPC read
  const ModuleFactory = await ethers.getContractFactory(moduleName);
  const targetImpl = ethers.getAddress(
    await upgrades.prepareUpgrade(proxyAddress, ModuleFactory, { kind: "uups" })
  );

  if (targetImpl === currentImpl) {
    console.log(`\n${moduleName} is already running this bytecode (${targetImpl}) — nothing to upgrade.`);
    return;
  }

  console.log(`\nUpgrading ${moduleName} to ${targetImpl}...`);
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ModuleFactory);
  await upgraded.waitForDeployment();

  const newImpl = await confirmImplementation(proxyAddress, targetImpl);
  console.log(`New implementation: ${newImpl}`);
  console.log(`Proxy address (unchanged): ${proxyAddress}`);

  // Set up cross-references if needed
  if (moduleName === 'ProposalSystemModule' || moduleName === 'BypassSystemModule') {
    console.log(`\nSetting up cross-references for ${moduleName}...`);
    const tx = await savingsCore.setupModuleCrossReferences();
    await tx.wait();
    console.log("Cross-references configured");
  }

  // Update ABI
  console.log("\nUpdating ABI...");
  try {
    const artifactPath = `../artifacts/contracts/${moduleName}.sol/${moduleName}.json`;
    const moduleArtifact = require(artifactPath);
    const frontendABIPath = path.join(__dirname, `../../frontend/src/${moduleName}ABI.json`);
    fs.writeFileSync(frontendABIPath, JSON.stringify(moduleArtifact.abi, null, 2));
    console.log(`${moduleName} ABI updated`);
  } catch (error) {
    console.log(`Warning: Could not update ABI: ${error.message}`);
  }

  console.log(`\nUpgrade Summary:`);
  console.log("=".repeat(50));
  console.log(`Module:          ${moduleName}`);
  console.log(`Proxy (stable):  ${proxyAddress}`);
  console.log(`Old impl:        ${currentImpl}`);
  console.log(`New impl:        ${newImpl}`);
  console.log("=".repeat(50));
  console.log("\nUpgrade confirmed on-chain — proxy address unchanged, all state preserved.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
