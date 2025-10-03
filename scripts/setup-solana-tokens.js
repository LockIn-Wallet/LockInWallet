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

const USER_ADDRESS = '4xo6a3qHYgtsDkKUAy1wMQhyN1zoXo3tKPR5foxa3hV4';
const RPC_URL = 'http://127.0.0.1:8899';

async function setupTokens() {
  try {
    console.log('🚀 Setting up Solana test tokens...');

    // Connect directly to existing validator (assume it's running from deployment script)
    console.log('Connecting to existing validator...');
    const connection = new Connection(RPC_URL, 'confirmed');
    try {
      await connection.getVersion();
      console.log('✅ Connected to existing validator!');
    } catch (error) {
      console.error('❌ Cannot connect to existing validator:', error.message);
      throw error;
    }

    // Create user public key
    const userPublicKey = new PublicKey(USER_ADDRESS);

    // Create a mint authority keypair (we'll save this for token operations)
    const mintAuthority = Keypair.generate();

    // Create a payer keypair for transaction fees
    const payer = Keypair.generate();

    // Airdrop SOL to payer, mint authority, and user for transaction fees
    console.log('📝 Requesting SOL airdrop for transaction fees...');
    const payerAirdrop = await connection.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL);
    const mintAuthorityAirdrop = await connection.requestAirdrop(mintAuthority.publicKey, 1 * LAMPORTS_PER_SOL);
    const userAirdrop = await connection.requestAirdrop(userPublicKey, 10 * LAMPORTS_PER_SOL); // 10 SOL for user wallet

    await connection.confirmTransaction(payerAirdrop);
    await connection.confirmTransaction(mintAuthorityAirdrop);
    await connection.confirmTransaction(userAirdrop);
    console.log('✅ Airdrops completed (including 10 SOL to user wallet)');

    // Create USDT token mint (6 decimals like real USDT)
    console.log('📝 Creating USDT token mint...');
    const usdtMint = await createMint(
      connection,
      payer,                    // payer (for transaction fees)
      mintAuthority.publicKey,  // mint authority (generated keypair)
      mintAuthority.publicKey,  // freeze authority (generated keypair)
      6                         // decimals
    );

    console.log(`✅ USDT Token Mint created: ${usdtMint.toString()}`);

    // Create associated token account for user
    console.log(`📝 Creating token account for ${USER_ADDRESS}...`);
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      usdtMint,
      userPublicKey
    );

    console.log(`✅ Token account created: ${userTokenAccount.address.toString()}`);

    // Mint 1,000,000 USDT (with 6 decimals) to user account
    console.log('📝 Minting 1,000,000 test USDT tokens...');
    await mintTo(
      connection,
      payer,                    // payer (for transaction fees)
      usdtMint,
      userTokenAccount.address,
      mintAuthority,            // mint authority (has signing capability)
      1000000 * (10 ** 6)       // 1M USDT with 6 decimals
    );

    console.log('✅ Tokens minted successfully!');

    // Check balance
    const accountInfo = await getAccount(connection, userTokenAccount.address);
    const balance = Number(accountInfo.amount) / (10 ** 6);
    console.log(`💰 USDT Balance: ${balance.toLocaleString()} USDT`);

    // Save token addresses to frontend config
    const tokenConfig = {
      solanaTokens: {
        usdtMint: usdtMint.toString(),
        userTokenAccount: userTokenAccount.address.toString(),
        userAddress: USER_ADDRESS,
        mintAuthority: mintAuthority.publicKey.toString(),
        balance: balance,
        createdAt: new Date().toISOString()
      }
    };

    // Also save the mint authority keypair for future operations (LOCAL DEV ONLY!)
    const mintAuthorityConfig = {
      publicKey: mintAuthority.publicKey.toString(),
      secretKey: Array.from(mintAuthority.secretKey)
    };

    const mintAuthorityPath = path.join(__dirname, '../frontend/src/mintAuthority.json');
    fs.writeFileSync(mintAuthorityPath, JSON.stringify(mintAuthorityConfig, null, 2));
    console.log(`🔑 Mint authority saved to: ${mintAuthorityPath} (DEV ONLY!)`);
    console.log(`⚠️  WARNING: This file contains private keys! Only for local development!`);

    const configPath = path.join(__dirname, '../frontend/src/solanaTokens.json');
    fs.writeFileSync(configPath, JSON.stringify(tokenConfig, null, 2));
    console.log(`✅ Token config saved to: ${configPath}`);

    // Auto-update the frontend App.js with new mint address
    console.log('📝 Updating frontend App.js with new USDT mint address...');
    const appJsPath = path.join(__dirname, '../frontend/src/App.js');
    let appJsContent = fs.readFileSync(appJsPath, 'utf8');

    // Replace the USDT mint address in the Solana localhost configuration
    const oldMintRegex = /mint: "[\w\d]+".*?\/\/ Test USDT mint address/;
    const newMintLine = `mint: "${usdtMint.toString()}", // Test USDT mint address`;

    if (oldMintRegex.test(appJsContent)) {
      appJsContent = appJsContent.replace(oldMintRegex, newMintLine);
      fs.writeFileSync(appJsPath, appJsContent);
      console.log(`✅ Frontend App.js updated with new mint address: ${usdtMint.toString()}`);
    } else {
      console.log('⚠️  Could not find USDT mint address pattern in App.js to update');
    }

    // Check user SOL balance
    const userSolBalance = await connection.getBalance(userPublicKey);
    const solBalanceFormatted = (userSolBalance / LAMPORTS_PER_SOL).toFixed(2);

    console.log('\n🎉 Solana tokens setup complete!');
    console.log(`📋 Summary:`);
    console.log(`   USDT Mint Address: ${usdtMint.toString()}`);
    console.log(`   Mint Authority: ${mintAuthority.publicKey.toString()}`);
    console.log(`   User Token Account: ${userTokenAccount.address.toString()}`);
    console.log(`   User Address: ${USER_ADDRESS}`);
    console.log(`   USDT Balance: ${balance.toLocaleString()} USDT`);
    console.log(`   SOL Balance: ${solBalanceFormatted} SOL`);

  } catch (error) {
    console.error('❌ Error setting up tokens:', error.message);
    console.error(error);
    process.exit(1);
  }
}

setupTokens();