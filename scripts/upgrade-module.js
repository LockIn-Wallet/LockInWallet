const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Module names mapping to their identifiers
const MODULE_IDS = {
  'TimePeriodLimitsModule': ethers.keccak256(ethers.toUtf8Bytes("TIME_PERIOD_LIMITS")),
  'ProposalSystemModule': ethers.keccak256(ethers.toUtf8Bytes("PROPOSAL_SYSTEM")),
  'BypassSystemModule': ethers.keccak256(ethers.toUtf8Bytes("BYPASS_SYSTEM")),
  'ApprovalSystemModule': ethers.keccak256(ethers.toUtf8Bytes("APPROVAL_SYSTEM"))
};

async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.log("Usage: npx hardhat run scripts/upgrade-module.js --network localhost <module-name> <core-address>");
    console.log("Available modules: TimePeriodLimitsModule, ProposalSystemModule, BypassSystemModule, ApprovalSystemModule");
    console.log("Example: npx hardhat run scripts/upgrade-module.js --network localhost TimePeriodLimitsModule 0x1234...");
    process.exit(1);
  }

  const moduleName = args[0];
  const coreAddress = args[1];

  if (!MODULE_IDS[moduleName]) {
    console.log(`❌ Unknown module: ${moduleName}`);
    console.log("Available modules:", Object.keys(MODULE_IDS));
    process.exit(1);
  }

  console.log(`🔄 Starting module upgrade for ${moduleName}...\n`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);
  console.log(`Core contract address: ${coreAddress}\n`);

  try {
    // Get core contract instance
    const savingsCore = await ethers.getContractAt("SavingsCore", coreAddress);

    // Verify core contract is accessible
    const owner = await savingsCore.owner();
    console.log(`✅ Core contract owner: ${owner}`);

    // Get current module address
    const moduleId = MODULE_IDS[moduleName];
    const currentModuleAddress = await savingsCore.getModule(moduleId);
    console.log(`📋 Current ${moduleName} address: ${currentModuleAddress}`);

    if (currentModuleAddress === ethers.ZeroAddress) {
      console.log(`❌ Module ${moduleName} is not currently registered`);
      process.exit(1);
    }

    // Deploy new module version
    console.log(`\n🚀 Deploying new ${moduleName}...`);
    const ModuleFactory = await ethers.getContractFactory(moduleName);
    const newModule = await ModuleFactory.deploy(coreAddress);
    await newModule.waitForDeployment();
    const newModuleAddress = await newModule.getAddress();

    console.log(`✅ New ${moduleName} deployed to: ${newModuleAddress}`);

    // Set up module interactions if needed
    if (moduleName === 'ProposalSystemModule' || moduleName === 'BypassSystemModule') {
      console.log(`\n🔧 Setting up module interactions for ${moduleName}...`);

      const timePeriodLimitsAddress = await savingsCore.getModule(MODULE_IDS['TimePeriodLimitsModule']);
      if (timePeriodLimitsAddress !== ethers.ZeroAddress) {
        console.log("   Setting TimePeriodLimitsModule reference...");
        const tx = await newModule.setTimePeriodLimitsModule(timePeriodLimitsAddress);
        await tx.wait();
        console.log("   ✅ Module interactions configured");
      } else {
        console.log("   ⚠️  TimePeriodLimitsModule not found, skipping interaction setup");
      }
    }

    // Update module registration
    console.log(`\n🔄 Updating module registration...`);
    const tx = await savingsCore.registerModule(moduleId, newModuleAddress);
    await tx.wait();
    console.log(`✅ ${moduleName} registration updated`);

    // Verify the update
    const updatedModuleAddress = await savingsCore.getModule(moduleId);
    if (updatedModuleAddress === newModuleAddress) {
      console.log(`✅ Module upgrade verification passed`);
    } else {
      console.log(`❌ Module upgrade verification failed`);
      console.log(`   Expected: ${newModuleAddress}`);
      console.log(`   Actual: ${updatedModuleAddress}`);
      process.exit(1);
    }

    // Update module addresses config file for frontend
    console.log("\n📋 Updating module addresses config...");
    try {
      const moduleConfigPath = path.join(__dirname, "../frontend/src/moduleAddresses.json");

      let moduleConfig;
      if (fs.existsSync(moduleConfigPath)) {
        moduleConfig = JSON.parse(fs.readFileSync(moduleConfigPath, "utf8"));
      } else {
        moduleConfig = {
          core: coreAddress,
          modules: {},
          tokens: {},
          network: "localhost"
        };
      }

      // Update the specific module address
      const moduleKey = moduleName.replace('Module', '').replace(/([A-Z])/g, (match) => match.toLowerCase()).replace(/^./, (match) => match.toLowerCase());
      moduleConfig.modules[moduleKey] = newModuleAddress;
      moduleConfig.lastUpdated = new Date().toISOString();

      fs.writeFileSync(moduleConfigPath, JSON.stringify(moduleConfig, null, 2));
      console.log("✅ Module addresses config updated");

    } catch (error) {
      console.log("⚠️  Warning: Could not update module config file");
      console.log(`   Error: ${error.message}`);
    }

    // Update ABI files
    console.log("\n📋 Updating ABIs...");
    try {
      // Update the specific module ABI
      const artifactPath = `../artifacts/contracts/${moduleName}.sol/${moduleName}.json`;
      const moduleArtifact = require(artifactPath);
      const frontendABIPath = path.join(__dirname, `../frontend/src/${moduleName}ABI.json`);
      fs.writeFileSync(frontendABIPath, JSON.stringify(moduleArtifact.abi, null, 2));
      console.log(`✅ ${moduleName} ABI updated`);

      // Also update SavingsCore ABI in case core contract interface changed
      const savingsCoreArtifact = require("../artifacts/contracts/SavingsCore.sol/SavingsCore.json");
      const frontendSavingsABIPath = path.join(__dirname, "../frontend/src/SavingsABI.json");
      fs.writeFileSync(frontendSavingsABIPath, JSON.stringify(savingsCoreArtifact.abi, null, 2));
      console.log("✅ SavingsCore ABI updated");

    } catch (error) {
      console.log("⚠️  Warning: Could not update ABIs");
      console.log(`   Error: ${error.message}`);
    }

    // Summary
    console.log(`\n🎉 Module Upgrade Summary:`);
    console.log("=" .repeat(50));
    console.log(`Module:              ${moduleName}`);
    console.log(`Old Address:         ${currentModuleAddress}`);
    console.log(`New Address:         ${newModuleAddress}`);
    console.log(`Core Contract:       ${coreAddress}`);
    console.log(`Deployer:            ${deployer.address}`);
    console.log("=" .repeat(50));

    console.log("\n✅ Module upgrade completed successfully!");
    console.log("   - New module deployed and registered");
    console.log("   - Old module automatically deregistered");
    console.log("   - Frontend config updated");
    console.log("   - ABI files updated");

    console.log("\n📝 Next steps:");
    console.log("1. Test the upgraded module functionality");
    console.log("2. Consider upgrading other dependent modules if needed");
    console.log("3. Update frontend if module interface changed");

    // Optional: Remove old module if it has no ongoing state
    console.log("\n💡 Note: The old module is still deployed but no longer registered.");
    console.log("   If the module has no persistent state, you can ignore the old deployment.");
    console.log("   If cleanup is needed, consider implementing a cleanup function.");

  } catch (error) {
    console.error("Module upgrade failed:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});