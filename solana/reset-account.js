const { Connection, PublicKey, Keypair, SystemProgram, Transaction } = require('@solana/web3.js');
const fs = require('fs');

async function resetSpendingLimitsAccount() {
  try {
    // Connect to local validator
    const connection = new Connection('http://127.0.0.1:8899', 'confirmed');

    // Load wallet keypair (adjust path as needed)
    const walletPath = process.env.HOME + '/.config/solana/id.json';
    const walletKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    console.log('🔑 Wallet address:', walletKeypair.publicKey.toString());

    // Calculate the spending limits PDA
    const PROGRAM_ID = new PublicKey('HNi2JKTNeHvz2ENckdVBW1ncfkJUYppuYeBwNhWjkK7d');
    const [spendingLimitsPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('spending_limits'), walletKeypair.publicKey.toBuffer()],
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