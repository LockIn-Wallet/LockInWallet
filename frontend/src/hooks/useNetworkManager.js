import { useState, useCallback } from "react";

// Import blockchain adapters and utilities
import { TransactionManager } from "../adapters/TransactionManager.js";
import {
  NETWORKS,
  getNetworkByChainId,
  getCurrentNetwork,
} from "../utils/walletUtils.js";

// Import network isolation utilities
import {
  validateNetworkConfig,
  validateNetworkCompatibility,
  createNetworkStateCleaner,
  clearNetworkStorage,
} from "../utils/networkIsolation.js";

/**
 * useNetworkManager - Custom hook for network management
 *
 * Encapsulates all network switching, detection, and TransactionManager initialization logic.
 * Provides clean interface for EVM ↔ Solana network management.
 *
 * Features:
 * - Network type switching (EVM ↔ Solana)
 * - Network detection for EVM
 * - TransactionManager initialization
 * - State management for network switching
 */
export const useNetworkManager = ({
  // Solana wallet context
  solanaConnected,
  solanaPublicKey,
  solanaSendTransaction,
  solanaSignTransaction,
  solanaSignAllTransactions,
  solanaDisconnect,
  connection,

  // State setters from App.js
  setNetworkType,
  setSelectedNetwork,
  setCurrentChainId,
  setTransactionManager,
  setIsNetworkSwitching,

  // State clearing functions for network switches
  clearAllState,
}) => {
  // Network detection function for EVM
  const detectCurrentNetwork = useCallback(async () => {
    if (window.ethereum) {
      try {
        const chainId = await window.ethereum.request({
          method: "eth_chainId",
        });
        const numericChainId = parseInt(chainId, 16);
        setCurrentChainId(numericChainId);

        const network = getNetworkByChainId(numericChainId);
        if (network) {
          const networkKey = Object.keys(NETWORKS).find(
            (key) => NETWORKS[key].chainId === numericChainId
          );
          if (networkKey) {
            setSelectedNetwork(networkKey);
          }
        }
        return numericChainId;
      } catch (error) {
        console.error("Error detecting network:", error);
        return null;
      }
    }
    return null;
  }, [setCurrentChainId, setSelectedNetwork]);

  // Initialize TransactionManager for the current network
  const initializeTransactionManager = useCallback(async (networkType, selectedNetwork, evmContext = {}) => {
    try {
      const networkConfig = getCurrentNetwork(networkType, selectedNetwork);

      // Validate network configuration
      if (!validateNetworkConfig(networkType, networkConfig)) {
        throw new Error(`Invalid network configuration for ${networkType}:${selectedNetwork}`);
      }

      const txManager = new TransactionManager();

      if (networkType === "evm") {
        await txManager.initialize("evm", networkConfig, evmContext);
      } else if (networkType === "solana") {
        console.log("Solana wallet info:", {
          connected: solanaConnected,
          publicKey: solanaPublicKey?.toString(),
        });

        const walletConfig = {
          wallet: {
            connected: solanaConnected,
            publicKey: solanaPublicKey,
            sendTransaction: solanaSendTransaction,
            signTransaction: solanaSignTransaction,
            signAllTransactions: solanaSignAllTransactions,
            disconnect: solanaDisconnect,
          },
          connection: connection,
        };
        await txManager.initialize("solana", networkConfig, walletConfig);
      } else {
        throw new Error(`Unsupported network type: ${networkType}`);
      }

      setTransactionManager(txManager);
      console.log(`✅ TransactionManager initialized for ${networkType}:${selectedNetwork}`);
      return txManager;
    } catch (error) {
      console.error("❌ Error initializing TransactionManager:", error);
      return null;
    }
  }, [
    solanaConnected,
    solanaPublicKey,
    solanaSendTransaction,
    solanaSignTransaction,
    solanaSignAllTransactions,
    solanaDisconnect,
    connection,
    setTransactionManager,
  ]);

  // Network type switching (EVM vs Solana)
  const switchNetworkType = useCallback(async (newNetworkType, selectedNetwork) => {
    console.log(`🔄 Switching network type to: ${newNetworkType}`);

    // Validate network compatibility before switching
    const currentState = {
      networkType: localStorage.getItem("preferredNetworkType"),
      provider: !!window.ethereum,
      solanaConnected,
      solanaPublicKey,
    };

    const compatibility = validateNetworkCompatibility(newNetworkType, currentState);

    if (!compatibility.canProceed) {
      console.error("❌ Cannot switch to network:", compatibility.issues);
      throw new Error(`Network switch failed: ${compatibility.issues.join(', ')}`);
    }

    if (compatibility.warnings.length > 0) {
      console.warn("⚠️ Network switch warnings:", compatibility.warnings);
    }

    // Create network-isolated state cleaner
    const currentNetworkType = currentState.networkType;
    const stateCleaner = createNetworkStateCleaner(currentNetworkType, newNetworkType);

    // Clear state using isolated cleaner
    stateCleaner(clearAllState);

    // Update network type and persist preference
    setNetworkType(newNetworkType);
    localStorage.setItem("preferredNetworkType", newNetworkType);

    // Update selected network and persist preference
    setSelectedNetwork(selectedNetwork);
    if (newNetworkType === "solana") {
      localStorage.setItem(`preferred_solana_network`, selectedNetwork);
    } else {
      localStorage.setItem(`preferred_evm_network`, selectedNetwork);
    }

    // Initialize TransactionManager for new network
    try {
      if (newNetworkType === "solana") {
        // Initialize Solana TransactionManager if Solana wallet is connected
        if (solanaConnected && solanaPublicKey && connection) {
          const newTxManager = await initializeTransactionManager(
            "solana",
            selectedNetwork
          );
          console.log(`✅ Successfully switched to Solana network: ${selectedNetwork}`);
          return newTxManager;
        } else {
          console.log("⏳ Solana network selected but wallet not connected yet");
        }
      } else {
        // Initialize EVM TransactionManager
        const newTxManager = await initializeTransactionManager("evm", selectedNetwork);
        console.log(`✅ Successfully switched to EVM network: ${selectedNetwork}`);
        return newTxManager;
      }
    } catch (error) {
      console.error("❌ Failed to initialize TransactionManager after network switch:", error);
      // Don't throw here - let the user continue and try to connect wallet
    }

    return null;
  }, [
    setNetworkType,
    setSelectedNetwork,
    clearAllState,
    solanaConnected,
    solanaPublicKey,
    connection,
    initializeTransactionManager,
  ]);

  // Network switching within same type (e.g., mainnet to testnet)
  const switchNetwork = useCallback(async (networkKey, networkType) => {
    if (networkType === "solana") {
      // For Solana networks, update the selected network and clear cached data
      setSelectedNetwork(networkKey);

      // Persist selected Solana network to localStorage
      localStorage.setItem(`preferred_solana_network`, networkKey);

      // Clear cached data when switching Solana networks (handled by clearAllState)
      if (clearAllState) {
        clearAllState();
      }

      console.log(
        `🔄 Solana network switching to ${networkKey}`
      );

      const newNetworkConfig = getCurrentNetwork(networkType, networkKey);
      console.log(
        `🌐 Network endpoint changing to: ${newNetworkConfig?.rpcUrl}`
      );

      // Small delay to allow ConnectionProvider to update
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log(
        `✅ Network switch completed for ${networkKey} - ConnectionProvider should now use new endpoint`
      );
      return true;
    }

    // EVM network switching logic - automatically switch MetaMask
    const network = NETWORKS.evm[networkKey];
    console.log(`🔄 Switching to EVM network: ${networkKey} (${network?.name || 'Unknown'})`);

    if (!window.ethereum) {
      console.error("❌ MetaMask not found");
      alert("Please install MetaMask to use EVM networks!");
      return false;
    }
    if (!network) {
      console.error(`❌ Unsupported network: ${networkKey}`);
      alert(`Network ${networkKey} is not supported`);
      return false;
    }

    setIsNetworkSwitching(true);

    try {
      console.log(`🦊 Requesting MetaMask to switch to ${network.name} (Chain ID: ${network.chainId})`);

      // Try to switch to the network
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${network.chainId.toString(16)}` }],
      });

      // Success! Update our internal state
      setSelectedNetwork(networkKey);
      setCurrentChainId(network.chainId);

      // Persist selected EVM network to localStorage
      localStorage.setItem(`preferred_evm_network`, networkKey);

      console.log(`✅ Successfully switched to ${network.name}`);
      return true;

    } catch (switchError) {
      console.log(`⚠️ Network switch failed, checking if network needs to be added...`);

      // If the network is not added to MetaMask, add it first
      if (switchError.code === 4902) {
        try {
          console.log(`📝 Adding ${network.name} to MetaMask...`);

          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${network.chainId.toString(16)}`,
                chainName: network.name,
                nativeCurrency: network.nativeCurrency,
                rpcUrls: network.rpcUrls,
                blockExplorerUrls: network.blockExplorerUrls,
              },
            ],
          });

          // Update our internal state after successful add
          setSelectedNetwork(networkKey);
          setCurrentChainId(network.chainId);

          // Persist selected EVM network to localStorage
          localStorage.setItem(`preferred_evm_network`, networkKey);

          console.log(`✅ Successfully added and switched to ${network.name}`);
          return true;

        } catch (addError) {
          console.error(`❌ Failed to add ${network.name}:`, addError.message);

          // User-friendly error handling
          if (addError.code === 4001) {
            alert(`You cancelled adding ${network.name} to MetaMask. Please try again if you want to use this network.`);
          } else {
            alert(`Failed to add ${network.name} to MetaMask. Please add it manually.`);
          }
          return false;
        }
      } else {
        // Handle other types of errors
        console.error(`❌ Network switch error:`, switchError.message);

        if (switchError.code === 4001) {
          // User rejected the switch
          console.log(`User cancelled network switch to ${network.name}`);
          alert(`You cancelled switching to ${network.name}. Please approve the network switch to continue.`);
        } else {
          console.log(`Failed to switch to ${network.name}: ${switchError.message}`);
          alert(`Failed to switch to ${network.name}. Please try again or switch manually in MetaMask.`);
        }
        return false;
      }
    } finally {
      setIsNetworkSwitching(false);
      console.log(`🔄 Network switching completed for ${networkKey}`);
    }
  }, [
    setSelectedNetwork,
    clearAllState,
    setIsNetworkSwitching,
    setCurrentChainId,
  ]);

  return {
    // Functions
    detectCurrentNetwork,
    initializeTransactionManager,
    switchNetworkType,
    switchNetwork,
  };
};

export default useNetworkManager;