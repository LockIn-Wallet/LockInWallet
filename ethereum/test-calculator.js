// Quick test of the setup cost calculator (non-interactive version)
const { SetupCostCalculator, SETUP_STRATEGIES } = require("./scripts/setup-cost-calculator.js");

async function runQuickTest() {
  console.log("🧮 SETUP COST CALCULATOR DEMO");
  console.log("=" .repeat(40));

  const calculator = new SetupCostCalculator();

  // Initialize without interactive prompts
  await calculator.gasEstimator.initialize();

  const { baseGasPrice } = await calculator.gasEstimator.getCurrentGasPrices();
  calculator.currentGasPrice = baseGasPrice;
  calculator.ethPrice = await calculator.gasEstimator.getETHPrice();

  // Generate gas results
  await calculator.generateGasResults();

  console.log(`⛽ Current gas: ${(parseFloat(calculator.gasResults.gasPrice) || 1.5).toFixed(1)} gwei`);
  console.log(`💵 ETH price: $${calculator.ethPrice}`);

  // Show strategy comparison
  console.log("\n📊 SETUP STRATEGY COSTS:");
  console.log("-".repeat(40));

  Object.entries(SETUP_STRATEGIES).forEach(([key, strategy]) => {
    const { totalCost } = calculator.calculateStrategyCost(strategy, 'LOW');
    const cost = calculator.formatCost(totalCost.toString(), 'LOW');

    console.log(`\n${strategy.name}:`);
    console.log(`  Cost: ${cost.eth} ETH ($${cost.usd})`);
    console.log(`  ${strategy.description}`);

    if (strategy.steps) {
      strategy.steps.forEach(step => {
        console.log(`    • ${step.description}`);
      });
    }
  });

  // Show request/execute pairs
  console.log("\n📋 REQUEST + EXECUTE COSTS:");
  console.log("-".repeat(40));

  const pairs = [
    { request: "requestLimitBypass", execute: "executeBypassWithdrawal", name: "Limit Bypass" },
    { request: "proposeLimitRemoval", execute: "executeLimitProposal", name: "Limit Change" },
    { request: "requestWithdrawalAddress", execute: "executeWithdrawalAddressRequest", name: "Withdrawal Address" }
  ];

  pairs.forEach(pair => {
    const requestOp = calculator.gasResults.operations[pair.request];
    const executeOp = calculator.gasResults.operations[pair.execute];

    if (requestOp && executeOp) {
      const requestCost = calculator.formatCost(requestOp.baseCost, 'LOW');
      const executeCost = calculator.formatCost(executeOp.baseCost, 'LOW');
      const totalCost = calculator.formatCost((BigInt(requestOp.baseCost) + BigInt(executeOp.baseCost)).toString(), 'LOW');

      console.log(`\n${pair.name}:`);
      console.log(`  Request: $${requestCost.usd}`);
      console.log(`  Execute: $${executeCost.usd}`);
      console.log(`  Total: $${totalCost.usd}`);
    }
  });

  console.log("\n✅ Demo complete! Run 'node scripts/setup-cost-calculator.js' for interactive version.");
}

runQuickTest().catch(console.error);