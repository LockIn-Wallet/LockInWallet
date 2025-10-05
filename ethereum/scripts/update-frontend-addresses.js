const fs = require("fs");
const path = require("path");

async function updateFrontendAddresses(savingsAddress, usdtAddress) {
  const frontendPath = path.join(__dirname, "../../frontend/src/App.js");

  try {
    // Read current frontend file
    let frontendContent = fs.readFileSync(frontendPath, "utf8");

    // Update SAVINGS_CONTRACT_ADDRESS
    const savingsRegex = /const SAVINGS_CONTRACT_ADDRESS = "[^"]*"/;
    if (savingsRegex.test(frontendContent)) {
      frontendContent = frontendContent.replace(
        savingsRegex,
        `const SAVINGS_CONTRACT_ADDRESS = "${savingsAddress}"`
      );
      console.log(`✅ Updated SAVINGS_CONTRACT_ADDRESS to: ${savingsAddress}`);
    } else {
      console.log("⚠️  Could not find SAVINGS_CONTRACT_ADDRESS pattern in frontend");
    }

    // Update USDT_ADDRESS
    const usdtRegex = /const USDT_ADDRESS = "[^"]*"/;
    if (usdtRegex.test(frontendContent)) {
      frontendContent = frontendContent.replace(
        usdtRegex,
        `const USDT_ADDRESS = "${usdtAddress}"`
      );
      console.log(`✅ Updated USDT_ADDRESS to: ${usdtAddress}`);
    } else {
      console.log("⚠️  Could not find USDT_ADDRESS pattern in frontend");
    }

    // Write updated content back to file
    fs.writeFileSync(frontendPath, frontendContent);
    console.log("✅ Frontend addresses updated successfully");

    return true;
  } catch (error) {
    console.error("❌ Error updating frontend addresses:", error.message);
    return false;
  }
}

// If run directly (not imported)
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage: node scripts/update-frontend-addresses.js <savings_address> <usdt_address>");
    console.log("Example: node scripts/update-frontend-addresses.js 0x123... 0x456...");
    process.exit(1);
  }

  const [savingsAddress, usdtAddress] = args;

  updateFrontendAddresses(savingsAddress, usdtAddress)
    .then((success) => {
      if (success) {
        console.log("\n🎉 Frontend is ready to use with new contract addresses!");
      } else {
        console.log("\n❌ Please update addresses manually in frontend/src/App.js");
      }
    });
}

module.exports = { updateFrontendAddresses };