const { ethers } = require('ethers');
const SavingsABI = require('../frontend/src/SavingsABI.json');

async function main() {
  console.log('🔍 Testing frontend connection simulation...\n');

  // Simulate frontend connection (direct RPC, like what frontend would do)
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const contractAddress = '0x4c5859f0F772848b2D91F1D83E2Fe57935348029';
  const testUser = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  try {
    console.log('Creating contract instance with frontend ABI...');
    const contract = new ethers.Contract(contractAddress, SavingsABI, provider);

    console.log(`Contract address: ${contract.target}`);
    console.log(`Provider: ${provider._getConnection().url}`);
    console.log(`Chain ID: ${(await provider.getNetwork()).chainId}`);

    // Test the same functions that are failing in frontend
    console.log('\n--- Testing same functions as frontend ---');

    console.log('1. Testing owner() function...');
    const owner = await contract.owner();
    console.log(`✅ Owner: ${owner}`);

    console.log('2. Testing isProxyDeployed() function...');
    const isDeployed = await contract.isProxyDeployed(testUser);
    console.log(`✅ isProxyDeployed: ${isDeployed}`);

    console.log('3. Testing getTokenBalance() function...');
    const balance = await contract.getTokenBalance(testUser, ethers.ZeroAddress);
    console.log(`✅ ETH balance: ${ethers.formatEther(balance)} ETH`);

    console.log('4. Testing getUserDepositAddress() function...');
    const depositAddress = await contract.getUserDepositAddress(testUser);
    console.log(`✅ Deposit address: ${depositAddress}`);

    console.log('\n🎉 All frontend-style calls working correctly!');
    console.log('This suggests the issue is with MetaMask connection, not the contract/ABI.');

  } catch (error) {
    console.error('❌ Error with frontend-style connection:', error);

    if (error.code === 'BAD_DATA') {
      console.log('\n📋 Debug Info:');
      console.log(`Error value: ${error.value}`);
      console.log(`Method: ${error.info?.method}`);
      console.log(`Signature: ${error.info?.signature}`);

      console.log('\nPossible causes:');
      console.log('1. Contract ABI mismatch');
      console.log('2. Contract not deployed at expected address');
      console.log('3. Network/RPC connection issue');
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});