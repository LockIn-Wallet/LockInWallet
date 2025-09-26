import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Upgrading contract with account:", deployer.address);

  const proxyAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // Current Savings proxy address
  const Savings = await ethers.getContractFactory("Savings");

  console.log("Upgrading Savings contract...");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, Savings);

  const upgradedAddress = await upgraded.getAddress();
  console.log("Savings contract upgraded successfully!");
  console.log("Proxy address:", upgradedAddress);

  try {
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(upgradedAddress);
    console.log("New implementation address:", implementationAddress);
  } catch (error) {
    console.log("Could not fetch implementation address, but upgrade succeeded");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
