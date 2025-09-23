const { ethers } = require("hardhat");

async function main() {
  const usdtAddress = "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9"; // Replace with the deployed MockUSDT address
  const recipient = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Replace with the account address
//   const amount = ethers.utils.parseUnits("1000", 6); // 1000 USDT (6 decimals)
  const amount = 1000; // 1000 USDT (6 decimals)

  const usdt = await ethers.getContractAt("MockUSDT", usdtAddress);
  const tx = await usdt.transfer(recipient, amount);
  await tx.wait();

  console.log(`Transferred 1000 USDT to ${recipient}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
