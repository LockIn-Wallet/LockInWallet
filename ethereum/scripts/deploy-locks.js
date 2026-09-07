const { ethers } = require("hardhat");
const { syncAbis } = require("./sync-abis");
const { TARGET_NETWORK, writeNetworkAddress } = require("./network-config");

const CONFIG_KEY = "lockedVaultFactory";

/**
 * Deploys the immutable LockedVaultFactory and records it for the frontend.
 *
 * There is nothing to upgrade or register: the factory has no owner and no
 * link to SavingsCore. Running this on a live chain a second time simply
 * creates a second, unrelated factory — so it is called from the modular
 * deploy only on localhost and run by hand everywhere else.
 */
async function deployLockedVaultFactory() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n🔒 Deploying LockedVaultFactory on ${TARGET_NETWORK} with ${deployer.address}...`);

  const Factory = await ethers.getContractFactory("LockedVaultFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const address = await factory.getAddress();
  console.log(`   ✅ LockedVaultFactory: ${address}`);

  const changed = writeNetworkAddress(CONFIG_KEY, address);
  console.log(changed ? `   ✅ networkConfig.json ${TARGET_NETWORK}.${CONFIG_KEY} updated` : "   networkConfig.json unchanged");
  return address;
}

if (require.main === module) {
  deployLockedVaultFactory()
    .then(() => syncAbis({ quiet: true }))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { deployLockedVaultFactory };
