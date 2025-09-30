const fs = require('fs');
const path = require('path');

async function updateSolanaAddresses() {
  console.log("🔄 Updating Solana addresses in frontend...");

  try {
    // Read program keypair to get the program ID
    const programKeypairPath = path.join(__dirname, '../solana/target/deploy/savings_core-keypair.json');

    if (!fs.existsSync(programKeypairPath)) {
      console.log("⚠️  Program keypair not found. Run 'anchor build' first.");
      return;
    }

    const programKeypair = JSON.parse(fs.readFileSync(programKeypairPath, 'utf8'));

    // Convert keypair to PublicKey
    const { PublicKey } = require('@solana/web3.js');
    const programId = new PublicKey(programKeypair).toString();

    // Read Anchor.toml to get network configuration
    const anchorTomlPath = path.join(__dirname, '../solana/Anchor.toml');
    let network = 'localnet'; // default

    if (fs.existsSync(anchorTomlPath)) {
      const anchorToml = fs.readFileSync(anchorTomlPath, 'utf8');
      const clusterMatch = anchorToml.match(/cluster\s*=\s*"([^"]+)"/);
      if (clusterMatch) {
        network = clusterMatch[1];
      }
    }

    // Determine RPC endpoint based on network
    const endpoints = {
      localnet: "http://127.0.0.1:8899",
      devnet: "https://api.devnet.solana.com",
      mainnet: "https://api.mainnet-beta.solana.com",
    };

    // Create address configuration
    const addressConfig = {
      programId: programId,
      network: network,
      endpoint: endpoints[network] || endpoints.localnet,
      deployedAt: new Date().toISOString(),
      // Add any additional configuration needed by your frontend
      accounts: {
        // This will be populated as we add more program accounts
      }
    };

    // Write to frontend
    const frontendPath = path.join(__dirname, '../frontend/src/solanaAddresses.json');
    fs.writeFileSync(frontendPath, JSON.stringify(addressConfig, null, 2));

    console.log("✅ Updated Solana addresses in frontend");
    console.log("📍 Program ID:", programId);
    console.log("🌐 Network:", network);
    console.log("📁 File:", frontendPath);

  } catch (error) {
    console.error("❌ Failed to update Solana addresses:", error.message);
    throw error;
  }
}

// Allow this to be called from other scripts
module.exports = { updateSolanaAddresses };

// Run if called directly
if (require.main === module) {
  updateSolanaAddresses()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}