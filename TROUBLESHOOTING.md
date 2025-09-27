# Troubleshooting ABI/Contract Issues

## Current Issue: "could not decode result data (value="0x")"

This error indicates that the contract is returning empty data, which can happen for several reasons:

### **Quick Fixes to Try:**

#### **1. Clear Browser Cache (Most Common Fix)**
```bash
# Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
# Firefox: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
# Or manually:
# 1. Open DevTools (F12)
# 2. Right-click refresh button
# 3. Select "Empty Cache and Hard Reload"
```

#### **2. Check Network Connection**
1. Open browser console (F12)
2. Look for network debug info when connecting wallet
3. Verify:
   - Chain ID should be `31337` (localhost)
   - Contract address should be `0x9E545E3C0baAB3E08CdfD552C960A1050f373042`
   - ABI should contain functions like `isSetupCommitted`, `getTokenBalance`

#### **3. Restart Hardhat Node**
```bash
# Terminal 1: Stop current node (Ctrl+C)
npx hardhat node

# Terminal 2: Redeploy contracts
npx hardhat run scripts/deploy-upgrade.js --network localhost

# Terminal 3: Restart frontend
cd frontend && npm start
```

#### **4. Force Update Everything**
```bash
# 1. Clean and recompile
npx hardhat clean
npx hardhat compile --force

# 2. Fresh deployment
npx hardhat run scripts/deploy-all.js --network localhost

# 3. Clear browser cache and reload frontend
```

### **Debug Information**

When you connect your wallet, check the browser console for:

```
🔍 MetaMask Network Info:
- Chain ID: 31337
- Network Name: unknown
- Selected Network in App: localhost

🔍 Contract Debug Info:
- Address: 0x9E545E3C0baAB3E08CdfD552C960A1050f373042
- Network: Localhost
- ABI functions: [array of function names]

✅ Contract test - owner(): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

### **Common Issues:**

#### **Issue 1: Wrong Network**
- **Symptom**: Chain ID is not 31337
- **Fix**: Switch MetaMask to localhost:8545

#### **Issue 2: Wrong Contract Address**
- **Symptom**: Contract address doesn't match validation output
- **Fix**: Run `npx hardhat run scripts/validate-deployment.js --network localhost`

#### **Issue 3: Stale ABI**
- **Symptom**: ABI functions list doesn't include bypass functions
- **Fix**: Force recompile and redeploy

#### **Issue 4: Contract Not Deployed**
- **Symptom**: "Contract test failed" error
- **Fix**: Deploy contracts first

### **Validation Commands**

```bash
# Check if contracts are working
npx hardhat run scripts/validate-deployment.js --network localhost

# Check current network
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' http://localhost:8545

# Test contract directly
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x9E545E3C0baAB3E08CdfD552C960A1050f373042","data":"0x8da5cb5b"},"latest"],"id":1}' http://localhost:8545
```

### **Nuclear Reset (Last Resort)**

```bash
# 1. Stop everything
# Ctrl+C in all terminals

# 2. Clean everything
npx hardhat clean
rm -rf cache/ artifacts/

# 3. Fresh start
npx hardhat compile
npx hardhat node  # Terminal 1
npx hardhat run scripts/deploy-all.js --network localhost  # Terminal 2

# 4. Clear browser completely
# Close all browser tabs
# Clear all browser data for localhost
# Restart browser

# 5. Start frontend
cd frontend && npm start  # Terminal 3
```

### **Contact Info**

If none of these fixes work, provide:
1. Browser console output when connecting wallet
2. Output of `npx hardhat run scripts/validate-deployment.js --network localhost`
3. MetaMask network settings screenshot