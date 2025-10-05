const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Import gas estimation data
const { GasEstimator } = require("./gas-estimation.js");

// Setup strategies with detailed analysis
const SETUP_STRATEGIES = {
  MINIMAL: {
    name: "Minimal Setup",
    description: "Start with basic functionality, add features later",
    steps: [
      { name: "commitInitialSetup", description: "Enable timelock protection", required: true },
      { name: "addApprovalAddress", description: "Add trusted address", required: false },
    ],
    pros: [
      "Lowest upfront cost",
      "Can start using immediately",
      "Add features as needed"
    ],
    cons: [
      "No spending limits protection initially",
      "No deposit address for exchanges",
      "May need multiple transactions later"
    ]
  },
  BASIC: {
    name: "Basic Setup",
    description: "Essential security features without UserProxy",
    steps: [
      { name: "setCommonPeriodLimits", description: "Set spending limits", required: true },
      { name: "addApprovalAddress", description: "Add trusted address", required: true },
      { name: "commitInitialSetup", description: "Lock in configuration", required: true }
    ],
    pros: [
      "Good security with spending limits",
      "Moderate upfront cost",
      "Ready for regular use"
    ],
    cons: [
      "No permanent deposit address",
      "Cannot receive from exchanges easily",
      "UserProxy deployment needed later if required"
    ]
  },
  ENHANCED: {
    name: "Enhanced Setup",
    description: "Full featured setup with permanent deposit address",
    steps: [
      { name: "deployUserProxy", description: "Create permanent deposit address", required: true },
      { name: "setCommonPeriodLimits", description: "Set spending limits", required: true },
      { name: "addApprovalAddress", description: "Add trusted address", required: true },
      { name: "commitInitialSetup", description: "Lock in configuration", required: true }
    ],
    pros: [
      "Complete functionality from start",
      "Permanent address for exchanges",
      "Maximum security and convenience"
    ],
    cons: [
      "Highest upfront cost",
      "All-or-nothing approach"
    ]
  },
  PHASED: {
    name: "Phased Deployment",
    description: "Start basic, upgrade during low gas periods",
    phases: [
      {
        name: "Phase 1: Immediate",
        steps: [
          { name: "addApprovalAddress", description: "Add trusted address", required: true },
          { name: "commitInitialSetup", description: "Enable timelock", required: true }
        ]
      },
      {
        name: "Phase 2: When needed (low gas)",
        steps: [
          { name: "setCommonPeriodLimits", description: "Add spending limits", required: true }
        ]
      },
      {
        name: "Phase 3: If exchange deposits needed",
        steps: [
          { name: "deployUserProxy", description: "Create deposit address", required: true }
        ]
      }
    ],
    pros: [
      "Lowest initial cost",
      "Deploy expensive features during low gas",
      "Pay only for what you need when you need it"
    ],
    cons: [
      "Requires multiple interactions",
      "May miss low gas opportunities",
      "More complex planning required"
    ]
  }
};

class SetupCostCalculator {
  constructor() {
    this.gasEstimator = new GasEstimator();
    this.gasResults = null;
    this.currentGasPrice = null;
    this.ethPrice = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async initialize() {
    console.log("🧮 SAVINGS WALLET SETUP COST CALCULATOR");
    console.log("=" .repeat(50));

    await this.gasEstimator.initialize();

    // Get current gas prices and results
    const { baseGasPrice } = await this.gasEstimator.getCurrentGasPrices();
    this.currentGasPrice = baseGasPrice;
    this.ethPrice = await this.gasEstimator.getETHPrice();

    // Load gas estimation results
    try {
      const resultsFile = path.join(__dirname, "gas-estimation-results.json");
      if (fs.existsSync(resultsFile)) {
        this.gasResults = JSON.parse(fs.readFileSync(resultsFile, "utf8"));
      }
    } catch (error) {
      console.log("⚠️  Could not load previous gas results, generating new estimates...");
      await this.generateGasResults();
    }

    console.log(`⛽ Current gas price: ${ethers.formatUnits(this.currentGasPrice, "gwei")} gwei`);
    console.log(`💵 ETH price: $${this.ethPrice}`);
  }

  async generateGasResults() {
    const deploymentResults = await this.gasEstimator.estimateDeploymentCosts(this.currentGasPrice);
    const operationResults = await this.gasEstimator.estimateContractOperations(this.currentGasPrice);

    this.gasResults = {
      operations: this.gasEstimator.convertBigIntToString(operationResults),
      scenarios: {
        LOW: { multiplier: 1.0 },
        MEDIUM: { multiplier: 1.5 },
        HIGH: { multiplier: 2.5 },
        EXTREME: { multiplier: 5.0 }
      }
    };
  }

  formatCost(weiString, scenario = 'LOW') {
    const wei = BigInt(weiString);
    const multiplier = this.gasResults.scenarios[scenario]?.multiplier || 1.0;
    const adjustedWei = wei * BigInt(Math.floor(multiplier * 100)) / BigInt(100);

    const eth = ethers.formatEther(adjustedWei);
    const usd = parseFloat(eth) * this.ethPrice;

    return {
      eth: parseFloat(eth).toFixed(6),
      usd: usd.toFixed(2),
      wei: adjustedWei.toString()
    };
  }

  calculateStrategyCost(strategy, scenario = 'LOW') {
    let totalCost = BigInt(0);
    const breakdown = [];

    if (strategy.steps) {
      // Single-phase strategy
      for (const step of strategy.steps) {
        const operation = this.gasResults.operations[step.name];
        if (operation) {
          const cost = BigInt(operation.baseCost);
          const multiplier = this.gasResults.scenarios[scenario]?.multiplier || 1.0;
          const adjustedCost = cost * BigInt(Math.floor(multiplier * 100)) / BigInt(100);

          totalCost += adjustedCost;
          breakdown.push({
            name: step.name,
            description: step.description,
            required: step.required,
            cost: adjustedCost,
            gas: operation.gasEstimate
          });
        }
      }
    } else if (strategy.phases) {
      // Multi-phase strategy
      for (const phase of strategy.phases) {
        for (const step of phase.steps) {
          const operation = this.gasResults.operations[step.name];
          if (operation) {
            const cost = BigInt(operation.baseCost);
            const multiplier = this.gasResults.scenarios[scenario]?.multiplier || 1.0;
            const adjustedCost = cost * BigInt(Math.floor(multiplier * 100)) / BigInt(100);

            totalCost += adjustedCost;
            breakdown.push({
              name: step.name,
              description: step.description,
              required: step.required,
              phase: phase.name,
              cost: adjustedCost,
              gas: operation.gasEstimate
            });
          }
        }
      }
    }

    return { totalCost, breakdown };
  }

  displayStrategyComparison(scenario = 'LOW') {
    console.log(`\n📊 SETUP STRATEGY COMPARISON (${scenario} Gas)`);
    console.log("=" .repeat(60));

    const strategyResults = [];

    for (const [key, strategy] of Object.entries(SETUP_STRATEGIES)) {
      const { totalCost, breakdown } = this.calculateStrategyCost(strategy, scenario);
      const cost = this.formatCost(totalCost.toString(), 'LOW'); // Use LOW since we already adjusted

      strategyResults.push({
        key,
        strategy,
        totalCost,
        cost,
        breakdown
      });

      console.log(`\n🎯 ${strategy.name}`);
      console.log(`   ${strategy.description}`);
      console.log(`   💰 Total Cost: ${cost.eth} ETH ($${cost.usd})`);

      // Show cost breakdown
      if (strategy.phases) {
        let currentPhase = "";
        for (const step of breakdown) {
          if (step.phase !== currentPhase) {
            console.log(`\n   📅 ${step.phase}:`);
            currentPhase = step.phase;
          }
          const stepCost = this.formatCost(step.cost.toString(), 'LOW');
          console.log(`     • ${step.description}: $${stepCost.usd}`);
        }
      } else {
        for (const step of breakdown) {
          const stepCost = this.formatCost(step.cost.toString(), 'LOW');
          const required = step.required ? "Required" : "Optional";
          console.log(`     • ${step.description}: $${stepCost.usd} (${required})`);
        }
      }

      // Show pros/cons
      console.log(`\n   ✅ Pros:`);
      for (const pro of strategy.pros) {
        console.log(`     • ${pro}`);
      }
      console.log(`   ❌ Cons:`);
      for (const con of strategy.cons) {
        console.log(`     • ${con}`);
      }
    }

    // Sort by cost
    strategyResults.sort((a, b) => Number(a.totalCost - b.totalCost));

    console.log(`\n🏆 COST RANKING:`);
    strategyResults.forEach((result, index) => {
      const rank = index + 1;
      const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "📍";
      console.log(`   ${emoji} ${result.strategy.name}: $${result.cost.usd}`);
    });

    return strategyResults;
  }

  async askUserPreferences() {
    console.log("\n🤔 USER PREFERENCE ANALYSIS");
    console.log("=" .repeat(40));

    const preferences = {};

    // Ask about deposit sources
    const depositSource = await this.askQuestion(
      "Where will you primarily deposit funds from?\n" +
      "1. MetaMask/Wallet directly\n" +
      "2. Exchanges (Coinbase, Binance, etc.)\n" +
      "3. Both equally\n" +
      "Enter your choice (1-3): "
    );
    preferences.depositSource = parseInt(depositSource);

    // Ask about initial amount
    const initialAmount = await this.askQuestion(
      "What's your expected initial deposit amount in USD? (e.g., 1000): $"
    );
    preferences.initialAmount = parseFloat(initialAmount) || 1000;

    // Ask about gas price sensitivity
    const gasSensitivity = await this.askQuestion(
      "How sensitive are you to gas costs?\n" +
      "1. Very sensitive - will wait for low gas\n" +
      "2. Moderately sensitive - prefer efficiency\n" +
      "3. Not sensitive - want convenience\n" +
      "Enter your choice (1-3): "
    );
    preferences.gasSensitivity = parseInt(gasSensitivity);

    // Ask about timeframe
    const timeframe = await this.askQuestion(
      "When do you need full functionality?\n" +
      "1. Immediately\n" +
      "2. Within a week\n" +
      "3. Can wait for optimal conditions\n" +
      "Enter your choice (1-3): "
    );
    preferences.timeframe = parseInt(timeframe);

    return preferences;
  }

  analyzeRecommendation(preferences, strategyResults) {
    console.log("\n🎯 PERSONALIZED RECOMMENDATION");
    console.log("=" .repeat(45));

    let recommendedStrategy = null;
    let reasoning = [];

    // Calculate relative cost impact
    const totalCosts = strategyResults.map(r => parseFloat(r.cost.usd));
    const minCost = Math.min(...totalCosts);
    const maxCost = Math.max(...totalCosts);
    const costRange = maxCost - minCost;

    // Scoring system
    const scores = strategyResults.map(result => {
      let score = 0;
      const strategy = result.strategy;
      const costImpact = (parseFloat(result.cost.usd) - minCost) / costRange;

      // Deposit source considerations
      if (preferences.depositSource === 2) { // Exchanges
        if (strategy.name.includes("Enhanced")) score += 3;
        reasoning.push("Exchange deposits favor Enhanced setup with permanent address");
      } else if (preferences.depositSource === 1) { // Direct wallet
        if (strategy.name.includes("Basic") || strategy.name.includes("Minimal")) score += 2;
        reasoning.push("Direct wallet deposits work well with Basic/Minimal setup");
      }

      // Gas sensitivity
      if (preferences.gasSensitivity === 1) { // Very sensitive
        score -= costImpact * 3;
        if (strategy.name.includes("Phased")) score += 2;
        reasoning.push("High gas sensitivity favors phased deployment");
      } else if (preferences.gasSensitivity === 3) { // Not sensitive
        if (strategy.name.includes("Enhanced")) score += 1;
        reasoning.push("Low gas sensitivity allows full Enhanced setup");
      }

      // Timeframe considerations
      if (preferences.timeframe === 1) { // Immediate
        if (strategy.name.includes("Enhanced") || strategy.name.includes("Basic")) score += 2;
        reasoning.push("Immediate need favors complete upfront setup");
      } else if (preferences.timeframe === 3) { // Can wait
        if (strategy.name.includes("Phased")) score += 2;
        reasoning.push("Flexible timeframe allows optimized phased approach");
      }

      // Initial amount considerations
      const setupCostPercentage = (parseFloat(result.cost.usd) / preferences.initialAmount) * 100;
      if (setupCostPercentage > 0.5) { // Setup cost > 0.5% of initial amount
        score -= 1;
        reasoning.push(`Setup cost is ${setupCostPercentage.toFixed(2)}% of initial deposit`);
      }

      return { ...result, score, setupCostPercentage };
    });

    // Find highest scoring strategy
    scores.sort((a, b) => b.score - a.score);
    recommendedStrategy = scores[0];

    console.log(`\n🎯 Recommended Strategy: ${recommendedStrategy.strategy.name}`);
    console.log(`💰 Cost: ${recommendedStrategy.cost.eth} ETH ($${recommendedStrategy.cost.usd})`);
    console.log(`📊 Setup cost: ${recommendedStrategy.setupCostPercentage.toFixed(3)}% of initial deposit`);

    console.log(`\n💡 Reasoning:`);
    const uniqueReasons = [...new Set(reasoning)];
    uniqueReasons.forEach(reason => {
      console.log(`   • ${reason}`);
    });

    // Show alternative if very close
    if (scores[1] && Math.abs(scores[0].score - scores[1].score) < 1) {
      console.log(`\n🔄 Alternative: ${scores[1].strategy.name} ($${scores[1].cost.usd})`);
      console.log(`   Consider this if priorities change`);
    }

    return recommendedStrategy;
  }

  async displayNetworkScenarios(recommendedStrategy) {
    console.log("\n🌡️  NETWORK CONGESTION IMPACT");
    console.log("=" .repeat(40));

    const scenarios = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'];
    const scenarioNames = {
      LOW: 'Normal (1x)',
      MEDIUM: 'Busy (1.5x)',
      HIGH: 'Congested (2.5x)',
      EXTREME: 'Extreme (5x)'
    };

    console.log(`\nCost of "${recommendedStrategy.strategy.name}" across network conditions:\n`);

    scenarios.forEach(scenario => {
      const { totalCost } = this.calculateStrategyCost(recommendedStrategy.strategy, scenario);
      const cost = this.formatCost(totalCost.toString(), 'LOW'); // Already adjusted
      console.log(`${scenarioNames[scenario].padEnd(20)}: ${cost.eth} ETH ($${cost.usd})`);
    });

    console.log(`\n💡 Tip: Monitor gas prices at etherscan.io/gastracker`);
    console.log(`   Current gas is ${this.gasResults.gasPrice} gwei - ` +
                (parseFloat(this.gasResults.gasPrice) < 10 ? "EXCELLENT" :
                 parseFloat(this.gasResults.gasPrice) < 20 ? "GOOD" :
                 parseFloat(this.gasResults.gasPrice) < 50 ? "MODERATE" : "HIGH"));
  }

  askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  async run() {
    try {
      await this.initialize();

      // Show strategy comparison
      const strategyResults = this.displayStrategyComparison();

      // Get user preferences
      const preferences = await this.askUserPreferences();

      // Generate recommendation
      const recommendation = this.analyzeRecommendation(preferences, strategyResults);

      // Show network scenarios
      await this.displayNetworkScenarios(recommendation);

      console.log(`\n✅ Recommendation complete! Run your chosen setup transactions when ready.`);

    } catch (error) {
      console.error("❌ Error:", error.message);
    } finally {
      this.rl.close();
    }
  }
}

// CLI interface
if (require.main === module) {
  const calculator = new SetupCostCalculator();
  calculator.run();
}

module.exports = { SetupCostCalculator, SETUP_STRATEGIES };