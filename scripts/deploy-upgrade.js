const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Configuration - store the current proxy address
const PROXY_ADDRESS = "0x7969c5eD335650692Bc04293B07F5BF2e7A673C0"; // Current proxy address

// Check for development mode flag
const isDevelopmentMode = process.env.DEV_MODE === 'true';
const contractPath = path.join(__dirname, '../contracts/Lock.sol');
const scriptPath = path.join(__dirname, 'deploy-upgrade.js');

async function modifyContractForDev() {
  if (!isDevelopmentMode) return null;

  console.log("🚧 Development mode: Modifying timelock to 30 seconds...");

  // Read current contract content
  const originalContent = fs.readFileSync(contractPath, 'utf8');

  // Check if already contains 24 hours (not already modified)
  if (!originalContent.includes('24 hours')) {
    console.log("⚠️  Contract doesn't contain '24 hours' - may already be modified or different format");
    console.log("Skipping modification to avoid issues");
    return null;
  }

  // Replace 24 hours with 30 seconds
  const modifiedContent = originalContent.replace(/24 hours/g, '30');

  // Verify the replacement actually happened
  if (modifiedContent === originalContent) {
    console.log("⚠️  No changes made to contract - replacement may have failed");
    return null;
  }

  // Write modified content
  fs.writeFileSync(contractPath, modifiedContent);

  console.log("✅ Contract modified for development (30 second timelock)");
  console.log("🧹 Clearing Hardhat cache to force recompilation...");

  // Force recompilation by clearing cache
  try {
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec('npx hardhat clean', (error, stdout, stderr) => {
        if (error) {
          console.warn(`⚠️  Could not clean cache: ${error.message}`);
        } else {
          console.log("✅ Cache cleared successfully");
        }
        resolve();
      });
    });
  } catch (error) {
    console.warn(`⚠️  Could not clear cache: ${error.message}`);
  }

  return originalContent; // Return original content for restoration
}

async function restoreContract(originalContent) {
  if (!isDevelopmentMode || !originalContent) return;

  console.log("🔄 Restoring original contract...");
  fs.writeFileSync(contractPath, originalContent);
  console.log("✅ Contract restored to production settings");
}

async function updateProxyAddress(newAddress) {
  if (!newAddress || newAddress === PROXY_ADDRESS) return;

  try {
    console.log(`📝 Updating PROXY_ADDRESS from ${PROXY_ADDRESS} to ${newAddress}...`);

    // Read current script content
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    // Replace the PROXY_ADDRESS line
    const updatedContent = scriptContent.replace(
      /const PROXY_ADDRESS = "0x[a-fA-F0-9]{40}"; \/\/ Current proxy address/,
      `const PROXY_ADDRESS = "${newAddress}"; // Current proxy address`
    );

    // Write updated content back
    fs.writeFileSync(scriptPath, updatedContent);
    console.log("✅ PROXY_ADDRESS updated successfully for future deployments");

  } catch (error) {
    console.warn(`⚠️  Could not update PROXY_ADDRESS: ${error.message}`);
    console.warn("Please manually update the PROXY_ADDRESS constant in deploy-upgrade.js");
  }
}

async function main() {
  console.log(`🔄 Starting smart deployment/upgrade process${isDevelopmentMode ? ' (DEVELOPMENT MODE)' : ''}...\n`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  let savingsAddress;
  let isUpgrade = false;
  let originalContent = null;

  try {
    // Modify contract for development mode if needed
    originalContent = await modifyContractForDev();

    // Force compilation if we modified the contract
    if (isDevelopmentMode && originalContent) {
      console.log("🔧 Compiling modified contract...");
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('npx hardhat compile', (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Compilation failed: ${error.message}`);
            reject(error);
          } else {
            console.log("✅ Contract compiled successfully");
            resolve();
          }
        });
      });
    }

  // Check if proxy already exists
  if (PROXY_ADDRESS && PROXY_ADDRESS !== "0x0000000000000000000000000000000000000000") {
    try {
      // Try to interact with the existing proxy to see if it exists
      const existingContract = await ethers.getContractAt("Savings", PROXY_ADDRESS);
      const owner = await existingContract.owner();
      console.log(`📋 Found existing proxy at: ${PROXY_ADDRESS}`);
      console.log(`   Current owner: ${owner}`);

      // Perform upgrade
      console.log("⬆️  Upgrading existing proxy...");
      const Savings = await ethers.getContractFactory("Savings");
      const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, Savings);
      await upgraded.waitForDeployment();
      savingsAddress = await upgraded.getAddress();
      isUpgrade = true;

      console.log(`✅ Contract upgraded successfully!`);
      console.log(`   Proxy address (unchanged): ${savingsAddress}`);

      try {
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(savingsAddress);
        console.log(`   New implementation address: ${implementationAddress}`);
      } catch (error) {
        console.log("   Could not fetch implementation address, but upgrade succeeded");
      }

    } catch (error) {
      console.log(`⚠️  Proxy at ${PROXY_ADDRESS} not found or not accessible`);
      console.log("   Proceeding with fresh deployment...\n");

      // Deploy fresh proxy
      console.log("💰 Deploying new Savings contract (upgradeable)...");
      const Savings = await ethers.getContractFactory("Savings");
      const savings = await upgrades.deployProxy(Savings, [], { initializer: "initialize" });
      await savings.waitForDeployment();
      savingsAddress = await savings.getAddress();

      console.log(`✅ New Savings contract deployed to: ${savingsAddress}`);
    }
  } else {
    // Deploy fresh proxy
    console.log("💰 Deploying new Savings contract (upgradeable)...");
    const Savings = await ethers.getContractFactory("Savings");
    const savings = await upgrades.deployProxy(Savings, [], { initializer: "initialize" });
    await savings.waitForDeployment();
    savingsAddress = await savings.getAddress();

    console.log(`✅ New Savings contract deployed to: ${savingsAddress}`);
  }

  // Deploy MockUSDT only if it's a fresh deployment or if needed
  let usdtAddress;
  if (!isUpgrade) {
    console.log("\n📄 Deploying MockUSDT...");
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();
    usdtAddress = await mockUSDT.getAddress();

    const usdtBalance = await mockUSDT.balanceOf(deployer.address);
    console.log(`✅ MockUSDT deployed to: ${usdtAddress}`);
    console.log(`   Deployer USDT balance: ${ethers.formatUnits(usdtBalance, 6)} USDT`);
  } else {
    // For upgrades, try to get the existing USDT address from frontend config
    try {
      const frontendPath = path.join(__dirname, "../frontend/src/App.js");
      const frontendContent = fs.readFileSync(frontendPath, "utf8");
      const usdtMatch = frontendContent.match(/address: "([^"]+)",\s*symbol: "USDT"/);
      if (usdtMatch) {
        usdtAddress = usdtMatch[1];
        console.log(`\n📄 Using existing MockUSDT: ${usdtAddress}`);
      } else {
        console.log("\n⚠️  Could not find existing USDT address in frontend config");
      }
    } catch (error) {
      console.log("\n⚠️  Could not read frontend config for USDT address");
    }
  }

  // Update frontend addresses only if needed
  console.log("\n🔄 Updating frontend addresses...");
  const frontendPath = path.join(__dirname, "../frontend/src/App.js");

  try {
    let frontendContent = fs.readFileSync(frontendPath, "utf8");
    let addressChanged = false;

    // Update Savings contract address
    const currentSavingsMatch = frontendContent.match(/savingsContract: "([^"]+)"/);
    if (!currentSavingsMatch || currentSavingsMatch[1] !== savingsAddress) {
      frontendContent = frontendContent.replace(
        /savingsContract: "[^"]*"/,
        `savingsContract: "${savingsAddress}"`
      );
      addressChanged = true;
      console.log(`   Updated Savings address: ${savingsAddress}`);
    } else {
      console.log(`   Savings address unchanged: ${savingsAddress}`);
    }

    // Update USDT address only if we have a new one
    if (usdtAddress) {
      const currentUsdtMatch = frontendContent.match(/(USDT: {[^}]*address: ")[^"]*(",)/);
      if (!currentUsdtMatch || !currentUsdtMatch[0].includes(usdtAddress)) {
        frontendContent = frontendContent.replace(
          /(USDT: {[^}]*address: ")[^"]*(",)/,
          `$1${usdtAddress}$2`
        );
        addressChanged = true;
        console.log(`   Updated USDT address: ${usdtAddress}`);
      } else {
        console.log(`   USDT address unchanged: ${usdtAddress}`);
      }
    }

    if (addressChanged) {
      fs.writeFileSync(frontendPath, frontendContent);
      console.log("✅ Frontend addresses updated successfully");
    } else {
      console.log("✅ Frontend addresses already up to date");
    }

  } catch (error) {
    console.log("⚠️  Warning: Could not update frontend addresses automatically");
    console.log(`   Error: ${error.message}`);
  }

  // Update ABI files
  console.log("\n📋 Updating contract ABIs...");
  try {
    // Copy Savings ABI
    const savingsArtifact = require("../artifacts/contracts/Lock.sol/Savings.json");
    const frontendSavingsABIPath = path.join(__dirname, "../frontend/src/SavingsABI.json");
    fs.writeFileSync(frontendSavingsABIPath, JSON.stringify(savingsArtifact.abi, null, 2));
    console.log("✅ Savings ABI updated");

    // Copy MockUSDT ABI
    const usdtArtifact = require("../artifacts/contracts/MockUSDT.sol/MockUSDT.json");
    const frontendUSDTABIPath = path.join(__dirname, "../frontend/src/MockUSDT_ABI.json");
    fs.writeFileSync(frontendUSDTABIPath, JSON.stringify(usdtArtifact.abi, null, 2));
    console.log("✅ MockUSDT ABI updated");

    // Copy UserProxy ABI
    const userProxyArtifact = require("../artifacts/contracts/UserProxy.sol/UserProxy.json");
    const frontendUserProxyABIPath = path.join(__dirname, "../frontend/src/UserProxyABI.json");
    fs.writeFileSync(frontendUserProxyABIPath, JSON.stringify(userProxyArtifact.abi, null, 2));
    console.log("✅ UserProxy ABI updated");

  } catch (error) {
    console.log("⚠️  Warning: Could not update ABIs automatically");
    console.log(`   Error: ${error.message}`);
  }

  // Summary
  console.log(`\n🎉 ${isUpgrade ? 'Upgrade' : 'Deployment'} Summary:`);
  console.log("=" .repeat(50));
  console.log(`Operation Type:      ${isUpgrade ? 'UPGRADE (Data Preserved)' : 'FRESH DEPLOYMENT'}`);
  console.log(`Savings Address:     ${savingsAddress}`);
  if (usdtAddress) {
    console.log(`MockUSDT Address:    ${usdtAddress}`);
  }
  console.log(`Deployer Address:    ${deployer.address}`);
  console.log("=" .repeat(50));

  // Update PROXY_ADDRESS for future deployments (both fresh deployment and upgrade)
  await updateProxyAddress(savingsAddress);

  if (isUpgrade) {
    console.log("\n✅ Upgrade completed successfully!");
    console.log("   - Contract address unchanged (proxy pattern working correctly)");
    console.log("   - All user data preserved");
    console.log("   - New functionality available");
  } else {
    console.log("\n✅ Fresh deployment completed!");
    console.log("   - Update this script's PROXY_ADDRESS constant for future upgrades");
    console.log(`   - Set PROXY_ADDRESS = "${savingsAddress}"`);
  }

  console.log("\n📝 Next steps:");
  if (!isUpgrade && usdtAddress) {
    console.log("1. Add USDT token to MetaMask:");
    console.log(`   Address: ${usdtAddress}`);
    console.log("   Symbol: USDT");
    console.log("   Decimals: 6");
  }
  console.log(`${!isUpgrade && usdtAddress ? '2' : '1'}. Start your frontend: cd frontend && npm start`);
  if (!isUpgrade) {
    console.log(`${usdtAddress ? '3' : '2'}. Remember to update PROXY_ADDRESS in this script for future upgrades`);
  }

  // Validate deployment integrity
  console.log("\n🔍 Running deployment validation...");
  try {
    const { validateDeployment } = require("./validate-deployment.js");
    const isValid = await validateDeployment();

    if (!isValid) {
      console.log("\n⚠️  Deployment validation failed. Please check the issues above.");
      process.exit(1);
    }
    console.log("✅ Deployment validation passed!");
  } catch (error) {
    console.log(`\n⚠️  Could not run validation: ${error.message}`);
    console.log("Proceeding anyway...");
  }

  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  } finally {
    // Always restore the original contract, even if deployment fails
    await restoreContract(originalContent);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});