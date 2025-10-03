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
  // Savings Core Program
  Initialize: [175, 175, 109, 31, 13, 152, 155, 237],
  DepositSol: [108, 81, 78, 117, 125, 155, 56, 200],
  DepositSpl: [224, 0, 198, 175, 198, 47, 105, 204],
  DepositSolSelf: [253, 113, 121, 194, 75, 233, 114, 223],
  DepositSplSelf: [177, 32, 212, 139, 117, 61, 41, 95],
  WithdrawSol: [145, 131, 74, 136, 65, 137, 42, 38],
  WithdrawSpl: [181, 154, 94, 86, 62, 115, 6, 186],

  // Spending Limits Instructions
  InitializeSpendingLimits: [132, 244, 107, 216, 88, 45, 100, 151],
  AddTimePeriodLimit: [241, 38, 147, 173, 91, 158, 235, 140],
  RemoveTimePeriodLimit: [163, 89, 201, 108, 241, 71, 88, 142],
  SetCommonPeriodLimits: [122, 159, 89, 124, 201, 88, 156, 167],
  CommitInitialSetup: [89, 145, 201, 124, 88, 178, 201, 147],
  GetSpendingLimits: [178, 91, 124, 88, 201, 147, 89, 124],
  WithdrawSolWithLimits: [201, 124, 89, 147, 178, 91, 88, 201],
  WithdrawSplWithLimits: [147, 178, 91, 201, 124, 89, 147, 88],

  // Deposit Proxy Program (auto-generated on 2025-10-03)
  InitializeProxy: [245, 74, 175, 136, 0, 146, 100, 224],
  ForwardSolDeposit: [29, 156, 48, 213, 90, 128, 229, 58],
  ForwardSplDeposit: [131, 71, 27, 250, 233, 24, 75, 240]
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
    this.PROGRAM_ID = new PublicKey("HNi2JKTNeHvz2ENckdVBW1ncfkJUYppuYeBwNhWjkK7d"); // Updated 2025-10-03
    this.DEPOSIT_PROXY_PROGRAM_ID = new PublicKey("4Tr7zEp7p5YtvXNAK98UnEUUpYP9q87sgKBJjfgfNtr4"); // Updated 2025-10-03

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

    return this.createInstruction('DepositSolSelf', accounts, { amount });
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

    return this.createInstruction('DepositSplSelf', accounts, { amount });
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
    // Return the permanent deposit proxy address for this user
    const userPubkey = new PublicKey(userAddress);
    const [depositProxy] = await PublicKey.findProgramAddress(
      [Buffer.from("deposit_proxy"), userPubkey.toBuffer()],
      this.DEPOSIT_PROXY_PROGRAM_ID
    );

    return depositProxy.toString();
  }

  async deployProxy() {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    // Deploy deposit proxy first, then initialize savings account if needed
    await this.initializeDepositProxy();

    const userPubkey = this.wallet.publicKey;
    const [savingsAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("savings"), userPubkey.toBuffer()],
      this.PROGRAM_ID
    );

    // Check if savings account already exists
    const accountInfo = await this.connection.getAccountInfo(savingsAccount);
    if (accountInfo) {
      console.log('Savings account already exists');
      return {
        hash: 'already_exists',
        success: true,
        signature: 'already_exists'
      };
    }

    // Initialize savings account
    try {
      const instruction = await this.createInitializeInstruction(userPubkey);
      const transaction = new Transaction().add(instruction);

      const signature = await this.wallet.sendTransaction(transaction, this.connection);
      await this.connection.confirmTransaction(signature, 'confirmed');

      console.log('✅ Savings account initialized:', signature);

      return {
        hash: signature,
        success: true,
        signature: signature
      };
    } catch (error) {
      console.error('Error initializing Solana savings account:', error);
      throw error;
    }
  }

  async initializeDepositProxy() {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    const userPubkey = this.wallet.publicKey;
    const [depositProxy] = await PublicKey.findProgramAddress(
      [Buffer.from("deposit_proxy"), userPubkey.toBuffer()],
      this.DEPOSIT_PROXY_PROGRAM_ID
    );

    // Check if proxy already exists
    const proxyInfo = await this.connection.getAccountInfo(depositProxy);
    if (proxyInfo) {
      console.log('Deposit proxy already exists');
      return depositProxy.toString();
    }

    try {
      // Create initialize proxy instruction
      const instructionData = new Uint8Array([
        ...INSTRUCTION_DISCRIMINATORS.InitializeProxy
      ]);

      const accounts = [
        { pubkey: depositProxy, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: this.PROGRAM_ID, isSigner: false, isWritable: false }, // savings_program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ];

      const instruction = new TransactionInstruction({
        keys: accounts,
        programId: this.DEPOSIT_PROXY_PROGRAM_ID,
        data: instructionData
      });

      const transaction = new Transaction().add(instruction);

      // Set recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPubkey;

      const signature = await this.wallet.sendTransaction(transaction, this.connection);
      await this.connection.confirmTransaction(signature, 'confirmed');

      console.log('✅ Deposit proxy initialized:', signature);
      return depositProxy.toString();
    } catch (error) {
      console.error('Error initializing deposit proxy:', error);
      throw error;
    }
  }

  async isProxyDeployed(userAddress) {
    const userPubkey = new PublicKey(userAddress);
    const [depositProxy] = await PublicKey.findProgramAddress(
      [Buffer.from("deposit_proxy"), userPubkey.toBuffer()],
      this.DEPOSIT_PROXY_PROGRAM_ID
    );

    const proxyInfo = await this.connection.getAccountInfo(depositProxy);
    return proxyInfo !== null;
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

      // Manually deserialize the account data (since we're using pure web3.js)
      const data = accountInfo.data;

      // Skip the 8-byte discriminator and read the account data
      // Based on the SavingsAccount struct: owner(32) + sol_balance(8) + spl_balances(vec) + bump(1) + created_at(8) + updated_at(8)
      let offset = 8; // Skip discriminator

      // Read owner (32 bytes)
      const owner = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      // Read sol_balance (8 bytes, little-endian u64)
      const solBalance = new DataView(data.buffer, data.byteOffset + offset, 8).getBigUint64(0, true);
      offset += 8;

      // Read spl_balances vector length (4 bytes, little-endian u32)
      const splBalancesLength = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true);
      offset += 4;

      const splBalances = [];
      for (let i = 0; i < splBalancesLength; i++) {
        // Read mint (32 bytes)
        const mint = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        // Read amount (8 bytes, little-endian u64)
        const amount = new DataView(data.buffer, data.byteOffset + offset, 8).getBigUint64(0, true);
        offset += 8;

        splBalances.push({ mint: mint.toString(), amount: amount.toString() });
      }

      const savingsAccountData = {
        owner: owner.toString(),
        solBalance: solBalance.toString(),
        splBalances
      };

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

  // ========== SPENDING LIMITS FUNCTIONALITY ==========

  // Helper function to generate discriminators (from actual IDL)
  _generateDiscriminator(methodName) {
    // Actual discriminators from anchor build IDL
    const discriminators = {
      'InitializeSpendingLimits': [240, 49, 54, 19, 46, 201, 202, 42],
      'AddTimePeriodLimit': [241, 217, 123, 93, 14, 188, 236, 51],
      'RemoveTimePeriodLimit': [163, 89, 201, 108, 241, 71, 88, 142], // TODO: Get actual discriminator
      'SetCommonPeriodLimits': [200, 130, 17, 128, 169, 59, 33, 89],
      'CommitInitialSetup': [248, 193, 240, 26, 1, 132, 74, 226],
      'GetSpendingLimits': [178, 91, 124, 88, 201, 147, 89, 124], // TODO: Get actual discriminator
      'WithdrawSolWithLimits': [201, 124, 89, 147, 178, 91, 88, 201], // TODO: Get actual discriminator
      'WithdrawSplWithLimits': [147, 178, 91, 201, 124, 89, 147, 88] // TODO: Get actual discriminator
    };
    return discriminators[methodName] || [0, 0, 0, 0, 0, 0, 0, 0];
  }

  // Get spending limits PDA
  async getSpendingLimitsPDA(userPubkey) {
    return await PublicKey.findProgramAddress(
      [Buffer.from("spending_limits"), userPubkey.toBuffer()],
      this.PROGRAM_ID
    );
  }

  // Initialize spending limits account
  async initializeSpendingLimits() {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    const userPubkey = this.wallet.publicKey;
    const [spendingLimitsAccount] = await this.getSpendingLimitsPDA(userPubkey);

    const discriminator = Buffer.from(this._generateDiscriminator('InitializeSpendingLimits'));

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: spendingLimitsAccount, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: this.PROGRAM_ID,
      data: discriminator
    });

    const transaction = new Transaction().add(instruction);
    return await this.wallet.sendTransaction(transaction, this.connection);
  }

  // Set common period limits (Daily, Weekly, Monthly)
  async setCommonPeriodLimits(dailyLimit, weeklyLimit, monthlyLimit) {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    const userPubkey = this.wallet.publicKey;
    const [spendingLimitsAccount] = await this.getSpendingLimitsPDA(userPubkey);

    // Check if spending limits account exists, if not initialize it first
    try {
      const accountInfo = await this.connection.getAccountInfo(spendingLimitsAccount);
      if (!accountInfo) {
        console.log('Spending limits account does not exist, initializing...');
        await this.initializeSpendingLimits();
        console.log('Spending limits account initialized successfully');
      }
    } catch (error) {
      console.error('Error checking/initializing spending limits account:', error);
      throw error;
    }

    // Serialize the data: discriminator + 3 optional u64 values
    const discriminator = Buffer.from(this._generateDiscriminator('SetCommonPeriodLimits'));

    // Encode optional values (1 byte for Some/None + 8 bytes for u64 if Some)
    let data = discriminator;

    // Daily limit
    if (dailyLimit !== null && dailyLimit !== undefined) {
      data = Buffer.concat([data, Buffer.from([1])]);  // Some
      const dailyBuffer = Buffer.alloc(8);
      dailyBuffer.writeBigUInt64LE(BigInt(Math.floor(dailyLimit * 1000000)), 0); // Convert to lamports/smallest unit
      data = Buffer.concat([data, dailyBuffer]);
    } else {
      data = Buffer.concat([data, Buffer.from([0])]);  // None
    }

    // Weekly limit
    if (weeklyLimit !== null && weeklyLimit !== undefined) {
      data = Buffer.concat([data, Buffer.from([1])]);  // Some
      const weeklyBuffer = Buffer.alloc(8);
      weeklyBuffer.writeBigUInt64LE(BigInt(Math.floor(weeklyLimit * 1000000)), 0);
      data = Buffer.concat([data, weeklyBuffer]);
    } else {
      data = Buffer.concat([data, Buffer.from([0])]);  // None
    }

    // Monthly limit
    if (monthlyLimit !== null && monthlyLimit !== undefined) {
      data = Buffer.concat([data, Buffer.from([1])]);  // Some
      const monthlyBuffer = Buffer.alloc(8);
      monthlyBuffer.writeBigUInt64LE(BigInt(Math.floor(monthlyLimit * 1000000)), 0);
      data = Buffer.concat([data, monthlyBuffer]);
    } else {
      data = Buffer.concat([data, Buffer.from([0])]);  // None
    }

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: spendingLimitsAccount, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true }
      ],
      programId: this.PROGRAM_ID,
      data
    });

    const transaction = new Transaction().add(instruction);
    return await this.wallet.sendTransaction(transaction, this.connection);
  }

  // Add custom time period limit
  async addTimePeriodLimit(name, limit, duration) {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    const userPubkey = this.wallet.publicKey;
    const [spendingLimitsAccount] = await this.getSpendingLimitsPDA(userPubkey);

    // Serialize the data: discriminator + name (string) + limit (u64) + duration (u64)
    const discriminator = Buffer.from(this._generateDiscriminator('AddTimePeriodLimit'));

    // String encoding: length (4 bytes) + string bytes
    const nameBytes = Buffer.from(name, 'utf8');
    const nameLength = Buffer.alloc(4);
    nameLength.writeUInt32LE(nameBytes.length, 0);

    // Amount encoding (convert to smallest unit)
    const limitBuffer = Buffer.alloc(8);
    limitBuffer.writeBigUInt64LE(BigInt(Math.floor(limit * 1000000)), 0);

    // Duration encoding (seconds)
    const durationBuffer = Buffer.alloc(8);
    durationBuffer.writeBigUInt64LE(BigInt(duration), 0);

    const data = Buffer.concat([discriminator, nameLength, nameBytes, limitBuffer, durationBuffer]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: spendingLimitsAccount, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true }
      ],
      programId: this.PROGRAM_ID,
      data
    });

    const transaction = new Transaction().add(instruction);
    return await this.wallet.sendTransaction(transaction, this.connection);
  }

  // Remove time period limit
  async removeTimePeriodLimit(name) {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    const userPubkey = this.wallet.publicKey;
    const [spendingLimitsAccount] = await this.getSpendingLimitsPDA(userPubkey);

    // Serialize the data: discriminator + name (string)
    const discriminator = Buffer.from(this._generateDiscriminator('RemoveTimePeriodLimit'));

    const nameBytes = Buffer.from(name, 'utf8');
    const nameLength = Buffer.alloc(4);
    nameLength.writeUInt32LE(nameBytes.length, 0);

    const data = Buffer.concat([discriminator, nameLength, nameBytes]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: spendingLimitsAccount, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true }
      ],
      programId: this.PROGRAM_ID,
      data
    });

    const transaction = new Transaction().add(instruction);
    return await this.wallet.sendTransaction(transaction, this.connection);
  }

  // Commit initial setup
  async commitInitialSetup() {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    const userPubkey = this.wallet.publicKey;
    const [spendingLimitsAccount] = await this.getSpendingLimitsPDA(userPubkey);

    const discriminator = Buffer.from(this._generateDiscriminator('CommitInitialSetup'));

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: spendingLimitsAccount, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: true }
      ],
      programId: this.PROGRAM_ID,
      data: discriminator
    });

    const transaction = new Transaction().add(instruction);
    return await this.wallet.sendTransaction(transaction, this.connection);
  }

  // Fetch spending limits from account
  async getSpendingLimits() {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      const userPubkey = this.wallet.publicKey;
      const [spendingLimitsAccount] = await this.getSpendingLimitsPDA(userPubkey);

      // Check if account exists
      const accountInfo = await this.connection.getAccountInfo(spendingLimitsAccount);
      if (!accountInfo || !accountInfo.data) {
        console.log('Spending limits account not found, returning empty limits');
        return {
          limits: [],
          isSetupCommitted: false,
          totalLockedValue: 0
        };
      }

      // For now, return placeholder data - this should be properly decoded from the account data
      // TODO: Implement proper account data deserialization based on the Rust struct
      return {
        limits: [], // Should decode TimePeriodLimit[] from account data
        isSetupCommitted: false, // Should decode from UserSetupData
        totalLockedValue: 0 // Should decode from UserSetupData
      };
    } catch (error) {
      console.error('Error fetching spending limits:', error);
      return {
        limits: [],
        isSetupCommitted: false,
        totalLockedValue: 0
      };
    }
  }

  // Withdraw with spending limits validation
  async withdrawWithLimits(tokenAddress, amount, tokenDecimals) {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    const userPubkey = this.wallet.publicKey;
    const [savingsAccount] = await PublicKey.findProgramAddress(
      [Buffer.from("savings"), userPubkey.toBuffer()],
      this.PROGRAM_ID
    );
    const [spendingLimitsAccount] = await this.getSpendingLimitsPDA(userPubkey);

    const amountBigInt = this.parseAmount(amount, tokenDecimals);

    if (tokenAddress === 'SOL' || tokenAddress === 'native') {
      // SOL withdrawal with limits
      const discriminator = Buffer.from(this._generateDiscriminator('WithdrawSolWithLimits'));
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigUInt64LE(amountBigInt, 0);
      const data = Buffer.concat([discriminator, amountBuffer]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: savingsAccount, isSigner: false, isWritable: true },
          { pubkey: spendingLimitsAccount, isSigner: false, isWritable: true },
          { pubkey: userPubkey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId: this.PROGRAM_ID,
        data
      });

      const transaction = new Transaction().add(instruction);
      return await this.wallet.sendTransaction(transaction, this.connection);
    } else {
      // SPL token withdrawal with limits - more complex, needs token accounts
      const mintPubkey = new PublicKey(tokenAddress);
      const userTokenAccount = await getAssociatedTokenAddress(mintPubkey, userPubkey);
      const savingsTokenAccount = await getAssociatedTokenAddress(mintPubkey, savingsAccount, true);

      const discriminator = Buffer.from(this._generateDiscriminator('WithdrawSplWithLimits'));
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigUInt64LE(amountBigInt, 0);
      const data = Buffer.concat([discriminator, amountBuffer]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: savingsAccount, isSigner: false, isWritable: true },
          { pubkey: spendingLimitsAccount, isSigner: false, isWritable: true },
          { pubkey: userPubkey, isSigner: true, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: savingsTokenAccount, isSigner: false, isWritable: true },
          { pubkey: mintPubkey, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
        ],
        programId: this.PROGRAM_ID,
        data
      });

      const transaction = new Transaction().add(instruction);
      return await this.wallet.sendTransaction(transaction, this.connection);
    }
  }
}