const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing withdrawal address functions...\n");

  const contractAddress = "0xF32D39ff9f6Aa7a7A64d7a4F00a54826Ef791a55"; // New optimized deployment
  const [signer] = await ethers.getSigners();

  // Get the deployed contract
  const SavingsCore = await ethers.getContractAt("SavingsCore", contractAddress, signer);

  try {
    console.log("Testing getUserWithdrawalAddresses...");
    const result = await SavingsCore.getUserWithdrawalAddresses();
    console.log("✅ getUserWithdrawalAddresses works:", result);
  } catch (error) {
    console.log("❌ getUserWithdrawalAddresses failed:", error.message);
  }

  try {
    console.log("\nTesting getUserPendingWithdrawalRequests...");
    const result = await SavingsCore.getUserPendingWithdrawalRequests();
    console.log("✅ getUserPendingWithdrawalRequests works:", result);
  } catch (error) {
    console.log("❌ getUserPendingWithdrawalRequests failed:", error.message);
  }

  try {
    console.log("\nTesting requestWithdrawalAddress...");
    // This will fail because of validation, but it should show the function exists
    await SavingsCore.requestWithdrawalAddress.staticCall("test", "0x0000000000000000000000000000000000000001");
    console.log("✅ requestWithdrawalAddress function exists");
  } catch (error) {
    if (error.message.includes("no matching fragment")) {
      console.log("❌ requestWithdrawalAddress function missing:", error.message);
    } else {
      console.log("✅ requestWithdrawalAddress function exists (validation error expected):", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });