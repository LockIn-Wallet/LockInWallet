import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SavingsCore } from "../target/types/savings_core";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

export async function deployProgram() {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SavingsCore as Program<SavingsCore>;

  console.log("🚀 Deploying Solana Savings Program...");
  console.log("Program ID:", program.programId.toString());
  console.log("Deployer:", provider.wallet.publicKey.toString());

  // Derive the savings account PDA for the deployer (for testing)
  const [savingsAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("savings"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  console.log("Expected Savings Account PDA:", savingsAccountPda.toString());

  // Test basic program connectivity
  try {
    // Try to fetch the account (should fail if not initialized, which is expected)
    const accountInfo = await provider.connection.getAccountInfo(savingsAccountPda);
    if (accountInfo) {
      console.log("✅ Savings account already exists");
    } else {
      console.log("📝 Savings account not yet initialized (this is expected)");
    }
  } catch (error) {
    console.log("📝 Account check completed");
  }

  // Save deployment info
  const deploymentInfo = {
    programId: program.programId.toString(),
    savingsAccountPda: savingsAccountPda.toString(),
    deployer: provider.wallet.publicKey.toString(),
    network: provider.connection.rpcEndpoint.includes("localhost") ? "localnet" :
              provider.connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet",
    deployedAt: new Date().toISOString(),
  };

  // Create solana addresses file for frontend
  const frontendPath = path.join(__dirname, "../../frontend/src/solanaAddresses.json");
  fs.writeFileSync(frontendPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("✅ Deployment completed successfully!");
  console.log("📍 Program ID:", deploymentInfo.programId);
  console.log("📁 Frontend addresses updated at:", frontendPath);

  return deploymentInfo;
}

// Run deployment if this script is executed directly
if (require.main === module) {
  deployProgram()
    .then(() => {
      console.log("🎉 Deployment script completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}