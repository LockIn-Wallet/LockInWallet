const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Searching for deployed contracts...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  try {
    // Get current nonce to see how many transactions were sent
    const nonce = await deployer.provider.getTransactionCount(deployer.address);
    console.log(`Total transactions sent: ${nonce}`);

    console.log("\n🔍 Please check the following on Optimismscan:");
    console.log(`https://optimistic.etherscan.io/address/${deployer.address}`);

    console.log("\n📋 Expected deployment transactions:");
    console.log("1. SavingsCore proxy deployment");
    console.log("2. TimePeriodLimitsModule deployment");
    console.log("3. ProposalSystemModule deployment");
    console.log("4. BypassSystemModule deployment");
    console.log("5. ApprovalSystemModule deployment");

    if (nonce >= 5) {
      console.log("\n✅ You have 5+ transactions - likely means full deployment succeeded!");
      console.log("\n🎯 Next steps:");
      console.log("1. Check Optimismscan for contract addresses");
      console.log("2. Look for 'Contract Creation' transactions");
      console.log("3. Copy the SavingsCore proxy address (first contract)");
      console.log("4. I'll update the frontend config");
    } else {
      console.log(`\n⚠️ Only ${nonce} transactions - deployment may be incomplete`);
    }

    console.log(`\n🔗 Direct link to check:`);
    console.log(`https://optimistic.etherscan.io/address/${deployer.address}`);

  } catch (error) {
    console.error("Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });