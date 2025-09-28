const { ethers } = require('hardhat');

async function main() {
  console.log('🔍 Debugging contract...\n');

  const contractAddress = '0x4c5859f0F772848b2D91F1D83E2Fe57935348029';
  const testUser = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  try {
    // Get contract instance
    const contract = await ethers.getContractAt('SavingsCore', contractAddress);
    console.log(`Contract address: ${contract.target}`);

    // Test basic contract access
    console.log('Testing basic contract access...');
    const owner = await contract.owner();
    console.log(`✅ Contract owner: ${owner}`);

    // Test isProxyDeployed function
    console.log('\nTesting isProxyDeployed function...');
    const isDeployed = await contract.isProxyDeployed(testUser);
    console.log(`✅ isProxyDeployed result: ${isDeployed}`);

    // Test getTokenBalance function
    console.log('\nTesting getTokenBalance function...');
    const balance = await contract.getTokenBalance(testUser, ethers.ZeroAddress);
    console.log(`✅ ETH balance: ${ethers.formatEther(balance)} ETH`);

    // Test getUserDepositAddress function
    console.log('\nTesting getUserDepositAddress function...');
    const depositAddress = await contract.getUserDepositAddress(testUser);
    console.log(`✅ Deposit address: ${depositAddress}`);

    console.log('\n🎉 All contract functions working correctly!');

  } catch (error) {
    console.error('❌ Error testing contract:', error);

    // Try to get more details about the error
    if (error.code === 'BAD_DATA') {
      console.log('\nThis suggests the contract ABI doesn\'t match the deployed contract.');
      console.log('Possible causes:');
      console.log('1. Contract not deployed at the expected address');
      console.log('2. ABI mismatch');
      console.log('3. Network mismatch');
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});