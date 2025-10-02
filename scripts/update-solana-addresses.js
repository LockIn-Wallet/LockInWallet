const fs = require('fs');
const path = require('path');

async function updateSolanaAddresses() {
  console.log("🔄 Updating Solana addresses in frontend...");

  try {
    // Read program ID from IDL (more reliable than keypair)
    const idlPath = path.join(__dirname, '../solana/target/idl/savings_core.json');

    if (!fs.existsSync(idlPath)) {
      console.log("⚠️  IDL not found. Run 'anchor build' first.");
      return;
    }

    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    const programId = idl.address;

    if (!programId) {
      console.log("⚠️  No program address found in IDL.");
      return;
    }

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

    // Write to frontend JSON file
    const frontendPath = path.join(__dirname, '../frontend/src/solanaAddresses.json');
    fs.writeFileSync(frontendPath, JSON.stringify(addressConfig, null, 2));

    // Update SolanaAdapter.js
    const adapterPath = path.join(__dirname, '../frontend/src/adapters/SolanaAdapter.js');
    if (fs.existsSync(adapterPath)) {
      let adapterContent = fs.readFileSync(adapterPath, 'utf8');
      const adapterRegex = /this\.PROGRAM_ID = new PublicKey\("[^"]+"\);[^\n]*/;
      const adapterReplacement = `this.PROGRAM_ID = new PublicKey("${programId}"); // Updated ${new Date().toISOString().split('T')[0]}`;

      if (adapterRegex.test(adapterContent)) {
        adapterContent = adapterContent.replace(adapterRegex, adapterReplacement);
        fs.writeFileSync(adapterPath, adapterContent, 'utf8');
        console.log("✅ Updated SolanaAdapter.js program ID");
      }
    }

    // Update App.js program IDs
    const appPath = path.join(__dirname, '../frontend/src/App.js');
    if (fs.existsSync(appPath)) {
      let appContent = fs.readFileSync(appPath, 'utf8');
      const appRegex = /programId: "[^"]+"/g;
      const appReplacement = `programId: "${programId}"`;

      if (appRegex.test(appContent)) {
        appContent = appContent.replace(appRegex, appReplacement);
        fs.writeFileSync(appPath, appContent, 'utf8');
        console.log("✅ Updated App.js program IDs");
      }
    }

    // Copy IDL to frontend with size property fixes for Anchor 0.31.1 compatibility
    const idlSourcePath = path.join(__dirname, '../solana/target/idl/savings_core.json');
    const idlDestPath = path.join(__dirname, '../frontend/src/savings_core.json');
    if (fs.existsSync(idlSourcePath)) {
      const sourceIdl = JSON.parse(fs.readFileSync(idlSourcePath, 'utf8'));

      // Fix IDL compatibility: Ensure proper account definition format for frontend
      if (sourceIdl.accounts) {
        sourceIdl.accounts.forEach(account => {
          if (account.name === 'SavingsAccount') {
            // Ensure complete account definition for compatibility
            if (!account.size) {
              account.size = 469;
              console.log(`📏 Added size property to ${account.name} in accounts: ${account.size} bytes`);
            }
            // Some versions expect type property in accounts section
            if (!account.type) {
              // Find the corresponding type definition
              const typeDefinition = sourceIdl.types?.find(t => t.name === account.name);
              if (typeDefinition) {
                account.type = JSON.parse(JSON.stringify(typeDefinition.type)); // Deep copy
                console.log(`📋 Added type definition to ${account.name} in accounts section`);
              }
            }

            // Fix vector types in accounts section too
            if (account.type && account.type.fields) {
              account.type.fields.forEach(field => {
                if (field.type && field.type.vec && field.type.vec.defined) {
                  const typeName = field.type.vec.defined.name;
                  field.type = { "vec": typeName };
                  console.log(`🔧 Fixed vector type in accounts section for field ${field.name}: vec<${typeName}>`);
                }
              });
            }
          }
        });
      }

      // Also add size to types section for compatibility
      if (sourceIdl.types) {
        sourceIdl.types.forEach(type => {
          if (type.name === 'SavingsAccount' && type.type && type.type.kind === 'struct' && !type.size) {
            type.size = 469;
            console.log(`📏 Added size property to ${type.name} in types: ${type.size} bytes`);
          }

          // Fix vector type definitions for Anchor 0.29.0 compatibility
          if (type.type && type.type.fields) {
            type.type.fields.forEach(field => {
              if (field.type && field.type.vec && field.type.vec.defined) {
                // Convert new format: {"vec": {"defined": {"name": "TokenBalance"}}}
                // To old format: {"vec": "TokenBalance"}
                const typeName = field.type.vec.defined.name;
                field.type = { "vec": typeName };
                console.log(`🔧 Fixed vector type for field ${field.name}: vec<${typeName}>`);
              }
            });
          }
        });
      }

      fs.writeFileSync(idlDestPath, JSON.stringify(sourceIdl, null, 2));
      console.log("✅ Updated frontend IDL file with compatibility fixes");
    }

    console.log("");
    console.log("🎉 Frontend update completed successfully!");
    console.log("📍 Program ID:", programId);
    console.log("🌐 Network:", network);
    console.log("📁 Files updated:");
    console.log("  - solanaAddresses.json");
    console.log("  - adapters/SolanaAdapter.js");
    console.log("  - App.js");
    console.log("  - savings_core.json (IDL)");
    console.log("");
    console.log("🔄 Next steps:");
    console.log("  1. Refresh your browser to load the updated code");
    console.log("  2. Test your deposit/withdrawal functions");

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