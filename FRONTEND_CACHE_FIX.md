# Frontend Cache Fix Instructions

## Problem
The frontend is showing "no matching fragment" errors for `getUserWithdrawalAddresses` and `getUserPendingWithdrawalRequests` functions, even though the contract and ABI are correct.

## Root Cause
React development server has cached the old ABI file in memory. The contract and ABI files are correct, but the browser/dev server needs to be refreshed.

## Solution (Choose ONE method)

### Method 1: Complete Frontend Restart (RECOMMENDED)
```bash
# Stop the frontend dev server (Ctrl+C in the terminal running npm start)
cd frontend
npm start
```

### Method 2: Hard Browser Refresh
1. In your browser, press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. This will force reload all cached JavaScript files

### Method 3: Clear Browser Cache
1. Open Developer Tools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Method 4: Incognito/Private Window
1. Open a new incognito/private browser window
2. Navigate to http://localhost:3000
3. This bypasses all cache

## Verification
After applying the fix, you should see:
- ✅ No "no matching fragment" errors in the console
- ✅ Withdrawal addresses section loads without errors
- ✅ "Request Withdrawal Address" button works

## Technical Details
- ✅ Contract deployed correctly: `0xF32D39ff9f6Aa7a7A64d7a4F00a54826Ef791a55`
- ✅ ABI contains both functions: `getUserWithdrawalAddresses` & `getUserPendingWithdrawalRequests`
- ✅ Functions work when tested directly with hardhat
- ✅ Issue is purely frontend caching

## If Problems Persist
Run this command to verify the contract is working:
```bash
npx hardhat run scripts/test-frontend-abi.js --network localhost
```

This should show all functions working correctly, confirming the issue is browser cache.