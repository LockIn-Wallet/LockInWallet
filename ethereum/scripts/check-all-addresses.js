const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Checking all deployed addresses...");

  try {
    const [deployer] = await ethers.getSigners();
    const provider = deployer.provider;

    console.log(`Deployer: ${deployer.address}`);

    // Get current nonce
    const currentNonce = await provider.getTransactionCount(deployer.address);
    console.log(`Current nonce: ${currentNonce}`);

    // Check all addresses from nonce 0 to current
    console.log(`\n🎯 Checking all contracts from nonce 0 to ${currentNonce - 1}:`);

    for (let nonce = 0; nonce < currentNonce; nonce++) {
      const address = ethers.getCreateAddress({
        from: deployer.address,
        nonce: nonce
      });

      try {
        const code = await provider.getCode(address);
        const hasCode = code !== "0x";

        let contractType = "Unknown";
        if (nonce <= 4) {
          contractType = ["SavingsCore (OLD)", "TimePeriodLimitsModule (OLD)", "ProposalSystemModule (OLD)", "BypassSystemModule (OLD)", "ApprovalSystemModule (OLD)"][nonce];
        } else if (nonce === 5) {
          contractType = "SavingsCore (WORKING)";
        } else if (nonce === 6) {
          contractType = "TimePeriodLimitsModule (WORKING)";
        } else if (nonce === 7) {
          contractType = "? SavingsCore (DUPLICATE?)";
        }

        console.log(`Nonce ${nonce}: ${address} - ${hasCode ? '✅ HAS CODE' : '❌ NO CODE'} (${contractType})`);
      } catch (error) {
        console.log(`Nonce ${nonce}: ${address} - ❓ ERROR: ${error.message}`);
      }
    }

    // Check balance
    const balance = await provider.getBalance(deployer.address);
    console.log(`\n💰 Current balance: ${ethers.formatEther(balance)} POL`);

    console.log(`\n🎯 RECOMMENDED WORKING CONTRACTS:`);
    console.log(`SavingsCore: 0x09AC25686Fb2aB3ce5cF6b92F84C90E9BBdA8e93 (nonce 5)`);
    console.log(`TimePeriodLimitsModule: 0x0E8DB1A3dAed303F73Ec62b2bcd5EE37726b08c5 (nonce 6)`);
    console.log(`\nSTILL NEEDED:`);
    console.log(`ProposalSystemModule, BypassSystemModule, ApprovalSystemModule`);

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });