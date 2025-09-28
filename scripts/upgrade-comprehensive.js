const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Configuration - detect current proxy address from frontend
const isDevelopmentMode = process.env.DEV_MODE === 'true';

async function main() {
  console.log(`🔄 Starting comprehensive upgrade process${isDevelopmentMode ? ' (DEVELOPMENT MODE)' : ''}...\n`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Upgrading with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  let savingsAddress;
  let isUpgrade = false;
  let usdtAddress;
  const moduleAddresses = {};

  try {
    // Read current frontend configuration to get existing addresses
    console.log("📋 Reading current frontend configuration...");
    const frontendPath = path.join(__dirname, "../frontend/src/App.js");
    let frontendContent = fs.readFileSync(frontendPath, "utf8");

    const currentSavingsMatch = frontendContent.match(/savingsContract: "([^"]+)"/);
    const currentUsdtMatch = frontendContent.match(/(USDT: {[^}]*address: ")[^"]*(",)/);

    if (currentSavingsMatch) {
      const currentAddress = currentSavingsMatch[1];
      console.log(`   Current SavingsCore: ${currentAddress}`);

      try {
        // Try to upgrade existing proxy
        console.log("⬆️  Attempting to upgrade existing SavingsCore proxy...");
        const SavingsCore = await ethers.getContractFactory("SavingsCore");
        const upgraded = await upgrades.upgradeProxy(currentAddress, SavingsCore);
        await upgraded.waitForDeployment();
        savingsAddress = await upgraded.getAddress();
        isUpgrade = true;

        console.log(`✅ SavingsCore upgraded successfully!`);
        console.log(`   Proxy address (unchanged): ${savingsAddress}`);

      } catch (upgradeError) {
        console.log(`⚠️  Upgrade failed: ${upgradeError.message}`);
        console.log("   Proceeding with fresh deployment...");
        isUpgrade = false;
      }
    }

    if (!isUpgrade) {
      // Deploy fresh core contract
      console.log("💰 Deploying new SavingsCore contract (upgradeable)...");
      const SavingsCore = await ethers.getContractFactory("SavingsCore");
      const savings = await upgrades.deployProxy(SavingsCore, [], { initializer: "initialize" });
      await savings.waitForDeployment();
      savingsAddress = await savings.getAddress();

      console.log(`✅ New SavingsCore contract deployed to: ${savingsAddress}`);
    }

    // Get core contract instance
    const savingsCore = await ethers.getContractAt("SavingsCore", savingsAddress);

    // Deploy or redeploy all modules (modules are always redeployed for latest code)
    console.log("\n🧩 Deploying/upgrading modules...");

    // 1. Deploy Time Period Limits Module
    console.log("   📊 Deploying TimePeriodLimitsModule...");
    const TimePeriodLimitsModule = await ethers.getContractFactory("TimePeriodLimitsModule");
    const timePeriodLimitsModule = await TimePeriodLimitsModule.deploy(savingsAddress);
    await timePeriodLimitsModule.waitForDeployment();
    moduleAddresses.timePeriodLimits = await timePeriodLimitsModule.getAddress();
    console.log(`   ✅ TimePeriodLimitsModule deployed to: ${moduleAddresses.timePeriodLimits}`);

    // 2. Deploy Proposal System Module
    console.log("   📝 Deploying ProposalSystemModule...");
    const ProposalSystemModule = await ethers.getContractFactory("ProposalSystemModule");
    const proposalSystemModule = await ProposalSystemModule.deploy(savingsAddress);
    await proposalSystemModule.waitForDeployment();
    moduleAddresses.proposalSystem = await proposalSystemModule.getAddress();
    console.log(`   ✅ ProposalSystemModule deployed to: ${moduleAddresses.proposalSystem}`);

    // 3. Deploy Bypass System Module
    console.log("   🚨 Deploying BypassSystemModule...");
    const BypassSystemModule = await ethers.getContractFactory("BypassSystemModule");
    const bypassSystemModule = await BypassSystemModule.deploy(savingsAddress);
    await bypassSystemModule.waitForDeployment();
    moduleAddresses.bypassSystem = await bypassSystemModule.getAddress();
    console.log(`   ✅ BypassSystemModule deployed to: ${moduleAddresses.bypassSystem}`);

    // 4. Deploy Approval System Module
    console.log("   🔐 Deploying ApprovalSystemModule...");
    const ApprovalSystemModule = await ethers.getContractFactory("ApprovalSystemModule");
    const approvalSystemModule = await ApprovalSystemModule.deploy(savingsAddress);
    await approvalSystemModule.waitForDeployment();
    moduleAddresses.approvalSystem = await approvalSystemModule.getAddress();
    console.log(`   ✅ ApprovalSystemModule deployed to: ${moduleAddresses.approvalSystem}`);

    // Register/update modules with core contract
    console.log("\n🔗 Registering modules with core contract...");

    // Register TimePeriodLimitsModule
    console.log("   Registering TimePeriodLimitsModule...");
    let tx = await savingsCore.registerModule(
      ethers.keccak256(ethers.toUtf8Bytes("TIME_PERIOD_LIMITS")),
      moduleAddresses.timePeriodLimits
    );
    await tx.wait();

    // Register ProposalSystemModule
    console.log("   Registering ProposalSystemModule...");
    tx = await savingsCore.registerModule(
      ethers.keccak256(ethers.toUtf8Bytes("PROPOSAL_SYSTEM")),
      moduleAddresses.proposalSystem
    );
    await tx.wait();

    // Register BypassSystemModule
    console.log("   Registering BypassSystemModule...");
    tx = await savingsCore.registerModule(
      ethers.keccak256(ethers.toUtf8Bytes("BYPASS_SYSTEM")),
      moduleAddresses.bypassSystem
    );
    await tx.wait();

    // Register ApprovalSystemModule
    console.log("   Registering ApprovalSystemModule...");
    tx = await savingsCore.registerModule(
      ethers.keccak256(ethers.toUtf8Bytes("APPROVAL_SYSTEM")),
      moduleAddresses.approvalSystem
    );
    await tx.wait();

    console.log("   ✅ All modules registered successfully");

    // Handle MockUSDT deployment/reuse
    if (!isUpgrade) {
      console.log("\n📄 Deploying MockUSDT...");
      const MockUSDT = await ethers.getContractFactory("MockUSDT");
      const mockUSDT = await MockUSDT.deploy();
      await mockUSDT.waitForDeployment();
      usdtAddress = await mockUSDT.getAddress();

      const usdtBalance = await mockUSDT.balanceOf(deployer.address);
      console.log(`✅ MockUSDT deployed to: ${usdtAddress}`);
      console.log(`   Deployer USDT balance: ${ethers.formatUnits(usdtBalance, 6)} USDT`);
    } else {
      // For upgrades, try to get the existing USDT address from frontend config
      if (currentUsdtMatch) {
        usdtAddress = currentUsdtMatch[0].match(/"([^"]+)"/)[1];
        console.log(`\n📄 Using existing MockUSDT: ${usdtAddress}`);
      } else {
        console.log("\n⚠️  Could not find existing USDT address, deploying new one...");
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        const mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();
        usdtAddress = await mockUSDT.getAddress();
        console.log(`✅ New MockUSDT deployed to: ${usdtAddress}`);
      }
    }

    // Set development mode if requested
    if (isDevelopmentMode) {
      console.log("\n🚧 Setting development mode...");
      tx = await savingsCore.setDevelopmentMode(true);
      await tx.wait();
      console.log("   ✅ Development mode enabled");
    }

    // Update frontend addresses
    console.log("\n🔄 Updating frontend addresses...");
    try {
      let addressChanged = false;

      // Update Savings contract address
      const newSavingsPattern = new RegExp(`savingsContract: "[^"]*"`);
      if (!frontendContent.match(`savingsContract: "${savingsAddress}"`)) {
        frontendContent = frontendContent.replace(
          newSavingsPattern,
          `savingsContract: "${savingsAddress}"`
        );
        addressChanged = true;
        console.log(`   Updated Savings address: ${savingsAddress}`);
      } else {
        console.log(`   Savings address unchanged: ${savingsAddress}`);
      }

      // Update USDT address
      if (usdtAddress) {
        const currentUsdtPattern = /(USDT: {[^}]*address: ")[^"]*(",)/;
        if (!frontendContent.includes(`address: "${usdtAddress}"`)) {
          frontendContent = frontendContent.replace(
            currentUsdtPattern,
            `$1${usdtAddress}$2`
          );
          addressChanged = true;
          console.log(`   Updated USDT address: ${usdtAddress}`);
        } else {
          console.log(`   USDT address unchanged: ${usdtAddress}`);
        }
      }

      if (addressChanged) {
        fs.writeFileSync(frontendPath, frontendContent);
        console.log("✅ Frontend addresses updated successfully");
      } else {
        console.log("✅ Frontend addresses already up to date");
      }

    } catch (error) {
      console.log("⚠️  Warning: Could not update frontend addresses automatically");
      console.log(`   Error: ${error.message}`);
    }

    // Create/update module addresses config file for frontend
    console.log("\n📋 Updating module addresses config...");
    try {
      const moduleConfig = {
        core: savingsAddress,
        modules: {
          timePeriodLimits: moduleAddresses.timePeriodLimits,
          proposalSystem: moduleAddresses.proposalSystem,
          bypassSystem: moduleAddresses.bypassSystem,
          approvalSystem: moduleAddresses.approvalSystem
        },
        tokens: {
          usdt: usdtAddress || null
        },
        network: "localhost",
        deployedAt: new Date().toISOString(),
        isUpgrade: isUpgrade
      };

      const moduleConfigPath = path.join(__dirname, "../frontend/src/moduleAddresses.json");
      fs.writeFileSync(moduleConfigPath, JSON.stringify(moduleConfig, null, 2));
      console.log("✅ Module addresses config updated");

    } catch (error) {
      console.log("⚠️  Warning: Could not update module config file");
      console.log(`   Error: ${error.message}`);
    }

    // Update ABI files (CRITICAL for frontend compatibility)
    console.log("\n📋 Updating contract ABIs...");
    try {
      // Copy SavingsCore ABI
      const savingsCoreArtifact = require("../artifacts/contracts/SavingsCore.sol/SavingsCore.json");
      const frontendSavingsABIPath = path.join(__dirname, "../frontend/src/SavingsABI.json");
      fs.writeFileSync(frontendSavingsABIPath, JSON.stringify(savingsCoreArtifact.abi, null, 2));
      console.log("✅ SavingsCore ABI updated");

      // Copy module ABIs
      const timePeriodLimitsArtifact = require("../artifacts/contracts/TimePeriodLimitsModule.sol/TimePeriodLimitsModule.json");
      const frontendTimePeriodLimitsABIPath = path.join(__dirname, "../frontend/src/TimePeriodLimitsModuleABI.json");
      fs.writeFileSync(frontendTimePeriodLimitsABIPath, JSON.stringify(timePeriodLimitsArtifact.abi, null, 2));
      console.log("✅ TimePeriodLimitsModule ABI updated");

      const proposalSystemArtifact = require("../artifacts/contracts/ProposalSystemModule.sol/ProposalSystemModule.json");
      const frontendProposalSystemABIPath = path.join(__dirname, "../frontend/src/ProposalSystemModuleABI.json");
      fs.writeFileSync(frontendProposalSystemABIPath, JSON.stringify(proposalSystemArtifact.abi, null, 2));
      console.log("✅ ProposalSystemModule ABI updated");

      const bypassSystemArtifact = require("../artifacts/contracts/BypassSystemModule.sol/BypassSystemModule.json");
      const frontendBypassSystemABIPath = path.join(__dirname, "../frontend/src/BypassSystemModuleABI.json");
      fs.writeFileSync(frontendBypassSystemABIPath, JSON.stringify(bypassSystemArtifact.abi, null, 2));
      console.log("✅ BypassSystemModule ABI updated");

      const approvalSystemArtifact = require("../artifacts/contracts/ApprovalSystemModule.sol/ApprovalSystemModule.json");
      const frontendApprovalSystemABIPath = path.join(__dirname, "../frontend/src/ApprovalSystemModuleABI.json");
      fs.writeFileSync(frontendApprovalSystemABIPath, JSON.stringify(approvalSystemArtifact.abi, null, 2));
      console.log("✅ ApprovalSystemModule ABI updated");

      // Copy MockUSDT ABI
      if (usdtAddress) {
        const usdtArtifact = require("../artifacts/contracts/MockUSDT.sol/MockUSDT.json");
        const frontendUSDTABIPath = path.join(__dirname, "../frontend/src/MockUSDT_ABI.json");
        fs.writeFileSync(frontendUSDTABIPath, JSON.stringify(usdtArtifact.abi, null, 2));
        console.log("✅ MockUSDT ABI updated");
      }

      // Copy UserProxy ABI
      const userProxyArtifact = require("../artifacts/contracts/UserProxy.sol/UserProxy.json");
      const frontendUserProxyABIPath = path.join(__dirname, "../frontend/src/UserProxyABI.json");
      fs.writeFileSync(frontendUserProxyABIPath, JSON.stringify(userProxyArtifact.abi, null, 2));
      console.log("✅ UserProxy ABI updated");

    } catch (error) {
      console.log("⚠️  Warning: Could not update ABIs automatically");
      console.log(`   Error: ${error.message}`);
    }

    // Validate the upgrade
    console.log("\n🔍 Running upgrade validation...");
    try {
      const { validateDeployment } = require("./validate-deployment.js");
      const isValid = await validateDeployment();

      if (isValid) {
        console.log("✅ Upgrade validation passed!");
      } else {
        console.log("⚠️  Upgrade validation found issues");
      }
    } catch (error) {
      console.log(`⚠️  Could not run validation: ${error.message}`);
    }

    // Summary
    console.log(`\n🎉 ${isUpgrade ? 'Upgrade' : 'Fresh Deployment'} Summary:`);
    console.log("=" .repeat(60));
    console.log(`Operation Type:        ${isUpgrade ? 'UPGRADE (Data Preserved)' : 'FRESH DEPLOYMENT'}`);
    console.log(`SavingsCore Address:   ${savingsAddress}`);
    console.log("Module Addresses:");
    console.log(`  TimePeriodLimits:    ${moduleAddresses.timePeriodLimits}`);
    console.log(`  ProposalSystem:      ${moduleAddresses.proposalSystem}`);
    console.log(`  BypassSystem:        ${moduleAddresses.bypassSystem}`);
    console.log(`  ApprovalSystem:      ${moduleAddresses.approvalSystem}`);
    if (usdtAddress) {
      console.log(`MockUSDT Address:      ${usdtAddress}`);
    }
    console.log(`Deployer Address:      ${deployer.address}`);
    console.log(`Development Mode:      ${isDevelopmentMode ? 'ENABLED' : 'DISABLED'}`);
    console.log("=" .repeat(60));

    if (isUpgrade) {
      console.log("\n✅ Comprehensive upgrade completed successfully!");
      console.log("   - SavingsCore contract upgraded with optimized architecture");
      console.log("   - All user data preserved through proxy pattern");
      console.log("   - All modules redeployed with latest code");
      console.log("   - Frontend ABIs and addresses automatically updated");
      console.log("   - Withdrawal address functionality now available");
    } else {
      console.log("\n✅ Fresh deployment completed successfully!");
      console.log("   - Optimized SavingsCore contract deployed");
      console.log("   - All modules deployed and registered");
      console.log("   - Frontend ABIs and addresses automatically updated");
      console.log("   - System ready for use with withdrawal address functionality");
    }

    console.log("\n📝 Next steps:");
    if (!isUpgrade && usdtAddress) {
      console.log("1. Add USDT token to MetaMask:");
      console.log(`   Address: ${usdtAddress}`);
      console.log("   Symbol: USDT");
      console.log("   Decimals: 6");
    }
    console.log(`${!isUpgrade && usdtAddress ? '2' : '1'}. Frontend is automatically configured with new addresses`);
    console.log(`${!isUpgrade && usdtAddress ? '3' : '2'}. Start/restart your frontend: cd frontend && npm start`);
    console.log(`${!isUpgrade && usdtAddress ? '4' : '3'}. Test withdrawal address functionality in the frontend`);

  } catch (error) {
    console.error("Comprehensive upgrade failed:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});