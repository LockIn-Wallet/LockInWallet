#!/usr/bin/env node

/**
 * Treasury Balance History Monitor
 *
 * Monitors the treasury balance on localhost to track permanent address activation payments
 * Each activation payment should be 0.1 SOL
 */

const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const { getTreasuryConfig } = require('../config/treasury.js');

// Get environment from command line args or default to localhost
const environment = process.argv.includes('--mainnet') ? 'mainnet' :
                   process.argv.includes('--devnet') ? 'devnet' : 'localhost';

const treasuryConfig = getTreasuryConfig(environment);

// Configuration
const LOCALHOST_RPC = treasuryConfig.rpcUrl;
const TREASURY_ADDRESS = treasuryConfig.treasuryAddress;
const ACTIVATION_FEE_SOL = treasuryConfig.activationFeeSol;
const CHECK_INTERVAL_MS = 5000; // Check every 5 seconds
const HISTORY_FILE = path.join(__dirname, `treasury-history-${environment}.json`);

class TreasuryMonitor {
  constructor() {
    this.connection = new Connection(LOCALHOST_RPC, 'confirmed');
    this.treasuryPubkey = new PublicKey(TREASURY_ADDRESS);
    this.lastBalance = null;
    this.history = this.loadHistory();
    this.isRunning = false;
  }

  loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.log('📝 Creating new history file...');
    }
    return [];
  }

  saveHistory() {
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error('❌ Error saving history:', error.message);
    }
  }

  async getCurrentBalance() {
    try {
      const balance = await this.connection.getBalance(this.treasuryPubkey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('❌ Error fetching balance:', error.message);
      return null;
    }
  }

  async getRecentTransactions() {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        this.treasuryPubkey,
        { limit: 10 }
      );

      const transactions = [];
      for (const sig of signatures) {
        const tx = await this.connection.getTransaction(sig.signature, {
          commitment: 'confirmed'
        });

        if (tx && tx.meta && !tx.meta.err) {
          const preBalance = tx.meta.preBalances[0] || 0;
          const postBalance = tx.meta.postBalances[0] || 0;
          const change = (postBalance - preBalance) / LAMPORTS_PER_SOL;

          if (change > 0) {
            transactions.push({
              signature: sig.signature,
              slot: sig.slot,
              change: change,
              timestamp: sig.blockTime,
              isActivationPayment: Math.abs(change - ACTIVATION_FEE_SOL) < 0.001
            });
          }
        }
      }

      return transactions;
    } catch (error) {
      console.error('❌ Error fetching transactions:', error.message);
      return [];
    }
  }

  logEntry(entry) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...entry
    };

    this.history.push(logEntry);
    this.saveHistory();

    // Console output
    if (entry.type === 'balance_change') {
      const changeStr = entry.change > 0 ? `+${entry.change}` : entry.change.toString();
      const icon = entry.isActivationPayment ? '🔑' : entry.change > 0 ? '💰' : '📉';
      console.log(`${icon} [${timestamp}] Balance: ${entry.balance} SOL (${changeStr})`);

      if (entry.isActivationPayment) {
        console.log(`   ✨ ACTIVATION PAYMENT DETECTED! User paid ${ACTIVATION_FEE_SOL} SOL for permanent address`);
      }
    } else if (entry.type === 'startup') {
      console.log(`🚀 [${timestamp}] Starting treasury monitor - Initial balance: ${entry.balance} SOL`);
    } else if (entry.type === 'status') {
      console.log(`📊 [${timestamp}] Current balance: ${entry.balance} SOL`);
    }
  }

  async checkBalance() {
    const currentBalance = await this.getCurrentBalance();

    if (currentBalance === null) {
      return; // Error already logged
    }

    if (this.lastBalance === null) {
      // First run
      this.logEntry({
        type: 'startup',
        balance: currentBalance
      });
    } else if (currentBalance !== this.lastBalance) {
      // Balance changed
      const change = currentBalance - this.lastBalance;
      const isActivationPayment = Math.abs(change - ACTIVATION_FEE_SOL) < 0.001;

      this.logEntry({
        type: 'balance_change',
        balance: currentBalance,
        previousBalance: this.lastBalance,
        change: change,
        isActivationPayment: isActivationPayment
      });
    }

    this.lastBalance = currentBalance;
  }

  async start() {
    console.log('🔍 Treasury Balance Monitor Starting...');
    console.log(`🌐 Environment: ${environment.toUpperCase()}`);
    console.log(`📍 Treasury Address: ${TREASURY_ADDRESS}`);
    console.log(`🔗 Network: ${treasuryConfig.network} (${LOCALHOST_RPC})`);
    console.log(`💰 Activation Fee: ${ACTIVATION_FEE_SOL} SOL`);
    console.log(`📝 History saved to: ${HISTORY_FILE}`);
    console.log(`ℹ️  ${treasuryConfig.description}`);
    console.log('');

    // Check if validator is running
    try {
      await this.connection.getSlot();
    } catch (error) {
      console.error('❌ Cannot connect to Solana validator. Make sure it\'s running on localhost:8899');
      process.exit(1);
    }

    this.isRunning = true;

    // Initial balance check
    await this.checkBalance();

    // Start monitoring
    const interval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(interval);
        return;
      }
      await this.checkBalance();
    }, CHECK_INTERVAL_MS);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping treasury monitor...');
      this.isRunning = false;
      clearInterval(interval);
      console.log('💾 History saved to:', HISTORY_FILE);
      process.exit(0);
    });
  }

  async showHistory() {
    console.log('📊 Treasury Balance History:');
    console.log('');

    if (this.history.length === 0) {
      console.log('📭 No history available');
      return;
    }

    let activationCount = 0;
    let totalReceived = 0;

    this.history.forEach((entry, index) => {
      const date = new Date(entry.timestamp).toLocaleString();

      if (entry.type === 'balance_change') {
        const changeStr = entry.change > 0 ? `+${entry.change}` : entry.change.toString();
        const icon = entry.isActivationPayment ? '🔑' : entry.change > 0 ? '💰' : '📉';
        console.log(`${icon} ${date} | Balance: ${entry.balance} SOL (${changeStr})`);

        if (entry.isActivationPayment) {
          activationCount++;
          console.log(`   ✨ Activation payment detected`);
        }

        if (entry.change > 0) {
          totalReceived += entry.change;
        }
      } else if (entry.type === 'startup') {
        console.log(`🚀 ${date} | Monitor started - Balance: ${entry.balance} SOL`);
      }
    });

    console.log('');
    console.log('📈 Summary:');
    console.log(`   🔑 Total activation payments: ${activationCount}`);
    console.log(`   💰 Total SOL received: ${totalReceived.toFixed(4)} SOL`);
    console.log(`   📝 History entries: ${this.history.length}`);
  }

  async showRecentTransactions() {
    console.log('🔍 Fetching recent treasury transactions...');
    const transactions = await this.getRecentTransactions();

    if (transactions.length === 0) {
      console.log('📭 No recent transactions found');
      return;
    }

    console.log('');
    console.log('📊 Recent Treasury Transactions:');
    transactions.forEach(tx => {
      const date = tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : 'Unknown';
      const icon = tx.isActivationPayment ? '🔑' : '💰';
      console.log(`${icon} ${date} | +${tx.change} SOL | ${tx.signature.slice(0, 12)}...`);
      if (tx.isActivationPayment) {
        console.log(`   ✨ Permanent address activation payment`);
      }
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const monitor = new TreasuryMonitor();

  switch (command) {
    case 'monitor':
    case 'start':
      await monitor.start();
      break;

    case 'history':
      await monitor.showHistory();
      break;

    case 'balance':
      console.log('💰 Current Treasury Balance:');
      const balance = await monitor.getCurrentBalance();
      if (balance !== null) {
        console.log(`   ${balance} SOL`);
      }
      break;

    case 'transactions':
    case 'tx':
      await monitor.showRecentTransactions();
      break;

    case 'reset':
      if (fs.existsSync(HISTORY_FILE)) {
        fs.unlinkSync(HISTORY_FILE);
        console.log('🗑️  History file deleted');
      } else {
        console.log('📭 No history file found');
      }
      break;

    default:
      console.log('🔍 Treasury Balance Monitor');
      console.log('');
      console.log('Commands:');
      console.log('  monitor     Start monitoring treasury balance');
      console.log('  history     Show balance change history');
      console.log('  balance     Show current treasury balance');
      console.log('  transactions Show recent treasury transactions');
      console.log('  reset       Clear history file');
      console.log('');
      console.log('Environment Flags:');
      console.log('  --devnet    Use devnet/production treasury');
      console.log('  --mainnet   Use mainnet treasury');
      console.log('  (default)   Use localhost random treasury');
      console.log('');
      console.log('Examples:');
      console.log('  node check-treasury-balance.js monitor');
      console.log('  node check-treasury-balance.js balance --devnet');
      console.log('  node check-treasury-balance.js history --mainnet');
      console.log('');
      console.log('Treasury Addresses:');
      console.log(`  🧪 Localhost: Aa1wdTb1h3NyRKVBZTahZhWBWMWKCS1bZgLJ7amVAzLd`);
      console.log(`  🔧 Devnet:    4xo6a3qHYgtsDkKUAy1wMQhyN1zoXo3tKPR5foxa3hV4`);
      console.log(`  🚀 Mainnet:   4xo6a3qHYgtsDkKUAy1wMQhyN1zoXo3tKPR5foxa3hV4`);
      break;
  }
}

// Handle async errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script error:', error);
    process.exit(1);
  });
}

module.exports = TreasuryMonitor;