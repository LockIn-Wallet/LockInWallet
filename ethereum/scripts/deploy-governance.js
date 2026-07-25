const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploys the upgrade timelock and hands the savings system over to it:
 *
 *   Gnosis Safe (M-of-N, created at https://app.safe.global — not our code)
 *        └─ PROPOSER + CANCELLER of
 *   SavingsTimelock (public minDelay; EXECUTOR open — anyone once ready)
 *        └─ owner of SavingsCore + every registered module proxy
 *
 * After this runs, EVERY owner action (UUPS upgrades, registerModule,
 * setupModuleCrossReferences, treasury setters) must be scheduled by the
 * Safe, wait the public delay, and only then execute. Use
 * scripts/governance-upgrade.js for upgrades from then on —
 * deploy-modular's direct upgrade path will no longer be authorized.
 *
 * Configuration (env):
 *   GOV_PROPOSER   Safe address that controls the timelock
 *                  (default: deployer EOA — fine for localhost, NOT for prod)
 *   GOV_MIN_DELAY  timelock delay in seconds (default: 60 on localhost,
 *                  172800 = 48h elsewhere)
 */

const MODULE_IDS = [
  "TIME_PERIOD_LIMITS",
  "PROPOSAL_SYSTEM",
  "BYPASS_SYSTEM",
  "APPROVAL_SYSTEM",
  "PROXY_DEPLOYMENT",
  "POOL_TOGETHER",
  "VAULT_SYSTEM",
  "REFERRAL",
  "RECOVERY_SYSTEM",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = process.env.HARDHAT_NETWORK || "localhost";
  const isLocal = networkName === "localhost" || networkName === "hardhat";

  const proposer = process.env.GOV_PROPOSER || deployer.address;
  const minDelay = Number(process.env.GOV_MIN_DELAY || (isLocal ? 60 : 172800));

  console.log(`🏛️  Deploying upgrade timelock on ${networkName}`);
  console.log(`   Proposer (Safe): ${proposer}`);
  console.log(`   Delay: ${minDelay}s (${(minDelay / 3600).toFixed(1)}h)`);

  if (!isLocal && proposer.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("\n⚠️  WARNING: proposer is the deployer EOA, not a Safe.");
    console.log("   Create a Safe at https://app.safe.global and pass GOV_PROPOSER.");
  }

  // Resolve the deployed system from the frontend network config
  const networkConfigPath = path.join(__dirname, "../../frontend/src/networkConfig.json");
  const networkConfig = JSON.parse(fs.readFileSync(networkConfigPath, "utf8"));
  const coreAddress = networkConfig.evm?.[networkName]?.savingsContract;
  if (!coreAddress) throw new Error(`No savingsContract for evm.${networkName} in networkConfig.json`);

  const core = await ethers.getContractAt("SavingsCore", coreAddress);
  const currentOwner = await core.owner();
  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer ${deployer.address} is not the current owner (${currentOwner})`);
  }

  // Timelock: Safe proposes/cancels; execution is open once the delay
  // elapses (content approval stays M-of-N, only timing is free); admin =
  // zero so role changes also go through the delay
  console.log("\n⏳ Deploying SavingsTimelock...");
  const Timelock = await ethers.getContractFactory("SavingsTimelock");
  const timelock = await Timelock.deploy(minDelay, [proposer], [ethers.ZeroAddress], ethers.ZeroAddress);
  await timelock.waitForDeployment();
  console.log(`   ✅ SavingsTimelock: ${timelock.target}`);

  // Hand over ownership of the core and every registered module
  console.log("\n🤝 Transferring ownership to the timelock...");
  let tx = await core.transferOwnership(timelock.target);
  await tx.wait();
  console.log(`   ✅ SavingsCore -> timelock`);

  for (const idStr of MODULE_IDS) {
    const moduleAddress = await core.getModule(ethers.keccak256(ethers.toUtf8Bytes(idStr)));
    if (moduleAddress === ethers.ZeroAddress) {
      console.log(`   ⏭️  ${idStr}: not registered, skipping`);
      continue;
    }
    // Every module is Ownable with the same surface
    const module = await ethers.getContractAt("SavingsCore", moduleAddress);
    const moduleOwner = await module.owner();
    if (moduleOwner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log(`   ⏭️  ${idStr}: owned by ${moduleOwner}, skipping`);
      continue;
    }
    tx = await module.transferOwnership(timelock.target);
    await tx.wait();
    console.log(`   ✅ ${idStr} -> timelock`);
  }

  // Persist governance addresses for tooling (deployBlock bounds the
  // frontend's event scan so public RPC log-range caps aren't hit)
  const deployBlock = (await timelock.deploymentTransaction().wait()).blockNumber;
  networkConfig.evm[networkName].governance = {
    timelock: timelock.target,
    proposer,
    minDelay,
    deployBlock,
  };
  fs.writeFileSync(networkConfigPath, JSON.stringify(networkConfig, null, 2));
  console.log(`\n📝 Governance addresses saved to networkConfig.json (evm.${networkName}.governance)`);

  console.log("\n🎉 Governance handover complete.");
  console.log("   Owner actions now flow: Safe (schedule) -> public delay -> execute (anyone)");
  console.log("   For upgrades use: npx hardhat run scripts/governance-upgrade.js --network <net>");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
