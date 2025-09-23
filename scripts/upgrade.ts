import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Upgrading contract with account:", deployer.address);

  const proxyAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3"; // Replace with your proxy address
  const Savings = await ethers.getContractFactory("Savings");

  console.log("Upgrading Savings contract...");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, Savings);

  console.log(
    "Savings contract upgraded. New implementation address:",
    await upgrades.erc1967.getImplementationAddress(upgraded.address)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
