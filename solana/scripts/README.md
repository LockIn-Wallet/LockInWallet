# Treasury Balance Monitor

This script monitors the treasury balance on localhost to track permanent address activation payments.

## Setup

Make sure you have:
1. Solana validator running on localhost (`solana-test-validator`)
2. Dependencies installed (`npm install` in the solana directory)

## Usage

```bash
# Show current treasury balance
node scripts/check-treasury-balance.js balance

# Start monitoring (runs continuously until Ctrl+C)
node scripts/check-treasury-balance.js monitor

# Show balance change history
node scripts/check-treasury-balance.js history

# Show recent transactions
node scripts/check-treasury-balance.js transactions

# Clear history file
node scripts/check-treasury-balance.js reset

# Show help
node scripts/check-treasury-balance.js
```

## What it monitors

- **Treasury Address**: `4xo6a3qHYgtsDkKUAy1wMQhyN1zoXo3tKPR5foxa3hV4`
- **Activation Fee**: `0.1 SOL` per permanent address
- **Network**: localhost (`http://127.0.0.1:8899`)

## Testing Permanent Address Generation

1. Start the monitor:
   ```bash
   node scripts/check-treasury-balance.js monitor
   ```

2. In your frontend, trigger permanent address activation by paying the 0.1 SOL fee

3. Watch for activation payments in the monitor output:
   ```
   🔑 [2024-01-01T12:00:00.000Z] Balance: 10.05372656 SOL (+0.1)
      ✨ ACTIVATION PAYMENT DETECTED! User paid 0.1 SOL for permanent address
   ```

## Output Files

- **History**: `scripts/treasury-history.json` - JSON log of all balance changes
- **Real-time**: Console output with timestamps and payment detection

## Example Output

```
🔍 Treasury Balance Monitor Starting...
📍 Treasury Address: 4xo6a3qHYgtsDkKUAy1wMQhyN1zoXo3tKPR5foxa3hV4
🌐 Network: localhost (http://127.0.0.1:8899)
💰 Activation Fee: 0.1 SOL
📝 History saved to: scripts/treasury-history.json

🚀 [2024-01-01T12:00:00.000Z] Starting treasury monitor - Initial balance: 9.95372656 SOL
🔑 [2024-01-01T12:01:15.000Z] Balance: 10.05372656 SOL (+0.1)
   ✨ ACTIVATION PAYMENT DETECTED! User paid 0.1 SOL for permanent address
💰 [2024-01-01T12:02:30.000Z] Balance: 10.25372656 SOL (+0.2)
```