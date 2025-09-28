const fs = require("fs");
const path = require("path");

/**
 * Post-compile hook that automatically updates frontend ABIs
 * This runs after every successful compilation
 */
async function updateABIs() {
  console.log("🔄 Auto-updating frontend ABIs after compilation...");

  try {
    const frontendABIDir = path.join(__dirname, "../frontend/src");

    // Ensure frontend ABI directory exists
    if (!fs.existsSync(frontendABIDir)) {
      console.log("⚠️  Frontend ABI directory not found, skipping ABI update");
      return;
    }

    let updatedCount = 0;

    // Update SavingsCore ABI
    try {
      const savingsArtifact = require("../artifacts/contracts/SavingsCore.sol/SavingsCore.json");
      const frontendSavingsABIPath = path.join(frontendABIDir, "SavingsABI.json");
      fs.writeFileSync(frontendSavingsABIPath, JSON.stringify(savingsArtifact.abi, null, 2));
      console.log("  ✅ SavingsCore ABI updated");
      updatedCount++;
    } catch (error) {
      console.log("  ⚠️  Could not update SavingsCore ABI:", error.message);
    }

    // Update MockUSDT ABI
    try {
      const usdtArtifact = require("../artifacts/contracts/MockUSDT.sol/MockUSDT.json");
      const frontendUSDTABIPath = path.join(frontendABIDir, "MockUSDT_ABI.json");
      fs.writeFileSync(frontendUSDTABIPath, JSON.stringify(usdtArtifact.abi, null, 2));
      console.log("  ✅ MockUSDT ABI updated");
      updatedCount++;
    } catch (error) {
      console.log("  ⚠️  Could not update MockUSDT ABI:", error.message);
    }

    // Update UserProxy ABI
    try {
      const userProxyArtifact = require("../artifacts/contracts/UserProxy.sol/UserProxy.json");
      const frontendUserProxyABIPath = path.join(frontendABIDir, "UserProxyABI.json");
      fs.writeFileSync(frontendUserProxyABIPath, JSON.stringify(userProxyArtifact.abi, null, 2));
      console.log("  ✅ UserProxy ABI updated");
      updatedCount++;
    } catch (error) {
      console.log("  ⚠️  Could not update UserProxy ABI:", error.message);
    }

    console.log(`✅ Auto-updated ${updatedCount} ABI files`);

  } catch (error) {
    console.log("❌ Error during automatic ABI update:", error.message);
  }
}

// Run if called directly
if (require.main === module) {
  updateABIs();
}

module.exports = { updateABIs };