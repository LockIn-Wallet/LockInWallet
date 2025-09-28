const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function testFrontendABI() {
  console.log("🧪 Testing frontend ABI compatibility...\n");

  try {
    // Read the frontend ABI
    const frontendABIPath = path.join(__dirname, "../frontend/src/SavingsABI.json");
    const frontendABI = JSON.parse(fs.readFileSync(frontendABIPath, "utf8"));

    // Read the frontend App.js to get the contract address
    const frontendPath = path.join(__dirname, "../frontend/src/App.js");
    const frontendContent = fs.readFileSync(frontendPath, "utf8");
    const savingsMatch = frontendContent.match(/savingsContract: "([^"]+)"/);

    if (!savingsMatch) {
      throw new Error("Could not find contract address in frontend");
    }

    const contractAddress = savingsMatch[1];
    console.log(`📋 Contract Address: ${contractAddress}`);
    console.log(`📋 ABI Functions Count: ${frontendABI.length}`);

    // Check for withdrawal functions in ABI
    const withdrawalFunctions = frontendABI.filter(item =>
      item.type === "function" &&
      (item.name === "getUserWithdrawalAddresses" || item.name === "getUserPendingWithdrawalRequests")
    );

    console.log(`📋 Withdrawal Functions in ABI: ${withdrawalFunctions.length}/2`);
    withdrawalFunctions.forEach(func => {
      console.log(`   ✅ ${func.name} - Found`);
    });

    // Test contract instantiation with frontend ABI
    const [signer] = await ethers.getSigners();
    const contract = new ethers.Contract(contractAddress, frontendABI, signer);

    // Test calling the functions that are failing in frontend
    console.log("\n🔍 Testing function calls...");

    try {
      console.log("Testing getUserWithdrawalAddresses...");
      const result1 = await contract.getUserWithdrawalAddresses();
      console.log("✅ getUserWithdrawalAddresses works:", result1);
    } catch (error) {
      console.log("❌ getUserWithdrawalAddresses failed:", error.message);
    }

    try {
      console.log("Testing getUserPendingWithdrawalRequests...");
      const result2 = await contract.getUserPendingWithdrawalRequests();
      console.log("✅ getUserPendingWithdrawalRequests works:", result2);
    } catch (error) {
      console.log("❌ getUserPendingWithdrawalRequests failed:", error.message);
    }

    // Check if the functions exist on the contract interface
    console.log("\n🔍 Checking contract interface...");
    console.log("getUserWithdrawalAddresses exists:", typeof contract.getUserWithdrawalAddresses);
    console.log("getUserPendingWithdrawalRequests exists:", typeof contract.getUserPendingWithdrawalRequests);

    // Print function signatures for debugging
    console.log("\n📋 Function signatures in ABI:");
    withdrawalFunctions.forEach(func => {
      const inputs = func.inputs ? func.inputs.map(i => i.type).join(',') : '';
      console.log(`   ${func.name}(${inputs})`);
    });

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testFrontendABI();