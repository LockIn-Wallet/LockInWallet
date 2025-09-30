const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Transaction categories for your savings wallet
const TRANSACTION_CATEGORIES = {
  DEPLOYMENT: {
    name: "Contract Deployment",
    transactions: [
      "SavingsCore deployment",
      "TimePeriodLimitsModule deployment",
      "ProposalSystemModule deployment",
      "BypassSystemModule deployment",
      "ApprovalSystemModule deployment",
      "UserProxy deployment"
    ]
  },
  USER_SETUP_BASIC: {
    name: "Basic Setup (No UserProxy)",
    transactions: [
      "setCommonPeriodLimits",
      "addApprovalAddress",
      "commitInitialSetup"
    ],
    description: "Essential setup for savings account functionality"
  },
  USER_SETUP_ENHANCED: {
    name: "Enhanced Setup (With UserProxy)",
    transactions: [
      "deployUserProxy",
      "setCommonPeriodLimits",
      "addApprovalAddress",
      "commitInitialSetup"
    ],
    description: "Full setup with permanent deposit address for exchanges"
  },
  DEPOSITS: {
    name: "Deposit Operations",
    transactions: [
      "deposit (ETH)",
      "deposit (ERC20)",
      "depositTo (ETH)",
      "ERC20 approve + deposit"
    ]
  },
  WITHDRAWALS_IMMEDIATE: {
    name: "Immediate Withdrawals (Within Limits)",
    transactions: [
      "withdraw (simple)",
      "withdrawTo"
    ]
  },
  PENDING_REQUESTS: {
    name: "Pending Requests (Submit Only)",
    transactions: [
      "requestLimitBypass",
      "proposeLimitRemoval",
      "requestWithdrawalAddress"
    ],
    description: "Submit requests that require timelock period"
  },
  EXECUTE_REQUESTS: {
    name: "Execute Pending Requests",
    transactions: [
      "executeBypassWithdrawal",
      "executeLimitProposal",
      "executeWithdrawalAddressRequest"
    ],
    description: "Execute requests after timelock period"
  },
  REQUEST_EXECUTE_PAIRS: {
    name: "Complete Request + Execute Flows",
    pairs: [
      {
        name: "Limit Bypass (Complete Flow)",
        request: "requestLimitBypass",
        execute: "executeBypassWithdrawal",
        timelock: "24-72 hours"
      },
      {
        name: "Spending Limit Change (Complete Flow)",
        request: "proposeLimitRemoval",
        execute: "executeLimitProposal",
        timelock: "24-72 hours"
      },
      {
        name: "Withdrawal Address (Complete Flow)",
        request: "requestWithdrawalAddress",
        execute: "executeWithdrawalAddressRequest",
        timelock: "24-72 hours"
      }
    ]
  },
  MANAGEMENT: {
    name: "Account Management",
    transactions: [
      "addTimePeriodLimit",
      "removeTimePeriodLimit",
      "updateTimePeriodLimit",
      "revokeApprovalAddress",
      "cancelLimitProposal",
      "cancelBypassRequest"
    ]
  }
};

// Gas price scenarios for different network congestion levels
const GAS_SCENARIOS = {
  LOW: { name: "Low Congestion", multiplier: 1.0, description: "Normal network conditions" },
  MEDIUM: { name: "Medium Congestion", multiplier: 1.5, description: "Busy network" },
  HIGH: { name: "High Congestion", multiplier: 2.5, description: "Network congestion" },
  EXTREME: { name: "Extreme Congestion", multiplier: 5.0, description: "DeFi mania / NFT drops" }
};

class GasEstimator {
  constructor() {
    this.mainnetProvider = null;
    this.localProvider = null;
    this.savingsContract = null;
    this.results = {};
  }

  async initialize() {
    console.log("🔌 Initializing providers...");

    // Connect to mainnet for real gas prices
    try {
      this.mainnetProvider = new ethers.JsonRpcProvider(
        "https://eth-mainnet.g.alchemy.com/v2/demo" // Free tier, replace with your key for better reliability
      );
      await this.mainnetProvider.getNetwork();
      console.log("✅ Connected to mainnet for gas prices");
    } catch (error) {
      console.log("⚠️  Could not connect to mainnet, using fallback gas prices");
      this.mainnetProvider = null;
    }

    // Connect to local network for contract interaction
    this.localProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    try {
      await this.localProvider.getNetwork();
      console.log("✅ Connected to local network");
    } catch (error) {
      throw new Error("❌ Could not connect to local network. Make sure 'npx hardhat node' is running");
    }

    await this.loadContracts();
  }

  async loadContracts() {
    console.log("📋 Loading contract ABIs...");

    try {
      // Load SavingsCore ABI and address
      const savingsABI = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../frontend/src/SavingsABI.json"), "utf8")
      );

      // Try to get deployed address from frontend config or deployment artifacts
      let savingsAddress;
      try {
        this.moduleAddresses = JSON.parse(
          fs.readFileSync(path.join(__dirname, "../frontend/src/moduleAddresses.json"), "utf8")
        );
        savingsAddress = this.moduleAddresses.core;
      } catch {
        try {
          // Fallback: check frontend addresses.json
          const frontendAddresses = JSON.parse(
            fs.readFileSync(path.join(__dirname, "../frontend/src/addresses.json"), "utf8")
          );
          savingsAddress = frontendAddresses.savings;
        } catch {
          // Last fallback: look for deployment artifacts
          const deploymentsPath = path.join(__dirname, "../deployments");
          if (fs.existsSync(deploymentsPath)) {
            const deployments = fs.readdirSync(deploymentsPath)
              .filter(f => f.endsWith(".json"))
              .map(f => {
                const content = JSON.parse(fs.readFileSync(path.join(deploymentsPath, f)));
                return { file: f, timestamp: content.timestamp || 0, address: content.address };
              })
              .sort((a, b) => b.timestamp - a.timestamp);

            if (deployments.length > 0) {
              savingsAddress = deployments[0].address;
            }
          }
        }
      }

      if (!savingsAddress) {
        throw new Error("Could not find SavingsCore deployment address");
      }

      this.savingsContract = new ethers.Contract(savingsAddress, savingsABI, this.localProvider);
      console.log(`✅ Loaded SavingsCore at ${savingsAddress}`);

    } catch (error) {
      console.log("⚠️  Could not load deployed contracts:", error.message);
      console.log("📝 Will estimate deployment costs only");
    }
  }

  async getCurrentGasPrices() {
    console.log("⛽ Fetching current gas prices...");

    let baseGasPrice;
    let maxFeePerGas = null;
    let maxPriorityFeePerGas = null;

    if (this.mainnetProvider) {
      try {
        const feeData = await this.mainnetProvider.getFeeData();
        baseGasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
        maxFeePerGas = feeData.maxFeePerGas;
        maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

        console.log(`📊 Current mainnet gas price: ${ethers.formatUnits(baseGasPrice, "gwei")} gwei`);
        if (maxFeePerGas) {
          console.log(`📊 Max fee per gas: ${ethers.formatUnits(maxFeePerGas, "gwei")} gwei`);
        }
      } catch (error) {
        console.log("⚠️  Error fetching mainnet gas prices:", error.message);
        baseGasPrice = ethers.parseUnits("20", "gwei"); // fallback
      }
    } else {
      baseGasPrice = ethers.parseUnits("20", "gwei"); // fallback
    }

    return { baseGasPrice, maxFeePerGas, maxPriorityFeePerGas };
  }

  async estimateDeploymentCosts(gasPrice) {
    console.log("🏗️  Estimating deployment costs...");

    const deploymentEstimates = {
      "SavingsCore deployment": 2800000, // UUPS proxy + implementation
      "TimePeriodLimitsModule deployment": 1500000,
      "ProposalSystemModule deployment": 1800000,
      "BypassSystemModule deployment": 1200000,
      "ApprovalSystemModule deployment": 1600000,
      "UserProxy deployment": 250000
    };

    const results = {};
    for (const [name, gasEstimate] of Object.entries(deploymentEstimates)) {
      results[name] = {
        gasEstimate,
        baseCost: BigInt(gasEstimate) * gasPrice,
        scenarios: {}
      };

      for (const [scenarioName, scenario] of Object.entries(GAS_SCENARIOS)) {
        const multiplierBig = BigInt(Math.floor(scenario.multiplier * 100));
        const adjustedGasPrice = (gasPrice * multiplierBig) / BigInt(100);
        results[name].scenarios[scenarioName] = BigInt(gasEstimate) * adjustedGasPrice;
      }
    }

    return results;
  }

  async estimateContractOperations(gasPrice) {
    if (!this.savingsContract) {
      console.log("⚠️  Skipping contract operation estimates (no deployed contract)");
      return {};
    }

    console.log("🔧 Estimating contract operation costs...");

    const results = {};
    const testAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Hardhat account[1]
    const testToken = "0x0000000000000000000000000000000000000000"; // ETH
    const testAmount = ethers.parseEther("0.1");

    // Define operations to estimate
    const operations = {
      // User Setup
      "deployUserProxy": () => this.savingsContract.deployUserProxy.estimateGas(),
      "setCommonPeriodLimits": () => this.savingsContract.setCommonPeriodLimits.estimateGas(
        testAddress,
        ethers.parseEther("1"), // daily
        ethers.parseEther("5"), // weekly
        ethers.parseEther("20") // monthly
      ),
      "commitInitialSetup": () => this.savingsContract.commitInitialSetup.estimateGas(),

      // Deposits
      "deposit (ETH)": () => this.savingsContract["deposit(address,uint256)"].estimateGas(testToken, testAmount, { value: testAmount }),
      "deposit (ERC20)": () => this.savingsContract["deposit(address,uint256)"].estimateGas(
        this.moduleAddresses?.tokens?.usdt || "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e", // Use deployed USDT
        testAmount
      ),

      // Immediate Withdrawals
      "withdraw (simple)": () => this.savingsContract["withdraw(uint256,address)"].estimateGas(testAmount, testToken),
      "withdrawTo": () => this.savingsContract.withdrawTo.estimateGas(testAmount, testToken, testAddress),

      // Pending Requests (Submit Only)
      "requestLimitBypass": () => this.savingsContract.requestLimitBypass.estimateGas(
        testAmount, "Daily", testToken
      ),
      "proposeLimitRemoval": () => this.savingsContract.proposeLimitRemoval.estimateGas("Daily"),
      "requestWithdrawalAddress": () => this.savingsContract.requestWithdrawalAddress.estimateGas("Backup Address", testAddress),

      // Execute Requests
      "executeBypassWithdrawal": () => this.savingsContract.executeBypassWithdrawal.estimateGas("0x" + "0".repeat(64)), // Mock request ID
      "executeLimitProposal": () => this.savingsContract.executeLimitProposal.estimateGas("0x" + "0".repeat(64)), // Mock proposal ID
      "executeWithdrawalAddressRequest": () => this.savingsContract.executeWithdrawalAddressRequest.estimateGas("0x" + "0".repeat(64)), // Mock request ID

      // Management
      "addApprovalAddress": () => this.savingsContract.addApprovalAddress.estimateGas(testAddress),
      "revokeApprovalAddress": () => this.savingsContract.revokeApprovalAddress.estimateGas(testAddress),
      "addTimePeriodLimit": () => this.savingsContract.addTimePeriodLimit.estimateGas("Custom", ethers.parseEther("2"), 86400), // 1 day
      "removeTimePeriodLimit": () => this.savingsContract.removeTimePeriodLimit.estimateGas("Custom"),
      "cancelLimitProposal": () => this.savingsContract.cancelLimitProposal.estimateGas("0x" + "0".repeat(64)),
      "cancelBypassRequest": () => this.savingsContract.cancelBypassRequest.estimateGas("0x" + "0".repeat(64)),
    };

    for (const [name, estimateFunc] of Object.entries(operations)) {
      try {
        const gasEstimate = await estimateFunc();
        results[name] = {
          gasEstimate: Number(gasEstimate),
          baseCost: gasEstimate * gasPrice,
          scenarios: {}
        };

        for (const [scenarioName, scenario] of Object.entries(GAS_SCENARIOS)) {
          const multiplierBig = BigInt(Math.floor(scenario.multiplier * 100));
          const adjustedGasPrice = (gasPrice * multiplierBig) / BigInt(100);
          results[name].scenarios[scenarioName] = gasEstimate * adjustedGasPrice;
        }
      } catch (error) {
        console.log(`⚠️  Could not estimate ${name}: ${error.message}`);
        // Use fallback estimates for common operations
        const fallbackGas = this.getFallbackGasEstimate(name);
        if (fallbackGas) {
          results[name] = {
            gasEstimate: fallbackGas,
            baseCost: BigInt(fallbackGas) * gasPrice,
            scenarios: {},
            note: "Fallback estimate"
          };

          for (const [scenarioName, scenario] of Object.entries(GAS_SCENARIOS)) {
            const multiplierBig = BigInt(Math.floor(scenario.multiplier * 100));
            const adjustedGasPrice = (gasPrice * multiplierBig) / BigInt(100);
            results[name].scenarios[scenarioName] = BigInt(fallbackGas) * adjustedGasPrice;
          }
        }
      }
    }

    return results;
  }

  getFallbackGasEstimate(operationName) {
    const fallbacks = {
      // User Setup
      "deployUserProxy": 250000,
      "setCommonPeriodLimits": 180000,
      "commitInitialSetup": 120000,

      // Deposits
      "deposit (ETH)": 120000,
      "deposit (ERC20)": 150000,

      // Immediate Withdrawals
      "withdraw (simple)": 150000,
      "withdrawTo": 180000,

      // Pending Requests
      "requestLimitBypass": 200000,
      "proposeLimitRemoval": 120000,
      "requestWithdrawalAddress": 140000,

      // Execute Requests
      "executeBypassWithdrawal": 180000,
      "executeLimitProposal": 100000,
      "executeWithdrawalAddressRequest": 120000,

      // Management
      "addApprovalAddress": 80000,
      "revokeApprovalAddress": 60000,
      "addTimePeriodLimit": 120000,
      "removeTimePeriodLimit": 100000,
      "cancelLimitProposal": 80000,
      "cancelBypassRequest": 80000
    };
    return fallbacks[operationName];
  }

  async getETHPrice() {
    try {
      // Simple fetch to get ETH price (you could also use an oracle)
      const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      const data = await response.json();
      return data.ethereum?.usd || 2000; // fallback price
    } catch {
      return 2000; // fallback price in USD
    }
  }

  formatResults(deploymentResults, operationResults, gasPrice, ethPrice) {
    const formatCost = (wei) => {
      const eth = ethers.formatEther(wei);
      const usd = parseFloat(eth) * ethPrice;
      return {
        eth: parseFloat(eth).toFixed(6),
        usd: usd.toFixed(2),
        wei: wei.toString()
      };
    };

    console.log("\n" + "=".repeat(80));
    console.log("💰 SAVINGS WALLET GAS ESTIMATION REPORT");
    console.log("=".repeat(80));
    console.log(`⛽ Base Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
    console.log(`💵 ETH Price: $${ethPrice}`);
    console.log(`📅 Generated: ${new Date().toISOString()}`);

    // Deployment costs
    console.log("\n🏗️  CONTRACT DEPLOYMENT COSTS");
    console.log("-".repeat(50));
    let totalDeploymentCost = BigInt(0);

    for (const [name, data] of Object.entries(deploymentResults)) {
      console.log(`\n📦 ${name}`);
      console.log(`   Gas: ${data.gasEstimate.toLocaleString()}`);
      const cost = formatCost(data.baseCost);
      console.log(`   Cost: ${cost.eth} ETH ($${cost.usd})`);
      totalDeploymentCost += data.baseCost;
    }

    const totalDeployment = formatCost(totalDeploymentCost);
    console.log(`\n🎯 TOTAL DEPLOYMENT: ${totalDeployment.eth} ETH ($${totalDeployment.usd})`);

    // Operation costs by category
    console.log("\n🔧 TRANSACTION OPERATION COSTS");
    console.log("-".repeat(50));

    for (const [categoryKey, category] of Object.entries(TRANSACTION_CATEGORIES)) {
      if (categoryKey === "DEPLOYMENT") continue; // Already shown above

      console.log(`\n📋 ${category.name}`);
      if (category.description) {
        console.log(`   ${category.description}`);
      }

      let categoryHasData = false;
      let categoryTotalCost = BigInt(0);

      // Handle regular transactions
      if (category.transactions) {
        for (const txName of category.transactions) {
          if (operationResults[txName]) {
            categoryHasData = true;
            const data = operationResults[txName];
            console.log(`   ${txName}`);
            console.log(`     Gas: ${data.gasEstimate.toLocaleString()}`);
            const cost = formatCost(data.baseCost);
            console.log(`     Cost: ${cost.eth} ETH ($${cost.usd})`);
            if (data.note) console.log(`     Note: ${data.note}`);
            categoryTotalCost += data.baseCost;
          }
        }
      }

      // Handle request/execute pairs
      if (category.pairs) {
        for (const pair of category.pairs) {
          const requestData = operationResults[pair.request];
          const executeData = operationResults[pair.execute];

          if (requestData || executeData) {
            categoryHasData = true;
            console.log(`\n   ${pair.name}`);
            console.log(`     Timelock: ${pair.timelock}`);

            if (requestData) {
              const requestCost = formatCost(requestData.baseCost);
              console.log(`     Request: ${requestCost.eth} ETH ($${requestCost.usd}) - Gas: ${requestData.gasEstimate.toLocaleString()}`);
              categoryTotalCost += requestData.baseCost;
            }

            if (executeData) {
              const executeCost = formatCost(executeData.baseCost);
              console.log(`     Execute: ${executeCost.eth} ETH ($${executeCost.usd}) - Gas: ${executeData.gasEstimate.toLocaleString()}`);
              categoryTotalCost += executeData.baseCost;
            }

            if (requestData && executeData) {
              const totalCost = formatCost(requestData.baseCost + executeData.baseCost);
              console.log(`     📊 Total: ${totalCost.eth} ETH ($${totalCost.usd})`);
            }
          }
        }
      }

      // Show category total if applicable
      if (categoryHasData && categoryTotalCost > 0 && (categoryKey === "USER_SETUP_BASIC" || categoryKey === "USER_SETUP_ENHANCED")) {
        const totalCost = formatCost(categoryTotalCost);
        console.log(`\n   🎯 ${category.name} Total: ${totalCost.eth} ETH ($${totalCost.usd})`);
      }

      if (!categoryHasData) {
        console.log("   (No data available - contract not deployed)");
      }
    }

    // Congestion scenarios
    console.log("\n🌡️  NETWORK CONGESTION SCENARIOS");
    console.log("-".repeat(50));

    // Pick a representative transaction for comparison
    const sampleTx = operationResults["deposit (ETH)"] || operationResults["deployUserProxy"] || Object.values(operationResults)[0];

    if (sampleTx) {
      console.log(`\n📊 Sample Transaction: ${Object.keys(operationResults).find(k => operationResults[k] === sampleTx)}`);
      console.log(`    Base Gas: ${sampleTx.gasEstimate.toLocaleString()}`);

      for (const [scenarioName, scenario] of Object.entries(GAS_SCENARIOS)) {
        const cost = formatCost(sampleTx.scenarios[scenarioName]);
        console.log(`    ${scenario.name}: ${cost.eth} ETH ($${cost.usd}) - ${scenario.description}`);
      }
    }

    // Summary recommendations
    console.log("\n💡 FEASIBILITY ANALYSIS");
    console.log("-".repeat(50));

    const deploymentUSD = parseFloat(totalDeployment.usd);
    const typicalTxUSD = sampleTx ? parseFloat(formatCost(sampleTx.baseCost).usd) : 10;

    console.log(`\n✅ Initial deployment cost: $${deploymentUSD.toFixed(2)}`);
    console.log(`✅ Typical transaction cost: $${typicalTxUSD.toFixed(2)}`);

    if (deploymentUSD < 500) {
      console.log("🟢 LOW deployment cost - Very feasible for mainnet");
    } else if (deploymentUSD < 1000) {
      console.log("🟡 MEDIUM deployment cost - Feasible for serious projects");
    } else {
      console.log("🔴 HIGH deployment cost - Consider optimization or L2 deployment");
    }

    if (typicalTxUSD < 20) {
      console.log("🟢 LOW transaction costs - Good user experience");
    } else if (typicalTxUSD < 50) {
      console.log("🟡 MEDIUM transaction costs - Acceptable for savings amounts");
    } else {
      console.log("🔴 HIGH transaction costs - May deter small deposits");
    }

    console.log("\n📋 RECOMMENDATIONS:");
    console.log("• Deploy during low congestion periods to minimize costs");
    console.log("• Consider implementing gas optimization techniques");
    console.log("• For high-frequency usage, consider L2 deployment (Polygon, Arbitrum, etc.)");
    console.log("• Batch operations where possible to amortize gas costs");

    console.log("\n" + "=".repeat(80));
  }

  convertBigIntToString(obj) {
    if (typeof obj === 'bigint') {
      return obj.toString();
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertBigIntToString(item));
    }
    if (obj !== null && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.convertBigIntToString(value);
      }
      return result;
    }
    return obj;
  }

  async run() {
    try {
      await this.initialize();

      const { baseGasPrice } = await this.getCurrentGasPrices();
      const ethPrice = await this.getETHPrice();

      console.log(`💱 Current ETH price: $${ethPrice}`);

      const deploymentResults = await this.estimateDeploymentCosts(baseGasPrice);
      const operationResults = await this.estimateContractOperations(baseGasPrice);

      this.formatResults(deploymentResults, operationResults, baseGasPrice, ethPrice);

      // Save detailed results to file
      const detailedResults = {
        timestamp: new Date().toISOString(),
        gasPrice: ethers.formatUnits(baseGasPrice, "gwei"),
        ethPrice,
        deployment: this.convertBigIntToString(deploymentResults),
        operations: this.convertBigIntToString(operationResults),
        scenarios: GAS_SCENARIOS
      };

      fs.writeFileSync(
        path.join(__dirname, "gas-estimation-results.json"),
        JSON.stringify(detailedResults, null, 2)
      );

      console.log("\n💾 Detailed results saved to scripts/gas-estimation-results.json");

    } catch (error) {
      console.error("❌ Error running gas estimation:", error.message);
      process.exit(1);
    }
  }
}

// Run the estimation
if (require.main === module) {
  const estimator = new GasEstimator();
  estimator.run();
}

module.exports = { GasEstimator };