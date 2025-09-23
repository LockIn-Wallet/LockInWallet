import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contract with account:", deployer.address);

  const Savings = await ethers.getContractFactory("Savings");
  const savings = await upgrades.deployProxy(Savings, [], {
    initializer: "initialize",
  });

  await savings!.deploymentTransaction()!.wait();

  const receipt = await savings!.deploymentTransaction()!.wait();
  console.log("Savings contract deployed to:", receipt!.contractAddress);
  console.log("Savings contract deployed to:", await savings.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
