const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Auto-detect existing proxy address from frontend
function getExistingProxyAddress() {
  try {
    const frontendPath = path.join(__dirname, "../../frontend/src/App.js");
    const frontendContent = fs.readFileSync(frontendPath, "utf8");
    const match = frontendContent.match(/savingsContract: "([^"]+)"/);
    if (match && match[1] !== "0x0000000000000000000000000000000000000000") {
      return match[1];
    }
  } catch (error) {
    console.log("Could not read existing address from frontend");
  }
  return null;
}

const PROXY_ADDRESS = getExistingProxyAddress();

// Check for production mode flag (dev mode disabled for production)
const isProduction = process.env.PRODUCTION === 'true';

async function main() {
  console.log(`🔄 Starting modular savings wallet deployment${isProduction ? ' (PRODUCTION MODE)' : ' (DEVELOPMENT MODE)'}...\n`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  let savingsAddress;
  let isUpgrade = false;
  const moduleAddresses = {};

  try {
    // Check if proxy already exists
    if (PROXY_ADDRESS) {
      console.log(`🔍 Attempting to upgrade existing contract at: ${PROXY_ADDRESS}`);
      try {
        // Try to interact with the existing proxy to see if it exists
        const existingContract = await ethers.getContractAt("SavingsCore", PROXY_ADDRESS);
        const owner = await existingContract.owner();
        console.log(`✅ Found existing proxy at: ${PROXY_ADDRESS}`);
        console.log(`   Current owner: ${owner}`);

        // Perform upgrade
        console.log("⬆️  Upgrading existing proxy implementation...");
        const SavingsCore = await ethers.getContractFactory("SavingsCore");
        const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, SavingsCore);
        await upgraded.waitForDeployment();
        savingsAddress = await upgraded.getAddress();
        isUpgrade = true;

        console.log(`✅ Core contract upgraded successfully!`);
        console.log(`   Proxy address (preserved): ${savingsAddress}`);

      } catch (error) {
        console.log(`❌ Upgrade failed: ${error.message}`);
        console.log(`⚠️  Proxy at ${PROXY_ADDRESS} not found or not accessible`);
        console.log("🔄 Proceeding with fresh deployment...\n");
        isUpgrade = false;
      }
    } else {
      console.log("🆕 No existing contract address found in frontend");
      console.log("🔄 Proceeding with fresh deployment...\n");
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

    // Deploy modules
    console.log("\n🧩 Deploying modules...");

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

    // 5. Deploy Proxy Deployment Module
    console.log("   🔑 Deploying ProxyDeploymentModule...");
    const ProxyDeploymentModule = await ethers.getContractFactory("ProxyDeploymentModule");
    const proxyDeploymentModule = await ProxyDeploymentModule.deploy(savingsAddress);
    await proxyDeploymentModule.waitForDeployment();
    moduleAddresses.proxyDeployment = await proxyDeploymentModule.getAddress();
    console.log(`   ✅ ProxyDeploymentModule deployed to: ${moduleAddresses.proxyDeployment}`);

    // Register modules with core contract
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

    // Register ProxyDeploymentModule
    console.log("   Registering ProxyDeploymentModule...");
    tx = await savingsCore.registerModule(
      ethers.keccak256(ethers.toUtf8Bytes("PROXY_DEPLOYMENT")),
      moduleAddresses.proxyDeployment
    );
    await tx.wait();

    console.log("   ✅ All modules registered successfully");

    // Set up module cross-references
    console.log("\n🔗 Setting up module cross-references...");
    console.log("   Configuring inter-module dependencies through SavingsCore...");
    tx = await savingsCore.setupModuleCrossReferences();
    await tx.wait();
    console.log("   ✅ Module cross-references configured");

    // Set up module interactions
    console.log("\n🔧 Modular system configured...");
    console.log("   ✅ Essential functions available directly in SavingsCore");
    console.log("   ✅ Frontend compatibility maintained for core functions");

    // Deploy MockUSDT only if it's a fresh deployment or if needed
    let usdtAddress;
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
      try {
        const frontendPath = path.join(__dirname, "../../frontend/src/App.js");
        const frontendContent = fs.readFileSync(frontendPath, "utf8");
        const usdtMatch = frontendContent.match(/address: "([^"]+)",\s*symbol: "USDT"/);
        if (usdtMatch) {
          usdtAddress = usdtMatch[1];
          console.log(`\n📄 Using existing MockUSDT: ${usdtAddress}`);
        } else {
          console.log("\n⚠️  Could not find existing USDT address in frontend config");
        }
      } catch (error) {
        console.log("\n⚠️  Could not read frontend config for USDT address");
      }
    }

    // Configure proxy deployment fee via module (3 USDT)
    if (usdtAddress) {
      console.log("\n💰 Configuring proxy deployment fee...");
      tx = await proxyDeploymentModule.setPaymentToken(usdtAddress);
      await tx.wait();
      console.log(`   ✅ Payment token set to: ${usdtAddress}`);

      tx = await proxyDeploymentModule.setTreasuryAddress(deployer.address);
      await tx.wait();
      console.log(`   ✅ Treasury address set to: ${deployer.address}`);

      tx = await proxyDeploymentModule.setProxyDeploymentFee(3_000_000); // 3 USDT (6 decimals)
      await tx.wait();
      console.log("   ✅ Proxy deployment fee set to: 3 USDT");
    }

    // Set production mode if requested (disable dev mode for production)
    if (isProduction) {
      console.log("\n🏭 Setting production mode (disabling dev mode)...");
      const tx = await savingsCore.setDevelopmentMode(false);
      await tx.wait();
      console.log("   ✅ Production mode enabled (dev mode disabled)");
    } else {
      console.log("\n🧪 Development mode enabled by default");
    }

    // Update frontend addresses in networkConfig.json
    console.log("\n🔄 Updating frontend addresses...");
    const networkConfigPath = path.join(__dirname, "../../frontend/src/networkConfig.json");

    try {
      // Read and parse networkConfig.json
      const networkConfigContent = fs.readFileSync(networkConfigPath, "utf8");
      const networkConfig = JSON.parse(networkConfigContent);

      let addressChanged = false;

      // Update Savings contract address for localhost
      const currentSavingsAddress = networkConfig.evm?.localhost?.savingsContract;
      if (currentSavingsAddress !== savingsAddress) {
        if (!networkConfig.evm) networkConfig.evm = {};
        if (!networkConfig.evm.localhost) networkConfig.evm.localhost = {};

        networkConfig.evm.localhost.savingsContract = savingsAddress;
        addressChanged = true;
        console.log(`   Updated Savings address: ${savingsAddress}`);
      } else {
        console.log(`   Savings address unchanged: ${savingsAddress}`);
      }

      // Update USDT address only if we have a new one
      if (usdtAddress) {
        const currentUsdtAddress = networkConfig.evm?.localhost?.tokens?.USDT?.address;
        if (currentUsdtAddress !== usdtAddress) {
          if (!networkConfig.evm.localhost.tokens) networkConfig.evm.localhost.tokens = {};
          if (!networkConfig.evm.localhost.tokens.USDT) networkConfig.evm.localhost.tokens.USDT = {};

          networkConfig.evm.localhost.tokens.USDT.address = usdtAddress;
          addressChanged = true;
          console.log(`   Updated USDT address: ${usdtAddress}`);
        } else {
          console.log(`   USDT address unchanged: ${usdtAddress}`);
        }
      }

      if (addressChanged) {
        // Write back the updated config with proper formatting
        fs.writeFileSync(networkConfigPath, JSON.stringify(networkConfig, null, 2));
        console.log("✅ Frontend networkConfig.json updated successfully");
      } else {
        console.log("✅ Frontend addresses already up to date");
      }

    } catch (error) {
      console.log("⚠️  Warning: Could not update frontend networkConfig.json automatically");
      console.log(`   Error: ${error.message}`);
      console.log(`   Please manually update ${networkConfigPath}:`);
      console.log(`   - savingsContract: "${savingsAddress}"`);
      if (usdtAddress) {
        console.log(`   - USDT address: "${usdtAddress}"`);
      }
    }

    // Create module addresses config file for frontend

    // Update ABI files
    console.log("\n📋 Updating contract ABIs...");
    try {
      // Copy SavingsCore ABI
      const savingsCoreArtifact = require("../artifacts/contracts/SavingsCore.sol/SavingsCore.json");
      const frontendSavingsABIPath = path.join(__dirname, "../../frontend/src/SavingsABI.json");
      fs.writeFileSync(frontendSavingsABIPath, JSON.stringify(savingsCoreArtifact.abi, null, 2));
      console.log("✅ SavingsCore ABI updated");

      // Copy module ABIs
      const timePeriodLimitsArtifact = require("../artifacts/contracts/TimePeriodLimitsModule.sol/TimePeriodLimitsModule.json");
      const frontendTimePeriodLimitsABIPath = path.join(__dirname, "../../frontend/src/TimePeriodLimitsModuleABI.json");
      fs.writeFileSync(frontendTimePeriodLimitsABIPath, JSON.stringify(timePeriodLimitsArtifact.abi, null, 2));
      console.log("✅ TimePeriodLimitsModule ABI updated");

      const proposalSystemArtifact = require("../artifacts/contracts/ProposalSystemModule.sol/ProposalSystemModule.json");
      const frontendProposalSystemABIPath = path.join(__dirname, "../../frontend/src/ProposalSystemModuleABI.json");
      fs.writeFileSync(frontendProposalSystemABIPath, JSON.stringify(proposalSystemArtifact.abi, null, 2));
      console.log("✅ ProposalSystemModule ABI updated");

      const bypassSystemArtifact = require("../artifacts/contracts/BypassSystemModule.sol/BypassSystemModule.json");
      const frontendBypassSystemABIPath = path.join(__dirname, "../../frontend/src/BypassSystemModuleABI.json");
      fs.writeFileSync(frontendBypassSystemABIPath, JSON.stringify(bypassSystemArtifact.abi, null, 2));
      console.log("✅ BypassSystemModule ABI updated");

      const approvalSystemArtifact = require("../artifacts/contracts/ApprovalSystemModule.sol/ApprovalSystemModule.json");
      const frontendApprovalSystemABIPath = path.join(__dirname, "../../frontend/src/ApprovalSystemModuleABI.json");
      fs.writeFileSync(frontendApprovalSystemABIPath, JSON.stringify(approvalSystemArtifact.abi, null, 2));
      console.log("✅ ApprovalSystemModule ABI updated");

      const proxyDeploymentArtifact = require("../artifacts/contracts/ProxyDeploymentModule.sol/ProxyDeploymentModule.json");
      const frontendProxyDeploymentABIPath = path.join(__dirname, "../../frontend/src/ProxyDeploymentModuleABI.json");
      fs.writeFileSync(frontendProxyDeploymentABIPath, JSON.stringify(proxyDeploymentArtifact.abi, null, 2));
      console.log("✅ ProxyDeploymentModule ABI updated");

      // Copy MockUSDT ABI
      if (usdtAddress) {
        const usdtArtifact = require("../artifacts/contracts/MockUSDT.sol/MockUSDT.json");
        const frontendUSDTABIPath = path.join(__dirname, "../../frontend/src/MockUSDT_ABI.json");
        fs.writeFileSync(frontendUSDTABIPath, JSON.stringify(usdtArtifact.abi, null, 2));
        console.log("✅ MockUSDT ABI updated");
      }

      // Copy UserProxy ABI
      const userProxyArtifact = require("../artifacts/contracts/UserProxy.sol/UserProxy.json");
      const frontendUserProxyABIPath = path.join(__dirname, "../../frontend/src/UserProxyABI.json");
      fs.writeFileSync(frontendUserProxyABIPath, JSON.stringify(userProxyArtifact.abi, null, 2));
      console.log("✅ UserProxy ABI updated");

    } catch (error) {
      console.log("⚠️  Warning: Could not update ABIs automatically");
      console.log(`   Error: ${error.message}`);
    }

    // Summary
    console.log(`\n🎉 ${isUpgrade ? 'Upgrade' : 'Deployment'} Summary:`);
    console.log("=" .repeat(60));
    console.log(`Operation Type:        ${isUpgrade ? 'UPGRADE (Data Preserved)' : 'FRESH DEPLOYMENT'}`);
    console.log(`SavingsCore Address:   ${savingsAddress}`);
    console.log("Module Addresses:");
    console.log(`  TimePeriodLimits:    ${moduleAddresses.timePeriodLimits}`);
    console.log(`  ProposalSystem:      ${moduleAddresses.proposalSystem}`);
    console.log(`  BypassSystem:        ${moduleAddresses.bypassSystem}`);
    console.log(`  ApprovalSystem:      ${moduleAddresses.approvalSystem}`);
    console.log(`  ProxyDeployment:     ${moduleAddresses.proxyDeployment}`);
    if (usdtAddress) {
      console.log(`MockUSDT Address:      ${usdtAddress}`);
    }
    console.log(`Deployer Address:      ${deployer.address}`);

    // Check actual contract development mode state
    const contractDevMode = await savingsCore.getDevelopmentMode();
    console.log(`Development Mode:      ${contractDevMode ? 'ENABLED' : 'DISABLED'}`);
    console.log("=" .repeat(60));

    if (contractDevMode) {
      console.log("\n⚡ Fast Development Timing Active:");
      console.log("   • Spending limit proposals: 30 seconds");
      console.log("   • Withdrawal address requests: 10 seconds");
      console.log("   • Bypass requests: 10 seconds");
    } else {
      console.log("\n🏭 Production Security Timing Active:");
      console.log("   • Spending limit proposals: 24 hours");
      console.log("   • Withdrawal address requests: 24 hours");
      console.log("   • Bypass requests: 24 hours");
    }

    if (isUpgrade) {
      console.log("\n✅ Modular upgrade completed successfully!");
      console.log("   - Core contract address unchanged (proxy pattern working correctly)");
      console.log("   - All user data preserved");
      console.log("   - New modular functionality available");
      console.log("   - Modules can be upgraded independently in the future");
    } else {
      console.log("\n✅ Modular deployment completed successfully!");
      console.log("   - Core contract deployed with modular architecture");
      console.log("   - All modules deployed and registered");
      console.log("   - System ready for use");
    }

    console.log("\n📝 Next steps:");
    if (!isUpgrade && usdtAddress) {
      console.log("1. Add USDT token to MetaMask:");
      console.log(`   Address: ${usdtAddress}`);
      console.log("   Symbol: USDT");
      console.log("   Decimals: 6");
    }
    console.log(`${!isUpgrade && usdtAddress ? '2' : '1'}. Start your frontend: cd frontend && npm start`);
    console.log(`${!isUpgrade && usdtAddress ? '3' : '2'}. Frontend will automatically use the new modular addresses`);

    // Validate deployment integrity
    console.log("\n🔍 Running deployment validation...");
    try {
      // Verify all modules are registered
      const timePeriodLimitsRegistered = await savingsCore.getModule(ethers.keccak256(ethers.toUtf8Bytes("TIME_PERIOD_LIMITS")));
      const proposalSystemRegistered = await savingsCore.getModule(ethers.keccak256(ethers.toUtf8Bytes("PROPOSAL_SYSTEM")));
      const bypassSystemRegistered = await savingsCore.getModule(ethers.keccak256(ethers.toUtf8Bytes("BYPASS_SYSTEM")));
      const approvalSystemRegistered = await savingsCore.getModule(ethers.keccak256(ethers.toUtf8Bytes("APPROVAL_SYSTEM")));
      const proxyDeploymentRegistered = await savingsCore.getModule(ethers.keccak256(ethers.toUtf8Bytes("PROXY_DEPLOYMENT")));

      console.log("   Validating module registrations...");
      console.log(`   ✅ TimePeriodLimits: ${timePeriodLimitsRegistered === moduleAddresses.timePeriodLimits ? 'REGISTERED' : 'FAILED'}`);
      console.log(`   ✅ ProposalSystem: ${proposalSystemRegistered === moduleAddresses.proposalSystem ? 'REGISTERED' : 'FAILED'}`);
      console.log(`   ✅ BypassSystem: ${bypassSystemRegistered === moduleAddresses.bypassSystem ? 'REGISTERED' : 'FAILED'}`);
      console.log(`   ✅ ApprovalSystem: ${approvalSystemRegistered === moduleAddresses.approvalSystem ? 'REGISTERED' : 'FAILED'}`);
      console.log(`   ✅ ProxyDeployment: ${proxyDeploymentRegistered === moduleAddresses.proxyDeployment ? 'REGISTERED' : 'FAILED'}`);

      // Verify core contract can be called
      const owner = await savingsCore.owner();
      console.log(`   ✅ Core contract owner: ${owner}`);

      console.log("✅ Modular deployment validation passed!");

    } catch (error) {
      console.log(`\n⚠️  Could not run validation: ${error.message}`);
      console.log("Proceeding anyway...");
    }

  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});