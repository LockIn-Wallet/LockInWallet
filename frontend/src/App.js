import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import SavingsABI from "./SavingsABI.json";
import MockUSDT_ABI from "./MockUSDT_ABI.json";
import ApprovalSystemModuleABI from "./ApprovalSystemModuleABI.json";

// Import our new blockchain adapters
import { TransactionManager } from "./adapters/TransactionManager.js";

// Solana imports
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import {
  WalletModalProvider,
  WalletMultiButton,
  WalletDisconnectButton,
} from "@solana/wallet-adapter-react-ui";

// Import Solana wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css";

const ETH_ADDRESS = "0x0000000000000000000000000000000000000000"; // ETH address (native token)
const SOL_ADDRESS = "So11111111111111111111111111111111111111112"; // SOL address (native token)

// Network configuration - now supports both EVM and Solana
const NETWORKS = {
  // EVM Networks
  evm: {
    localhost: {
      chainId: 31337,
      name: "Localhost",
      nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
      },
      rpcUrls: ["http://127.0.0.1:8545"],
      blockExplorerUrls: [""],
      savingsContract: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      tokens: {
        USDT: {
          address: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
          symbol: "USDT",
          name: "Tether USD",
          decimals: 6,
          recommended: true,
        },
        USDC: {
          address: "0x0000000000000000000000000000000000000000", // Placeholder
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          recommended: true,
        },
        DAI: {
          address: "0x0000000000000000000000000000000000000000", // Placeholder
          symbol: "DAI",
          name: "Dai Stablecoin",
          decimals: 18,
          recommended: true,
        },
      },
    },
    ethereum: {
      chainId: 1,
      name: "Ethereum Mainnet",
      nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
      },
      rpcUrls: ["https://eth-mainnet.g.alchemy.com/v2/demo"],
      blockExplorerUrls: ["https://etherscan.io"],
      savingsContract: "0x0000000000000000000000000000000000000000", // TODO: Deploy contract
      tokens: {
        USDT: {
          address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          symbol: "USDT",
          name: "Tether USD",
          decimals: 6,
          recommended: true,
        },
        USDC: {
          address: "0xA0b86a33E6B6c3c3A3B8DBbc81b2B4C98B25C96f",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          recommended: true,
        },
        DAI: {
          address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          symbol: "DAI",
          name: "Dai Stablecoin",
          decimals: 18,
          recommended: true,
        },
      },
    },
    optimism: {
      chainId: 10,
      name: "Optimism",
      nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
      },
      rpcUrls: ["https://opt-mainnet.g.alchemy.com/v2/demo"],
      blockExplorerUrls: ["https://optimistic.etherscan.io"],
      savingsContract: "0x0000000000000000000000000000000000000000", // TODO: Deploy contract
      tokens: {
        USDT: {
          address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
          symbol: "USDT",
          name: "Tether USD",
          decimals: 6,
          recommended: true,
        },
        USDC: {
          address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          recommended: true,
        },
        DAI: {
          address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
          symbol: "DAI",
          name: "Dai Stablecoin",
          decimals: 18,
          recommended: true,
        },
      },
    },
  },
  // Solana Networks
  solana: {
    localhost: {
      network: WalletAdapterNetwork.Devnet, // Use devnet for local testing
      name: "Solana Localhost",
      rpcUrl: "http://127.0.0.1:8899",
      programId: "HNi2JKTNeHvz2ENckdVBW1ncfkJUYppuYeBwNhWjkK7d", // From our Anchor.toml
      tokens: {
        SOL: {
          address: "native", // Use "native" for SOL deposits
          mint: SOL_ADDRESS,
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
          recommended: true,
        },
        USDT: {
          mint: "CyGLZzacTQBHJ77qaSuDrVekhJEkuiGM66ToWJkWxR8v", // Test USDT mint address
          symbol: "USDT",
          name: "Test USDT",
          decimals: 6,
          recommended: true,
        },
      },
    },
    devnet: {
      network: WalletAdapterNetwork.Devnet,
      name: "Solana Devnet",
      rpcUrl: clusterApiUrl(WalletAdapterNetwork.Devnet),
      programId: "HNi2JKTNeHvz2ENckdVBW1ncfkJUYppuYeBwNhWjkK7d",
      tokens: {
        SOL: {
          mint: SOL_ADDRESS,
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
          recommended: true,
        },
        USDC: {
          mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // USDC on Devnet
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          recommended: true,
        },
      },
    },
    mainnet: {
      network: WalletAdapterNetwork.Mainnet,
      name: "Solana Mainnet",
      rpcUrl: clusterApiUrl(WalletAdapterNetwork.Mainnet),
      programId: "HNi2JKTNeHvz2ENckdVBW1ncfkJUYppuYeBwNhWjkK7d", // TODO: Deploy to mainnet
      tokens: {
        SOL: {
          mint: SOL_ADDRESS,
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
          recommended: true,
        },
        USDC: {
          mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          recommended: true,
        },
      },
    },
  },
};

// Helper functions for network management
const getNetworkByChainId = (chainId) => {
  return Object.values(NETWORKS.evm).find(
    (network) => network.chainId === chainId
  );
};

const getCurrentNetwork = (networkType, selectedNetwork) => {
  if (networkType === "solana") {
    return NETWORKS.solana[selectedNetwork] || NETWORKS.solana.localhost;
  }
  return NETWORKS.evm[selectedNetwork] || NETWORKS.evm.localhost;
};

const isSolanaNetwork = (networkType) => {
  return networkType === "solana";
};

// Helper function to format countdown timer
const formatCountdown = (executeAfter, currentTime) => {
  const remainingSeconds = executeAfter - currentTime;

  if (remainingSeconds <= 0) {
    return { text: "Ready to execute!", ready: true, color: "#48bb78" };
  }

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  if (hours > 0) {
    return {
      text: `${hours}h ${minutes}m ${seconds}s remaining`,
      ready: false,
      color: "#fbb6ce",
    };
  } else if (minutes > 0) {
    return {
      text: `${minutes}m ${seconds}s remaining`,
      ready: false,
      color: "#ed8936",
    };
  } else {
    return {
      text: `${seconds}s remaining`,
      ready: false,
      color: "#e53e3e",
    };
  }
};

// Helper function to calculate instantly withdrawable amount
const calculateInstantWithdrawableAmount = (spendingLimits) => {
  if (!spendingLimits || spendingLimits.length === 0) {
    return { amount: 0, limitingPeriod: null };
  }

  let smallestRemaining = Infinity;
  let limitingPeriod = null;

  for (const limit of spendingLimits) {
    if (
      limit.active &&
      typeof limit.remaining === "number" &&
      limit.remaining < smallestRemaining
    ) {
      smallestRemaining = limit.remaining;
      limitingPeriod = limit.name;
    }
  }

  return {
    amount: smallestRemaining === Infinity ? 0 : Number(smallestRemaining) || 0,
    limitingPeriod,
  };
};

// Helper function to detect which period limit would be exceeded
const detectExceedingPeriod = (amount, spendingLimits) => {
  if (!spendingLimits || spendingLimits.length === 0 || !amount) {
    return null;
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return null;
  }

  // Find the first period that would be exceeded, prioritizing shorter periods
  const periodPriority = { Daily: 1, Weekly: 2, Monthly: 3 };

  const exceedingPeriods = spendingLimits
    .filter((limit) => limit.active && numericAmount > limit.remaining)
    .sort((a, b) => {
      const aPriority = periodPriority[a.name] || 999;
      const bPriority = periodPriority[b.name] || 999;
      return aPriority - bPriority;
    });

  return exceedingPeriods.length > 0 ? exceedingPeriods[0].name : null;
};

// For backward compatibility
const USDT_ADDRESS = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788"; // Updated: 0x610178dA211FEF7D417bC0e6FeD39F05609AD788

// Solana Wallet Provider Component
function SolanaWalletProvider({ children, networkType, selectedNetwork }) {
  const network =
    networkType === "solana"
      ? NETWORKS.solana[selectedNetwork]?.network || WalletAdapterNetwork.Devnet
      : WalletAdapterNetwork.Devnet;
  const endpoint =
    networkType === "solana"
      ? NETWORKS.solana[selectedNetwork]?.rpcUrl || "http://127.0.0.1:8899"
      : "http://127.0.0.1:8899";

  const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// Main App Component
function AppContent() {
  // EVM state
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [savingsContract, setSavingsContract] = useState(null);
  const [balances, setBalances] = useState({}); // Multi-token balances
  const [approver, setApprover] = useState("");

  // Solana wallet hooks (only used when networkType is 'solana')
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

  // Network state management - try to restore from localStorage or detect Solana connection
  const [networkType, setNetworkType] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem("preferredNetworkType");
    if (saved === "solana" || saved === "evm") {
      return saved;
    }

    // Default to Solana if we detect a Solana wallet connection
    // Note: solanaConnected might not be available yet during initialization
    return localStorage.getItem("walletName") ? "solana" : "evm";
  }); // "evm" or "solana"
  const [selectedNetwork, setSelectedNetwork] = useState("localhost"); // Current selected network
  const [currentChainId, setCurrentChainId] = useState(null); // MetaMask's current chain ID
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);

  // Multi-blockchain transaction manager
  const [transactionManager, setTransactionManager] = useState(null);

  // Time-based spending limits state - unified interface
  const [spendingLimits, setSpendingLimits] = useState([]); // Array of all time periods
  const [pendingLimitProposals, setPendingLimitProposals] = useState([]); // Pending limit change proposals
  const [limitsLoaded, setLimitsLoaded] = useState(false); // Track if limits have been fetched

  // Unified limit editing state
  const [limitEdits, setLimitEdits] = useState({
    Daily: { value: "", isActive: false, isEditing: false },
    Weekly: { value: "", isActive: false, isEditing: false },
    Monthly: { value: "", isActive: false, isEditing: false },
  });

  // Custom period state
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);
  const [customPeriodName, setCustomPeriodName] = useState("");
  const [customPeriodLimit, setCustomPeriodLimit] = useState("");
  const [customPeriodDuration, setCustomPeriodDuration] = useState("86400"); // Default 1 day

  // Card interaction state for hover and focus
  const [cardStates, setCardStates] = useState({
    Daily: { isHovered: false, isFocused: false },
    Weekly: { isHovered: false, isFocused: false },
    Monthly: { isHovered: false, isFocused: false },
  });
  const [depositAmount, setDepositAmount] = useState(""); // New state for deposit amount
  const [isDepositing, setIsDepositing] = useState(false); // Loading state for deposit button
  const [selectedToken, setSelectedToken] = useState("USDT"); // Default to USDT
  const [userAddress, setUserAddress] = useState(""); // Store user address

  // Proxy deployment state
  const [proxyAddress, setProxyAddress] = useState("");
  const [isProxyDeployed, setIsProxyDeployed] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  // Two-phase system state
  const [isSetupCommitted, setIsSetupCommitted] = useState(false);
  const [setupInfo, setSetupInfo] = useState(null);

  // Bypass system state
  const [pendingBypassRequests, setPendingBypassRequests] = useState([]);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // Withdrawal address management state
  const [withdrawalAddresses, setWithdrawalAddresses] = useState([]);
  const [pendingWithdrawalRequests, setPendingWithdrawalRequests] = useState(
    []
  );
  const [showWithdrawalAddressForm, setShowWithdrawalAddressForm] =
    useState(false);
  const [newWithdrawalTitle, setNewWithdrawalTitle] = useState("");
  const [newWithdrawalAddress, setNewWithdrawalAddress] = useState("");
  const [selectedWithdrawalDestination, setSelectedWithdrawalDestination] =
    useState("self");
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

  // Reusable WithdrawalAddressSelector component
  const WithdrawalAddressSelector = ({
    mode = "selection", // "selection" or "management"
    selectedDestination,
    onDestinationChange,
    showAddButton = true,
    title = "Withdraw To:",
  }) => {
    return (
      <div style={{ marginBottom: "15px" }}>
        <label
          style={{
            display: "block",
            fontSize: "0.9em",
            color: "#e2e8f0",
            marginBottom: "8px",
          }}
        >
          {title}
        </label>

        {/* My Wallet Option */}
        <div style={{ marginBottom: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              cursor: mode === "selection" ? "pointer" : "default",
              padding: "8px",
              borderRadius: "4px",
              backgroundColor:
                mode === "selection" && selectedDestination === "self"
                  ? "#2d3748"
                  : mode === "management"
                  ? "#1a365d"
                  : "transparent",
              border:
                mode === "management"
                  ? "1px solid #2b77ad"
                  : "1px solid #4a5568",
            }}
            onClick={() =>
              mode === "selection" &&
              onDestinationChange &&
              onDestinationChange("self")
            }
          >
            {mode === "selection" && (
              <input
                type="radio"
                name="withdrawalDestination"
                value="self"
                checked={selectedDestination === "self"}
                onChange={(e) =>
                  onDestinationChange && onDestinationChange(e.target.value)
                }
                style={{ marginRight: "8px", marginTop: "2px" }}
              />
            )}
            <span
              style={{
                color: mode === "management" ? "#9ae6b4" : "white",
                fontSize: "0.9em",
              }}
            >
              🏠 My Wallet (
              {getCurrentUserAddress()
                ? `${getCurrentUserAddress().slice(
                    0,
                    6
                  )}...${getCurrentUserAddress().slice(-4)}`
                : ""}
              )
            </span>
          </div>
        </div>

        {/* Withdrawal Addresses */}
        {withdrawalAddresses.map((addr, index) => (
          <div key={index} style={{ marginBottom: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                border: "1px solid #4a5568",
                borderRadius: "4px",
                backgroundColor:
                  mode === "selection" &&
                  selectedDestination === addr.destination
                    ? "#2d3748"
                    : "transparent",
                cursor: mode === "selection" ? "pointer" : "default",
              }}
              onClick={() =>
                mode === "selection" &&
                onDestinationChange &&
                onDestinationChange(addr.destination)
              }
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  padding: "8px",
                  flex: 1,
                }}
              >
                {mode === "selection" && (
                  <input
                    type="radio"
                    name="withdrawalDestination"
                    value={addr.destination}
                    checked={selectedDestination === addr.destination}
                    onChange={(e) =>
                      onDestinationChange && onDestinationChange(e.target.value)
                    }
                    style={{ marginRight: "8px", marginTop: "2px" }}
                  />
                )}
                <div>
                  <div style={{ color: "white", fontWeight: "bold" }}>
                    📍 {addr.title}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8em",
                      color: "#a0aec0",
                      fontFamily: "monospace",
                    }}
                  >
                    {addr.destination.length > 50
                      ? `${addr.destination.slice(
                          0,
                          25
                        )}...${addr.destination.slice(-15)}`
                      : addr.destination}
                  </div>
                  <div style={{ fontSize: "0.7em", color: "#718096" }}>
                    Added: {addr.addedDate}
                  </div>
                </div>
              </div>
              {mode === "management" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeWithdrawalAddress(addr.destination);
                  }}
                  style={{
                    marginRight: "8px",
                    marginTop: "8px",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "1px solid #e53e3e",
                    backgroundColor: "transparent",
                    color: "#e53e3e",
                    cursor: "pointer",
                    fontSize: "0.7em",
                  }}
                >
                  🗑️ Remove
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add Address Button for Management Mode */}
        {mode === "management" && showAddButton && (
          <div style={{ marginTop: "10px" }}>
            <button
              onClick={() =>
                setShowWithdrawalAddressForm(!showWithdrawalAddressForm)
              }
              style={{
                padding: "8px 16px",
                borderRadius: "4px",
                border: "1px solid #4a5568",
                backgroundColor: "#2d3748",
                backgroundImage: "none",
                color: "#a0aec0",
                cursor: "pointer",
                fontSize: "0.85em",
                fontWeight: "normal",
                opacity: 0.7,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.opacity = "1";
                e.target.style.color = "#e2e8f0";
                e.target.style.borderColor = "#718096";
              }}
              onMouseLeave={(e) => {
                e.target.style.opacity = "0.7";
                e.target.style.color = "#a0aec0";
                e.target.style.borderColor = "#4a5568";
              }}
            >
              ➕ Add Withdrawal Address
            </button>
          </div>
        )}
      </div>
    );
  };

  // Helper functions for step management
  const validateStep1 = () => {
    // Step 1 is complete if user has entered any spending limit values or custom period

    // Check if user entered numbers in any of the spending limit cards
    const hasLimitInput = Object.values(limitEdits).some(
      (edit) => edit.value && parseFloat(edit.value) > 0
    );

    // Check if user is creating/has created a custom period
    const hasCustomPeriodInput =
      customPeriodName.trim() ||
      (customPeriodLimit && parseFloat(customPeriodLimit) > 0);

    // Check if any existing limits are active (original logic)
    const hasActiveLimits = spendingLimits.some(
      (limit) => limit.isActive && parseFloat(limit.limit) > 0
    );

    return hasLimitInput || hasCustomPeriodInput || hasActiveLimits;
  };

  const validateStep2 = () => {
    // Step 2 is complete if user added at least one custom withdrawal address (not just "My Wallet")
    // My Wallet is automatically added, so we need more than just that
    const hasCustomAddresses = withdrawalAddresses.some(
      (addr) =>
        addr.title !== "My Wallet" &&
        addr.destination !== getCurrentUserAddress()
    );
    return hasCustomAddresses;
  };

  const validateStep3 = () => {
    // Step 3 is complete when setup is committed
    return isSetupCommitted;
  };

  const updateStepValidation = () => {
    setStepValidation({
      step1Complete: validateStep1(),
      step2Complete: validateStep2(),
      step3Complete: validateStep3(),
    });
  };

  const goToNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
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
  // Helper function to format time remaining (matches SolanaAdapter)
  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return "Ready to execute";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

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
    setPendingWithdrawalRequests([]); // Clear withdrawal requests

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
          await refreshBalances(newTxManager);
          // Check proxy status for Solana
          const userAddress = await newTxManager.getAddress();
          await checkSolanaProxyStatus(newTxManager, userAddress);
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
      // For Solana networks, just update the selected network
      setSelectedNetwork(networkKey);
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

  // Refresh balances when network changes (EVM only)
  useEffect(() => {
    if (networkType === "evm" && savingsContract && signer) {
      fetchAllBalances();
    }
  }, [selectedNetwork, savingsContract, signer, networkType]);

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

  // Unified balance refresh function for both EVM and Solana
  const refreshBalances = async (txManager = transactionManager) => {
    if (networkType === "evm") {
      await fetchAllBalances();
    } else if (networkType === "solana" && txManager) {
      try {
        console.log("🔄 Refreshing Solana balances...");
        const userAddress = await txManager.getAddress();
        const solanaBalances = await txManager.getAllBalances(userAddress);
        setBalances(solanaBalances);
        console.log("✅ Solana balances refreshed:", solanaBalances);
      } catch (error) {
        console.error("❌ Error refreshing Solana balances:", error);
      }
    }
  };

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

          await refreshBalances(newTxManager);
          // Check proxy status for Solana
          const userAddress = await newTxManager.getAddress();
          await checkSolanaProxyStatus(newTxManager, userAddress);

          // Load spending limits for Solana (pass txManager directly to avoid state timing issues)
          console.log("📋 Loading Solana spending limits...");
          await fetchSpendingLimitsWithTxManager(newTxManager);
          console.log("✅ Solana spending limits loading completed");

          // Load pending proposals for Solana
          console.log("📋 Loading Solana pending proposals...");
          await fetchPendingLimitProposals(null, newTxManager);
          console.log("✅ Solana pending proposals loading completed");

          // Load withdrawal addresses and pending requests for Solana
          console.log("📋 Loading Solana withdrawal data...");
          await fetchWithdrawalAddresses();
          await fetchPendingWithdrawalRequests(null, null, newTxManager);
          await fetchPendingBypassRequests();
          console.log("✅ Solana withdrawal data loading completed");
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

            await refreshBalances(newTxManager);
            const userAddress = await newTxManager.getAddress();
            await checkSolanaProxyStatus(newTxManager, userAddress);

            console.log("📋 Retry: Loading Solana spending limits...");
            await fetchSpendingLimitsWithTxManager(newTxManager);
            console.log("✅ Retry: Solana spending limits loading completed");

            await fetchPendingLimitProposals(null, newTxManager);

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
              await refreshBalances(newTxManager);
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

  // Update step validation when relevant data changes
  useEffect(() => {
    updateStepValidation();
  }, [spendingLimits, withdrawalAddresses, isSetupCommitted, limitEdits, customPeriodName, customPeriodLimit]);

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

  const fetchAllBalances = async (
    contract = savingsContract,
    userAddr = null
  ) => {
    if (contract && signer) {
      try {
        const userAddress = userAddr || (await signer.getAddress());
        const currentNetwork = getCurrentNetwork(selectedNetwork);
        const newBalances = {};

        // Skip ETH balance - only fetch stablecoins

        // Fetch stablecoin balances using current network's token addresses
        for (const [key, token] of Object.entries(currentNetwork.tokens)) {
          if (token.address !== "0x0000000000000000000000000000000000000000") {
            try {
              const tokenBalance = await contract.getTokenBalance(
                userAddress,
                token.address
              );
              newBalances[key] = ethers.formatUnits(
                tokenBalance,
                token.decimals
              );
            } catch (err) {
              console.log(
                `Token ${key} not available on ${currentNetwork.name}:`,
                err.message
              );
              newBalances[key] = "0";
            }
          } else {
            newBalances[key] = "0";
          }
        }

        setBalances(newBalances);
      } catch (error) {
        console.error("Error fetching balances:", error);
        setBalances({});
      }
    }
  };

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

  const deployProxy = async () => {
    if (networkType === "evm") {
      // EVM proxy deployment
      if (!savingsContract || !signer) {
        alert("Please connect your wallet first");
        return;
      }

      if (isProxyDeployed) {
        alert("Proxy already deployed!");
        return;
      }

      try {
        setIsDeploying(true);
        console.log("Deploying EVM user proxy...");

        // Call the deployUserProxy function
        const tx = await savingsContract.deployUserProxy();
        console.log("Transaction sent:", tx.hash);

        // Wait for transaction confirmation
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        // Refresh proxy status (only for EVM)
        if (networkType === "evm") {
          await checkProxyStatus();
        }

        alert(
          "🎉 Permanent deposit address generated successfully! This address is permanently tied to your wallet and you can use it for all future deposits from exchanges."
        );
      } catch (error) {
        console.error("Error deploying EVM proxy:", error);
        alert(`Failed to deploy proxy: ${error.message}`);
      } finally {
        setIsDeploying(false);
      }
    } else if (networkType === "solana") {
      // Solana proxy deployment
      if (!transactionManager || !solanaConnected) {
        alert("Please connect your Solana wallet first");
        return;
      }

      if (isProxyDeployed) {
        alert("Deposit proxy already deployed!");
        return;
      }

      try {
        setIsDeploying(true);
        console.log("Deploying Solana deposit proxy...");

        // Deploy proxy using transaction manager
        const result = await transactionManager.deployProxy();
        console.log("Solana proxy deployment result:", result);

        // Refresh proxy status
        const userAddress = await transactionManager.getAddress();
        await checkSolanaProxyStatus(transactionManager, userAddress);

        alert(
          "🎉 Permanent deposit address generated successfully! This address is permanently tied to your wallet and you can use it for all future deposits from exchanges."
        );
      } catch (error) {
        console.error("Error deploying Solana proxy:", error);

        // Handle specific error cases
        if (
          error.message.includes("already exists") ||
          error.message.includes("already deployed")
        ) {
          console.log(
            "Solana proxy was already deployed, refreshing status..."
          );
          const userAddress = await transactionManager.getAddress();
          await checkSolanaProxyStatus(transactionManager, userAddress);
          alert(
            "✅ Your permanent deposit address is ready! This address is permanently tied to your wallet and you can use it for all deposits from exchanges."
          );
        } else if (error.message.includes("user rejected")) {
          alert("Transaction cancelled by user");
        } else {
          alert(`Failed to deploy Solana proxy: ${error.message}`);
        }
      } finally {
        setIsDeploying(false);
      }
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
    const currentNetwork = getCurrentNetwork(selectedNetwork);
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
      await fetchAllBalances(savings, userAddress);
      console.log(`About to check proxy status...`);
      if (networkType === "evm") {
        await checkProxyStatusWithSigner(savings, web3Signer, userAddress);
        console.log(`Proxy status check completed`);
      }
      await fetchSpendingLimits(savings, web3Signer);
      await fetchPendingBypassRequests(savings, userAddress);
      await fetchPendingLimitProposals(userAddress);
      await fetchWithdrawalAddresses(savings, userAddress);
      await fetchPendingWithdrawalRequests(savings, userAddress);

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

  const deposit = async () => {
    // Validate basic requirements
    if (!selectedToken || !depositAmount) {
      alert("Please select a token and enter an amount");
      return;
    }

    // Set loading state
    setIsDepositing(true);

    try {
      // Get current network configuration
      const currentNetwork = getCurrentNetwork(networkType, selectedNetwork);

      // Check if we have a transaction manager
      if (!transactionManager) {
        alert(
          "Transaction manager not initialized. Please refresh the page and try again."
        );
        return;
      }

      // Check network connection
      if (!(await transactionManager.isCorrectNetwork())) {
        alert(`Please switch to ${currentNetwork.name} to make deposits`);
        return;
      }

      // Check wallet connection
      if (!(await transactionManager.isConnected())) {
        alert("Please connect your wallet first");
        return;
      }

      // Determine token details based on blockchain type and selection
      let tokenAddress;
      let decimals;
      let tokenSymbol;

      if (networkType === "evm") {
        // EVM token logic
        if (selectedToken === "ETH") {
          tokenAddress = ETH_ADDRESS;
          decimals = 18;
          tokenSymbol = "ETH";
        } else if (currentNetwork.tokens[selectedToken]) {
          const token = currentNetwork.tokens[selectedToken];
          if (token.address === "0x0000000000000000000000000000000000000000") {
            alert(`${token.symbol} is not available on ${currentNetwork.name}`);
            return;
          }
          tokenAddress = token.address;
          decimals = token.decimals;
          tokenSymbol = token.symbol;
        } else {
          alert("Please select a valid token");
          return;
        }
      } else if (networkType === "solana") {
        // Solana token logic
        if (selectedToken === "SOL") {
          tokenAddress = "native"; // Solana native token
          decimals = 9;
          tokenSymbol = "SOL";
        } else if (
          currentNetwork.tokens &&
          currentNetwork.tokens[selectedToken]
        ) {
          const token = currentNetwork.tokens[selectedToken];
          tokenAddress = token.mint || token.address; // Use mint for Solana, address for EVM
          decimals = token.decimals;
          tokenSymbol = token.symbol;
        } else {
          alert("Please select a valid token");
          return;
        }
      } else {
        alert("Unsupported network type");
        return;
      }

      // Validate amount
      const numAmount = parseFloat(depositAmount);
      if (isNaN(numAmount) || numAmount <= 0) {
        alert("Please enter a valid deposit amount");
        return;
      }

      console.log(`🚀 Starting ${networkType.toUpperCase()} deposit:`, {
        tokenSymbol,
        amount: depositAmount,
        tokenAddress,
        decimals,
      });

      // Execute deposit through TransactionManager
      const result = await transactionManager.deposit(
        tokenAddress,
        depositAmount,
        decimals
      );

      console.log(
        `✅ ${networkType.toUpperCase()} deposit successful:`,
        result
      );

      // Show success message
      const message = `Deposit of ${depositAmount} ${tokenSymbol} successful!${
        result.hash ? `\nTransaction: ${result.hash}` : ""
      }`;
      alert(message);

      // Clear form and refresh balances
      setDepositAmount("");

      // Refresh balances using unified method
      await refreshBalances();
    } catch (error) {
      console.error(`${networkType.toUpperCase()} deposit error:`, error);

      // Provide user-friendly error messages
      let errorMessage = "Failed to deposit. ";
      if (error.message.includes("User rejected")) {
        errorMessage += "Transaction was rejected.";
      } else if (error.message.includes("insufficient funds")) {
        errorMessage += "Insufficient funds.";
      } else if (error.message.includes("network")) {
        errorMessage += "Network error. Please check your connection.";
      } else if (error.message.includes("not connected")) {
        errorMessage += "Wallet not connected.";
      } else {
        errorMessage += "Please check the token selection and amount.";
      }

      alert(errorMessage);
    } finally {
      // Always reset loading state
      setIsDepositing(false);
    }
  };

  // Unified spending limits functions
  const updateLimitEdit = (periodName, value) => {
    setLimitEdits((prev) => ({
      ...prev,
      [periodName]: {
        ...prev[periodName],
        value: value,
        isActive: value && parseFloat(value) > 0,
      },
    }));
  };

  const toggleEditMode = (periodName) => {
    setLimitEdits((prev) => ({
      ...prev,
      [periodName]: {
        ...prev[periodName],
        isEditing: !prev[periodName].isEditing,
      },
    }));
  };

  const saveLimitChanges = async () => {
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
      // Extract limits from limitEdits - check for any valid input
      const daily = limitEdits.Daily.value
        ? parseFloat(limitEdits.Daily.value)
        : 0;
      const weekly = limitEdits.Weekly.value
        ? parseFloat(limitEdits.Weekly.value)
        : 0;
      const monthly = limitEdits.Monthly.value
        ? parseFloat(limitEdits.Monthly.value)
        : 0;

      // Check if user has entered any spending limit values
      if (daily === 0 && weekly === 0 && monthly === 0) {
        alert("Please set at least one spending limit");
        return;
      }

      // Validate limit ordering
      if (daily > 0 && weekly > 0 && daily * 7 > weekly) {
        alert("Daily limit × 7 cannot exceed weekly limit");
        return;
      }
      if (weekly > 0 && monthly > 0 && weekly * 4 > monthly) {
        alert("Weekly limit × 4 cannot exceed monthly limit");
        return;
      }
      if (daily > 0 && monthly > 0 && daily * 30 > monthly) {
        alert("Daily limit × 30 cannot exceed monthly limit");
        return;
      }

      // For setup mode only - bulk changes
      if (!isSetupCommitted) {
        if (networkType === "solana") {
          // Solana implementation
          const dailyLimit = daily > 0 ? daily : null;
          const weeklyLimit = weekly > 0 ? weekly : null;
          const monthlyLimit = monthly > 0 ? monthly : null;

          const txHash = await transactionManager.setCommonPeriodLimits(
            dailyLimit,
            weeklyLimit,
            monthlyLimit
          );
          console.log("Solana spending limits transaction:", txHash);
          alert("Spending limits set successfully!");
        } else {
          // EVM implementation (existing logic)
          const dailyLimitWei =
            daily > 0 ? ethers.parseUnits(daily.toString(), 6) : 0;
          const weeklyLimitWei =
            weekly > 0 ? ethers.parseUnits(weekly.toString(), 6) : 0;
          const monthlyLimitWei =
            monthly > 0 ? ethers.parseUnits(monthly.toString(), 6) : 0;

          const tx = await savingsContract.setCommonPeriodLimits(
            dailyLimitWei,
            weeklyLimitWei,
            monthlyLimitWei
          );
          await tx.wait();
          alert("Spending limits set successfully!");
        }

        // Reset edit modes
        setLimitEdits((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((key) => {
            updated[key] = { ...updated[key], isEditing: false };
          });
          return updated;
        });

        // Refresh spending limits
        await fetchSpendingLimits();
      } else {
        if (networkType === "solana") {
          alert(
            "After setup lock, you can still add individual limits or remove existing ones on Solana"
          );
        } else {
          alert(
            "After setup lock, use individual Edit buttons for each limit to submit separate proposals"
          );
        }
      }
    } catch (error) {
      console.error("Error saving limit changes:", error);
      if (error.message.includes("Daily limit too high")) {
        alert("Daily limit is too high for the weekly limit");
      } else if (error.message.includes("Weekly limit too high")) {
        alert("Weekly limit is too high for the monthly limit");
      } else {
        alert(`Failed to save limit changes: ${error.message}`);
      }
    }
  };

  const submitIndividualProposal = async (periodName) => {
    // Check connection for both networks
    if (networkType === "solana" && (!transactionManager || !solanaConnected)) {
      alert("Please connect your Solana wallet first");
      return;
    }
    if (networkType === "evm" && !savingsContract) {
      alert("Please connect your wallet first");
      return;
    }

    const edit = limitEdits[periodName];
    if (!edit?.value || parseFloat(edit.value) <= 0) {
      alert("Please enter a valid limit amount");
      return;
    }

    try {
      const newLimit = parseFloat(edit.value);

      if (networkType === "solana") {
        // For Solana: Create proposal using the new proposal system
        console.log("📝 Solana: Creating limit change proposal...");
        const adapter = transactionManager.getCurrentAdapter();
        await adapter.proposeLimitChange(periodName, newLimit);

        // Exit edit mode for this specific limit
        setLimitEdits((prev) => ({
          ...prev,
          [periodName]: {
            ...prev[periodName],
            isEditing: false,
          },
        }));

        // Refresh proposals
        await fetchPendingLimitProposals();

        alert(
          `✅ Proposal submitted for ${periodName} limit! It will be executable after the timelock period.`
        );
        return;
      }

      // EVM path (existing logic)
      const limitWei = ethers.parseUnits(newLimit.toString(), 6);
      const tx = await savingsContract.proposeLimitChange(periodName, limitWei);
      await tx.wait();

      console.log(`✅ EVM proposal submitted for ${periodName}: ${newLimit}`);

      alert(
        `✅ ${periodName} limit change proposal submitted! It will be executable after the timelock period.`
      );

      // Reset edit mode for this specific period
      setLimitEdits((prev) => ({
        ...prev,
        [periodName]: { ...prev[periodName], isEditing: false, value: "" },
      }));

      // Refresh data
      await fetchPendingLimitProposals();
      await fetchSpendingLimits();
    } catch (error) {
      console.error(`Error proposing ${periodName} limit:`, error);
      alert(`Failed to submit ${periodName} limit proposal: ${error.message}`);
    }
  };

  const removeLimitPeriod = async (periodName) => {
    // Network-aware connection check
    if (networkType === "solana" && (!transactionManager || !solanaConnected)) {
      alert("Please connect your Solana wallet first");
      return;
    }
    if (networkType === "evm" && !savingsContract) {
      alert("Please connect your MetaMask wallet first");
      return;
    }

    try {
      if (networkType === "solana") {
        // Solana removal logic
        console.log("🗑️ Solana: Removing limit for", periodName);

        if (isSetupCommitted) {
          // After setup is committed, removal requires a proposal
          // For now, we'll inform the user that this feature is coming soon
          alert(
            "🚧 Solana limit removal proposals are coming soon!\n\nFor now, you can:\n• Edit limits (proposals work)\n• Remove limits only before setup is committed\n\nRemoval proposals will be implemented in the next update."
          );
          return;
        } else {
          // Direct removal before setup is committed
          const adapter = transactionManager.getCurrentAdapter();
          const txHash = await adapter.removeTimePeriodLimit(periodName);
          console.log("Solana limit removed:", txHash);
          alert(`✅ ${periodName} limit removed successfully!`);
        }
      } else {
        // EVM removal logic (existing)
        console.log("🗑️ EVM: Removing limit for", periodName);

        if (isSetupCommitted) {
          const tx = await savingsContract.proposeLimitRemoval(periodName);
          await tx.wait();
          alert(
            `✅ Removal proposal submitted for ${periodName}! It will be executable after review.`
          );
          await fetchPendingLimitProposals();
        } else {
          const tx = await savingsContract.removeTimePeriodLimit(periodName);
          await tx.wait();
          alert(`✅ ${periodName} limit removed successfully!`);
        }
      }

      // Refresh data for both networks
      await fetchSpendingLimits();
    } catch (error) {
      console.error("Error removing limit:", error);
      alert(`Failed to remove ${periodName} limit: ${error.message}`);
    }
  };

  const fetchPendingLimitProposals = async (
    userAddr = null,
    txManager = transactionManager
  ) => {
    const currentUserAddress = getCurrentUserAddress();
    if (!currentUserAddress) {
      console.log(
        `No user address available for fetching pending proposals on ${networkType} network`
      );
      return;
    }

    if (networkType === "solana") {
      // For Solana: Fetch proposals from the on-chain program
      console.log("📋 Fetching Solana pending proposals from program...");
      if (!txManager) {
        console.log(
          "❌ Transaction manager not available, skipping proposal fetch"
        );
        setPendingLimitProposals([]);
        return;
      }

      try {
        const adapter = txManager.getCurrentAdapter();
        const proposals = await adapter.fetchPendingProposals(
          currentUserAddress
        );

        console.log(
          `✅ Found ${proposals.length} pending proposals for Solana`
        );
        setPendingLimitProposals(proposals);
      } catch (error) {
        console.error("❌ Error fetching Solana proposals:", error);
        setPendingLimitProposals([]);
      }
      return;
    }

    // EVM: For now, no proposals since we removed localStorage
    // TODO: Implement proper EVM on-chain proposal fetching
    console.log("📋 EVM proposals not yet implemented for on-chain fetching");
    setPendingLimitProposals([]);
  };

  const executeProposal = async (proposal) => {
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
      if (proposal.networkType === "solana") {
        // For Solana: Execute proposal through adapter
        console.log("🔄 Executing Solana proposal:", proposal);
        const adapter = transactionManager.getCurrentAdapter();
        await adapter.executeLimitProposal(proposal.proposalId);
        alert(
          `✅ Executed ${proposal.action} proposal for ${proposal.periodName}!`
        );
      } else {
        // EVM execution: Call contract method (placeholder for now)
        console.log("🔄 Executing EVM proposal:", proposal);
        alert(
          `✅ Executing ${proposal.action} proposal for ${proposal.periodName}...`
        );
        // TODO: Add actual EVM contract execution when implemented
      }

      // localStorage removed - proposals now fetched from chain

      // Refresh data
      await fetchPendingLimitProposals();
      await fetchSpendingLimits();

      alert(
        `✅ ${
          proposal.action === "change" ? "Limit update" : "Limit removal"
        } executed successfully!`
      );
    } catch (error) {
      console.error("Error executing proposal:", error);
      alert(`Failed to execute proposal: ${error.message}`);
    }
  };

  const cancelProposal = async (proposal) => {
    try {
      // For Solana: Use adapter to cancel proposal
      if (networkType === "solana" && transactionManager) {
        const adapter = transactionManager.getCurrentAdapter();
        await adapter.cancelLimitProposal(proposal.proposalId);
      } else if (networkType === "evm") {
        // EVM cancellation not implemented yet
        console.log("EVM proposal cancellation not implemented");
      }

      // Refresh proposals
      await fetchPendingLimitProposals();

      alert(`Proposal for ${proposal.periodName} cancelled successfully`);
    } catch (error) {
      console.error("Error cancelling proposal:", error);
      alert(`Failed to cancel proposal: ${error.message}`);
    }
  };

  const addCustomPeriod = async () => {
    if (savingsContract) {
      try {
        if (!customPeriodName || !customPeriodLimit || !customPeriodDuration) {
          alert("Please fill in all custom period fields");
          return;
        }

        const limitWei = ethers.parseUnits(customPeriodLimit, 6);
        const durationSeconds = parseInt(customPeriodDuration, 10);

        const tx = await savingsContract.addTimePeriodLimit(
          customPeriodName.trim(),
          limitWei,
          durationSeconds
        );
        await tx.wait();
        alert(`Custom period "${customPeriodName}" added successfully!`);

        // Clear custom form
        setCustomPeriodName("");
        setCustomPeriodLimit("");
        setCustomPeriodDuration("86400");
        setShowCustomPeriod(false);

        // Refresh spending limits
        await fetchSpendingLimits();
      } catch (error) {
        console.error("Error adding custom period:", error);
        alert("Failed to add custom period. Please try again.");
      }
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
          const currentNetwork = getCurrentNetwork(selectedNetwork);
          alert(`Please switch to ${currentNetwork.name} to make withdrawals`);
          return;
        }

        const currentNetwork = getCurrentNetwork(selectedNetwork);
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

      await refreshBalances();
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
      // Extract configured limits
      const daily = limitEdits.Daily.value
        ? parseFloat(limitEdits.Daily.value)
        : 0;
      const weekly = limitEdits.Weekly.value
        ? parseFloat(limitEdits.Weekly.value)
        : 0;
      const monthly = limitEdits.Monthly.value
        ? parseFloat(limitEdits.Monthly.value)
        : 0;

      // Validate limit ordering if any limits are set
      if (daily > 0 || weekly > 0 || monthly > 0) {
        if (daily > 0 && weekly > 0 && daily * 7 > weekly) {
          alert("Daily limit × 7 cannot exceed weekly limit");
          return;
        }
        if (weekly > 0 && monthly > 0 && weekly * 4 > monthly) {
          alert("Weekly limit × 4 cannot exceed monthly limit");
          return;
        }
        if (daily > 0 && monthly > 0 && daily * 30 > monthly) {
          alert("Daily limit × 30 cannot exceed monthly limit");
          return;
        }
      }

      // Prepare limits for the batched transaction
      const dailyLimit = daily > 0 ? daily : null;
      const weeklyLimit = weekly > 0 ? weekly : null;
      const monthlyLimit = monthly > 0 ? monthly : null;

      // Commit setup with limits in a single batched transaction
      if (networkType === "solana") {
        console.log(
          "Committing Solana setup with limits in batched transaction..."
        );
        const txHash = await transactionManager.commitSetupWithLimits(
          dailyLimit,
          weeklyLimit,
          monthlyLimit
        );
        console.log("Solana setup committed with batched transaction:", txHash);
        alert(
          "Setup locked in successfully! Your spending limits are now active."
        );
      } else {
        // EVM fallback (will handle limits + commit separately if needed)
        console.log("Committing EVM setup...");
        const txHash = await transactionManager.commitSetupWithLimits(
          dailyLimit,
          weeklyLimit,
          monthlyLimit
        );
        console.log("EVM setup committed:", txHash);
        alert(
          "Setup locked in successfully! You are now in secured mode with timelock protection."
        );
      }

      // Reset edit modes since we're now locked
      setLimitEdits({
        Daily: { value: "", isActive: false, isEditing: false },
        Weekly: { value: "", isActive: false, isEditing: false },
        Monthly: { value: "", isActive: false, isEditing: false },
      });

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

  // Helper function to update limitEdits state from fetched limits (DRY)
  const updateLimitEditsFromFetchedLimits = (fetchedLimits) => {
    const newLimitEdits = {
      Daily: { value: "", isActive: false, isEditing: false },
      Weekly: { value: "", isActive: false, isEditing: false },
      Monthly: { value: "", isActive: false, isEditing: false },
    };

    fetchedLimits.forEach((limit) => {
      if (["Daily", "Weekly", "Monthly"].includes(limit.name)) {
        newLimitEdits[limit.name] = {
          value: limit.limit,
          isActive: true,
          isEditing: false,
        };
      }
    });

    setLimitEdits(newLimitEdits);
    console.log("🎯 Limit editing state updated for", networkType);
  };

  const fetchSpendingLimitsWithTxManager = async (txManager) => {
    console.log(
      "🚀 fetchSpendingLimitsWithTxManager called for network:",
      networkType
    );
    console.log("🔗 txManager available:", !!txManager);
    console.log(
      "📋 getSpendingLimits method available:",
      !!txManager?.getSpendingLimits
    );

    if (networkType === "solana") {
      console.log(
        "🔵 Processing Solana spending limits with direct txManager..."
      );
      // Solana spending limits fetching
      try {
        if (!txManager?.getSpendingLimits) {
          console.log(
            "❌ Solana spending limits method not available in passed txManager"
          );
          console.log("txManager state:", {
            exists: !!txManager,
            methods: txManager ? Object.keys(txManager) : "none",
          });
          setSpendingLimits([]);
          setLimitsLoaded(true);
          return;
        }

        console.log("🔄 Calling txManager.getSpendingLimits()...");
        const spendingData = await txManager.getSpendingLimits();
        console.log("✅ Fetched Solana spending limits:", spendingData);
        console.log(
          "📊 Limits array length:",
          spendingData?.limits?.length || 0
        );

        // Convert Solana format to unified format (values are already in SOL)
        const fetchedLimits = spendingData.limits.map((limit) => ({
          name: limit.name,
          limit: limit.limit.toString(), // Already converted to SOL in SolanaAdapter
          spent: limit.spent.toString(),
          remaining: Math.max(0, limit.remaining),
          duration: limit.duration.toString(),
          active: limit.active,
          durationHours: Math.floor(Number(limit.duration) / 3600),
          durationDays: Math.floor(Number(limit.duration) / 86400),
        }));

        console.log("🔄 Converted limits for frontend:", fetchedLimits);
        console.log(
          "📊 Setup committed status:",
          spendingData.isSetupCommitted
        );
        console.log(
          "🚨 DEBUG: Contract shows setup committed but you expect it unlocked!"
        );
        console.log(
          "🔧 If this is wrong, you may need to reset the contract or check deployment"
        );

        setSpendingLimits(fetchedLimits);
        setLimitsLoaded(true);

        // Also fetch bypass requests since txManager is working
        console.log(
          "🔄 Fetching bypass requests after successful spending limits load..."
        );
        try {
          const adapter = txManager.getCurrentAdapter();
          let solanaUserAddress;
          if (adapter && adapter.wallet?.publicKey) {
            solanaUserAddress = adapter.wallet.publicKey.toString();
          } else {
            solanaUserAddress = solanaPublicKey?.toString();
          }

          console.log(
            `🔍 [Init Bypass Requests] Using Solana address: ${solanaUserAddress}`
          );

          if (
            solanaUserAddress &&
            !solanaUserAddress.startsWith("0x") &&
            solanaUserAddress.length === 44
          ) {
            const bypassRequests = await adapter.fetchPendingBypassRequests(
              solanaUserAddress
            );

            console.log(
              "🔍 DEBUG: Raw bypass requests from adapter:",
              bypassRequests
            );

            // Transform to match EVM format
            const formattedRequests = bypassRequests.map((req) => {
              // Format amount properly - convert from token base units to decimal
              let formattedAmount = req.amount;
              try {
                // The Solana program stores all amounts with 9 decimals (SOL standard)
                formattedAmount = (
                  Number(req.amount) / Math.pow(10, 9)
                ).toString();
                console.log(
                  `🔍 Amount conversion: ${req.amount} -> ${formattedAmount}`
                );
              } catch (error) {
                console.warn("Error formatting amount:", error);
              }

              return {
                requestId: req.requestId,
                title: `${req.bypassingPeriod} Bypass`,
                destination: req.destination,
                executeAfter: req.executeAfter,
                submittedDate: (() => {
                  try {
                    // Handle different timestamp formats
                    let timestamp = req.createdAt;
                    // If timestamp is too large, it might be in milliseconds already
                    if (timestamp > 10000000000) {
                      timestamp = timestamp / 1000;
                    }
                    const date = new Date(timestamp * 1000);
                    console.log(
                      `🔍 Date conversion: ${
                        req.createdAt
                      } -> ${date.toLocaleDateString()}`
                    );
                    return date.toLocaleDateString();
                  } catch (error) {
                    console.warn("Error formatting date:", error);
                    return "Unknown date";
                  }
                })(),
                amount: formattedAmount,
                tokenMint: req.tokenMint,
                bypassingPeriod: req.bypassingPeriod,
                canExecute: req.canExecute,
                status: req.status,
              };
            });

            setPendingBypassRequests(formattedRequests);
            console.log(
              `📋 Loaded ${formattedRequests.length} Solana bypass requests for ${solanaUserAddress}`
            );
          }
        } catch (error) {
          console.error(
            "❌ Error fetching bypass requests after spending limits:",
            error
          );
        }
        setIsSetupCommitted(spendingData.isSetupCommitted);

        console.log("✅ Solana spending limits state updated!");
        console.log("📋 Final spending limits count:", fetchedLimits.length);

        // Update unified limit editing state using shared helper function
        updateLimitEditsFromFetchedLimits(fetchedLimits);
        console.log("🎯 Limit editing state updated for Solana");
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
    console.log("🔗 transactionManager available:", !!transactionManager);
    console.log(
      "📋 getSpendingLimits method available:",
      !!transactionManager?.getSpendingLimits
    );

    if (networkType === "solana") {
      console.log("🔵 Processing Solana spending limits...");
      // Solana spending limits fetching
      try {
        if (!transactionManager?.getSpendingLimits) {
          console.log("❌ Solana spending limits method not available yet");
          console.log("TransactionManager state:", {
            exists: !!transactionManager,
            methods: transactionManager
              ? Object.keys(transactionManager)
              : "none",
          });
          setSpendingLimits([]);
          setLimitsLoaded(true);
          return;
        }

        console.log("🔄 Calling transactionManager.getSpendingLimits()...");
        const spendingData = await transactionManager.getSpendingLimits();
        console.log("✅ Fetched Solana spending limits:", spendingData);
        console.log(
          "📊 Limits array length:",
          spendingData?.limits?.length || 0
        );

        // Convert Solana format to unified format (values are already in SOL)
        // Filter to only include active limits for consistency with EVM
        const fetchedLimits = spendingData.limits
          .filter((limit) => limit.active) // Only include active limits like EVM
          .map((limit) => ({
            name: limit.name,
            limit: limit.limit.toString(), // Already converted to SOL in SolanaAdapter
            spent: limit.spent.toString(),
            remaining: Math.max(0, limit.remaining),
            duration: limit.duration.toString(),
            active: limit.active,
            durationHours: Math.floor(Number(limit.duration) / 3600),
            durationDays: Math.floor(Number(limit.duration) / 86400),
          }));

        console.log("🔄 Converted limits for frontend:", fetchedLimits);
        console.log(
          "📊 Setup committed status:",
          spendingData.isSetupCommitted
        );

        setSpendingLimits(fetchedLimits);
        setLimitsLoaded(true);
        setIsSetupCommitted(spendingData.isSetupCommitted);

        console.log("✅ Solana spending limits state updated!");
        console.log("📋 Final spending limits count:", fetchedLimits.length);

        // Update unified limit editing state using shared helper function
        updateLimitEditsFromFetchedLimits(fetchedLimits);
      } catch (error) {
        console.error("Error fetching Solana spending limits:", error);
        setSpendingLimits([]);
        setLimitsLoaded(true);
      }
    } else if (contract && userSigner) {
      // EVM spending limits fetching (existing logic)
      try {
        const userAddress = await userSigner.getAddress();

        // Get all user's spending limits from the smart contract
        const spendingData = await contract.getUserSpendingLimits(userAddress);

        const fetchedLimits = [];
        const [names, limits, spent, remaining, durations, active] =
          spendingData;

        for (let i = 0; i < names.length; i++) {
          if (active[i]) {
            fetchedLimits.push({
              name: names[i],
              limit: ethers.formatUnits(limits[i], 6),
              spent: ethers.formatUnits(spent[i], 6),
              remaining: Number(ethers.formatUnits(remaining[i], 6)),
              duration: durations[i].toString(),
              active: active[i],
              // Helper fields for display
              durationHours: Math.floor(Number(durations[i]) / 3600),
              durationDays: Math.floor(Number(durations[i]) / 86400),
            });
          }
        }

        setSpendingLimits(fetchedLimits);
        setLimitsLoaded(true);

        // Update unified limit editing state using shared helper function
        updateLimitEditsFromFetchedLimits(fetchedLimits);
      } catch (error) {
        console.error("Error fetching EVM spending limits:", error);
        // If the function doesn't exist, user hasn't set any limits yet
        setSpendingLimits([]);
        setLimitsLoaded(true);
      }
    } else {
      setLimitsLoaded(true);
    }
  };

  // ========== WITHDRAWAL ADDRESS MANAGEMENT ==========

  const fetchWithdrawalAddresses = async (
    contract = savingsContract,
    userAddr = null
  ) => {
    const currentUserAddress = userAddr || userAddress;

    try {
      if (networkType === "solana") {
        // Fetch Solana withdrawal destinations
        if (!transactionManager) {
          console.log(
            `⏭️ Skipping fetchWithdrawalAddresses for Solana - no transaction manager`
          );
          setWithdrawalAddresses([]);
          return;
        }

        const adapter = transactionManager.getCurrentAdapter();
        // For Solana, get the address directly from the Solana adapter to ensure we get the Solana address
        let solanaUserAddress = userAddr;
        if (!solanaUserAddress) {
          if (adapter && adapter.wallet?.publicKey) {
            solanaUserAddress = adapter.wallet.publicKey.toString();
          } else {
            solanaUserAddress = solanaPublicKey?.toString();
          }
        }

        console.log(
          `🔍 [Withdrawal Addresses] Using Solana address: ${solanaUserAddress}`
        );

        // Double-check we have a valid Solana address before proceeding
        if (
          solanaUserAddress &&
          (solanaUserAddress.startsWith("0x") ||
            solanaUserAddress.length !== 44)
        ) {
          console.error(
            `❌ [Withdrawal Addresses] Invalid Solana address format detected: ${solanaUserAddress}`
          );
          console.log(
            "📭 Skipping fetchWithdrawalAddresses - wrong address format"
          );
          setWithdrawalAddresses([]);
          return;
        }

        const addresses = await adapter.fetchWithdrawalAddresses(
          solanaUserAddress
        );

        // Transform to match EVM format
        const formattedAddresses = addresses.map((addr) => ({
          title: addr.title,
          destination: addr.destination,
          addedTimestamp: addr.addedAt,
          addedDate: new Date(addr.addedAt * 1000).toLocaleDateString(),
        }));

        setWithdrawalAddresses(formattedAddresses);
        console.log(
          `📋 Loaded ${formattedAddresses.length} Solana withdrawal addresses for ${solanaUserAddress}`
        );
      } else {
        // Fetch EVM withdrawal addresses
        if (!contract || !currentUserAddress) {
          console.log(
            `⏭️ Skipping fetchWithdrawalAddresses for EVM - missing contract or user`
          );
          setWithdrawalAddresses([]);
          return;
        }

        const addressData = await contract.getUserWithdrawalAddresses();
        const [titles, destinations, timestamps] = addressData;

        const addresses = [];
        for (let i = 0; i < titles.length; i++) {
          addresses.push({
            title: titles[i],
            destination: destinations[i],
            addedTimestamp: Number(timestamps[i]),
            addedDate: new Date(
              Number(timestamps[i]) * 1000
            ).toLocaleDateString(),
          });
        }

        setWithdrawalAddresses(addresses);
        console.log(
          `📋 Loaded ${addresses.length} EVM withdrawal addresses for ${currentUserAddress}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Error fetching ${networkType} withdrawal addresses:`,
        error
      );
      setWithdrawalAddresses([]);
    }
  };

  const fetchPendingWithdrawalRequests = async (
    contract = savingsContract,
    userAddr = null,
    txManager = transactionManager
  ) => {
    let currentUserAddress = userAddr || getCurrentUserAddress();

    try {
      if (networkType === "solana") {
        // Fetch Solana withdrawal destination requests
        if (!txManager) {
          console.log(
            `⏭️ Skipping fetchPendingWithdrawalRequests for Solana - missing adapter`
          );
          setPendingWithdrawalRequests([]);
          return;
        }

        // Check if we have a valid user address
        if (!currentUserAddress) {
          console.log(
            `⏭️ Skipping fetchPendingWithdrawalRequests for Solana - no user address available`
          );
          setPendingWithdrawalRequests([]);
          return;
        }

        console.log(
          `🔍 [Withdrawal Requests] Using Solana address: ${currentUserAddress}`
        );

        // Double-check we have a valid Solana address before proceeding
        if (
          currentUserAddress &&
          (currentUserAddress.startsWith("0x") ||
            currentUserAddress.length !== 44)
        ) {
          console.error(
            `❌ Invalid Solana address format detected: ${currentUserAddress}`
          );
          console.log(
            "📭 Skipping fetchPendingWithdrawalRequests - wrong address format"
          );
          setPendingWithdrawalRequests([]);
          return;
        }

        const solanaAdapter = txManager.getCurrentAdapter();
        const requests =
          await solanaAdapter.getPendingWithdrawalDestinationRequests(
            currentUserAddress
          );

        // Format Solana requests to match EVM format
        const formattedRequests = requests.map((request) => ({
          requestId: request.requestId,
          title: request.title,
          destination: request.address,
          executeAfter: request.executeAfter,
          submittedDate: new Date(
            request.createdAt * 1000
          ).toLocaleDateString(),
        }));

        setPendingWithdrawalRequests(formattedRequests);
        console.log(
          `📋 Loaded ${formattedRequests.length} Solana pending withdrawal destination requests for ${currentUserAddress}`
        );
        return;
      } else {
        // Fetch EVM withdrawal requests
        if (!contract || !currentUserAddress) {
          console.log(
            `⏭️ Skipping fetchPendingWithdrawalRequests for EVM - missing contract or user`
          );
          setPendingWithdrawalRequests([]);
          return;
        }

        const requestData = await contract.getUserPendingWithdrawalRequests();
        const [requestIds, titles, destinations, executeAfters] = requestData;

        const requests = [];
        for (let i = 0; i < requestIds.length; i++) {
          requests.push({
            requestId: requestIds[i],
            title: titles[i],
            destination: destinations[i],
            executeAfter: Number(executeAfters[i]),
            submittedDate: new Date().toLocaleDateString(), // Approximate
          });
        }

        setPendingWithdrawalRequests(requests);
        console.log(
          `📋 Loaded ${requests.length} EVM pending withdrawal requests for ${currentUserAddress}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Error fetching ${networkType} pending withdrawal requests:`,
        error
      );
      setPendingWithdrawalRequests([]);
    }
  };

  const requestWithdrawalAddress = async () => {
    // Network-aware validation
    if (
      networkType === "solana" &&
      (!transactionManager || !newWithdrawalTitle || !newWithdrawalAddress)
    ) {
      alert("Please fill in all fields and connect your Solana wallet");
      return;
    }
    if (
      networkType === "evm" &&
      (!savingsContract || !newWithdrawalTitle || !newWithdrawalAddress)
    ) {
      alert("Please fill in all fields and connect your MetaMask wallet");
      return;
    }

    try {
      if (networkType === "solana") {
        // Solana address request logic (with timelock, same as EVM)
        // Basic Solana address validation (44 characters, base58)
        if (newWithdrawalAddress.length !== 44) {
          alert("Please enter a valid Solana address (44 characters)");
          return;
        }

        const adapter = transactionManager.getCurrentAdapter();
        const txHash = await adapter.addWithdrawalDestination(
          newWithdrawalAddress,
          newWithdrawalTitle
        );

        alert(
          `✅ Solana withdrawal address processed successfully!\n\n` +
            `Title: ${newWithdrawalTitle}\n` +
            `Address: ${newWithdrawalAddress}\n` +
            `Transaction: ${txHash}\n\n` +
            `The address has been processed based on your contract lock status. Check the withdrawal destinations or pending requests sections.`
        );
      } else {
        // EVM address request logic (existing - requires timelock)
        // Validate address format
        if (!ethers.isAddress(newWithdrawalAddress)) {
          alert("Please enter a valid Ethereum address");
          return;
        }

        const tx = await savingsContract.requestWithdrawalAddress(
          newWithdrawalTitle,
          newWithdrawalAddress
        );
        await tx.wait();

        alert(
          `✅ EVM withdrawal address request submitted successfully!\n\n` +
            `Title: ${newWithdrawalTitle}\n` +
            `Address: ${newWithdrawalAddress}\n` +
            `Executable after: 24 hours\n\n` +
            `You can execute this request from the "Pending Withdrawal Requests" section once the waiting period is over.`
        );
      }

      // Clear form
      setNewWithdrawalTitle("");
      setNewWithdrawalAddress("");
      setShowWithdrawalAddressForm(false);

      // Refresh data for both networks
      if (networkType === "solana") {
        // Add a small delay to ensure transaction is fully processed
        console.log("⏳ Waiting for account data to update...");
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay

        await fetchWithdrawalAddresses();
        await fetchPendingWithdrawalRequests(); // Fetch pending requests for Solana timelock
      } else {
        await fetchPendingWithdrawalRequests();
      }
    } catch (error) {
      console.error(
        `Error requesting ${networkType} withdrawal address:`,
        error
      );

      // Network-aware error handling
      if (networkType === "solana") {
        if (error.message.includes("already exists")) {
          alert(
            "This Solana address is already in your withdrawal destinations"
          );
        } else if (error.message.includes("own address")) {
          alert(
            "You cannot add your own Solana wallet address as a withdrawal destination"
          );
        } else {
          alert(`Failed to add Solana withdrawal address: ${error.message}`);
        }
      } else {
        // EVM error handling
        if (error.message.includes("Address already exists")) {
          alert("This address is already in your withdrawal addresses");
        } else if (error.message.includes("Cannot set own address")) {
          alert(
            "You cannot add your own wallet address as a withdrawal destination"
          );
        } else {
          alert(`Failed to request withdrawal address: ${error.message}`);
        }
      }
    }
  };

  const executeWithdrawalRequest = async (requestId) => {
    if (!savingsContract) return;

    try {
      const tx = await savingsContract.executeWithdrawalAddressRequest(
        requestId
      );
      await tx.wait();
      alert("✅ Withdrawal address request executed successfully!");

      // Refresh data
      await fetchWithdrawalAddresses();
      await fetchPendingWithdrawalRequests();
    } catch (error) {
      console.error("Error executing withdrawal request:", error);
      if (error.message.includes("Request still in timelock")) {
        alert("Request is still in 24-hour timelock period");
      } else {
        alert(`Failed to execute withdrawal request: ${error.message}`);
      }
    }
  };

  const cancelWithdrawalRequest = async (requestId) => {
    if (!savingsContract) return;

    try {
      const tx = await savingsContract.cancelWithdrawalAddressRequest(
        requestId
      );
      await tx.wait();
      alert("Withdrawal address request cancelled successfully!");

      // Refresh data
      await fetchPendingWithdrawalRequests();
    } catch (error) {
      console.error("Error cancelling withdrawal request:", error);
      alert(`Failed to cancel withdrawal request: ${error.message}`);
    }
  };

  const removeWithdrawalAddress = async (destination) => {
    if (!savingsContract) return;

    try {
      const tx = await savingsContract.removeWithdrawalAddress(destination);
      await tx.wait();
      alert("Withdrawal address removed successfully!");

      // Refresh data
      await fetchWithdrawalAddresses();
    } catch (error) {
      console.error("Error removing withdrawal address:", error);
      alert(`Failed to remove withdrawal address: ${error.message}`);
    }
  };

  const withdrawToDestination = async () => {
    // Network-aware connection check
    if (networkType === "solana" && (!transactionManager || !solanaConnected)) {
      alert("Please connect your Solana wallet first");
      return;
    }
    if (
      networkType === "evm" &&
      (!savingsContract || !selectedToken || !withdrawalAmount)
    ) {
      alert("Please connect your MetaMask wallet first");
      return;
    }

    // Validate inputs
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
        // Solana withdrawal to destination logic
        console.log(
          "💸 Solana: Withdrawing to destination",
          withdrawalAmount,
          selectedToken,
          selectedWithdrawalDestination
        );

        const adapter = transactionManager.getCurrentAdapter();
        const amountValue = parseFloat(withdrawalAmount);
        let destinationAddress = selectedWithdrawalDestination;

        // Handle "self" destination - use user's wallet address
        if (selectedWithdrawalDestination === "self") {
          if (!solanaPublicKey) {
            throw new Error("Solana wallet not connected");
          }
          destinationAddress = solanaPublicKey.toString();
        }

        let txHash;
        if (selectedToken === "SOL") {
          // Withdraw SOL to destination
          const amountLamports = Math.floor(amountValue * Math.pow(10, 9)); // Convert to lamports
          txHash = await adapter.withdrawSolToDestination(
            amountLamports,
            destinationAddress
          );
          console.log("Solana SOL withdrawal to destination:", txHash);
        } else {
          // Withdraw SPL token to destination
          // Get the token mint address from network configuration
          const currentNetwork = getCurrentNetwork(selectedNetwork);
          const token = currentNetwork.tokens[selectedToken];
          if (!token) {
            alert("Please select a valid token");
            return;
          }

          const tokenMint = token.mint || token.address; // Use mint for Solana, address for EVM
          const decimals = token.decimals;

          // Convert to token's base units
          const amountTokenUnits = Math.floor(
            amountValue * Math.pow(10, decimals)
          );
          txHash = await adapter.withdrawSplToDestination(
            amountTokenUnits,
            tokenMint,
            destinationAddress
          );
          console.log("Solana SPL withdrawal to destination:", txHash);
        }

        alert(
          `✅ Withdrawal of ${withdrawalAmount} ${selectedToken} to destination successful!`
        );
      } else {
        // EVM withdrawal to destination logic (existing)
        if (!savingsContract || !selectedToken || !withdrawalAmount) {
          alert("Missing required data for EVM withdrawal");
          return;
        }

        // Check if user is on the correct network
        if (!isCorrectNetwork()) {
          const currentNetwork = getCurrentNetwork(selectedNetwork);
          alert(`Please switch to ${currentNetwork.name} to make withdrawals`);
          return;
        }

        const currentNetwork = getCurrentNetwork(selectedNetwork);
        let tokenAddress;
        let decimals;
        let tokenSymbol;

        // Determine token details based on selection
        if (selectedToken === "ETH") {
          tokenAddress = ETH_ADDRESS;
          decimals = 18;
          tokenSymbol = "ETH";
        } else if (currentNetwork.tokens[selectedToken]) {
          const token = currentNetwork.tokens[selectedToken];
          // Check availability based on network type
          const networkTokenAddress = token.mint || token.address;
          if (
            !networkTokenAddress ||
            token.address === "0x0000000000000000000000000000000000000000"
          ) {
            alert(`${token.symbol} is not available on ${currentNetwork.name}`);
            return;
          }
          tokenAddress = networkTokenAddress;
          decimals = token.decimals;
          tokenSymbol = token.symbol;
        } else {
          alert("Please select a valid token");
          return;
        }

        const amount = ethers.parseUnits(withdrawalAmount, decimals);

        let tx;
        if (selectedWithdrawalDestination === "self") {
          // Use original withdraw function
          tx = await savingsContract.withdraw(amount, tokenAddress);
        } else {
          // Use withdrawTo function with selected destination
          tx = await savingsContract.withdrawTo(
            amount,
            tokenAddress,
            selectedWithdrawalDestination
          );
        }

        await tx.wait();
        alert(`Withdrawal of ${withdrawalAmount} ${tokenSymbol} successful!`);

        // Clear form and refresh balances and spending limits
        setWithdrawalAmount("");
        await refreshBalances();
        await fetchSpendingLimits();
      }

      // Clear form and refresh data for both networks
      setWithdrawalAmount("");

      // For Solana, add a small delay to ensure account state is updated
      if (networkType === "solana") {
        console.log("⏳ Waiting for Solana account state to update...");
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      }

      await refreshBalances();
      if (networkType === "evm") {
        await fetchSpendingLimits();
      }
      if (networkType === "solana") {
        await fetchPendingBypassRequests();
        await fetchWithdrawalAddresses();
      }
    } catch (error) {
      console.error("Withdrawal error:", error);

      // Network-aware error handling
      if (networkType === "solana") {
        if (error.message.includes("Destination not approved")) {
          alert("Selected withdrawal destination is not approved for Solana");
        } else if (error.message.includes("Insufficient")) {
          alert("Insufficient balance for this withdrawal");
        } else {
          alert(`Solana withdrawal failed: ${error.message}`);
        }
      } else {
        // EVM error handling
        if (error.message.includes("Exceeds")) {
          alert(`Withdrawal blocked: ${error.message}`);
        } else if (error.message.includes("Insufficient balance")) {
          alert("Insufficient balance for this withdrawal");
        } else if (error.message.includes("Destination not approved")) {
          alert("Selected withdrawal destination is not approved");
        } else {
          alert("Failed to withdraw. Please try again.");
        }
      }
    }
  };

  // Function to request bypass for withdrawal
  const requestBypassForWithdrawal = async () => {
    // Network-aware validation
    if (
      networkType === "solana" &&
      (!transactionManager ||
        !solanaConnected ||
        !withdrawalAmount ||
        !exceedingPeriod)
    ) {
      alert(
        "Invalid withdrawal request - please connect Solana wallet and enter withdrawal details"
      );
      return;
    }
    if (
      networkType === "evm" &&
      (!savingsContract || !withdrawalAmount || !exceedingPeriod)
    ) {
      alert(
        "Invalid withdrawal request - please connect MetaMask and enter withdrawal details"
      );
      return;
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Request withdrawal of ${withdrawalAmount} ${selectedToken} above ${exceedingPeriod} limit?\n\n` +
        `This will require a 24-hour waiting period before you can execute the withdrawal.\n\n` +
        `Click OK to submit the request.`
    );

    if (!confirmed) return;

    try {
      if (networkType === "solana") {
        // Solana bypass request logic
        console.log(
          "🔒 Solana: Requesting bypass for",
          withdrawalAmount,
          selectedToken,
          exceedingPeriod
        );

        const adapter = transactionManager.getCurrentAdapter();
        let tokenAddress;
        let destination = selectedWithdrawalDestination;

        // Handle "self" destination
        if (selectedWithdrawalDestination === "self") {
          if (!solanaPublicKey) {
            throw new Error("Solana wallet not connected");
          }
          destination = solanaPublicKey.toString();
        }

        // Determine token address
        if (selectedToken === "SOL") {
          tokenAddress = "So11111111111111111111111111111111111111112"; // SOL mint (System Program ID)
        } else {
          // Get current USDT or other SPL token address from network config
          const currentNetwork = getCurrentNetwork(
            networkType,
            selectedNetwork
          );
          console.log("🔍 DEBUG: Network selection:", {
            selectedNetwork,
            currentNetwork: currentNetwork.name,
            networkType,
            tokenConfig: currentNetwork.tokens[selectedToken],
          });

          const token = currentNetwork.tokens[selectedToken];
          if (token) {
            // For Solana, use mint address; for EVM, use address
            tokenAddress = token.mint || token.address;
            console.log("🔍 DEBUG: Token resolution:", {
              tokenMint: token.mint,
              tokenAddress: token.address,
              finalTokenAddress: tokenAddress,
            });
          } else {
            alert("Please select a valid token");
            return;
          }
        }

        console.log("🔍 DEBUG: Requesting bypass with params:", {
          amount: withdrawalAmount,
          tokenAddress,
          period: exceedingPeriod,
          destination,
          selectedToken,
          networkType,
        });

        const txHash = await adapter.requestWithdrawalBypass(
          withdrawalAmount,
          tokenAddress,
          exceedingPeriod,
          destination
        );

        alert(
          `✅ Solana bypass request submitted successfully!\n\n` +
            `Amount: ${withdrawalAmount} ${selectedToken}\n` +
            `Period: ${exceedingPeriod}\n` +
            `Destination: ${destination.slice(0, 8)}...${destination.slice(
              -4
            )}\n` +
            `Executable after: 24 hours\n\n` +
            `Transaction: ${txHash}\n\n` +
            `You can execute this request from the "Pending Bypass Requests" section once the waiting period is over.`
        );
      } else {
        // EVM bypass request logic (existing)
        const currentNetwork = getCurrentNetwork(selectedNetwork);
        let tokenAddress;
        let decimals;

        // Determine token details
        if (selectedToken === "ETH") {
          tokenAddress = ETH_ADDRESS;
          decimals = 18;
        } else if (currentNetwork.tokens[selectedToken]) {
          const token = currentNetwork.tokens[selectedToken];
          tokenAddress = token.mint || token.address; // Use mint for Solana, address for EVM
          decimals = token.decimals;
        } else {
          alert("Please select a valid token");
          return;
        }

        const amount = ethers.parseUnits(withdrawalAmount, decimals);

        const tx = await savingsContract.requestLimitBypass(
          amount,
          exceedingPeriod,
          tokenAddress
        );
        await tx.wait();

        alert(
          `✅ EVM bypass request submitted successfully!\n\n` +
            `Amount: ${withdrawalAmount} ${selectedToken}\n` +
            `Period: ${exceedingPeriod}\n` +
            `Executable after: 24 hours\n\n` +
            `You can execute this request from the "Pending Bypass Requests" section once the waiting period is over.`
        );
      }

      // Clear form and refresh data for both networks
      setWithdrawalAmount("");
      if (networkType === "evm") {
        await fetchPendingBypassRequests();
        await fetchSpendingLimits();
      }
      if (networkType === "solana") {
        await fetchPendingBypassRequests();
        await fetchSpendingLimits();
      }
    } catch (error) {
      console.error("Error requesting bypass:", error);

      // Network-aware error handling
      if (networkType === "solana") {
        if (error.message.includes("Destination not approved")) {
          alert("Selected withdrawal destination is not approved for Solana");
        } else if (error.message.includes("Insufficient")) {
          alert("Insufficient balance for this withdrawal");
        } else {
          alert(`Solana bypass request failed: ${error.message}`);
        }
      } else {
        // EVM error handling
        if (error.message.includes("Insufficient balance")) {
          alert("Insufficient balance for this withdrawal");
        } else if (error.message.includes("Amount within limits")) {
          alert(
            "This amount is within your spending limits - use instant withdrawal instead"
          );
        } else {
          alert(`Failed to request bypass: ${error.message}`);
        }
      }
    }
  };

  const fetchPendingBypassRequests = async (
    contract = savingsContract,
    userAddr = null
  ) => {
    const currentUserAddress = userAddr || userAddress;

    try {
      if (networkType === "solana") {
        // Fetch Solana bypass requests
        if (!transactionManager) {
          console.log(
            `⏭️ Skipping fetchPendingBypassRequests for Solana - no transaction manager`
          );
          setPendingBypassRequests([]);
          return;
        }

        const adapter = transactionManager.getCurrentAdapter();
        // For Solana, get the address directly from the Solana adapter to ensure we get the Solana address
        let solanaUserAddress = userAddr;
        if (!solanaUserAddress) {
          if (adapter && adapter.wallet?.publicKey) {
            solanaUserAddress = adapter.wallet.publicKey.toString();
          } else {
            solanaUserAddress = solanaPublicKey?.toString();
          }
        }

        console.log(
          `🔍 [Bypass Requests] Using Solana address: ${solanaUserAddress}`
        );

        // Double-check we have a valid Solana address before proceeding
        if (
          solanaUserAddress &&
          (solanaUserAddress.startsWith("0x") ||
            solanaUserAddress.length !== 44)
        ) {
          console.error(
            `❌ [Bypass Requests] Invalid Solana address format detected: ${solanaUserAddress}`
          );
          console.log(
            "📭 Skipping fetchPendingBypassRequests - wrong address format"
          );
          setPendingBypassRequests([]);
          return;
        }

        const bypassRequests = await adapter.fetchPendingBypassRequests(
          solanaUserAddress
        );

        // Transform to match EVM format
        const formattedRequests = bypassRequests.map((req) => {
          // Format amount properly - convert from token base units to decimal
          let formattedAmount = req.amount;
          try {
            // The Solana program stores all amounts with 9 decimals (SOL standard)
            formattedAmount = (Number(req.amount) / Math.pow(10, 9)).toString();
            console.log(
              `🔍 Amount conversion: ${req.amount} -> ${formattedAmount}`
            );
          } catch (error) {
            console.warn("Error formatting amount:", error);
          }

          return {
            requestId: req.requestId,
            title: `${req.bypassingPeriod} Bypass`, // Use bypassing period as title
            destination: req.destination,
            executeAfter: req.executeAfter,
            submittedDate: (() => {
              try {
                // Handle different timestamp formats
                let timestamp = req.createdAt;
                // If timestamp is too large, it might be in milliseconds already
                if (timestamp > 10000000000) {
                  timestamp = timestamp / 1000;
                }
                const date = new Date(timestamp * 1000);
                console.log(
                  `🔍 Date conversion: ${
                    req.createdAt
                  } -> ${date.toLocaleDateString()}`
                );
                return date.toLocaleDateString();
              } catch (error) {
                console.warn("Error formatting date:", error);
                return "Unknown date";
              }
            })(),
            amount: formattedAmount,
            tokenMint: req.tokenMint,
            bypassingPeriod: req.bypassingPeriod,
            canExecute: req.canExecute,
            status: req.status,
          };
        });

        setPendingBypassRequests(formattedRequests);
        console.log(
          `📋 Loaded ${formattedRequests.length} Solana bypass requests for ${solanaUserAddress}`
        );
        return;
      }

      // EVM bypass requests
      const currentContract = contract || savingsContract;
      if (!currentUserAddress || !currentContract) return;
      console.log("🔍 Fetching bypass requests for:", currentUserAddress);

      // Get active bypass requests directly from contract
      const bypassData = await currentContract.getUserActiveBypassRequests();
      console.log("📊 Raw bypass data:", bypassData);

      const [requestIds, amounts, skipPeriods, tokens, executeAfters] =
        bypassData;
      console.log("📊 Request IDs length:", requestIds.length);

      const requests = [];
      for (let i = 0; i < requestIds.length; i++) {
        // Determine token info for display
        let tokenSymbol = "Unknown";
        let tokenDecimals = 18;

        const tokenAddress = tokens[i];
        if (tokenAddress === "0x0000000000000000000000000000000000000000") {
          tokenSymbol = "ETH";
          tokenDecimals = 18;
        } else {
          // Check if it's USDT or other known tokens
          const moduleAddresses = await import("./moduleAddresses.json");
          if (
            tokenAddress.toLowerCase() ===
            moduleAddresses.tokens.usdt.toLowerCase()
          ) {
            tokenSymbol = "USDT";
            tokenDecimals = 6;
          }
        }

        requests.push({
          requestId: requestIds[i],
          amount: ethers.formatUnits(amounts[i], tokenDecimals),
          period: skipPeriods[i],
          token: tokenSymbol,
          tokenAddress: tokenAddress,
          tokenDecimals: tokenDecimals,
          executeAfter: Number(executeAfters[i]),
          executed: false,
          exists: true,
        });
      }

      console.log(
        `Found ${requests.length} active bypass requests for ${currentUserAddress}`
      );
      console.log("📋 Requests array:", requests);
      setPendingBypassRequests(requests);
      console.log(
        "✅ setPendingBypassRequests called with",
        requests.length,
        "requests"
      );
    } catch (error) {
      console.error("Error fetching bypass requests:", error);
      setPendingBypassRequests([]);
    }
  };

  const executeBypassRequest = async (requestId) => {
    if (savingsContract) {
      try {
        const tx = await savingsContract.executeBypassWithdrawal(requestId);
        await tx.wait();
        alert("✅ Bypass withdrawal executed successfully!");

        // Refresh data
        await refreshBalances();
        await fetchSpendingLimits();
        await fetchPendingBypassRequests();
      } catch (error) {
        console.error("Execute bypass error:", error);
        if (error.message.includes("Request still in timelock")) {
          alert("Request is still in 24-hour timelock period");
        } else if (error.message.includes("Request does not exist")) {
          alert("Request not found");
        } else if (error.message.includes("Request already executed")) {
          alert("Request has already been executed");
        } else if (error.message.includes("Insufficient balance")) {
          alert("Insufficient balance for this withdrawal");
        } else if (error.message.includes("Exceeds")) {
          alert(`Withdrawal blocked: ${error.message}`);
        } else {
          alert(`Failed to execute bypass: ${error.message}`);
        }
      }
    }
  };

  const cancelBypassRequest = async (requestId) => {
    if (savingsContract) {
      try {
        const tx = await savingsContract.cancelBypassRequest(requestId);
        await tx.wait();
        alert("Bypass request cancelled successfully!");

        // Refresh pending requests
        await fetchPendingBypassRequests(savingsContract, userAddress);
      } catch (error) {
        console.error("Cancel bypass error:", error);
        alert(`Failed to cancel bypass request: ${error.message}`);
      }
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      {/* Enhanced Status Header */}
      <div style={{ marginBottom: "25px" }}>
        {/* Main Title */}
        <h1
          style={{
            margin: "0 0 20px 0",
            fontSize: "2.2em",
            fontWeight: "bold",
            color: "#1a202c",
          }}
        >
          🔒 LockIn Wallet
        </h1>

        {/* Status Info Card */}
        {(provider || (networkType === "solana" && solanaWallet)) && (
          <div
            style={{
              padding: "20px",
              border: "1px solid #4a5568",
              borderRadius: "8px",
              backgroundColor: "#2d3748",
              color: "white",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
          >
            {/* Top Row: Connection & Status */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                flexWrap: "wrap",
                gap: "15px",
              }}
            >
              {/* Connected Wallet Info */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <span
                  style={{
                    fontSize: "1.1em",
                    fontWeight: "500",
                    color: "#e2e8f0",
                  }}
                >
                  Connected:
                </span>
                <span
                  style={{
                    fontSize: "1em",
                    fontFamily: "monospace",
                    color: "#9ae6b4",
                    backgroundColor: "#1a365d",
                    padding: "4px 8px",
                    borderRadius: "4px",
                  }}
                >
                  {networkType === "solana"
                    ? solanaPublicKey
                      ? `${solanaPublicKey
                          .toString()
                          .slice(0, 6)}...${solanaPublicKey
                          .toString()
                          .slice(-4)}`
                      : "Loading..."
                    : userAddress
                    ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
                    : "Loading..."}
                </span>
                <span style={{ fontSize: "0.9em", color: "#a0aec0" }}>
                  ({networkType === "solana" ? "Phantom" : "MetaMask"})
                </span>
              </div>

              {/* Wallet Buttons for Solana */}
              {networkType === "solana" && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <WalletMultiButton />
                  {solanaConnected && <WalletDisconnectButton />}
                </div>
              )}
            </div>

            {/* Second Row: Network & Status Badge */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
                flexWrap: "wrap",
                gap: "15px",
              }}
            >
              {/* Network Selection */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span
                    style={{
                      color: "#a0aec0",
                      fontSize: "0.9em",
                      fontWeight: "500",
                    }}
                  >
                    Network:
                  </span>
                  <select
                    value={networkType}
                    onChange={(e) => switchNetworkType(e.target.value)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "4px",
                      border: "1px solid #4a5568",
                      backgroundColor: "#4a5568",
                      color: "white",
                      fontSize: "0.9em",
                      cursor: "pointer",
                      fontWeight: "500",
                    }}
                  >
                    <option value="evm">Ethereum (EVM)</option>
                    <option value="solana">Solana</option>
                  </select>
                </div>

                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <select
                    value={selectedNetwork}
                    onChange={(e) => switchNetwork(e.target.value)}
                    disabled={isNetworkSwitching}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "4px",
                      border: "1px solid #4a5568",
                      backgroundColor: "#4a5568",
                      color: "white",
                      fontSize: "0.9em",
                      cursor: isNetworkSwitching ? "not-allowed" : "pointer",
                      fontWeight: "500",
                    }}
                  >
                    {networkType === "solana" ? (
                      <>
                        <option value="localhost">Solana Localhost</option>
                        <option value="devnet">Solana Devnet</option>
                        <option value="mainnet">Solana Mainnet</option>
                      </>
                    ) : (
                      <>
                        <option value="localhost">Localhost</option>
                        <option value="ethereum">Ethereum Mainnet</option>
                        <option value="optimism">Optimism</option>
                      </>
                    )}
                  </select>
                  {isNetworkSwitching && (
                    <span style={{ color: "#fbb6ce", fontSize: "0.8em" }}>
                      Switching...
                    </span>
                  )}
                </div>
              </div>

              {/* Dynamic Status Badge */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <span
                  style={{
                    color: "#a0aec0",
                    fontSize: "0.9em",
                    fontWeight: "500",
                  }}
                >
                  Status:
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: isSetupCommitted ? "#1a365d" : "#744210",
                    border: `1px solid ${
                      isSetupCommitted ? "#2b77ad" : "#d69e2e"
                    }`,
                    fontSize: "0.9em",
                    fontWeight: "600",
                  }}
                  title={
                    isSetupCommitted
                      ? "Your wallet is locked and secure. All features are active."
                      : `You're in setup mode — configure limits & addresses before activating your wallet security. Step ${currentStep} of 3.`
                  }
                >
                  <span
                    style={{
                      color: isSetupCommitted ? "#63b3ed" : "#f6ad55",
                    }}
                  >
                    {isSetupCommitted ? "🔒 Locked-In" : "⚙️ Setup Mode"}
                  </span>
                  {!isSetupCommitted && (
                    <span
                      style={{
                        color: "#f6ad55",
                        fontSize: "0.8em",
                        marginLeft: "4px",
                      }}
                    >
                      ({currentStep}/3)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Connection Status Indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: isCorrectNetwork() ? "#48bb78" : "#f56565",
                }}
              />
              <span
                style={{
                  fontSize: "0.8em",
                  color: isCorrectNetwork() ? "#9ae6b4" : "#fc8181",
                }}
              >
                {isCorrectNetwork()
                  ? `Connected to ${
                      getCurrentNetwork(networkType, selectedNetwork).name
                    }`
                  : networkType === "solana"
                  ? `Connect Solana wallet`
                  : `Wrong network - Switch to ${
                      getCurrentNetwork(networkType, selectedNetwork).name
                    }`}
              </span>
            </div>
          </div>
        )}

        {/* Contract Deployment Warning */}
        {provider &&
          getCurrentNetwork(selectedNetwork).savingsContract ===
            "0x0000000000000000000000000000000000000000" && (
            <div
              style={{
                marginTop: "15px",
                padding: "15px",
                border: "2px solid #f56565",
                borderRadius: "5px",
                backgroundColor: "#fed7d7",
                color: "#c53030",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", color: "#c53030" }}>
                ⚠️ Contract Not Deployed
              </h4>
              <p style={{ margin: 0, fontSize: "0.9em" }}>
                The Savings contract is not yet deployed on{" "}
                {getCurrentNetwork(selectedNetwork).name}. Please switch to
                Localhost for development or wait for mainnet deployment.
              </p>
            </div>
          )}
      </div>

      {/* Multi-token balance display - ALWAYS SHOWN */}
      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          border: !isSetupCommitted ? "2px dashed #4a5568" : "2px solid #333",
          borderRadius: "5px",
          backgroundColor: "#2d3748",
          color: "white",
          opacity: !isSetupCommitted ? 0.6 : 1,
          position: "relative",
        }}
      >
        {/* Inactive Overlay for Setup Mode */}
        {!isSetupCommitted && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              padding: "4px 8px",
              backgroundColor: "#744210",
              border: "1px solid #d69e2e",
              borderRadius: "4px",
              fontSize: "0.75em",
              fontWeight: "600",
              color: "#f6ad55",
            }}
          >
            Inactive until locked-in
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <h3 style={{ color: "white", margin: 0 }}>💰 Your Balances</h3>
          {(provider ||
            (networkType === "solana" && solanaWallet?.connected)) && (
            <button
              onClick={() => refreshBalances()}
              style={{
                padding: "6px 12px",
                borderRadius: "4px",
                border: "1px solid #3182ce",
                backgroundColor: "#3182ce",
                color: "white",
                cursor: "pointer",
                fontSize: "0.8em",
                fontWeight: "bold",
              }}
            >
              🔄 Refresh
            </button>
          )}
        </div>
        {!provider ? (
          <div
            style={{ textAlign: "center", color: "#a0aec0", padding: "20px" }}
          >
            <p>Connect your wallet to view balances</p>
            <button
              onClick={connectWallet}
              style={{
                padding: "12px 24px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#3182ce",
                color: "white",
                cursor: "pointer",
                fontSize: "1em",
                fontWeight: "bold",
                marginTop: "10px",
              }}
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          // Show balance section immediately when wallet is connected, even if balances are empty
          // This eliminates the "Loading balances..." state
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px",
            }}
          >
            {/* Show stablecoins */}
            {Object.entries(getCurrentNetwork(selectedNetwork).tokens).map(
              ([key, token]) => (
                <div
                  key={key}
                  style={{
                    padding: "12px",
                    backgroundColor: token.recommended ? "#2f855a" : "#4a5568",
                    borderRadius: "6px",
                    border: token.recommended ? "2px solid #48bb78" : "none",
                    color: "white",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.8em",
                      color: token.recommended ? "#9ae6b4" : "#a0aec0",
                      marginBottom: "4px",
                    }}
                  >
                    {token.symbol}
                    {token.recommended && (
                      <span style={{ marginLeft: "5px" }}>✓</span>
                    )}
                  </div>
                  <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
                    {balances[key] || "0"}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {!provider ? (
        <div style={{ textAlign: "center", color: "#666", padding: "20px" }}>
          <p>Please connect your wallet to access the savings features.</p>
        </div>
      ) : (
        <div>
          {/* Combined Deposit Section - Hidden during onboarding */}
          {isSetupCommitted && (
            <div
              style={{
                marginBottom: "20px",
                padding: "15px",
                border: !isSetupCommitted
                  ? "2px dashed #4a5568"
                  : "2px solid #333",
                borderRadius: "5px",
                backgroundColor: "#2d3748",
                color: "white",
                opacity: !isSetupCommitted ? 0.6 : 1,
                position: "relative",
              }}
            >
              {/* Inactive Overlay for Setup Mode */}
              {!isSetupCommitted && (
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    padding: "4px 8px",
                    backgroundColor: "#744210",
                    border: "1px solid #d69e2e",
                    borderRadius: "4px",
                    fontSize: "0.75em",
                    fontWeight: "600",
                    color: "#f6ad55",
                  }}
                >
                  Inactive until locked-in
                </div>
              )}

              <h3 style={{ color: "white" }}>
                💰 Deposit from{" "}
                {networkType === "solana"
                  ? solanaPublicKey
                    ? `${solanaPublicKey
                        .toString()
                        .slice(0, 6)}...${solanaPublicKey.toString().slice(-4)}`
                    : "Connected Wallet"
                  : userAddress
                  ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
                  : "Connected Wallet"}
              </h3>

              {/* Direct Deposit from Connected Wallet */}
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ color: "#9ae6b4", margin: "0 0 10px 0" }}>
                  📱 From Currently Connected Wallet
                </h4>
                <p
                  style={{
                    fontSize: "0.9em",
                    color: "#cbd5e0",
                    marginBottom: "15px",
                  }}
                >
                  Recommended: Use stablecoins (USDT, USDC, DAI) for consistent
                  value
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginBottom: "15px",
                    flexWrap: "wrap",
                  }}
                >
                  <select
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                    style={{
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #4a5568",
                      backgroundColor: "#4a5568",
                      color: "white",
                      flex: "1",
                      minWidth: "150px",
                    }}
                  >
                    <option value="">Select Token</option>

                    {/* Recommended Stablecoins Section */}
                    <optgroup label="🌟 Recommended Stablecoins">
                      {Object.entries(getCurrentNetwork(selectedNetwork).tokens)
                        .filter(
                          ([_, token]) =>
                            token.recommended &&
                            token.address !==
                              "0x0000000000000000000000000000000000000000"
                        )
                        .map(([key, token]) => (
                          <option key={key} value={key}>
                            {token.symbol} - {token.name}
                          </option>
                        ))}
                    </optgroup>

                    {/* Other Tokens Section */}
                    <optgroup label="Other Tokens">
                      <option value="ETH">ETH - Ethereum</option>
                      {Object.entries(getCurrentNetwork(selectedNetwork).tokens)
                        .filter(
                          ([_, token]) =>
                            !token.recommended ||
                            token.address ===
                              "0x0000000000000000000000000000000000000000"
                        )
                        .map(([key, token]) => (
                          <option
                            key={key}
                            value={key}
                            disabled={
                              token.address ===
                              "0x0000000000000000000000000000000000000000"
                            }
                          >
                            {token.symbol} - {token.name}{" "}
                            {token.address ===
                            "0x0000000000000000000000000000000000000000"
                              ? "(Not Available)"
                              : ""}
                          </option>
                        ))}
                    </optgroup>
                  </select>

                  <input
                    type="text"
                    placeholder={`Amount ${
                      selectedToken ? `(${selectedToken})` : ""
                    }`}
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    style={{
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #4a5568",
                      backgroundColor: "#4a5568",
                      color: "white",
                      flex: "2",
                      minWidth: "200px",
                    }}
                  />

                  <button
                    onClick={deposit}
                    disabled={isDepositing}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "4px",
                      border: "none",
                      backgroundColor: isDepositing
                        ? "#6b7280"
                        : selectedToken &&
                          getCurrentNetwork(selectedNetwork).tokens[
                            selectedToken
                          ]?.recommended
                        ? "#28a745"
                        : "#3182ce",
                      color: "white",
                      cursor: isDepositing ? "not-allowed" : "pointer",
                      minWidth: "100px",
                      fontWeight: "bold",
                      opacity: isDepositing ? 0.7 : 1,
                    }}
                  >
                    {isDepositing ? "⏳ Processing..." : "💰 Deposit Now"}
                  </button>
                </div>
              </div>

              {/* Direct Deposit from Exchange/Other Wallet */}
              <div>
                <h4 style={{ color: "#9ae6b4", margin: "0 0 10px 0" }}>
                  🏦 Direct Deposit from Exchange
                </h4>
                <p
                  style={{
                    fontSize: "0.9em",
                    color: "#cbd5e0",
                    marginBottom: "15px",
                  }}
                >
                  Get your personal deposit address to receive funds directly
                  from exchanges
                </p>

                {/* Conditional rendering based on proxy status */}
                {!isProxyDeployed && !isDeploying && (
                  <div
                    style={{
                      padding: "15px",
                      backgroundColor: "#1a202c",
                      borderRadius: "4px",
                      border: "1px solid #4a5568",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ marginBottom: "15px" }}>
                      <div style={{ fontSize: "2em", marginBottom: "10px" }}>
                        🔒
                      </div>
                      <h5 style={{ color: "#e2e8f0", margin: "0 0 8px 0" }}>
                        Permanent Deposit Address Not Generated
                      </h5>
                      <p
                        style={{
                          color: "#a0aec0",
                          fontSize: "0.9em",
                          margin: "0 0 10px 0",
                        }}
                      >
                        Generate your unique{" "}
                        <strong style={{ color: "#9ae6b4" }}>
                          permanent deposit address
                        </strong>{" "}
                        to receive funds directly from exchanges
                      </p>
                    </div>

                    <button
                      onClick={deployProxy}
                      style={{
                        padding: "12px 24px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: "#3182ce",
                        color: "white",
                        cursor: "pointer",
                        fontSize: "1em",
                        fontWeight: "bold",
                      }}
                    >
                      🎯 Generate Permanent Deposit Address
                    </button>

                    <div
                      style={{
                        marginTop: "15px",
                        fontSize: "0.8em",
                        color: "#718096",
                      }}
                    >
                      <p style={{ margin: "5px 0" }}>
                        ✨ One-time setup • Gas fee required
                      </p>
                      <p style={{ margin: "5px 0" }}>
                        🎯 Direct exchange withdrawals • Permanent address you
                        can always use
                      </p>
                    </div>
                  </div>
                )}

                {/* Deploying state */}
                {isDeploying && (
                  <div
                    style={{
                      padding: "15px",
                      backgroundColor: "#1a202c",
                      borderRadius: "4px",
                      border: "1px solid #4a5568",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ marginBottom: "15px" }}>
                      <div style={{ fontSize: "2em", marginBottom: "10px" }}>
                        ⏳
                      </div>
                      <h5 style={{ color: "#e2e8f0", margin: "0 0 8px 0" }}>
                        Generating Deposit Address...
                      </h5>
                      <p
                        style={{
                          color: "#a0aec0",
                          fontSize: "0.9em",
                          margin: "0",
                        }}
                      >
                        Please confirm the transaction in MetaMask and wait for
                        deployment
                      </p>
                    </div>

                    <div
                      style={{
                        padding: "12px 24px",
                        borderRadius: "6px",
                        backgroundColor: "#4a5568",
                        color: "#a0aec0",
                        fontSize: "1em",
                      }}
                    >
                      🔄 Deploying Contract...
                    </div>
                  </div>
                )}

                {/* Generated state */}
                {isProxyDeployed && proxyAddress && (
                  <div
                    style={{
                      padding: "15px",
                      backgroundColor: "#1a202c",
                      borderRadius: "4px",
                      border: "1px solid #48bb78",
                    }}
                  >
                    <div style={{ marginBottom: "15px", textAlign: "center" }}>
                      <div style={{ fontSize: "2em", marginBottom: "10px" }}>
                        ✅
                      </div>
                      <h5 style={{ color: "#9ae6b4", margin: "0 0 8px 0" }}>
                        Your Permanent Deposit Address
                      </h5>
                      <p
                        style={{
                          color: "#e2e8f0",
                          fontSize: "0.9em",
                          margin: "0 0 8px 0",
                        }}
                      >
                        Use this permanent address to receive funds directly
                        from exchanges or other wallets
                      </p>
                      <p
                        style={{
                          color: "#9ae6b4",
                          fontSize: "0.8em",
                          margin: "0",
                          fontWeight: "bold",
                        }}
                      >
                        🔗 Fully on-chain address tied to your wallet - no
                        intermediaries involved
                      </p>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        marginBottom: "15px",
                      }}
                    >
                      <strong style={{ color: "white", minWidth: "120px" }}>
                        Your Deposit Address:
                      </strong>
                      <code
                        style={{
                          backgroundColor: "#4a5568",
                          color: "#9ae6b4",
                          padding: "8px",
                          borderRadius: "4px",
                          fontSize: "0.9em",
                          wordBreak: "break-all",
                          flex: 1,
                        }}
                      >
                        {proxyAddress}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(proxyAddress);
                          alert("Deposit address copied to clipboard!");
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "4px",
                          border: "none",
                          backgroundColor: "#48bb78",
                          color: "white",
                          cursor: "pointer",
                          fontSize: "0.8em",
                        }}
                      >
                        📋 Copy
                      </button>
                    </div>

                    <div
                      style={{
                        fontSize: "0.8em",
                        color: "#9ae6b4",
                        textAlign: "center",
                      }}
                    >
                      ⚠️ When pasting this address ensure it matches exactly
                      (malware extensions may alter it).
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Spending Limits Setup */}
          <div
            style={{
              marginBottom: "20px",
              padding: "20px",
              border:
                !isSetupCommitted && currentStep === 1
                  ? "3px solid #d69e2e" // Highlighted border for active step
                  : "2px solid #333",
              borderRadius: "8px",
              backgroundColor: "#2d3748",
              color: "white",
              boxShadow:
                !isSetupCommitted && currentStep === 1
                  ? "0 0 0 1px rgba(214, 158, 46, 0.3)"
                  : "none",
              position: "relative",
            }}
          >
            {/* Step Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "15px",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <h3
                  style={{
                    color:
                      !isSetupCommitted && currentStep === 1
                        ? "#f6ad55"
                        : "white",
                    margin: 0,
                    fontSize: "1.3em",
                    fontWeight: "600",
                  }}
                >
                  🧩 Step 1: Set Your Spending Limits
                </h3>
                {!isSetupCommitted && (
                  <div
                    style={{
                      fontSize: "0.8em",
                      color: stepValidation.step1Complete
                        ? "#9ae6b4"
                        : "#f6ad55",
                      backgroundColor: stepValidation.step1Complete
                        ? "#1a365d"
                        : "#744210",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontWeight: "600",
                      border: stepValidation.step1Complete
                        ? "1px solid #2b77ad"
                        : "1px solid #d69e2e",
                    }}
                  >
                    {stepValidation.step1Complete
                      ? "✅ Complete"
                      : "Required before Lock-In"}
                  </div>
                )}
              </div>

              {!isSetupCommitted &&
                stepValidation.step1Complete &&
                currentStep === 1 && (
                  <button
                    onClick={goToNextStep}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      border: "1px solid #3182ce",
                      backgroundColor: "#3182ce",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "0.9em",
                      fontWeight: "600",
                      transition: "all 0.2s ease",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = "#2c5aa0";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = "#3182ce";
                    }}
                  >
                    Continue to Step 2 →
                  </button>
                )}
            </div>

            {/* Step Description */}
            <p
              style={{
                fontSize: "0.9em",
                color: "#cbd5e0",
                marginBottom: "15px",
                lineHeight: "1.5",
              }}
            >
              {isSetupCommitted
                ? "⚠️ Account locked: Changes require 24-hour timelock proposals. Edit individual limits or add new ones."
                : currentStep === 1
                ? "Configure daily, weekly, or monthly spending limits to control your withdrawals. You'll be able to modify these freely until you lock in your wallet."
                : "Set your spending limits. You can freely modify them until you commit the setup."}
            </p>

            {/* Progress Tips for Setup Mode */}
            {!isSetupCommitted && currentStep === 1 && (
              <div
                style={{
                  fontSize: "0.8em",
                  color: "#a0aec0",
                  backgroundColor: "#1a202c",
                  padding: "10px",
                  borderRadius: "4px",
                  marginBottom: "15px",
                  borderLeft: "3px solid #f6ad55",
                }}
              >
                💡 <strong>Tip:</strong> Set at least one spending limit to
                continue. You can add multiple periods (daily + weekly +
                monthly) for layered protection.
              </div>
            )}

            {/* Daily/Weekly/Monthly Cards */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ color: "#9ae6b4", margin: "0 0 15px 0" }}>
                🎯 Standard Time Periods
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "15px",
                  marginBottom: "15px",
                }}
              >
                {["Daily", "Weekly", "Monthly"].map((periodName) => {
                  const edit = limitEdits[periodName];
                  const existingLimit = spendingLimits.find(
                    (limit) => limit.name === periodName
                  );
                  const isActive =
                    existingLimit !== undefined &&
                    existingLimit.active !== false; // Check both existence and active field

                  const progressPercent = existingLimit
                    ? (parseFloat(existingLimit.spent) /
                        parseFloat(existingLimit.limit)) *
                      100
                    : 0;
                  const isNearLimit = progressPercent > 80;
                  const isAtLimit = progressPercent >= 100;

                  // Determine card state for styling
                  const isBeingConfigured =
                    edit?.value && edit.value.trim() !== "" && !isActive;
                  const hasUnsavedChanges =
                    edit?.value &&
                    edit.value.trim() !== "" &&
                    isActive &&
                    edit.value !== existingLimit?.limit;
                  const isInteractive = !isActive || edit?.isEditing;

                  const cardStyle = {
                    padding: "15px",
                    borderRadius: "8px",
                    backgroundColor: isActive
                      ? "#1a202c"
                      : isBeingConfigured
                      ? "#2a4a5a"
                      : "#4a5568",
                    border: isActive
                      ? isAtLimit
                        ? "2px solid #e53e3e"
                        : isNearLimit
                        ? "2px solid #ed8936"
                        : "2px solid #48bb78"
                      : isBeingConfigured || hasUnsavedChanges
                      ? "2px solid #9ae6b4"
                      : "2px dashed #718096",
                    opacity: isActive ? 1 : isBeingConfigured ? 0.9 : 0.7,
                    transition: "all 0.3s ease",
                    boxShadow:
                      isBeingConfigured || hasUnsavedChanges
                        ? "0 0 0 1px rgba(154, 230, 180, 0.3)"
                        : "none",
                    cursor: isInteractive ? "pointer" : "default",
                  };

                  // Hover and focus enhancement styles
                  const getEnhancedCardStyle = (
                    isHovered = false,
                    isFocused = false
                  ) => ({
                    ...cardStyle,
                    backgroundColor:
                      (isHovered || isFocused) && isInteractive
                        ? isActive
                          ? "#2d3748"
                          : isBeingConfigured
                          ? "#3a5a6a"
                          : "#5a6578"
                        : cardStyle.backgroundColor,
                    border:
                      (isHovered || isFocused) && isInteractive
                        ? isActive
                          ? isAtLimit
                            ? "2px solid #fc8181"
                            : isNearLimit
                            ? "2px solid #f6ad55"
                            : "2px solid #68d391"
                          : "2px solid #9ae6b4"
                        : cardStyle.border,
                    boxShadow:
                      (isHovered || isFocused) && isInteractive
                        ? "0 0 0 2px rgba(154, 230, 180, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15)"
                        : cardStyle.boxShadow,
                    transform:
                      (isHovered || isFocused) && isInteractive
                        ? "translateY(-1px)"
                        : "none",
                  });

                  // Get current card state
                  const currentCardState = cardStates[periodName] || {
                    isHovered: false,
                    isFocused: false,
                  };
                  const { isHovered, isFocused } = currentCardState;

                  const updateCardState = (updates) => {
                    setCardStates((prev) => ({
                      ...prev,
                      [periodName]: { ...prev[periodName], ...updates },
                    }));
                  };

                  return (
                    <div
                      key={periodName}
                      style={getEnhancedCardStyle(isHovered, isFocused)}
                      onMouseEnter={() => updateCardState({ isHovered: true })}
                      onMouseLeave={() => updateCardState({ isHovered: false })}
                    >
                      {/* Card Header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "12px",
                        }}
                      >
                        <h5
                          style={{
                            color: isActive
                              ? "white"
                              : isBeingConfigured
                              ? "#e2e8f0"
                              : "#a0aec0",
                            margin: 0,
                            fontSize: "1.1em",
                            fontWeight: "bold",
                          }}
                        >
                          {periodName === "Daily"
                            ? "📅"
                            : periodName === "Weekly"
                            ? "📊"
                            : "📈"}{" "}
                          {periodName}
                        </h5>
                        {isActive && existingLimit && (
                          <span
                            style={{
                              fontSize: "0.8em",
                              padding: "4px 8px",
                              borderRadius: "12px",
                              backgroundColor: isAtLimit
                                ? "#e53e3e"
                                : isNearLimit
                                ? "#ed8936"
                                : "#48bb78",
                              color: "white",
                              fontWeight: "bold",
                            }}
                          >
                            {progressPercent.toFixed(0)}% used
                          </span>
                        )}
                      </div>

                      {/* Input or Display */}
                      {edit?.isEditing || !isActive ? (
                        <div style={{ marginBottom: "12px" }}>
                          <input
                            type="text"
                            placeholder={
                              isActive
                                ? "Update limit (USDT)"
                                : "Enter amount to activate"
                            }
                            value={edit?.value || ""}
                            onChange={(e) =>
                              updateLimitEdit(periodName, e.target.value)
                            }
                            onFocus={() => updateCardState({ isFocused: true })}
                            onBlur={() => updateCardState({ isFocused: false })}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "4px",
                              border: "1px solid #4a5568",
                              backgroundColor: "#4a5568",
                              color: "white",
                              fontSize: "1em",
                            }}
                          />
                        </div>
                      ) : (
                        existingLimit && (
                          <div style={{ marginBottom: "12px" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: "8px",
                              }}
                            >
                              <span
                                style={{ color: "#e2e8f0", fontSize: "0.9em" }}
                              >
                                Remaining
                              </span>
                              <span
                                style={{
                                  color: isAtLimit ? "#fc8181" : "#9ae6b4",
                                  fontWeight: "bold",
                                  fontSize: "1.1em",
                                }}
                              >
                                {existingLimit.remaining} USDT
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.8em",
                                color: "#a0aec0",
                                marginBottom: "8px",
                              }}
                            >
                              <span>Spent: {existingLimit.spent} USDT</span>
                              <span>Limit: {existingLimit.limit} USDT</span>
                            </div>
                            {/* Progress bar */}
                            <div
                              style={{
                                width: "100%",
                                height: "6px",
                                backgroundColor: "#4a5568",
                                borderRadius: "3px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(progressPercent, 100)}%`,
                                  height: "100%",
                                  backgroundColor: isAtLimit
                                    ? "#e53e3e"
                                    : isNearLimit
                                    ? "#ed8936"
                                    : "#48bb78",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                          </div>
                        )
                      )}

                      {/* Action Buttons */}
                      <div style={{ display: "flex", gap: "8px" }}>
                        {edit?.isEditing ? (
                          <>
                            {isSetupCommitted ? (
                              <button
                                onClick={() =>
                                  submitIndividualProposal(periodName)
                                }
                                style={{
                                  flex: 1,
                                  padding: "8px",
                                  borderRadius: "4px",
                                  border: "none",
                                  backgroundColor: "#ed8936",
                                  color: "white",
                                  cursor: "pointer",
                                  fontSize: "0.9em",
                                  fontWeight: "bold",
                                }}
                              >
                                📝 Submit Proposal
                              </button>
                            ) : (
                              <button
                                onClick={() => saveLimitChanges()}
                                style={{
                                  flex: 1,
                                  padding: "8px",
                                  borderRadius: "4px",
                                  border: "none",
                                  backgroundColor: "#48bb78",
                                  color: "white",
                                  cursor: "pointer",
                                  fontSize: "0.9em",
                                  fontWeight: "bold",
                                }}
                              >
                                💾 Save Changes
                              </button>
                            )}
                            <button
                              onClick={() => toggleEditMode(periodName)}
                              style={{
                                flex: 1,
                                padding: "8px",
                                borderRadius: "4px",
                                border: "1px solid #4a5568",
                                backgroundColor: "transparent",
                                color: "#e2e8f0",
                                cursor: "pointer",
                                fontSize: "0.9em",
                                minWidth: "70px",
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {isActive ? ( // Only show Edit/Remove buttons for existing limits from contract
                              <>
                                <button
                                  onClick={() => toggleEditMode(periodName)}
                                  style={{
                                    flex: 1,
                                    padding: "8px",
                                    borderRadius: "4px",
                                    border: "1px solid #4a5568",
                                    backgroundColor: "#2d3748",
                                    backgroundImage: "none",
                                    color: "#a0aec0",
                                    cursor: "pointer",
                                    fontSize: "0.85em",
                                    fontWeight: "normal",
                                    opacity: 0.7,
                                    transition: "all 0.2s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.opacity = "1";
                                    e.target.style.color = "#e2e8f0";
                                    e.target.style.borderColor = "#718096";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.opacity = "0.7";
                                    e.target.style.color = "#a0aec0";
                                    e.target.style.borderColor = "#4a5568";
                                  }}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  onClick={() => removeLimitPeriod(periodName)}
                                  style={{
                                    flex: 1,
                                    padding: "8px",
                                    borderRadius: "4px",
                                    border: "1px solid #4a5568",
                                    backgroundColor: "#2d3748",
                                    backgroundImage: "none",
                                    color: "#a0aec0",
                                    cursor: "pointer",
                                    fontSize: "0.85em",
                                    fontWeight: "normal",
                                    opacity: 0.7,
                                    transition: "all 0.2s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.opacity = "1";
                                    e.target.style.color = "#e2e8f0";
                                    e.target.style.borderColor = "#718096";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.opacity = "0.7";
                                    e.target.style.color = "#a0aec0";
                                    e.target.style.borderColor = "#4a5568";
                                  }}
                                >
                                  🗑️ Remove
                                </button>
                              </>
                            ) : (
                              <div
                                style={{
                                  color: "#a0aec0",
                                  fontSize: "0.9em",
                                  fontStyle: "italic",
                                  textAlign: "center",
                                  padding: "8px",
                                }}
                              >
                                Enter an amount above to activate this limit
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  fontSize: "0.8em",
                  color: "#a0aec0",
                  marginBottom: "15px",
                }}
              >
                💡 Tip: Daily × 7 ≤ Weekly, Weekly × 4 ≤ Monthly for logical
                budgeting
              </div>
            </div>

            {/* Custom Periods Section */}
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "15px",
                }}
              >
                <h4 style={{ color: "#fbb6ce", margin: 0 }}>
                  ⚙️ Custom Time Periods
                </h4>
                <button
                  onClick={() => setShowCustomPeriod(!showCustomPeriod)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "1px solid #4a5568",
                    backgroundColor: "transparent",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontSize: "0.9em",
                  }}
                >
                  {showCustomPeriod ? "➖ Hide" : "➕ Add"} Custom Period
                </button>
              </div>

              {/* Custom Periods List */}
              {spendingLimits.filter(
                (limit) => !["Daily", "Weekly", "Monthly"].includes(limit.name)
              ).length > 0 && (
                <div style={{ marginBottom: "15px" }}>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {spendingLimits
                      .filter(
                        (limit) =>
                          !["Daily", "Weekly", "Monthly"].includes(limit.name)
                      )
                      .map((limit, index) => {
                        const progressPercent =
                          limit.limit > 0
                            ? (parseFloat(limit.spent) /
                                parseFloat(limit.limit)) *
                              100
                            : 0;
                        const isNearLimit = progressPercent > 80;
                        const isAtLimit = progressPercent >= 100;

                        return (
                          <div
                            key={index}
                            style={{
                              padding: "12px",
                              border: isAtLimit
                                ? "1px solid #e53e3e"
                                : isNearLimit
                                ? "1px solid #ed8936"
                                : "1px solid #48bb78",
                              borderRadius: "6px",
                              backgroundColor: "#1a202c",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: "5px",
                                }}
                              >
                                <span
                                  style={{ color: "white", fontWeight: "bold" }}
                                >
                                  ⚙️ {limit.name}
                                </span>
                                <span
                                  style={{
                                    color: isAtLimit ? "#fc8181" : "#9ae6b4",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {limit.remaining} USDT remaining
                                </span>
                              </div>
                              <div
                                style={{ fontSize: "0.8em", color: "#a0aec0" }}
                              >
                                Duration:{" "}
                                {limit.durationDays > 0
                                  ? `${limit.durationDays} days`
                                  : `${limit.durationHours} hours`}{" "}
                                • Limit: {limit.limit} USDT • Spent:{" "}
                                {limit.spent} USDT
                              </div>
                            </div>
                            <button
                              onClick={() => removeLimitPeriod(limit.name)}
                              style={{
                                marginLeft: "10px",
                                padding: "6px 12px",
                                borderRadius: "4px",
                                border: "1px solid #e53e3e",
                                backgroundColor: "transparent",
                                color: "#e53e3e",
                                cursor: "pointer",
                                fontSize: "0.8em",
                              }}
                            >
                              🗑️ Remove
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Custom Period Form */}
              {showCustomPeriod && (
                <div
                  style={{
                    padding: "15px",
                    backgroundColor: "#1a202c",
                    borderRadius: "4px",
                    border: "1px solid #4a5568",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.8em",
                      color: "#a0aec0",
                      marginBottom: "15px",
                    }}
                  >
                    Create custom periods like "Salary Cycle", "Quarterly
                    Budget", or any duration you need.
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gap: "10px",
                      marginBottom: "15px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.9em",
                          color: "#e2e8f0",
                          marginBottom: "5px",
                        }}
                      >
                        Period Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 'Salary Cycle', 'Quarterly Budget'"
                        value={customPeriodName}
                        onChange={(e) => setCustomPeriodName(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #4a5568",
                          backgroundColor: "#4a5568",
                          color: "white",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.9em",
                            color: "#e2e8f0",
                            marginBottom: "5px",
                          }}
                        >
                          Limit (USDT)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., 2000"
                          value={customPeriodLimit}
                          onChange={(e) => setCustomPeriodLimit(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px",
                            borderRadius: "4px",
                            border: "1px solid #4a5568",
                            backgroundColor: "#4a5568",
                            color: "white",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.9em",
                            color: "#e2e8f0",
                            marginBottom: "5px",
                          }}
                        >
                          Duration
                        </label>
                        <select
                          value={customPeriodDuration}
                          onChange={(e) =>
                            setCustomPeriodDuration(e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "8px",
                            borderRadius: "4px",
                            border: "1px solid #4a5568",
                            backgroundColor: "#4a5568",
                            color: "white",
                          }}
                        >
                          <option value="3600">Per Hour</option>
                          <option value="86400">Per Day</option>
                          <option value="604800">Per Week</option>
                          <option value="1209600">Bi-weekly (14 days)</option>
                          <option value="2592000">Per Month (30 days)</option>
                          <option value="7776000">Per Quarter (90 days)</option>
                          <option value="15552000">
                            Semi-annual (180 days)
                          </option>
                          <option value="31536000">Per Year (365 days)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={addCustomPeriod}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "4px",
                      border: "none",
                      backgroundColor: "#ed64a6",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "0.9em",
                      fontWeight: "bold",
                      width: "100%",
                    }}
                  >
                    ⚙️ Add Custom Period
                  </button>
                </div>
              )}
            </div>

            {/* Pending Limit Proposals Section */}
            {pendingLimitProposals.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ color: "#ed8936", margin: "0 0 15px 0" }}>
                  ⏳ Pending Limit Changes ({pendingLimitProposals.length})
                </h4>
                <p
                  style={{
                    fontSize: "0.8em",
                    color: "#a0aec0",
                    marginBottom: "15px",
                  }}
                >
                  {networkType === "evm"
                    ? "These limit change proposals are waiting for the timelock period to expire before they can be executed."
                    : "These limit changes are waiting for the timelock period to expire before they can be applied."}
                </p>

                <div style={{ display: "grid", gap: "10px" }}>
                  {pendingLimitProposals.map((proposal, index) => {
                    const isReady =
                      proposal.executeAfter &&
                      currentTime >= proposal.executeAfter;

                    // Calculate real-time countdown
                    const timeRemaining = proposal.executeAfter
                      ? Math.max(0, proposal.executeAfter - currentTime)
                      : 0;
                    const countdownText = formatTimeRemaining(timeRemaining);

                    return (
                      <div
                        key={index}
                        style={{
                          padding: "12px",
                          border: isReady
                            ? "1px solid #48bb78"
                            : "1px solid #ed8936",
                          borderRadius: "6px",
                          backgroundColor: "#1a202c",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "5px",
                            }}
                          >
                            <span
                              style={{ color: "white", fontWeight: "bold" }}
                            >
                              📝{" "}
                              {proposal.action === "change"
                                ? "Update"
                                : "Remove"}{" "}
                              {proposal.periodName}
                            </span>
                            <span
                              style={{
                                fontSize: "0.8em",
                                padding: "4px 8px",
                                borderRadius: "12px",
                                backgroundColor: isReady
                                  ? "#48bb78"
                                  : "#ed8936",
                                color: "white",
                                fontWeight: "bold",
                              }}
                            >
                              {isReady ? "✅ Ready" : `⏰ ${countdownText}`}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8em", color: "#a0aec0" }}>
                            {proposal.action === "change" ? (
                              <>New Limit: {proposal.newLimit} USDT</>
                            ) : (
                              <>Action: Remove limit entirely</>
                            )}
                            {proposal.submittedAt && (
                              <>
                                {" "}
                                • Submitted:{" "}
                                {new Date(
                                  proposal.submittedAt
                                ).toLocaleString()}
                              </>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginLeft: "10px",
                          }}
                        >
                          {isReady && (
                            <button
                              onClick={() => executeProposal(proposal)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "4px",
                                border: "none",
                                backgroundColor: "#48bb78",
                                color: "white",
                                cursor: "pointer",
                                fontSize: "0.8em",
                                fontWeight: "bold",
                              }}
                            >
                              ⚡ Execute
                            </button>
                          )}
                          <button
                            onClick={() => cancelProposal(proposal)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "4px",
                              border: "1px solid #e53e3e",
                              backgroundColor: "transparent",
                              color: "#e53e3e",
                              cursor: "pointer",
                              fontSize: "0.8em",
                            }}
                          >
                            ❌ Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    marginTop: "15px",
                    fontSize: "0.8em",
                    color: "#a0aec0",
                  }}
                >
                  💡 Proposals become executable after the timelock period for
                  security. Execute them when ready.
                </div>
              </div>
            )}

            {/* Step 2: Withdrawal Addresses Management */}
            <div
              style={{
                marginBottom: "20px",
                padding: "20px",
                border: !isSetupCommitted
                  ? "3px solid #d69e2e" // Always active during setup
                  : "2px solid #333",
                borderRadius: "8px",
                backgroundColor: "#2d3748",
                color: "white",
                boxShadow: !isSetupCommitted
                  ? "0 0 0 1px rgba(214, 158, 46, 0.3)" // Always active during setup
                  : "none",
                position: "relative",
                opacity: 1, // Always fully visible
              }}
            >
              {/* Step Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "15px",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <h3
                    style={{
                      color: !isSetupCommitted ? "#f6ad55" : "white", // Always active during setup
                      margin: 0,
                      fontSize: "1.3em",
                      fontWeight: "600",
                    }}
                  >
                    🔑 Step 2: Add Withdrawal Addresses
                  </h3>
{/* Status label removed - Step 2 always active */}
                </div>

                {!isSetupCommitted &&
                  stepValidation.step2Complete &&
                  currentStep === 2 && (
                    <button
                      onClick={goToNextStep}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "6px",
                        border: "1px solid #3182ce",
                        backgroundColor: "#3182ce",
                        color: "white",
                        cursor: "pointer",
                        fontSize: "0.9em",
                        fontWeight: "600",
                        transition: "all 0.2s ease",
                      }}
                      onMouseOver={(e) => {
                        e.target.style.backgroundColor = "#2c5aa0";
                      }}
                      onMouseOut={(e) => {
                        e.target.style.backgroundColor = "#3182ce";
                      }}
                    >
                      Proceed to Lock-In →
                    </button>
                  )}
              </div>

              {/* Step Description */}
              <p
                style={{
                  fontSize: "0.9em",
                  color: "#cbd5e0",
                  marginBottom: "15px",
                  lineHeight: "1.5",
                }}
              >
                {isSetupCommitted
                  ? "Manage your approved withdrawal addresses. New addresses require 24-48 hour approval after wallet is locked."
                  : "Add addresses where you'll be able to withdraw funds. After lock-in, new addresses will require 24-48 hour approval for security."}
              </p>

              {/* Progress Tips for Setup Mode */}
              {!isSetupCommitted && currentStep === 2 && (
                <div
                  style={{
                    fontSize: "0.8em",
                    color: "#a0aec0",
                    backgroundColor: "#1a202c",
                    padding: "10px",
                    borderRadius: "4px",
                    marginBottom: "15px",
                    borderLeft: "3px solid #f6ad55",
                  }}
                >
                  💡 <strong>Tip:</strong> "My Wallet" is automatically added.
                  Add other addresses you'll withdraw to (exchanges, hardware
                  wallets, etc.).
                </div>
              )}

              {/* Step 2 Address Management Component */}
              {!isSetupCommitted && (
                <div>
                  <WithdrawalAddressSelector
                    mode="management"
                    title="Your Withdrawal Addresses:"
                  />

                  {/* Add New Withdrawal Address Form */}
                  {showWithdrawalAddressForm && (
                    <div
                      style={{
                        padding: "15px",
                        backgroundColor: "#1a202c",
                        borderRadius: "6px",
                        border: "1px solid #4a5568",
                        marginTop: "15px",
                      }}
                    >
                      <h5 style={{ color: "#f6ad55", margin: "0 0 15px 0" }}>
                        📍 Add New Withdrawal Address
                      </h5>

                      <div
                        style={{
                          display: "grid",
                          gap: "12px",
                          marginBottom: "15px",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.9em",
                              color: "#e2e8f0",
                              marginBottom: "5px",
                            }}
                          >
                            Address Title
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., 'Hardware Wallet', 'Exchange Account'"
                            value={newWithdrawalTitle}
                            onChange={(e) =>
                              setNewWithdrawalTitle(e.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "4px",
                              border: "1px solid #4a5568",
                              backgroundColor: "#4a5568",
                              color: "white",
                              fontSize: "0.9em",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.9em",
                              color: "#e2e8f0",
                              marginBottom: "5px",
                            }}
                          >
                            {networkType === "solana"
                              ? "Solana Address"
                              : "Ethereum Address"}
                          </label>
                          <input
                            type="text"
                            placeholder={
                              networkType === "solana"
                                ? "Solana address..."
                                : "0x..."
                            }
                            value={newWithdrawalAddress}
                            onChange={(e) =>
                              setNewWithdrawalAddress(e.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "4px",
                              border: "1px solid #4a5568",
                              backgroundColor: "#4a5568",
                              color: "white",
                              fontFamily: "monospace",
                              fontSize: "0.9em",
                            }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={requestWithdrawalAddress}
                        disabled={
                          !newWithdrawalTitle.trim() ||
                          !newWithdrawalAddress.trim()
                        }
                        style={{
                          padding: "10px 20px",
                          borderRadius: "4px",
                          border: "none",
                          backgroundColor:
                            !newWithdrawalTitle.trim() ||
                            !newWithdrawalAddress.trim()
                              ? "#4a5568"
                              : "#ed8936",
                          color: "white",
                          cursor:
                            !newWithdrawalTitle.trim() ||
                            !newWithdrawalAddress.trim()
                              ? "not-allowed"
                              : "pointer",
                          fontSize: "0.9em",
                          fontWeight: "bold",
                          width: "100%",
                          opacity:
                            !newWithdrawalTitle.trim() ||
                            !newWithdrawalAddress.trim()
                              ? 0.5
                              : 1,
                        }}
                      >
                        📍 Add Withdrawal Address
                      </button>
                    </div>
                  )}

                  {/* Pending Withdrawal Address Requests */}
                  {pendingWithdrawalRequests.length > 0 && (
                    <div style={{ marginTop: "15px" }}>
                      <h5 style={{ color: "#ed8936", margin: "0 0 10px 0" }}>
                        ⏳ Pending New Addresses (
                        {pendingWithdrawalRequests.length})
                      </h5>
                      <div style={{ display: "grid", gap: "8px" }}>
                        {pendingWithdrawalRequests.map((request, index) => (
                          <div
                            key={index}
                            style={{
                              padding: "10px",
                              backgroundColor: "#2a1810",
                              borderRadius: "6px",
                              border: "1px solid #ed8936",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <div
                                  style={{ color: "white", fontWeight: "bold" }}
                                >
                                  📍 {request.title}
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.8em",
                                    color: "#a0aec0",
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {request.destination.length > 50
                                    ? `${request.destination.slice(
                                        0,
                                        25
                                      )}...${request.destination.slice(-15)}`
                                    : request.destination}
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.7em",
                                    color: "#ed8936",
                                    marginTop: "4px",
                                  }}
                                >
                                  ⏰ Will be available after setup is locked
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Lock In Your Wallet */}
            <div
              style={{
                marginBottom: "20px",
                padding: "20px",
                border:
                  !isSetupCommitted && currentStep === 3
                    ? "3px solid #d69e2e" // Highlighted border for active step
                    : stepValidation.step1Complete
                    ? "2px solid #48bb78"
                    : "2px solid #333",
                borderRadius: "8px",
                backgroundColor: "#2d3748",
                color: "white",
                boxShadow:
                  !isSetupCommitted && currentStep === 3
                    ? "0 0 0 1px rgba(214, 158, 46, 0.3)"
                    : "none",
              }}
            >
              <h3
                style={{
                  color: "#48bb78",
                  margin: "0 0 15px 0",
                  fontSize: "1.4em",
                  fontWeight: "600",
                }}
              >
                🧩 Step 3: Lock In Your Wallet
              </h3>

              <p
                style={{
                  fontSize: "0.9em",
                  color: "#cbd5e0",
                  marginBottom: "15px",
                  lineHeight: "1.5",
                }}
              >
                {isSetupCommitted
                  ? "Your wallet is locked and all security features are active."
                  : "Ready to activate your wallet security? This will enable all spending limits and withdrawal controls."}
              </p>

              {!isSetupCommitted ? (
                <div>
                  <div
                    style={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid #ed8936",
                      borderRadius: "6px",
                      padding: "12px",
                      marginBottom: "15px",
                    }}
                  >
                    <h5
                      style={{
                        color: stepValidation.step1Complete
                          ? "#9ae6b4"
                          : "#ed8936",
                        margin: "0 0 10px 0",
                      }}
                    >
                      📝 Prerequisites
                    </h5>
                    <div style={{ fontSize: "0.85em", color: "#a0aec0" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: stepValidation.step1Complete
                            ? "#9ae6b4"
                            : "#fc8181",
                        }}
                      >
                        {stepValidation.step1Complete ? "✅" : "❌"}
                        Set at least one spending limit
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <button
                      onClick={commitSetup}
                      disabled={!stepValidation.step1Complete}
                      style={{
                        padding: "15px 30px",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: stepValidation.step1Complete
                          ? "#48bb78"
                          : "#4a5568",
                        color: "white",
                        cursor: stepValidation.step1Complete
                          ? "pointer"
                          : "not-allowed",
                        fontSize: "1.1em",
                        fontWeight: "bold",
                        transition: "all 0.2s ease",
                        opacity: stepValidation.step1Complete ? 1 : 0.5,
                        boxShadow: stepValidation.step1Complete
                          ? "0 4px 12px rgba(72, 187, 120, 0.4)"
                          : "none",
                      }}
                    >
                      🔒 Lock In My Wallet
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "20px",
                    backgroundColor: "#1a365d",
                    borderRadius: "8px",
                    border: "2px solid #48bb78",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "3em", marginBottom: "10px" }}>
                    🛡️
                  </div>
                  <h3 style={{ color: "#9ae6b4", margin: "0 0 10px 0" }}>
                    Wallet Secured
                  </h3>
                  <p
                    style={{
                      color: "#e2e8f0",
                      margin: 0,
                      fontSize: "0.9em",
                      lineHeight: "1.5",
                    }}
                  >
                    Your spending limits are active and withdrawal controls are
                    enforced. All security features are now protecting your
                    funds.
                  </p>
                </div>
              )}
            </div>

            {/* Enhanced Withdrawal Section - Hidden during setup mode */}
            {isSetupCommitted && (
              <div
                style={{
                  marginBottom: "20px",
                  padding: "15px",
                  border: "1px solid #333",
                  borderRadius: "5px",
                  backgroundColor: "#2d3748",
                  color: "white",
                  position: "relative",
                }}
              >
                <h3 style={{ color: "white" }}>💸 Withdraw Funds</h3>
                <p
                  style={{
                    fontSize: "0.9em",
                    color: "#cbd5e0",
                    marginBottom: "15px",
                  }}
                >
                  Withdrawals are automatically checked against all your active
                  spending limits. You can withdraw to your own wallet or to
                  approved withdrawal addresses.
                </p>

                {/* Token and Amount Selection */}
                <div style={{ marginBottom: "15px" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginBottom: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <select
                      value={selectedToken}
                      onChange={(e) => setSelectedToken(e.target.value)}
                      style={{
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #4a5568",
                        backgroundColor: "#4a5568",
                        color: "white",
                        flex: "1",
                        minWidth: "120px",
                      }}
                    >
                      <option value="ETH">ETH</option>
                      {Object.entries(getCurrentNetwork(selectedNetwork).tokens)
                        .filter(
                          ([_, token]) =>
                            token.address !==
                            "0x0000000000000000000000000000000000000000"
                        )
                        .map(([key, token]) => (
                          <option key={key} value={key}>
                            {token.symbol}
                          </option>
                        ))}
                    </select>

                    <input
                      type="text"
                      placeholder={`Amount (${selectedToken})`}
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      style={{
                        flex: "2",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #4a5568",
                        backgroundColor: "#4a5568",
                        color: "white",
                        minWidth: "150px",
                      }}
                    />
                  </div>
                </div>

                {/* Instant Withdrawal Information */}
                <div
                  style={{
                    marginBottom: "15px",
                    padding: "10px",
                    backgroundColor: "#1a202c",
                    borderRadius: "4px",
                    border: "1px solid #4a5568",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "5px",
                    }}
                  >
                    <span style={{ fontSize: "0.9em", color: "#cbd5e0" }}>
                      💡 Instant Withdrawable:
                    </span>
                    <span style={{ fontWeight: "bold", color: "#48bb78" }}>
                      {(typeof instantWithdrawableAmount === "number"
                        ? instantWithdrawableAmount
                        : 0
                      ).toFixed(2)}{" "}
                      {selectedToken}
                    </span>
                  </div>
                  {limitingPeriod && (
                    <div style={{ fontSize: "0.8em", color: "#a0aec0" }}>
                      Limited by: {limitingPeriod} spending limit
                    </div>
                  )}
                  {withdrawalAmount &&
                    exceedsInstantLimit &&
                    exceedingPeriod && (
                      <div
                        style={{
                          marginTop: "8px",
                          padding: "8px",
                          backgroundColor: "#2d3748",
                          borderRadius: "4px",
                          border: "1px solid #ed8936",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.85em",
                            color: "#ed8936",
                            fontWeight: "bold",
                          }}
                        >
                          ⚠️ Amount exceeds {exceedingPeriod} limit
                        </div>
                        <div
                          style={{
                            fontSize: "0.8em",
                            color: "#a0aec0",
                            marginTop: "2px",
                          }}
                        >
                          This withdrawal will require a 24-hour approval period
                        </div>
                      </div>
                    )}
                </div>

                {/* Destination Selection as Radio Buttons */}
                <WithdrawalAddressSelector
                  mode="selection"
                  selectedDestination={selectedWithdrawalDestination}
                  onDestinationChange={setSelectedWithdrawalDestination}
                  showAddButton={false}
                  title="Withdraw To:"
                />

                {/* Dynamic Withdrawal Buttons */}
                <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                  {!exceedsInstantLimit ? (
                    <button
                      onClick={withdrawToDestination}
                      disabled={
                        !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                      }
                      style={{
                        padding: "12px 24px",
                        borderRadius: "4px",
                        border: "none",
                        backgroundColor:
                          !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                            ? "#4a5568"
                            : "#48bb78",
                        color: "white",
                        cursor:
                          !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                            ? "not-allowed"
                            : "pointer",
                        fontWeight: "bold",
                        flex: "1",
                        fontSize: "1em",
                        opacity:
                          !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                            ? 0.5
                            : 1,
                      }}
                    >
                      ⚡ Instant Withdraw {selectedToken}
                    </button>
                  ) : (
                    <>
                      <button
                        disabled={true}
                        style={{
                          padding: "12px 24px",
                          borderRadius: "4px",
                          border: "none",
                          backgroundColor: "#4a5568",
                          color: "#a0aec0",
                          cursor: "not-allowed",
                          fontWeight: "bold",
                          flex: "1",
                          fontSize: "1em",
                          opacity: 0.5,
                        }}
                      >
                        ⚡ Instant Withdraw
                      </button>
                      <button
                        onClick={() => requestBypassForWithdrawal()}
                        disabled={
                          !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                        }
                        style={{
                          padding: "12px 24px",
                          borderRadius: "4px",
                          border: "none",
                          backgroundColor:
                            !withdrawalAmount ||
                            parseFloat(withdrawalAmount) <= 0
                              ? "#4a5568"
                              : "#ed8936",
                          color: "white",
                          cursor:
                            !withdrawalAmount ||
                            parseFloat(withdrawalAmount) <= 0
                              ? "not-allowed"
                              : "pointer",
                          fontWeight: "bold",
                          flex: "1",
                          fontSize: "0.9em",
                          opacity:
                            !withdrawalAmount ||
                            parseFloat(withdrawalAmount) <= 0
                              ? 0.5
                              : 1,
                        }}
                      >
                        🕐 Request Above {exceedingPeriod} Limit
                      </button>
                    </>
                  )}
                </div>

                {/* Add New Withdrawal Address Form */}
                {showWithdrawalAddressForm && (
                  <div
                    style={{
                      marginTop: "15px",
                      paddingTop: "15px",
                      borderTop: "1px solid #4a5568",
                    }}
                  >
                    <div
                      style={{
                        padding: "15px",
                        backgroundColor: "#1a202c",
                        borderRadius: "4px",
                        border: "1px solid #4a5568",
                        marginBottom: "15px",
                      }}
                    >
                      <h5 style={{ color: "#fbb6ce", margin: "0 0 15px 0" }}>
                        📍 Add New Withdrawal Address
                      </h5>
                      <p
                        style={{
                          fontSize: "0.8em",
                          color: "#a0aec0",
                          marginBottom: "15px",
                        }}
                      >
                        Withdrawal addresses require a 24-hour approval period
                        for security.
                      </p>

                      <div
                        style={{
                          display: "grid",
                          gap: "10px",
                          marginBottom: "15px",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.9em",
                              color: "#e2e8f0",
                              marginBottom: "5px",
                            }}
                          >
                            Address Title
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., 'Hardware Wallet', 'Exchange Account'"
                            value={newWithdrawalTitle}
                            onChange={(e) =>
                              setNewWithdrawalTitle(e.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "4px",
                              border: "1px solid #4a5568",
                              backgroundColor: "#4a5568",
                              color: "white",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.9em",
                              color: "#e2e8f0",
                              marginBottom: "5px",
                            }}
                          >
                            Ethereum Address
                          </label>
                          <input
                            type="text"
                            placeholder="0x..."
                            value={newWithdrawalAddress}
                            onChange={(e) =>
                              setNewWithdrawalAddress(e.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "4px",
                              border: "1px solid #4a5568",
                              backgroundColor: "#4a5568",
                              color: "white",
                              fontFamily: "monospace",
                            }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={requestWithdrawalAddress}
                        style={{
                          padding: "10px 20px",
                          borderRadius: "4px",
                          border: "none",
                          backgroundColor: "#ed64a6",
                          color: "white",
                          cursor: "pointer",
                          fontSize: "0.9em",
                          fontWeight: "bold",
                          width: "100%",
                        }}
                      >
                        📍 Request Withdrawal Address
                      </button>
                    </div>
                  </div>
                )}

                {/* Pending Withdrawal Address Requests */}
                {pendingWithdrawalRequests.length > 0 && (
                  <div
                    style={{
                      marginTop: "15px",
                      paddingTop: "15px",
                      borderTop: "1px solid #4a5568",
                    }}
                  >
                    <div>
                      <h5 style={{ color: "#ed8936", margin: "0 0 10px 0" }}>
                        ⏳ Pending Requests ({pendingWithdrawalRequests.length})
                      </h5>
                      <div style={{ display: "grid", gap: "8px" }}>
                        {pendingWithdrawalRequests.map((request, index) => {
                          const countdown = formatCountdown(
                            request.executeAfter,
                            currentTime
                          );
                          return (
                            <div
                              key={index}
                              style={{
                                padding: "10px",
                                backgroundColor: "#1a202c",
                                borderRadius: "6px",
                                border: countdown.ready
                                  ? "1px solid #48bb78"
                                  : "1px solid #ed8936",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: "8px",
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      color: "white",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    📍 {request.title}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "0.8em",
                                      color: "#a0aec0",
                                      fontFamily: "monospace",
                                    }}
                                  >
                                    {request.destination}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  {countdown.ready && (
                                    <button
                                      onClick={() =>
                                        executeWithdrawalRequest(
                                          request.requestId
                                        )
                                      }
                                      style={{
                                        padding: "4px 8px",
                                        borderRadius: "4px",
                                        border: "none",
                                        backgroundColor: "#48bb78",
                                        color: "white",
                                        cursor: "pointer",
                                        fontSize: "0.7em",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      ⚡ Execute
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      cancelWithdrawalRequest(request.requestId)
                                    }
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: "4px",
                                      border: "1px solid #e53e3e",
                                      backgroundColor: "transparent",
                                      color: "#e53e3e",
                                      cursor: "pointer",
                                      fontSize: "0.7em",
                                    }}
                                  >
                                    ❌ Cancel
                                  </button>
                                </div>
                              </div>
                              <div
                                style={{
                                  padding: "6px 10px",
                                  backgroundColor: "#4a5568",
                                  borderRadius: "4px",
                                  textAlign: "center",
                                  color: countdown.color,
                                  fontWeight: "bold",
                                  fontSize: "0.8em",
                                }}
                              >
                                {countdown.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Add Approver Section - Only shown after setup is committed */}
            {isSetupCommitted && (
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
        </div>
      )}
    </div>
  );
}

// Wrapped App component with Solana wallet provider
function App() {
  return (
    <SolanaWalletProvider networkType="evm" selectedNetwork="localhost">
      <AppContent />
    </SolanaWalletProvider>
  );
}

export default App;
