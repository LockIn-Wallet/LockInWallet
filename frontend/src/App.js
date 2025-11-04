import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import SavingsABI from "./SavingsABI.json";
import MockUSDT_ABI from "./MockUSDT_ABI.json";
import ApprovalSystemModuleABI from "./ApprovalSystemModuleABI.json";

// Import our new blockchain adapters
import { TransactionManager } from "./adapters/TransactionManager.js";

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
  detectExceedingPeriod,
} from "./utils/walletUtils.js";

// Import services
import {
  fetchSpendingLimits as fetchSpendingLimitsService,
  fetchPendingLimitProposals as fetchPendingLimitProposalsService,
  fetchPendingBypassRequests as fetchPendingBypassRequestsService,
} from "./services";

// Import components
import SolanaWalletProvider from "./components/SolanaWalletProvider.js";
import StatusHeader from "./components/molecules/StatusHeader.js";
import BalanceDisplay from "./components/molecules/BalanceDisplay.js";
import WalletConnectionPrompt from "./components/molecules/WalletConnectionPrompt.js";
import DepositInterface from "./components/molecules/DepositInterface.js";
import SpendingLimitsSetup from "./components/organisms/SpendingLimitsSetup.js";
import WithdrawalInterface from "./components/organisms/WithdrawalInterface.js";
import SetupCommitStep from "./components/organisms/SetupCommitStep.js";
import WithdrawalAddressSetupStep from "./components/organisms/WithdrawalAddressSetupStep.js";

// Import step validation utilities
import {
  goToNextStep as goToNextStepUtil,
  goToPreviousStep as goToPreviousStepUtil,
} from "./utils/stepValidation.js";

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
  const [selectedNetwork, setSelectedNetwork] = useState("localhost"); // Current selected network

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
  const [approver, setApprover] = useState("");

  // Solana wallet hooks (now safely inside provider)
  const {
    connected: solanaConnected,
    publicKey: solanaPublicKey,
    disconnect: solanaDisconnect,
    wallet: solanaWallet,
    sendTransaction: solanaSendTransaction,
    signTransaction: solanaSignTransaction,
    signAllTransactions: solanaSignAllTransactions,
  } = useWallet();
  const { connection } = useConnection();
  const [currentChainId, setCurrentChainId] = useState(null); // MetaMask's current chain ID
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);

  // Multi-blockchain transaction manager
  const [transactionManager, setTransactionManager] = useState(null);

  // Time-based spending limits state - unified interface
  const [spendingLimits, setSpendingLimits] = useState([]); // Array of all time periods
  const [pendingLimitProposals, setPendingLimitProposals] = useState([]); // Pending limit change proposals
  const [limitsLoaded, setLimitsLoaded] = useState(false); // Track if limits have been fetched

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

  // Bypass system state (still used by App.js for data coordination)
  const [pendingBypassRequests, setPendingBypassRequests] = useState([]);
  const [approvalModule, setApprovalModule] = useState(null);

  // Enhanced withdrawal system state
  const [instantWithdrawableAmount, setInstantWithdrawableAmount] = useState(0);
  const [limitingPeriod, setLimitingPeriod] = useState(null); // Which period is limiting
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [exceedsInstantLimit, setExceedsInstantLimit] = useState(false);
  const [exceedingPeriod, setExceedingPeriod] = useState(null); // Which period would be exceeded

  // 3-Step Setup Wizard state management
  const [currentStep, setCurrentStep] = useState(1); // Current wizard step (1, 2, or 3)
  const [stepValidation, setStepValidation] = useState({
    step1Complete: false, // Spending limits configured
    step2Complete: false, // At least one withdrawal address added
    step3Complete: false, // Setup committed/locked
  });

  // Note: Step validation functions moved to individual components for encapsulation

  const goToNextStep = () => {
    goToNextStepUtil(currentStep, setCurrentStep);
  };

  const goToPreviousStep = () => {
    goToPreviousStepUtil(currentStep, setCurrentStep);
  };

  // Network detection and switching functions
  const detectCurrentNetwork = async () => {
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
  };

  // Initialize TransactionManager for the current network
  const initializeTransactionManager = async (networkType, selectedNetwork) => {
    try {
      const txManager = new TransactionManager();
      const networkConfig = getCurrentNetwork(networkType, selectedNetwork);

      if (networkType === "evm") {
        await txManager.initialize("evm", networkConfig);
      } else if (networkType === "solana") {
        console.log("Solana wallet info:", {
          connected: solanaConnected,
          publicKey: solanaPublicKey?.toString(),
          wallet: solanaWallet,
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
  };

  // Network type switching (EVM vs Solana)

  const switchNetworkType = async (newNetworkType) => {
    setNetworkType(newNetworkType);
    // Persist user's network type preference
    localStorage.setItem("preferredNetworkType", newNetworkType);

    // Clear all state when switching networks to prevent cached data
    setIsProxyDeployed(false);
    setProxyAddress("");
    setPendingLimitProposals([]); // Clear proposals to load new network's proposals
    setSpendingLimits([]); // Clear spending limits to prevent cached cards
    setIsSetupCommitted(false); // Reset setup status
    setBalances({}); // Clear balances
    setPendingBypassRequests([]); // Clear bypass requests

    if (newNetworkType === "solana") {
      // Disconnect EVM wallet when switching to Solana
      if (provider) {
        setProvider(null);
        setSigner(null);
        setSavingsContract(null);
        setUserAddress("");
      }
      // DON'T disconnect Solana wallet - let it stay connected
      // Initialize Solana TransactionManager if Solana wallet is connected
      if (solanaConnected && solanaPublicKey && connection) {
        const newTxManager = await initializeTransactionManager(
          "solana",
          selectedNetwork
        );
        if (newTxManager) {
          // Balance loading now handled by BalanceDisplay component
          // Check proxy status for Solana
          const userAddress = await newTxManager.getAddress();
          if (userAddress) {
            await checkSolanaProxyStatus(newTxManager, userAddress);
          } else {
            console.warn(
              "❌ Cannot check Solana proxy status: wallet not connected or address unavailable"
            );
          }
          // Load spending limits and proposals
          await fetchSpendingLimitsWithTxManager(newTxManager);
          await fetchPendingLimitProposals();
        }
      }
    } else {
      // Keep Solana wallet connected when switching to EVM
      // if (solanaConnected) {
      //   solanaDisconnect();
      // }
      // Initialize EVM TransactionManager
      await initializeTransactionManager("evm", selectedNetwork);
    }
  };

  const switchNetwork = async (networkKey) => {
    if (networkType === "solana") {
      // For Solana networks, update the selected network and clear cached data
      setSelectedNetwork(networkKey);

      // Clear ALL cached data when switching Solana networks
      setSpendingLimits([]); // Clear spending limits from previous network
      setPendingLimitProposals([]); // Clear proposals from previous network
      setPendingBypassRequests([]); // Clear bypass requests from previous network
      setBalances({}); // Clear balances from previous network
      setLimitsLoaded(false); // Reset limits loaded state

      // Clear spending limit editing state
      setLimitEdits({
        Daily: { value: "", isActive: false, isEditing: false },
        Weekly: { value: "", isActive: false, isEditing: false },
        Monthly: { value: "", isActive: false, isEditing: false },
      });

      // Reset setup state to initial values - will be updated from blockchain
      setIsSetupCommitted(false); // Will be set from blockchain data when loaded
      setCurrentStep(1); // Reset to first step of setup wizard
      setStepValidation({
        step1Complete: false, // Spending limits configured
        step2Complete: false, // Withdrawal addresses configured
        step3Complete: false, // Setup committed
      });

      // Clear form state
      setWithdrawalAmount("");

      // Clear custom period state
      setShowCustomPeriod(false);
      setCustomPeriodName("");
      setCustomPeriodLimit("");
      setCustomPeriodDuration("86400");

      // Reset card states
      setCardStates({
        spendingLimits: { minimized: false },
        balanceCard: { minimized: false },
        addWithdrawalAddress: { minimized: false },
      });

      console.log(
        `🔄 Solana network switching from ${selectedNetwork} to ${networkKey}`
      );
      console.log(`📊 Spending limits cleared: ${spendingLimits.length} -> 0`);
      console.log(`🔧 Setup status reset: ${isSetupCommitted} -> false`);

      const newNetworkConfig = getCurrentNetwork(networkType, networkKey);
      console.log(
        `🌐 Network endpoint changing to: ${newNetworkConfig?.rpcUrl}`
      );
      console.log(`🔍 Network config:`, newNetworkConfig);

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
  };

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
          }
        }
      };

      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          // User disconnected wallet
          setProvider(null);
          setSigner(null);
          setSavingsContract(null);
          setApprovalModule(null);
          setBalances({});
          setUserAddress("");
          setIsSetupCommitted(false);
          setSetupInfo(null);
          setPendingBypassRequests([]);
          setPendingLimitProposals([]);
          setIsProxyDeployed(false);
          setProxyAddress("");
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

  // Update withdrawal analysis whenever amount changes
  useEffect(() => {
    const exceedingPeriod = detectExceedingPeriod(
      withdrawalAmount,
      spendingLimits
    );
    setExceedingPeriod(exceedingPeriod);
    setExceedsInstantLimit(
      parseFloat(withdrawalAmount || 0) > instantWithdrawableAmount
    );
  }, [withdrawalAmount, spendingLimits, instantWithdrawableAmount]);

  // Balance refresh function moved to BalanceDisplay component

  // Initialize TransactionManager when network type changes
  useEffect(() => {
    const initTxManager = async () => {
      console.log("🔄 TransactionManager useEffect triggered:", {
        networkType,
        selectedNetwork,
      });

      if (networkType === "solana") {
        console.log(
          "🟡 Solana network selected, TransactionManager will be initialized when wallet connects"
        );
        // For Solana, we'll wait for wallet connection in separate useEffect
      } else if (networkType === "evm") {
        console.log("🔵 Initializing EVM TransactionManager...");
        // EVM TransactionManager will be initialized when MetaMask connects
        // For now, we'll initialize it when switching to EVM even without connection
        const newTxManager = await initializeTransactionManager(
          "evm",
          selectedNetwork
        );
        // For EVM, balances will be loaded when wallet connects
      }
    };

    initTxManager().catch((error) => {
      console.error("Failed to initialize TransactionManager:", error);
    });
  }, [networkType, selectedNetwork]);

  // Separate useEffect for Solana wallet connection - loads data after wallet is connected
  useEffect(() => {
    const initSolanaWallet = async () => {
      console.log("🔄 Solana wallet useEffect triggered:", {
        networkType,
        solanaConnected,
        solanaPublicKey: !!solanaPublicKey,
        connection: !!connection,
        selectedNetwork,
      });

      if (
        networkType === "solana" &&
        solanaConnected &&
        solanaPublicKey &&
        connection
      ) {
        console.log(
          "✅ All Solana conditions met, initializing TransactionManager..."
        );
        const newTxManager = await initializeTransactionManager(
          "solana",
          selectedNetwork
        );

        // Load balances and check proxy status after TransactionManager is initialized
        if (newTxManager) {
          console.log(
            "🔄 Solana TransactionManager initialized, loading data..."
          );

          // Set the TransactionManager state BEFORE loading data
          setTransactionManager(newTxManager);
          console.log("✅ TransactionManager state updated");

          // Balance loading now handled by BalanceDisplay component
          // Check proxy status for Solana
          const userAddress = await newTxManager.getAddress();
          if (userAddress) {
            await checkSolanaProxyStatus(newTxManager, userAddress);
          } else {
            console.warn(
              "❌ Cannot check Solana proxy status: wallet not connected or address unavailable"
            );
          }

          // Load spending limits for Solana (pass txManager directly to avoid state timing issues)
          console.log("📋 Loading Solana spending limits...");
          await fetchSpendingLimitsWithTxManager(newTxManager);
          console.log("✅ Solana spending limits loading completed");

          // Load pending proposals for Solana
          console.log("📋 Loading Solana pending proposals...");
          await fetchPendingLimitProposals();
          console.log("✅ Solana pending proposals loading completed");

          // Load bypass requests for Solana (withdrawal data handled by components)
          console.log("📋 Loading Solana bypass requests...");
          await fetchPendingBypassRequests();
          console.log("✅ Solana bypass requests loading completed");
        }
      } else if (networkType === "solana") {
        console.log("❌ Solana wallet not ready yet:", {
          solanaConnected,
          solanaPublicKey: !!solanaPublicKey,
          connection: !!connection,
        });
      }
    };

    // Only run this effect for Solana network
    if (networkType === "solana") {
      initSolanaWallet().catch((error) => {
        console.error("Failed to initialize Solana wallet:", error);
      });
    }
  }, [
    networkType,
    selectedNetwork,
    solanaConnected,
    solanaPublicKey,
    connection,
  ]);

  // Additional useEffect to handle page reload initialization with retry logic
  useEffect(() => {
    let retryTimeout;

    const retryInitialization = async () => {
      console.log(
        "🔄 Retry initialization triggered for Solana on page reload"
      );

      // Check if we should initialize Solana but haven't loaded data yet
      if (
        networkType === "solana" &&
        solanaConnected &&
        solanaPublicKey &&
        connection &&
        !limitsLoaded &&
        !transactionManager
      ) {
        console.log(
          "🔄 Retrying Solana initialization (data not loaded on page reload)"
        );

        try {
          const newTxManager = await initializeTransactionManager(
            "solana",
            selectedNetwork
          );
          if (newTxManager) {
            console.log(
              "🔄 Retry: Solana TransactionManager initialized, loading data..."
            );
            setTransactionManager(newTxManager);

            // Balance loading now handled by BalanceDisplay component
            const userAddress = await newTxManager.getAddress();
            if (userAddress) {
              await checkSolanaProxyStatus(newTxManager, userAddress);
            } else {
              console.warn(
                "❌ Retry: Cannot check Solana proxy status: wallet not connected or address unavailable"
              );
            }

            console.log("📋 Retry: Loading Solana spending limits...");
            await fetchSpendingLimitsWithTxManager(newTxManager);
            console.log("✅ Retry: Solana spending limits loading completed");

            await fetchPendingLimitProposals();

            // Load withdrawal data in retry initialization
            console.log("📋 Retry: Loading Solana withdrawal data...");
            await fetchWithdrawalAddresses();
            await fetchPendingWithdrawalRequests(null, null, newTxManager);
            await fetchPendingBypassRequests();
            console.log("✅ Retry: Solana initialization retry successful");
          }
        } catch (error) {
          console.error("❌ Retry initialization failed:", error);
        }
      }
    };

    // Set up retry after a short delay to allow all state to settle
    if (networkType === "solana" && solanaConnected && !limitsLoaded) {
      retryTimeout = setTimeout(retryInitialization, 1000);
    }

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [
    networkType,
    selectedNetwork, // Add selectedNetwork to trigger on network switch
    solanaConnected,
    solanaPublicKey,
    connection,
    limitsLoaded,
    transactionManager,
  ]);

  // Aggressive balance loading - load immediately when any Solana condition becomes available
  useEffect(() => {
    const loadBalancesImmediately = async () => {
      // Try to load balances as soon as we have a Solana wallet, even if not fully "connected"
      if (
        networkType === "solana" &&
        solanaWallet &&
        Object.keys(balances).length === 0
      ) {
        console.log(
          "🚀 Immediate: Attempting to load balances with available wallet..."
        );

        try {
          // Try with current connection first
          if (connection) {
            const newTxManager = await initializeTransactionManager(
              "solana",
              selectedNetwork
            );
            if (newTxManager) {
              setTransactionManager(newTxManager);
              // Balance loading now handled by BalanceDisplay component
              return; // Success, exit early
            }
          }

          // Fallback: try to get balances directly from wallet/connection without waiting
          if (solanaPublicKey && connection) {
            console.log(
              "🚀 Immediate: Loading balances directly from connection..."
            );

            // Quick SOL balance check
            try {
              const solBalance = await connection.getBalance(solanaPublicKey);
              const quickBalances = {
                SOL: solBalance / 1000000000, // Convert lamports to SOL
              };
              setBalances(quickBalances);
              console.log(
                "✅ Immediate: Quick balances loaded:",
                quickBalances
              );
            } catch (error) {
              console.log(
                "⚠️ Quick balance loading failed, will retry with full setup"
              );
            }
          }
        } catch (error) {
          console.log("⚠️ Immediate balance loading failed:", error.message);
        }
      }
    };

    loadBalancesImmediately();
  }, [networkType, solanaWallet, solanaPublicKey, connection, balances]);

  // Set default balances immediately when switching to Solana to avoid empty state
  useEffect(() => {
    if (networkType === "solana" && Object.keys(balances).length === 0) {
      console.log("🚀 Setting default SOL balance to eliminate loading state");
      setBalances({ SOL: 0 });
    }
  }, [networkType, balances]);

  // Note: Step validation moved to individual components

  // Auto-advance steps when setup is not committed and during guided flow
  useEffect(() => {
    if (!isSetupCommitted) {
      // Allow independent access to Step 2, but Step 3 still requires Step 1 completion for lock-in
      if (currentStep === 3 && !stepValidation.step1Complete) {
        setCurrentStep(1);
      }
    } else {
      // Once setup is committed, we're in usage mode - reset to show final state
      setCurrentStep(3);
    }
  }, [currentStep, stepValidation, isSetupCommitted]);

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

      // Check if proxy is already deployed
      console.log("🔍 Calling contract.isProxyDeployed...");
      const proxyDeployed = await contract.isProxyDeployed(userAddress);
      console.log(`🔍 isProxyDeployed result: ${proxyDeployed}`);

      // Get the calculated deposit address (whether deployed or not)
      console.log("🔍 Calling contract.getUserDepositAddress...");
      const depositAddress = await contract.getUserDepositAddress(userAddress);
      console.log(`🔍 getUserDepositAddress result: ${depositAddress}`);

      console.log(`✅ Proxy status for ${userAddress}:`);
      console.log(`- Deployed: ${proxyDeployed}`);
      console.log(`- Deposit Address: ${depositAddress}`);

      // Update UI state
      setIsProxyDeployed(proxyDeployed);
      setProxyAddress(depositAddress);

      console.log(
        `✅ State updated: isProxyDeployed=${proxyDeployed}, proxyAddress=${depositAddress}`
      );
    } catch (error) {
      console.error("❌ Error checking proxy status:", error);

      // If there's an error checking proxy status, try a fallback approach
      // The error might be because the function doesn't exist or the proxy is in an unexpected state
      try {
        const userAddress = userAddr || (await signerParam.getAddress());
        const depositAddress = await contract.getUserDepositAddress(
          userAddress
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
        console.error("Fallback proxy check also failed:", fallbackError);
        setIsProxyDeployed(false);
        setProxyAddress("");
      }
    }
  };

  const checkProxyStatus = async (
    contract = savingsContract,
    userAddr = null
  ) => {
    console.log("🔍 checkProxyStatus called with:", {
      contract: !!contract,
      signer: !!signer,
      userAddr,
    });

    if (!contract) {
      console.log("❌ No contract provided to checkProxyStatus");
      return;
    }
    if (!signer) {
      console.log("❌ No signer available for checkProxyStatus");
      return;
    }

    // Delegate to the version that takes explicit signer parameter
    await checkProxyStatusWithSigner(contract, signer, userAddr);
  };

  const checkSolanaProxyStatus = async (txManager, userAddress) => {
    console.log("🔍 checkSolanaProxyStatus called with:", {
      txManager: !!txManager,
      userAddress,
    });

    if (!txManager) {
      console.log(
        "❌ No transaction manager provided to checkSolanaProxyStatus"
      );
      return;
    }

    try {
      console.log(`🔍 Checking Solana proxy status for user: ${userAddress}`);

      // Check if proxy is already deployed
      console.log("🔍 Calling txManager.isProxyDeployed...");
      const proxyDeployed = await txManager.isProxyDeployed(userAddress);
      console.log(`🔍 isProxyDeployed result: ${proxyDeployed}`);

      // Get the calculated deposit address (whether deployed or not)
      console.log("🔍 Calling txManager.getDepositAddress...");
      const depositAddress = await txManager.getDepositAddress(userAddress);
      console.log(`🔍 getDepositAddress result: ${depositAddress}`);

      console.log(`✅ Solana proxy status for ${userAddress}:`);
      console.log(`- Deployed: ${proxyDeployed}`);
      console.log(`- Deposit Address: ${depositAddress}`);

      // Update UI state
      setIsProxyDeployed(proxyDeployed);
      setProxyAddress(depositAddress);

      console.log(
        `✅ Solana state updated: isProxyDeployed=${proxyDeployed}, proxyAddress=${depositAddress}`
      );
    } catch (error) {
      console.error("❌ Error checking Solana proxy status:", error);
      // Set default values on error
      setIsProxyDeployed(false);
      setProxyAddress("");
    }
  };


  const autoConnectWallet = async () => {
    if (window.ethereum) {
      try {
        // Check if already connected
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        if (accounts.length > 0) {
          // Already connected, proceed without requesting permission
          await connectWalletInternal();
        }
      } catch (error) {
        console.log(
          "Auto-connect failed (expected on first visit):",
          error.message
        );
      }
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        // Request account access
        await window.ethereum.request({ method: "eth_requestAccounts" });
        await connectWalletInternal();
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        alert("Failed to connect wallet. Please try again.");
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const connectWalletInternal = async () => {
    const web3Provider = new ethers.BrowserProvider(window.ethereum);
    const web3Signer = await web3Provider.getSigner();

    // Get current network and use its contract address
    const currentNetwork = getCurrentNetwork(networkType, selectedNetwork);
    const contractAddress = currentNetwork.savingsContract;

    if (contractAddress === "0x0000000000000000000000000000000000000000") {
      console.log(
        `Savings contract not deployed on ${currentNetwork.name} yet.`
      );
      return;
    }

    const savings = new ethers.Contract(
      contractAddress,
      SavingsABI,
      web3Signer
    );

    // Set up approval module contract
    const moduleAddresses = await import("./moduleAddresses.json");
    const approvalModuleAddress = moduleAddresses.modules.approvalSystem;
    const approval = new ethers.Contract(
      approvalModuleAddress,
      ApprovalSystemModuleABI,
      web3Signer
    );

    setProvider(web3Provider);
    setSigner(web3Signer);
    setSavingsContract(savings);
    setApprovalModule(approval);

    // Store user address
    const address = await web3Signer.getAddress();
    setUserAddress(address);

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
      await fetchPendingBypassRequests(savings, userAddress);
      await fetchPendingLimitProposals(userAddress);
      // Note: Withdrawal data now handled by components

      // Check setup status
      const setupCommitted = await savings.isSetupCommitted();
      setIsSetupCommitted(setupCommitted);

      if (setupCommitted) {
        const info = await savings.getSetupInfo();
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
      console.error("Error fetching initial data:", error);
      // Still set empty balances to show the balance section
      setBalances({});
    }
  };


  // Unified spending limits functions - functions moved to SpendingLimitsSetup component





  const fetchPendingLimitProposals = async (
    userAddr = null,
    txManager = transactionManager
  ) => {
    const currentUserAddress = getCurrentUserAddress();

    try {
      const proposals = await fetchPendingLimitProposalsService({
        transactionManager: txManager,
        savingsContract,
        networkType,
        userAddress: currentUserAddress,
        getCurrentUserAddress
      });

      setPendingLimitProposals(proposals);
      console.log(`✅ Loaded ${proposals.length} pending proposals`);
    } catch (error) {
      console.error("Error fetching pending proposals:", error);
      setPendingLimitProposals([]);
    }
  };



  const addApprover = async () => {
    if (savingsContract) {
      const tx = await savingsContract.addApprovalAddress(approver);
      await tx.wait();
      alert("Approver added successfully!");
    }
  };

  const withdrawFunds = async () => {
    // Network-aware connection check
    if (networkType === "solana" && (!transactionManager || !solanaConnected)) {
      alert("Please connect your Solana wallet first");
      return;
    }
    if (networkType === "evm" && !savingsContract) {
      alert("Please connect your MetaMask wallet first");
      return;
    }

    // Validate withdrawal amount
    if (
      !withdrawalAmount ||
      isNaN(withdrawalAmount) ||
      parseFloat(withdrawalAmount) <= 0
    ) {
      alert("Please enter a valid withdrawal amount");
      return;
    }

    try {
      if (networkType === "solana") {
        // Solana withdrawal logic
        console.log("💸 Solana: Withdrawing", withdrawalAmount, selectedToken);

        const adapter = transactionManager.getCurrentAdapter();
        const amountValue = parseFloat(withdrawalAmount);

        let txHash;
        if (selectedToken === "SOL") {
          // Withdraw SOL (native token)
          const amountLamports = Math.floor(amountValue * Math.pow(10, 9)); // Convert to lamports
          txHash = await adapter.withdrawSol(amountLamports);
          console.log("Solana SOL withdrawal:", txHash);
        } else {
          // Withdraw SPL token (e.g., USDT)
          // Convert to token's base units (USDT has 6 decimals)
          const amountTokenUnits = Math.floor(amountValue * Math.pow(10, 6));
          txHash = await adapter.withdrawSpl(amountTokenUnits);
          console.log("Solana SPL withdrawal:", txHash);
        }

        alert(
          `✅ Withdrawal of ${withdrawalAmount} ${selectedToken} successful!`
        );
      } else {
        // EVM withdrawal logic (existing)
        console.log("💸 EVM: Withdrawing", withdrawalAmount, selectedToken);

        // Check if user is on the correct network
        if (!isCorrectNetwork()) {
          const currentNetwork = getCurrentNetwork(
            networkType,
            selectedNetwork
          );
          alert(`Please switch to ${currentNetwork.name} to make withdrawals`);
          return;
        }

        const currentNetwork = getCurrentNetwork(networkType, selectedNetwork);
        const usdtToken = currentNetwork.tokens.USDT;
        const amount = ethers.parseUnits(withdrawalAmount, usdtToken.decimals);
        const tx = await savingsContract.withdraw(amount, usdtToken.address);
        await tx.wait();
        alert(`✅ Withdrawal of ${withdrawalAmount} USDT successful!`);
      }

      // Clear form and refresh balances and spending limits for both networks
      setWithdrawalAmount("");

      // For Solana, add a small delay to ensure account state is updated
      if (networkType === "solana") {
        console.log("⏳ Waiting for Solana account state to update...");
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      }

      // Balance and spending limits updates now handled by individual components
      await fetchSpendingLimits();
    } catch (error) {
      console.error("Withdrawal error:", error);
      if (error.message.includes("Exceeds")) {
        // Extract which limit was exceeded from error message
        alert(`Withdrawal blocked: ${error.message}`);
      } else if (error.message.includes("Insufficient balance")) {
        alert("Insufficient balance for this withdrawal");
      } else if (error.message.includes("Insufficient SOL balance")) {
        alert("Insufficient SOL balance for this withdrawal");
      } else {
        alert(`Failed to withdraw. Please try again. Error: ${error.message}`);
      }
    }
  };

  const commitSetup = async () => {
    // Check connection for both networks
    if (networkType === "solana" && (!transactionManager || !solanaConnected)) {
      alert("Please connect your Solana wallet first");
      return;
    }
    if (networkType === "evm" && !savingsContract) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      // Note: Spending limits should have been set earlier through SpendingLimitsSetup component
      // This commit step just locks the setup - limits are already saved

      // Commit setup (limits should have been set earlier)
      if (networkType === "solana") {
        console.log("Committing Solana setup...");
        const txHash = await transactionManager.commitSetup();
        console.log("Solana setup committed:", txHash);
        alert(
          "Setup locked in successfully! Your savings wallet is now active."
        );
      } else {
        // EVM setup commit
        console.log("Committing EVM setup...");
        const txHash = await transactionManager.commitSetup();
        console.log("EVM setup committed:", txHash);
        alert(
          "Setup locked in successfully! You are now in secured mode with timelock protection."
        );
      }

      // Note: Edit modes are now managed internally by SpendingLimitsSetup component

      // Refresh setup status
      if (networkType === "solana") {
        // For Solana, we'll get the setup status when we fetch spending limits
        setIsSetupCommitted(true);
      } else {
        const setupCommitted = await savingsContract.isSetupCommitted();
        setIsSetupCommitted(setupCommitted);

        if (setupCommitted) {
          const info = await savingsContract.getSetupInfo();
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
      }

      // Refresh spending limits to show the saved values
      await fetchSpendingLimits();
    } catch (error) {
      console.error("Error committing setup:", error);
      if (error.message.includes("Daily limit too high")) {
        alert("Daily limit is too high for the weekly limit");
      } else if (error.message.includes("Weekly limit too high")) {
        alert("Weekly limit is too high for the monthly limit");
      } else {
        alert(`Failed to lock in setup: ${error.message}`);
      }
    }
  };

  const recalculateTotalLockedValue = async () => {
    if (savingsContract) {
      try {
        const tx = await savingsContract.recalculateTotalLockedValue();
        await tx.wait();
        alert("✅ Total locked value recalculated successfully!");

        // Refresh setup status to show updated value
        const info = await savingsContract.getSetupInfo();
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
      } catch (error) {
        console.error("Error recalculating total locked value:", error);
        alert("Failed to recalculate total locked value. Please try again.");
      }
    }
  };

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

    if (networkType === "solana") {
      try {
        // Fetch spending limits using service
        const spendingData = await fetchSpendingLimitsService({
          transactionManager: txManager,
          networkType
        });

        setSpendingLimits(spendingData.limits);
        setIsSetupCommitted(spendingData.isSetupCommitted);
        setLimitsLoaded(true);

        // Also fetch bypass requests since txManager is working
        console.log("🔄 Fetching bypass requests after successful spending limits load...");
        try {
          const bypassRequests = await fetchPendingBypassRequestsService({
            transactionManager: txManager,
            networkType,
            userAddress: getCurrentUserAddress(),
            solanaPublicKey
          });

          setPendingBypassRequests(bypassRequests);
          console.log(`📋 Loaded ${bypassRequests.length} bypass requests`);
        } catch (error) {
          console.error("❌ Error fetching bypass requests after spending limits:", error);
        }

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
      console.log("🔵 Delegating Solana spending limits to dedicated function...");
      // Delegate to the dedicated Solana function to avoid duplication and race conditions
      await fetchSpendingLimitsWithTxManager(transactionManager);
      return;
    }

    try {
      const spendingData = await fetchSpendingLimitsService({
        transactionManager,
        savingsContract: contract,
        signer: userSigner,
        networkType
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







  const fetchPendingBypassRequests = async (
    contract = savingsContract,
    userAddr = null
  ) => {
    const currentUserAddress = userAddr || userAddress;

    try {
      const requests = await fetchPendingBypassRequestsService({
        transactionManager,
        savingsContract: contract || savingsContract,
        networkType,
        userAddress: currentUserAddress,
        solanaPublicKey
      });

      setPendingBypassRequests(requests);
      console.log(`✅ Loaded ${requests.length} bypass requests`);
    } catch (error) {
      console.error("Error fetching bypass requests:", error);
      setPendingBypassRequests([]);
    }
  };



  return (
    <div style={styles.app.container}>
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
        currentStep={currentStep}
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


          {/* Step 1: Spending Limits Setup / Management */}
          <SpendingLimitsSetup
            currentStep={currentStep}
            isSetupCommitted={isSetupCommitted}
            stepValidation={stepValidation}
            goToNextStep={goToNextStep}
            spendingLimits={spendingLimits}
            pendingLimitProposals={pendingLimitProposals}
            currentTime={currentTime}
            networkType={networkType}
            transactionManager={transactionManager}
            solanaConnected={solanaConnected}
            savingsContract={savingsContract}
            onDataRefresh={async () => {
              await fetchSpendingLimits();
              await fetchPendingLimitProposals();
            }}
          />

          {/* Step 2: Withdrawal Addresses Setup Component */}
          {!isSetupCommitted && (
            <WithdrawalAddressSetupStep
              // Step wizard state
              currentStep={currentStep}
              isSetupCommitted={isSetupCommitted}
              stepValidation={stepValidation}
              spendingLimits={spendingLimits}

              // Blockchain services (dependency injection)
              transactionManager={transactionManager}
              savingsContract={savingsContract}

              // Network context
              networkType={networkType}
              solanaConnected={solanaConnected}
              solanaPublicKey={solanaPublicKey}
              userAddress={userAddress}

              // Step navigation
              goToNextStep={goToNextStep}
            />
          )}
          {/* Step 3: Setup Commit Step Component */}
          {!isSetupCommitted && (
            <SetupCommitStep
              isSetupCommitted={isSetupCommitted}
              stepValidation={stepValidation}
              currentStep={currentStep}
              commitSetup={commitSetup}
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

              // Calculated values (computed in App.js)
              instantWithdrawableAmount={instantWithdrawableAmount}
              limitingPeriod={limitingPeriod}
              exceedsInstantLimit={exceedsInstantLimit}
              exceedingPeriod={exceedingPeriod}

              // Callbacks for App.js state updates
              onBalanceUpdate={refreshBalances}
              onSpendingLimitsUpdate={fetchSpendingLimits}
              onWithdrawalDataUpdate={(type, data) => {
                // Handle withdrawal data updates from component
                if (type === 'addresses') {
                  setWithdrawalAddresses(data);
                } else if (type === 'requests') {
                  setPendingWithdrawalRequests(data);
                } else if (type === 'bypasses') {
                  setPendingBypassRequests(data);
                }
              }}

              // Utilities
              currentTime={currentTime}
            />
          )}
          {/* Add Approver Section - Hidden for now (not implemented) */}
          {false && isSetupCommitted && (
            <div
              style={{
                marginTop: "20px",
                padding: "15px",
                backgroundColor: "#2d3748",
                color: "white",
              }}
            >
              <h3>Add Emergency Approver</h3>
              <input
                type="text"
                placeholder="Enter approver address..."
                value={approver}
                onChange={(e) => setApprover(e.target.value)}
              />
              <button onClick={addApprover}>Add Approver</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Wrapped App component with Solana wallet provider
function App() {
  return <AppContent />;
}

export default App;
