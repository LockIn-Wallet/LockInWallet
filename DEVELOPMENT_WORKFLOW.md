# Development Workflow Guide

This guide ensures you never encounter ABI/address mismatch issues again by following automated workflows.

## ✅ **Problem Solved**

**Previous Issue**: Manual steps often forgotten, causing:
- Contract/ABI mismatches
- Frontend showing "could not decode result data" errors
- Address inconsistencies between deployment and frontend

**Solution**: Automated workflows that handle everything for you.

## 🚀 **New Automated Workflow**

### **1. Development Cycle (The Right Way)**

```bash
# 1. Make contract changes in contracts/Lock.sol
vim contracts/Lock.sol

# 2. Compile (automatically updates frontend ABIs)
npx hardhat compile
# ✅ ABIs automatically updated in frontend/src/

# 3. Deploy/Upgrade (automatically validates everything)
npx hardhat run scripts/deploy-upgrade.js --network localhost
# ✅ Automatically detects if upgrade or fresh deploy needed
# ✅ Updates frontend addresses
# ✅ Validates deployment integrity
# ✅ Tests contract functions

# 4. Start frontend (everything is ready!)
cd frontend && npm start
```

### **2. What Happens Automatically**

#### **On Compilation (`npx hardhat compile`)**
- ✅ **Auto-updates** all frontend ABIs (`SavingsABI.json`, `MockUSDT_ABI.json`, `UserProxyABI.json`)
- ✅ **No manual** `updateABI.js` script needed anymore
- ✅ **Runs every time** you compile contracts

#### **On Deployment (`deploy-upgrade.js`)**
- ✅ **Smart deploy/upgrade detection**
- ✅ **Address updates** in frontend config
- ✅ **ABI updates** (redundant but ensures sync)
- ✅ **Deployment validation** (tests contract functions)
- ✅ **Fails fast** if issues detected

#### **On Validation (`validate-deployment.js`)**
- ✅ **Contract existence** check
- ✅ **Function accessibility** testing
- ✅ **ABI compatibility** verification
- ✅ **Frontend/contract sync** validation

## 📋 **Available Scripts**

### **Core Development Scripts**
```bash
# Smart Deploy/Upgrade (RECOMMENDED)
npx hardhat run scripts/deploy-upgrade.js --network localhost

# Fresh Deploy (DATA LOSS - only for initial setup)
npx hardhat run scripts/deploy-all.js --network localhost

# Manual Upgrade (if you know proxy address)
npx hardhat run scripts/upgrade.ts --network localhost

# Validation Only
npx hardhat run scripts/validate-deployment.js --network localhost
```

### **Legacy Scripts (No Longer Needed)**
```bash
# ❌ Don't use these anymore:
# node scripts/updateABI.js              # Now automatic
# node scripts/deployMockUSDT.js         # Included in deploy scripts
```

## 🛡️ **Error Prevention**

### **Before (Manual Process - Error Prone)**
1. Compile contracts
2. Deploy contracts
3. ❌ **Often forgot**: Update ABIs manually
4. ❌ **Often forgot**: Update frontend addresses
5. Get "could not decode result data" errors
6. Debug for hours...

### **After (Automated Process - Error Free)**
1. Compile contracts ✅ (auto-updates ABIs)
2. Deploy contracts ✅ (auto-updates addresses + validates)
3. Everything works! 🎉

## 🔧 **Troubleshooting**

### **If You Still Get ABI Errors**
```bash
# Force recompile everything
npx hardhat compile --force

# Deploy fresh (this will validate everything)
npx hardhat run scripts/deploy-upgrade.js --network localhost

# Manual validation
npx hardhat run scripts/validate-deployment.js --network localhost
```

### **If Validation Fails**
The validation script will tell you exactly what's wrong:
- ❌ Contract not found at address
- ❌ Function calls failing
- ❌ ABI missing required functions

### **Reset Everything (Nuclear Option)**
```bash
# 1. Clean compile
npx hardhat clean && npx hardhat compile

# 2. Fresh deploy (loses all data)
npx hardhat run scripts/deploy-all.js --network localhost

# 3. Restart frontend
cd frontend && npm start
```

## 📊 **Validation Checks**

Every deployment now automatically checks:

- ✅ **Contract exists** at specified address
- ✅ **Key functions work**: `owner()`, `isSetupCommitted()`, `getTokenBalance()`
- ✅ **ABI completeness**: All required functions present
- ✅ **Frontend sync**: Addresses match between contract and frontend

## 🎯 **Best Practices**

### **DO**
- ✅ Always use `deploy-upgrade.js` for updates
- ✅ Compile before deploying (`npx hardhat compile`)
- ✅ Check validation output for any warnings
- ✅ Use localhost for development, upgrade for production

### **DON'T**
- ❌ Don't use `deploy-all.js` after initial setup (data loss)
- ❌ Don't manually edit ABI files (auto-generated)
- ❌ Don't ignore validation failures
- ❌ Don't skip compilation before deployment

## 🚨 **Emergency Procedures**

### **If Frontend Shows Wrong Contract Address**
```bash
# Check what the deployment script thinks:
npx hardhat run scripts/validate-deployment.js --network localhost

# If addresses don't match, redeploy:
npx hardhat run scripts/deploy-upgrade.js --network localhost
```

### **If ABIs Are Corrupted**
```bash
# Force regenerate ABIs:
npx hardhat compile --force

# ABIs are automatically updated
```

### **If Everything Is Broken**
```bash
# Nuclear reset:
npx hardhat clean
npx hardhat compile
npx hardhat run scripts/deploy-all.js --network localhost
```

## 📈 **Development Tips**

1. **Frequent Compilation**: Run `npx hardhat compile` often to keep ABIs fresh
2. **Use Validation**: Always check validation output for early warning signs
3. **Upgrade vs Deploy**: Use `deploy-upgrade.js` to preserve data, `deploy-all.js` only for fresh starts
4. **Read Validation Output**: It tells you exactly what's working and what isn't

## 🎉 **Result**

You should **never** see these errors again:
- ❌ "could not decode result data"
- ❌ "function not found"
- ❌ "contract address not found"
- ❌ "ABI mismatch"

The automated workflow ensures everything stays in sync! 🚀