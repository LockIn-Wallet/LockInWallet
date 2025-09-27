import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import SavingsABI from "./SavingsABI.json";
import MockUSDT_ABI from "./MockUSDT_ABI.json";

const ETH_ADDRESS = "0x0000000000000000000000000000000000000000"; // ETH address (native token)

// Network configuration
const NETWORKS = {
  localhost: {
    chainId: 31337,
    name: "Localhost",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: ["http://127.0.0.1:8545"],
    blockExplorerUrls: [""],
    savingsContract: "0x7969c5eD335650692Bc04293B07F5BF2e7A673C0",
    tokens: {
      USDT: {
        address: "0x7bc06c482DEAd17c0e297aFbC32f6e63d3846650",
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        recommended: true
      },
      USDC: {
        address: "0x0000000000000000000000000000000000000000", // Placeholder
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        recommended: true
      },
      DAI: {
        address: "0x0000000000000000000000000000000000000000", // Placeholder
        symbol: "DAI",
        name: "Dai Stablecoin",
        decimals: 18,
        recommended: true
      }
    }
  },
  ethereum: {
    chainId: 1,
    name: "Ethereum Mainnet",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18
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
        recommended: true
      },
      USDC: {
        address: "0xA0b86a33E6B6c3c3A3B8DBbc81b2B4C98B25C96f",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        recommended: true
      },
      DAI: {
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        symbol: "DAI",
        name: "Dai Stablecoin",
        decimals: 18,
        recommended: true
      }
    }
  },
  optimism: {
    chainId: 10,
    name: "Optimism",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18
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
        recommended: true
      },
      USDC: {
        address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        recommended: true
      },
      DAI: {
        address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        symbol: "DAI",
        name: "Dai Stablecoin",
        decimals: 18,
        recommended: true
      }
    }
  }
};

// Helper functions for network management
const getNetworkByChainId = (chainId) => {
  return Object.values(NETWORKS).find(network => network.chainId === chainId);
};

const getCurrentNetwork = (selectedNetwork) => {
  return NETWORKS[selectedNetwork] || NETWORKS.localhost;
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
      color: "#fbb6ce"
    };
  } else if (minutes > 0) {
    return {
      text: `${minutes}m ${seconds}s remaining`,
      ready: false,
      color: "#ed8936"
    };
  } else {
    return {
      text: `${seconds}s remaining`,
      ready: false,
      color: "#e53e3e"
    };
  }
};

// For backward compatibility
const USDT_ADDRESS = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788"; // Updated: 0x610178dA211FEF7D417bC0e6FeD39F05609AD788

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [savingsContract, setSavingsContract] = useState(null);
  const [balances, setBalances] = useState({}); // Multi-token balances
  const [approver, setApprover] = useState("");

  // Network state management
  const [selectedNetwork, setSelectedNetwork] = useState("localhost"); // Current selected network
  const [currentChainId, setCurrentChainId] = useState(null); // MetaMask's current chain ID
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);

  // Time-based spending limits state
  const [dailyLimit, setDailyLimit] = useState("");
  const [weeklyLimit, setWeeklyLimit] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [spendingLimits, setSpendingLimits] = useState([]); // Array of all time periods

  // Custom period state
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);
  const [customPeriodName, setCustomPeriodName] = useState("");
  const [customPeriodLimit, setCustomPeriodLimit] = useState("");
  const [customPeriodDuration, setCustomPeriodDuration] = useState("86400"); // Default 1 day
  const [depositAmount, setDepositAmount] = useState(""); // New state for deposit amount
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
  const [bypassAmount, setBypassAmount] = useState("");
  const [bypassPeriod, setBypassPeriod] = useState("Daily");
  const [bypassToken, setBypassToken] = useState("USDT");
  const [pendingBypassRequests, setPendingBypassRequests] = useState([]);
  const [showBypassForm, setShowBypassForm] = useState(false);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // Network detection and switching functions
  const detectCurrentNetwork = async () => {
    if (window.ethereum) {
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const numericChainId = parseInt(chainId, 16);
        setCurrentChainId(numericChainId);

        const network = getNetworkByChainId(numericChainId);
        if (network) {
          const networkKey = Object.keys(NETWORKS).find(key => NETWORKS[key].chainId === numericChainId);
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

  const switchNetwork = async (networkKey) => {
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return false;
    }

    const network = NETWORKS[networkKey];
    if (!network) {
      alert("Unsupported network");
      return false;
    }

    setIsNetworkSwitching(true);

    try {
      // Try to switch to the network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
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
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${network.chainId.toString(16)}`,
              chainName: network.name,
              nativeCurrency: network.nativeCurrency,
              rpcUrls: network.rpcUrls,
              blockExplorerUrls: network.blockExplorerUrls,
            }],
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
    const expectedNetwork = getCurrentNetwork(selectedNetwork);
    return currentChainId === expectedNetwork.chainId;
  };

  // Timer for countdown updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-connect and listen for network changes
  useEffect(() => {
    if (window.ethereum) {
      const handleChainChanged = (chainId) => {
        const numericChainId = parseInt(chainId, 16);
        setCurrentChainId(numericChainId);

        const network = getNetworkByChainId(numericChainId);
        if (network) {
          const networkKey = Object.keys(NETWORKS).find(key => NETWORKS[key].chainId === numericChainId);
          if (networkKey) {
            setSelectedNetwork(networkKey);
            // Refresh balances when network changes
            if (savingsContract) {
              fetchAllBalances();
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
          setBalances({});
          setUserAddress("");
          setIsSetupCommitted(false);
          setSetupInfo(null);
          setPendingBypassRequests([]); // Clear bypass requests on disconnect
        } else {
          // Account changed, reconnect
          autoConnectWallet();
        }
      };

      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('accountsChanged', handleAccountsChanged);

      // Detect current network on load
      detectCurrentNetwork();

      // Auto-connect on page load
      autoConnectWallet();

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('chainChanged', handleChainChanged);
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, [selectedNetwork]); // Include selectedNetwork to ensure proper network detection

  const fetchAllBalances = async (contract = savingsContract, userAddr = null) => {
    if (contract && signer) {
      try {
        const userAddress = userAddr || await signer.getAddress();
        const currentNetwork = getCurrentNetwork(selectedNetwork);
        const newBalances = {};

        // Fetch ETH balance
        const ethBalance = await contract.getTokenBalance(userAddress, ETH_ADDRESS);
        newBalances['ETH'] = ethers.formatUnits(ethBalance, 18);

        // Fetch stablecoin balances using current network's token addresses
        for (const [key, token] of Object.entries(currentNetwork.tokens)) {
          if (token.address !== "0x0000000000000000000000000000000000000000") {
            try {
              const tokenBalance = await contract.getTokenBalance(userAddress, token.address);
              newBalances[key] = ethers.formatUnits(tokenBalance, token.decimals);
            } catch (err) {
              console.log(`Token ${key} not available on ${currentNetwork.name}:`, err.message);
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

  const checkProxyStatus = async (contract = savingsContract, userAddr = null) => {
    if (contract && signer) {
      try {
        const userAddress = userAddr || await signer.getAddress();

        // Check if proxy is already deployed
        const proxyDeployed = await contract.isProxyDeployed(userAddress);
        setIsProxyDeployed(proxyDeployed);

        // Get the calculated deposit address (whether deployed or not)
        const depositAddress = await contract.getUserDepositAddress(userAddress);
        setProxyAddress(depositAddress);

        console.log(`Proxy status for ${userAddress}:`);
        console.log(`- Deployed: ${proxyDeployed}`);
        console.log(`- Deposit Address: ${depositAddress}`);

      } catch (error) {
        console.error("Error checking proxy status:", error);
        setIsProxyDeployed(false);
        setProxyAddress("");
      }
    }
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

      alert("🎉 Deposit address generated successfully! You can now receive direct deposits from exchanges.");

    } catch (error) {
      console.error("Error deploying proxy:", error);

      // Handle specific error cases
      if (error.message.includes("Proxy already deployed")) {
        alert("Proxy already deployed for this address");
        await checkProxyStatus(); // Refresh status
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
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          // Already connected, proceed without requesting permission
          await connectWalletInternal();
        }
      } catch (error) {
        console.log("Auto-connect failed (expected on first visit):", error.message);
      }
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        // Request account access
        await window.ethereum.request({ method: 'eth_requestAccounts' });
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
      console.log(`Savings contract not deployed on ${currentNetwork.name} yet.`);
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

    // Automatically fetch balances and proxy status after connecting
    try {
      const userAddress = await web3Signer.getAddress();
      await fetchAllBalances(savings, userAddress);
      await checkProxyStatus(savings, userAddress);
      await fetchSpendingLimits();
      await fetchPendingBypassRequests(savings, userAddress);

      // Check setup status
      const setupCommitted = await savings.isSetupCommitted();
      setIsSetupCommitted(setupCommitted);

      if (setupCommitted) {
        const info = await savings.getSetupInfo();
        setSetupInfo({
          committed: info.committed,
          totalLockedValue: ethers.formatUnits(info.totalLockedValue, 6),
          commitTimestamp: new Date(Number(info.commitTimestamp) * 1000).toLocaleDateString(),
          increasesInPeriod: ethers.formatUnits(info.increasesInPeriod, 6),
          lastIncreaseTimestamp: new Date(Number(info.lastIncreaseTimestamp) * 1000).toLocaleDateString()
        });
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
      // Still set empty balances to show the balance section
      setBalances({});
    }
  };


  const deposit = async () => {
    if (savingsContract && selectedToken && depositAmount) {
      // Check if user is on the correct network
      if (!isCorrectNetwork()) {
        const currentNetwork = getCurrentNetwork(selectedNetwork);
        alert(`Please switch to ${currentNetwork.name} to make deposits`);
        return;
      }

      try {
        let tokenAddress;
        let decimals;
        let tokenSymbol;

        const currentNetwork = getCurrentNetwork(selectedNetwork);

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

        const amount = ethers.parseUnits(depositAmount, decimals);

        // Approve the Savings contract to spend ERC20 tokens (not needed for ETH)
        if (tokenAddress !== ETH_ADDRESS) {
          const currentNetwork = getCurrentNetwork(selectedNetwork);
          const tokenContract = new ethers.Contract(tokenAddress, MockUSDT_ABI, signer);
          const approvalTx = await tokenContract.approve(currentNetwork.savingsContract, amount);
          await approvalTx.wait();
          console.log(`${tokenSymbol} approval successful`);
        }

        // Call the deposit function (use the 2-parameter version)
        const depositTx = await savingsContract["deposit(address,uint256)"](tokenAddress, amount, {
          value: tokenAddress === ETH_ADDRESS ? amount : 0, // Only send ETH if depositing ETH
        });
        await depositTx.wait();
        alert(`Deposit of ${depositAmount} ${tokenSymbol} successful!`);

        // Clear form and refresh balances
        setDepositAmount("");
        await fetchAllBalances();
      } catch (error) {
        console.error("Deposit error:", error);
        alert("Failed to deposit. Please check the token selection and amount.");
      }
    } else {
      alert("Please select a token and enter an amount");
    }
  };

  const setCommonSpendingLimits = async () => {
    if (savingsContract) {
      try {
        if (!dailyLimit && !weeklyLimit && !monthlyLimit) {
          alert("Please set at least one spending limit");
          return;
        }

        // Validate limit ordering
        const daily = dailyLimit ? parseFloat(dailyLimit) : 0;
        const weekly = weeklyLimit ? parseFloat(weeklyLimit) : 0;
        const monthly = monthlyLimit ? parseFloat(monthlyLimit) : 0;

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

        const dailyLimitWei = daily > 0 ? ethers.parseUnits(daily.toString(), 6) : 0;
        const weeklyLimitWei = weekly > 0 ? ethers.parseUnits(weekly.toString(), 6) : 0;
        const monthlyLimitWei = monthly > 0 ? ethers.parseUnits(monthly.toString(), 6) : 0;

        const tx = await savingsContract.setCommonPeriodLimits(
          dailyLimitWei,
          weeklyLimitWei,
          monthlyLimitWei
        );
        await tx.wait();
        alert("Spending limits set successfully!");

        // Clear form
        setDailyLimit("");
        setWeeklyLimit("");
        setMonthlyLimit("");

        // Refresh spending limits
        await fetchSpendingLimits();
      } catch (error) {
        console.error("Error setting spending limits:", error);
        if (error.message.includes("Daily limit too high")) {
          alert("Daily limit is too high for the weekly limit");
        } else if (error.message.includes("Weekly limit too high")) {
          alert("Weekly limit is too high for the monthly limit");
        } else {
          alert("Failed to set spending limits. Please try again.");
        }
      }
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
        if (!depositAmount || isNaN(depositAmount) || parseFloat(depositAmount) <= 0) {
          alert("Please enter a valid withdrawal amount");
          return;
        }

        const currentNetwork = getCurrentNetwork(selectedNetwork);
        const usdtToken = currentNetwork.tokens.USDT;
        const amount = ethers.parseUnits(depositAmount, usdtToken.decimals);
        const tx = await savingsContract.withdraw(amount, usdtToken.address);
        await tx.wait();
        alert(`Withdrawal of ${depositAmount} USDT successful!`);

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
        const tx = await savingsContract.commitInitialSetup();
        await tx.wait();
        alert("Setup committed successfully! You are now in locked mode.");

        // Refresh setup status
        const setupCommitted = await savingsContract.isSetupCommitted();
        setIsSetupCommitted(setupCommitted);

        if (setupCommitted) {
          const info = await savingsContract.getSetupInfo();
          setSetupInfo({
            committed: info.committed,
            totalLockedValue: ethers.formatUnits(info.totalLockedValue, 6),
            commitTimestamp: new Date(Number(info.commitTimestamp) * 1000).toLocaleDateString(),
            increasesInPeriod: ethers.formatUnits(info.increasesInPeriod, 6),
            lastIncreaseTimestamp: new Date(Number(info.lastIncreaseTimestamp) * 1000).toLocaleDateString()
          });
        }
      } catch (error) {
        console.error("Error committing setup:", error);
        alert("Failed to commit setup. Please try again.");
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
          commitTimestamp: new Date(Number(info.commitTimestamp) * 1000).toLocaleDateString(),
          increasesInPeriod: ethers.formatUnits(info.increasesInPeriod, 6),
          lastIncreaseTimestamp: new Date(Number(info.lastIncreaseTimestamp) * 1000).toLocaleDateString()
        });
      } catch (error) {
        console.error("Error recalculating total locked value:", error);
        alert("Failed to recalculate total locked value. Please try again.");
      }
    }
  };

  const requestBypass = async () => {
    if (savingsContract && bypassAmount && bypassPeriod) {
      try {
        if (!isCorrectNetwork()) {
          const currentNetwork = getCurrentNetwork(selectedNetwork);
          alert(`Please switch to ${currentNetwork.name} to make bypass requests`);
          return;
        }

        const currentNetwork = getCurrentNetwork(selectedNetwork);
        let tokenAddress;
        let decimals;
        let tokenSymbol;

        // Determine token details based on selection
        if (bypassToken === "ETH") {
          tokenAddress = ETH_ADDRESS;
          decimals = 18;
          tokenSymbol = "ETH";
        } else if (currentNetwork.tokens[bypassToken]) {
          const token = currentNetwork.tokens[bypassToken];
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

        const amount = ethers.parseUnits(bypassAmount, decimals);

        const tx = await savingsContract.requestLimitBypass(amount, bypassPeriod, tokenAddress);
        const receipt = await tx.wait();

        // Find the BypassRequested event to get the request ID
        const event = receipt.logs.find(log => {
          try {
            const parsed = savingsContract.interface.parseLog(log);
            return parsed.name === 'BypassRequested';
          } catch {
            return false;
          }
        });

        if (event) {
          const parsed = savingsContract.interface.parseLog(event);
          const requestId = parsed.args.requestId;
          const executeAfter = Number(parsed.args.executeAfter);

          // Store request in localStorage for tracking
          const requestData = {
            requestId,
            amount: bypassAmount,
            tokenSymbol,
            tokenDecimals: decimals,
            skipPeriod: bypassPeriod,
            executeAfter,
            timestamp: Math.floor(Date.now() / 1000)
          };

          const existingRequests = JSON.parse(localStorage.getItem(`bypassRequests_${userAddress}`) || '[]');
          existingRequests.push(requestData);
          localStorage.setItem(`bypassRequests_${userAddress}`, JSON.stringify(existingRequests));

          alert(`✅ Bypass request submitted successfully!\nRequest ID: ${requestId}\nAmount: ${bypassAmount} ${tokenSymbol}\nSkip Period: ${bypassPeriod}\nExecutable after: 24 hours`);
        } else {
          alert(`✅ Bypass request submitted successfully!\nAmount: ${bypassAmount} ${tokenSymbol}\nSkip Period: ${bypassPeriod}\nExecutable after: 24 hours`);
        }

        // Clear form
        setBypassAmount("");
        setShowBypassForm(false);

        // Refresh pending requests
        await fetchPendingBypassRequests(savingsContract, userAddress);
      } catch (error) {
        console.error("Bypass request error:", error);
        if (error.message.includes("Insufficient balance")) {
          alert("Insufficient balance for this bypass request");
        } else if (error.message.includes("Period not found")) {
          alert("Selected period not found or inactive");
        } else if (error.message.includes("Request already exists")) {
          alert("A bypass request with these parameters already exists");
        } else {
          alert(`Failed to submit bypass request: ${error.message}`);
        }
      }
    } else {
      alert("Please fill in all bypass request fields");
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

  const fetchPendingBypassRequests = async (contract = savingsContract, userAddr = null) => {
    const currentUserAddress = userAddr || userAddress;
    const currentContract = contract || savingsContract;

    if (!currentUserAddress || !currentContract) return;

    try {
      // Get stored requests from localStorage
      const storedRequests = localStorage.getItem(`bypassRequests_${currentUserAddress}`);
      const requests = storedRequests ? JSON.parse(storedRequests) : [];

      console.log(`Loading ${requests.length} stored bypass requests for ${currentUserAddress}`);

      // Filter out executed/cancelled requests and validate with contract
      const validRequests = [];
      for (const request of requests) {
        try {
          const contractData = await currentContract.getBypassRequest(request.requestId);
          if (contractData.exists && !contractData.executed) {
            validRequests.push({
              ...request,
              amount: ethers.formatUnits(contractData.amount, request.tokenDecimals),
              executeAfter: Number(contractData.executeAfter),
              executed: contractData.executed,
              exists: contractData.exists
            });
          }
        } catch (error) {
          console.log(`Request ${request.requestId} no longer valid:`, error.message);
        }
      }

      console.log(`Found ${validRequests.length} valid bypass requests`);

      // Update localStorage with valid requests only
      localStorage.setItem(`bypassRequests_${currentUserAddress}`, JSON.stringify(validRequests));
      setPendingBypassRequests(validRequests);

    } catch (error) {
      console.error("Error fetching bypass requests:", error);
      setPendingBypassRequests([]);
    }
  };

  const fetchSpendingLimits = async () => {
    if (savingsContract && signer) {
      try {
        const userAddress = await signer.getAddress();

        // Get all user's spending limits from the smart contract
        const spendingData = await savingsContract.getUserSpendingLimits(userAddress);
        console.log("User spending limits from contract:", spendingData);

        const fetchedLimits = [];
        const [names, limits, spent, remaining, durations, active] = spendingData;

        for (let i = 0; i < names.length; i++) {
          if (active[i]) {
            fetchedLimits.push({
              name: names[i],
              limit: ethers.formatUnits(limits[i], 6),
              spent: ethers.formatUnits(spent[i], 6),
              remaining: ethers.formatUnits(remaining[i], 6),
              duration: durations[i].toString(),
              active: active[i],
              // Helper fields for display
              durationHours: Math.floor(Number(durations[i]) / 3600),
              durationDays: Math.floor(Number(durations[i]) / 86400)
            });
          }
        }

        setSpendingLimits(fetchedLimits);
        console.log("Fetched spending limits:", fetchedLimits);
      } catch (error) {
        console.error("Error fetching spending limits:", error);
        // If the function doesn't exist, user hasn't set any limits yet
        setSpendingLimits([]);
      }
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1>🔒 Lock In Wallet</h1>

      {/* Multi-token balance display - ALWAYS SHOWN */}
      <div style={{ marginBottom: "20px", padding: "15px", border: "2px solid #333", borderRadius: "5px", backgroundColor: "#2d3748", color: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h3 style={{ color: "white", margin: 0 }}>💰 Your Balances</h3>
          {provider && (
            <button
              onClick={() => fetchAllBalances()}
              style={{
                padding: "6px 12px",
                borderRadius: "4px",
                border: "1px solid #3182ce",
                backgroundColor: "#3182ce",
                color: "white",
                cursor: "pointer",
                fontSize: "0.8em",
                fontWeight: "bold"
              }}
            >
              🔄 Refresh
            </button>
          )}
        </div>
        {!provider ? (
          <div style={{ textAlign: "center", color: "#a0aec0", padding: "20px" }}>
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
                marginTop: "10px"
              }}
            >
              Connect Wallet
            </button>
          </div>
        ) : Object.keys(balances).length === 0 ? (
          <div style={{ textAlign: "center", color: "#a0aec0", padding: "20px" }}>
            <p>Loading balances...</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
            {/* Show ETH balance */}
            <div style={{ padding: "12px", backgroundColor: "#4a5568", borderRadius: "6px", color: "white" }}>
              <div style={{ fontSize: "0.8em", color: "#a0aec0", marginBottom: "4px" }}>ETH</div>
              <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>{balances.ETH || "0"}</div>
            </div>

            {/* Show stablecoins */}
            {Object.entries(getCurrentNetwork(selectedNetwork).tokens).map(([key, token]) => (
              <div key={key} style={{
                padding: "12px",
                backgroundColor: token.recommended ? "#2f855a" : "#4a5568",
                borderRadius: "6px",
                border: token.recommended ? "2px solid #48bb78" : "none",
                color: "white"
              }}>
                <div style={{ fontSize: "0.8em", color: token.recommended ? "#9ae6b4" : "#a0aec0", marginBottom: "4px" }}>
                  {token.symbol}
                  {token.recommended && <span style={{ marginLeft: "5px" }}>✓</span>}
                </div>
                <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>{balances[key] || "0"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!provider ? (
        <div style={{ textAlign: "center", color: "#666", padding: "20px" }}>
          <p>Please connect your wallet to access the savings features.</p>
        </div>
      ) : (
        <div>
          {/* User Info and Quick Actions */}
          <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #4a5568", borderRadius: "5px", backgroundColor: "#2d3748", color: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ margin: 0, color: "#e2e8f0" }}>🔗 Connected: {userAddress ? `${userAddress.slice(0,6)}...${userAddress.slice(-4)}` : 'Loading...'}</h3>
            </div>

            {/* Network Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ color: "#a0aec0", fontSize: "0.9em" }}>Network:</span>
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
                    cursor: isNetworkSwitching ? "not-allowed" : "pointer"
                  }}
                >
                  <option value="localhost">Localhost</option>
                  <option value="ethereum">Ethereum Mainnet</option>
                  <option value="optimism">Optimism</option>
                </select>
                {isNetworkSwitching && (
                  <span style={{ color: "#fbb6ce", fontSize: "0.8em" }}>Switching...</span>
                )}
              </div>

              {/* Network Status Indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: isCorrectNetwork() ? "#48bb78" : "#f56565"
                }} />
                <span style={{
                  fontSize: "0.8em",
                  color: isCorrectNetwork() ? "#9ae6b4" : "#fc8181"
                }}>
                  {isCorrectNetwork() ?
                    `Connected to ${getCurrentNetwork(selectedNetwork).name}` :
                    `Wrong network - Switch to ${getCurrentNetwork(selectedNetwork).name}`
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Contract Deployment Warning */}
          {getCurrentNetwork(selectedNetwork).savingsContract === "0x0000000000000000000000000000000000000000" && (
            <div style={{ marginBottom: "20px", padding: "15px", border: "2px solid #f56565", borderRadius: "5px", backgroundColor: "#fed7d7", color: "#c53030" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#c53030" }}>⚠️ Contract Not Deployed</h4>
              <p style={{ margin: 0, fontSize: "0.9em" }}>
                The Savings contract is not yet deployed on {getCurrentNetwork(selectedNetwork).name}.
                Please switch to Localhost for development or wait for mainnet deployment.
              </p>
            </div>
          )}

          <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "5px" }}>
            <h3>Deposit 💰</h3>
            <p style={{ fontSize: "0.9em", color: "#666", marginBottom: "15px" }}>Recommended: Use stablecoins (USDT, USDC, DAI) for consistent value</p>

            <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap" }}>
              <select
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", flex: "1", minWidth: "150px" }}
              >
                <option value="">Select Token</option>

                {/* Recommended Stablecoins Section */}
                <optgroup label="🌟 Recommended Stablecoins">
                  {Object.entries(getCurrentNetwork(selectedNetwork).tokens)
                    .filter(([_, token]) => token.recommended && token.address !== "0x0000000000000000000000000000000000000000")
                    .map(([key, token]) => (
                      <option key={key} value={key}>{token.symbol} - {token.name}</option>
                    ))
                  }
                </optgroup>

                {/* Other Tokens Section */}
                <optgroup label="Other Tokens">
                  <option value="ETH">ETH - Ethereum</option>
                  {Object.entries(getCurrentNetwork(selectedNetwork).tokens)
                    .filter(([_, token]) => !token.recommended || token.address === "0x0000000000000000000000000000000000000000")
                    .map(([key, token]) => (
                      <option key={key} value={key} disabled={token.address === "0x0000000000000000000000000000000000000000"}>
                        {token.symbol} - {token.name} {token.address === "0x0000000000000000000000000000000000000000" ? "(Not Available)" : ""}
                      </option>
                    ))
                  }
                </optgroup>
              </select>

              <input
                type="text"
                placeholder={`Amount ${selectedToken ? `(${selectedToken})` : ''}`}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", flex: "2", minWidth: "200px" }}
              />

              <button
                onClick={deposit}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: selectedToken && getCurrentNetwork(selectedNetwork).tokens[selectedToken]?.recommended ? "#28a745" : "#007bff",
                  color: "white",
                  cursor: "pointer",
                  minWidth: "100px"
                }}
              >
                Deposit
              </button>
            </div>

          </div>

          {/* Spending Limits Section */}
          <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #333", borderRadius: "5px", backgroundColor: "#2d3748", color: "white" }}>
            <h3 style={{ color: "white" }}>⏰ Set Spending Limits</h3>
            <p style={{ fontSize: "0.9em", color: "#cbd5e0", marginBottom: "15px" }}>
              Control your spending with time-based limits. Every withdrawal checks against all active periods.
            </p>

            {/* Common Period Limits */}
            <div style={{ marginBottom: "15px", padding: "10px", backgroundColor: "#1a202c", borderRadius: "4px" }}>
              <h4 style={{ color: "#9ae6b4", margin: "0 0 15px 0" }}>🎆 Common Spending Limits</h4>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginBottom: "15px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.9em", color: "#e2e8f0", marginBottom: "5px" }}>📅 Daily Limit (USDT)</label>
                  <input
                    type="text"
                    placeholder="e.g., 50"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #4a5568",
                      backgroundColor: "#4a5568",
                      color: "white"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.9em", color: "#e2e8f0", marginBottom: "5px" }}>📊 Weekly Limit (USDT)</label>
                  <input
                    type="text"
                    placeholder="e.g., 300"
                    value={weeklyLimit}
                    onChange={(e) => setWeeklyLimit(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #4a5568",
                      backgroundColor: "#4a5568",
                      color: "white"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.9em", color: "#e2e8f0", marginBottom: "5px" }}>📈 Monthly Limit (USDT)</label>
                  <input
                    type="text"
                    placeholder="e.g., 1000"
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #4a5568",
                      backgroundColor: "#4a5568",
                      color: "white"
                    }}
                  />
                </div>
              </div>

              <div style={{ fontSize: "0.8em", color: "#a0aec0", marginBottom: "15px" }}>
                💡 Tip: Daily × 7 ≤ Weekly, Weekly × 4 ≤ Monthly for logical budgeting
              </div>

              <button
                onClick={setCommonSpendingLimits}
                style={{
                  padding: "12px 24px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#48bb78",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "1em",
                  fontWeight: "bold",
                  width: "100%"
                }}
              >
                ⏰ Set Spending Limits
              </button>
            </div>

            {/* Custom Period Section */}
            <div style={{ marginBottom: "15px" }}>
              <button
                onClick={() => setShowCustomPeriod(!showCustomPeriod)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "1px solid #4a5568",
                  backgroundColor: "transparent",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: "0.9em"
                }}
              >
                {showCustomPeriod ? '➖ Hide' : '➕ Add'} Custom Time Period
              </button>

              {/* Custom Period Form */}
              {showCustomPeriod && (
                <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#1a202c", borderRadius: "4px", border: "1px solid #4a5568" }}>
                  <h4 style={{ color: "#fbb6ce", margin: "0 0 15px 0" }}>⚙️ Custom Time Period</h4>
                  <p style={{ fontSize: "0.8em", color: "#a0aec0", marginBottom: "15px" }}>
                    Create custom periods like "Salary Cycle", "Quarterly Budget", or any duration you need.
                  </p>

                  <div style={{ display: "grid", gap: "10px", marginBottom: "15px" }}>
                    {/* Period Name */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.9em", color: "#e2e8f0", marginBottom: "5px" }}>Period Name</label>
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
                          color: "white"
                        }}
                      />
                    </div>

                    {/* Limit and Duration */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.9em", color: "#e2e8f0", marginBottom: "5px" }}>Limit (USDT)</label>
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
                            color: "white"
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.9em", color: "#e2e8f0", marginBottom: "5px" }}>Duration</label>
                        <select
                          value={customPeriodDuration}
                          onChange={(e) => setCustomPeriodDuration(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px",
                            borderRadius: "4px",
                            border: "1px solid #4a5568",
                            backgroundColor: "#4a5568",
                            color: "white"
                          }}
                        >
                          <option value="3600">Per Hour</option>
                          <option value="86400">Per Day</option>
                          <option value="604800">Per Week</option>
                          <option value="1209600">Bi-weekly (14 days)</option>
                          <option value="2592000">Per Month (30 days)</option>
                          <option value="7776000">Per Quarter (90 days)</option>
                          <option value="15552000">Semi-annual (180 days)</option>
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
                      width: "100%"
                    }}
                  >
                    ⚙️ Add Custom Period
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Exchange Deposit Section */}
          <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #333", borderRadius: "5px", backgroundColor: "#2d3748", color: "white" }}>
            <h3 style={{ color: "white" }}>🏦 Direct Deposit from Exchange</h3>
            <p style={{ fontSize: "0.9em", color: "#cbd5e0", marginBottom: "15px" }}>Get your personal deposit address to receive funds directly from exchanges</p>

            {/* Conditional rendering based on proxy status */}
            {!isProxyDeployed && !isDeploying && (
              <div style={{
                padding: "15px",
                backgroundColor: "#1a202c",
                borderRadius: "4px",
                border: "1px solid #4a5568",
                textAlign: "center"
              }}>
                <div style={{ marginBottom: "15px" }}>
                  <div style={{ fontSize: "2em", marginBottom: "10px" }}>🔒</div>
                  <h4 style={{ color: "#e2e8f0", margin: "0 0 8px 0" }}>Deposit Address Not Generated</h4>
                  <p style={{ color: "#a0aec0", fontSize: "0.9em", margin: "0" }}>
                    Generate your unique deposit address to receive funds directly from exchanges
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
                    fontWeight: "bold"
                  }}
                >
                  🎯 Generate Deposit Address
                </button>

                <div style={{ marginTop: "15px", fontSize: "0.8em", color: "#718096" }}>
                  <p style={{ margin: "5px 0" }}>✨ One-time setup • Gas fee required</p>
                  <p style={{ margin: "5px 0" }}>🎯 Direct exchange withdrawals • No manual deposits needed</p>
                </div>
              </div>
            )}

            {/* Deploying state */}
            {isDeploying && (
              <div style={{
                padding: "15px",
                backgroundColor: "#1a202c",
                borderRadius: "4px",
                border: "1px solid #4a5568",
                textAlign: "center"
              }}>
                <div style={{ marginBottom: "15px" }}>
                  <div style={{ fontSize: "2em", marginBottom: "10px" }}>⏳</div>
                  <h4 style={{ color: "#e2e8f0", margin: "0 0 8px 0" }}>Generating Deposit Address...</h4>
                  <p style={{ color: "#a0aec0", fontSize: "0.9em", margin: "0" }}>
                    Please confirm the transaction in MetaMask and wait for deployment
                  </p>
                </div>

                <div style={{
                  padding: "12px 24px",
                  borderRadius: "6px",
                  backgroundColor: "#4a5568",
                  color: "#a0aec0",
                  fontSize: "1em"
                }}>
                  🔄 Deploying Contract...
                </div>
              </div>
            )}

            {/* Generated state */}
            {isProxyDeployed && proxyAddress && (
              <div style={{
                padding: "15px",
                backgroundColor: "#1a202c",
                borderRadius: "4px",
                border: "1px solid #48bb78"
              }}>
                <div style={{ marginBottom: "15px", textAlign: "center" }}>
                  <div style={{ fontSize: "2em", marginBottom: "10px" }}>✅</div>
                  <h4 style={{ color: "#9ae6b4", margin: "0 0 8px 0" }}>Deposit Address Generated</h4>
                  <p style={{ color: "#e2e8f0", fontSize: "0.9em", margin: "0" }}>
                    Use this address to receive funds directly from exchanges
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "15px" }}>
                  <strong style={{ color: "white", minWidth: "120px" }}>Your Deposit Address:</strong>
                  <code style={{
                    backgroundColor: "#4a5568",
                    color: "#9ae6b4",
                    padding: "8px",
                    borderRadius: "4px",
                    fontSize: "0.9em",
                    wordBreak: "break-all",
                    flex: 1
                  }}>
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
                      fontSize: "0.8em"
                    }}
                  >
                    📋 Copy
                  </button>
                </div>

                <div style={{ fontSize: "0.8em", color: "#9ae6b4", textAlign: "center" }}>
                  ✅ Ready for direct deposits from exchanges!
                </div>
              </div>
            )}
          </div>

          {/* Pending Bypass Requests Section */}
          {pendingBypassRequests.length > 0 && (
            <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #333", borderRadius: "5px", backgroundColor: "#2d3748", color: "white" }}>
              <h3 style={{ color: "white" }}>⏳ Pending Bypass Requests ({pendingBypassRequests.length})</h3>
              <p style={{ fontSize: "0.9em", color: "#cbd5e0", marginBottom: "15px" }}>
                Your pending bypass requests with countdown timers. Execute them after the 24-hour timelock expires.
              </p>

              <div style={{ display: "grid", gap: "15px" }}>
                {pendingBypassRequests.map((request, index) => {
                  const countdown = formatCountdown(request.executeAfter, currentTime);

                  return (
                    <div key={index} style={{
                      padding: "15px",
                      border: countdown.ready ? "1px solid #48bb78" : "1px solid #4a5568",
                      borderRadius: "8px",
                      backgroundColor: "#1a202c"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "10px" }}>
                        <h4 style={{ color: "white", margin: 0 }}>
                          💸 {request.amount} {request.tokenSymbol}
                        </h4>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{
                            fontSize: "0.8em",
                            padding: "4px 8px",
                            borderRadius: "12px",
                            backgroundColor: countdown.ready ? "#48bb78" : "#4a5568",
                            color: "white",
                            fontWeight: "bold"
                          }}>
                            {countdown.ready ? "⚡ Ready!" : "⏰ Pending"}
                          </span>
                          {countdown.ready && (
                            <button
                              onClick={() => executeBypassRequest(request.requestId)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "4px",
                                border: "none",
                                backgroundColor: "#48bb78",
                                color: "white",
                                cursor: "pointer",
                                fontSize: "0.8em",
                                fontWeight: "bold"
                              }}
                            >
                              ⚡ Execute
                            </button>
                          )}
                          <button
                            onClick={() => cancelBypassRequest(request.requestId)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "4px",
                              border: "1px solid #e53e3e",
                              backgroundColor: "transparent",
                              color: "#e53e3e",
                              cursor: "pointer",
                              fontSize: "0.8em"
                            }}
                          >
                            ❌ Cancel
                          </button>
                        </div>
                      </div>

                      <div style={{ marginBottom: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                          <span style={{ color: "#e2e8f0", fontSize: "0.9em" }}>Bypass Period:</span>
                          <span style={{ color: "#9ae6b4", fontWeight: "bold" }}>{request.skipPeriod}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8em", color: "#a0aec0" }}>
                          <span>Request ID: {request.requestId.slice(0, 10)}...</span>
                          <span>Submitted: {new Date(request.timestamp * 1000).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Countdown Display */}
                      <div style={{
                        padding: "8px 12px",
                        backgroundColor: "#4a5568",
                        borderRadius: "4px",
                        textAlign: "center",
                        color: countdown.color,
                        fontWeight: "bold",
                        fontSize: "0.9em"
                      }}>
                        {countdown.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: "15px", fontSize: "0.8em", color: "#a0aec0" }}>
                💡 Bypass requests allow you to skip one spending limit while still respecting others.
                Each request requires a 24-hour timelock for security.
              </div>
            </div>
          )}

          {/* Two-Phase System Status */}
          <div style={{ marginBottom: "20px", padding: "15px", border: "2px solid #333", borderRadius: "5px", backgroundColor: isSetupCommitted ? "#1a365d" : "#2d3748", color: "white" }}>
            <h3 style={{ color: "white" }}>Setup Status: {isSetupCommitted ? "🔒 Locked Mode" : "⚙️ Setup Mode"}</h3>
            {!isSetupCommitted ? (
              <div>
                <p style={{ color: "#e2e8f0" }}>You are in setup mode. You can freely add/modify categories.</p>
                <p style={{ color: "#fbb6ce" }}><strong>⚠️ Once you commit, increases will require 24-72h timelock!</strong></p>
                <button onClick={commitSetup} style={{ backgroundColor: "#e53e3e", color: "white", padding: "10px 20px", border: "none", borderRadius: "5px", cursor: "pointer" }}>
                  Commit Setup & Enter Locked Mode
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color: "#9ae6b4" }}>✅ Setup committed on {setupInfo?.commitTimestamp}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "10px", flexWrap: "wrap" }}>
                  <p style={{ color: "#e2e8f0", margin: 0 }}>📊 Total Locked Value: {setupInfo?.totalLockedValue} USDT</p>
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
                      transition: "background-color 0.2s"
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
                <p style={{ color: "#e2e8f0" }}>📈 Increases This Period: {setupInfo?.increasesInPeriod} USDT</p>
                <p style={{ color: "white" }}><strong>Security Rules:</strong></p>
                <ul style={{ fontSize: "0.9em", color: "#cbd5e0" }}>
                  <li>Increases: 24-72h timelock required</li>
                  <li>Decreases: Immediate</li>
                  <li>Max increase: 20% of locked value per 7 days</li>
                </ul>
              </div>
            )}
          </div>


          {/* Simple Withdrawal Section */}
          <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #333", borderRadius: "5px", backgroundColor: "#2d3748", color: "white" }}>
            <h3 style={{ color: "white" }}>💸 Withdraw Funds</h3>
            <p style={{ fontSize: "0.9em", color: "#cbd5e0", marginBottom: "15px" }}>
              Withdrawals are automatically checked against all your active spending limits.
            </p>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Amount (USDT)"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #4a5568",
                  backgroundColor: "#4a5568",
                  color: "white"
                }}
              />
              <button
                onClick={withdrawFunds}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "#e53e3e",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                💸 Withdraw
              </button>
            </div>
          </div>

          {/* Bypass Request Section */}
          <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #333", borderRadius: "5px", backgroundColor: "#2d3748", color: "white" }}>
            <h3 style={{ color: "white" }}>⚡ Bypass Spending Limits</h3>
            <p style={{ fontSize: "0.9em", color: "#cbd5e0", marginBottom: "15px" }}>
              Request to bypass a spending limit and use available higher-tier allowance. Requests are executable after 24 hours.
            </p>

            <div style={{ marginBottom: "15px" }}>
              <button
                onClick={() => setShowBypassForm(!showBypassForm)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "1px solid #4a5568",
                  backgroundColor: "transparent",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: "0.9em"
                }}
              >
                {showBypassForm ? '➖ Hide' : '➕ Request'} Bypass
              </button>
            </div>

            {/* Bypass Request Form */}
            {showBypassForm && (
              <div style={{ padding: "15px", backgroundColor: "#1a202c", borderRadius: "4px", border: "1px solid #4a5568" }}>
                <h4 style={{ color: "#fbb6ce", margin: "0 0 15px 0" }}>⚡ New Bypass Request</h4>
                <p style={{ fontSize: "0.8em", color: "#a0aec0", marginBottom: "15px" }}>
                  Example: If you hit your daily limit but have weekly allowance remaining, you can bypass daily and use weekly.
                </p>

                <div style={{ display: "grid", gap: "15px", marginBottom: "15px" }}>
                  {/* Amount and Token */}
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.9em", color: "#e2e8f0", marginBottom: "5px" }}>Amount</label>
                      <input
                        type="text"
                        placeholder="Amount to withdraw"
                        value={bypassAmount}
                        onChange={(e) => setBypassAmount(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #4a5568",
                          backgroundColor: "#4a5568",
                          color: "white"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.9em", color: "#e2e8f0", marginBottom: "5px" }}>Token</label>
                      <select
                        value={bypassToken}
                        onChange={(e) => setBypassToken(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #4a5568",
                          backgroundColor: "#4a5568",
                          color: "white"
                        }}
                      >
                        <option value="ETH">ETH</option>
                        {Object.entries(getCurrentNetwork(selectedNetwork).tokens)
                          .filter(([_, token]) => token.address !== "0x0000000000000000000000000000000000000000")
                          .map(([key, token]) => (
                            <option key={key} value={key}>{token.symbol}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>

                  {/* Period to Skip */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.9em", color: "#e2e8f0", marginBottom: "5px" }}>Period to Bypass</label>
                    <select
                      value={bypassPeriod}
                      onChange={(e) => setBypassPeriod(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #4a5568",
                        backgroundColor: "#4a5568",
                        color: "white"
                      }}
                    >
                      {spendingLimits.map((limit) => (
                        <option key={limit.name} value={limit.name}>
                          {limit.name} (Remaining: {limit.remaining} USDT)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: "15px", fontSize: "0.8em", color: "#a0aec0" }}>
                  💡 After submitting, your request will be executable in 24 hours. Other spending limits will still apply.
                </div>

                <button
                  onClick={requestBypass}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: "#ed64a6",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "1em",
                    fontWeight: "bold",
                    width: "100%"
                  }}
                >
                  ⚡ Submit Bypass Request
                </button>
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

          <button
            onClick={fetchSpendingLimits}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "none",
              backgroundColor: "#4a5568",
              color: "white",
              cursor: "pointer",
              marginBottom: "15px"
            }}
          >
            🔄 Refresh Spending Limits
          </button>

          <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #333", borderRadius: "5px", backgroundColor: "#2d3748", color: "white" }}>
            <h3 style={{ color: "white" }}>⏰ Your Spending Limits ({spendingLimits.length})</h3>
            {spendingLimits.length === 0 ? (
              <p style={{ color: "#a0aec0", fontStyle: "italic" }}>No spending limits set. Set your limits above to control spending.</p>
            ) : (
              <div style={{ display: "grid", gap: "15px" }}>
                {spendingLimits.map((limit, index) => {
                  // Calculate progress percentage
                  const progressPercent = limit.limit > 0 ? (parseFloat(limit.spent) / parseFloat(limit.limit)) * 100 : 0;
                  const isNearLimit = progressPercent > 80;
                  const isAtLimit = progressPercent >= 100;

                  return (
                    <div key={index} style={{
                      padding: "15px",
                      border: isAtLimit ? "1px solid #e53e3e" : isNearLimit ? "1px solid #ed8936" : "1px solid #48bb78",
                      borderRadius: "8px",
                      backgroundColor: "#1a202c"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                        <h4 style={{ color: "white", margin: 0 }}>⏰ {limit.name}</h4>
                        <span style={{
                          fontSize: "0.8em",
                          padding: "4px 8px",
                          borderRadius: "12px",
                          backgroundColor: isAtLimit ? "#e53e3e" : isNearLimit ? "#ed8936" : "#48bb78",
                          color: "white"
                        }}>
                          {progressPercent.toFixed(0)}% used
                        </span>
                      </div>

                      <div style={{ marginBottom: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                          <span style={{ color: "#e2e8f0", fontSize: "0.9em" }}>Remaining</span>
                          <span style={{ color: isAtLimit ? "#fc8181" : "#9ae6b4", fontWeight: "bold" }}>
                            {limit.remaining} USDT
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8em", color: "#a0aec0" }}>
                          <span>Spent: {limit.spent} USDT</span>
                          <span>Limit: {limit.limit} USDT</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{
                        width: "100%",
                        height: "6px",
                        backgroundColor: "#4a5568",
                        borderRadius: "3px",
                        overflow: "hidden",
                        marginBottom: "8px"
                      }}>
                        <div style={{
                          width: `${Math.min(progressPercent, 100)}%`,
                          height: "100%",
                          backgroundColor: isAtLimit ? "#e53e3e" : isNearLimit ? "#ed8936" : "#48bb78",
                          transition: "width 0.3s ease"
                        }} />
                      </div>

                      <div style={{ fontSize: "0.8em", color: "#718096" }}>
                        Duration: {limit.durationDays > 0 ? `${limit.durationDays} days` : `${limit.durationHours} hours`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
