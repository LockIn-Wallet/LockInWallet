const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * Gas Cost Estimation Script for Optimism Deployment
 *
 * Estimates deployment costs for the full upgradeable modular system on Optimism.
 * Each module is deployed as a UUPS proxy (implementation + ERC1967 proxy).
 */

const OPTIMISM_CHAIN_ID = 10n;
const ETH_PRICE_USD = 2500; // Update with current ETH price

async function main() {
  console.log("Estimating deployment costs for Optimism mainnet...\n");

  const network = await hre.ethers.provider.getNetwork();
  console.log(`Connected to: ${network.name} (Chain ID: ${network.chainId})`);

  if (network.chainId !== OPTIMISM_CHAIN_ID) {
    console.log(`Warning: Not connected to Optimism mainnet (expected chain ID ${OPTIMISM_CHAIN_ID})`);
    console.log("   Run with: --network optimism");
    return;
  }

  const feeData = await hre.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits("0.01", "gwei");

  console.log(`Gas Prices:`);
  console.log(`   Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  if (feeData.maxFeePerGas) {
    console.log(`   Max Fee Per Gas: ${ethers.formatUnits(feeData.maxFeePerGas, "gwei")} gwei`);
  }

  console.log(`\nEstimating costs...\n`);

  const estimations = [];
  // Proxy deployment overhead (ERC1967 proxy contract)
  const PROXY_GAS_OVERHEAD = 300_000n;
  // initialize() call gas overhead
  const INIT_GAS_OVERHEAD = 100_000n;

  try {
    // 1. SavingsCore (implementation + proxy + initialize)
    console.log("1. SavingsCore (UUPS Proxy)...");
    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsImplGas = await hre.ethers.provider.estimateGas({ data: SavingsCore.bytecode });
    const savingsTotalGas = savingsImplGas + PROXY_GAS_OVERHEAD + INIT_GAS_OVERHEAD;
    estimations.push({ name: "SavingsCore (impl + proxy + init)", gas: savingsTotalGas });

    // 2-6. Each module: implementation + proxy + initialize
    const modules = [
      "TimePeriodLimitsModule",
      "ProposalSystemModule",
      "BypassSystemModule",
      "ApprovalSystemModule",
      "ProxyDeploymentModule",
    ];

    for (let i = 0; i < modules.length; i++) {
      const name = modules[i];
      console.log(`${i + 2}. ${name} (UUPS Proxy)...`);
      const Factory = await hre.ethers.getContractFactory(name);
      const implGas = await hre.ethers.provider.estimateGas({ data: Factory.bytecode });
      const totalGas = implGas + PROXY_GAS_OVERHEAD + INIT_GAS_OVERHEAD;
      estimations.push({ name: `${name} (impl + proxy + init)`, gas: totalGas });
    }

    // 7. Module registration (5 registerModule txs + 1 setupModuleCrossReferences)
    console.log("7. Module registration (6 transactions)...");
    const registrationGas = 100_000n * 6n;
    estimations.push({ name: "Module registration (6 txs)", gas: registrationGas });

    // 8. MockUSDT (optional)
    console.log("8. MockUSDT (optional)...");
    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const mockUSDTGas = await hre.ethers.provider.estimateGas({ data: MockUSDT.bytecode });
    estimations.push({ name: "MockUSDT (optional)", gas: mockUSDTGas });

    // 9. Fee configuration (3 txs)
    console.log("9. Fee configuration...");
    estimations.push({ name: "Fee config (3 txs)", gas: 150_000n });

  } catch (error) {
    console.error("Error estimating gas:", error.message);
    process.exit(1);
  }

  // Totals
  const totalGas = estimations.reduce((sum, e) => sum + e.gas, 0n);
  const totalCost = gasPrice * totalGas;

  // Without MockUSDT (production)
  const prodEstimations = estimations.filter(e => !e.name.includes("MockUSDT"));
  const prodGas = prodEstimations.reduce((sum, e) => sum + e.gas, 0n);
  const prodCost = gasPrice * prodGas;

  console.log("\n" + "=".repeat(65));
  console.log("Deployment Cost Breakdown:");
  console.log("=".repeat(65));

  estimations.forEach((est, i) => {
    const cost = gasPrice * est.gas;
    console.log(`${(i + 1).toString().padStart(2)}. ${est.name.padEnd(42)} ${est.gas.toLocaleString().padStart(12)} gas  ${ethers.formatEther(cost).padStart(12)} ETH`);
  });

  console.log("-".repeat(65));
  console.log(`    TOTAL (with MockUSDT):${" ".repeat(17)} ${totalGas.toLocaleString().padStart(12)} gas  ${ethers.formatEther(totalCost).padStart(12)} ETH`);
  console.log(`    TOTAL (production):${" ".repeat(20)} ${prodGas.toLocaleString().padStart(12)} gas  ${ethers.formatEther(prodCost).padStart(12)} ETH`);
  console.log("=".repeat(65));

  const prodEthAmount = parseFloat(ethers.formatEther(prodCost));
  const prodUSD = prodEthAmount * ETH_PRICE_USD;

  console.log(`\nUSD Estimate (ETH = $${ETH_PRICE_USD}):`);
  console.log(`   Production deployment: ~$${prodUSD.toFixed(2)} USD`);
  console.log(`   Recommended ETH in wallet: ${(prodEthAmount * 2).toFixed(6)} ETH (2x buffer)`);

  console.log(`\nNotes:`);
  console.log(`   - Optimism L2 gas is much cheaper than L1`);
  console.log(`   - L1 data posting fee is additional (usually small on Optimism)`);
  console.log(`   - Gas prices fluctuate; estimates may vary`);
  console.log(`   - Each module is a UUPS proxy (impl + proxy deploy + initialize)`);

  console.log(`\nTo deploy:`);
  console.log(`   1. Set PRIVATE_KEY and OPTIMISM_RPC_URL in .env`);
  console.log(`   2. Fund wallet with ETH on Optimism`);
  console.log(`   3. Run: PRODUCTION=true npm run deploy-optimism`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
