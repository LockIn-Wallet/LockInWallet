import { Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Program, AnchorProvider, BN, web3 } from '@coral-xyz/anchor';
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferInstruction
} from '@solana/spl-token';
import { BlockchainAdapter } from './BlockchainAdapter.js';
import savingsCoreIdl from '../savings_core.json';

/**
 * Solana Blockchain Adapter for Phantom wallet and Anchor integration
 */
export class SolanaAdapter extends BlockchainAdapter {
  constructor(networkConfig, wallet, connection) {
    super(networkConfig);
    this.wallet = wallet;
    this.connection = connection;
    this.program = null;
    this.provider = null;
    this.userAddress = null;
    this.PROGRAM_ID = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // From lib.rs

    // Initialize program if wallet is already connected
    if (this.wallet?.connected && this.wallet?.publicKey) {
      this.userAddress = this.wallet.publicKey.toString();
      this._initializeProgram().catch(console.error);
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

      // Set up Anchor provider and program
      this.provider = new AnchorProvider(
        this.connection,
        this.wallet,
        { commitment: 'confirmed' }
      );

      // Initialize program (we'll need the IDL)
      await this._initializeProgram();

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
    this.program = null;
    this.provider = null;
  }

  async getAddress() {
    return this.wallet?.publicKey?.toString() || null;
  }

  async switchNetwork(networkConfig) {
    // Solana wallets typically handle network switching internally
    // Update our connection and reinitialize
    this.networkConfig = networkConfig;
    this.connection = new Connection(networkConfig.rpcUrl, 'confirmed');

    if (this.wallet.connected) {
      this.provider = new AnchorProvider(
        this.connection,
        this.wallet,
        { commitment: 'confirmed' }
      );
      await this._initializeProgram();
    }
  }

  // Balance Management
  async getTokenBalance(userAddress, tokenAddress) {
    const pubkey = new PublicKey(userAddress);

    if (tokenAddress === 'SOL' || tokenAddress === 'native') {
      // Get SOL balance
      const balance = await this.connection.getBalance(pubkey);
      return new BN(balance);
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
        return new BN(tokenAccount.amount.toString());
      } catch (error) {
        console.error('Error getting SPL token balance:', error);
        return new BN(0);
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
        balances['SOL'] = this.formatAmount(new BN(solBalance.toString()), 9);
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
                balances[key] = this.formatAmount(new BN(splBalance.amount.toString()), token.decimals);
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

  // Deposit Operations
  async deposit(tokenAddress, amount, tokenDecimals) {
    console.log('SolanaAdapter deposit called with:', {
      tokenAddress,
      amount,
      tokenDecimals,
      program: !!this.program,
      wallet: !!this.wallet,
      publicKey: !!this.wallet?.publicKey,
      connected: this.wallet?.connected,
      walletType: typeof this.wallet,
      walletKeys: this.wallet ? Object.keys(this.wallet) : [],
      sendTransactionExists: !!this.wallet?.sendTransaction
    });

    // Initialize program if not already initialized
    if (!this.program && this.wallet?.connected && this.wallet?.publicKey) {
      console.log('Initializing program on-demand...');
      await this._initializeProgram();
    }

    if (!this.program || !this.wallet.publicKey) {
      throw new Error('Program not initialized or wallet not connected');
    }

    const userPubkey = this.wallet.publicKey;
    const amountBN = this.parseAmount(amount, tokenDecimals);

    console.log('Processing deposit:', {
      userPubkey: userPubkey.toString(),
      amount: amount,
      amountBN: amountBN.toString(),
      tokenAddress
    });

    try {
      if (tokenAddress === 'SOL' || tokenAddress === 'native') {
        // Real SOL deposit to savings program
        console.log('Creating real SOL deposit to savings program...');

        // Calculate the savings account PDA
        const [savingsAccount, bump] = await PublicKey.findProgramAddress(
          [Buffer.from("savings"), userPubkey.toBuffer()],
          this.PROGRAM_ID
        );

        console.log('Savings account PDA:', savingsAccount.toString());

        // Call the depositSol program method
        const tx = await this.program.methods
          .depositSol(amountBN)
          .accounts({
            savingsAccount: savingsAccount,
            user: userPubkey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log('SOL deposit transaction:', tx);

        return {
          hash: tx,
          success: true,
          signature: tx
        };
      } else {
        // Real SPL token deposit to savings program
        console.log('Creating real SPL token deposit to savings program...');

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

        // Get savings account's token account (this can be created on-demand)
        console.log('Creating associated token account for savings PDA...');
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
          console.error('Error creating savings token account:', error);
          // The issue might be that we need to use a different approach for PDA-owned token accounts
          // Let's manually calculate the associated token account address
          const { getAssociatedTokenAddress } = await import('@solana/spl-token');
          const savingsTokenAccountAddress = await getAssociatedTokenAddress(
            mintPubkey,
            savingsAccount,
            true // allowOwnerOffCurve for PDA
          );

          console.log('Manually calculated savings token account address:', savingsTokenAccountAddress.toString());
          savingsTokenAccount = { address: savingsTokenAccountAddress };
        }

        console.log('Token accounts:', {
          userTokenAccount: userTokenAccount.address.toString(),
          savingsTokenAccount: savingsTokenAccount.address.toString(),
          mint: mintPubkey.toString()
        });

        // Call the depositSpl program method
        const tx = await this.program.methods
          .depositSpl(amountBN)
          .accounts({
            savingsAccount: savingsAccount,
            user: userPubkey,
            userTokenAccount: userTokenAccount.address,
            savingsTokenAccount: savingsTokenAccount.address,
            mint: mintPubkey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log('SPL token deposit transaction:', tx);

        return {
          hash: tx,
          success: true,
          signature: tx
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
    const divisor = new BN(10).pow(new BN(decimals));
    const quotient = amount.div(divisor);
    const remainder = amount.mod(divisor);

    if (remainder.isZero()) {
      return quotient.toString();
    }

    const remainderStr = remainder.toString().padStart(decimals, '0');
    return `${quotient.toString()}.${remainderStr}`.replace(/\.?0+$/, '');
  }

  parseAmount(amount, decimals) {
    const [whole, fraction = ''] = amount.toString().split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    const combined = whole + paddedFraction;
    return new BN(combined);
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
      console.log('_initializeProgram called with real program IDL');

      if (!this.provider) {
        console.log('Creating AnchorProvider...');
        this.provider = new AnchorProvider(
          this.connection,
          this.wallet,
          { commitment: 'confirmed' }
        );
      }

      // Initialize the actual Anchor program with IDL
      console.log('Creating Program instance with IDL...');
      this.program = new Program(savingsCoreIdl, this.PROGRAM_ID, this.provider);

      console.log('Solana savings program initialized successfully:', {
        programId: this.PROGRAM_ID.toString(),
        methods: Object.keys(this.program.methods || {}),
        provider: !!this.provider
      });
    } catch (error) {
      console.error('Error initializing Solana program:', error);
      throw error;
    }
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