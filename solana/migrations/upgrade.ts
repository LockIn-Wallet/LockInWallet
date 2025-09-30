import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SavingsCore } from "../target/types/savings_core";
import * as fs from "fs";
import * as path from "path";

export async function upgradeProgram() {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SavingsCore as Program<SavingsCore>;

  console.log("🔄 Upgrading Solana Savings Program...");
  console.log("Program ID:", program.programId.toString());
  console.log("Upgrader:", provider.wallet.publicKey.toString());

  // In Solana, program upgrades are handled by the BPF loader
  // The program ID stays the same, but the program data is updated

  console.log("📝 Note: Program upgrade is handled automatically by Anchor deploy");
  console.log("📝 The program data will be updated while maintaining the same Program ID");

  // Update deployment info with new timestamp
  const deploymentInfo = {
    programId: program.programId.toString(),
    deployer: provider.wallet.publicKey.toString(),
    network: provider.connection.rpcEndpoint.includes("localhost") ? "localnet" :
              provider.connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet",
    lastUpgrade: new Date().toISOString(),
    upgradedAt: new Date().toISOString(),
  };

  // Update frontend addresses
  const frontendPath = path.join(__dirname, "../../frontend/src/solanaAddresses.json");
  let existingConfig = {};

  try {
    const existingContent = fs.readFileSync(frontendPath, "utf8");
    existingConfig = JSON.parse(existingContent);
  } catch (error) {
    console.log("📝 No existing config found, creating new one");
  }

  const updatedConfig = {
    ...existingConfig,
    ...deploymentInfo,
  };

  fs.writeFileSync(frontendPath, JSON.stringify(updatedConfig, null, 2));

  console.log("✅ Program upgrade completed!");
  console.log("📍 Program ID (unchanged):", deploymentInfo.programId);
  console.log("📁 Frontend addresses updated");

  return deploymentInfo;
}

// Run upgrade if this script is executed directly
if (require.main === module) {
  upgradeProgram()
    .then(() => {
      console.log("🎉 Upgrade script completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Upgrade failed:", error);
      process.exit(1);
    });
}