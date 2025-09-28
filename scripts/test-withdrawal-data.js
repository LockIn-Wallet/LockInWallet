const { ethers } = require("hardhat");

async function testWithdrawalData() {
  console.log("🧪 Testing withdrawal address data persistence...\n");

  const contractAddress = "0xF32D39ff9f6Aa7a7A64d7a4F00a54826Ef791a55";
  const [signer] = await ethers.getSigners();
  const userAddress = signer.address;

  // Get the deployed contract
  const SavingsCore = await ethers.getContractAt("SavingsCore", contractAddress, signer);

  try {
    console.log(`👤 Testing for user: ${userAddress}\n`);

    // Test 1: Check existing withdrawal addresses
    console.log("📋 1. Checking existing withdrawal addresses...");
    const existingAddresses = await SavingsCore.getUserWithdrawalAddresses();
    console.log(`   Titles: [${existingAddresses[0].join(', ')}]`);
    console.log(`   Destinations: [${existingAddresses[1].join(', ')}]`);
    console.log(`   Timestamps: [${existingAddresses[2].join(', ')}]`);
    console.log(`   Count: ${existingAddresses[0].length}`);

    // Test 2: Check pending withdrawal requests
    console.log("\n📋 2. Checking pending withdrawal requests...");
    const pendingRequests = await SavingsCore.getUserPendingWithdrawalRequests();
    console.log(`   Request IDs: [${pendingRequests[0].join(', ')}]`);
    console.log(`   Titles: [${pendingRequests[1].join(', ')}]`);
    console.log(`   Destinations: [${pendingRequests[2].join(', ')}]`);
    console.log(`   Execute After: [${pendingRequests[3].join(', ')}]`);
    console.log(`   Count: ${pendingRequests[0].length}`);

    // Test 3: Create a test withdrawal address request if none exist
    if (pendingRequests[0].length === 0 && existingAddresses[0].length === 0) {
      console.log("\n🔧 3. Creating test withdrawal address request...");
      try {
        const testDestination = "0x1234567890123456789012345678901234567890";
        const testTitle = "Test Address";

        const tx = await SavingsCore.requestWithdrawalAddress(testTitle, testDestination);
        const receipt = await tx.wait();

        console.log(`   ✅ Transaction successful: ${receipt.hash}`);

        // Check again after creation
        console.log("\n📋 4. Checking after creation...");
        const newPendingRequests = await SavingsCore.getUserPendingWithdrawalRequests();
        console.log(`   New pending count: ${newPendingRequests[0].length}`);
        if (newPendingRequests[0].length > 0) {
          console.log(`   Latest request title: "${newPendingRequests[1][0]}"`);
          console.log(`   Latest request destination: ${newPendingRequests[2][0]}`);
        }

      } catch (error) {
        console.log(`   ❌ Failed to create test request: ${error.message}`);
      }
    }

    // Test 4: Check module registration
    console.log("\n🔍 5. Checking ApprovalSystemModule registration...");
    const approvalModuleId = ethers.keccak256(ethers.toUtf8Bytes("APPROVAL_SYSTEM"));
    const approvalModuleAddress = await SavingsCore.getModule(approvalModuleId);
    console.log(`   Module ID: ${approvalModuleId}`);
    console.log(`   Module Address: ${approvalModuleAddress}`);
    console.log(`   Is registered: ${approvalModuleAddress !== ethers.ZeroAddress}`);

    if (approvalModuleAddress === ethers.ZeroAddress) {
      console.log("   ❌ ISSUE: ApprovalSystemModule not registered!");
    }

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testWithdrawalData();