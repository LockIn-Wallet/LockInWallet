const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Using efficient method to find deployed contracts...");

  try {
    const [deployer] = await ethers.getSigners();
    const provider = deployer.provider;

    console.log(`Deployer: ${deployer.address}`);

    // Get current nonce
    const currentNonce = await provider.getTransactionCount(deployer.address);
    console.log(`Current nonce: ${currentNonce}`);

    if (currentNonce >= 5) {
      console.log(`\n✅ Found ${currentNonce} transactions from this address`);
      console.log("Since we know 5 contracts were deployed, let's calculate the addresses...");

      // Method 1: Try to get transaction history efficiently
      // We know the nonces were 0, 1, 2, 3, 4 for the 5 deployments
      const expectedNonces = [0, 1, 2, 3, 4];
      const contractNames = [
        "SavingsCore (Main Contract)",
        "TimePeriodLimitsModule",
        "ProposalSystemModule",
        "BypassSystemModule",
        "ApprovalSystemModule"
      ];

      console.log("\n🎯 Since deployment transactions succeeded, here are the most likely addresses:");
      console.log("   (Contract addresses are deterministic based on deployer + nonce)\n");

      for (let i = 0; i < expectedNonces.length; i++) {
        const nonce = expectedNonces[i];

        // Calculate deterministic contract address
        const contractAddress = ethers.getCreateAddress({
          from: deployer.address,
          nonce: nonce
        });

        console.log(`${i + 1}. ${contractNames[i]}`);
        console.log(`   Address: ${contractAddress}`);
        console.log(`   Nonce: ${nonce}`);

        // Test if there's code at this address
        try {
          const code = await provider.getCode(contractAddress);
          const hasCode = code !== "0x";
          console.log(`   Status: ${hasCode ? '✅ CONTRACT FOUND' : '❌ No code'}`);
        } catch (e) {
          console.log(`   Status: ❓ Could not verify`);
        }
        console.log();
      }

      // The first address should be our SavingsCore
      const savingsCoreAddress = ethers.getCreateAddress({
        from: deployer.address,
        nonce: 0
      });

      console.log("🎯 MAIN CONTRACT (SavingsCore):");
      console.log(`   ${savingsCoreAddress}`);

      console.log("\n📝 I'll now update the frontend with this address...");

      return savingsCoreAddress;

    } else {
      console.log(`❌ Expected 5 transactions but found ${currentNonce}`);
      console.log("Deployment may not have completed successfully");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then((address) => {
    if (address) {
      console.log(`\n🚀 Ready to update frontend with SavingsCore at: ${address}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });