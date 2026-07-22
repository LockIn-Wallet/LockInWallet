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
  'VaultSystemModule': ethers.keccak256(ethers.toUtf8Bytes("VAULT_SYSTEM"))
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log("Usage: npx hardhat run scripts/upgrade-module-proxy.js --network <network> <module-name>");
    console.log("Available modules:", Object.keys(MODULE_IDS).join(", "));
    console.log("\nThe module proxy address is read from the SavingsCore module registry.");
    console.log("Example: npx hardhat run scripts/upgrade-module-proxy.js --network localhost TimePeriodLimitsModule");
    process.exit(1);
  }

  const moduleName = args[0];

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
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const currentImpl = await ethers.provider.getStorage(proxyAddress, implSlot);
  console.log(`Current implementation: 0x${currentImpl.slice(26)}`);

  // Upgrade the proxy
  console.log(`\nUpgrading ${moduleName}...`);
  const ModuleFactory = await ethers.getContractFactory(moduleName);
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ModuleFactory);
  await upgraded.waitForDeployment();

  const newImpl = await ethers.provider.getStorage(proxyAddress, implSlot);
  console.log(`New implementation: 0x${newImpl.slice(26)}`);
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
  console.log(`Old impl:        0x${currentImpl.slice(26)}`);
  console.log(`New impl:        0x${newImpl.slice(26)}`);
  console.log("=".repeat(50));
  console.log("\nModule upgraded successfully! Proxy address unchanged, all state preserved.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
