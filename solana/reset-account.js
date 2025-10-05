const { Connection, PublicKey, Keypair, SystemProgram, Transaction } = require('@solana/web3.js');
const fs = require('fs');

async function resetSpendingLimitsAccount() {
  try {
    // Connect to local validator
    const connection = new Connection('http://127.0.0.1:8899', 'confirmed');

    // Use the browser wallet address from the logs
    const browserWalletAddress = '4xo6a3qHYgtsDkKUAy1wMQhyN1zoXo3tKPR5foxa3hV4';
    const browserWalletPubkey = new PublicKey(browserWalletAddress);

    // Load CLI wallet for signing (needs SOL for transaction fees)
    const walletPath = process.env.HOME + '/.config/solana/id.json';
    const walletKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    console.log('🔑 Target wallet address:', browserWalletAddress);
    console.log('🔑 CLI wallet (for fees):', walletKeypair.publicKey.toString());

    // Calculate the spending limits PDA for the browser wallet
    const PROGRAM_ID = new PublicKey('HNi2JKTNeHvz2ENckdVBW1ncfkJUYppuYeBwNhWjkK7d');
    const [spendingLimitsPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('spending_limits'), browserWalletPubkey.toBuffer()],
      PROGRAM_ID
    );

    console.log('🔑 Spending Limits PDA:', spendingLimitsPDA.toString());

    // Check if account exists
    const accountInfo = await connection.getAccountInfo(spendingLimitsPDA);
    if (!accountInfo) {
      console.log('✅ Account does not exist - already reset!');
      return;
    }

    console.log('📊 Account exists with data length:', accountInfo.data.length);
    console.log('💰 Account lamports:', accountInfo.lamports);

    // Create instruction to close the account by transferring lamports to wallet
    const closeInstruction = SystemProgram.transfer({
      fromPubkey: spendingLimitsPDA,
      toPubkey: walletKeypair.publicKey,
      lamports: accountInfo.lamports,
    });

    // This won't work directly because we need the program to close it
    // Instead, let's try to get current SOL balance first
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log('💰 Current wallet balance:', balance / 1e9, 'SOL');

    console.log('⚠️  Account exists but cannot be closed directly.');
    console.log('🔧 Options:');
    console.log('1. Use a different wallet address (new PDA)');
    console.log('2. Add a reset function to the Solana program');
    console.log('3. Manually change wallet keypair to get fresh PDA');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

resetSpendingLimitsAccount();