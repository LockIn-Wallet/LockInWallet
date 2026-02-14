# Production Build Testing Checklist

## 🎯 Test URL: http://localhost:3001

## ✅ **TEST 1: Network Filtering (Production Environment)**

### Expected Results:
- ❌ **Localhost networks should be HIDDEN**
- ✅ **Only Polygon should be visible** (since it has deployed contracts)
- ❌ **Ethereum, Optimism should be HIDDEN** (zero addresses = not deployed)

### How to Test:
1. Open http://localhost:3001
2. Look at the network dropdown
3. Check what networks are available

### ✅ PASS/FAIL: _____________

---

## ✅ **TEST 2: Contract Verification (Enhanced RPC System)**

### Expected Results:
- ✅ **No "NOT DEPLOYED" errors** for Polygon contract
- ✅ **Contract verification should succeed** using private RPC
- ✅ **Fallback to public RPCs** if needed

### How to Test:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Connect to Polygon network in MetaMask
4. Refresh the page
5. Look for contract verification messages

### Expected Console Messages:
```
🌐 Network filtering - Environment: production, Production: true
   Including Polygon (deployed: true)
🎯 Production networks available: Polygon
🔍 Verifying contract deployment:
   Network: Polygon
   Contract: 0x09AC25686Fb2aB3ce5cF6b92F84C90E9BBdA8e93
✅ Contract deployment check for 0x09AC25686Fb2aB3ce5cF6b92F84C90E9BBdA8e93: DEPLOYED
```

### ❌ Should NOT see:
```
❌ Contract deployment check for 0x09AC25686Fb2aB3ce5cF6b92F84C90E9BBdA8e93: NOT DEPLOYED
Contract deployment verification failed: Ethereum contracts are not deployed
```

### ✅ PASS/FAIL: _____________

---

## ✅ **TEST 3: RPC Security (No Private URLs Exposed)**

### Expected Results:
- ✅ **No private Alchemy URLs visible** in any developer tools
- ✅ **Only public RPC endpoints** should appear in bundled code

### How to Test:
1. Open browser DevTools (F12)
2. Go to Sources tab
3. Search for "LYErD5QkCjBobT0JBHvyi" (your Alchemy key)
4. Search for "alchemy" in source files

### Expected Result:
- ❌ **Should find ZERO matches** for your private API key
- ✅ **Only public RPCs** should be visible in source code

### ✅ PASS/FAIL: _____________

---

## ✅ **TEST 4: Contract Testing Utility**

### How to Test:
1. Open browser Console (F12)
2. Run the following commands:

```javascript
// Test 1: Check RPC configuration (safely masked)
window.logRpcConfig('evm', 'polygon')

// Test 2: Test contract connectivity
await window.testContractConnection('polygon')

// Test 3: Run comprehensive verification tests
await window.testContractConnection('polygon')
```

### Expected Results:
```
🌐 RPC Configuration for polygon:
   Private RPCs: 1
   Public RPCs: 2
   Total RPCs: 3
   1. https://polygon-mainnet.g.alchemy.com/v2/LYE*** 🔒
   2. https://polygon-rpc.com 🌍
   3. https://rpc-mainnet.matic.network 🌍

✅ Contract deployment check for 0x09AC25686Fb2aB3ce5cF6b92F84C90E9BBdA8e93: DEPLOYED (bytecode length: XXXXX)
🎉 SUCCESS: Contract verified on https://polygon-mainnet.g.alchemy.com/v2/...
```

### ✅ PASS/FAIL: _____________

---

## ✅ **TEST 5: Environment Variables**

### How to Test:
In browser console, check environment configuration:

```javascript
// Check environment
console.log('NODE_ENV:', process.env.NODE_ENV)
console.log('REACT_APP_ENVIRONMENT:', process.env.REACT_APP_ENVIRONMENT)
console.log('Private RPC configured:', !!process.env.REACT_APP_POLYGON_RPC_PRIVATE)
```

### Expected Results:
```
NODE_ENV: production
REACT_APP_ENVIRONMENT: production (or undefined)
Private RPC configured: true
```

### ✅ PASS/FAIL: _____________

---

## ✅ **TEST 6: Full Wallet Connection Test**

### How to Test:
1. Connect MetaMask to Polygon network
2. Try to interact with the wallet
3. Check for any contract-related errors

### Expected Results:
- ✅ **MetaMask connects** to Polygon successfully
- ✅ **No contract verification errors** in console
- ✅ **Wallet interface loads** without issues

### ✅ PASS/FAIL: _____________

---

## 🚨 **TROUBLESHOOTING COMMANDS**

If any tests fail, run these diagnostic commands:

```javascript
// Debug RPC connectivity
await window.testRpcConnectivity('polygon')

// Check what networks are available
window.logRpcConfig('evm', 'polygon')

// Test MetaMask connection specifically
await window.testMetaMaskConnection('polygon')

// Check contract directly
const provider = new ethers.JsonRpcProvider(process.env.REACT_APP_POLYGON_RPC_PRIVATE || 'https://polygon-rpc.com')
const code = await provider.getCode('0x09AC25686Fb2aB3ce5cF6b92F84C90E9BBdA8e93')
console.log('Contract code length:', code.length)
console.log('Contract deployed:', code !== '0x')
```

---

## 📊 **OVERALL TEST RESULTS**

- Test 1 (Network Filtering): ☐ PASS ☐ FAIL
- Test 2 (Contract Verification): ☐ PASS ☐ FAIL
- Test 3 (RPC Security): ☐ PASS ☐ FAIL
- Test 4 (Testing Utility): ☐ PASS ☐ FAIL
- Test 5 (Environment): ☐ PASS ☐ FAIL
- Test 6 (Wallet Connection): ☐ PASS ☐ FAIL

**OVERALL RESULT: ☐ PASS ☐ FAIL**

---

## 🎯 **SUCCESS CRITERIA**

✅ **PRODUCTION READY** if all tests pass:
- Only deployed networks shown
- Contract verification works reliably
- No private RPC URLs exposed
- All debugging utilities functional
- MetaMask connects without errors

❌ **NEEDS FIXES** if any tests fail:
- Check console errors for specific issues
- Verify environment variable configuration
- Test RPC connectivity directly
- Review network configuration