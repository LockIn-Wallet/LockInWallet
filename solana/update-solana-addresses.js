const fs = require('fs');
const path = require('path');

async function updateSolanaAddresses() {
  console.log("🔄 Updating Solana addresses in frontend...");

  try {
    // Read savings-core program ID from IDL
    const savingsIdlPath = path.join(__dirname, './target/idl/savings_core.json');
    const proxyIdlPath = path.join(__dirname, './target/idl/deposit_proxy.json');

    if (!fs.existsSync(savingsIdlPath)) {
      console.log("⚠️  Savings core IDL not found. Run 'anchor build' first.");
      return;
    }

    if (!fs.existsSync(proxyIdlPath)) {
      console.log("⚠️  Deposit proxy IDL not found. Run 'anchor build' first.");
      return;
    }

    const savingsIdl = JSON.parse(fs.readFileSync(savingsIdlPath, 'utf8'));
    const proxyIdl = JSON.parse(fs.readFileSync(proxyIdlPath, 'utf8'));

    const savingsProgramId = savingsIdl.address;
    const proxyProgramId = proxyIdl.address;

    if (!savingsProgramId || !proxyProgramId) {
      console.log("⚠️  No program address found in IDLs.");
      return;
    }

    console.log(`📋 Savings Program ID: ${savingsProgramId}`);
    console.log(`📋 Deposit Proxy Program ID: ${proxyProgramId}`);

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
      savingsCore: {
        programId: savingsProgramId,
        name: "Savings Core Program"
      },
      depositProxy: {
        programId: proxyProgramId,
        name: "Deposit Proxy Program"
      },
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

    // Generate instruction discriminators
    const crypto = require('crypto');
    function sha256(data) {
      return crypto.createHash('sha256').update(data).digest();
    }

    const discriminators = {
      // Savings Core Program (these should be stable)
      Initialize: Array.from(sha256('global:initialize').slice(0, 8)),
      DepositSol: Array.from(sha256('global:deposit_sol').slice(0, 8)),
      DepositSpl: Array.from(sha256('global:deposit_spl').slice(0, 8)),
      DepositSolSelf: Array.from(sha256('global:deposit_sol_self').slice(0, 8)),
      DepositSplSelf: Array.from(sha256('global:deposit_spl_self').slice(0, 8)),
      WithdrawSol: Array.from(sha256('global:withdraw_sol').slice(0, 8)),
      WithdrawSpl: Array.from(sha256('global:withdraw_spl').slice(0, 8)),

      // Deposit Proxy Program (generated dynamically)
      InitializeProxy: Array.from(sha256('global:initialize_proxy').slice(0, 8)),
      ForwardSolDeposit: Array.from(sha256('global:forward_sol_deposit').slice(0, 8)),
      ForwardSplDeposit: Array.from(sha256('global:forward_spl_deposit').slice(0, 8))
    };

    console.log("🔢 Generated instruction discriminators:");
    Object.entries(discriminators).forEach(([name, disc]) => {
      console.log(`  ${name}: [${disc.join(', ')}]`);
    });

    // Update SolanaAdapter.js with both program IDs and discriminators
    const adapterPath = path.join(__dirname, '../frontend/src/adapters/SolanaAdapter.js');
    if (fs.existsSync(adapterPath)) {
      let adapterContent = fs.readFileSync(adapterPath, 'utf8');

      // Update savings core program ID
      const savingsRegex = /this\.PROGRAM_ID = new PublicKey\("[^"]+"\);[^\n]*/;
      const savingsReplacement = `this.PROGRAM_ID = new PublicKey("${savingsProgramId}"); // Updated ${new Date().toISOString().split('T')[0]}`;

      // Update deposit proxy program ID
      const proxyRegex = /this\.DEPOSIT_PROXY_PROGRAM_ID = new PublicKey\("[^"]+"\);[^\n]*/;
      const proxyReplacement = `this.DEPOSIT_PROXY_PROGRAM_ID = new PublicKey("${proxyProgramId}"); // Updated ${new Date().toISOString().split('T')[0]}`;

      // Update instruction discriminators
      const discriminatorRegex = /const INSTRUCTION_DISCRIMINATORS = \{[\s\S]*?\};/;
      const discriminatorReplacement = `const INSTRUCTION_DISCRIMINATORS = {
  // Savings Core Program
  Initialize: [${discriminators.Initialize.join(', ')}],
  DepositSol: [${discriminators.DepositSol.join(', ')}],
  DepositSpl: [${discriminators.DepositSpl.join(', ')}],
  DepositSolSelf: [${discriminators.DepositSolSelf.join(', ')}],
  DepositSplSelf: [${discriminators.DepositSplSelf.join(', ')}],
  WithdrawSol: [${discriminators.WithdrawSol.join(', ')}],
  WithdrawSpl: [${discriminators.WithdrawSpl.join(', ')}],

  // Deposit Proxy Program (auto-generated on ${new Date().toISOString().split('T')[0]})
  InitializeProxy: [${discriminators.InitializeProxy.join(', ')}],
  ForwardSolDeposit: [${discriminators.ForwardSolDeposit.join(', ')}],
  ForwardSplDeposit: [${discriminators.ForwardSplDeposit.join(', ')}]
};`;

      if (savingsRegex.test(adapterContent)) {
        adapterContent = adapterContent.replace(savingsRegex, savingsReplacement);
        console.log("✅ Updated SolanaAdapter.js savings core program ID");
      } else {
        console.log("⚠️  Could not find savings core program ID pattern in SolanaAdapter.js");
      }

      if (proxyRegex.test(adapterContent)) {
        adapterContent = adapterContent.replace(proxyRegex, proxyReplacement);
        console.log("✅ Updated SolanaAdapter.js deposit proxy program ID");
      } else {
        console.log("⚠️  Could not find deposit proxy program ID pattern in SolanaAdapter.js");
      }

      if (discriminatorRegex.test(adapterContent)) {
        adapterContent = adapterContent.replace(discriminatorRegex, discriminatorReplacement);
        console.log("✅ Updated SolanaAdapter.js instruction discriminators");
      } else {
        console.log("⚠️  Could not find instruction discriminators pattern in SolanaAdapter.js");
      }

      fs.writeFileSync(adapterPath, adapterContent, 'utf8');
    } else {
      console.log("⚠️  SolanaAdapter.js not found");
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
    console.log("📍 Savings Program ID:", savingsProgramId);
    console.log("📍 Deposit Proxy Program ID:", proxyProgramId);
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