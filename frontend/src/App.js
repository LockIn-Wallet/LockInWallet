import React, { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import SavingsABI from "./SavingsABI.json";
import MockUSDT_ABI from "./MockUSDT_ABI.json";

// Import custom hooks
import { useNetworkManager } from "./hooks/useNetworkManager.js";

// Solana imports
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  WalletMultiButton,
  WalletDisconnectButton,
} from "@solana/wallet-adapter-react-ui";

// Import Solana wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css";

// Import extracted styles
import {
  styles,
  buttonStyles,
  cardStyles,
  formStyles,
  spacingUtilities,
  borderRadius,
  fontSize,
} from "./styles";

// Import network configuration
import networkConfig from "./networkConfig.json";

// Import utility functions
import {
  NETWORKS,
  getNetworkByChainId,
  getCurrentNetwork,
  isSolanaNetwork,
  formatCountdown,
  calculateInstantWithdrawableAmount,
} from "./utils/walletUtils.js";

// Import network filtering utilities
import {
  getDefaultNetwork,
  getAvailableNetworks,
  hasProductionNetworks,
} from "./utils/networkFilter.js";


// Import provider management utilities
import {
  ensureCorrectNetwork,
  createProviderAndSigner,
} from "./utils/providerManager.js";

// Import circuit breaker utilities
import {
  createCircuitBreakers,
  safeContractCall,
  debounce,
} from "./utils/circuitBreaker.js";

// Import error handling utilities
import {
  createErrorHandler,
  retryWithErrorHandling,
  getNetworkErrorMessage,
  getDevErrorDetails,
} from "./utils/errorHandling.js";

// Import services
import {
  fetchSpendingLimits as fetchSpendingLimitsService,
  fetchPendingLimitProposals as fetchPendingLimitProposalsService,
  fetchUserBalances as fetchUserBalancesService,
} from "./services";

// Import components
import SolanaWalletProvider from "./components/SolanaWalletProvider.js";
import SocialLinks from "./components/atoms/SocialLinks.js";
import StatusHeader from "./components/molecules/StatusHeader.js";
import BalanceDisplay from "./components/molecules/BalanceDisplay.js";
import WalletConnectionPrompt from "./components/molecules/WalletConnectionPrompt.js";
import DepositInterface from "./components/molecules/DepositInterface.js";
import SpendingLimitsSetup from "./components/organisms/SpendingLimitsSetup.js";
import WithdrawalInterface from "./components/organisms/WithdrawalInterface.js";
import SetupCommitStep from "./components/organisms/SetupCommitStep.js";
import WithdrawalAddressSetupStep from "./components/organisms/WithdrawalAddressSetupStep.js";
import Footer from "./components/atoms/Footer.js";

// Note: Step validation utilities removed - using simplified setup logic

const ETH_ADDRESS = networkConfig.constants.ETH_ADDRESS; // ETH address (native token)
const SOL_ADDRESS = networkConfig.constants.SOL_ADDRESS; // SOL address (native token)

// For backward compatibility
const USDT_ADDRESS = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788"; // Updated: 0x610178dA211FEF7D417bC0e6FeD39F05609AD788

// Main App Component with state management
function AppContent() {
  // Network state management - try to restore from localStorage
  const [networkType, setNetworkType] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem("preferredNetworkType");
    if (saved === "solana" || saved === "evm") {
      return saved;
    }

    // Default to Solana if we detect a Solana wallet connection
    return localStorage.getItem("walletName") ? "solana" : "evm";
  }); // "evm" or "solana"

  // Smart network selection based on environment and deployment status
  const [selectedNetwork, setSelectedNetwork] = useState(() => {
    // Try to restore from localStorage first
    const savedNetwork = localStorage.getItem(`preferred_${networkType}_network`);
    if (savedNetwork) {
      const availableNetworks = getAvailableNetworks(networkType);
      const isAvailable = availableNetworks.some(network => network.key === savedNetwork);
      if (isAvailable) {
        return savedNetwork;
      }
    }

    // Get appropriate default based on environment and deployment status
    return getDefaultNetwork(networkType);
  });

  // Conditionally render SolanaWalletProvider only for Solana network
  if (networkType === "solana") {
    return (
      <SolanaWalletProvider
        networkType={networkType}
        selectedNetwork={selectedNetwork}
      >
        <AppContentInner
          networkType={networkType}
          setNetworkType={setNetworkType}
          selectedNetwork={selectedNetwork}
          setSelectedNetwork={setSelectedNetwork}
        />
      </SolanaWalletProvider>
    );
  }

  // EVM mode - no Solana provider needed
  return (
    <AppContentInner
      networkType={networkType}
      setNetworkType={setNetworkType}
      selectedNetwork={selectedNetwork}
      setSelectedNetwork={setSelectedNetwork}
    />
  );
}

// Inner component that uses wallet hooks
function AppContentInner({
  networkType,
  setNetworkType,
  selectedNetwork,
  setSelectedNetwork,
}) {
  // EVM state
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [savingsContract, setSavingsContract] = useState(null);
  const [balances, setBalances] = useState({}); // Multi-token balances

  // Solana wallet state - only use hooks when in Solana mode
  let solanaConnected = false;
  let solanaPublicKey = null;
  let solanaDisconnect = () => {};
  let solanaWallet = null;
  let solanaSendTransaction = () => {};
  let solanaSignTransaction = () => {};
  let solanaSignAllTransactions = () => {};
  let connection = null;

  // Only use Solana hooks when networkType is 'solana' and provider is available
  if (networkType === "solana") {
    try {
      const walletState = useWallet();
      const connectionState = useConnection();

      solanaConnected = walletState.connected;
      solanaPublicKey = walletState.publicKey;
      solanaDisconnect = walletState.disconnect;
      solanaWallet = walletState.wallet;
      solanaSendTransaction = walletState.sendTransaction;
      solanaSignTransaction = walletState.signTransaction;
      solanaSignAllTransactions = walletState.signAllTransactions;
      connection = connectionState.connection;
    } catch (error) {
      console.warn("Solana wallet hooks not available:", error);
    }
  }
  const [currentChainId, setCurrentChainId] = useState(null); // MetaMask's current chain ID
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);

  // Multi-blockchain transaction manager
  const [transactionManager, setTransactionManager] = useState(null);

  // Circuit breaker protection
  const [circuitBreakers] = useState(() => createCircuitBreakers());

  // Prevent multiple simultaneous wallet operations (ref for synchronous check)
  const walletOperationInProgress = useRef(false);

  // Error handling
  const [lastError, setLastError] = useState(null);
  const contractErrorHandler = createErrorHandler(
    "contract_interaction",
    (error) => {
      setLastError(error);
      // Display user-friendly error message
      if (error.severity === "error") {
        console.error(
          "Contract Error:",
          error.userMessage + getDevErrorDetails(error)
        );
      }
    }
  );

  // Time-based spending limits state - unified interface
  const [spendingLimits, setSpendingLimits] = useState([]); // Array of all time periods
  const [pendingLimitProposals, setPendingLimitProposals] = useState([]); // Pending limit change proposals
  const [limitsLoaded, setLimitsLoaded] = useState(false); // Track if limits have been fetched
  const [limitEdits, setLimitEdits] = useState({}); // Track unsaved limit edits from SpendingLimitsSetup
  // const [saveSpendingLimitsCallback, setSaveSpendingLimitsCallback] = useState(null); // Temporarily disabled

  // Unified limit editing state - moved to SpendingLimitsSetup component

  const [selectedToken, setSelectedToken] = useState("USDT"); // Default to USDT
  const [userAddress, setUserAddress] = useState(""); // Store user address

  // Proxy deployment state (still used by setup components)
  const [isProxyDeployed, setIsProxyDeployed] = useState(false);
  const [proxyAddress, setProxyAddress] = useState("");

  // Two-phase system state
  const [isSetupCommitted, setIsSetupCommitted] = useState(false);
  const [setupInfo, setSetupInfo] = useState(null);

  // Bypass system state
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // Note: Bypass system state now managed by WithdrawalInterface component

  // Enhanced withdrawal system state
  const [instantWithdrawableAmount, setInstantWithdrawableAmount] = useState(0);
  const [limitingPeriod, setLimitingPeriod] = useState(null); // Which period is limiting

  // Note: Simplified setup - removed step validation and wizard navigation

  // State clearing function for network switches
  const clearAllState = () => {
    setIsProxyDeployed(false);
    setProxyAddress("");
    setPendingLimitProposals([]);
    setSpendingLimits([]);
    setIsSetupCommitted(false);
    setBalances({});
    // Note: Bypass requests now cleared by WithdrawalInterface component
  };

  // Network management hook
  const {
    detectCurrentNetwork,
    initializeTransactionManager,
    switchNetworkType,
    switchNetwork,
  } = useNetworkManager({
    // Solana wallet context
    solanaConnected,
    solanaPublicKey,
    solanaSendTransaction,
    solanaSignTransaction,
    solanaSignAllTransactions,
    solanaDisconnect,
    connection,

    // State setters
    setNetworkType,
    setSelectedNetwork,
    setCurrentChainId,
    setTransactionManager,
    setIsNetworkSwitching,

    // State clearing function
    clearAllState,
  });

  // Network functions are now provided by useNetworkManager hook

  // Auto-initialize TransactionManager for EVM if wallet is connected but TransactionManager is null
  useEffect(() => {
    const initializeEVMTransactionManagerIfNeeded = async () => {
      if (
        networkType === "evm" &&
        provider &&
        signer &&
        savingsContract &&
        !transactionManager
      ) {
        console.log("🔄 Auto-initializing TransactionManager for connected EVM wallet...");
        try {
          const txManager = await initializeTransactionManager(networkType, selectedNetwork, { provider, signer });
          if (txManager) {
            console.log("✅ TransactionManager auto-initialized for EVM");
          } else {
            console.error("❌ TransactionManager auto-initialization failed for EVM");
          }
        } catch (error) {
          console.error("❌ Error auto-initializing TransactionManager for EVM:", error);
        }
      }
    };

    initializeEVMTransactionManagerIfNeeded();
  }, [networkType, provider, signer, savingsContract, transactionManager, initializeTransactionManager, selectedNetwork]);

  // Memoized callback for spending limits update to prevent infinite loops
  const handleSpendingLimitsUpdate = useCallback((updatedLimits, updatedLimitEdits) => {
    setSpendingLimits(updatedLimits);
    setLimitEdits(updatedLimitEdits || {});
  }, []);

  const isCorrectNetwork = () => {
    if (networkType === "solana") {
      // For Solana, consider connected if wallet is connected
      return solanaConnected;
    }

    // For EVM networks
    const expectedNetwork = getCurrentNetwork(networkType, selectedNetwork);
    return currentChainId === expectedNetwork.chainId;
  };

  // Timer for countdown updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Set up event listeners and auto-connect (run once)
  useEffect(() => {
    if (window.ethereum) {
      const handleChainChanged = (chainId) => {
        const numericChainId = parseInt(chainId, 16);
        setCurrentChainId(numericChainId);

        const network = getNetworkByChainId(numericChainId);
        if (network) {
          const networkKey = Object.keys(NETWORKS.evm).find(
            (key) => NETWORKS.evm[key].chainId === numericChainId
          );
          if (networkKey) {
            setSelectedNetwork(networkKey);
            // Only set to EVM if user hasn't explicitly chosen Solana
            const savedNetworkType = localStorage.getItem(
              "preferredNetworkType"
            );
            if (!savedNetworkType || savedNetworkType === "evm") {
              setNetworkType("evm");
            }
            // Re-attempt auto-connect now that chain changed
            autoConnectWallet();
          }
        }
      };

      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          // User disconnected wallet
          setProvider(null);
          setSigner(null);
          setSavingsContract(null);
          setBalances({});
          setUserAddress("");
          setIsSetupCommitted(false);
          setSetupInfo(null);
          // Note: Bypass requests now cleared by WithdrawalInterface component
          setPendingLimitProposals([]);
          setIsProxyDeployed(false);
          setProxyAddress("");
          walletOperationInProgress.current = false; // Reset lock on disconnect
        } else {
          // Account changed, reconnect
          autoConnectWallet();
        }
      };

      window.ethereum.on("chainChanged", handleChainChanged);
      window.ethereum.on("accountsChanged", handleAccountsChanged);

      // Detect current network on load
      detectCurrentNetwork();

      // Auto-connect on page load
      autoConnectWallet();

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("chainChanged", handleChainChanged);
          window.ethereum.removeListener(
            "accountsChanged",
            handleAccountsChanged
          );
        }
      };
    }
  }, []); // Run once on mount

  // Balance loading when network changes now handled by BalanceDisplay component

  // Detect existing Solana connection on page load
  useEffect(() => {
    const detectSolanaConnection = async () => {
      // Only run if user preferred Solana or if we need to auto-detect
      const savedNetworkType = localStorage.getItem("preferredNetworkType");
      if (savedNetworkType === "solana" && !solanaConnected) {
        // Try to auto-connect to existing Solana wallet
        if (solanaWallet && !solanaConnected) {
          try {
            await solanaWallet.connect();
          } catch (error) {
            console.log("No existing Solana connection to restore");
          }
        }
      }
    };

    detectSolanaConnection();
  }, []); // Run once on mount

  // Calculate instant withdrawal amount whenever spending limits change
  useEffect(() => {
    const result = calculateInstantWithdrawableAmount(spendingLimits);
    setInstantWithdrawableAmount(result.amount);
    setLimitingPeriod(result.limitingPeriod);
  }, [spendingLimits]);


  // Balance refresh function for deposit callbacks and manual refresh
  const refreshBalances = async () => {
    try {
      console.log("🔄 App.js: Refreshing balances after deposit...");

      // Fetch balances using the same service as BalanceDisplay
      const fetchedBalances = await fetchUserBalancesService({
        transactionManager,
        savingsContract,
        signer,
        connection,
        networkType,
        selectedNetwork,
        getCurrentNetwork,
        userAddress,
        solanaPublicKey
      });

      console.log("✅ App.js: Balances refreshed:", fetchedBalances);

      // Update the state, which will trigger BalanceDisplay re-render
      setBalances(fetchedBalances);
    } catch (error) {
      console.error("❌ App.js: Error refreshing balances:", error);
      // Set empty balances on error
      setBalances({});
    }
  };

  // TransactionManager initialization now handled by useNetworkManager hook

  // Note: Solana data loading now handled by individual components
  // (SpendingLimitsSetup, WithdrawalInterface, BalanceDisplay, etc.)

  // Note: TransactionManager initialization now handled by useNetworkManager hook
  // Data loading is handled by individual components (BalanceDisplay, WithdrawalInterface, etc.)

  // Note: Balance loading now handled by BalanceDisplay component

  // Set default balances immediately when switching to Solana to avoid empty state

  // Note: Step validation logic removed - using simplified setup

  // Note: Balance loading when switching networks is now handled directly in switchNetworkType()

  // Balance fetching function moved to BalanceDisplay component

  const checkProxyStatusWithSigner = async (
    contract,
    signerParam,
    userAddr
  ) => {
    console.log("🔍 checkProxyStatusWithSigner called with:", {
      contract: !!contract,
      signer: !!signerParam,
      userAddr,
    });

    if (!contract) {
      console.log("❌ No contract provided to checkProxyStatusWithSigner");
      return;
    }
    if (!signerParam) {
      console.log("❌ No signer available for checkProxyStatusWithSigner");
      return;
    }

    try {
      const userAddress = userAddr || (await signerParam.getAddress());
      console.log(`🔍 Checking proxy status for user: ${userAddress}`);

      // Check if proxy is already deployed (with circuit breaker protection)
      console.log("🔍 Calling contract.isProxyDeployed...");
      const proxyDeployed = await safeContractCall(
        () => contract.isProxyDeployed(userAddress),
        circuitBreakers.contracts
      );
      console.log(`🔍 isProxyDeployed result: ${proxyDeployed}`);

      // Get the calculated deposit address (whether deployed or not)
      console.log("🔍 Calling contract.getUserDepositAddress...");
      const depositAddress = await safeContractCall(
        () => contract.getUserDepositAddress(userAddress),
        circuitBreakers.contracts
      );
      console.log(`🔍 getUserDepositAddress result: ${depositAddress}`);

      console.log(`✅ Proxy status for ${userAddress}:`);
      console.log(`- Deployed: ${proxyDeployed}`);
      console.log(`- Deposit Address: ${depositAddress}`);

      // Update UI state - only set proxy address if actually deployed
      setIsProxyDeployed(proxyDeployed);
      setProxyAddress(proxyDeployed ? depositAddress : "");

      console.log(
        `✅ State updated: isProxyDeployed=${proxyDeployed}, proxyAddress=${depositAddress}`
      );
    } catch (error) {
      const formattedError = contractErrorHandler(error);

      // If there's an error checking proxy status, try a fallback approach
      // The error might be because the function doesn't exist or the proxy is in an unexpected state
      try {
        const userAddress = userAddr || (await signerParam.getAddress());
        const depositAddress = await safeContractCall(
          () => contract.getUserDepositAddress(userAddress),
          circuitBreakers.contracts
        );

        // If we can get a deposit address, assume proxy exists if it's not the zero address
        const hasValidAddress =
          depositAddress &&
          depositAddress !== "0x0000000000000000000000000000000000000000";

        console.log(
          `Fallback check: depositAddress=${depositAddress}, hasValidAddress=${hasValidAddress}`
        );

        setIsProxyDeployed(hasValidAddress);
        setProxyAddress(hasValidAddress ? depositAddress : "");
      } catch (fallbackError) {
        contractErrorHandler(fallbackError);
        setIsProxyDeployed(false);
        setProxyAddress("");
      }
    }
  };

  const autoConnectWallet = debounce(async () => {
    if (!window.ethereum || walletOperationInProgress.current) return;
    walletOperationInProgress.current = true;
    try {
      // Check if already connected
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });
      if (accounts.length === 0) return;

      console.log(`🔗 Auto-connecting wallet to ${networkType}:${selectedNetwork}...`);

      // Auto-connect should NOT force network switch - just connect if already correct
      if (networkType === "evm") {
        const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
        const currentChain = parseInt(chainIdHex, 16);
        const expectedNetwork = getCurrentNetwork(networkType, selectedNetwork);
        if (currentChain !== expectedNetwork.chainId) {
          console.log(`⏭️ Auto-connect skipped: MetaMask on chain ${currentChain}, expected ${expectedNetwork.chainId}. User can switch manually.`);
          setCurrentChainId(currentChain);
          return;
        }

      }

      await connectWalletInternal();
    } catch (error) {
      console.log(
        "Auto-connect failed (expected on first visit):",
        error.message
      );
    } finally {
      walletOperationInProgress.current = false;
    }
  }, 2000); // 2 second debounce to prevent rapid reconnection

  const connectWallet = debounce(async () => {
    if (window.ethereum && !walletOperationInProgress.current) {
      walletOperationInProgress.current = true;
      try {
        console.log(`🔗 Connecting wallet to ${networkType}:${selectedNetwork}...`);

        // Step 1: Switch network FIRST (doesn't require account authorization)
        if (networkType === "evm") {
          console.log(`🔄 Ensuring MetaMask is on ${selectedNetwork} network...`);
          const networkSwitched = await ensureCorrectNetwork(selectedNetwork);
          if (!networkSwitched) {
            throw new Error(`Failed to switch to ${selectedNetwork} network. Please switch manually.`);
          }
          console.log(`✅ MetaMask on ${selectedNetwork} network`);
        }

        // Step 2: Request account access (after network is correct)
        await window.ethereum.request({ method: "eth_requestAccounts" });

        // Step 3: Complete the connection
        await connectWalletInternal();
      } catch (error) {
        console.error('❌ Wallet connection failed:', error.message);

        // Provide user-friendly error messages
        if (error.message.includes("User rejected")) {
          alert("Connection cancelled. Please try again and approve the connection.");
        } else if (error.message.includes("Unauthorized") || error.message.includes("-32006")) {
          alert("MetaMask RPC error: Your wallet's RPC endpoint is returning Unauthorized.\n\nPlease check MetaMask → Settings → Networks → Polygon and verify the RPC URL is working.");
        } else if (error.message.includes("network")) {
          alert(`Network switch required. Please switch MetaMask to ${selectedNetwork} and try again.`);
        } else {
          const walletErrorHandler = createErrorHandler("wallet_connection");
          const formattedError = walletErrorHandler(error);
          alert(formattedError.userMessage + getDevErrorDetails(formattedError));
        }
      } finally {
        walletOperationInProgress.current = false;
      }
    } else {
      alert("Please install MetaMask!");
    }
  }, 1000); // 1 second debounce for manual connections

  const connectWalletInternal = async () => {
    // Verify MetaMask is on the correct chain before proceeding
    if (networkType === "evm") {
      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      const currentChain = parseInt(chainIdHex, 16);
      const expectedNetwork = getCurrentNetwork(networkType, selectedNetwork);
      if (currentChain !== expectedNetwork.chainId) {
        console.log(`❌ connectWalletInternal aborted: MetaMask on chain ${currentChain}, expected ${expectedNetwork.chainId}`);
        setCurrentChainId(currentChain);
        return;
      }
    }

    // Create provider and signer from connected wallet
    let web3Provider, web3Signer;
    try {
      const result = await createProviderAndSigner();
      web3Provider = result.provider;
      web3Signer = result.signer;
    } catch (error) {
      console.error("❌ Failed to create provider:", error.message);
      alert(error.message);
      return;
    }

    // Get current network and use its contract address
    const currentNetwork = getCurrentNetwork(networkType, selectedNetwork);
    const contractAddress = currentNetwork.savingsContract;

    if (contractAddress === "0x0000000000000000000000000000000000000000") {
      console.log(
        `Savings contract not deployed on ${currentNetwork.name} yet.`
      );
      return;
    }

    // Verify contract is deployed using the provider (works with both MetaMask and fallback RPC)
    try {
      const code = await web3Provider.getCode(contractAddress);
      const isContractDeployed = code !== '0x' && code !== '0x0' && code.length > 2;
      if (!isContractDeployed) {
        const deploymentError = getNetworkErrorMessage(
          "CONTRACT_NOT_DEPLOYED",
          networkType
        );
        console.error("Contract not deployed:", deploymentError);
        alert(
          `⚠️ Contract Not Deployed\n\n${deploymentError}\n\nCurrent contract address: ${contractAddress}`
        );
        return;
      }
      console.log(`✅ Contract verified at ${contractAddress}`);
    } catch (error) {
      console.error("❌ Contract verification failed:", error.message);
      return;
    }

    const savings = new ethers.Contract(
      contractAddress,
      SavingsABI,
      web3Signer
    );

    setProvider(web3Provider);
    setSigner(web3Signer);
    setSavingsContract(savings);

    // Store user address
    const address = await web3Signer.getAddress();
    setUserAddress(address);

    // Initialize TransactionManager for EVM network
    console.log("🔄 Initializing TransactionManager for EVM network...");
    try {
      const txManager = await initializeTransactionManager(networkType, selectedNetwork, { provider: web3Provider, signer: web3Signer });
      if (txManager) {
        console.log("✅ TransactionManager successfully initialized for EVM");
      } else {
        console.error("❌ TransactionManager initialization failed for EVM");
      }
    } catch (error) {
      console.error("❌ Error initializing TransactionManager for EVM:", error);
    }

    // Automatically fetch balances and proxy status after connecting
    try {
      const userAddress = await web3Signer.getAddress();
      console.log(`Connecting wallet for user: ${userAddress}`);
      // Balance loading now handled by BalanceDisplay component
      console.log(`About to check proxy status...`);
      if (networkType === "evm") {
        await checkProxyStatusWithSigner(savings, web3Signer, userAddress);
        console.log(`Proxy status check completed`);
      }
      await fetchSpendingLimits(savings, web3Signer);
      await fetchPendingLimitProposals(userAddress);
      // Note: Withdrawal data now handled by components

      // Check setup status (with circuit breaker protection)
      const setupCommitted = await safeContractCall(
        () => savings.isSetupCommitted(),
        circuitBreakers.contracts
      );
      setIsSetupCommitted(setupCommitted);

      if (setupCommitted) {
        const info = await safeContractCall(
          () => savings.getSetupInfo(),
          circuitBreakers.contracts
        );
        setSetupInfo({
          committed: info.committed,
          totalLockedValue: ethers.formatUnits(info.totalLockedValue, 6),
          commitTimestamp: new Date(
            Number(info.commitTimestamp) * 1000
          ).toLocaleDateString(),
          increasesInPeriod: ethers.formatUnits(info.increasesInPeriod, 6),
          lastIncreaseTimestamp: new Date(
            Number(info.lastIncreaseTimestamp) * 1000
          ).toLocaleDateString(),
        });
      }
    } catch (error) {
      const dataErrorHandler = createErrorHandler("initial_data_fetch");
      const formattedError = dataErrorHandler(error);

      // Still set empty balances to show the balance section
      setBalances({});

      // Set error state for user feedback
      setLastError(formattedError);
    }
  };

  // Unified spending limits functions - functions moved to SpendingLimitsSetup component

  const fetchPendingLimitProposals = async (txManager = transactionManager) => {
    const currentUserAddress = getCurrentUserAddress();

    // Only proceed if transactionManager is available
    if (!txManager) {
      console.log(`⏭️ Skipping pending proposals fetch - TransactionManager not yet initialized`);
      return;
    }

    try {
      const proposals = await fetchPendingLimitProposalsService({
        transactionManager: txManager,
        savingsContract,
        networkType,
        userAddress: currentUserAddress,
        getCurrentUserAddress,
      });

      setPendingLimitProposals(proposals);
      console.log(`✅ Loaded ${proposals.length} pending proposals`);
    } catch (error) {
      console.error("Error fetching pending proposals:", error);
      setPendingLimitProposals([]);
    }
  };

  // Note: Setup commit logic moved to SetupCommitStep component

  // Helper function that accepts TransactionManager directly (for initialization)
  // Helper function to get current user address based on network (DRY)
  const getCurrentUserAddress = (forNetworkType = null) => {
    const targetNetwork = forNetworkType || networkType;
    if (targetNetwork === "solana") {
      return solanaPublicKey?.toString();
    } else {
      return userAddress;
    }
  };

  // Helper function to update limitEdits state - removed since state moved to SpendingLimitsSetup component

  const fetchSpendingLimitsWithTxManager = async (txManager) => {
    console.log(
      "🚀 fetchSpendingLimitsWithTxManager called for network:",
      networkType
    );

    // Only proceed if transactionManager is available
    if (!txManager) {
      console.log(`⏭️ Skipping spending limits fetch with TxManager - TransactionManager not yet initialized`);
      return;
    }

    if (networkType === "solana") {
      try {
        // Fetch spending limits using service
        const spendingData = await fetchSpendingLimitsService({
          transactionManager: txManager,
          networkType,
        });

        setSpendingLimits(spendingData.limits);
        setIsSetupCommitted(spendingData.isSetupCommitted);
        setLimitsLoaded(true);

        // Note: Bypass requests now handled by WithdrawalInterface component

        console.log("✅ Solana spending limits and bypass requests loaded!");
      } catch (error) {
        console.error("Error fetching Solana spending limits:", error);
        setSpendingLimits([]);
        setLimitsLoaded(true);
      }
    }
  };

  const fetchSpendingLimits = async (
    contract = savingsContract,
    userSigner = signer
  ) => {
    console.log("🚀 fetchSpendingLimits called for network:", networkType);

    if (networkType === "solana") {
      console.log(
        "🔵 Delegating Solana spending limits to dedicated function..."
      );
      // Delegate to the dedicated Solana function to avoid duplication and race conditions
      await fetchSpendingLimitsWithTxManager(transactionManager);
      return;
    }

    // Only proceed if transactionManager is available
    if (!transactionManager) {
      console.log(`⏭️ Skipping spending limits fetch - TransactionManager not yet initialized`);
      return;
    }

    try {
      const spendingData = await fetchSpendingLimitsService({
        transactionManager,
        savingsContract: contract,
        signer: userSigner,
        networkType,
      });

      setSpendingLimits(spendingData.limits);
      setIsSetupCommitted(spendingData.isSetupCommitted);
      setLimitsLoaded(true);

      console.log(`✅ Loaded ${spendingData.limits.length} spending limits`);
    } catch (error) {
      console.error("Error fetching spending limits:", error);
      setSpendingLimits([]);
      setLimitsLoaded(true);
    }
  };

  // Note: Withdrawal address management moved to WithdrawalInterface and WithdrawalAddressSetupStep components

  return (
    <div style={styles.app.container}>
      {/* Social Media Links - Top Right Corner */}
      <SocialLinks />

      {/* Error Display */}
      {lastError && lastError.severity === "error" && (
        <div
          style={{
            backgroundColor: "#fed7d7",
            border: "1px solid #fc8181",
            borderRadius: "6px",
            padding: "12px",
            margin: "10px 0",
            color: "#9b2c2c",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
            ❌ Error
          </div>
          <div style={{ marginBottom: "8px" }}>{lastError.userMessage}</div>
          <button
            onClick={() => setLastError(null)}
            style={{
              backgroundColor: "#fc8181",
              color: "white",
              border: "none",
              borderRadius: "4px",
              padding: "4px 8px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status Header Component */}
      <StatusHeader
        provider={provider}
        networkType={networkType}
        selectedNetwork={selectedNetwork}
        isNetworkSwitching={isNetworkSwitching}
        currentChainId={currentChainId}
        userAddress={userAddress}
        solanaWallet={solanaWallet}
        solanaPublicKey={solanaPublicKey}
        solanaConnected={solanaConnected}
        isSetupCommitted={isSetupCommitted}
        switchNetworkType={switchNetworkType}
        switchNetwork={switchNetwork}
      />

      {/* Wallet Connection Prompt Component */}
      <WalletConnectionPrompt
        provider={provider}
        networkType={networkType}
        solanaConnected={solanaConnected}
        solanaWallet={solanaWallet}
        connectWallet={connectWallet}
      />

      {provider ||
      (networkType === "solana" && solanaConnected && solanaWallet) ? (
        <div>
          {/* Balance Display Component */}
          <BalanceDisplay
            // Blockchain services (dependency injection)
            transactionManager={transactionManager}
            savingsContract={savingsContract}
            signer={signer}
            connection={connection}
            // Network and wallet props
            networkType={networkType}
            selectedNetwork={selectedNetwork}
            userAddress={userAddress}
            solanaPublicKey={solanaPublicKey}
            solanaConnected={solanaConnected}
            // Setup state
            isSetupCommitted={isSetupCommitted}
            // Wallet state
            provider={provider}
            solanaWallet={solanaWallet}
            // Balance state from parent
            balances={balances}
            // Callbacks for App.js state updates
            onBalanceUpdate={(newBalances) => {
              // Update parent state for other components that might need balance data
              setBalances(newBalances);
            }}
            connectWallet={connectWallet}
          />

          {/* Deposit Interface Component */}
          {isSetupCommitted && (
            <DepositInterface
              // Blockchain services (dependency injection)
              transactionManager={transactionManager}
              savingsContract={savingsContract}
              signer={signer}
              connection={connection}
              // Network and wallet props
              networkType={networkType}
              selectedNetwork={selectedNetwork}
              userAddress={userAddress}
              solanaPublicKey={solanaPublicKey}
              solanaConnected={solanaConnected}
              // Token state from parent (shared with withdrawal)
              selectedToken={selectedToken}
              setSelectedToken={setSelectedToken}
              // Callbacks for App.js state updates
              onBalanceUpdate={refreshBalances}
            />
          )}

          {/* Spending Limits Setup / Management */}
          {transactionManager ? (
            <SpendingLimitsSetup
              isSetupCommitted={isSetupCommitted}
              currentTime={currentTime}
              networkType={networkType}
              transactionManager={transactionManager}
              solanaConnected={solanaConnected}
              savingsContract={savingsContract}
              getCurrentUserAddress={getCurrentUserAddress}
              spendingLimits={spendingLimits}
              onSpendingLimitsUpdate={handleSpendingLimitsUpdate}
              // onSetSaveCallback={setSaveSpendingLimitsCallback} // Temporarily disabled
            />
          ) : (
            <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
              Initializing spending limits...
            </div>
          )}

          {/* Withdrawal Addresses Setup Component */}
          {!isSetupCommitted && (
            <WithdrawalAddressSetupStep
              isSetupCommitted={isSetupCommitted}
              spendingLimits={spendingLimits}
              // Blockchain services (dependency injection)
              transactionManager={transactionManager}
              savingsContract={savingsContract}
              // Network context
              networkType={networkType}
              solanaConnected={solanaConnected}
              solanaPublicKey={solanaPublicKey}
              userAddress={userAddress}
            />
          )}
          {/* Setup Commit Step Component */}
          {!isSetupCommitted && (
            <SetupCommitStep
              isSetupCommitted={isSetupCommitted}
              spendingLimits={spendingLimits}
              limitEdits={limitEdits}
              // Blockchain services (dependency injection)
              transactionManager={transactionManager}
              savingsContract={savingsContract}
              networkType={networkType}
              solanaConnected={solanaConnected}
              // Callbacks for parent state updates
              onSetupCommitted={setIsSetupCommitted}
              onSetupInfoUpdate={setSetupInfo}
              onSpendingLimitsRefresh={fetchSpendingLimits}
              // onSaveSpendingLimits={saveSpendingLimitsCallback} // Temporarily disabled
            />
          )}
          {/* Withdrawal Interface Component */}
          {isSetupCommitted && (
            <WithdrawalInterface
              // Blockchain services (dependency injection)
              transactionManager={transactionManager}
              savingsContract={savingsContract}
              signer={signer}
              connection={connection}
              // Network & config
              networkType={networkType}
              selectedNetwork={selectedNetwork}
              getCurrentUserAddress={getCurrentUserAddress}
              getCurrentNetwork={getCurrentNetwork}
              // Wallet state
              solanaConnected={solanaConnected}
              solanaPublicKey={solanaPublicKey}
              userAddress={userAddress}
              // Shared token state (shared with DepositInterface)
              selectedToken={selectedToken}
              setSelectedToken={setSelectedToken}
              // Calculated values
              instantWithdrawableAmount={instantWithdrawableAmount}
              limitingPeriod={limitingPeriod}
              spendingLimits={spendingLimits}
              // Callbacks for App.js state updates
              onBalanceUpdate={refreshBalances}
              onSpendingLimitsUpdate={fetchSpendingLimits}
              // Note: All withdrawal data (addresses, requests, bypasses) now managed by WithdrawalInterface component internally

              // Utilities
              currentTime={currentTime}
            />
          )}
        </div>
      ) : null}
      <Footer />
    </div>
  );
}

// Wrapped App component with Solana wallet provider
function App() {
  return <AppContent />;
}

export default App;
