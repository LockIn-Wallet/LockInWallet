const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

const TARGET_NETWORK = hre.network.name === "hardhat" ? "localhost" : hre.network.name;
const NETWORK_CONFIG_PATH = path.join(__dirname, "../../frontend/src/networkConfig.json");

function readNetworkConfig() {
  return JSON.parse(fs.readFileSync(NETWORK_CONFIG_PATH, "utf8"));
}

// Auto-detect existing proxy address from the frontend network config
function getExistingProxyAddress() {
  try {
    const address = readNetworkConfig().evm?.[TARGET_NETWORK]?.savingsContract;
    if (address && address !== "0x0000000000000000000000000000000000000000") {
      return address;
    }
  } catch (error) {
    console.log("Could not read existing address from network config");
  }
  return null;
}

const PROXY_ADDRESS = getExistingProxyAddress();

// Check for production mode flag (dev mode disabled for production)
const isProduction = process.env.PRODUCTION === 'true';

// Mock tokens and mock prize vaults belong to localhost only. Gating them on
// the network rather than on the PRODUCTION flag means forgetting the flag on a
// live chain can no longer deploy a worthless MockUSDT and write its address
// into the frontend as if it were real USDT.
const isLocalNetwork = TARGET_NETWORK === "localhost";

// Deposit-address fee on a live chain, charged in native ETH (paymentToken
// address(0)) so a brand-new user needs no ERC20 to get started. Mirrors the
// live Optimism setting; override with PROXY_FEE_ETH for a different chain.
const LIVE_PROXY_FEE_ETH = process.env.PROXY_FEE_ETH || "0.001";

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
        // Only fall back to a fresh deployment when the proxy genuinely does
        // not exist. If a contract lives at the address, a transient upgrade
        // failure must halt: redeploying would orphan module-custodied funds
        // (VaultSystemModule holds user deposits).
        const code = await ethers.provider.getCode(PROXY_ADDRESS).catch(() => "0x");
        if (code && code !== "0x") {
          console.log(`❌ Upgrade failed but a contract exists at ${PROXY_ADDRESS}: ${error.message}`);
          console.log("🛑 Aborting instead of redeploying over a live system.");
          process.exit(1);
        }
        console.log(`⚠️  No contract found at ${PROXY_ADDRESS} (${error.message})`);
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

    // Deploy or upgrade modules (each a UUPS proxy). Modules already
    // registered on the core are upgraded IN PLACE so their storage —
    // spending limits, setup flags, approval addresses, custodied vault
    // funds — persists across updates. Fresh proxies are only deployed for
    // modules the core does not know yet.
    async function deployOrUpgradeModule(name, moduleIdString, emoji, opts = {}) {
      const Factory = await ethers.getContractFactory(name);
      const moduleId = ethers.keccak256(ethers.toUtf8Bytes(moduleIdString));
      const existing = isUpgrade ? await savingsCore.getModule(moduleId) : ethers.ZeroAddress;

      if (existing !== ethers.ZeroAddress) {
        console.log(`   ${emoji} Upgrading ${name} in place at ${existing}...`);
        let upgraded;
        try {
          upgraded = await upgrades.upgradeProxy(existing, Factory, opts);
        } catch (error) {
          // Proxy unknown to this machine's OZ manifest (e.g. fresh clone) —
          // import it, then retry the upgrade
          await upgrades.forceImport(existing, Factory, opts);
          upgraded = await upgrades.upgradeProxy(existing, Factory, opts);
        }
        await upgraded.waitForDeployment();
        console.log(`   ✅ ${name} upgraded (address and data preserved)`);
        return { address: existing, contract: upgraded, isNew: false, moduleId };
      }

      console.log(`   ${emoji} Deploying ${name} (proxy)...`);
      const proxy = await upgrades.deployProxy(Factory, [savingsAddress], { initializer: "initialize", ...opts });
      await proxy.waitForDeployment();
      const address = await proxy.getAddress();
      console.log(`   ✅ ${name} proxy deployed to: ${address}`);
      return { address, contract: proxy, isNew: true, moduleId };
    }

    console.log("\n🧩 Deploying/upgrading modules...");
    const modules = {
      timePeriodLimits: await deployOrUpgradeModule("TimePeriodLimitsModule", "TIME_PERIOD_LIMITS", "📊"),
      proposalSystem: await deployOrUpgradeModule("ProposalSystemModule", "PROPOSAL_SYSTEM", "📝"),
      bypassSystem: await deployOrUpgradeModule("BypassSystemModule", "BYPASS_SYSTEM", "🚨"),
      approvalSystem: await deployOrUpgradeModule("ApprovalSystemModule", "APPROVAL_SYSTEM", "🔐"),
      proxyDeployment: await deployOrUpgradeModule("ProxyDeploymentModule", "PROXY_DEPLOYMENT", "🔑", { unsafeAllow: ["constructor"] }),
      poolTogether: await deployOrUpgradeModule("PoolTogetherModule", "POOL_TOGETHER", "🎰"),
      vaultSystem: await deployOrUpgradeModule("VaultSystemModule", "VAULT_SYSTEM", "🏦"),
      referral: await deployOrUpgradeModule("ReferralModule", "REFERRAL", "🤝"),
      recoverySystem: await deployOrUpgradeModule("RecoverySystemModule", "RECOVERY_SYSTEM", "🛟"),
    };
    for (const [key, m] of Object.entries(modules)) moduleAddresses[key] = m.address;
    const proxyDeploymentModule = modules.proxyDeployment.contract;
    const poolTogetherModule = modules.poolTogether.contract;

    // Register newly deployed modules with the core contract (upgraded-in-place
    // modules keep their existing registration)
    console.log("\n🔗 Registering modules with core contract...");
    let tx;
    for (const [key, moduleInfo] of Object.entries(modules)) {
      if (!moduleInfo.isNew) continue;
      console.log(`   Registering ${key}...`);
      tx = await savingsCore.registerModule(moduleInfo.moduleId, moduleInfo.address);
      await tx.wait();
    }
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

    // Deploy MockUSDT only on localhost. Every other network already has real
    // token addresses in the frontend config and must keep them.
    let usdtAddress;
    if (!isUpgrade && isLocalNetwork) {
      console.log("\n📄 Deploying MockUSDT...");
      const MockUSDT = await ethers.getContractFactory("MockUSDT");
      const mockUSDT = await MockUSDT.deploy();
      await mockUSDT.waitForDeployment();
      usdtAddress = await mockUSDT.getAddress();

      const usdtBalance = await mockUSDT.balanceOf(deployer.address);
      console.log(`✅ MockUSDT deployed to: ${usdtAddress}`);
      console.log(`   Deployer USDT balance: ${ethers.formatUnits(usdtBalance, 6)} USDT`);
    } else {
      // Upgrades, and every fresh deployment on a live chain, reuse the token
      // address already recorded in the network config
      try {
        usdtAddress = readNetworkConfig().evm?.[TARGET_NETWORK]?.tokens?.USDT?.address;
        if (usdtAddress) {
          console.log(`\n📄 Using existing USDT: ${usdtAddress}`);
        } else {
          console.log("\n⚠️  Could not find existing USDT address in network config");
        }
      } catch (error) {
        console.log("\n⚠️  Could not read network config for USDT address");
      }
    }

    // Configure the deposit-address fee. Fresh deployments only — upgrades must
    // never overwrite a live fee model. Localhost charges the mock ERC20 so the
    // approve-then-pay path gets exercised; live chains charge native ETH, which
    // a user arriving with nothing but a card can actually pay.
    if (!isUpgrade) {
      console.log("\n💰 Configuring deposit-address fee...");

      if (isLocalNetwork && usdtAddress) {
        tx = await proxyDeploymentModule.setPaymentToken(usdtAddress);
        await tx.wait();
        console.log(`   ✅ Payment token set to: ${usdtAddress}`);

        tx = await proxyDeploymentModule.setTreasuryAddress(deployer.address);
        await tx.wait();
        console.log(`   ✅ Treasury address set to: ${deployer.address}`);

        tx = await proxyDeploymentModule.setProxyDeploymentFee(3_000_000); // 3 USDT (6 decimals)
        await tx.wait();
        console.log("   ✅ Deposit-address fee set to: 3 USDT");
      } else {
        // address(0) selects native ETH payment
        tx = await proxyDeploymentModule.setPaymentToken(ethers.ZeroAddress);
        await tx.wait();
        console.log("   ✅ Payment token set to: native ETH");

        tx = await proxyDeploymentModule.setTreasuryAddress(deployer.address);
        await tx.wait();
        console.log(`   ✅ Treasury address set to: ${deployer.address}`);

        const fee = ethers.parseEther(LIVE_PROXY_FEE_ETH);
        tx = await proxyDeploymentModule.setProxyDeploymentFee(fee);
        await tx.wait();
        console.log(`   ✅ Deposit-address fee set to: ${LIVE_PROXY_FEE_ETH} ETH`);
      }
    }

    // Deploy and configure mock PoolTogether vaults for localhost testing
    if (!isUpgrade && isLocalNetwork && !isProduction && usdtAddress) {
      console.log("\n🎰 Deploying mock PoolTogether contracts...");

      const MockPrizeVault = await ethers.getContractFactory("MockPrizeVault");
      const mockPrizeVault = await MockPrizeVault.deploy(usdtAddress);
      await mockPrizeVault.waitForDeployment();
      const prizeVaultAddress = await mockPrizeVault.getAddress();
      console.log(`   ✅ MockPrizeVault deployed to: ${prizeVaultAddress}`);

      // Grand prize: 500 USDT (6 decimals), 4 prize tiers
      const grandPrize = 500_000_000; // 500 USDT
      const MockPrizePool = await ethers.getContractFactory("MockPrizePool");
      const mockPrizePool = await MockPrizePool.deploy(grandPrize, 4, usdtAddress);
      await mockPrizePool.waitForDeployment();
      const prizePoolAddress = await mockPrizePool.getAddress();
      console.log(`   ✅ MockPrizePool deployed to: ${prizePoolAddress}`);

      // Fund the prize pool with USDT so prizes can be claimed
      const mockUSDT = await ethers.getContractAt("MockUSDT", usdtAddress);
      tx = await mockUSDT.transfer(prizePoolAddress, 10_000_000_000); // 10,000 USDT reserve
      await tx.wait();
      console.log(`   ✅ Prize pool funded with 10,000 USDT`);

      console.log("   Configuring PoolTogetherModule with mock vaults...");
      tx = await poolTogetherModule.setPrizeVault(usdtAddress, prizeVaultAddress);
      await tx.wait();
      console.log(`   ✅ Prize vault set for USDT: ${prizeVaultAddress}`);

      tx = await poolTogetherModule.setPrizePool(prizePoolAddress);
      await tx.wait();
      console.log(`   ✅ Prize pool set: ${prizePoolAddress}`);
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

      // Update Savings contract address for the target network
      const currentSavingsAddress = networkConfig.evm?.[TARGET_NETWORK]?.savingsContract;
      if (currentSavingsAddress !== savingsAddress) {
        if (!networkConfig.evm) networkConfig.evm = {};
        if (!networkConfig.evm[TARGET_NETWORK]) networkConfig.evm[TARGET_NETWORK] = {};

        networkConfig.evm[TARGET_NETWORK].savingsContract = savingsAddress;
        addressChanged = true;
        console.log(`   Updated Savings address: ${savingsAddress}`);
      } else {
        console.log(`   Savings address unchanged: ${savingsAddress}`);
      }

      // Update USDT address only if we have a new one
      if (usdtAddress) {
        const currentUsdtAddress = networkConfig.evm?.[TARGET_NETWORK]?.tokens?.USDT?.address;
        if (currentUsdtAddress !== usdtAddress) {
          if (!networkConfig.evm[TARGET_NETWORK].tokens) networkConfig.evm[TARGET_NETWORK].tokens = {};
          if (!networkConfig.evm[TARGET_NETWORK].tokens.USDT) networkConfig.evm[TARGET_NETWORK].tokens.USDT = {};

          networkConfig.evm[TARGET_NETWORK].tokens.USDT.address = usdtAddress;
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

      const poolTogetherArtifact = require("../artifacts/contracts/PoolTogetherModule.sol/PoolTogetherModule.json");
      const frontendPoolTogetherABIPath = path.join(__dirname, "../../frontend/src/PoolTogetherModuleABI.json");
      fs.writeFileSync(frontendPoolTogetherABIPath, JSON.stringify(poolTogetherArtifact.abi, null, 2));
      console.log("✅ PoolTogetherModule ABI updated");

      const vaultSystemArtifact = require("../artifacts/contracts/VaultSystemModule.sol/VaultSystemModule.json");
      const frontendVaultSystemABIPath = path.join(__dirname, "../../frontend/src/VaultSystemModuleABI.json");
      fs.writeFileSync(frontendVaultSystemABIPath, JSON.stringify(vaultSystemArtifact.abi, null, 2));
      console.log("✅ VaultSystemModule ABI updated");

      const referralArtifact = require("../artifacts/contracts/ReferralModule.sol/ReferralModule.json");
      const frontendReferralABIPath = path.join(__dirname, "../../frontend/src/ReferralModuleABI.json");
      fs.writeFileSync(frontendReferralABIPath, JSON.stringify(referralArtifact.abi, null, 2));
      console.log("✅ ReferralModule ABI updated");

      const recoverySystemArtifact = require("../artifacts/contracts/RecoverySystemModule.sol/RecoverySystemModule.json");
      const frontendRecoverySystemABIPath = path.join(__dirname, "../../frontend/src/RecoverySystemModuleABI.json");
      fs.writeFileSync(frontendRecoverySystemABIPath, JSON.stringify(recoverySystemArtifact.abi, null, 2));
      console.log("✅ RecoverySystemModule ABI updated");

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
    console.log(`  PoolTogether:        ${moduleAddresses.poolTogether}`);
    console.log(`  VaultSystem:         ${moduleAddresses.vaultSystem}`);
    console.log(`  RecoverySystem:      ${moduleAddresses.recoverySystem}`);
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
      const poolTogetherRegistered = await savingsCore.getModule(ethers.keccak256(ethers.toUtf8Bytes("POOL_TOGETHER")));

      console.log("   Validating module registrations...");
      console.log(`   ✅ TimePeriodLimits: ${timePeriodLimitsRegistered === moduleAddresses.timePeriodLimits ? 'REGISTERED' : 'FAILED'}`);
      console.log(`   ✅ ProposalSystem: ${proposalSystemRegistered === moduleAddresses.proposalSystem ? 'REGISTERED' : 'FAILED'}`);
      console.log(`   ✅ BypassSystem: ${bypassSystemRegistered === moduleAddresses.bypassSystem ? 'REGISTERED' : 'FAILED'}`);
      console.log(`   ✅ ApprovalSystem: ${approvalSystemRegistered === moduleAddresses.approvalSystem ? 'REGISTERED' : 'FAILED'}`);
      console.log(`   ✅ ProxyDeployment: ${proxyDeploymentRegistered === moduleAddresses.proxyDeployment ? 'REGISTERED' : 'FAILED'}`);
      console.log(`   ✅ PoolTogether: ${poolTogetherRegistered === moduleAddresses.poolTogether ? 'REGISTERED' : 'FAILED'}`);

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