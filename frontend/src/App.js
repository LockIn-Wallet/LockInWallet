import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import SavingsABI from "./SavingsABI.json";
import MockUSDT_ABI from "./MockUSDT_ABI.json";
import ApprovalSystemModuleABI from "./ApprovalSystemModuleABI.json";

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
  detectExceedingPeriod,
} from "./utils/walletUtils.js";

// Import contract verification utilities
import {
  verifyEVMContractDeployment,
  createDeploymentErrorMessage,
} from "./utils/contractVerification.js";

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
          // Note: Bypass requests now cleared by WithdrawalInterface component
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
  // Note: This is a placeholder function for components that still expect refreshBalances
  // Actual balance refreshing is handled by BalanceDisplay component internally
  const refreshBalances = () => {
    console.log(
      "⚠️ refreshBalances called - balance refreshing is now handled by BalanceDisplay component"
    );
  };

  // TransactionManager initialization now handled by useNetworkManager hook

  // Note: Solana data loading now handled by individual components
  // (SpendingLimitsSetup, WithdrawalInterface, BalanceDisplay, etc.)

  // Note: TransactionManager initialization now handled by useNetworkManager hook
  // Data loading is handled by individual components (BalanceDisplay, WithdrawalInterface, etc.)

  // Note: Balance loading now handled by BalanceDisplay component

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

      // Update UI state
      setIsProxyDeployed(proxyDeployed);
      setProxyAddress(depositAddress);

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
        // Auto-connect failures are expected on first visit - use info level
        console.log(
          "Auto-connect failed (expected on first visit):",
          error.message
        );
      }
    }
  }, 2000); // 2 second debounce to prevent rapid reconnection

  const connectWallet = debounce(async () => {
    if (window.ethereum) {
      try {
        // Request account access
        await window.ethereum.request({ method: "eth_requestAccounts" });
        await connectWalletInternal();
      } catch (error) {
        const walletErrorHandler = createErrorHandler("wallet_connection");
        const formattedError = walletErrorHandler(error);
        alert(formattedError.userMessage + getDevErrorDetails(formattedError));
      }
    } else {
      alert("Please install MetaMask!");
    }
  }, 1000); // 1 second debounce for manual connections

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

    // Verify contract is actually deployed before making any calls
    const isContractDeployed = await verifyEVMContractDeployment(
      web3Provider,
      contractAddress
    );
    if (!isContractDeployed) {
      const deploymentError = getNetworkErrorMessage(
        "CONTRACT_NOT_DEPLOYED",
        networkType
      );
      console.error(
        "Contract deployment verification failed:",
        deploymentError
      );
      alert(
        `⚠️ Contract Not Deployed\n\n${deploymentError}\n\nCurrent contract address: ${contractAddress}`
      );
      return;
    }

    const savings = new ethers.Contract(
      contractAddress,
      SavingsABI,
      web3Signer
    );

    // Set up approval module contract
    let approval = null;
    try {
      const moduleAddresses = await import("./moduleAddresses.json");
      const approvalModuleAddress = moduleAddresses.modules?.approvalSystem;

      if (
        approvalModuleAddress &&
        approvalModuleAddress !== "0x0000000000000000000000000000000000000000"
      ) {
        approval = new ethers.Contract(
          approvalModuleAddress,
          ApprovalSystemModuleABI,
          web3Signer
        );
      } else {
        console.log("Approval module not deployed on this network yet");
      }
    } catch (error) {
      console.warn("Could not load module addresses:", error);
    }

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
            currentTime={currentTime}
            networkType={networkType}
            transactionManager={transactionManager}
            solanaConnected={solanaConnected}
            savingsContract={savingsContract}
            getCurrentUserAddress={getCurrentUserAddress}
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
              // Blockchain services (dependency injection)
              transactionManager={transactionManager}
              savingsContract={savingsContract}
              networkType={networkType}
              solanaConnected={solanaConnected}
              // Callbacks for parent state updates
              onSetupCommitted={setIsSetupCommitted}
              onSetupInfoUpdate={setSetupInfo}
              onSpendingLimitsRefresh={fetchSpendingLimits}
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
              // Note: All withdrawal data (addresses, requests, bypasses) now managed by WithdrawalInterface component internally

              // Utilities
              currentTime={currentTime}
            />
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
