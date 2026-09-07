const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const CONFIRM_ATTEMPTS = 10;
const CONFIRM_DELAY_MS = 3000;

async function readImplementation(proxyAddress) {
  const raw = await ethers.provider.getStorage(proxyAddress, IMPL_SLOT);
  return ethers.getAddress(`0x${raw.slice(26)}`);
}

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
  console.log("Upgrading SavingsCore implementation via UUPS proxy...\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  const networkConfigPath = path.join(__dirname, "../../frontend/src/networkConfig.json");
  const networkConfig = JSON.parse(fs.readFileSync(networkConfigPath, "utf8"));
  const network = hre.network.name === "hardhat" ? "localhost" : hre.network.name;
  const proxyAddress = networkConfig.evm?.[network]?.savingsContract;

  if (!proxyAddress) {
    console.log(`No SavingsCore address found for network: ${network}`);
    process.exit(1);
  }

  console.log(`SavingsCore proxy: ${proxyAddress}`);

  const currentImpl = await readImplementation(proxyAddress);
  console.log(`Current implementation: ${currentImpl}`);

  const CoreFactory = await ethers.getContractFactory("SavingsCore");
  const targetImpl = ethers.getAddress(
    await upgrades.prepareUpgrade(proxyAddress, CoreFactory, { kind: "uups" })
  );

  if (targetImpl === currentImpl) {
    console.log(`\nSavingsCore is already running this bytecode (${targetImpl}) — nothing to upgrade.`);
    return;
  }

  console.log(`\nUpgrading SavingsCore to ${targetImpl}...`);
  const upgraded = await upgrades.upgradeProxy(proxyAddress, CoreFactory);
  await upgraded.waitForDeployment();

  const newImpl = await confirmImplementation(proxyAddress, targetImpl);
  console.log(`New implementation: ${newImpl}`);
  console.log(`Proxy address (unchanged): ${proxyAddress}`);

  // Update ABI
  console.log("\nUpdating ABI...");
  try {
    const artifactPath = `../artifacts/contracts/SavingsCore.sol/SavingsCore.json`;
    const artifact = require(artifactPath);
    const frontendABIPath = path.join(__dirname, `../../frontend/src/SavingsABI.json`);
    fs.writeFileSync(frontendABIPath, JSON.stringify(artifact.abi, null, 2));
    console.log("SavingsCore ABI updated");
  } catch (error) {
    console.log(`Warning: Could not update ABI: ${error.message}`);
  }

  console.log(`\nUpgrade Summary:`);
  console.log("=".repeat(50));
  console.log(`Contract:        SavingsCore`);
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
