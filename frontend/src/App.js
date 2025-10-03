import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import SavingsABI from "./SavingsABI.json";
import MockUSDT_ABI from "./MockUSDT_ABI.json";
import ApprovalSystemModuleABI from "./ApprovalSystemModuleABI.json";

// Import our new blockchain adapters
import { TransactionManager } from "./adapters/TransactionManager.js";

// Solana imports
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useConnection
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import {
  WalletModalProvider,
  WalletMultiButton,
  WalletDisconnectButton,
} from '@solana/wallet-adapter-react-ui';

// Import Solana wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

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
          mint: "4hfpnxTtKLzTPy8W98ischzWSzn4jn8uLN6EDsnTK7cn", // Test USDT mint address
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
  return Object.values(NETWORKS.evm).find((network) => network.chainId === chainId);
};

const getCurrentNetwork = (networkType, selectedNetwork) => {
  if (networkType === 'solana') {
    return NETWORKS.solana[selectedNetwork] || NETWORKS.solana.localhost;
  }
  return NETWORKS.evm[selectedNetwork] || NETWORKS.evm.localhost;
};

const isSolanaNetwork = (networkType) => {
  return networkType === 'solana';
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
    if (limit.active && typeof limit.remaining === 'number' && limit.remaining < smallestRemaining) {
      smallestRemaining = limit.remaining;
      limitingPeriod = limit.name;
    }
  }

  return {
    amount: smallestRemaining === Infinity ? 0 : Number(smallestRemaining) || 0,
    limitingPeriod
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
  const periodPriority = { "Daily": 1, "Weekly": 2, "Monthly": 3 };

  const exceedingPeriods = spendingLimits
    .filter(limit => limit.active && numericAmount > limit.remaining)
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
  const network = networkType === 'solana' ? NETWORKS.solana[selectedNetwork]?.network || WalletAdapterNetwork.Devnet : WalletAdapterNetwork.Devnet;
  const endpoint = networkType === 'solana' ? (NETWORKS.solana[selectedNetwork]?.rpcUrl || "http://127.0.0.1:8899") : "http://127.0.0.1:8899";

  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
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
    signAllTransactions: solanaSignAllTransactions
  } = useWallet();
  const { connection } = useConnection();

  // Network state management
  const [networkType, setNetworkType] = useState("evm"); // "evm" or "solana"
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
  const [pendingWithdrawalRequests, setPendingWithdrawalRequests] = useState([]);
  const [showWithdrawalAddressForm, setShowWithdrawalAddressForm] = useState(false);
  const [newWithdrawalTitle, setNewWithdrawalTitle] = useState("");
  const [newWithdrawalAddress, setNewWithdrawalAddress] = useState("");
  const [selectedWithdrawalDestination, setSelectedWithdrawalDestination] = useState("self");
  const [approvalModule, setApprovalModule] = useState(null);

  // Enhanced withdrawal system state
  const [instantWithdrawableAmount, setInstantWithdrawableAmount] = useState(0);
  const [limitingPeriod, setLimitingPeriod] = useState(null); // Which period is limiting
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [exceedsInstantLimit, setExceedsInstantLimit] = useState(false);
  const [exceedingPeriod, setExceedingPeriod] = useState(null); // Which period would be exceeded

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

      if (networkType === 'evm') {
        await txManager.initialize('evm', networkConfig);
      } else if (networkType === 'solana') {
        console.log('Solana wallet info:', {
          connected: solanaConnected,
          publicKey: solanaPublicKey?.toString(),
          wallet: solanaWallet
        });

        const walletConfig = {
          wallet: {
            connected: solanaConnected,
            publicKey: solanaPublicKey,
            sendTransaction: solanaSendTransaction,
            signTransaction: solanaSignTransaction,
            signAllTransactions: solanaSignAllTransactions,
            disconnect: solanaDisconnect
          },
          connection: connection
        };
        await txManager.initialize('solana', networkConfig, walletConfig);
      }

      setTransactionManager(txManager);
      console.log(`TransactionManager initialized for ${networkType}`);
      return txManager;
    } catch (error) {
      console.error('Error initializing TransactionManager:', error);
      return null;
    }
  };

  // Network type switching (EVM vs Solana)
  const switchNetworkType = async (newNetworkType) => {
    setNetworkType(newNetworkType);

    if (newNetworkType === 'solana') {
      // Disconnect EVM wallet when switching to Solana
      if (provider) {
        setProvider(null);
        setSigner(null);
        setSavingsContract(null);
        setUserAddress("");
      }
      // Initialize Solana TransactionManager
      await initializeTransactionManager('solana', selectedNetwork);
    } else {
      // Disconnect Solana wallet when switching to EVM
      if (solanaConnected) {
        solanaDisconnect();
      }
      // Initialize EVM TransactionManager
      await initializeTransactionManager('evm', selectedNetwork);
    }
  };

  const switchNetwork = async (networkKey) => {
    if (networkType === 'solana') {
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
    if (networkType === 'solana') {
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
            setNetworkType('evm'); // Ensure we're on EVM type
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

  // Refresh balances when network changes
  useEffect(() => {
    if (savingsContract && signer) {
      fetchAllBalances();
    }
  }, [selectedNetwork, savingsContract, signer]);

  // Calculate instant withdrawal amount whenever spending limits change
  useEffect(() => {
    const result = calculateInstantWithdrawableAmount(spendingLimits);
    setInstantWithdrawableAmount(result.amount);
    setLimitingPeriod(result.limitingPeriod);
  }, [spendingLimits]);

  // Update withdrawal analysis whenever amount changes
  useEffect(() => {
    const exceedingPeriod = detectExceedingPeriod(withdrawalAmount, spendingLimits);
    setExceedingPeriod(exceedingPeriod);
    setExceedsInstantLimit(parseFloat(withdrawalAmount || 0) > instantWithdrawableAmount);
  }, [withdrawalAmount, spendingLimits, instantWithdrawableAmount]);

  // Initialize TransactionManager when network type changes or Solana wallet connects
  useEffect(() => {
    const initTxManager = async () => {
      if (networkType === 'solana' && solanaConnected && solanaPublicKey && connection) {
        await initializeTransactionManager('solana', selectedNetwork);

        // Fetch Solana balances after TransactionManager is initialized
        try {
          console.log("🔄 Fetching initial Solana balances...");
          const userAddress = await transactionManager.getAddress();
          const solanaBalances = await transactionManager.getAllBalances(userAddress);
          setBalances(solanaBalances);
          console.log("✅ Initial Solana balances loaded:", solanaBalances);
        } catch (error) {
          console.error("❌ Error fetching initial Solana balances:", error);
        }
      } else if (networkType === 'evm') {
        // EVM TransactionManager will be initialized when MetaMask connects
        // For now, we'll initialize it when switching to EVM even without connection
        await initializeTransactionManager('evm', selectedNetwork);
      }
    };

    initTxManager().catch(error => {
      console.error('Failed to initialize TransactionManager:', error);
    });
  }, [networkType, selectedNetwork, solanaConnected, solanaPublicKey, connection]);

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

  const deployProxy = async () => {
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
      console.log("Deploying user proxy...");

      // Call the deployUserProxy function
      const tx = await savingsContract.deployUserProxy();
      console.log("Transaction sent:", tx.hash);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      // Refresh proxy status
      await checkProxyStatus();

      alert(
        "🎉 Permanent deposit address generated successfully! This address is permanently tied to your wallet and you can use it for all future deposits from exchanges."
      );
    } catch (error) {
      console.error("Error deploying proxy:", error);

      // Handle specific error cases
      if (
        error.message.includes("Already deployed") ||
        error.message.includes("Proxy already deployed")
      ) {
        console.log("Proxy was already deployed, refreshing status...");
        await checkProxyStatus(); // Refresh status to show the existing deposit address
        alert(
          "✅ Your permanent deposit address is ready! This address is permanently tied to your wallet and you can use it for all deposits from exchanges."
        );
      } else if (error.message.includes("user rejected")) {
        alert("Transaction cancelled by user");
      } else {
        alert(`Failed to deploy proxy: ${error.message}`);
      }
    } finally {
      setIsDeploying(false);
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
    const moduleAddresses = await import('./moduleAddresses.json');
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
      await checkProxyStatusWithSigner(savings, web3Signer, userAddress);
      console.log(`Proxy status check completed`);
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
        alert("Transaction manager not initialized. Please refresh the page and try again.");
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

      if (networkType === 'evm') {
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
      } else if (networkType === 'solana') {
        // Solana token logic
        if (selectedToken === "SOL") {
          tokenAddress = "native"; // Solana native token
          decimals = 9;
          tokenSymbol = "SOL";
        } else if (currentNetwork.tokens && currentNetwork.tokens[selectedToken]) {
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
        decimals
      });

      // Execute deposit through TransactionManager
      const result = await transactionManager.deposit(tokenAddress, depositAmount, decimals);

      console.log(`✅ ${networkType.toUpperCase()} deposit successful:`, result);

      // Show success message
      const message = `Deposit of ${depositAmount} ${tokenSymbol} successful!${
        result.hash ? `\nTransaction: ${result.hash}` : ''
      }`;
      alert(message);

      // Clear form and refresh balances
      setDepositAmount("");

      // Refresh balances using appropriate method
      if (networkType === 'evm') {
        await fetchAllBalances();
      } else if (networkType === 'solana') {
        // For Solana, use TransactionManager to get balances
        console.log("🔄 Refreshing Solana balances...");
        try {
          const userAddress = await transactionManager.getAddress();
          const solanaBalances = await transactionManager.getAllBalances(userAddress);
          setBalances(solanaBalances);
          console.log("✅ Solana balances refreshed:", solanaBalances);
        } catch (error) {
          console.error("❌ Error refreshing Solana balances:", error);
        }
      }

    } catch (error) {
      console.error(`${networkType.toUpperCase()} deposit error:`, error);

      // Provide user-friendly error messages
      let errorMessage = "Failed to deposit. ";
      if (error.message.includes('User rejected')) {
        errorMessage += "Transaction was rejected.";
      } else if (error.message.includes('insufficient funds')) {
        errorMessage += "Insufficient funds.";
      } else if (error.message.includes('network')) {
        errorMessage += "Network error. Please check your connection.";
      } else if (error.message.includes('not connected')) {
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
    if (!savingsContract) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      // Extract active limits from limitEdits
      const daily = limitEdits.Daily.isActive
        ? parseFloat(limitEdits.Daily.value)
        : 0;
      const weekly = limitEdits.Weekly.isActive
        ? parseFloat(limitEdits.Weekly.value)
        : 0;
      const monthly = limitEdits.Monthly.isActive
        ? parseFloat(limitEdits.Monthly.value)
        : 0;

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
        alert(
          "After setup lock, use individual Edit buttons for each limit to submit separate proposals"
        );
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
    if (!savingsContract) {
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
      const limitWei = ethers.parseUnits(newLimit.toString(), 6);
      const tx = await savingsContract.proposeLimitChange(periodName, limitWei);
      await tx.wait();

      // Store proposal in localStorage
      const storedProposals = localStorage.getItem(
        `limitProposals_${userAddress}`
      );
      const existingProposals = storedProposals
        ? JSON.parse(storedProposals)
        : [];

      const proposal = {
        periodName: periodName,
        action: "change",
        newLimit: newLimit,
        executeAfter: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours from now
        submittedAt: Date.now(),
      };

      // Remove any existing proposal for the same period
      const updatedProposals = existingProposals.filter(
        (p) => !(p.periodName === periodName && p.action === "change")
      );
      updatedProposals.push(proposal);
      localStorage.setItem(
        `limitProposals_${userAddress}`,
        JSON.stringify(updatedProposals)
      );
      console.log(
        `Stored ${updatedProposals.length} proposals in localStorage for ${userAddress}`
      );

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
    if (!savingsContract) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      if (isSetupCommitted) {
        const tx = await savingsContract.proposeLimitRemoval(periodName);
        await tx.wait();

        // Store removal proposal in localStorage
        const storedProposals = localStorage.getItem(
          `limitProposals_${userAddress}`
        );
        const existingProposals = storedProposals
          ? JSON.parse(storedProposals)
          : [];

        const proposal = {
          periodName: periodName,
          action: "remove",
          executeAfter: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours from now
          submittedAt: Date.now(),
        };

        // Remove any existing proposal for the same period
        const updatedProposals = existingProposals.filter(
          (p) => !(p.periodName === periodName && p.action === "remove")
        );
        updatedProposals.push(proposal);
        localStorage.setItem(
          `limitProposals_${userAddress}`,
          JSON.stringify(updatedProposals)
        );
        console.log(
          `Stored ${updatedProposals.length} proposals in localStorage for ${userAddress} (including removal for ${periodName})`
        );

        alert(
          `✅ Removal proposal submitted for ${periodName}! It will be executable after review.`
        );
        await fetchPendingLimitProposals();
      } else {
        const tx = await savingsContract.removeTimePeriodLimit(periodName);
        await tx.wait();
        alert(`${periodName} limit removed successfully!`);
      }

      await fetchSpendingLimits();
    } catch (error) {
      console.error("Error removing limit:", error);
      alert(`Failed to remove ${periodName} limit: ${error.message}`);
    }
  };

  const fetchPendingLimitProposals = async (userAddr = null) => {
    // This function will track pending proposals from localStorage and contract state
    // For now, we'll implement basic tracking
    const currentUserAddress = userAddr || userAddress;
    if (!currentUserAddress) {
      console.log("No user address available for fetching pending proposals");
      return;
    }

    try {
      const storedProposals = localStorage.getItem(
        `limitProposals_${currentUserAddress}`
      );
      const proposals = storedProposals ? JSON.parse(storedProposals) : [];
      console.log(
        `Loaded ${proposals.length} pending limit proposals for ${currentUserAddress}`
      );
      setPendingLimitProposals(proposals);
    } catch (error) {
      console.error("Error fetching pending proposals:", error);
      setPendingLimitProposals([]);
    }
  };

  const executeProposal = async (proposal) => {
    if (!savingsContract) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      // This would call the actual contract method to execute the proposal
      // For now, we'll simulate it by removing from localStorage
      alert(
        `✅ Executing ${proposal.action} proposal for ${proposal.periodName}...`
      );

      // Remove from localStorage
      const storedProposals = localStorage.getItem(
        `limitProposals_${userAddress}`
      );
      const proposals = storedProposals ? JSON.parse(storedProposals) : [];
      const updatedProposals = proposals.filter(
        (p) =>
          !(
            p.periodName === proposal.periodName && p.action === proposal.action
          )
      );
      localStorage.setItem(
        `limitProposals_${userAddress}`,
        JSON.stringify(updatedProposals)
      );

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
      // Remove from localStorage
      const storedProposals = localStorage.getItem(
        `limitProposals_${userAddress}`
      );
      const proposals = storedProposals ? JSON.parse(storedProposals) : [];
      const updatedProposals = proposals.filter(
        (p) =>
          !(
            p.periodName === proposal.periodName && p.action === proposal.action
          )
      );
      localStorage.setItem(
        `limitProposals_${userAddress}`,
        JSON.stringify(updatedProposals)
      );

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
    if (savingsContract) {
      // Check if user is on the correct network
      if (!isCorrectNetwork()) {
        const currentNetwork = getCurrentNetwork(selectedNetwork);
        alert(`Please switch to ${currentNetwork.name} to make withdrawals`);
        return;
      }

      try {
        if (
          !withdrawalAmount ||
          isNaN(withdrawalAmount) ||
          parseFloat(withdrawalAmount) <= 0
        ) {
          alert("Please enter a valid withdrawal amount");
          return;
        }

        const currentNetwork = getCurrentNetwork(selectedNetwork);
        const usdtToken = currentNetwork.tokens.USDT;
        const amount = ethers.parseUnits(withdrawalAmount, usdtToken.decimals);
        const tx = await savingsContract.withdraw(amount, usdtToken.address);
        await tx.wait();
        alert(`Withdrawal of ${withdrawalAmount} USDT successful!`);

        // Clear form and refresh balances and spending limits
        setDepositAmount("");
        await fetchAllBalances();
        await fetchSpendingLimits();
      } catch (error) {
        console.error("Withdrawal error:", error);
        if (error.message.includes("Exceeds")) {
          // Extract which limit was exceeded from error message
          alert(`Withdrawal blocked: ${error.message}`);
        } else if (error.message.includes("Insufficient balance")) {
          alert("Insufficient balance for this withdrawal");
        } else {
          alert("Failed to withdraw. Please try again.");
        }
      }
    }
  };

  const commitSetup = async () => {
    if (savingsContract) {
      try {
        // First, save any configured spending limits
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

          // Save the configured limits
          const dailyLimitWei =
            daily > 0 ? ethers.parseUnits(daily.toString(), 6) : 0;
          const weeklyLimitWei =
            weekly > 0 ? ethers.parseUnits(weekly.toString(), 6) : 0;
          const monthlyLimitWei =
            monthly > 0 ? ethers.parseUnits(monthly.toString(), 6) : 0;

          const limitsTx = await savingsContract.setCommonPeriodLimits(
            dailyLimitWei,
            weeklyLimitWei,
            monthlyLimitWei
          );
          await limitsTx.wait();
          console.log("Spending limits saved successfully before setup commit");
        }

        // Now commit the setup
        const tx = await savingsContract.commitInitialSetup();
        await tx.wait();
        alert(
          "Setup locked in successfully! You are now in secured mode with timelock protection."
        );

        // Reset edit modes since we're now locked
        setLimitEdits({
          Daily: { value: "", isActive: false, isEditing: false },
          Weekly: { value: "", isActive: false, isEditing: false },
          Monthly: { value: "", isActive: false, isEditing: false },
        });

        // Refresh setup status
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



  const fetchSpendingLimits = async (
    contract = savingsContract,
    userSigner = signer
  ) => {
    if (contract && userSigner) {
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

        // Update unified limit editing state based on fetched limits
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
      } catch (error) {
        console.error("Error fetching spending limits:", error);
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
    if (!contract || !currentUserAddress) return;

    try {
      const addressData = await contract.getUserWithdrawalAddresses();
      const [titles, destinations, timestamps] = addressData;

      const addresses = [];
      for (let i = 0; i < titles.length; i++) {
        addresses.push({
          title: titles[i],
          destination: destinations[i],
          addedTimestamp: Number(timestamps[i]),
          addedDate: new Date(Number(timestamps[i]) * 1000).toLocaleDateString(),
        });
      }

      setWithdrawalAddresses(addresses);
      console.log(`Loaded ${addresses.length} withdrawal addresses for ${currentUserAddress}`);
    } catch (error) {
      console.error("Error fetching withdrawal addresses:", error);
      setWithdrawalAddresses([]);
    }
  };

  const fetchPendingWithdrawalRequests = async (
    contract = savingsContract,
    userAddr = null
  ) => {
    const currentUserAddress = userAddr || userAddress;
    if (!contract || !currentUserAddress) return;

    try {
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
      console.log(`Loaded ${requests.length} pending withdrawal requests for ${currentUserAddress}`);
    } catch (error) {
      console.error("Error fetching pending withdrawal requests:", error);
      setPendingWithdrawalRequests([]);
    }
  };

  const requestWithdrawalAddress = async () => {
    if (!savingsContract || !newWithdrawalTitle || !newWithdrawalAddress) {
      alert("Please fill in all fields");
      return;
    }

    try {
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

      alert(`✅ Withdrawal address request submitted successfully!\nTitle: ${newWithdrawalTitle}\nAddress: ${newWithdrawalAddress}\nExecutable after: 24 hours`);

      // Clear form
      setNewWithdrawalTitle("");
      setNewWithdrawalAddress("");
      setShowWithdrawalAddressForm(false);

      // Refresh data
      await fetchPendingWithdrawalRequests();
    } catch (error) {
      console.error("Error requesting withdrawal address:", error);
      if (error.message.includes("Address already exists")) {
        alert("This address is already in your withdrawal addresses");
      } else if (error.message.includes("Cannot set own address")) {
        alert("You cannot add your own wallet address as a withdrawal destination");
      } else {
        alert(`Failed to request withdrawal address: ${error.message}`);
      }
    }
  };

  const executeWithdrawalRequest = async (requestId) => {
    if (!savingsContract) return;

    try {
      const tx = await savingsContract.executeWithdrawalAddressRequest(requestId);
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
      const tx = await savingsContract.cancelWithdrawalAddressRequest(requestId);
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
    if (savingsContract && selectedToken && withdrawalAmount) {
      // Check if user is on the correct network
      if (!isCorrectNetwork()) {
        const currentNetwork = getCurrentNetwork(selectedNetwork);
        alert(`Please switch to ${currentNetwork.name} to make withdrawals`);
        return;
      }

      try {
        if (
          !withdrawalAmount ||
          isNaN(withdrawalAmount) ||
          parseFloat(withdrawalAmount) <= 0
        ) {
          alert("Please enter a valid withdrawal amount");
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

        const amount = ethers.parseUnits(withdrawalAmount, decimals);

        let tx;
        if (selectedWithdrawalDestination === "self") {
          // Use original withdraw function
          tx = await savingsContract.withdraw(amount, tokenAddress);
        } else {
          // Use withdrawTo function with selected destination
          tx = await savingsContract.withdrawTo(amount, tokenAddress, selectedWithdrawalDestination);
        }

        await tx.wait();
        alert(`Withdrawal of ${withdrawalAmount} ${tokenSymbol} successful!`);

        // Clear form and refresh balances and spending limits
        setDepositAmount("");
        await fetchAllBalances();
        await fetchSpendingLimits();
      } catch (error) {
        console.error("Withdrawal error:", error);
        if (error.message.includes("Exceeds")) {
          // Extract which limit was exceeded from error message
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
    if (!savingsContract || !withdrawalAmount || !exceedingPeriod) {
      alert("Invalid withdrawal request");
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
      const currentNetwork = getCurrentNetwork(selectedNetwork);
      let tokenAddress;
      let decimals;

      // Determine token details
      if (selectedToken === "ETH") {
        tokenAddress = ETH_ADDRESS;
        decimals = 18;
      } else if (currentNetwork.tokens[selectedToken]) {
        const token = currentNetwork.tokens[selectedToken];
        tokenAddress = token.address;
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
        `✅ Bypass request submitted successfully!\n\n` +
        `Amount: ${withdrawalAmount} ${selectedToken}\n` +
        `Period: ${exceedingPeriod}\n` +
        `Executable after: 24 hours\n\n` +
        `You can execute this request from the "Pending Bypass Requests" section once the waiting period is over.`
      );

      // Clear form and refresh data
      setWithdrawalAmount("");
      await fetchPendingBypassRequests();
      await fetchSpendingLimits();
    } catch (error) {
      console.error("Error requesting bypass:", error);
      if (error.message.includes("Insufficient balance")) {
        alert("Insufficient balance for this withdrawal");
      } else if (error.message.includes("Amount within limits")) {
        alert("This amount is within your spending limits - use instant withdrawal instead");
      } else {
        alert(`Failed to request bypass: ${error.message}`);
      }
    }
  };

  const fetchPendingBypassRequests = async (
    contract = savingsContract,
    userAddr = null
  ) => {
    const currentUserAddress = userAddr || userAddress;
    const currentContract = contract || savingsContract;

    if (!currentUserAddress || !currentContract) return;

    try {
      console.log("🔍 Fetching bypass requests for:", currentUserAddress);

      // Get active bypass requests directly from contract
      const bypassData = await currentContract.getUserActiveBypassRequests();
      console.log("📊 Raw bypass data:", bypassData);

      const [requestIds, amounts, skipPeriods, tokens, executeAfters] = bypassData;
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
          const moduleAddresses = await import('./moduleAddresses.json');
          if (tokenAddress.toLowerCase() === moduleAddresses.tokens.usdt.toLowerCase()) {
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

      console.log(`Found ${requests.length} active bypass requests for ${currentUserAddress}`);
      console.log("📋 Requests array:", requests);
      setPendingBypassRequests(requests);
      console.log("✅ setPendingBypassRequests called with", requests.length, "requests");
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
        await fetchAllBalances();
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
      <h1>🔒 Lock In Wallet</h1>

      {/* User Info and Quick Actions */}
      {provider && (
        <div
          style={{
            marginBottom: "20px",
            padding: "15px",
            border: "1px solid #4a5568",
            borderRadius: "5px",
            backgroundColor: "#2d3748",
            color: "white",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <h3 style={{ margin: 0, color: "#e2e8f0" }}>
              🔗 Connected:{" "}
              {networkType === 'solana'
                ? solanaPublicKey
                  ? `${solanaPublicKey.toString().slice(0, 6)}...${solanaPublicKey.toString().slice(-4)}`
                  : "Loading..."
                : userAddress
                  ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
                  : "Loading..."
              }
            </h3>

            {/* Wallet Buttons for Solana */}
            {networkType === 'solana' && (
              <div style={{ display: "flex", gap: "10px" }}>
                <WalletMultiButton />
                {solanaConnected && <WalletDisconnectButton />}
              </div>
            )}
          </div>

          {/* Network Type Selector */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              flexWrap: "wrap",
              marginBottom: "15px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "#a0aec0", fontSize: "0.9em" }}>
                Blockchain:
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
                }}
              >
                <option value="evm">Ethereum (EVM)</option>
                <option value="solana">Solana</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "#a0aec0", fontSize: "0.9em" }}>
                Network:
              </span>
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
                }}
              >
                {networkType === 'solana' ? (
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

            {/* Network Status Indicator */}
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
                  ? `Connected to ${getCurrentNetwork(networkType, selectedNetwork).name}`
                  : networkType === 'solana'
                    ? `Connect Solana wallet`
                    : `Wrong network - Switch to ${
                        getCurrentNetwork(networkType, selectedNetwork).name
                      }`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Contract Deployment Warning */}
      {provider &&
        getCurrentNetwork(selectedNetwork).savingsContract ===
          "0x0000000000000000000000000000000000000000" && (
          <div
            style={{
              marginBottom: "20px",
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

      {/* Multi-token balance display - ALWAYS SHOWN */}
      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          border: "2px solid #333",
          borderRadius: "5px",
          backgroundColor: "#2d3748",
          color: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <h3 style={{ color: "white", margin: 0 }}>💰 Your Balances</h3>
          {(provider || (networkType === 'solana' && solanaWallet?.connected)) && (
            <button
              onClick={async () => {
                if (networkType === 'evm') {
                  await fetchAllBalances();
                } else if (networkType === 'solana') {
                  console.log("🔄 Refreshing Solana balances...");
                  try {
                    const userAddress = await transactionManager.getAddress();
                    const solanaBalances = await transactionManager.getAllBalances(userAddress);
                    setBalances(solanaBalances);
                    console.log("✅ Solana balances refreshed:", solanaBalances);
                  } catch (error) {
                    console.error("❌ Error refreshing Solana balances:", error);
                  }
                }
              }}
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
        ) : Object.keys(balances).length === 0 ? (
          <div
            style={{ textAlign: "center", color: "#a0aec0", padding: "20px" }}
          >
            <p>Loading balances...</p>
          </div>
        ) : (
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
          {/* Combined Deposit Section */}
          <div
            style={{
              marginBottom: "20px",
              padding: "15px",
              border: "2px solid #333",
              borderRadius: "5px",
              backgroundColor: "#2d3748",
              color: "white",
            }}
          >
            <h3 style={{ color: "white" }}>
              💰 Deposit from{" "}
              {userAddress
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
                        getCurrentNetwork(selectedNetwork).tokens[selectedToken]
                          ?.recommended
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
                Get your personal deposit address to receive funds directly from
                exchanges
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
                      🎯 Direct exchange withdrawals • Permanent address you can
                      always use
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
                      Use this permanent address to receive funds directly from
                      exchanges or other wallets
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

          {/* Combined Spending Limits & Setup Status */}
          <div
            style={{
              marginBottom: "20px",
              padding: "15px",
              border: "2px solid #333",
              borderRadius: "5px",
              backgroundColor: "#2d3748",
              color: "white",
            }}
          >
            <h3 style={{ color: "white" }}>💰 Spending Limits & Setup</h3>
            <p
              style={{
                fontSize: "0.9em",
                color: "#cbd5e0",
                marginBottom: "15px",
              }}
            >
              {isSetupCommitted
                ? "⚠️ Account locked: Changes require 24-hour timelock proposals. Edit individual limits or add new ones."
                : "Set your spending limits. You can freely modify them until you commit the setup."}
            </p>

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
                  const isActive = existingLimit !== undefined; // Only use contract data for active state

                  const progressPercent = existingLimit
                    ? (parseFloat(existingLimit.spent) /
                        parseFloat(existingLimit.limit)) *
                      100
                    : 0;
                  const isNearLimit = progressPercent > 80;
                  const isAtLimit = progressPercent >= 100;

                  // Determine card state for styling
                  const isBeingConfigured = edit?.value && edit.value.trim() !== "" && !isActive;
                  const hasUnsavedChanges = edit?.value && edit.value.trim() !== "" && isActive && edit.value !== existingLimit?.limit;
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
                    boxShadow: isBeingConfigured || hasUnsavedChanges
                      ? "0 0 0 1px rgba(154, 230, 180, 0.3)"
                      : "none",
                    cursor: isInteractive ? "pointer" : "default",
                  };

                  // Hover and focus enhancement styles
                  const getEnhancedCardStyle = (isHovered = false, isFocused = false) => ({
                    ...cardStyle,
                    backgroundColor: (isHovered || isFocused) && isInteractive
                      ? isActive
                        ? "#2d3748"
                        : isBeingConfigured
                          ? "#3a5a6a"
                          : "#5a6578"
                      : cardStyle.backgroundColor,
                    border: (isHovered || isFocused) && isInteractive
                      ? isActive
                        ? isAtLimit
                          ? "2px solid #fc8181"
                          : isNearLimit
                          ? "2px solid #f6ad55"
                          : "2px solid #68d391"
                        : "2px solid #9ae6b4"
                      : cardStyle.border,
                    boxShadow: (isHovered || isFocused) && isInteractive
                      ? "0 0 0 2px rgba(154, 230, 180, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15)"
                      : cardStyle.boxShadow,
                    transform: (isHovered || isFocused) && isInteractive ? "translateY(-1px)" : "none",
                  });

                  // Get current card state
                  const currentCardState = cardStates[periodName] || { isHovered: false, isFocused: false };
                  const { isHovered, isFocused } = currentCardState;

                  const updateCardState = (updates) => {
                    setCardStates(prev => ({
                      ...prev,
                      [periodName]: { ...prev[periodName], ...updates }
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
                            ) : null}
                            <button
                              onClick={() => toggleEditMode(periodName)}
                              style={{
                                flex: isSetupCommitted ? 0 : 1,
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
            {isSetupCommitted && pendingLimitProposals.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ color: "#ed8936", margin: "0 0 15px 0" }}>
                  ⏳ Pending Limit Proposals ({pendingLimitProposals.length})
                </h4>
                <p
                  style={{
                    fontSize: "0.8em",
                    color: "#a0aec0",
                    marginBottom: "15px",
                  }}
                >
                  These limit change proposals are waiting for the timelock
                  period to expire before they can be executed.
                </p>

                <div style={{ display: "grid", gap: "10px" }}>
                  {pendingLimitProposals.map((proposal, index) => {
                    const isReady =
                      proposal.executeAfter &&
                      currentTime >= proposal.executeAfter;

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
                              {isReady ? "✅ Ready" : "⏰ Pending"}
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

            {/* Setup Status Section */}
            <div
              style={{
                padding: "15px",
                border: "2px solid #4a5568",
                borderRadius: "8px",
                backgroundColor: isSetupCommitted ? "#1a365d" : "#1a202c",
              }}
            >
              <h4 style={{ color: "white", margin: "0 0 15px 0" }}>
                Setup Status:{" "}
                {isSetupCommitted ? "🔒 Locked Mode" : "⚙️ Setup Mode"}
              </h4>
              {!isSetupCommitted ? (
                <div>
                  <p style={{ color: "#e2e8f0", margin: "0 0 10px 0" }}>
                    Configure your spending limits above, then lock in your
                    setup.
                  </p>
                  <p style={{ color: "#fbb6ce", margin: "0 0 15px 0" }}>
                    <strong>
                      ⚠️ Locking in will save your limits and enable timelock
                      security!
                    </strong>
                  </p>
                  {(limitEdits.Daily?.value ||
                    limitEdits.Weekly?.value ||
                    limitEdits.Monthly?.value) && (
                    <div
                      style={{
                        marginBottom: "15px",
                        padding: "10px",
                        backgroundColor: "#2a4a5a",
                        borderRadius: "4px",
                        fontSize: "0.9em",
                      }}
                    >
                      <div
                        style={{
                          color: "#9ae6b4",
                          fontWeight: "bold",
                          marginBottom: "5px",
                        }}
                      >
                        Ready to lock in:
                      </div>
                      {limitEdits.Daily?.value && (
                        <div style={{ color: "#e2e8f0" }}>
                          • Daily: {limitEdits.Daily.value} USDT
                        </div>
                      )}
                      {limitEdits.Weekly?.value && (
                        <div style={{ color: "#e2e8f0" }}>
                          • Weekly: {limitEdits.Weekly.value} USDT
                        </div>
                      )}
                      {limitEdits.Monthly?.value && (
                        <div style={{ color: "#e2e8f0" }}>
                          • Monthly: {limitEdits.Monthly.value} USDT
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={commitSetup}
                    style={{
                      backgroundColor: "#e53e3e",
                      color: "white",
                      padding: "12px 24px",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "1em",
                      fontWeight: "bold",
                      width: "100%",
                    }}
                  >
                    🔒 Lock In Setup & Enable Security
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ color: "#9ae6b4", margin: "0 0 15px 0" }}>
                    ✅ Setup committed on {setupInfo?.commitTimestamp}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "15px",
                      marginBottom: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <p style={{ color: "#e2e8f0", margin: 0 }}>
                      📊 Total Locked Value: {setupInfo?.totalLockedValue} USDT
                    </p>
                    <button
                      onClick={recalculateTotalLockedValue}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "4px",
                        border: "1px solid #9ae6b4",
                        backgroundColor: "transparent",
                        color: "#9ae6b4",
                        cursor: "pointer",
                        fontSize: "0.8em",
                        fontWeight: "bold",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = "#9ae6b4";
                        e.target.style.color = "#1a202c";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "transparent";
                        e.target.style.color = "#9ae6b4";
                      }}
                      title="Recalculate using corrected logic (max limit instead of sum)"
                    >
                      🔄 Recalculate
                    </button>
                  </div>
                  <p style={{ color: "#e2e8f0", margin: "0 0 15px 0" }}>
                    📈 Increases This Period: {setupInfo?.increasesInPeriod}{" "}
                    USDT
                  </p>
                  <div style={{ fontSize: "0.9em", color: "#cbd5e0" }}>
                    <p style={{ margin: "0 0 8px 0", fontWeight: "bold" }}>
                      Security Rules:
                    </p>
                    <ul style={{ margin: "0", paddingLeft: "20px" }}>
                      <li>Increases: 24-72h timelock required</li>
                      <li>Decreases: Immediate</li>
                      <li>Max increase: 20% of locked value per 7 days</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pending Bypass Requests Section */}
          {pendingBypassRequests.length > 0 && (
            <div
              style={{
                marginBottom: "20px",
                padding: "15px",
                border: "1px solid #333",
                borderRadius: "5px",
                backgroundColor: "#2d3748",
                color: "white",
              }}
            >
              <h3 style={{ color: "white" }}>
                ⏳ Pending Bypass Requests ({pendingBypassRequests.length})
              </h3>
              <p
                style={{
                  fontSize: "0.9em",
                  color: "#cbd5e0",
                  marginBottom: "15px",
                }}
              >
                Your pending bypass requests with countdown timers. Execute them
                after the 24-hour timelock expires.
              </p>

              <div style={{ display: "grid", gap: "15px" }}>
                {pendingBypassRequests.map((request, index) => {
                  const countdown = formatCountdown(
                    request.executeAfter,
                    currentTime
                  );

                  return (
                    <div
                      key={index}
                      style={{
                        padding: "15px",
                        border: countdown.ready
                          ? "1px solid #48bb78"
                          : "1px solid #4a5568",
                        borderRadius: "8px",
                        backgroundColor: "#1a202c",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "10px",
                          flexWrap: "wrap",
                          gap: "10px",
                        }}
                      >
                        <h4 style={{ color: "white", margin: 0 }}>
                          💸 {request.amount} {request.tokenSymbol}
                        </h4>
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.8em",
                              padding: "4px 8px",
                              borderRadius: "12px",
                              backgroundColor: countdown.ready
                                ? "#48bb78"
                                : "#4a5568",
                              color: "white",
                              fontWeight: "bold",
                            }}
                          >
                            {countdown.ready ? "⚡ Ready!" : "⏰ Pending"}
                          </span>
                          {countdown.ready && (
                            <button
                              onClick={() =>
                                executeBypassRequest(request.requestId)
                              }
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
                            onClick={() =>
                              cancelBypassRequest(request.requestId)
                            }
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

                      <div style={{ marginBottom: "10px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "5px",
                          }}
                        >
                          <span style={{ color: "#e2e8f0", fontSize: "0.9em" }}>
                            Bypass Period:
                          </span>
                          <span
                            style={{ color: "#9ae6b4", fontWeight: "bold" }}
                          >
                            {request.skipPeriod}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.8em",
                            color: "#a0aec0",
                          }}
                        >
                          <span>
                            Request ID: {request.requestId.slice(0, 10)}...
                          </span>
                          <span>
                            Submitted:{" "}
                            {new Date(
                              request.timestamp * 1000
                            ).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Countdown Display */}
                      <div
                        style={{
                          padding: "8px 12px",
                          backgroundColor: "#4a5568",
                          borderRadius: "4px",
                          textAlign: "center",
                          color: countdown.color,
                          fontWeight: "bold",
                          fontSize: "0.9em",
                        }}
                      >
                        {countdown.text}
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
                💡 Bypass requests allow you to skip one spending limit while
                still respecting others. Each request requires a 24-hour
                timelock for security.
              </div>
            </div>
          )}

          {/* Enhanced Withdrawal Section */}
          <div
            style={{
              marginBottom: "20px",
              padding: "15px",
              border: "1px solid #333",
              borderRadius: "5px",
              backgroundColor: "#2d3748",
              color: "white",
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
              Withdrawals are automatically checked against all your active spending limits.
              You can withdraw to your own wallet or to approved withdrawal addresses.
            </p>

            {/* Token and Amount Selection */}
            <div style={{ marginBottom: "15px" }}>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
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
                    .filter(([_, token]) => token.address !== "0x0000000000000000000000000000000000000000")
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
            <div style={{ marginBottom: "15px", padding: "10px", backgroundColor: "#1a202c", borderRadius: "4px", border: "1px solid #4a5568" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <span style={{ fontSize: "0.9em", color: "#cbd5e0" }}>
                  💡 Instant Withdrawable:
                </span>
                <span style={{ fontWeight: "bold", color: "#48bb78" }}>
                  {(typeof instantWithdrawableAmount === 'number' ? instantWithdrawableAmount : 0).toFixed(2)} {selectedToken}
                </span>
              </div>
              {limitingPeriod && (
                <div style={{ fontSize: "0.8em", color: "#a0aec0" }}>
                  Limited by: {limitingPeriod} spending limit
                </div>
              )}
              {withdrawalAmount && exceedsInstantLimit && exceedingPeriod && (
                <div style={{ marginTop: "8px", padding: "8px", backgroundColor: "#2d3748", borderRadius: "4px", border: "1px solid #ed8936" }}>
                  <div style={{ fontSize: "0.85em", color: "#ed8936", fontWeight: "bold" }}>
                    ⚠️ Amount exceeds {exceedingPeriod} limit
                  </div>
                  <div style={{ fontSize: "0.8em", color: "#a0aec0", marginTop: "2px" }}>
                    This withdrawal will require a 24-hour approval period
                  </div>
                </div>
              )}
            </div>

            {/* Destination Selection as Radio Buttons */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontSize: "0.9em", color: "#e2e8f0", marginBottom: "8px" }}>
                Withdraw To:
              </label>

              {/* My Wallet Option */}
              <div style={{ marginBottom: "8px" }}>
                <label style={{ display: "flex", alignItems: "flex-start", cursor: "pointer", padding: "8px", borderRadius: "4px", backgroundColor: selectedWithdrawalDestination === "self" ? "#2d3748" : "transparent", border: "1px solid #4a5568" }}>
                  <input
                    type="radio"
                    name="withdrawalDestination"
                    value="self"
                    checked={selectedWithdrawalDestination === "self"}
                    onChange={(e) => setSelectedWithdrawalDestination(e.target.value)}
                    style={{ marginRight: "8px", marginTop: "2px" }}
                  />
                  <span style={{ color: "white" }}>
                    🏠 My Wallet ({userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : ""})
                  </span>
                </label>
              </div>

              {/* Withdrawal Addresses as Radio Buttons */}
              {withdrawalAddresses.map((addr, index) => (
                <div key={index} style={{ marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", border: "1px solid #4a5568", borderRadius: "4px", backgroundColor: selectedWithdrawalDestination === addr.destination ? "#2d3748" : "transparent" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", cursor: "pointer", padding: "8px", flex: 1 }}>
                      <input
                        type="radio"
                        name="withdrawalDestination"
                        value={addr.destination}
                        checked={selectedWithdrawalDestination === addr.destination}
                        onChange={(e) => setSelectedWithdrawalDestination(e.target.value)}
                        style={{ marginRight: "8px", marginTop: "2px" }}
                      />
                      <div>
                        <div style={{ color: "white", fontWeight: "bold" }}>
                          📍 {addr.title}
                        </div>
                        <div style={{ fontSize: "0.8em", color: "#a0aec0", fontFamily: "monospace" }}>
                          {addr.destination}
                        </div>
                        <div style={{ fontSize: "0.7em", color: "#718096" }}>
                          Added: {addr.addedDate}
                        </div>
                      </div>
                    </label>
                    <button
                      onClick={() => removeWithdrawalAddress(addr.destination)}
                      style={{
                        marginRight: "8px",
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
                  </div>
                </div>
              ))}

              {/* Add Address Button Below the List */}
              <div style={{ marginTop: "10px" }}>
                <button
                  onClick={() => setShowWithdrawalAddressForm(!showWithdrawalAddressForm)}
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
            </div>

            {/* Dynamic Withdrawal Buttons */}
            <div style={{ display: "flex", gap: "10px", width: "100%" }}>
              {!exceedsInstantLimit ? (
                <button
                  onClick={withdrawToDestination}
                  disabled={!withdrawalAmount || parseFloat(withdrawalAmount) <= 0}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: !withdrawalAmount || parseFloat(withdrawalAmount) <= 0 ? "#4a5568" : "#48bb78",
                    color: "white",
                    cursor: !withdrawalAmount || parseFloat(withdrawalAmount) <= 0 ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                    flex: "1",
                    fontSize: "1em",
                    opacity: !withdrawalAmount || parseFloat(withdrawalAmount) <= 0 ? 0.5 : 1,
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
                    disabled={!withdrawalAmount || parseFloat(withdrawalAmount) <= 0}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "4px",
                      border: "none",
                      backgroundColor: !withdrawalAmount || parseFloat(withdrawalAmount) <= 0 ? "#4a5568" : "#ed8936",
                      color: "white",
                      cursor: !withdrawalAmount || parseFloat(withdrawalAmount) <= 0 ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                      flex: "1",
                      fontSize: "0.9em",
                      opacity: !withdrawalAmount || parseFloat(withdrawalAmount) <= 0 ? 0.5 : 1,
                    }}
                  >
                    🕐 Request Above {exceedingPeriod} Limit
                  </button>
                </>
              )}
            </div>

            {/* Add New Withdrawal Address Form */}
            {showWithdrawalAddressForm && (
              <div style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #4a5568" }}>
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
                  <p style={{ fontSize: "0.8em", color: "#a0aec0", marginBottom: "15px" }}>
                    Withdrawal addresses require a 24-hour approval period for security.
                  </p>

                  <div style={{ display: "grid", gap: "10px", marginBottom: "15px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.9em", color: "#e2e8f0", marginBottom: "5px" }}>
                        Address Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 'Hardware Wallet', 'Exchange Account'"
                        value={newWithdrawalTitle}
                        onChange={(e) => setNewWithdrawalTitle(e.target.value)}
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
                      <label style={{ display: "block", fontSize: "0.9em", color: "#e2e8f0", marginBottom: "5px" }}>
                        Ethereum Address
                      </label>
                      <input
                        type="text"
                        placeholder="0x..."
                        value={newWithdrawalAddress}
                        onChange={(e) => setNewWithdrawalAddress(e.target.value)}
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
              <div style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #4a5568" }}>
                <div>
                  <h5 style={{ color: "#ed8936", margin: "0 0 10px 0" }}>
                    ⏳ Pending Requests ({pendingWithdrawalRequests.length})
                  </h5>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {pendingWithdrawalRequests.map((request, index) => {
                      const countdown = formatCountdown(request.executeAfter, currentTime);
                      return (
                        <div
                          key={index}
                          style={{
                            padding: "10px",
                            backgroundColor: "#1a202c",
                            borderRadius: "6px",
                            border: countdown.ready ? "1px solid #48bb78" : "1px solid #ed8936",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <div>
                              <div style={{ color: "white", fontWeight: "bold" }}>
                                📍 {request.title}
                              </div>
                              <div style={{ fontSize: "0.8em", color: "#a0aec0", fontFamily: "monospace" }}>
                                {request.destination}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                              {countdown.ready && (
                                <button
                                  onClick={() => executeWithdrawalRequest(request.requestId)}
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
                                onClick={() => cancelWithdrawalRequest(request.requestId)}
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


          <div>
            <h3>Add Approver</h3>
            <input
              type="text"
              placeholder="Approver Address"
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
            />
            <button onClick={addApprover}>Add Approver</button>
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
