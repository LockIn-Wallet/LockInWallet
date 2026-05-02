#!/usr/bin/env node

const {
  Connection,
  PublicKey,
  Keypair,
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
const MINT_AMOUNT = 1_000_000;
const SOL_AIRDROP = 100;

const TOKENS_TO_CREATE = [
  { key: 'USDT', symbol: 'USDT', name: 'Test USDT', decimals: 6 },
  { key: 'USDC', symbol: 'USDC', name: 'Test USDC', decimals: 6 },
  { key: 'DAI',  symbol: 'DAI',  name: 'Test DAI',  decimals: 6 },
];

async function setupTokens() {
  try {
    console.log('🚀 Setting up Solana test tokens...');

    const connection = new Connection(RPC_URL, 'confirmed');
    try {
      await connection.getVersion();
      console.log('✅ Connected to validator');
    } catch (error) {
      console.error('❌ Cannot connect to validator:', error.message);
      throw error;
    }

    const userPublicKey = new PublicKey(USER_ADDRESS);
    const payer = Keypair.generate();
    const mintAuthority = Keypair.generate();

    // Airdrop SOL to payer, mint authority, and user
    console.log(`📝 Airdropping SOL (${SOL_AIRDROP} to user, 5 to payer)...`);
    const payerAirdrop = await connection.requestAirdrop(payer.publicKey, 5 * LAMPORTS_PER_SOL);
    const mintAirdrop = await connection.requestAirdrop(mintAuthority.publicKey, 1 * LAMPORTS_PER_SOL);
    const userAirdrop = await connection.requestAirdrop(userPublicKey, SOL_AIRDROP * LAMPORTS_PER_SOL);

    await connection.confirmTransaction(payerAirdrop);
    await connection.confirmTransaction(mintAirdrop);
    await connection.confirmTransaction(userAirdrop);
    console.log(`✅ Airdrops completed (${SOL_AIRDROP} SOL to user wallet)`);

    const createdTokens = {};

    for (const tokenDef of TOKENS_TO_CREATE) {
      console.log(`\n📝 Creating ${tokenDef.symbol} token mint (${tokenDef.decimals} decimals)...`);

      const mint = await createMint(
        connection,
        payer,
        mintAuthority.publicKey,
        mintAuthority.publicKey,
        tokenDef.decimals
      );
      console.log(`   Mint: ${mint.toString()}`);

      const userATA = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        userPublicKey
      );

      // SPL token amounts are u64 (max ~1.8e19). For 18-decimal tokens, batch to stay within u64.
      const maxU64 = BigInt("18446744073709551615");
      const rawTotal = BigInt(MINT_AMOUNT) * (BigInt(10) ** BigInt(tokenDef.decimals));
      if (rawTotal <= maxU64) {
        await mintTo(connection, payer, mint, userATA.address, mintAuthority, rawTotal);
      } else {
        const batchAmount = maxU64 / BigInt(2);
        let remaining = rawTotal;
        while (remaining > BigInt(0)) {
          const chunk = remaining > batchAmount ? batchAmount : remaining;
          await mintTo(connection, payer, mint, userATA.address, mintAuthority, chunk);
          remaining -= chunk;
        }
      }

      const accountInfo = await getAccount(connection, userATA.address);
      const balance = Number(accountInfo.amount / (BigInt(10) ** BigInt(tokenDef.decimals)));
      console.log(`   ✅ ${balance.toLocaleString()} ${tokenDef.symbol} minted to user`);

      createdTokens[tokenDef.key] = {
        address: mint.toString(),
        symbol: tokenDef.symbol,
        name: tokenDef.name,
        decimals: tokenDef.decimals,
        recommended: true,
        userTokenAccount: userATA.address.toString(),
      };
    }

    // Save mint authority for future operations (LOCAL DEV ONLY)
    const mintAuthorityConfig = {
      publicKey: mintAuthority.publicKey.toString(),
      secretKey: Array.from(mintAuthority.secretKey)
    };
    const mintAuthorityPath = path.join(__dirname, '../frontend/src/mintAuthority.json');
    fs.writeFileSync(mintAuthorityPath, JSON.stringify(mintAuthorityConfig, null, 2));
    console.log(`\n🔑 Mint authority saved to: ${mintAuthorityPath} (DEV ONLY!)`);

    // Update frontend networkConfig.json with new mint addresses
    console.log('📝 Updating frontend networkConfig.json...');
    const networkConfigPath = path.join(__dirname, '../frontend/src/networkConfig.json');

    let networkConfig;
    try {
      networkConfig = JSON.parse(fs.readFileSync(networkConfigPath, 'utf8'));
    } catch (error) {
      console.error('❌ Error reading networkConfig.json:', error.message);
      throw error;
    }

    const localhostTokens = networkConfig?.solana?.localhost?.tokens;
    if (localhostTokens) {
      for (const [key, tokenInfo] of Object.entries(createdTokens)) {
        const oldAddress = localhostTokens[key]?.address || '(none)';
        localhostTokens[key] = {
          ...localhostTokens[key],
          address: tokenInfo.address,
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          decimals: tokenInfo.decimals,
          recommended: true,
        };
        console.log(`   ${key}: ${oldAddress} → ${tokenInfo.address}`);
      }

      fs.writeFileSync(networkConfigPath, JSON.stringify(networkConfig, null, 2));
      console.log('✅ networkConfig.json updated');
    } else {
      console.log('⚠️  Could not find solana.localhost.tokens in networkConfig.json');
    }

    // Save token config for reference
    const tokenConfig = { solanaTokens: createdTokens, createdAt: new Date().toISOString() };
    const configPath = path.join(__dirname, '../frontend/src/solanaTokens.json');
    fs.writeFileSync(configPath, JSON.stringify(tokenConfig, null, 2));

    // Print summary
    const userSolBalance = await connection.getBalance(userPublicKey);
    console.log('\n🎉 Token setup complete!');
    console.log('📋 Summary:');
    console.log(`   User: ${USER_ADDRESS}`);
    console.log(`   SOL:  ${(userSolBalance / LAMPORTS_PER_SOL).toFixed(2)} SOL`);
    for (const [key, info] of Object.entries(createdTokens)) {
      console.log(`   ${key}: ${MINT_AMOUNT.toLocaleString()} ${info.symbol} (mint: ${info.address})`);
    }

  } catch (error) {
    console.error('❌ Error setting up tokens:', error.message);
    console.error(error);
    process.exit(1);
  }
}

setupTokens();
