const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// Paths
const artifactsPath = path.join(__dirname, "../artifacts/contracts/Lock.sol/Savings.json");
const abiOutputPath = path.join(__dirname, "../frontend/src/SavingsABI.json");

// Function to compile contracts
function compileContracts() {
  return new Promise((resolve, reject) => {
    console.log("Compiling contracts...");
    exec("npx hardhat compile", (error, stdout, stderr) => {
      if (error) {
        console.error("Error during compilation:", stderr);
        reject(error);
      } else {
        console.log("Contracts compiled successfully.");
        resolve(stdout);
      }
    });
  });
}

// Function to update ABI
async function updateABI() {
  try {
    // Compile contracts first
    await compileContracts();

    // Check if the compiled ABI exists
    if (!fs.existsSync(artifactsPath)) {
      console.error("Error: ABI file not found. Make sure the contract is compiled.");
      process.exit(1);
    }

    // Read the ABI from the compiled contract
    const artifact = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
    const abi = JSON.stringify(artifact.abi, null, 2);

    // Write the ABI to the frontend directory
    fs.writeFileSync(abiOutputPath, abi, "utf8");
    console.log(`ABI successfully updated at: ${abiOutputPath}`);
  } catch (error) {
    console.error("Error updating ABI:", error);
    process.exit(1);
  }
}

// Run the script
updateABI();
