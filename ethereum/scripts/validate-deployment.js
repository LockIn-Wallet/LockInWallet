const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Validates that deployed contracts match frontend configuration
 * and that all functions are accessible.
 *
 * The core is a custody kernel; user-facing features live in
 * self-authenticating modules resolved through the registry, so this
 * validates both the kernel surface and each module's registration.
 */

const TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Default hardhat account
const ETH = "0x0000000000000000000000000000000000000000";

const MODULES = [
  { key: "TIME_PERIOD_LIMITS", abiFile: "TimePeriodLimitsModuleABI.json", probe: (c) => c.getActivePeriodCount(TEST_ADDRESS) },
  { key: "PROPOSAL_SYSTEM", abiFile: "ProposalSystemModuleABI.json", probe: (c) => c.isSetupCommitted(TEST_ADDRESS) },
  { key: "BYPASS_SYSTEM", abiFile: "BypassSystemModuleABI.json", probe: (c) => c.getUserActiveBypassRequests(TEST_ADDRESS) },
  { key: "APPROVAL_SYSTEM", abiFile: "ApprovalSystemModuleABI.json", probe: (c) => c.getUserWithdrawalAddresses(TEST_ADDRESS) },
  { key: "PROXY_DEPLOYMENT", abiFile: "ProxyDeploymentModuleABI.json", probe: (c) => c.isProxyDeployed(TEST_ADDRESS) },
  { key: "POOL_TOGETHER", abiFile: "PoolTogetherModuleABI.json", probe: (c) => c.hasVault(ETH) },
  { key: "VAULT_SYSTEM", abiFile: "VaultSystemModuleABI.json", probe: (c) => c.getVaultCount() },
  { key: "REFERRAL", abiFile: "ReferralModuleABI.json", probe: (c) => c.getReferralCount(TEST_ADDRESS) },
];

async function validateDeployment() {
  console.log("🔍 Validating deployment integrity...\n");

  try {
    // Read the deployed core address from the frontend network config
    const networkConfigPath = path.join(__dirname, "../../frontend/src/networkConfig.json");
    const networkConfig = JSON.parse(fs.readFileSync(networkConfigPath, "utf8"));
    const networkName = process.env.HARDHAT_NETWORK || "localhost";
    const savingsAddress = networkConfig.evm?.[networkName]?.savingsContract;

    if (!savingsAddress) {
      throw new Error(`No savingsContract for evm.${networkName} in networkConfig.json`);
    }

    console.log(`📋 Configured SavingsCore address: ${savingsAddress}`);

    // Test contract connectivity
    const provider = ethers.provider;
    const code = await provider.getCode(savingsAddress);

    if (code === "0x") {
      throw new Error(`No contract found at Savings address: ${savingsAddress}`);
    }

    console.log("✅ Contract exists at address");

    const abiDir = path.join(__dirname, "../../frontend/src");
    const savingsABI = JSON.parse(fs.readFileSync(path.join(abiDir, "SavingsABI.json"), "utf8"));
    const contract = new ethers.Contract(savingsAddress, savingsABI, provider);

    // Test the kernel surface
    const tests = [
      { name: "owner()", call: () => contract.owner() },
      { name: "getDevelopmentMode()", call: () => contract.getDevelopmentMode() },
      { name: "getTokenBalance()", call: () => contract.getTokenBalance(TEST_ADDRESS, ETH) },
    ];

    console.log("\n🧪 Testing core kernel functions:");
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

    // Kernel ABI surface
    console.log("\n📋 Checking core ABI surface:");
    const expectedFunctions = [
      "registerModule",
      "getModule",
      "isAuthorizedModule",
      "deposit",
      "depositTo",
      "withdraw",
      "withdrawTo",
      "withdrawAll",
      "getTokenBalance",
      "updateTokenBalance",
      "transferTokensTo",
      "setupModuleCrossReferences",
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

    // Each module: registered in the registry and answering a direct call
    console.log("\n🧩 Testing module registry and direct module calls:");
    let passedModules = 0;

    for (const mod of MODULES) {
      try {
        const moduleId = ethers.keccak256(ethers.toUtf8Bytes(mod.key));
        const moduleAddress = await contract.getModule(moduleId);
        if (moduleAddress === ethers.ZeroAddress) {
          console.log(`  ❌ ${mod.key} - Not registered`);
          continue;
        }
        const moduleABI = JSON.parse(fs.readFileSync(path.join(abiDir, mod.abiFile), "utf8"));
        const moduleContract = new ethers.Contract(moduleAddress, moduleABI, provider);
        const result = await mod.probe(moduleContract);
        console.log(`  ✅ ${mod.key} @ ${moduleAddress} - OK (probe returned: ${result})`);
        passedModules++;
      } catch (error) {
        console.log(`  ❌ ${mod.key} - FAILED: ${error.message}`);
      }
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 VALIDATION SUMMARY");
    console.log("=".repeat(50));
    console.log(`Contract Address: ${savingsAddress}`);
    console.log(`Contract Code: ${code === "0x" ? "❌ MISSING" : "✅ PRESENT"}`);
    console.log(`Kernel Tests: ${passedTests}/${tests.length} passed`);
    console.log(`Kernel ABI: ${foundFunctions}/${expectedFunctions.length} found`);
    console.log(`Modules: ${passedModules}/${MODULES.length} registered & responding`);

    const isValid =
      passedTests === tests.length &&
      foundFunctions === expectedFunctions.length &&
      passedModules === MODULES.length;

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
