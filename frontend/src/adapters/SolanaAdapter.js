import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { BlockchainAdapter } from './BlockchainAdapter.js';

// Instruction discriminators from the IDL
const INSTRUCTION_DISCRIMINATORS = {
  Initialize: [175, 175, 109, 31, 13, 152, 155, 237],
  DepositSol: [108, 81, 78, 117, 125, 155, 56, 200],
  DepositSpl: [224, 0, 198, 175, 198, 47, 105, 204],
  WithdrawSol: [145, 131, 74, 136, 65, 137, 42, 38],
  WithdrawSpl: [181, 154, 94, 86, 62, 115, 6, 186]
};

/**
 * Solana Blockchain Adapter using pure @solana/web3.js
 */
export class SolanaAdapter extends BlockchainAdapter {
  constructor(networkConfig, wallet, connection) {
    super(networkConfig);
    this.wallet = wallet;
    this.connection = connection;
    this.userAddress = null;
    this.PROGRAM_ID = new PublicKey("HPETsRTsHi8ez2dBbzSHRE2KDfHFYuvYK4Bg6f8K1tB6"); // Updated 2025-10-02

    if (this.wallet?.connected && this.wallet?.publicKey) {
      this.userAddress = this.wallet.publicKey.toString();
    }
  }

  // Wallet Management
  async isConnected() {
    console.log('SolanaAdapter isConnected check:', {
      wallet: this.wallet,
      connected: this.wallet?.connected
    });
    return this.wallet?.connected || false;
  }

  async connect() {
    try {
      if (!this.wallet.connected) {
        await this.wallet.connect();
      }

      this.userAddress = this.wallet.publicKey?.toString();

      return {
        address: this.userAddress,
        wallet: this.wallet,
        connection: this.connection
      };
    } catch (error) {
      console.error('Failed to connect to Solana wallet:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.wallet.connected) {
      await this.wallet.disconnect();
    }
    this.userAddress = null;
  }

  async getAddress() {
    return this.wallet?.publicKey?.toString() || null;
  }

  async switchNetwork(networkConfig) {
    // Solana wallets typically handle network switching internally
    // Update our connection
    this.networkConfig = networkConfig;
    this.connection = new Connection(networkConfig.rpcUrl, 'confirmed');
  }

  // Balance Management
  async getTokenBalance(userAddress, tokenAddress) {
    const pubkey = new PublicKey(userAddress);

    if (tokenAddress === 'SOL' || tokenAddress === 'native') {
      // Get SOL balance
      const balance = await this.connection.getBalance(pubkey);
      return BigInt(balance);
    } else {
      // Get SPL token balance
      try {
        const tokenPubkey = new PublicKey(tokenAddress);
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
          this.connection,
          this.wallet,
          tokenPubkey,
          pubkey
        );
        return BigInt(tokenAccount.amount.toString());
      } catch (error) {
        console.error('Error getting SPL token balance:', error);
        return BigInt(0);
      }
    }
  }

  async getAllBalances(userAddress) {
    const balances = {};

    console.log('🏦 Getting savings balances from program account...');

    try {
      // Get savings account data from program
      const savingsData = await this.getSavingsAccountData(userAddress);

      if (!savingsData) {
        console.log('No savings account found - returning zero balances');
        // Return zero balances for all configured tokens
        if (this.networkConfig.tokens) {
          for (const [key] of Object.entries(this.networkConfig.tokens)) {
            balances[key] = "0";
          }
        }
        return balances;
      }

      console.log('📊 Savings account data:', savingsData.data);

      // Process SOL balance
      const solBalance = savingsData.data.solBalance;
      if (solBalance && solBalance.toString() !== '0') {
        balances['SOL'] = this.formatAmount(BigInt(solBalance.toString()), 9);
        console.log(`✅ SOL savings balance: ${balances['SOL']}`);
      }

      // Process SPL token balances from program account
      if (this.networkConfig.tokens) {
        for (const [key, token] of Object.entries(this.networkConfig.tokens)) {
          const tokenAddress = token.mint || token.address;
          if (tokenAddress && tokenAddress !== 'native') {
            try {
              // Find this token in the savings account's SPL balances
              const splBalance = savingsData.data.splBalances.find(
                balance => balance.mint.toString() === tokenAddress
              );

              if (splBalance && splBalance.amount.toString() !== '0') {
                balances[key] = this.formatAmount(BigInt(splBalance.amount.toString()), token.decimals);
                console.log(`✅ ${key} savings balance: ${balances[key]}`);
              } else {
                balances[key] = "0";
                console.log(`📍 ${key} savings balance: 0 (no deposits yet)`);
              }
            } catch (error) {
              console.error(`❌ Error processing ${key} savings balance:`, error);
              balances[key] = "0";
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ Error fetching savings balances:', error);
      // Return zero balances on error
      if (this.networkConfig.tokens) {
        for (const [key] of Object.entries(this.networkConfig.tokens)) {
          balances[key] = "0";
        }
      }
    }

    console.log('🎯 Final savings balances:', balances);
    return balances;
  }

  // Instruction creation helpers
  createInstruction(instructionType, accounts, data = null) {
    const discriminator = Buffer.from(INSTRUCTION_DISCRIMINATORS[instructionType]);
    let instructionData = discriminator;

    if (data) {
      // Manual serialization for u64 amount
      if (data.amount !== undefined) {
        const amountBuffer = Buffer.alloc(8);
        // Convert BigInt to little-endian u64
        const amount = BigInt(data.amount);
        amountBuffer.writeBigUInt64LE(amount, 0);
        instructionData = Buffer.concat([discriminator, amountBuffer]);
      }
    }

    return new TransactionInstruction({
      keys: accounts,
      programId: this.PROGRAM_ID,
      data: instructionData
    });
  }

  async createInitializeInstruction(userPubkey) {
    const [savingsAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("savings"), userPubkey.toBuffer()],
      this.PROGRAM_ID
    );

    const accounts = [
      { pubkey: savingsAccount, isSigner: false, isWritable: true },
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ];

    return this.createInstruction('Initialize', accounts);
  }

  async createDepositSolInstruction(userPubkey, amount) {
    const [savingsAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("savings"), userPubkey.toBuffer()],
      this.PROGRAM_ID
    );

    const accounts = [
      { pubkey: savingsAccount, isSigner: false, isWritable: true },
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ];

    return this.createInstruction('DepositSol', accounts, { amount });
  }

  async createDepositSplInstruction(userPubkey, amount, mintPubkey, userTokenAccount, savingsTokenAccount) {
    const [savingsAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("savings"), userPubkey.toBuffer()],
      this.PROGRAM_ID
    );

    const accounts = [
      { pubkey: savingsAccount, isSigner: false, isWritable: true },
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: savingsTokenAccount, isSigner: false, isWritable: true },
      { pubkey: mintPubkey, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ];

    return this.createInstruction('DepositSpl', accounts, { amount });
  }

  // Deposit Operations
  async deposit(tokenAddress, amount, tokenDecimals) {
    console.log('SolanaAdapter deposit called with pure web3.js approach:', {
      tokenAddress,
      amount,
      tokenDecimals,
      wallet: !!this.wallet,
      publicKey: !!this.wallet?.publicKey,
      connected: this.wallet?.connected
    });

    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const userPubkey = this.wallet.publicKey;
    const amountBigInt = this.parseAmount(amount, tokenDecimals);

    console.log('Processing deposit:', {
      userPubkey: userPubkey.toString(),
      amount: amount,
      amountBigInt: amountBigInt.toString(),
      tokenAddress
    });

    try {
      if (tokenAddress === 'SOL' || tokenAddress === 'native') {
        // SOL deposit
        console.log('Creating SOL deposit transaction...');

        // Calculate the savings account PDA
        const [savingsAccount] = await PublicKey.findProgramAddress(
          [Buffer.from("savings"), userPubkey.toBuffer()],
          this.PROGRAM_ID
        );

        console.log('Savings account PDA:', savingsAccount.toString());

        // Check if savings account exists, if not initialize it first
        const savingsAccountInfo = await this.connection.getAccountInfo(savingsAccount);
        const transaction = new Transaction();

        if (!savingsAccountInfo) {
          console.log('Savings account not found, adding initialize instruction...');
          const initInstruction = await this.createInitializeInstruction(userPubkey);
          transaction.add(initInstruction);
        }

        // Add deposit instruction
        const depositInstruction = await this.createDepositSolInstruction(userPubkey, amountBigInt);
        transaction.add(depositInstruction);

        // Send transaction
        const { blockhash } = await this.connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPubkey;

        console.log('Sending transaction with', transaction.instructions.length, 'instructions');
        const txHash = await this.wallet.sendTransaction(transaction, this.connection);
        console.log('SOL deposit transaction:', txHash);

        return {
          hash: txHash,
          success: true,
          signature: txHash
        };
      } else {
        // SPL token deposit
        console.log('Creating SPL token deposit transaction...');

        const mintPubkey = new PublicKey(tokenAddress);

        // Calculate the savings account PDA
        const [savingsAccount] = await PublicKey.findProgramAddress(
          [Buffer.from("savings"), userPubkey.toBuffer()],
          this.PROGRAM_ID
        );

        // Check if user has any tokens first
        console.log('Checking if user has tokens for mint:', mintPubkey.toString());

        let userTokenAccount;
        try {
          userTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.wallet,
            mintPubkey,
            userPubkey
          );

          // Check if user actually has tokens
          if (userTokenAccount.amount === 0n) {
            throw new Error(`No ${tokenAddress.slice(0,8)}... tokens in wallet. Please get some tokens first to deposit.`);
          }

          console.log('User token account found with balance:', userTokenAccount.amount.toString());
        } catch (error) {
          if (error.message.includes('TokenAccountNotFoundError') || error.name === 'TokenAccountNotFoundError') {
            throw new Error(`No ${tokenAddress.slice(0,8)}... token account found. Please get some tokens first to deposit.`);
          }
          throw error;
        }

        // Get savings token account address
        const savingsTokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          savingsAccount,
          true // allowOwnerOffCurve for PDA
        );

        console.log('Token accounts:', {
          userTokenAccount: userTokenAccount.address.toString(),
          savingsTokenAccount: savingsTokenAccount.toString(),
          mint: mintPubkey.toString()
        });

        // Create transaction - but handle initialization separately for reliability
        const savingsAccountInfo = await this.connection.getAccountInfo(savingsAccount);

        if (!savingsAccountInfo) {
          console.log('Savings account not found, initializing first...');
          try {
            const initTransaction = new Transaction();
            const initInstruction = await this.createInitializeInstruction(userPubkey);
            initTransaction.add(initInstruction);

            const { blockhash: initBlockhash } = await this.connection.getRecentBlockhash();
            initTransaction.recentBlockhash = initBlockhash;
            initTransaction.feePayer = userPubkey;

            console.log('Sending initialization transaction...');
            console.log('Init transaction details:', {
              instructions: initTransaction.instructions.length,
              feePayer: initTransaction.feePayer?.toString(),
              blockhash: initTransaction.recentBlockhash,
              accounts: initTransaction.instructions[0].keys.map(k => ({
                pubkey: k.pubkey.toString(),
                signer: k.isSigner,
                writable: k.isWritable
              })),
              programId: initTransaction.instructions[0].programId.toString(),
              dataLength: initTransaction.instructions[0].data.length,
              dataHex: initTransaction.instructions[0].data.toString('hex')
            });

            // Check network compatibility first
            console.log('Checking network compatibility...');
            console.log('Frontend connection:', {
              endpoint: this.connection._rpcEndpoint,
              commitment: this.connection.commitment
            });

            // Check if Phantom is on the right network
            console.log('Wallet object details:', {
              connected: this.wallet.connected,
              publicKey: this.wallet.publicKey?.toString(),
              sendTransaction: typeof this.wallet.sendTransaction,
              wallet: this.wallet.wallet || 'unknown'
            });

            // Try to get Phantom network info
            try {
              if (window.solana) {
                console.log('Phantom available, checking network...');
                const network = await window.solana.getNetwork?.();
                console.log('Phantom network:', network);
              }
            } catch (netError) {
              console.log('Could not get Phantom network info:', netError.message);
            }

            // CRITICAL FIX: Try using the wallet's connection instead of our connection
            console.log('🔧 Trying different connection approach...');

            // Option 1: Use wallet's connection if available
            let connectionToUse = this.connection;
            if (this.wallet.connection) {
              console.log('Using wallet connection instead of frontend connection');
              connectionToUse = this.wallet.connection;
            }

            // Check connection health
            try {
              const version = await this.connection.getVersion();
              console.log('RPC connection working, version:', version);
            } catch (rpcError) {
              console.error('RPC connection failed:', rpcError);
              throw new Error('Cannot connect to Solana RPC: ' + rpcError.message);
            }

            // Check account balance to ensure connection works
            try {
              const balance = await this.connection.getBalance(userPubkey);
              console.log('User balance:', balance / LAMPORTS_PER_SOL, 'SOL');
            } catch (balanceError) {
              console.error('Cannot get balance:', balanceError);
            }

            // STEP 1: Simulate transaction to debug any issues
            console.log('🧪 Simulating initialization transaction...');
            try {
              const simulation = await this.connection.simulateTransaction(initTransaction);
              console.log('✅ Simulation result:', simulation);

              if (simulation.value.err) {
                console.error('❌ Simulation failed:', simulation.value.err);
                console.error('📋 Simulation logs:', simulation.value.logs);
                throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
              } else {
                console.log('✅ Simulation successful!');
                console.log('📋 Simulation logs:', simulation.value.logs);
              }
            } catch (simError) {
              console.error('❌ Could not simulate transaction:', simError);
              throw new Error('Failed to simulate transaction: ' + simError.message);
            }

            // STEP 2: Verify program exists and is executable
            console.log('🔍 Checking program account...');
            try {
              const programAccount = await this.connection.getAccountInfo(this.PROGRAM_ID);
              if (!programAccount) {
                throw new Error('Program account not found! Check if program is deployed.');
              }
              console.log('✅ Program account found:', {
                executable: programAccount.executable,
                owner: programAccount.owner.toString(),
                dataLength: programAccount.data.length
              });
            } catch (progError) {
              console.error('❌ Program check failed:', progError);
              throw new Error('Program verification failed: ' + progError.message);
            }

            // STEP 3: Send transaction after simulation passes
            console.log('📤 Simulation passed, sending transaction...');
            const initTxHash = await this.wallet.sendTransaction(initTransaction, connectionToUse);
            console.log('Initialization transaction:', initTxHash);

            // Wait for confirmation
            await this.connection.confirmTransaction(initTxHash, 'confirmed');
            console.log('Initialization confirmed');
          } catch (initError) {
            console.error('Initialization failed:', initError);
            throw new Error('Failed to initialize savings account: ' + initError.message);
          }
        }

        // Now send the deposit transaction
        const depositTransaction = new Transaction();
        const depositInstruction = await this.createDepositSplInstruction(
          userPubkey,
          amountBigInt,
          mintPubkey,
          userTokenAccount.address,
          savingsTokenAccount
        );
        depositTransaction.add(depositInstruction);

        const { blockhash } = await this.connection.getRecentBlockhash();
        depositTransaction.recentBlockhash = blockhash;
        depositTransaction.feePayer = userPubkey;

        console.log('Sending SPL deposit transaction...');
        const txHash = await this.wallet.sendTransaction(depositTransaction, this.connection);
        console.log('SPL token deposit transaction:', txHash);

        return {
          hash: txHash,
          success: true,
          signature: txHash
        };
      }
    } catch (error) {
      console.error('Solana deposit error:', error);
      throw error;
    }
  }

  async approveToken(tokenAddress, spenderAddress, amount) {
    // SPL tokens don't require explicit approval like ERC20
    // The transfer is done directly during deposit
    return { success: true, message: 'SPL tokens do not require separate approval' };
  }

  // Withdrawal Operations
  async withdraw(amount, tokenAddress, destination = null) {
    if (!this.program || !this.wallet.publicKey) {
      throw new Error('Program not initialized or wallet not connected');
    }

    const userPubkey = this.wallet.publicKey;
    const amountBN = this.parseAmount(amount, tokenAddress === 'SOL' ? 9 : 6); // Assume 6 decimals for SPL tokens

    try {
      // Calculate the savings account PDA
      const [savingsAccount] = await PublicKey.findProgramAddress(
        [Buffer.from("savings"), userPubkey.toBuffer()],
        this.PROGRAM_ID
      );

      if (tokenAddress === 'SOL' || tokenAddress === 'native') {
        // Withdraw SOL from savings program
        const tx = await this.program.methods
          .withdrawSol(amountBN)
          .accounts({
            savingsAccount: savingsAccount,
            user: userPubkey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log('SOL withdrawal transaction:', tx);
        return { hash: tx, success: true, signature: tx };
      } else {
        // Withdraw SPL tokens from savings program
        const mintPubkey = new PublicKey(tokenAddress);

        // Get or create user's token account (for receiving withdrawn tokens)
        console.log('Getting/creating user token account for withdrawal...');
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
          this.connection,
          this.wallet,
          mintPubkey,
          userPubkey
        );

        // Get savings account's token account
        console.log('Getting savings token account...');
        let savingsTokenAccount;
        try {
          savingsTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.wallet,
            mintPubkey,
            savingsAccount,
            true // allowOwnerOffCurve for PDA
          );
        } catch (error) {
          console.error('Error getting savings token account for withdrawal:', error);
          // Calculate the associated token account address manually
          const { getAssociatedTokenAddress } = await import('@solana/spl-token');
          const savingsTokenAccountAddress = await getAssociatedTokenAddress(
            mintPubkey,
            savingsAccount,
            true // allowOwnerOffCurve for PDA
          );
          savingsTokenAccount = { address: savingsTokenAccountAddress };
        }

        const tx = await this.program.methods
          .withdrawSpl(amountBN)
          .accounts({
            savingsAccount: savingsAccount,
            user: userPubkey,
            userTokenAccount: userTokenAccount.address,
            savingsTokenAccount: savingsTokenAccount.address,
            mint: mintPubkey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        console.log('SPL token withdrawal transaction:', tx);
        return { hash: tx, success: true, signature: tx };
      }
    } catch (error) {
      console.error('Solana withdrawal error:', error);
      throw error;
    }
  }

  // Proxy Management (Solana equivalent)
  async isProxyDeployed(userAddress) {
    try {
      const userPubkey = new PublicKey(userAddress);
      const [savingsAccount] = await PublicKey.findProgramAddress(
        [Buffer.from("savings"), userPubkey.toBuffer()],
        this.PROGRAM_ID
      );

      const accountInfo = await this.connection.getAccountInfo(savingsAccount);
      return accountInfo !== null;
    } catch {
      return false;
    }
  }

  async getDepositAddress(userAddress) {
    // In Solana, the deposit address is the user's wallet address
    // Or we could return the PDA address for the savings account
    const userPubkey = new PublicKey(userAddress);
    const [savingsAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("savings"), userPubkey.toBuffer()],
      this.PROGRAM_ID
    );

    return savingsAccount.toString();
  }

  async deployProxy() {
    if (!this.program || !this.wallet.publicKey) {
      throw new Error('Program not initialized or wallet not connected');
    }

    const userPubkey = this.wallet.publicKey;
    const [savingsAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("savings"), userPubkey.toBuffer()],
      this.PROGRAM_ID
    );

    try {
      const tx = await this.program.methods
        .initialize()
        .accounts({
          savingsAccount: savingsAccount,
          user: userPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return {
        hash: tx,
        success: true,
        signature: tx
      };
    } catch (error) {
      console.error('Error initializing Solana savings account:', error);
      throw error;
    }
  }

  // Spending Limits (would need to be implemented in Solana program)
  async getSpendingLimits(userAddress) {
    // Placeholder - would need implementation in Solana program
    return [];
  }

  async setSpendingLimits(daily, weekly, monthly) {
    // Placeholder - would need implementation in Solana program
    throw new Error('Spending limits not yet implemented for Solana');
  }

  // Utility Methods
  formatAmount(amount, decimals) {
    const divisor = 10n ** BigInt(decimals);
    const quotient = amount / divisor;
    const remainder = amount % divisor;

    if (remainder === 0n) {
      return quotient.toString();
    }

    const remainderStr = remainder.toString().padStart(decimals, '0');
    return `${quotient.toString()}.${remainderStr}`.replace(/\.?0+$/, '');
  }

  parseAmount(amount, decimals) {
    const [whole, fraction = ''] = amount.toString().split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    const combined = whole + paddedFraction;
    return BigInt(combined);
  }

  isValidAddress(address) {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  // Network Validation
  async isCorrectNetwork() {
    // For Solana, we check if we can connect to the expected RPC endpoint
    try {
      const version = await this.connection.getVersion();
      return version !== null;
    } catch {
      return false;
    }
  }

  // Helper method to get savings account data
  async getSavingsAccountData(userAddress) {
    try {
      const userPubkey = new PublicKey(userAddress);
      const [savingsAccount] = await PublicKey.findProgramAddress(
        [Buffer.from("savings"), userPubkey.toBuffer()],
        this.PROGRAM_ID
      );

      // Fetch the account data
      const accountInfo = await this.connection.getAccountInfo(savingsAccount);
      if (!accountInfo) {
        console.log('Savings account not found for user:', userAddress);
        return null;
      }

      // Deserialize the account data using the program
      const savingsAccountData = await this.program.account.savingsAccount.fetch(savingsAccount);
      console.log('Savings account data:', savingsAccountData);

      return {
        address: savingsAccount,
        data: savingsAccountData
      };
    } catch (error) {
      console.error('Error fetching savings account data:', error);
      return null;
    }
  }

  // Private Methods
  async _initializeProgram() {
    try {
      console.log('_initializeProgram called - using Anchor library approach');

      if (!this.provider) {
        console.log('Creating AnchorProvider...');
        this.provider = new AnchorProvider(
          this.connection,
          this.wallet,
          { commitment: 'confirmed' }
        );
      }

      // Try to use Anchor Program with the IDL
      console.log('Loading Anchor program with IDL...');
      try {
        this.program = new Program(savingsCoreIdl, this.PROGRAM_ID, this.provider);
        console.log('✅ Anchor program loaded successfully:', {
          programId: this.PROGRAM_ID.toString(),
          methods: Object.keys(this.program.methods || {}),
          provider: !!this.provider
        });
      } catch (idlError) {
        console.error('Failed to load Anchor program with IDL:', idlError);
        console.log('Falling back to raw web3.js approach...');

        // Fallback to raw web3.js if Anchor fails
        this.program = {
          methods: {
            depositSol: (amount) => this._createDepositSolInstruction(amount),
            depositSpl: (amount) => this._createDepositSplInstruction(amount),
            initialize: () => this._createInitializeInstruction(),
            withdrawSol: (amount) => this._createWithdrawSolInstruction(amount),
            withdrawSpl: (amount) => this._createWithdrawSplInstruction(amount)
          },
          account: {
            savingsAccount: {
              fetch: async (address) => {
                throw new Error('Raw web3.js mode - account fetching not implemented');
              }
            }
          }
        };
        console.log('Raw web3.js fallback program initialized');
      }
    } catch (error) {
      console.error('Error initializing Solana program:', error);
      throw error;
    }
  }

  // Raw instruction builders using discriminators from IDL
  async _createDepositSolInstruction(amount) {
    const userPubkey = this.wallet.publicKey;
    const [savingsAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("savings"), userPubkey.toBuffer()],
      this.PROGRAM_ID
    );

    // Instruction data: discriminator (8 bytes) + amount (8 bytes)
    const discriminator = Buffer.from([108, 81, 78, 117, 125, 155, 56, 200]);
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount.toString()), 0);
    const data = Buffer.concat([discriminator, amountBuffer]);

    const instruction = new web3.TransactionInstruction({
      keys: [
        { pubkey: savingsAccount, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: this.PROGRAM_ID,
      data
    });

    return {
      accounts: (accountsObj) => ({
        rpc: async () => {
          const transaction = new web3.Transaction().add(instruction);
          return await this.wallet.sendTransaction(transaction, this.connection);
        }
      })
    };
  }

  async _createDepositSplInstruction(amount) {
    const userPubkey = this.wallet.publicKey;
    const [savingsAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("savings"), userPubkey.toBuffer()],
      this.PROGRAM_ID
    );

    // Instruction data: discriminator (8 bytes) + amount (8 bytes)
    const discriminator = Buffer.from([224, 0, 198, 175, 198, 47, 105, 204]);
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount.toString()), 0);
    const data = Buffer.concat([discriminator, amountBuffer]);

    // Store the instruction data for use in the accounts().rpc() call
    this._pendingInstructionData = { discriminator, amountBuffer, data, savingsAccount };

    return {
      accounts: (accountsObj) => ({
        rpc: async () => {
          // This method will be called from the deposit() method with the token account addresses
          // For now, return a promise that will be resolved by the deposit method
          return new Promise((resolve, reject) => {
            this._pendingRpcCall = { resolve, reject };
          });
        }
      })
    };
  }

  async _executeDepositSplInstruction(mintAddress, userTokenAddr, savingsTokenAddr) {
    if (!this._pendingInstructionData) {
      throw new Error('No pending instruction data');
    }

    const { data, savingsAccount } = this._pendingInstructionData;
    const userPubkey = this.wallet.publicKey;

    const instruction = new web3.TransactionInstruction({
      keys: [
        { pubkey: savingsAccount, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: userTokenAddr, isSigner: false, isWritable: true },
        { pubkey: savingsTokenAddr, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: this.PROGRAM_ID,
      data
    });

    const transaction = new web3.Transaction().add(instruction);

    try {
      const txHash = await this.wallet.sendTransaction(transaction, this.connection);
      console.log('Transaction sent successfully:', txHash);

      // Resolve the pending promise
      if (this._pendingRpcCall) {
        this._pendingRpcCall.resolve(txHash);
        this._pendingRpcCall = null;
      }
      this._pendingInstructionData = null;

      return txHash;
    } catch (error) {
      console.error('Transaction failed:', error);
      console.error('Transaction details:', {
        instruction: instruction,
        accounts: instruction.keys.map(k => ({
          pubkey: k.pubkey.toString(),
          signer: k.isSigner,
          writable: k.isWritable
        })),
        programId: instruction.programId.toString(),
        dataLength: instruction.data.length
      });

      // Reject the pending promise
      if (this._pendingRpcCall) {
        this._pendingRpcCall.reject(error);
        this._pendingRpcCall = null;
      }
      this._pendingInstructionData = null;

      throw error;
    }
  }

  async _createInitializeInstruction() {
    const userPubkey = this.wallet.publicKey;
    const [savingsAccount, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("savings"), userPubkey.toBuffer()],
      this.PROGRAM_ID
    );

    console.log('Initialize instruction details:', {
      userPubkey: userPubkey.toString(),
      savingsAccount: savingsAccount.toString(),
      bump: bump,
      programId: this.PROGRAM_ID.toString()
    });

    // Instruction data: discriminator only (no args)
    const discriminator = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

    const instruction = new web3.TransactionInstruction({
      keys: [
        { pubkey: savingsAccount, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: this.PROGRAM_ID,
      data: discriminator
    });

    return {
      accounts: (accountsObj) => ({
        rpc: async () => {
          console.log('Executing initialize instruction...');
          console.log('Transaction details:', {
            accounts: instruction.keys.map(k => ({
              pubkey: k.pubkey.toString(),
              signer: k.isSigner,
              writable: k.isWritable
            })),
            programId: instruction.programId.toString(),
            dataLength: instruction.data.length,
            discriminator: Array.from(discriminator)
          });

          try {
            const transaction = new web3.Transaction().add(instruction);

            // Add recent blockhash and fee payer
            const { blockhash } = await this.connection.getRecentBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = userPubkey;

            console.log('Sending transaction with recent blockhash:', blockhash);
            const txHash = await this.wallet.sendTransaction(transaction, this.connection);
            console.log('Initialize transaction sent successfully:', txHash);
            return txHash;
          } catch (error) {
            console.error('Initialize transaction failed:', error);
            console.error('Full error object:', {
              name: error.name,
              message: error.message,
              stack: error.stack,
              code: error.code,
              details: error.details || error.logs || error.response || error.data
            });

            // Try to get more specific error information
            if (error.logs) {
              console.error('Transaction logs:', error.logs);
            }

            throw error;
          }
        }
      })
    };
  }

  // Getters for compatibility
  getProgram() {
    return this.program;
  }

  getWallet() {
    return this.wallet;
  }

  getConnection() {
    return this.connection;
  }
}