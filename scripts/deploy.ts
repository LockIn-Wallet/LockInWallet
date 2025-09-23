import { ethers } from "hardhat";
import * as upgrades from "@openzeppelin/hardhat-upgrades";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contract with account:", deployer.address);

  const Savings = await ethers.getContractFactory("Savings");
  const savings = await makeDeployProxy(Savings, [], {
    initializer: "initialize",
  });

  await savings.deployed();

  console.log("Savings contract deployed to:", savings.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
