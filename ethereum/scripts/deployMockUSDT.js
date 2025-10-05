const { ethers } = require("hardhat");

async function main() {
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy();
  await mockUSDT.waitForDeployment();

  const address = await mockUSDT.getAddress();
  console.log(`Mock USDT deployed to: ${address}`);

  // Get the deployer's address and balance
  const [deployer] = await ethers.getSigners();
  const balance = await mockUSDT.balanceOf(deployer.address);
  console.log(`Deployer (${deployer.address}) has ${ethers.formatUnits(balance, 6)} USDT`);

  console.log(`\nTo transfer USDT to your testing account, run:`);
  console.log(`node scripts/transferUSDT.js YOUR_TESTING_ADDRESS AMOUNT`);
  console.log(`Example: node scripts/transferUSDT.js 0x123... 10000`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
