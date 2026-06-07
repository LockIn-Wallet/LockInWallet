import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Buffer } from "buffer";
import bs58 from "bs58";
import { BlockchainAdapter } from "./BlockchainAdapter.js";

const PROGRAM_ID = new PublicKey(
  "9j511uJuYwoFRFiU1h5wy2oi1Xc8n1FdoK91QxoXHRh2"
);

const TREASURY_CONFIG = {
  localhost: "Aa1wdTb1h3NyRKVBZTahZhWBWMWKCS1bZgLJ7amVAzLd",
  devnet: "4xo6a3qHYgtsDkKUAy1wMQhyN1zoXo3tKPR5foxa3hV4",
  mainnet: "4xo6a3qHYgtsDkKUAy1wMQhyN1zoXo3tKPR5foxa3hV4",
};

// Instruction discriminators from the program IDL
const DISC = {
      'AddWithdrawalDestination': [22, 253, 18, 184, 234, 85, 147, 84],
      'CancelBypass': [232, 67, 164, 11, 244, 194, 195, 237],
      'CancelDestinationRequest': [255, 245, 78, 237, 53, 195, 7, 238],
      'CancelRuleChange': [91, 241, 197, 38, 185, 169, 36, 92],
      'ClaimPenaltyRewards': [51, 113, 194, 34, 228, 128, 172, 219],
      'ClaimSplPenaltyRewards': [11, 61, 48, 49, 152, 57, 163, 239],
      'CreateSplVault': [70, 237, 30, 3, 24, 231, 70, 67],
      'CreateVault': [29, 237, 247, 208, 193, 82, 54, 135],
      'DepositSol': [108, 81, 78, 117, 125, 155, 56, 200],
      'DepositSpl': [224, 0, 198, 175, 198, 47, 105, 204],
      'ExecuteBypassSol': [230, 35, 193, 232, 98, 192, 95, 77],
      'ExecuteBypassSpl': [66, 221, 128, 233, 134, 52, 197, 195],
      'ExecuteDestinationRequest': [95, 211, 0, 122, 188, 41, 61, 46],
      'ExecuteRuleChange': [84, 93, 44, 13, 64, 43, 176, 238],
      'InitializeProgramConfig': [6, 131, 61, 237, 40, 110, 83, 124],
      'JoinVault': [73, 225, 253, 176, 198, 180, 207, 152],
      'LeaveVault': [89, 198, 97, 6, 231, 152, 118, 242],
      'ProposeRuleChange': [242, 244, 60, 185, 100, 231, 68, 220],
      'RemoveWithdrawalDestination': [60, 84, 70, 83, 98, 9, 151, 106],
      'RequestBypass': [250, 5, 48, 228, 66, 2, 188, 184],
      'RequestWithdrawalDestination': [214, 192, 95, 236, 194, 244, 22, 196],
      'UpdateProgramConfig': [214, 3, 187, 98, 170, 106, 33, 45],
      'UpdateVaultRules': [195, 219, 47, 10, 219, 203, 75, 154],
      'WithdrawSol': [145, 131, 74, 136, 65, 137, 42, 38],
      'WithdrawSolWithPenalty': [240, 110, 162, 147, 195, 128, 43, 135],
      'WithdrawSpl': [181, 154, 94, 86, 62, 115, 6, 186],
      'WithdrawSplWithPenalty': [21, 196, 114, 73, 196, 90, 228, 178]
};

// Account discriminators for deserialization
const ACCOUNT_DISC = {
  Vault: [211, 8, 232, 43, 2, 152, 117, 119],
  VaultMember: [26, 195, 159, 142, 38, 12, 117, 218],
  ProgramConfig: [196, 210, 90, 231, 144, 149, 140, 63],
  WithdrawalDestination: [62, 214, 109, 21, 186, 251, 166, 109],
  PendingDestinationRequest: [86, 251, 149, 176, 60, 244, 117, 141],
  RuleChangeProposal: [68, 220, 255, 196, 232, 2, 46, 148],
  BypassRequest: [118, 86, 48, 68, 69, 64, 180, 78],
};

const VAULT_TYPE = { Personal: 0, Community: 1 };

// ========================================
// Borsh serialization helpers
// ========================================

function encodeString(str) {
  const encoded = new TextEncoder().encode(str);
  const buf = Buffer.alloc(4 + encoded.length);
  buf.writeUInt32LE(encoded.length, 0);
  Buffer.from(encoded).copy(buf, 4);
  return buf;
}

function encodeU64(value) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function encodeU16(value) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value);
  return buf;
}

function encodeU8(value) {
  return Buffer.from([value]);
}

function encodeOptionU16(value) {
  if (value === null || value === undefined) {
    return Buffer.from([0]);
  }
  const buf = Buffer.alloc(3);
  buf[0] = 1;
  buf.writeUInt16LE(value, 1);
  return buf;
}

function encodeOptionU64(value) {
  if (value === null || value === undefined) {
    return Buffer.from([0]);
  }
  const buf = Buffer.alloc(9);
  buf[0] = 1;
  buf.writeBigUInt64LE(BigInt(value), 1);
  return buf;
}

function encodeOptionBool(value) {
  if (value === null || value === undefined) {
    return Buffer.from([0]);
  }
  return Buffer.from([1, value ? 1 : 0]);
}

function readPublicKey(data, offset) {
  return new PublicKey(data.slice(offset, offset + 32));
}

function readU8(data, offset) {
  return data[offset];
}

function readU16(data, offset) {
  return data.readUInt16LE(offset);
}

function readU32(data, offset) {
  return data.readUInt32LE(offset);
}

function readU64(data, offset) {
  return Number(data.readBigUInt64LE(offset));
}

function readI64(data, offset) {
  return Number(data.readBigInt64LE(offset));
}

function readU128(data, offset) {
  const lo = data.readBigUInt64LE(offset);
  const hi = data.readBigUInt64LE(offset + 8);
  return hi * BigInt(2 ** 64) + lo;
}

function readBool(data, offset) {
  return data[offset] !== 0;
}

function readString(data, offset) {
  const len = data.readUInt32LE(offset);
  return data.slice(offset + 4, offset + 4 + len).toString("utf8");
}

// ========================================
// Account deserialization
// ========================================

function deserializeVault(data) {
  let offset = 8; // skip discriminator
  const creator = readPublicKey(data, offset);       offset += 32;
  const vaultTypeVal = readU8(data, offset);          offset += 1;
  const tokenMint = readPublicKey(data, offset);      offset += 32;
  const name = readString(data, offset);              offset += 4 + new TextEncoder().encode(name).length;
  const description = readString(data, offset);       offset += 4 + new TextEncoder().encode(description).length;
  const dailyLimit = readU64(data, offset);            offset += 8;
  const weeklyLimit = readU64(data, offset);           offset += 8;
  const monthlyLimit = readU64(data, offset);          offset += 8;
  const limitsArePercentage = readBool(data, offset);  offset += 1;
  const penaltyRateBps = readU16(data, offset);       offset += 2;
  const vaultNonce = readU64(data, offset);           offset += 8;
  const memberCount = readU32(data, offset);          offset += 4;
  const totalBalance = readU64(data, offset);         offset += 8;
  const accumulatedPenalty = readU128(data, offset);  offset += 16;
  const isActive = readBool(data, offset);            offset += 1;
  const createdAt = readI64(data, offset);            offset += 8;
  const updatedAt = readI64(data, offset);            offset += 8;
  const bump = readU8(data, offset);

  return {
    creator: creator.toString(),
    vaultType: vaultTypeVal === 0 ? "Personal" : "Community",
    tokenMint: tokenMint.toString(),
    isSolVault: tokenMint.equals(PublicKey.default),
    name,
    description,
    dailyLimit,
    weeklyLimit,
    monthlyLimit,
    limitsArePercentage,
    penaltyRateBps,
    vaultNonce,
    memberCount,
    totalBalance,
    accumulatedPenalty,
    isActive,
    createdAt,
    updatedAt,
    bump,
  };
}

function deserializeVaultMember(data) {
  let offset = 8; // skip discriminator
  const vault = readPublicKey(data, offset);           offset += 32;
  const member = readPublicKey(data, offset);          offset += 32;
  const balance = readU64(data, offset);               offset += 8;
  const dailySpent = readU64(data, offset);            offset += 8;
  const dailyLastReset = readI64(data, offset);        offset += 8;
  const weeklySpent = readU64(data, offset);           offset += 8;
  const weeklyLastReset = readI64(data, offset);       offset += 8;
  const monthlySpent = readU64(data, offset);          offset += 8;
  const monthlyLastReset = readI64(data, offset);      offset += 8;
  const penaltyDebt = readU128(data, offset);          offset += 16;
  const unclaimedPenalties = readU64(data, offset);    offset += 8;
  const joinedAt = readI64(data, offset);              offset += 8;
  const bump = readU8(data, offset);

  return {
    vault: vault.toString(),
    member: member.toString(),
    balance,
    dailySpent,
    dailyLastReset,
    weeklySpent,
    weeklyLastReset,
    monthlySpent,
    monthlyLastReset,
    penaltyDebt,
    unclaimedPenalties,
    joinedAt,
    bump,
  };
}

function deserializeWithdrawalDestination(data) {
  let offset = 8;
  const vault = readPublicKey(data, offset);          offset += 32;
  const member = readPublicKey(data, offset);         offset += 32;
  const destination = readPublicKey(data, offset);    offset += 32;
  const title = readString(data, offset);             offset += 4 + new TextEncoder().encode(title).length;
  const addedAt = readI64(data, offset);              offset += 8;
  const bump = readU8(data, offset);

  return {
    vault: vault.toString(),
    member: member.toString(),
    destination: destination.toString(),
    title,
    addedAt,
    bump,
  };
}

function deserializePendingDestinationRequest(data) {
  let offset = 8;
  const vault = readPublicKey(data, offset);          offset += 32;
  const member = readPublicKey(data, offset);         offset += 32;
  const destination = readPublicKey(data, offset);    offset += 32;
  const title = readString(data, offset);             offset += 4 + new TextEncoder().encode(title).length;
  const executeAfter = readI64(data, offset);         offset += 8;
  const createdAt = readI64(data, offset);            offset += 8;
  const bump = readU8(data, offset);

  return {
    vault: vault.toString(),
    member: member.toString(),
    destination: destination.toString(),
    title,
    executeAfter,
    createdAt,
    bump,
  };
}

function deserializeRuleChangeProposal(data) {
  let offset = 8;
  const vault = readPublicKey(data, offset);          offset += 32;
  const proposer = readPublicKey(data, offset);       offset += 32;

  function readOptionU64(d, o) {
    if (d[o] === 0) return { value: null, size: 1 };
    return { value: Number(d.readBigUInt64LE(o + 1)), size: 9 };
  }

  function readOptionBool(d, o) {
    if (d[o] === 0) return { value: null, size: 1 };
    return { value: d[o + 1] !== 0, size: 2 };
  }

  function readOptionU16(d, o) {
    if (d[o] === 0) return { value: null, size: 1 };
    return { value: d.readUInt16LE(o + 1), size: 3 };
  }

  const daily = readOptionU64(data, offset);          offset += daily.size;
  const weekly = readOptionU64(data, offset);         offset += weekly.size;
  const monthly = readOptionU64(data, offset);        offset += monthly.size;
  const pctMode = readOptionBool(data, offset);       offset += pctMode.size;
  const penalty = readOptionU16(data, offset);        offset += penalty.size;
  const executeAfter = readI64(data, offset);         offset += 8;
  const createdAt = readI64(data, offset);            offset += 8;
  const bump = readU8(data, offset);

  return {
    vault: vault.toString(),
    proposer: proposer.toString(),
    newDailyLimit: daily.value,
    newWeeklyLimit: weekly.value,
    newMonthlyLimit: monthly.value,
    newLimitsArePercentage: pctMode.value,
    newPenaltyRateBps: penalty.value,
    executeAfter,
    createdAt,
    bump,
  };
}

function deserializeBypassRequest(data) {
  let offset = 8;
  const vault = readPublicKey(data, offset);          offset += 32;
  const member = readPublicKey(data, offset);         offset += 32;
  const amount = readU64(data, offset);               offset += 8;
  const isSol = readBool(data, offset);               offset += 1;
  const tokenMint = readPublicKey(data, offset);      offset += 32;
  const executeAfter = readI64(data, offset);         offset += 8;
  const createdAt = readI64(data, offset);            offset += 8;
  const bump = readU8(data, offset);

  return {
    vault: vault.toString(),
    member: member.toString(),
    amount,
    isSol,
    tokenMint: tokenMint.toString(),
    executeAfter,
    createdAt,
    bump,
  };
}

function encodeBool(value) {
  return Buffer.from([value ? 1 : 0]);
}

// ========================================
// SolanaAdapter
// ========================================

export class SolanaAdapter extends BlockchainAdapter {
  constructor(networkConfig, wallet, connection) {
    super(networkConfig);
    this.wallet = wallet;
    this.connection = connection;
    this.userAddress = null;

    if (this.wallet?.connected && this.wallet?.publicKey) {
      this.userAddress = this.wallet.publicKey.toString();
    }
  }

  // ---- Wallet management ----

  isConnected() {
    return this.wallet?.connected || false;
  }

  async connect() {
    if (!this.wallet) throw new Error("No Solana wallet available");
    await this.wallet.connect();
    this.userAddress = this.wallet.publicKey.toString();
    return this.userAddress;
  }

  async disconnect() {
    if (this.wallet?.disconnect) await this.wallet.disconnect();
    this.userAddress = null;
  }

  getAddress() {
    return this.userAddress || this.wallet?.publicKey?.toString() || null;
  }

  // ---- PDA derivation ----

  getVaultPDA(creatorPubkey, vaultNonce) {
    const nonceBuf = Buffer.alloc(8);
    nonceBuf.writeBigUInt64LE(BigInt(vaultNonce));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), creatorPubkey.toBuffer(), nonceBuf],
      PROGRAM_ID
    );
  }

  getVaultMemberPDA(vaultPubkey, memberPubkey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault_member"), vaultPubkey.toBuffer(), memberPubkey.toBuffer()],
      PROGRAM_ID
    );
  }

  getProgramConfigPDA() {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("program_config")],
      PROGRAM_ID
    );
  }

  getWithdrawalDestPDA(vaultPubkey, memberPubkey, destinationPubkey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("withdrawal_dest"), vaultPubkey.toBuffer(), memberPubkey.toBuffer(), destinationPubkey.toBuffer()],
      PROGRAM_ID
    );
  }

  getPendingDestPDA(vaultPubkey, memberPubkey, destinationPubkey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pending_dest"), vaultPubkey.toBuffer(), memberPubkey.toBuffer(), destinationPubkey.toBuffer()],
      PROGRAM_ID
    );
  }

  getRuleProposalPDA(vaultPubkey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("rule_proposal"), vaultPubkey.toBuffer()],
      PROGRAM_ID
    );
  }

  getBypassRequestPDA(vaultPubkey, memberPubkey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("bypass_request"), vaultPubkey.toBuffer(), memberPubkey.toBuffer()],
      PROGRAM_ID
    );
  }

  getTreasuryAddress() {
    const rpcUrl = this.connection?.rpcEndpoint || "http://127.0.0.1:8899";
    let env = "localhost";
    if (rpcUrl.includes("devnet")) env = "devnet";
    else if (rpcUrl.includes("mainnet")) env = "mainnet";
    return new PublicKey(TREASURY_CONFIG[env]);
  }

  // ---- Transaction helpers ----

  async sendTransaction(transaction) {
    if (!this.wallet?.publicKey) throw new Error("Wallet not connected");
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    const signed = await this.wallet.signTransaction(transaction);
    const sig = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    return sig;
  }

  // ---- Vault CRUD ----

  async createVault({
    name,
    description = "",
    vaultType = "Personal",
    tokenMint = null,
    dailyLimit,
    weeklyLimit = 0,
    monthlyLimit = 0,
    penaltyRateBps = 2000,
    limitsArePercentage = false,
  }) {
    const creator = this.wallet.publicKey;
    const vaultNonce = Date.now();
    const isSpl = tokenMint !== null;

    const [vaultPDA] = this.getVaultPDA(creator, vaultNonce);
    const [memberPDA] = this.getVaultMemberPDA(vaultPDA, creator);

    const typeIndex = vaultType === "Community" ? VAULT_TYPE.Community : VAULT_TYPE.Personal;

    const dataBuffers = [
      Buffer.from(isSpl ? DISC.CreateSplVault : DISC.CreateVault),
      encodeString(name),
      encodeU64(vaultNonce),
      encodeString(description),
      encodeU8(typeIndex),
      encodeU64(dailyLimit),
      encodeU64(weeklyLimit),
      encodeU64(monthlyLimit),
      encodeU16(penaltyRateBps),
      encodeBool(limitsArePercentage),
    ];
    const instructionData = Buffer.concat(dataBuffers);

    const keys = [
      { pubkey: vaultPDA, isSigner: false, isWritable: true },
      { pubkey: memberPDA, isSigner: false, isWritable: true },
    ];

    if (isSpl) {
      const mint = new PublicKey(tokenMint);
      const vaultATA = await getAssociatedTokenAddress(mint, vaultPDA, true);
      keys.push(
        { pubkey: vaultATA, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false }
      );
    }

    keys.push(
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    );

    if (isSpl) {
      keys.push(
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
      );
    }

    const tx = new Transaction().add(
      new TransactionInstruction({ keys, programId: PROGRAM_ID, data: instructionData })
    );
    const sig = await this.sendTransaction(tx);
    return { signature: sig, vaultAddress: vaultPDA.toString(), vaultNonce };
  }

  async joinVault(vaultAddress) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: memberPDA, isSigner: false, isWritable: true },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(DISC.JoinVault),
      })
    );
    return this.sendTransaction(tx);
  }

  async leaveVault(vaultAddress) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: memberPDA, isSigner: false, isWritable: true },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(DISC.LeaveVault),
      })
    );
    return this.sendTransaction(tx);
  }

  // ---- Deposits ----

  async depositSol(vaultAddress, amount) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const lamports = Math.round(amount * LAMPORTS_PER_SOL);

    const data = Buffer.concat([
      Buffer.from(DISC.DepositSol),
      encodeU64(lamports),
    ]);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: memberPDA, isSigner: false, isWritable: true },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );
    return this.sendTransaction(tx);
  }

  async depositSpl(vaultAddress, tokenMint, amount, decimals) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const mint = new PublicKey(tokenMint);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const vaultATA = await getAssociatedTokenAddress(mint, vaultPubkey, true);
    const memberATA = await getAssociatedTokenAddress(mint, member);
    const tokenAmount = Math.round(amount * 10 ** decimals);

    const data = Buffer.concat([
      Buffer.from(DISC.DepositSpl),
      encodeU64(tokenAmount),
    ]);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: memberPDA, isSigner: false, isWritable: true },
          { pubkey: vaultATA, isSigner: false, isWritable: true },
          { pubkey: memberATA, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );
    return this.sendTransaction(tx);
  }

  // ---- Withdrawals (within limits) ----

  async withdrawSol(vaultAddress, amount) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const lamports = Math.round(amount * LAMPORTS_PER_SOL);

    const data = Buffer.concat([Buffer.from(DISC.WithdrawSol), encodeU64(lamports)]);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: memberPDA, isSigner: false, isWritable: true },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );
    return this.sendTransaction(tx);
  }

  async withdrawSpl(vaultAddress, tokenMint, amount, decimals) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const mint = new PublicKey(tokenMint);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const vaultATA = await getAssociatedTokenAddress(mint, vaultPubkey, true);
    const memberATA = await getAssociatedTokenAddress(mint, member);
    const tokenAmount = Math.round(amount * 10 ** decimals);

    // Ensure member ATA exists
    const txInstructions = [];
    const memberATAInfo = await this.connection.getAccountInfo(memberATA);
    if (!memberATAInfo) {
      txInstructions.push(
        createAssociatedTokenAccountInstruction(member, memberATA, member, mint)
      );
    }

    const data = Buffer.concat([Buffer.from(DISC.WithdrawSpl), encodeU64(tokenAmount)]);

    txInstructions.push(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: memberPDA, isSigner: false, isWritable: true },
          { pubkey: vaultATA, isSigner: false, isWritable: true },
          { pubkey: memberATA, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );

    const tx = new Transaction();
    txInstructions.forEach((ix) => tx.add(ix));
    return this.sendTransaction(tx);
  }

  // ---- Penalty withdrawals ----

  async withdrawSolWithPenalty(vaultAddress, amount) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const [configPDA] = this.getProgramConfigPDA();
    const treasury = this.getTreasuryAddress();
    const lamports = Math.round(amount * LAMPORTS_PER_SOL);

    const data = Buffer.concat([Buffer.from(DISC.WithdrawSolWithPenalty), encodeU64(lamports)]);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: memberPDA, isSigner: false, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: false },
          { pubkey: treasury, isSigner: false, isWritable: true },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );
    return this.sendTransaction(tx);
  }

  async withdrawSplWithPenalty(vaultAddress, tokenMint, amount, decimals) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const mint = new PublicKey(tokenMint);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const [configPDA] = this.getProgramConfigPDA();
    const treasury = this.getTreasuryAddress();
    const vaultATA = await getAssociatedTokenAddress(mint, vaultPubkey, true);
    const memberATA = await getAssociatedTokenAddress(mint, member);
    const treasuryATA = await getAssociatedTokenAddress(mint, treasury);
    const tokenAmount = Math.round(amount * 10 ** decimals);

    const txInstructions = [];
    const [memberATAInfo, treasuryATAInfo] = await Promise.all([
      this.connection.getAccountInfo(memberATA),
      this.connection.getAccountInfo(treasuryATA),
    ]);
    if (!memberATAInfo) {
      txInstructions.push(
        createAssociatedTokenAccountInstruction(member, memberATA, member, mint)
      );
    }
    if (!treasuryATAInfo) {
      txInstructions.push(
        createAssociatedTokenAccountInstruction(member, treasuryATA, treasury, mint)
      );
    }

    const data = Buffer.concat([Buffer.from(DISC.WithdrawSplWithPenalty), encodeU64(tokenAmount)]);

    txInstructions.push(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: memberPDA, isSigner: false, isWritable: true },
          { pubkey: configPDA, isSigner: false, isWritable: false },
          { pubkey: vaultATA, isSigner: false, isWritable: true },
          { pubkey: memberATA, isSigner: false, isWritable: true },
          { pubkey: treasuryATA, isSigner: false, isWritable: true },
          { pubkey: treasury, isSigner: false, isWritable: false },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );

    const tx = new Transaction();
    txInstructions.forEach((ix) => tx.add(ix));
    return this.sendTransaction(tx);
  }

  // ---- Penalty rewards ----

  async claimPenaltyRewards(vaultAddress, isSpl = false, tokenMint = null) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);

    if (!isSpl) {
      const tx = new Transaction().add(
        new TransactionInstruction({
          keys: [
            { pubkey: vaultPubkey, isSigner: false, isWritable: true },
            { pubkey: memberPDA, isSigner: false, isWritable: true },
            { pubkey: member, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: PROGRAM_ID,
          data: Buffer.from(DISC.ClaimPenaltyRewards),
        })
      );
      return this.sendTransaction(tx);
    }

    const mint = new PublicKey(tokenMint);
    const vaultATA = await getAssociatedTokenAddress(mint, vaultPubkey, true);
    const memberATA = await getAssociatedTokenAddress(mint, member);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: memberPDA, isSigner: false, isWritable: true },
          { pubkey: vaultATA, isSigner: false, isWritable: true },
          { pubkey: memberATA, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(DISC.ClaimSplPenaltyRewards),
      })
    );
    return this.sendTransaction(tx);
  }

  // ---- Vault rules (personal only) ----

  async updateVaultRules(vaultAddress, { dailyLimit, weeklyLimit, monthlyLimit, penaltyRateBps, limitsArePercentage }) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const creator = this.wallet.publicKey;

    const data = Buffer.concat([
      Buffer.from(DISC.UpdateVaultRules),
      encodeOptionU64(dailyLimit),
      encodeOptionU64(weeklyLimit),
      encodeOptionU64(monthlyLimit),
      encodeOptionU16(penaltyRateBps),
      encodeOptionBool(limitsArePercentage),
    ]);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: creator, isSigner: true, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );
    return this.sendTransaction(tx);
  }

  // ---- Read operations ----

  async getVaultInfo(vaultAddress) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const accountInfo = await this.connection.getAccountInfo(vaultPubkey);
    if (!accountInfo) return null;
    return { ...deserializeVault(Buffer.from(accountInfo.data)), address: vaultAddress };
  }

  async getVaultMemberInfo(vaultAddress, memberAddress = null) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const memberPubkey = memberAddress
      ? new PublicKey(memberAddress)
      : this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, memberPubkey);
    const accountInfo = await this.connection.getAccountInfo(memberPDA);
    if (!accountInfo) return null;
    return deserializeVaultMember(Buffer.from(accountInfo.data));
  }

  async getUserVaults() {
    const member = this.wallet.publicKey;
    if (!member) return [];

    // Find all VaultMember accounts for this user
    const memberAccounts = await this.connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(ACCOUNT_DISC.VaultMember)) } },
        { memcmp: { offset: 8 + 32, bytes: member.toBase58() } },
      ],
    });

    const results = [];
    for (const { account } of memberAccounts) {
      const memberData = deserializeVaultMember(Buffer.from(account.data));
      const vaultInfo = await this.getVaultInfo(memberData.vault);
      if (vaultInfo) {
        results.push({ vault: vaultInfo, membership: memberData });
      }
    }
    return results;
  }

  async discoverVaults({ tokenMint = null, vaultType = null } = {}) {
    const filters = [
      { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(ACCOUNT_DISC.Vault)) } },
    ];

    // Filter by vault_type if specified (offset: 8 + 32 = 40 for vault_type byte)
    if (vaultType !== null) {
      const typeByte = vaultType === "Community" ? 1 : 0;
      filters.push({ memcmp: { offset: 40, bytes: Buffer.from([typeByte]).toString("base64") } });
    }

    const accounts = await this.connection.getProgramAccounts(PROGRAM_ID, { filters });

    const vaults = accounts.map(({ pubkey, account }) => ({
      ...deserializeVault(Buffer.from(account.data)),
      address: pubkey.toString(),
    }));

    // Client-side filter by token mint if specified
    if (tokenMint) {
      return vaults.filter((v) => v.tokenMint === tokenMint);
    }
    return vaults.filter((v) => v.isActive);
  }

  async getVaultMembers(vaultAddress) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const accounts = await this.connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(ACCOUNT_DISC.VaultMember)) } },
        { memcmp: { offset: 8, bytes: vaultPubkey.toBase58() } },
      ],
    });

    return accounts.map(({ account }) =>
      deserializeVaultMember(Buffer.from(account.data))
    );
  }

  // ---- Withdrawal destinations ----

  async addWithdrawalDestination(vaultAddress, destinationAddress, title) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const destination = new PublicKey(destinationAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const [destPDA] = this.getWithdrawalDestPDA(vaultPubkey, member, destination);

    const data = Buffer.concat([
      Buffer.from(DISC.AddWithdrawalDestination),
      encodeString(title),
    ]);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: false },
          { pubkey: memberPDA, isSigner: false, isWritable: false },
          { pubkey: destPDA, isSigner: false, isWritable: true },
          { pubkey: destination, isSigner: false, isWritable: false },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );
    return this.sendTransaction(tx);
  }

  async requestWithdrawalDestination(vaultAddress, destinationAddress, title) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const destination = new PublicKey(destinationAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const [pendingPDA] = this.getPendingDestPDA(vaultPubkey, member, destination);

    const data = Buffer.concat([
      Buffer.from(DISC.RequestWithdrawalDestination),
      encodeString(title),
    ]);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: false },
          { pubkey: memberPDA, isSigner: false, isWritable: false },
          { pubkey: pendingPDA, isSigner: false, isWritable: true },
          { pubkey: destination, isSigner: false, isWritable: false },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );
    return this.sendTransaction(tx);
  }

  async executeDestinationRequest(vaultAddress, destinationAddress) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const destination = new PublicKey(destinationAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const [pendingPDA] = this.getPendingDestPDA(vaultPubkey, member, destination);
    const [destPDA] = this.getWithdrawalDestPDA(vaultPubkey, member, destination);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: false },
          { pubkey: memberPDA, isSigner: false, isWritable: false },
          { pubkey: pendingPDA, isSigner: false, isWritable: true },
          { pubkey: destPDA, isSigner: false, isWritable: true },
          { pubkey: destination, isSigner: false, isWritable: false },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(DISC.ExecuteDestinationRequest),
      })
    );
    return this.sendTransaction(tx);
  }

  async cancelDestinationRequest(vaultAddress, destinationAddress) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const destination = new PublicKey(destinationAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const [pendingPDA] = this.getPendingDestPDA(vaultPubkey, member, destination);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: false },
          { pubkey: memberPDA, isSigner: false, isWritable: false },
          { pubkey: pendingPDA, isSigner: false, isWritable: true },
          { pubkey: destination, isSigner: false, isWritable: false },
          { pubkey: member, isSigner: true, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(DISC.CancelDestinationRequest),
      })
    );
    return this.sendTransaction(tx);
  }

  async removeWithdrawalDestination(vaultAddress, destinationAddress) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const destination = new PublicKey(destinationAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const [destPDA] = this.getWithdrawalDestPDA(vaultPubkey, member, destination);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: false },
          { pubkey: memberPDA, isSigner: false, isWritable: false },
          { pubkey: destPDA, isSigner: false, isWritable: true },
          { pubkey: destination, isSigner: false, isWritable: false },
          { pubkey: member, isSigner: true, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(DISC.RemoveWithdrawalDestination),
      })
    );
    return this.sendTransaction(tx);
  }

  // ---- Rule change proposals ----

  async proposeRuleChange(vaultAddress, { dailyLimit, weeklyLimit, monthlyLimit, penaltyRateBps, limitsArePercentage }) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const creator = this.wallet.publicKey;
    const [proposalPDA] = this.getRuleProposalPDA(vaultPubkey);

    const data = Buffer.concat([
      Buffer.from(DISC.ProposeRuleChange),
      encodeOptionU64(dailyLimit),
      encodeOptionU64(weeklyLimit),
      encodeOptionU64(monthlyLimit),
      encodeOptionU16(penaltyRateBps),
      encodeOptionBool(limitsArePercentage),
    ]);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: false },
          { pubkey: proposalPDA, isSigner: false, isWritable: true },
          { pubkey: creator, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );
    return this.sendTransaction(tx);
  }

  async executeRuleChange(vaultAddress) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const creator = this.wallet.publicKey;
    const [proposalPDA] = this.getRuleProposalPDA(vaultPubkey);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: proposalPDA, isSigner: false, isWritable: true },
          { pubkey: creator, isSigner: true, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(DISC.ExecuteRuleChange),
      })
    );
    return this.sendTransaction(tx);
  }

  async cancelRuleChange(vaultAddress) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const creator = this.wallet.publicKey;
    const [proposalPDA] = this.getRuleProposalPDA(vaultPubkey);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: false },
          { pubkey: proposalPDA, isSigner: false, isWritable: true },
          { pubkey: creator, isSigner: true, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(DISC.CancelRuleChange),
      })
    );
    return this.sendTransaction(tx);
  }

  // ---- Bypass requests ----

  async requestBypass(vaultAddress, amount, isSol = true) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const [bypassPDA] = this.getBypassRequestPDA(vaultPubkey, member);

    const lamports = isSol
      ? Math.round(amount * LAMPORTS_PER_SOL)
      : amount;

    const data = Buffer.concat([
      Buffer.from(DISC.RequestBypass),
      encodeU64(lamports),
      encodeBool(isSol),
    ]);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: false },
          { pubkey: memberPDA, isSigner: false, isWritable: false },
          { pubkey: bypassPDA, isSigner: false, isWritable: true },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );
    return this.sendTransaction(tx);
  }

  async executeBypassSol(vaultAddress) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const [bypassPDA] = this.getBypassRequestPDA(vaultPubkey, member);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: memberPDA, isSigner: false, isWritable: true },
          { pubkey: bypassPDA, isSigner: false, isWritable: true },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(DISC.ExecuteBypassSol),
      })
    );
    return this.sendTransaction(tx);
  }

  async executeBypassSpl(vaultAddress, tokenMint) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const mint = new PublicKey(tokenMint);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const [bypassPDA] = this.getBypassRequestPDA(vaultPubkey, member);
    const vaultATA = await getAssociatedTokenAddress(mint, vaultPubkey, true);
    const memberATA = await getAssociatedTokenAddress(mint, member);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: true },
          { pubkey: memberPDA, isSigner: false, isWritable: true },
          { pubkey: bypassPDA, isSigner: false, isWritable: true },
          { pubkey: vaultATA, isSigner: false, isWritable: true },
          { pubkey: memberATA, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: member, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(DISC.ExecuteBypassSpl),
      })
    );
    return this.sendTransaction(tx);
  }

  async cancelBypass(vaultAddress) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const member = this.wallet.publicKey;
    const [memberPDA] = this.getVaultMemberPDA(vaultPubkey, member);
    const [bypassPDA] = this.getBypassRequestPDA(vaultPubkey, member);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: vaultPubkey, isSigner: false, isWritable: false },
          { pubkey: memberPDA, isSigner: false, isWritable: false },
          { pubkey: bypassPDA, isSigner: false, isWritable: true },
          { pubkey: member, isSigner: true, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(DISC.CancelBypass),
      })
    );
    return this.sendTransaction(tx);
  }

  // ---- Read: withdrawal destinations ----

  async getWithdrawalDestinations(vaultAddress, memberAddress = null) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const memberPubkey = memberAddress ? new PublicKey(memberAddress) : this.wallet.publicKey;

    const accounts = await this.connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(ACCOUNT_DISC.WithdrawalDestination)) } },
        { memcmp: { offset: 8, bytes: vaultPubkey.toBase58() } },
        { memcmp: { offset: 8 + 32, bytes: memberPubkey.toBase58() } },
      ],
    });

    return accounts.map(({ account }) =>
      deserializeWithdrawalDestination(Buffer.from(account.data))
    );
  }

  async getPendingDestinationRequests(vaultAddress, memberAddress = null) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const memberPubkey = memberAddress ? new PublicKey(memberAddress) : this.wallet.publicKey;

    const accounts = await this.connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(ACCOUNT_DISC.PendingDestinationRequest)) } },
        { memcmp: { offset: 8, bytes: vaultPubkey.toBase58() } },
        { memcmp: { offset: 8 + 32, bytes: memberPubkey.toBase58() } },
      ],
    });

    return accounts.map(({ account }) =>
      deserializePendingDestinationRequest(Buffer.from(account.data))
    );
  }

  // ---- Read: rule change proposals ----

  async getRuleChangeProposal(vaultAddress) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const [proposalPDA] = this.getRuleProposalPDA(vaultPubkey);
    const accountInfo = await this.connection.getAccountInfo(proposalPDA);
    if (!accountInfo) return null;
    return deserializeRuleChangeProposal(Buffer.from(accountInfo.data));
  }

  // ---- Read: bypass requests ----

  async getBypassRequest(vaultAddress, memberAddress = null) {
    const vaultPubkey = new PublicKey(vaultAddress);
    const memberPubkey = memberAddress ? new PublicKey(memberAddress) : this.wallet.publicKey;
    const [bypassPDA] = this.getBypassRequestPDA(vaultPubkey, memberPubkey);
    const accountInfo = await this.connection.getAccountInfo(bypassPDA);
    if (!accountInfo) return null;
    return deserializeBypassRequest(Buffer.from(accountInfo.data));
  }

  // ---- Program config ----

  async initializeProgramConfig(penaltyRateBps = 2000) {
    const admin = this.wallet.publicKey;
    const [configPDA] = this.getProgramConfigPDA();

    const data = Buffer.concat([
      Buffer.from(DISC.InitializeProgramConfig),
      encodeU16(penaltyRateBps),
    ]);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: configPDA, isSigner: false, isWritable: true },
          { pubkey: admin, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );
    return this.sendTransaction(tx);
  }

  async getProgramConfig() {
    const [configPDA] = this.getProgramConfigPDA();
    const accountInfo = await this.connection.getAccountInfo(configPDA);
    if (!accountInfo) return null;

    const data = Buffer.from(accountInfo.data);
    let offset = 8;
    const treasuryAddress = readPublicKey(data, offset); offset += 32;
    const defaultPenaltyRateBps = readU16(data, offset); offset += 2;
    const admin = readPublicKey(data, offset);

    return {
      treasuryAddress: treasuryAddress.toString(),
      defaultPenaltyRateBps,
      admin: admin.toString(),
    };
  }

  // ---- Compatibility: cross-vault account searches by member ----

  async fetchWithdrawalAddresses(userAddress) {
    const memberPubkey = new PublicKey(userAddress);
    const accounts = await this.connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(ACCOUNT_DISC.WithdrawalDestination)) } },
        { memcmp: { offset: 40, bytes: memberPubkey.toBase58() } },
      ],
    });

    return accounts.map(({ account }) =>
      deserializeWithdrawalDestination(Buffer.from(account.data))
    );
  }

  async fetchPendingProposals(userAddress) {
    const proposerPubkey = new PublicKey(userAddress);
    const accounts = await this.connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(ACCOUNT_DISC.RuleChangeProposal)) } },
        { memcmp: { offset: 40, bytes: proposerPubkey.toBase58() } },
      ],
    });

    return accounts.map(({ account }) =>
      deserializeRuleChangeProposal(Buffer.from(account.data))
    );
  }

  async fetchPendingBypassRequests(userAddress) {
    const memberPubkey = new PublicKey(userAddress);
    const accounts = await this.connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(ACCOUNT_DISC.BypassRequest)) } },
        { memcmp: { offset: 40, bytes: memberPubkey.toBase58() } },
      ],
    });

    return accounts.map(({ account }) =>
      deserializeBypassRequest(Buffer.from(account.data))
    );
  }

  async fetchPendingWithdrawalDestinationRequests(userAddress) {
    const memberPubkey = new PublicKey(userAddress);
    const accounts = await this.connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(Buffer.from(ACCOUNT_DISC.PendingDestinationRequest)) } },
        { memcmp: { offset: 40, bytes: memberPubkey.toBase58() } },
      ],
    });

    return accounts.map(({ account }) =>
      deserializePendingDestinationRequest(Buffer.from(account.data))
    );
  }
}
