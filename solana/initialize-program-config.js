#!/usr/bin/env node

const {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');

const fs = require('fs');
const path = require('path');

const RPC_URL = 'http://127.0.0.1:8899';
const DEPLOYER_ADDRESS = '4xo6a3qHYgtsDkKUAy1wMQhyN1zoXo3tKPR5foxa3hV4';
const ACTIVATION_FEE_SOL = 0.1; // 0.1 SOL = ~$5 USD

// Read program ID from keypair file
function readProgramId() {
  try {
    const keypairPath = path.join(__dirname, 'target/deploy/savings_core-keypair.json');
    if (!fs.existsSync(keypairPath)) {
      throw new Error(`Program keypair not found at: ${keypairPath}`);
    }

    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    return keypair.publicKey;
  } catch (error) {
    console.error('❌ Error reading program ID:', error.message);
    throw error;
  }
}

// Initialize program configuration
async function initializeProgramConfig() {
  try {
    console.log('🚀 Initializing Solana program configuration...');

    // Connect to validator
    const connection = new Connection(RPC_URL, 'confirmed');
    try {
      await connection.getVersion();
      console.log('✅ Connected to Solana validator');
    } catch (error) {
      console.error('❌ Cannot connect to Solana validator:', error.message);
      throw error;
    }

    // Read program ID from deployment
    const programId = readProgramId();
    console.log('📋 Program ID:', programId.toString());

    // Create deployer keypair (admin)
    const adminKeypair = Keypair.generate();

    // Airdrop SOL to admin for transaction fees
    console.log('📝 Requesting SOL airdrop for admin...');
    const adminAirdrop = await connection.requestAirdrop(adminKeypair.publicKey, 1 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(adminAirdrop);
    console.log('✅ Admin funded with SOL for transaction fees');

    // Derive program config PDA
    const [programConfigPDA, programConfigBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('program_config')],
      programId
    );
    console.log('🔑 Program Config PDA:', programConfigPDA.toString());

    // Treasury address (deployer)
    const treasuryAddress = new PublicKey(DEPLOYER_ADDRESS);
    console.log('🏦 Treasury Address:', treasuryAddress.toString());

    // Fee amount in lamports
    const feeInLamports = ACTIVATION_FEE_SOL * LAMPORTS_PER_SOL;
    console.log('💰 Activation Fee:', `${ACTIVATION_FEE_SOL} SOL (${feeInLamports} lamports)`);

    // Check if program config already exists
    try {
      const existingAccount = await connection.getAccountInfo(programConfigPDA);
      if (existingAccount && existingAccount.data.length > 0) {
        console.log('⚠️  Program config already initialized');
        console.log('✅ Program configuration ready for user payments');
        return;
      }
    } catch (error) {
      // Account doesn't exist yet, continue with initialization
    }

    // Build initialization instruction
    const discriminator = Buffer.from([6, 131, 61, 237, 40, 110, 83, 124]); // InitializeProgramConfig

    // Serialize fee amount as little-endian u64
    const feeBuffer = Buffer.allocUnsafe(8);
    feeBuffer.writeBigUInt64LE(BigInt(feeInLamports), 0);

    const instructionData = Buffer.concat([discriminator, feeBuffer]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: programConfigPDA, isSigner: false, isWritable: true },      // program_config
        { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true }, // admin (payer)
        { pubkey: treasuryAddress, isSigner: false, isWritable: false },      // treasury_address
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // system_program
      ],
      programId: programId,
      data: instructionData
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);

    console.log('📤 Sending program config initialization transaction...');
    const txHash = await sendAndConfirmTransaction(
      connection,
      transaction,
      [adminKeypair],
      { commitment: 'confirmed' }
    );

    console.log('✅ Program configuration initialized successfully!');
    console.log('🔗 Transaction Hash:', txHash);
    console.log('');
    console.log('📋 Configuration Summary:');
    console.log(`   Program ID: ${programId.toString()}`);
    console.log(`   Config PDA: ${programConfigPDA.toString()}`);
    console.log(`   Treasury: ${treasuryAddress.toString()}`);
    console.log(`   Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`   Activation Fee: ${ACTIVATION_FEE_SOL} SOL`);
    console.log('');
    console.log('🎉 Users can now pay activation fees and generate permanent addresses!');

  } catch (error) {
    console.error('❌ Error initializing program config:', error.message);
    if (error.logs) {
      console.error('📜 Transaction logs:', error.logs);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeProgramConfig().catch(console.error);
}

module.exports = { initializeProgramConfig };