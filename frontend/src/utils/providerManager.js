/**
 * Provider Management - Use MetaMask's provider when available
 * Falls back to public RPCs only when MetaMask is not available
 */

import { BrowserProvider, JsonRpcProvider, AbstractSigner } from 'ethers';
import networkConfig from '../networkConfig.json';

/**
 * Signer that uses our own RPC for reads but MetaMask for signing/broadcasting.
 * Used when MetaMask's configured RPC is broken (e.g. returning 401).
 */
class FallbackSigner extends AbstractSigner {
  constructor(metamaskSigner, fallbackProvider) {
    super(fallbackProvider);
    this._metamaskSigner = metamaskSigner;
  }

  async getAddress() {
    return this._metamaskSigner.getAddress();
  }

  async signTransaction(tx) {
    return this._metamaskSigner.signTransaction(tx);
  }

  async signMessage(message) {
    return this._metamaskSigner.signMessage(message);
  }

  async signTypedData(domain, types, value) {
    return this._metamaskSigner.signTypedData(domain, types, value);
  }

  async sendTransaction(tx) {
    return this._metamaskSigner.sendTransaction(tx);
  }

  connect(provider) {
    return new FallbackSigner(this._metamaskSigner, provider);
  }
}

/**
 * Find a working RPC provider from our configured URLs
 * @param {string} networkKey - Network key (e.g., "polygon")
 * @returns {JsonRpcProvider|null} Working provider or null
 */
const findWorkingRpcProvider = async (networkKey) => {
  const rpcUrls = networkConfig.evm[networkKey]?.rpcUrls || [];
  for (const rpcUrl of rpcUrls) {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      await provider.getBlockNumber();
      console.log(`✅ Found working RPC: ${rpcUrl}`);
      return provider;
    } catch (error) {
      console.warn(`⚠️ RPC not working: ${rpcUrl}`);
    }
  }
  return null;
};

/**
 * Create a provider and signer for connecting to the network.
 * Uses MetaMask's RPC if it works, falls back to our own RPCs for reads.
 * @param {string} networkKey - Network key (e.g., "polygon")
 * @returns {{ provider, signer, usingFallbackRpc }} Provider and signer
 */
export const createProviderAndSigner = async (networkKey) => {
  const browserProvider = new BrowserProvider(window.ethereum);

  // Test if MetaMask's RPC works
  try {
    await browserProvider.getBlockNumber();
    // MetaMask RPC works, use it normally
    const signer = await browserProvider.getSigner();
    return { provider: browserProvider, signer, usingFallbackRpc: false };
  } catch (error) {
    console.warn(`⚠️ MetaMask RPC broken: ${error.message}`);
  }

  // MetaMask RPC is broken - use our own RPC for reads
  const fallbackProvider = await findWorkingRpcProvider(networkKey);
  if (!fallbackProvider) {
    throw new Error('No working RPC available. Please check your MetaMask network settings.');
  }

  // Get MetaMask signer for signing (works even with broken RPC)
  const metamaskSigner = await browserProvider.getSigner();
  const signer = new FallbackSigner(metamaskSigner, fallbackProvider);

  console.log(`🔄 Using fallback RPC for reads, MetaMask for signing`);
  return { provider: fallbackProvider, signer, usingFallbackRpc: true };
};

/**
 * Get the best available provider for a network
 * Priority: MetaMask > Public RPC
 * @param {string} networkKey - Network key (e.g., "polygon")
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
    // First, try to use MetaMask if available, connected, and on correct network
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Check if wallet is connected
        const accounts = window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const browserProvider = new BrowserProvider(window.ethereum);
          const network = await browserProvider.getNetwork();
          const expectedChainId = networkConfig.evm[networkKey]?.chainId;

          if (Number(network.chainId) === expectedChainId) {
            result.provider = browserProvider;
            result.source = 'metamask';
            result.chainId = Number(network.chainId);
            result.reliable = true;
            console.log(`🦊 Using MetaMask provider for ${networkKey} (Chain ID: ${result.chainId})`);
            return result;
          } else {
            console.log(`🦊 MetaMask available but wrong network (${Number(network.chainId)} vs ${expectedChainId})`);
          }
        } else {
          console.log(`🦊 MetaMask available but not connected`);
        }
      } catch (error) {
        console.log(`🦊 MetaMask error: ${error.message}`);
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
 * @param {string} networkKey - Network key (e.g., "polygon")
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

  // Try MetaMask first, then fall back to public RPC
  const providers = [];

  try {
    const providerInfo = await getBestProvider(networkKey);
    providers.push(providerInfo);

    // If MetaMask was selected, also prepare public RPC as fallback
    if (providerInfo.source === 'metamask') {
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
 * Switch MetaMask to the correct network if needed
 * @param {string} networkKey - Network key to switch to
 * @returns {boolean} True if switch was successful or already correct
 */
export const ensureCorrectNetwork = async (networkKey) => {
  if (typeof window.ethereum === 'undefined') {
    console.log('MetaMask not available for network switching');
    return false;
  }

  const expectedChainId = networkConfig.evm[networkKey]?.chainId;
  if (!expectedChainId) {
    console.error(`❌ No chain ID found for network: ${networkKey}`);
    return false;
  }

  const hexChainId = `0x${expectedChainId.toString(16)}`;

  const switchChain = async () => {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }]
    });
  };

  try {
    const browserProvider = new BrowserProvider(window.ethereum);
    const currentNetwork = await browserProvider.getNetwork();

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
      console.log(`📝 Network not added to MetaMask, attempting to add ${networkKey}`);
      return await addNetworkToMetaMask(networkKey);
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
 * Add network to MetaMask if not already added
 * @param {string} networkKey - Network key to add
 * @returns {boolean} True if add was successful
 */
const addNetworkToMetaMask = async (networkKey) => {
  try {
    const networkConf = networkConfig.evm[networkKey];
    if (!networkConf) {
      throw new Error(`Network ${networkKey} not found in config`);
    }

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: `0x${networkConf.chainId.toString(16)}`,
        chainName: networkConf.name,
        nativeCurrency: networkConf.nativeCurrency,
        rpcUrls: networkConf.rpcUrls,
        blockExplorerUrls: networkConf.blockExplorerUrls,
      }]
    });

    console.log(`✅ Successfully added ${networkKey} to MetaMask`);
    return true;

  } catch (error) {
    console.error(`❌ Failed to add network to MetaMask:`, error.message);
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
    metamask: { available: false, correctNetwork: false, contractDeployed: false },
    publicRpc: { available: false, working: false, contractDeployed: false },
    recommendation: ''
  };

  const contractAddress = networkConfig.evm[networkKey]?.savingsContract;
  const expectedChainId = networkConfig.evm[networkKey]?.chainId;

  // Test MetaMask
  if (typeof window.ethereum !== 'undefined') {
    results.metamask.available = true;
    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      const network = await browserProvider.getNetwork();

      if (Number(network.chainId) === expectedChainId) {
        results.metamask.correctNetwork = true;

        // Test contract verification
        if (contractAddress) {
          const code = await browserProvider.getCode(contractAddress);
          results.metamask.contractDeployed = code !== '0x' && code.length > 2;
        }
      }
    } catch (error) {
      console.log('MetaMask test error:', error.message);
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
  if (results.metamask.available && results.metamask.correctNetwork) {
    if (results.metamask.contractDeployed) {
      results.recommendation = '✅ MetaMask ready - contract verified';
    } else {
      results.recommendation = '⚠️ MetaMask connected but contract not found';
    }
  } else if (results.metamask.available) {
    results.recommendation = '🔄 Please switch MetaMask to correct network';
  } else {
    results.recommendation = '🦊 Please install and connect MetaMask';
  }

  return results;
};

// Export for console debugging
if (typeof window !== 'undefined') {
  window.testAllProviders = testAllProviders;
  window.verifyContractDeployment = verifyContractDeployment;
  window.ensureCorrectNetwork = ensureCorrectNetwork;
}