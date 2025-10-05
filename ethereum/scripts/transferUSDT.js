const { ethers } = require("hardhat");

async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage: node scripts/transferUSDT.js <recipient_address> <amount>");
    console.log("Example: node scripts/transferUSDT.js 0x123... 10000");
    process.exit(1);
  }

  const recipient = args[0];
  const amount = args[1];

  // Hardcoded USDT contract address (update this after deployment)
  const USDT_ADDRESS = "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9";

  // Connect to the deployed MockUSDT contract
  const mockUSDT = await ethers.getContractAt("MockUSDT", USDT_ADDRESS);

  // Get the deployer (account[0]) as the sender
  const [deployer] = await ethers.getSigners();

  console.log(`Transferring ${amount} USDT from ${deployer.address} to ${recipient}...`);

  // Convert amount to proper decimals (6 for USDT)
  const amountWei = ethers.parseUnits(amount, 6);

  // Check if deployer has enough balance
  const deployerBalance = await mockUSDT.balanceOf(deployer.address);
  console.log(`Deployer balance: ${ethers.formatUnits(deployerBalance, 6)} USDT`);

  if (deployerBalance < amountWei) {
    console.error("Error: Insufficient balance for transfer");
    process.exit(1);
  }

  // Perform the transfer
  const tx = await mockUSDT.transfer(recipient, amountWei);
  await tx.wait();

  console.log("✅ Transfer successful!");
  console.log(`Transaction hash: ${tx.hash}`);

  // Check final balances
  const recipientBalance = await mockUSDT.balanceOf(recipient);
  const newDeployerBalance = await mockUSDT.balanceOf(deployer.address);

  console.log(`\nFinal balances:`);
  console.log(`${recipient}: ${ethers.formatUnits(recipientBalance, 6)} USDT`);
  console.log(`${deployer.address}: ${ethers.formatUnits(newDeployerBalance, 6)} USDT`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
