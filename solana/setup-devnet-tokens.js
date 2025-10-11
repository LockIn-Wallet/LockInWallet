#!/usr/bin/env node

const {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');

const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount
} = require('@solana/spl-token');

const fs = require('fs');
const path = require('path');

// Use your actual wallet address from devnet
const USER_ADDRESS = '4xo6a3qHYgtsDkKUAy1wMQhyN1zoXo3tKPR5foxa3hV4'; // Your devnet wallet
const RPC_URL = 'https://api.devnet.solana.com';

async function setupDevnetTokens() {
  try {
    console.log('🚀 Setting up Solana devnet test tokens...');

    // Connect to devnet
    console.log('Connecting to devnet...');
    const connection = new Connection(RPC_URL, 'confirmed');
    try {
      await connection.getVersion();
      console.log('✅ Connected to devnet!');
    } catch (error) {
      console.error('❌ Cannot connect to devnet:', error.message);
      throw error;
    }

    // Create user public key
    const userPublicKey = new PublicKey(USER_ADDRESS);

    // Load the main wallet keypair (the one with SOL for deployment)
    const walletKeypairPath = path.join(process.env.HOME, '.config', 'solana', 'id.json');
    const walletKeypairData = JSON.parse(fs.readFileSync(walletKeypairPath, 'utf8'));
    const walletKeypair = Keypair.fromSecretKey(new Uint8Array(walletKeypairData));

    console.log('📝 Using wallet:', walletKeypair.publicKey.toString());
    console.log('📝 Target user:', userPublicKey.toString());

    // Check SOL balance
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.5 * LAMPORTS_PER_SOL) {
      console.error('❌ Insufficient SOL balance for token creation. Need at least 0.5 SOL');
      throw new Error('Insufficient balance');
    }

    // Create USDT token mint with 6 decimals (standard for USDT)
    console.log('📝 Creating USDT token mint...');
    const usdtMint = await createMint(
      connection,
      walletKeypair, // payer
      walletKeypair.publicKey, // mint authority
      null, // freeze authority (none)
      6 // decimals
    );

    console.log('✅ USDT Token Mint created:', usdtMint.toString());

    // Create token account for the user
    console.log(`📝 Creating token account for ${userPublicKey.toString()}...`);
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      walletKeypair, // payer
      usdtMint,
      userPublicKey
    );

    console.log('✅ Token account created:', userTokenAccount.address.toString());

    // Mint 1,000,000 test USDT tokens (1,000,000 * 10^6 due to 6 decimals)
    console.log('📝 Minting 1,000,000 test USDT tokens...');
    await mintTo(
      connection,
      walletKeypair, // payer
      usdtMint,
      userTokenAccount.address,
      walletKeypair.publicKey, // mint authority
      1_000_000 * Math.pow(10, 6) // 1M tokens with 6 decimals
    );

    // Verify balance
    const tokenAccount = await getAccount(connection, userTokenAccount.address);
    const tokenBalance = Number(tokenAccount.amount) / Math.pow(10, 6);
    console.log(`💰 USDT Balance: ${tokenBalance.toLocaleString()} USDT`);

    // Save mint authority and token info for future operations
    const mintAuthorityPath = path.join(__dirname, '..', 'frontend', 'src', 'devnetMintAuthority.json');
    const mintAuthorityData = {
      secretKey: Array.from(walletKeypair.secretKey),
      publicKey: walletKeypair.publicKey.toString(),
      mintAddress: usdtMint.toString(),
      network: 'devnet',
      created: new Date().toISOString()
    };

    fs.writeFileSync(mintAuthorityPath, JSON.stringify(mintAuthorityData, null, 2));
    console.log('🔑 Mint authority saved to:', mintAuthorityPath);
    console.log('⚠️  WARNING: This file contains private keys! Only for devnet testing!');

    // Update token configuration
    const tokenConfigPath = path.join(__dirname, '..', 'frontend', 'src', 'devnetTokens.json');
    const tokenConfig = {
      network: 'devnet',
      endpoint: RPC_URL,
      tokens: {
        USDT: {
          mint: usdtMint.toString(),
          decimals: 6,
          symbol: 'USDT',
          name: 'Test USDT (Devnet)',
          userTokenAccount: userTokenAccount.address.toString()
        }
      },
      userAddress: userPublicKey.toString(),
      created: new Date().toISOString()
    };

    fs.writeFileSync(tokenConfigPath, JSON.stringify(tokenConfig, null, 2));
    console.log('✅ Token config saved to:', tokenConfigPath);

    // Update frontend App.js with new USDT mint address
    const appJsPath = path.join(__dirname, '..', 'frontend', 'src', 'App.js');
    if (fs.existsSync(appJsPath)) {
      console.log('📝 Updating frontend App.js with new USDT mint address...');
      let appJsContent = fs.readFileSync(appJsPath, 'utf8');

      // Find and update the devnet USDT configuration (now using address field)
      const devnetUsdtRegex = /(devnet:\s*{[\s\S]*?USDT:\s*{[\s\S]*?address:\s*)"[^"]*"/;
      if (devnetUsdtRegex.test(appJsContent)) {
        appJsContent = appJsContent.replace(devnetUsdtRegex, `$1"${usdtMint.toString()}"`);
        fs.writeFileSync(appJsPath, appJsContent);
        console.log('✅ Updated devnet USDT address:', usdtMint.toString());
      } else {
        console.log('⚠️  Could not find devnet USDT configuration in App.js');
      }

      // Also update localhost USDT configuration if present
      const localhostUsdtRegex = /(localhost:\s*{[\s\S]*?USDT:\s*{[\s\S]*?address:\s*)"[^"]*"/;
      if (localhostUsdtRegex.test(appJsContent)) {
        // Keep localhost as-is, just log that we found it
        console.log('ℹ️  Found localhost USDT configuration, keeping unchanged');
      }

      console.log('✅ Frontend App.js updated with new token address:', usdtMint.toString());
    }

    console.log('\n🎉 Solana devnet tokens setup complete!');
    console.log('📋 Summary:');
    console.log('   USDT Mint Address:', usdtMint.toString());
    console.log('   Mint Authority:', walletKeypair.publicKey.toString());
    console.log('   User Token Account:', userTokenAccount.address.toString());
    console.log('   User Address:', userPublicKey.toString());
    console.log('   USDT Balance:', `${tokenBalance.toLocaleString()} USDT`);
    console.log('   SOL Balance:', `${balance / LAMPORTS_PER_SOL} SOL`);
    console.log('   Network: devnet');

  } catch (error) {
    console.error('❌ Error setting up devnet tokens:', error);
    process.exit(1);
  }
}

// Run the setup
setupDevnetTokens();