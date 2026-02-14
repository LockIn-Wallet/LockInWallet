# DIAGNOSTIC TOOLS & UTILITIES

This document provides comprehensive guidance for diagnosing, monitoring, and maintaining your deployed Savings Wallet smart contracts on Polygon and other EVM networks.

## 📋 Overview

The diagnostic tools are organized into categories based on their primary use case:
- **System Health Monitoring** - Overall contract status and functionality
- **Contract Verification** - Deployment status and code verification
- **Transaction Analysis** - Transaction history and cost analysis
- **Gas & Cost Estimation** - Planning and optimization tools
- **Development & Testing** - Development workflow support

## 🔍 SYSTEM HEALTH MONITORING

### `final-status.js` - Complete System Health Check
**Purpose:** Comprehensive health check of entire deployed system

```bash
npx hardhat run scripts/final-status.js --network polygon
```

**What it checks:**
- All contract deployments and code verification
- Module registration status with SavingsCore
- Basic functionality testing (spending limits, setup status)
- Contract addresses and network configuration
- Deployment cost summary

**Output Example:**
```
✅ ALL DEPLOYED CONTRACTS:
SavingsCore (Main):     0x09AC25686Fb2aB3ce5cF6b92F84C90E9BBdA8e93
TimePeriodLimitsModule: 0x0E8DB1A3dAed303F73Ec62b2bcd5EE37726b08c5
...

🔍 VERIFYING CONTRACT DEPLOYMENT:
savingsCore         : ✅ DEPLOYED
timePeriodLimits    : ✅ DEPLOYED
...
```

### `validate-deployment.js` - Deployment Validation
**Purpose:** Validates deployment integrity and module connections

```bash
npx hardhat run scripts/validate-deployment.js --network polygon
```

**What it validates:**
- Module registration with correct IDs
- Contract method accessibility
- Module cross-references and dependencies
- Frontend ABI compatibility

## 📊 CONTRACT VERIFICATION

### `check-all-addresses.js` - Multi-Contract Verification
**Purpose:** Verify deployment status across multiple nonce addresses

```bash
npx hardhat run scripts/check-all-addresses.js --network polygon
```

**Use Cases:**
- After partial deployment failures
- When deployment was interrupted
- Identifying which contracts need redeployment

**Output Example:**
```
Nonce 0: 0x36f13... - ❌ NO CODE (SavingsCore (OLD))
Nonce 5: 0x09AC25... - ✅ HAS CODE (SavingsCore (WORKING))
...
```

### `find-deployed-contracts.js` - Contract Discovery
**Purpose:** Discover contracts deployed by specific address

```bash
npx hardhat run scripts/find-deployed-contracts.js --network polygon
```

**What it provides:**
- Polygonscan links for manual verification
- Expected vs actual deployment count
- Guidance for next steps based on deployment status

## 🔄 TRANSACTION ANALYSIS

### `get-recent-txs.js` - Address Calculation & Verification
**Purpose:** Calculate deterministic contract addresses and verify deployment

```bash
npx hardhat run scripts/get-recent-txs.js --network polygon
```

**Key Features:**
- Uses CREATE opcode address calculation
- Verifies contracts have deployed code
- Maps nonces to expected contract types
- Provides main contract address for frontend

**How it works:**
```javascript
// Deterministic address calculation
const contractAddress = ethers.getCreateAddress({
  from: deployer.address,
  nonce: expectedNonce
});
```

## ⛽ GAS & COST ESTIMATION

### `gas-estimation.js` - Comprehensive Gas Analysis
**Purpose:** Estimate gas costs for various contract operations

```bash
npx hardhat run scripts/gas-estimation.js --network polygon
```

**Estimates costs for:**
- Contract deployment (each module)
- User operations (setup, deposits, withdrawals)
- Administrative operations (module registration, upgrades)
- Proposal system operations

### `estimate-polygon-costs.js` - Network-Specific Cost Planning
**Purpose:** Polygon-specific cost estimation and planning

```bash
npx hardhat run scripts/estimate-polygon-costs.js --network polygon
```

**Provides:**
- Current gas prices on Polygon
- POL price estimates
- Total deployment cost projections
- Operational cost breakdowns

### `setup-cost-calculator.js` - User Setup Cost Analysis
**Purpose:** Calculate costs for end-user wallet setup operations

```bash
npx hardhat run scripts/setup-cost-calculator.js --network polygon
```

**User operation costs:**
- Initial wallet setup with limits
- Adding withdrawal addresses
- Creating spending limit proposals
- Emergency bypass operations

## 🧪 DEVELOPMENT & TESTING

### `simple-contract-test.js` - Basic Contract Testing
**Purpose:** Quick functional testing of deployed contracts

```bash
npx hardhat run scripts/simple-contract-test.js --network polygon
```

**Tests:**
- Contract method calls
- Basic state queries
- Error handling

### `test-withdrawal-data.js` - Withdrawal System Testing
**Purpose:** Test withdrawal address management functionality

```bash
npx hardhat run scripts/test-withdrawal-data.js --network polygon
```

**Coverage:**
- Withdrawal address addition/removal
- Pending request management
- Timelock functionality

### `test-withdrawal-functions.js` - Function-Specific Testing
**Purpose:** Detailed testing of withdrawal-related functions

```bash
npx hardhat run scripts/test-withdrawal-functions.js --network polygon
```

## 🔧 MAINTENANCE UTILITIES

### `register-modules.js` - Module Registration
**Purpose:** Register existing modules with SavingsCore

```bash
npx hardhat run scripts/register-modules.js --network polygon
```

**When to use:**
- After individual module upgrades
- When module registration fails during deployment
- For connecting existing modules to new core

### `update-frontend-addresses.js` - Frontend Configuration
**Purpose:** Update frontend configuration with new contract addresses

```bash
npx hardhat run scripts/update-frontend-addresses.js --network polygon
```

**Updates:**
- networkConfig.json with new addresses
- Module address mappings
- ABI synchronization

## 📈 MONITORING WORKFLOWS

### Daily Health Check Routine
```bash
# 1. System overview
npx hardhat run scripts/final-status.js --network polygon

# 2. Cost monitoring (if needed)
npx hardhat run scripts/estimate-polygon-costs.js --network polygon

# 3. Functional testing (if issues detected)
npx hardhat run scripts/simple-contract-test.js --network polygon
```

### Deployment Issue Diagnosis
```bash
# 1. Check deployment status
npx hardhat run scripts/check-all-addresses.js --network polygon

# 2. Verify expected addresses
npx hardhat run scripts/get-recent-txs.js --network polygon

# 3. Find missing contracts
npx hardhat run scripts/find-deployed-contracts.js --network polygon

# 4. Validate working contracts
npx hardhat run scripts/validate-deployment.js --network polygon
```

### Performance & Cost Analysis
```bash
# 1. Current gas costs
npx hardhat run scripts/gas-estimation.js --network polygon

# 2. Network-specific costs
npx hardhat run scripts/estimate-polygon-costs.js --network polygon

# 3. User operation costs
npx hardhat run scripts/setup-cost-calculator.js --network polygon
```

### Pre-Upgrade Verification
```bash
# 1. Document current state
npx hardhat run scripts/final-status.js --network polygon

# 2. Test all functions
npx hardhat run scripts/simple-contract-test.js --network polygon
npx hardhat run scripts/test-withdrawal-data.js --network polygon

# 3. Estimate upgrade costs
npx hardhat run scripts/gas-estimation.js --network polygon
```

## 🚨 TROUBLESHOOTING GUIDE

### Common Issues & Solutions

#### "No code at address" Error
**Symptoms:** Contract address shows no deployed code
**Diagnosis:**
```bash
npx hardhat run scripts/check-all-addresses.js --network polygon
npx hardhat run scripts/get-recent-txs.js --network polygon
```
**Solutions:**
- Verify transaction was successful on block explorer
- Check if contract was deployed at different nonce
- Redeploy missing contracts

#### "Module not registered" Error
**Symptoms:** Contract methods fail with authorization errors
**Diagnosis:**
```bash
npx hardhat run scripts/validate-deployment.js --network polygon
```
**Solutions:**
```bash
npx hardhat run scripts/register-modules.js --network polygon
```

#### High Gas Costs
**Symptoms:** Transactions fail due to gas limits
**Diagnosis:**
```bash
npx hardhat run scripts/gas-estimation.js --network polygon
npx hardhat run scripts/estimate-polygon-costs.js --network polygon
```
**Solutions:**
- Wait for lower network congestion
- Increase gas limit
- Optimize contract calls

#### Frontend Connection Issues
**Symptoms:** Frontend can't connect to contracts
**Diagnosis:**
```bash
npx hardhat run scripts/final-status.js --network polygon
```
**Solutions:**
```bash
npx hardhat run scripts/update-frontend-addresses.js --network polygon
```

## 📝 SCRIPT CUSTOMIZATION

### Adding Custom Diagnostics

To create custom diagnostic scripts, follow this pattern:

```javascript
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Custom Diagnostic Check...");

  try {
    const [deployer] = await ethers.getSigners();
    const provider = deployer.provider;

    // Your diagnostic logic here

    console.log("✅ Diagnostic complete");
  } catch (error) {
    console.error("❌ Diagnostic failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Environment Variables

Ensure these environment variables are set for diagnostic scripts:

```bash
# .env file
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=your_private_key_here
```

### Network Configuration

Scripts automatically detect network from `--network` parameter:
- `--network polygon` - Polygon mainnet
- `--network localhost` - Local development
- `--network goerli` - Goerli testnet (if configured)

## 🔐 SECURITY CONSIDERATIONS

### Safe Diagnostic Practices
- **Read-only operations:** Most diagnostic scripts only read blockchain state
- **Private key security:** Never log or expose private keys
- **RPC rate limiting:** Be mindful of API call limits
- **Gas estimation:** Always estimate before actual transactions

### Production Monitoring
- **Regular health checks:** Run `final-status.js` daily
- **Cost monitoring:** Track gas prices and POL costs
- **Alert thresholds:** Set up monitoring for contract failures
- **Backup procedures:** Document recovery procedures

## 📚 ADDITIONAL RESOURCES

### Related Documentation
- **[ethereum/CLAUDE.md](./CLAUDE.md)** - Main EVM development guide
- **[Hardhat Documentation](https://hardhat.org/docs)** - Hardhat framework
- **[Polygon Documentation](https://docs.polygon.technology/)** - Polygon network
- **[Ethers.js Documentation](https://docs.ethers.org/)** - Ethereum library

### Useful Links
- **[Polygonscan](https://polygonscan.com/)** - Block explorer
- **[Polygon Gas Tracker](https://polygonscan.com/gastracker)** - Gas price monitoring
- **[Alchemy Dashboard](https://dashboard.alchemy.com/)** - RPC monitoring

This diagnostic toolkit provides comprehensive coverage for monitoring and maintaining your Savings Wallet deployment across its entire lifecycle.