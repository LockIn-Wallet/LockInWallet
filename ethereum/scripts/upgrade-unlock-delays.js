/**
 * Ships the per-period unlock delays release.
 *
 * Upgrades the three modules that changed, in place, so every proxy address
 * and all user data survive. Reads the proxy addresses from the on-chain
 * module registry rather than a hardcoded list, so it is safe to run against
 * any network where SavingsCore is deployed.
 *
 *   npx hardhat run scripts/upgrade-unlock-delays.js --network optimism
 *
 * Storage layout is validated for all three before anything is sent, so a
 * bad upgrade fails without spending gas or leaving the system half-upgraded.
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const MODULES = [
  { name: "TimePeriodLimitsModule", id: "TIME_PERIOD_LIMITS" },
  { name: "ProposalSystemModule", id: "PROPOSAL_SYSTEM" },
  { name: "BypassSystemModule", id: "BYPASS_SYSTEM" },
];

const NETWORK_CONFIG_PATH = path.join(__dirname, "../../frontend/src/networkConfig.json");

function coreAddressFor(networkName) {
  if (process.env.CORE) return process.env.CORE;
  const config = JSON.parse(fs.readFileSync(NETWORK_CONFIG_PATH, "utf8"));
  const entry = config.evm?.[networkName];
  const address = entry?.savingsContract || entry?.contractAddress;
  if (!address) {
    throw new Error(
      `No SavingsCore address for "${networkName}" in networkConfig.json — pass CORE=0x... instead`,
    );
  }
  return address;
}

async function main() {
  const { ethers, upgrades } = hre;
  const networkName = hre.network.name;
  const core = coreAddressFor(networkName);

  const [deployer] = await ethers.getSigners();
  const balanceBefore = await ethers.provider.getBalance(deployer.address);

  console.log(`Network : ${networkName} (chainId ${(await ethers.provider.getNetwork()).chainId})`);
  console.log(`Core    : ${core}`);
  console.log(`Deployer: ${deployer.address} (${ethers.formatEther(balanceBefore)} ETH)\n`);

  const savingsCore = await ethers.getContractAt("SavingsCore", core);
  const owner = await savingsCore.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer does not own SavingsCore (owner is ${owner})`);
  }

  // Resolve every proxy from the registry first — a missing registration is a
  // reason to stop before sending anything
  const targets = [];
  for (const { name, id } of MODULES) {
    const proxy = await savingsCore.getModule(ethers.keccak256(ethers.toUtf8Bytes(id)));
    if (proxy === ethers.ZeroAddress) throw new Error(`${name} is not registered on this core`);
    targets.push({ name, proxy, factory: await ethers.getContractFactory(name) });
  }

  console.log("Validating storage layouts...");
  for (const { name, proxy, factory } of targets) {
    await upgrades.validateUpgrade(proxy, factory, { kind: "uups" });
    console.log(`  ok  ${name} (${proxy})`);
  }

  console.log("\nUpgrading...");
  for (const { name, proxy, factory } of targets) {
    const upgraded = await upgrades.upgradeProxy(proxy, factory, { kind: "uups" });
    await upgraded.waitForDeployment();
    const impl = await upgrades.erc1967.getImplementationAddress(proxy);
    console.log(`  done ${name}: proxy ${proxy} -> impl ${impl}`);
  }

  // Prove the new code is actually live rather than trusting the receipts
  const limits = await ethers.getContractAt("TimePeriodLimitsModule", targets[0].proxy);
  const maxDelay = Number(await limits.MAX_UNLOCK_DELAY());
  const defaultDelay = Number(await limits.DEFAULT_UNLOCK_DELAY());
  console.log(
    `\nLive check: MAX_UNLOCK_DELAY=${maxDelay / 86400}d DEFAULT_UNLOCK_DELAY=${defaultDelay / 86400}d`,
  );

  const spent = balanceBefore - (await ethers.provider.getBalance(deployer.address));
  console.log(`Gas spent : ${ethers.formatEther(spent)} ETH`);
  console.log("\nProxy addresses unchanged — no frontend address update needed.");
}

main().catch((error) => {
  console.error("\nUpgrade failed:", error.message);
  process.exit(1);
});
