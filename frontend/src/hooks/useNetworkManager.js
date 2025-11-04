import { useState, useCallback } from "react";

// Import blockchain adapters and utilities
import { TransactionManager } from "../adapters/TransactionManager.js";
import {
  NETWORKS,
  getNetworkByChainId,
  getCurrentNetwork,
} from "../utils/walletUtils.js";

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
  const initializeTransactionManager = useCallback(async (networkType, selectedNetwork) => {
    try {
      const txManager = new TransactionManager();
      const networkConfig = getCurrentNetwork(networkType, selectedNetwork);

      if (networkType === "evm") {
        await txManager.initialize("evm", networkConfig);
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
      }

      setTransactionManager(txManager);
      console.log(`TransactionManager initialized for ${networkType}`);
      return txManager;
    } catch (error) {
      console.error("Error initializing TransactionManager:", error);
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
    setNetworkType(newNetworkType);
    // Persist user's network type preference
    localStorage.setItem("preferredNetworkType", newNetworkType);

    // Clear all state when switching networks to prevent cached data
    if (clearAllState) {
      clearAllState();
    }

    if (newNetworkType === "solana") {
      // Initialize Solana TransactionManager if Solana wallet is connected
      if (solanaConnected && solanaPublicKey && connection) {
        const newTxManager = await initializeTransactionManager(
          "solana",
          selectedNetwork
        );
        return newTxManager;
      }
    } else {
      // Initialize EVM TransactionManager
      const newTxManager = await initializeTransactionManager("evm", selectedNetwork);
      return newTxManager;
    }
    return null;
  }, [
    setNetworkType,
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

    // EVM network switching logic
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return false;
    }

    const network = NETWORKS.evm[networkKey];
    if (!network) {
      alert("Unsupported network");
      return false;
    }

    setIsNetworkSwitching(true);

    try {
      // Try to switch to the network
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${network.chainId.toString(16)}` }],
      });

      setSelectedNetwork(networkKey);
      setCurrentChainId(network.chainId);
      return true;
    } catch (switchError) {
      // If the network is not added to MetaMask, add it
      if (switchError.code === 4902) {
        try {
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

          setSelectedNetwork(networkKey);
          setCurrentChainId(network.chainId);
          return true;
        } catch (addError) {
          console.error("Error adding network:", addError);
          alert(`Failed to add ${network.name} to MetaMask`);
          return false;
        }
      } else {
        console.error("Error switching network:", switchError);
        alert(`Failed to switch to ${network.name}`);
        return false;
      }
    } finally {
      setIsNetworkSwitching(false);
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