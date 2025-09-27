const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Validates that deployed contracts match frontend configuration
 * and that all functions are accessible
 */
async function validateDeployment() {
  console.log("🔍 Validating deployment integrity...\n");

  try {
    // Read frontend configuration
    const frontendPath = path.join(__dirname, "../frontend/src/App.js");
    const frontendContent = fs.readFileSync(frontendPath, "utf8");

    // Extract contract addresses from frontend
    const savingsMatch = frontendContent.match(/savingsContract: "([^"]+)"/);
    const usdtMatch = frontendContent.match(/(USDT: {[^}]*address: ")[^"]*(",)/);

    if (!savingsMatch) {
      throw new Error("Could not find Savings contract address in frontend");
    }

    const savingsAddress = savingsMatch[1];
    console.log(`📋 Frontend Savings Address: ${savingsAddress}`);

    // Test contract connectivity
    const provider = ethers.provider;
    const code = await provider.getCode(savingsAddress);

    if (code === "0x") {
      throw new Error(`No contract found at Savings address: ${savingsAddress}`);
    }

    console.log("✅ Contract exists at address");

    // Load the ABI and test key functions
    const savingsABI = JSON.parse(fs.readFileSync(
      path.join(__dirname, "../frontend/src/SavingsABI.json"),
      "utf8"
    ));

    const contract = new ethers.Contract(savingsAddress, savingsABI, provider);

    // Test critical functions
    const tests = [
      {
        name: "owner()",
        call: () => contract.owner()
      },
      {
        name: "isSetupCommitted()",
        call: () => contract.isSetupCommitted()
      },
      {
        name: "getTokenBalance()",
        call: () => contract.getTokenBalance(
          "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Default test address
          "0x0000000000000000000000000000000000000000"  // ETH
        )
      }
    ];

    console.log("\n🧪 Testing contract functions:");
    let passedTests = 0;

    for (const test of tests) {
      try {
        const result = await test.call();
        console.log(`  ✅ ${test.name} - OK (returned: ${result})`);
        passedTests++;
      } catch (error) {
        console.log(`  ❌ ${test.name} - FAILED: ${error.message}`);
      }
    }

    // Check ABI compatibility
    console.log("\n📋 Checking ABI compatibility:");
    const expectedFunctions = [
      "isSetupCommitted",
      "getTokenBalance",
      "addTimePeriodLimit",
      "setCommonPeriodLimits",
      "withdraw",
      "requestLimitBypass",
      "executeBypassWithdrawal",
      "cancelBypassRequest"
    ];

    let foundFunctions = 0;
    for (const funcName of expectedFunctions) {
      const func = savingsABI.find(item => item.type === "function" && item.name === funcName);
      if (func) {
        console.log(`  ✅ ${funcName} - Found in ABI`);
        foundFunctions++;
      } else {
        console.log(`  ❌ ${funcName} - Missing from ABI`);
      }
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 VALIDATION SUMMARY");
    console.log("=".repeat(50));
    console.log(`Contract Address: ${savingsAddress}`);
    console.log(`Contract Code: ${code === "0x" ? "❌ MISSING" : "✅ PRESENT"}`);
    console.log(`Function Tests: ${passedTests}/${tests.length} passed`);
    console.log(`ABI Functions: ${foundFunctions}/${expectedFunctions.length} found`);

    const isValid = passedTests === tests.length && foundFunctions === expectedFunctions.length;

    if (isValid) {
      console.log("\n🎉 DEPLOYMENT VALIDATION PASSED");
      console.log("   All systems are ready for use!");
    } else {
      console.log("\n⚠️  DEPLOYMENT VALIDATION FAILED");
      console.log("   Please fix the issues above before using the frontend");
    }

    return isValid;

  } catch (error) {
    console.log(`❌ Validation Error: ${error.message}`);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  validateDeployment().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { validateDeployment };