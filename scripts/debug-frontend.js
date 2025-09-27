/**
 * Debug script to test contract connection from frontend perspective
 * Run this in the browser console to debug contract issues
 */

// Copy this code and paste it in the browser console (F12 -> Console)
console.log("🔍 Frontend Contract Debug Script");

async function debugContract() {
  try {
    console.log("1. Checking ethers availability...");
    if (typeof ethers === 'undefined') {
      console.error("❌ ethers not available. Make sure the frontend is loaded.");
      return;
    }
    console.log("✅ ethers available");

    console.log("2. Checking MetaMask connection...");
    if (!window.ethereum) {
      console.error("❌ MetaMask not available");
      return;
    }
    console.log("✅ MetaMask available");

    console.log("3. Getting provider and signer...");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    console.log(`✅ Connected as: ${userAddress}`);

    console.log("4. Getting network info...");
    const network = await provider.getNetwork();
    console.log(`✅ Network: ${network.name} (chainId: ${network.chainId})`);

    console.log("5. Testing contract connection...");
    const contractAddress = "0x9E545E3C0baAB3E08CdfD552C960A1050f373042";
    console.log(`Contract address: ${contractAddress}`);

    // Check if contract has code
    const code = await provider.getCode(contractAddress);
    if (code === "0x") {
      console.error("❌ No contract code at address");
      return;
    }
    console.log("✅ Contract code found");

    console.log("6. Creating contract instance...");
    // You'll need to copy the ABI manually or fetch it
    const minimalABI = [
      {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "isSetupCommitted",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {"internalType": "address", "name": "user", "type": "address"},
          {"internalType": "address", "name": "token", "type": "address"}
        ],
        "name": "getTokenBalance",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ];

    const contract = new ethers.Contract(contractAddress, minimalABI, provider);
    console.log("✅ Contract instance created");

    console.log("7. Testing contract functions...");

    try {
      const owner = await contract.owner();
      console.log(`✅ owner(): ${owner}`);
    } catch (error) {
      console.error(`❌ owner() failed: ${error.message}`);
    }

    try {
      const setupCommitted = await contract.isSetupCommitted();
      console.log(`✅ isSetupCommitted(): ${setupCommitted}`);
    } catch (error) {
      console.error(`❌ isSetupCommitted() failed: ${error.message}`);
    }

    try {
      const balance = await contract.getTokenBalance(userAddress, "0x0000000000000000000000000000000000000000");
      console.log(`✅ getTokenBalance(): ${balance}`);
    } catch (error) {
      console.error(`❌ getTokenBalance() failed: ${error.message}`);
    }

    console.log("🎉 Debug complete!");

  } catch (error) {
    console.error(`❌ Debug failed: ${error.message}`);
    console.error(error);
  }
}

// Run the debug
debugContract();