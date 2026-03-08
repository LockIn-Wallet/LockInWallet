const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * Gas Cost Estimation Script for Optimism Deployment
 *
 * This script estimates the gas costs for deploying the savings wallet
 * contracts on Optimism mainnet without actually deploying them.
 */

async function main() {
  console.log("🔍 Estimating deployment costs for Optimism mainnet...\n");

  // Connect to Optimism network
  const network = await hre.ethers.provider.getNetwork();
  console.log(`📡 Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

  if (network.chainId !== 137n) {
    console.log("⚠️  Warning: Not connected to Optimism mainnet (Chain ID should be 137)");
    console.log("   Make sure to run with --network optimism");
    return;
  }

  // Get current gas price
  const feeData = await hre.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits("30", "gwei"); // fallback to 30 gwei
  const maxFeePerGas = feeData.maxFeePerGas;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

  console.log(`⛽ Current Gas Prices on Optimism:`);
  console.log(`   Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  if (maxFeePerGas) {
    console.log(`   Max Fee Per Gas: ${ethers.formatUnits(maxFeePerGas, "gwei")} gwei`);
  }
  if (maxPriorityFeePerGas) {
    console.log(`   Max Priority Fee: ${ethers.formatUnits(maxPriorityFeePerGas, "gwei")} gwei`);
  }

  console.log(`\n💰 Estimating deployment costs...\n`);

  const estimations = [];

  try {
    // Create a dummy account for estimation purposes
    const dummyWallet = ethers.Wallet.createRandom();

    // 1. SavingsCore (UUPS Proxy) - using OpenZeppelin proxy pattern
    console.log("1️⃣  Estimating SavingsCore deployment...");
    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");

    // Estimate implementation deployment
    const implementationBytecode = SavingsCore.bytecode;
    const implementationGas = await hre.ethers.provider.estimateGas({
      data: implementationBytecode
    });

    // Estimate proxy deployment (approximately)
    const proxyGas = ethers.parseUnits("500000", "wei"); // Typical proxy deployment

    const savingsCoreGas = implementationGas + proxyGas;
    const savingsCoreCost = gasPrice * savingsCoreGas;
    estimations.push({
      name: "SavingsCore (Implementation + Proxy)",
      gas: savingsCoreGas,
      cost: savingsCoreCost
    });

    // 2. TimePeriodLimitsModule
    console.log("2️⃣  Estimating TimePeriodLimitsModule deployment...");
    const TimePeriodLimitsModule = await hre.ethers.getContractFactory("TimePeriodLimitsModule");
    const dummyAddress = "0x0000000000000000000000000000000000000001";
    const timeModuleBytecode = TimePeriodLimitsModule.getDeployTransaction(dummyAddress).data;
    const timeModuleGas = await hre.ethers.provider.estimateGas({
      data: timeModuleBytecode
    });
    const timeModuleCost = gasPrice * timeModuleGas;
    estimations.push({
      name: "TimePeriodLimitsModule",
      gas: timeModuleGas,
      cost: timeModuleCost
    });

    // 3. ProposalSystemModule
    console.log("3️⃣  Estimating ProposalSystemModule deployment...");
    const ProposalSystemModule = await hre.ethers.getContractFactory("ProposalSystemModule");
    const proposalModuleBytecode = ProposalSystemModule.getDeployTransaction(dummyAddress).data;
    const proposalModuleGas = await hre.ethers.provider.estimateGas({
      data: proposalModuleBytecode
    });
    const proposalModuleCost = gasPrice * proposalModuleGas;
    estimations.push({
      name: "ProposalSystemModule",
      gas: proposalModuleGas,
      cost: proposalModuleCost
    });

    // 4. BypassSystemModule
    console.log("4️⃣  Estimating BypassSystemModule deployment...");
    const BypassSystemModule = await hre.ethers.getContractFactory("BypassSystemModule");
    const bypassModuleBytecode = BypassSystemModule.getDeployTransaction(dummyAddress).data;
    const bypassModuleGas = await hre.ethers.provider.estimateGas({
      data: bypassModuleBytecode
    });
    const bypassModuleCost = gasPrice * bypassModuleGas;
    estimations.push({
      name: "BypassSystemModule",
      gas: bypassModuleGas,
      cost: bypassModuleCost
    });

    // 5. ApprovalSystemModule
    console.log("5️⃣  Estimating ApprovalSystemModule deployment...");
    const ApprovalSystemModule = await hre.ethers.getContractFactory("ApprovalSystemModule");
    const approvalModuleBytecode = ApprovalSystemModule.getDeployTransaction(dummyAddress).data;
    const approvalModuleGas = await hre.ethers.provider.estimateGas({
      data: approvalModuleBytecode
    });
    const approvalModuleCost = gasPrice * approvalModuleGas;
    estimations.push({
      name: "ApprovalSystemModule",
      gas: approvalModuleGas,
      cost: approvalModuleCost
    });

    // 6. Module Registration (5 transactions)
    console.log("6️⃣  Estimating module registration transactions...");
    const registrationGasPerTx = ethers.parseUnits("100000", "wei"); // Approximate gas per registration
    const totalRegistrationGas = registrationGasPerTx * 4n; // 4 modules to register
    const registrationCost = gasPrice * totalRegistrationGas;
    estimations.push({
      name: "Module Registration (4 transactions)",
      gas: totalRegistrationGas,
      cost: registrationCost
    });

    // 7. MockUSDT (optional for testing)
    console.log("7️⃣  Estimating MockUSDT deployment...");
    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const mockUSDTBytecode = MockUSDT.getDeployTransaction().data;
    const mockUSDTGas = await hre.ethers.provider.estimateGas({
      data: mockUSDTBytecode
    });
    const mockUSDTCost = gasPrice * mockUSDTGas;
    estimations.push({
      name: "MockUSDT (optional test token)",
      gas: mockUSDTGas,
      cost: mockUSDTCost
    });

  } catch (error) {
    console.error("❌ Error estimating gas costs:", error.message);
    process.exit(1);
  }

  // Calculate totals
  const totalGas = estimations.reduce((sum, est) => sum + est.gas, 0n);
  const totalCost = estimations.reduce((sum, est) => sum + est.cost, 0n);

  // Display results
  console.log("\n📊 Deployment Cost Summary:");
  console.log("=".repeat(60));
  estimations.forEach((est, index) => {
    console.log(`${index + 1}. ${est.name}:`);
    console.log(`   Gas: ${est.gas.toLocaleString()} units`);
    console.log(`   Cost: ${ethers.formatEther(est.cost)} MATIC`);
    console.log();
  });

  console.log("🔥 TOTAL DEPLOYMENT COSTS:");
  console.log(`   Total Gas: ${totalGas.toLocaleString()} units`);
  console.log(`   Total Cost: ${ethers.formatEther(totalCost)} MATIC`);

  // Estimate USD cost (approximate)
  console.log(`\n💵 Approximate USD Cost (assuming MATIC = $0.40):`);
  const maticAmount = parseFloat(ethers.formatEther(totalCost));
  const approxUSD = maticAmount * 0.40;
  console.log(`   ~$${approxUSD.toFixed(2)} USD`);

  console.log("\n📝 Notes:");
  console.log("   - These are estimates and actual costs may vary");
  console.log("   - Gas prices fluctuate based on network congestion");
  console.log("   - Includes proxy deployment and module registration");
  console.log("   - MATIC price used for USD estimate is approximate");

  console.log("\n🚀 To deploy for real:");
  console.log("   1. Copy .env.example to .env");
  console.log("   2. Add your PRIVATE_KEY to .env file");
  console.log("   3. Fund your account with MATIC for gas");
  console.log("   4. Run: npm run deploy-optimism");

  console.log(`\n💡 Recommended MATIC to have in wallet: ${(maticAmount * 1.5).toFixed(4)} MATIC`);
  console.log("   (1.5x the estimate to account for gas price fluctuations)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });