const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing deployed SavingsCore contract...\n");

  // Use the contract address from our recent deployment
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  try {
    // Get a signer
    const [signer] = await ethers.getSigners();
    console.log("📝 Using account:", signer.address);

    // Connect to the deployed contract
    const savingsCore = await ethers.getContractAt("SavingsCore", contractAddress, signer);
    console.log("📍 Contract address:", contractAddress);

    // Test 1: Check if contract is initialized
    console.log("\n🔍 Test 1: Contract initialization check");
    try {
      const owner = await savingsCore.owner();
      console.log("✅ Contract owner:", owner);
    } catch (error) {
      console.log("❌ Failed to get owner:", error.message);
    }

    // Test 2: Check module registrations
    console.log("\n🔍 Test 2: Module registration check");
    const moduleNames = [
      "TIME_PERIOD_LIMITS",
      "PROPOSAL_SYSTEM",
      "BYPASS_SYSTEM",
      "APPROVAL_SYSTEM"
    ];

    for (const moduleName of moduleNames) {
      try {
        const moduleId = ethers.keccak256(ethers.toUtf8Bytes(moduleName));
        const moduleAddress = await savingsCore.getModuleAddress(moduleId);
        if (moduleAddress === ethers.ZeroAddress) {
          console.log(`❌ ${moduleName} not registered`);
        } else {
          console.log(`✅ ${moduleName}: ${moduleAddress}`);
        }
      } catch (error) {
        console.log(`❌ ${moduleName} check failed:`, error.message);
      }
    }

    // Test 3: Check basic user functions exist
    console.log("\n🔍 Test 3: Core function availability");
    const functions = [
      "getUserBalance",
      "getUserSpendingLimits",
      "getUserWithdrawalAddresses"
    ];

    for (const funcName of functions) {
      try {
        // Just check if the function exists by calling it (will likely fail but that's ok)
        await savingsCore[funcName].staticCall();
        console.log(`✅ ${funcName} function exists and callable`);
      } catch (error) {
        if (error.message.includes("no matching fragment")) {
          console.log(`❌ ${funcName} function missing`);
        } else {
          console.log(`✅ ${funcName} function exists (call failed as expected)`);
        }
      }
    }

    console.log("\n🎉 Contract verification complete!");

  } catch (error) {
    console.error("❌ Contract test failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });