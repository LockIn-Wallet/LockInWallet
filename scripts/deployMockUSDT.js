const { ethers } = require("hardhat");

async function main() {
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy();
  await mockUSDT.deployed();

  console.log(`Mock USDT deployed to: ${mockUSDT.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
