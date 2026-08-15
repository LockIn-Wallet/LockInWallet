/**
 * Provider Management - build ethers providers from whichever wallet is active.
 *
 * Which wallet that is — a browser extension, or an embedded wallet from
 * signing in — is `walletProvider`'s business, not this module's. Falls back to
 * public RPCs for reads when no wallet is connected.
 */

import { BrowserProvider, JsonRpcProvider } from 'ethers';
import networkConfig from '../networkConfig.json';
import {
  getActiveProvider,
  getAccounts,
  hasWallet,
  isEmbeddedWallet,
  supportsChainSwitching,
} from './walletProvider';

/**
 * Create a provider and signer from the connected wallet.
 * Tests the wallet's RPC connection and throws a clear error if broken.
 * @returns {{ provider, signer }} Provider and signer
 */
export const createProviderAndSigner = async () => {
  const wallet = getActiveProvider();
  if (!wallet) throw new Error('No wallet connected');
  const browserProvider = new BrowserProvider(wallet);

  // Test if the wallet's RPC works
  try {
    await browserProvider.getBlockNumber();
  } catch (error) {
    throw new Error(
      'Your wallet\'s RPC connection is not working. ' +
      'Please check your wallet settings (Settings → Networks) and ensure the RPC URL for this network is valid.'
    );
  }

  const signer = await browserProvider.getSigner();
  return { provider: browserProvider, signer };
};

/**
 * Get the best available provider for a network
 * Priority: connected wallet > public RPC
 * @param {string} networkKey - Network key (e.g., "optimism")
 * @returns {object} Provider instance and metadata
 */
export const getBestProvider = async (networkKey) => {
  const result = {
    provider: null,
    source: 'none',
    chainId: null,
    reliable: false
  };

  try {
    // First, try the connected wallet if it is on the right network
    if (hasWallet()) {
      try {
        // `eth_accounts` was previously used without awaiting, so this branch
        // never ran and every read quietly fell through to the public RPC.
        const accounts = await getAccounts();
        if (accounts.length > 0) {
          const browserProvider = new BrowserProvider(getActiveProvider());
          const network = await browserProvider.getNetwork();
          const expectedChainId = networkConfig.evm[networkKey]?.chainId;

          if (Number(network.chainId) === expectedChainId) {
            result.provider = browserProvider;
            result.source = isEmbeddedWallet() ? 'embedded' : 'injected';
            result.chainId = Number(network.chainId);
            result.reliable = true;
            console.log(`👛 Using ${result.source} wallet for ${networkKey} (Chain ID: ${result.chainId})`);
            return result;
          } else {
            console.log(`👛 Wallet available but wrong network (${Number(network.chainId)} vs ${expectedChainId})`);
          }
        } else {
          console.log(`👛 Wallet available but not connected`);
        }
      } catch (error) {
        console.log(`👛 Wallet error: ${error.message}`);
      }
    }

    // Fallback to public RPC
    const networkConf = networkConfig.evm[networkKey];
    if (networkConf?.rpcUrls?.length > 0) {
      const publicRpcUrl = networkConf.rpcUrls[0]; // Use first public RPC
      result.provider = new JsonRpcProvider(publicRpcUrl);
      result.source = 'public_rpc';
      result.chainId = networkConf.chainId;
      result.reliable = false;
      console.log(`🌍 Using public RPC for ${networkKey}: ${publicRpcUrl}`);
      return result;
    }

    throw new Error(`No provider available for ${networkKey}`);

  } catch (error) {
    console.error(`❌ Failed to get provider for ${networkKey}:`, error.message);
    throw error;
  }
};

/**
 * Verify contract deployment using the best available provider
 * @param {string} contractAddress - Contract address to verify
 * @param {string} networkKey - Network key (e.g., "optimism")
 * @returns {object} Verification result
 */
export const verifyContractDeployment = async (contractAddress, networkKey) => {
  const result = {
    isDeployed: false,
    provider: null,
    source: 'none',
    bytecodeLength: 0,
    error: null
  };

  console.log(`🔍 Verifying contract deployment:`);
  console.log(`   Contract: ${contractAddress}`);
  console.log(`   Network: ${networkKey}`);

  // Try the wallet first, then fall back to public RPC
  const providers = [];

  try {
    const providerInfo = await getBestProvider(networkKey);
    providers.push(providerInfo);

    // If the wallet was selected, also prepare public RPC as fallback
    if (providerInfo.source === 'embedded' || providerInfo.source === 'injected') {
      const networkConf = networkConfig.evm[networkKey];
      if (networkConf?.rpcUrls?.length > 0) {
        providers.push({
          provider: new JsonRpcProvider(networkConf.rpcUrls[0]),
          source: 'public_rpc',
          chainId: networkConf.chainId,
          reliable: false
        });
      }
    }
  } catch (error) {
    console.warn(`⚠️ Failed to get provider for ${networkKey}:`, error.message);
    return result;
  }

  for (const providerInfo of providers) {
    try {
      const code = await providerInfo.provider.getCode(contractAddress);
      result.provider = providerInfo.source;
      result.source = providerInfo.source;
      result.bytecodeLength = code.length;
      result.isDeployed = code !== '0x' && code !== '0x0' && code.length > 2;

      if (result.isDeployed) {
        console.log(`✅ Contract DEPLOYED via ${providerInfo.source} (bytecode: ${code.length} chars)`);
      } else {
        console.log(`❌ Contract NOT DEPLOYED via ${providerInfo.source} (bytecode: ${code})`);
      }

      return result;
    } catch (error) {
      console.warn(`⚠️ getCode failed via ${providerInfo.source}: ${error.message}`);
      result.error = error.message;
    }
  }

  console.error(`❌ Contract verification failed with all providers`);
  return result;
};

/**
 * Put the wallet on the right network, if it is the kind that can be asked.
 * @param {string} networkKey - Network key to switch to
 * @returns {boolean} True if the wallet ends up on the expected chain
 */
export const ensureCorrectNetwork = async (networkKey) => {
  if (!hasWallet()) {
    console.log('No wallet available for network switching');
    return false;
  }

  const expectedChainId = networkConfig.evm[networkKey]?.chainId;
  if (!expectedChainId) {
    console.error(`❌ No chain ID found for network: ${networkKey}`);
    return false;
  }

  const hexChainId = `0x${expectedChainId.toString(16)}`;

  const switchChain = async () => {
    await getActiveProvider().request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }]
    });
  };

  try {
    const browserProvider = new BrowserProvider(getActiveProvider());
    const currentNetwork = await browserProvider.getNetwork();

    // An embedded wallet is created against one chain and simply is on it.
    // There is no menu to change and no prompt to show, so a mismatch here is
    // a wallet built for a different network — say so rather than firing an
    // RPC method it does not implement.
    if (!supportsChainSwitching()) {
      const onExpected = Number(currentNetwork.chainId) === expectedChainId;
      if (!onExpected) {
        console.error(
          `❌ Signed-in wallet is on chain ${Number(currentNetwork.chainId)}, not ${expectedChainId}`
        );
      }
      return onExpected;
    }

    if (Number(currentNetwork.chainId) === expectedChainId) {
      console.log(`✅ Already on correct network: ${networkKey}`);
      return true;
    }

    console.log(`🔄 Requesting switch to ${networkKey} (Chain ID: ${expectedChainId})`);
    await switchChain();
    console.log(`✅ Successfully switched to ${networkKey}`);
    return true;

  } catch (error) {
    if (error.code === 4902) {
      console.log(`📝 Network not in the wallet, attempting to add ${networkKey}`);
      return await addNetworkToWallet(networkKey);
    } else if (error.code === -32002 || error.message?.includes('already pending')) {
      // Another request is already pending - wait and retry
      console.log(`⏳ Network switch pending, retrying after delay...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        await switchChain();
        console.log(`✅ Successfully switched to ${networkKey} (retry)`);
        return true;
      } catch (retryError) {
        console.warn(`⏳ Network switch still pending, user needs to approve in MetaMask`);
        return false;
      }
    } else {
      console.error(`❌ Failed to switch network:`, error.message);
      return false;
    }
  }
};

/**
 * Add network to the wallet if not already added
 * @param {string} networkKey - Network key to add
 * @returns {boolean} True if add was successful
 */
const addNetworkToWallet = async (networkKey) => {
  try {
    const networkConf = networkConfig.evm[networkKey];
    if (!networkConf) {
      throw new Error(`Network ${networkKey} not found in config`);
    }

    await getActiveProvider().request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: `0x${networkConf.chainId.toString(16)}`,
        chainName: networkConf.name,
        nativeCurrency: networkConf.nativeCurrency,
        rpcUrls: networkConf.rpcUrls,
        blockExplorerUrls: networkConf.blockExplorerUrls,
      }]
    });

    console.log(`✅ Successfully added ${networkKey} to the wallet`);
    return true;

  } catch (error) {
    console.error(`❌ Failed to add network to the wallet:`, error.message);
    return false;
  }
};

/**
 * Test connectivity for all available providers for a network
 * @param {string} networkKey - Network to test
 * @returns {object} Test results
 */
export const testAllProviders = async (networkKey) => {
  const results = {
    networkKey,
    wallet: { available: false, correctNetwork: false, contractDeployed: false },
    publicRpc: { available: false, working: false, contractDeployed: false },
    recommendation: ''
  };

  const contractAddress = networkConfig.evm[networkKey]?.savingsContract;
  const expectedChainId = networkConfig.evm[networkKey]?.chainId;

  // Test the connected wallet
  if (hasWallet()) {
    results.wallet.available = true;
    try {
      const browserProvider = new BrowserProvider(getActiveProvider());
      const network = await browserProvider.getNetwork();

      if (Number(network.chainId) === expectedChainId) {
        results.wallet.correctNetwork = true;

        // Test contract verification
        if (contractAddress) {
          const code = await browserProvider.getCode(contractAddress);
          results.wallet.contractDeployed = code !== '0x' && code.length > 2;
        }
      }
    } catch (error) {
      console.log('Wallet test error:', error.message);
    }
  }

  // Test public RPC
  const networkConf = networkConfig.evm[networkKey];
  if (networkConf?.rpcUrls?.length > 0) {
    results.publicRpc.available = true;
    try {
      const publicProvider = new JsonRpcProvider(networkConf.rpcUrls[0]);
      const blockNumber = await publicProvider.getBlockNumber();
      results.publicRpc.working = blockNumber > 0;

      // Test contract verification
      if (contractAddress && results.publicRpc.working) {
        const code = await publicProvider.getCode(contractAddress);
        results.publicRpc.contractDeployed = code !== '0x' && code.length > 2;
      }
    } catch (error) {
      console.log('Public RPC test error:', error.message);
    }
  }

  // Generate recommendation
  if (results.wallet.available && results.wallet.correctNetwork) {
    if (results.wallet.contractDeployed) {
      results.recommendation = '✅ Wallet ready - contract verified';
    } else {
      results.recommendation = '⚠️ Wallet connected but contract not found';
    }
  } else if (results.wallet.available) {
    results.recommendation = '🔄 Please switch the wallet to the correct network';
  } else {
    results.recommendation = '👛 Please sign in or connect a wallet';
  }

  return results;
};

// Export for console debugging
if (typeof window !== 'undefined') {
  window.testAllProviders = testAllProviders;
  window.verifyContractDeployment = verifyContractDeployment;
  window.ensureCorrectNetwork = ensureCorrectNetwork;
}