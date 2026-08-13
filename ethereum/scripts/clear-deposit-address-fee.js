/**
 * Clear the deposit-address fee on an already-deployed chain.
 *
 * Fresh deployments no longer set a fee at all, but chains deployed before that
 * change still carry one on-chain. This zeroes it, so generating a permanent
 * deposit address costs nothing but gas — and, once a sponsor is paying that
 * gas, nothing at all.
 *
 * The fee machinery stays in the contract, so this is reversible with
 * setProxyDeploymentFee() and no upgrade.
 *
 * Usage:
 *   npx hardhat run scripts/clear-deposit-address-fee.js --network optimism
 */

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

const PROXY_DEPLOYMENT_MODULE_ID = ethers.keccak256(
  ethers.toUtf8Bytes("PROXY_DEPLOYMENT")
);

async function main() {
  const [signer] = await ethers.getSigners();
  const network = hre.network.name === "hardhat" ? "localhost" : hre.network.name;

  console.log(`Network:  ${network}`);
  console.log(`Signer:   ${signer.address}\n`);

  const networkConfigPath = path.join(
    __dirname,
    "../../frontend/src/networkConfig.json"
  );
  const networkConfig = JSON.parse(fs.readFileSync(networkConfigPath, "utf8"));
  const coreAddress = networkConfig.evm?.[network]?.savingsContract;

  if (!coreAddress) {
    console.log(`No SavingsCore address found for network: ${network}`);
    process.exit(1);
  }

  const savingsCore = await ethers.getContractAt("SavingsCore", coreAddress);
  const moduleAddress = await savingsCore.getModule(PROXY_DEPLOYMENT_MODULE_ID);

  if (moduleAddress === ethers.ZeroAddress) {
    console.log("ProxyDeploymentModule is not registered on this deployment");
    process.exit(1);
  }

  const module = await ethers.getContractAt(
    "ProxyDeploymentModule",
    moduleAddress
  );
  console.log(`ProxyDeploymentModule: ${moduleAddress}`);

  const currentFee = await module.getProxyDeploymentFee();
  const paymentToken = await module.paymentToken();
  console.log(`Current fee:   ${currentFee.toString()} (raw units)`);
  console.log(`Payment token: ${paymentToken}\n`);

  if (currentFee === 0n) {
    console.log("Fee is already zero — nothing to do.");
    return;
  }

  // setProxyDeploymentFee is onlyOwner. On a governed deployment the owner is
  // the timelock, so this will revert for anyone else — deliberately. Say so
  // clearly rather than letting it fail with a bare revert.
  const owner = await module.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log(`Module owner is ${owner}, not the signer.`);
    console.log(
      "Queue setProxyDeploymentFee(0) through governance instead of running this directly."
    );
    process.exit(1);
  }

  const tx = await module.setProxyDeploymentFee(0);
  console.log(`Sent: ${tx.hash}`);
  await tx.wait();

  // A public RPC can answer from a node that has not caught up, reporting the
  // old fee for a transaction that landed fine. Poll before crying failure.
  let newFee = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    newFee = await module.getProxyDeploymentFee();
    if (newFee === 0n) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  if (newFee !== 0n) {
    console.log(`Fee is still ${newFee.toString()} — the change did not stick.`);
    process.exit(1);
  }

  console.log("Deposit-address fee cleared. Generating an address is now free.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
