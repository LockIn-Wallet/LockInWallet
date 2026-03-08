const { ethers, upgrades } = require("hardhat");

/**
 * One-time migration script for Optimism deployment.
 * Deploys new upgradeable module proxies, migrates state from old modules,
 * re-registers modules in SavingsCore, and locks migration.
 *
 * Usage:
 *   CORE_ADDRESS=0x... OLD_TIME_LIMITS=0x... OLD_PROPOSAL=0x... OLD_BYPASS=0x... OLD_APPROVAL=0x... OLD_PROXY_DEPLOY=0x... \
 *   npx hardhat run scripts/migrate-to-upgradeable-modules.js --network optimism
 *
 * Set USERS as comma-separated addresses to migrate specific users:
 *   USERS=0xabc,0xdef npx hardhat run ...
 */

const MODULE_IDS = {
  TIME_PERIOD_LIMITS: ethers.keccak256(ethers.toUtf8Bytes("TIME_PERIOD_LIMITS")),
  PROPOSAL_SYSTEM: ethers.keccak256(ethers.toUtf8Bytes("PROPOSAL_SYSTEM")),
  BYPASS_SYSTEM: ethers.keccak256(ethers.toUtf8Bytes("BYPASS_SYSTEM")),
  APPROVAL_SYSTEM: ethers.keccak256(ethers.toUtf8Bytes("APPROVAL_SYSTEM")),
  PROXY_DEPLOYMENT: ethers.keccak256(ethers.toUtf8Bytes("PROXY_DEPLOYMENT"))
};

function getEnvOrFail(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const coreAddress = getEnvOrFail("CORE_ADDRESS");
  const oldTimeLimitsAddr = getEnvOrFail("OLD_TIME_LIMITS");
  const oldProposalAddr = getEnvOrFail("OLD_PROPOSAL");
  const oldBypassAddr = getEnvOrFail("OLD_BYPASS");
  const oldApprovalAddr = getEnvOrFail("OLD_APPROVAL");
  const oldProxyDeployAddr = getEnvOrFail("OLD_PROXY_DEPLOY");

  const users = process.env.USERS ? process.env.USERS.split(",") : [];
  if (users.length === 0) {
    console.log("Warning: No USERS specified. Deploying new modules but skipping state migration.");
    console.log("Set USERS=0xabc,0xdef to migrate user state.\n");
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`SavingsCore: ${coreAddress}\n`);

  const savingsCore = await ethers.getContractAt("SavingsCore", coreAddress);

  // Connect to old modules for reading state
  const oldTimeLimits = await ethers.getContractAt("ITimePeriodLimitsModule", oldTimeLimitsAddr);
  const oldProposal = await ethers.getContractAt("IProposalSystemModule", oldProposalAddr);
  const oldApproval = await ethers.getContractAt("IApprovalSystemModule", oldApprovalAddr);

  // ========== Step 1: Deploy new upgradeable module proxies ==========
  console.log("Step 1: Deploying new upgradeable module proxies...\n");

  const TimePeriodLimitsModule = await ethers.getContractFactory("TimePeriodLimitsModule");
  const newTimeLimits = await upgrades.deployProxy(TimePeriodLimitsModule, [coreAddress], { initializer: "initialize" });
  await newTimeLimits.waitForDeployment();
  const newTimeLimitsAddr = await newTimeLimits.getAddress();
  console.log(`  TimePeriodLimitsModule proxy: ${newTimeLimitsAddr}`);

  const ProposalSystemModule = await ethers.getContractFactory("ProposalSystemModule");
  const newProposal = await upgrades.deployProxy(ProposalSystemModule, [coreAddress], { initializer: "initialize" });
  await newProposal.waitForDeployment();
  const newProposalAddr = await newProposal.getAddress();
  console.log(`  ProposalSystemModule proxy: ${newProposalAddr}`);

  const BypassSystemModule = await ethers.getContractFactory("BypassSystemModule");
  const newBypass = await upgrades.deployProxy(BypassSystemModule, [coreAddress], { initializer: "initialize" });
  await newBypass.waitForDeployment();
  const newBypassAddr = await newBypass.getAddress();
  console.log(`  BypassSystemModule proxy: ${newBypassAddr}`);

  const ApprovalSystemModule = await ethers.getContractFactory("ApprovalSystemModule");
  const newApproval = await upgrades.deployProxy(ApprovalSystemModule, [coreAddress], { initializer: "initialize" });
  await newApproval.waitForDeployment();
  const newApprovalAddr = await newApproval.getAddress();
  console.log(`  ApprovalSystemModule proxy: ${newApprovalAddr}`);

  const ProxyDeploymentModule = await ethers.getContractFactory("ProxyDeploymentModule");
  const newProxyDeploy = await upgrades.deployProxy(ProxyDeploymentModule, [coreAddress], { initializer: "initialize", unsafeAllow: ["constructor"] });
  await newProxyDeploy.waitForDeployment();
  const newProxyDeployAddr = await newProxyDeploy.getAddress();
  console.log(`  ProxyDeploymentModule proxy: ${newProxyDeployAddr}`);

  // ========== Step 2: Migrate state from old modules ==========
  if (users.length > 0) {
    console.log(`\nStep 2: Migrating state for ${users.length} user(s)...\n`);

    for (const user of users) {
      console.log(`  Migrating user: ${user}`);

      // Migrate spending limits (one period at a time to avoid stack-too-deep)
      const [names, limits, spent, , durations, active] = await oldTimeLimits.getUserSpendingLimits(user);
      for (let i = 0; i < names.length; i++) {
        const [, , , , lastReset] = await oldTimeLimits.getTimePeriodLimit(user, names[i]);
        const tx = await newTimeLimits.migrateUserLimit(
          user, names[i], limits[i], spent[i], lastReset, durations[i], active[i]
        );
        await tx.wait();
      }
      if (names.length > 0) {
        console.log(`    TimePeriodLimits: ${names.length} periods migrated`);
      }

      // Migrate setup data
      const [committed, totalLockedValue, commitTimestamp, increasesInPeriod, lastIncreaseTimestamp] =
        await oldProposal.getSetupInfo(user);
      if (committed) {
        const tx = await newProposal.migrateSetupData(
          user, committed, totalLockedValue, commitTimestamp, lastIncreaseTimestamp, increasesInPeriod
        );
        await tx.wait();
        console.log(`    ProposalSystem: setup data migrated`);
      }

      // Migrate withdrawal addresses
      const [titles, destinations, timestamps] = await oldApproval.getUserWithdrawalAddresses(user);
      if (titles.length > 0) {
        const tx = await newApproval.migrateWithdrawalAddresses(user, titles, destinations, timestamps);
        await tx.wait();
        console.log(`    ApprovalSystem: ${titles.length} withdrawal addresses migrated`);
      }

      // Migrate proxy mapping
      const oldProxyDeployModule = await ethers.getContractAt("IProxyDeploymentModule", oldProxyDeployAddr);
      const userProxy = await oldProxyDeployModule.getUserProxy(user);
      if (userProxy !== ethers.ZeroAddress) {
        const tx = await newProxyDeploy.registerExistingProxy(user, userProxy);
        await tx.wait();
        console.log(`    ProxyDeployment: proxy ${userProxy} registered`);
      }
    }
  } else {
    console.log("\nStep 2: Skipped (no users specified)");
  }

  // ========== Step 3: Migrate ProxyDeployment config ==========
  console.log("\nStep 3: Migrating ProxyDeployment configuration...");
  const oldProxyDeployModule = await ethers.getContractAt("ProxyDeploymentModule", oldProxyDeployAddr);

  const treasury = await oldProxyDeployModule.treasuryAddress();
  const token = await oldProxyDeployModule.paymentToken();
  const fee = await oldProxyDeployModule.proxyDeploymentFee();

  if (treasury !== ethers.ZeroAddress) {
    let tx = await newProxyDeploy.setTreasuryAddress(treasury);
    await tx.wait();
    console.log(`  Treasury: ${treasury}`);
  }
  if (token !== ethers.ZeroAddress) {
    let tx = await newProxyDeploy.setPaymentToken(token);
    await tx.wait();
    console.log(`  Payment token: ${token}`);
  }
  if (fee > 0) {
    let tx = await newProxyDeploy.setProxyDeploymentFee(fee);
    await tx.wait();
    console.log(`  Fee: ${fee}`);
  }

  // ========== Step 4: Re-register modules in SavingsCore ==========
  console.log("\nStep 4: Re-registering modules in SavingsCore...");

  let tx;
  tx = await savingsCore.registerModule(MODULE_IDS.TIME_PERIOD_LIMITS, newTimeLimitsAddr);
  await tx.wait();
  tx = await savingsCore.registerModule(MODULE_IDS.PROPOSAL_SYSTEM, newProposalAddr);
  await tx.wait();
  tx = await savingsCore.registerModule(MODULE_IDS.BYPASS_SYSTEM, newBypassAddr);
  await tx.wait();
  tx = await savingsCore.registerModule(MODULE_IDS.APPROVAL_SYSTEM, newApprovalAddr);
  await tx.wait();
  tx = await savingsCore.registerModule(MODULE_IDS.PROXY_DEPLOYMENT, newProxyDeployAddr);
  await tx.wait();
  console.log("  All modules re-registered");

  // ========== Step 5: Set up cross-references ==========
  console.log("\nStep 5: Setting up cross-references...");
  tx = await savingsCore.setupModuleCrossReferences();
  await tx.wait();
  console.log("  Cross-references configured");

  // ========== Step 6: Lock migration ==========
  console.log("\nStep 6: Locking migration functions...");
  tx = await newTimeLimits.lockMigration();
  await tx.wait();
  tx = await newProposal.lockMigration();
  await tx.wait();
  tx = await newBypass.lockMigration();
  await tx.wait();
  tx = await newApproval.lockMigration();
  await tx.wait();
  tx = await newProxyDeploy.lockMigration();
  await tx.wait();
  console.log("  All migration functions locked");

  // ========== Step 7: Validate ==========
  console.log("\nStep 7: Validating...");

  const regTimeLimits = await savingsCore.getModule(MODULE_IDS.TIME_PERIOD_LIMITS);
  const regProposal = await savingsCore.getModule(MODULE_IDS.PROPOSAL_SYSTEM);
  const regBypass = await savingsCore.getModule(MODULE_IDS.BYPASS_SYSTEM);
  const regApproval = await savingsCore.getModule(MODULE_IDS.APPROVAL_SYSTEM);
  const regProxyDeploy = await savingsCore.getModule(MODULE_IDS.PROXY_DEPLOYMENT);

  const allMatch =
    regTimeLimits === newTimeLimitsAddr &&
    regProposal === newProposalAddr &&
    regBypass === newBypassAddr &&
    regApproval === newApprovalAddr &&
    regProxyDeploy === newProxyDeployAddr;

  if (allMatch) {
    console.log("  All module registrations verified");
  } else {
    console.error("  MODULE REGISTRATION MISMATCH!");
    process.exit(1);
  }

  // Validate user state if users were migrated
  if (users.length > 0) {
    for (const user of users) {
      const newTimeLimitsContract = await ethers.getContractAt("TimePeriodLimitsModule", newTimeLimitsAddr);
      const [newNames] = await newTimeLimitsContract.getUserSpendingLimits(user);
      const [oldNames] = await oldTimeLimits.getUserSpendingLimits(user);
      if (newNames.length !== oldNames.length) {
        console.error(`  State mismatch for user ${user}: periods ${oldNames.length} -> ${newNames.length}`);
      } else {
        console.log(`  User ${user}: ${newNames.length} periods verified`);
      }
    }
  }

  console.log("\nMigration complete!");
  console.log("=".repeat(60));
  console.log(`TimePeriodLimitsModule: ${newTimeLimitsAddr}`);
  console.log(`ProposalSystemModule:   ${newProposalAddr}`);
  console.log(`BypassSystemModule:     ${newBypassAddr}`);
  console.log(`ApprovalSystemModule:   ${newApprovalAddr}`);
  console.log(`ProxyDeploymentModule:  ${newProxyDeployAddr}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
