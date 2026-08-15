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
  canReachChain,
} from './walletProvider';
import { withSponsorship } from './sponsorship';

/** What this app knows about a chain, regardless of what the wallet thinks. */
const configuredNetwork = (chainId) =>
  Object.values(networkConfig.evm || {}).find((n) => n.chainId === chainId);

/**
 * An RPC provider that stays quiet when the endpoint is down.
 *
 * `staticNetwork` matters more than it looks. Without it a JsonRpcProvider
 * begins its own network-detection loop the moment it is constructed, and that
 * loop retries every second *forever* — outliving whatever created it. One
 * unreachable endpoint (a localhost RPC with no node behind it) was enough to
 * fill the console and keep the main thread busy indefinitely.
 *
 * We already know the chain from config, so there is nothing to detect.
 */
export const createReadProvider = (url, chainId) =>
  new JsonRpcProvider(url, chainId, { staticNetwork: true });

/**
 * The first configured RPC for this chain that actually answers.
 *
 * Every candidate is tried before being adopted. A configured endpoint is not
 * automatically a working one — a wallet pointed at localhost with no node
 * running fails, and so does the localhost RPC listed here, so handing it back
 * unchecked would swap one failure for a more confusing one.
 */
const findWorkingRpc = async (chainId) => {
  for (const url of configuredNetwork(chainId)?.rpcUrls || []) {
    const candidate = createReadProvider(url, chainId);

    try {
      await candidate.getBlockNumber();
      return candidate;
    } catch {
      // Explicitly torn down: an abandoned provider still holds timers.
      candidate.destroy?.();
    }
  }
  return null;
};

/**
 * Create a provider and signer from the connected wallet.
 *
 * Reads fall back to the app's own RPC when the wallet's is unhealthy. Wallets
 * ship with shared public endpoints that rate-limit under load, and a
 * rate-limited *read* used to abort the whole connection — so a working wallet,
 * on the right network, with money in it, could not get past the front page
 * because a block number lookup was throttled. Signing is unaffected either
 * way: that goes through the wallet's own UI and its own connection.
 *
 * @returns {{ provider, signer }} Provider and signer
 */
export const createProviderAndSigner = async () => {
  const wallet = getActiveProvider();
  if (!wallet) throw new Error('No wallet connected');
  const browserProvider = new BrowserProvider(wallet);

  let readProvider = browserProvider;

  try {
    await browserProvider.getBlockNumber();
  } catch (error) {
    // `eth_chainId` is answered by the wallet itself, so it still works when
    // the endpoint behind it does not.
    const chainId = parseInt(await wallet.request({ method: 'eth_chainId' }), 16);
    const fallback = await findWorkingRpc(chainId);

    if (!fallback) {
      // Name the network. "Check your RPC settings" sends someone hunting
      // through menus; "your wallet is on Localhost and nothing is running
      // there" is the same fact with the answer attached.
      const name = configuredNetwork(chainId)?.name || `chain ${chainId}`;
      throw new Error(
        `Your wallet is on ${name}, and nothing there is responding. ` +
        `Switch networks in your wallet, or start a node if you meant to use a local chain.`
      );
    }

    console.warn(`Wallet RPC is unhealthy (${error.message}); reading elsewhere`);
    readProvider = fallback;
  }

  const signer = await browserProvider.getSigner();

  // The single place a signer is made, so wrapping it here is what makes every
  // contract call in the app sponsored without one of them being rewritten.
  // Returns the plain signer whenever sponsorship is unavailable.
  const { chainId } = await readProvider.getNetwork();
  const sponsored = await withSponsorship(signer, wallet, Number(chainId));

  return { provider: readProvider, signer: sponsored };
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
      result.provider = createReadProvider(publicRpcUrl, networkConf.chainId);
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
          provider: createReadProvider(networkConf.rpcUrls[0], networkConf.chainId),
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

    // A signed-in wallet can move between the chains it was created against,
    // but no further — the signer is hosted and cannot see a local dev node.
    // Asking anyway would open a popup only to have it rejected.
    if (!canReachChain(expectedChainId)) {
      console.error(
        `❌ The signed-in wallet cannot reach ${networkKey} (chain ${expectedChainId})`
      );
      return false;
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
      const publicProvider = createReadProvider(networkConf.rpcUrls[0], networkConf.chainId);
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