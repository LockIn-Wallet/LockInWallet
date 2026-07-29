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
 * Storage layout is validated for all three before anything is sent, so an
 * incompatible upgrade costs no gas. That does NOT make the run atomic: each
 * module is its own transaction, and one failing part-way leaves the rest on
 * the old code. Re-running is safe and picks up where it stopped — upgrading
 * a module that already runs the new implementation is a no-op.
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const MODULES = [
  { name: "TimePeriodLimitsModule", id: "TIME_PERIOD_LIMITS" },
  { name: "ProposalSystemModule", id: "PROPOSAL_SYSTEM" },
  { name: "BypassSystemModule", id: "BYPASS_SYSTEM" },
  // Recovery carries the spending limits onto the recovered address, which
  // needs the two migration entry points the modules above gained
  { name: "RecoverySystemModule", id: "RECOVERY_SYSTEM" },
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
    const before = await upgrades.erc1967.getImplementationAddress(proxy);
    // Public RPC endpoints sit behind load balancers whose nodes disagree
    // about the account nonce, which fails the send with "nonce too low"
    // while the chain itself is fine. Refresh and retry rather than abandon
    // the run half-done.
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const upgraded = await upgrades.upgradeProxy(proxy, factory, { kind: "uups" });
        await upgraded.waitForDeployment();
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (!/nonce|replacement|timeout|already known/i.test(error.message)) throw error;
        console.log(`  retry ${name} after: ${error.message.split("\n")[0]}`);
        await ethers.provider.getTransactionCount(deployer.address, "pending");
        await new Promise((resolve) => setTimeout(resolve, 4000 * attempt));
      }
    }
    if (lastError) throw lastError;

    const impl = await upgrades.erc1967.getImplementationAddress(proxy);
    const note = impl === before ? "already current" : `impl ${impl}`;
    console.log(`  done ${name}: proxy ${proxy} -> ${note}`);
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
