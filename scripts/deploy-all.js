const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting complete deployment...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  // 1. Deploy MockUSDT
  console.log("📄 Deploying MockUSDT...");
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy();
  await mockUSDT.waitForDeployment();
  const usdtAddress = await mockUSDT.getAddress();

  const usdtBalance = await mockUSDT.balanceOf(deployer.address);
  console.log(`✅ MockUSDT deployed to: ${usdtAddress}`);
  console.log(`   Deployer USDT balance: ${ethers.formatUnits(usdtBalance, 6)} USDT\n`);

  // 2. Deploy Savings contract (upgradeable)
  console.log("💰 Deploying Savings contract (upgradeable)...");
  const Savings = await ethers.getContractFactory("Savings");
  const savings = await upgrades.deployProxy(Savings, [], { initializer: "initialize" });
  await savings.waitForDeployment();
  const savingsAddress = await savings.getAddress();

  console.log(`✅ Savings contract deployed to: ${savingsAddress}\n`);

  // 3. Update frontend addresses
  console.log("🔄 Updating frontend addresses...");
  const frontendPath = path.join(__dirname, "../frontend/src/App.js");

  try {
    let frontendContent = fs.readFileSync(frontendPath, "utf8");

    // Update SAVINGS_CONTRACT_ADDRESS
    frontendContent = frontendContent.replace(
      /const SAVINGS_CONTRACT_ADDRESS = "[^"]*"/,
      `const SAVINGS_CONTRACT_ADDRESS = "${savingsAddress}"`
    );

    // Update USDT_ADDRESS in STABLECOINS configuration
    frontendContent = frontendContent.replace(
      /(USDT: {[^}]*address: ")[^"]*(",)/,
      `$1${usdtAddress}$2`
    );

    // Also update the legacy USDT_ADDRESS for backwards compatibility
    frontendContent = frontendContent.replace(
      /const USDT_ADDRESS = STABLECOINS\.USDT\.address;/,
      `const USDT_ADDRESS = "${usdtAddress}"; // Updated: ${usdtAddress}`
    );

    fs.writeFileSync(frontendPath, frontendContent);
    console.log("✅ Frontend addresses updated successfully\n");
  } catch (error) {
    console.log("⚠️  Warning: Could not update frontend addresses automatically");
    console.log("   Please update manually:\n");
  }

  // 4. Update ABI files
  console.log("📋 Updating contract ABIs...");
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
    console.log("✅ UserProxy ABI updated\n");
  } catch (error) {
    console.log("⚠️  Warning: Could not update ABIs automatically");
    console.log(`   Error: ${error.message}\n`);
  }

  // 5. Summary
  console.log("🎉 Deployment Summary:");
  console.log("=" .repeat(50));
  console.log(`MockUSDT Address:    ${usdtAddress}`);
  console.log(`Savings Address:     ${savingsAddress}`);
  console.log(`Deployer Address:    ${deployer.address}`);
  console.log(`USDT Balance:        ${ethers.formatUnits(usdtBalance, 6)} USDT`);
  console.log("=" .repeat(50));

  console.log("\n📝 Manual steps (if needed):");
  console.log("1. Add USDT token to MetaMask:");
  console.log(`   Address: ${usdtAddress}`);
  console.log("   Symbol: USDT");
  console.log("   Decimals: 6");

  console.log("\n2. If frontend addresses weren't updated automatically:");
  console.log(`   SAVINGS_CONTRACT_ADDRESS = "${savingsAddress}"`);
  console.log(`   USDT_ADDRESS = "${usdtAddress}"`);

  console.log("\n3. UserProxy deployment:");
  console.log("   - Users can generate their deposit addresses via the UI");
  console.log("   - Each user gets a unique proxy contract for direct exchange deposits");

  console.log("\n🚀 Ready to use! Start your frontend with: cd frontend && npm start");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});