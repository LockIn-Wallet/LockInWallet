import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { ethers } from "ethers";
import SavingsABI from "./SavingsABI.json";
import { useNetworkManager } from "./hooks/useNetworkManager.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import "@solana/wallet-adapter-react-ui/styles.css";

import {
  styles,
  buttonStyles,
  colors,
  spacing,
  fontSize,
} from "./styles";
import {
  NETWORKS,
  getCurrentNetwork,
  calculateInstantWithdrawableAmount,
} from "./utils/walletUtils.js";
import {
  getDefaultNetwork,
  getAvailableNetworks,
} from "./utils/networkFilter.js";
import { isSolanaEnabled, isPrizePoolEnabled, isYieldEnabled } from "./utils/featureFlags.js";
import { createEmptyLimitEdits } from "./utils/spendingPeriods.js";
import { PRIZE_SAVINGS_PATH } from "./utils/prizeSavingsContent.js";
import {
  ensureCorrectNetwork,
  createProviderAndSigner,
} from "./utils/providerManager.js";
import {
  createCircuitBreakers,
  safeContractCall,
  debounce,
} from "./utils/circuitBreaker.js";
import {
  createErrorHandler,
  getNetworkErrorMessage,
  getDevErrorDetails,
} from "./utils/errorHandling.js";
import { TransactionManager, clearVaultCache } from "./adapters/TransactionManager.js";
import { clearNetworkStorage } from "./utils/networkIsolation.js";
import {
  isWalletLoggedOut,
  markWalletLoggedOut,
  clearWalletLoggedOut,
} from "./utils/walletSession.js";
import {
  fetchSpendingLimits as fetchSpendingLimitsService,
  captureReferrerFromUrl,
} from "./services";

import SolanaWalletProvider from "./components/SolanaWalletProvider.js";
import SocialLinks from "./components/atoms/SocialLinks.js";
import Footer from "./components/atoms/Footer.js";
import CollapsibleSection from "./components/atoms/CollapsibleSection.js";
import YieldSection from "./components/organisms/YieldSection.js";
import StatusHeader from "./components/molecules/StatusHeader.js";
import WalletConnectionPrompt from "./components/molecules/WalletConnectionPrompt.js";
import WalletOnboardingModal from "./components/molecules/WalletOnboardingModal.js";
import BalanceDisplay from "./components/molecules/BalanceDisplay.js";
import AllowanceBar from "./components/molecules/AllowanceBar.js";
import DepositInterface from "./components/molecules/DepositInterface.js";
import TransactionHistory from "./components/molecules/TransactionHistory.js";
import SpendingLimitsSetup from "./components/organisms/SpendingLimitsSetup.js";
import SetupCommitStep from "./components/organisms/SetupCommitStep.js";
import WithdrawalAddressSetupStep from "./components/organisms/WithdrawalAddressSetupStep.js";
import WithdrawalInterface from "./components/organisms/WithdrawalInterface.js";
import ReferralSection from "./components/organisms/ReferralSection.js";
import RecoverySection from "./components/organisms/RecoverySection.js";
import UpgradeBanner from "./components/molecules/UpgradeBanner.js";
import GovernancePage from "./components/pages/GovernancePage.js";
import VaultCard from "./components/molecules/VaultCard.js";

import CreateVault from "./components/pages/CreateVault.js";

// Split out so chart.js only downloads for visitors who open the visualiser
const SavingsVisualiser = lazy(() =>
  import("./components/pages/SavingsVisualiser.js")
);

const PrizeSavings = lazy(() => import("./components/pages/PrizeSavings.js"));

// Content pages that need the full width — the 800px app column cramps them
const WIDE_ROUTES = ["/savings-visualiser", PRIZE_SAVINGS_PATH];

function MainFlow({
  transactionManager,
  navigate,
  networkConfig,
  networkType,
  selectedNetwork,
  onSetupCommitted,
  // Solana props
  wallet,
  connection,
  // EVM props
  provider,
  signer,
  savingsContract,
  evmUserAddress,
}) {
  const solanaConnected = networkType === "solana" ? (wallet?.connected || false) : false;
  const solanaPublicKey = networkType === "solana" ? (wallet?.publicKey || null) : null;
  const userAddress = networkType === "solana"
    ? wallet?.publicKey?.toString() || null
    : evmUserAddress || null;

  const [isSetupCommitted, setIsSetupCommitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [spendingLimits, setSpendingLimits] = useState([]);
  const [limitEdits, setLimitEdits] = useState(() => createEmptyLimitEdits());
  const [balances, setBalances] = useState({});
  const [selectedToken, setSelectedToken] = useState("USDT");
  const [instantWithdrawableAmount, setInstantWithdrawableAmount] = useState(0);
  const [limitingPeriod, setLimitingPeriod] = useState("");

  const [userVaults, setUserVaults] = useState([]);
  const [balanceRefreshTrigger, setBalanceRefreshTrigger] = useState(0);
  const [limitsMode, setLimitsMode] = useState("fixed");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchSpendingLimits = useCallback(async () => {
    try {
      const spendingData = await fetchSpendingLimitsService({
        transactionManager,
        networkType,
      });
      setSpendingLimits(spendingData.limits || []);
      setIsSetupCommitted(spendingData.isSetupCommitted || false);
    } catch (err) {
      console.error("Error fetching spending limits:", err);
    }
  }, [transactionManager, networkType]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        if (networkType === "solana") {
          const committed = transactionManager.isSetupCommitted();
          setIsSetupCommitted(committed);
          if (committed) {
            await fetchSpendingLimits();
            await loadUserVaults();
          }
        } else {
          const committed = await transactionManager.getIsSetupCommitted(userAddress);
          setIsSetupCommitted(committed);
          if (committed) {
            await fetchSpendingLimits();
          }
          await loadUserVaults();
        }
      } catch (err) {
        console.error("Setup check failed:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [transactionManager, fetchSpendingLimits, networkType, userAddress]);

  useEffect(() => {
    if (spendingLimits.length > 0) {
      const result = calculateInstantWithdrawableAmount(spendingLimits);
      if (result) {
        setInstantWithdrawableAmount(result.amount || 0);
        setLimitingPeriod(result.limitingPeriod || "");
      }
    }
  }, [spendingLimits]);

  const loadUserVaults = async () => {
    const vaults = await transactionManager.getUserVaults().catch(() => []);
    setUserVaults(vaults);
  };

  // The main wallet flow operates on the currently selected ("active") vault —
  // the personal vault by default. Selecting a card switches the whole flow
  // (balances, deposits, withdrawals, limits) to that vault. On EVM the initial
  // setup lives in the legacy savings account rather than a vault, so it is
  // represented by a synthetic "Savings" card.
  const personalVaultAddress = transactionManager?.getPersonalVaultAddress?.() || null;
  const currentVaultAddress = transactionManager?.getActiveVaultAddress?.() || null;
  const hasPersonalVault = userVaults.some(({ vault }) => vault.address === personalVaultAddress);

  const handleSelectVault = async (vaultAddress) => {
    // null selects the default: personal vault / legacy account
    transactionManager.setActiveVault(
      vaultAddress === personalVaultAddress ? null : vaultAddress
    );
    await fetchSpendingLimits();
    setBalanceRefreshTrigger((prev) => prev + 1);
  };

  const displayVaults = [
    ...(hasPersonalVault
      ? []
      : [{
          vault: {
            address: null,
            vaultType: "Personal",
            name: "Savings",
            tokenSymbol: "All tokens",
            dailyLimit: 0,
            weeklyLimit: 0,
            monthlyLimit: 0,
            penaltyRateBps: 0,
            memberCount: 1,
          },
          membership: null,
          isCurrent: currentVaultAddress === null,
        }]),
    ...userVaults
      .map((entry) => ({ ...entry, isCurrent: entry.vault.address === currentVaultAddress }))
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)),
  ];

  const refreshBalances = useCallback(async () => {
    await fetchSpendingLimits();
    setBalanceRefreshTrigger((prev) => prev + 1);
  }, [fetchSpendingLimits]);

  const handleSpendingLimitsUpdate = useCallback((limits, edits) => {
    setSpendingLimits(limits);
    if (edits) setLimitEdits(edits);
  }, []);

  const getCurrentUserAddress = useCallback(() => {
    return userAddress;
  }, [userAddress]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: colors.text.secondary }}>
        Loading your wallet...
      </div>
    );
  }

  return (
    <div>
      {/* Queued contract changes — users get the timelock window to review/exit */}
      <UpgradeBanner
        transactionManager={transactionManager}
        currentTime={currentTime}
        navigate={navigate}
      />

      {/* My Vaults Section (unlocked once the personal wallet setup is committed) */}
      {isSetupCommitted && (
        <div style={{ marginBottom: spacing.xl }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            // Wraps rather than crushing the heading into two words per line
            // when the column narrows on a phone
            flexWrap: "wrap",
            gap: spacing.md,
            marginBottom: spacing.lg,
          }}>
            <h3 style={{ color: colors.text.primary, margin: 0, textAlign: "left" }}>
              My Vaults
            </h3>
            <div style={{ display: "flex", gap: spacing.sm }}>
              <button style={buttonStyles.primary} onClick={() => navigate("/create")}>
                + Create Vault
              </button>
              <button
                style={{ ...buttonStyles.secondary, fontSize: fontSize.xs }}
                onClick={loadUserVaults}
              >
                Refresh
              </button>
            </div>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: spacing.lg,
          }}>
            {displayVaults.map(({ vault, isCurrent }) => (
              <VaultCard
                key={vault.address || "default"}
                vault={vault}
                isSelected={isCurrent}
                onClick={isCurrent ? undefined : () => handleSelectVault(vault.address)}
              />
            ))}
          </div>
          <p style={{
            fontSize: fontSize.xs,
            color: colors.text.secondary,
            marginTop: spacing.sm,
            marginBottom: 0,
          }}>
            Everything below — balances, deposits, withdrawals and limits — belongs to the
            selected vault. Click a vault to switch, or create one for a separate purpose.
          </p>
        </div>
      )}

      {/* Everything below operates on the selected vault. The key remounts
          these sections on vault switch so each one refetches its data
          (balances, deposit address, limits, history) for the new vault. */}
      <div key={currentVaultAddress || "default"}>

      {/* What you can withdraw right now, above everything else. On a
          single-page app this is the one number worth never scrolling for. */}
      {isSetupCommitted && (
        <AllowanceBar
          transactionManager={transactionManager}
          userAddress={userAddress}
          currentTime={currentTime}
        />
      )}

      {/* Balance Display (only when setup committed) */}
      {isSetupCommitted && (
        <BalanceDisplay
          transactionManager={transactionManager}
          savingsContract={savingsContract}
          signer={signer}
          connection={connection}
          networkType={networkType}
          selectedNetwork={selectedNetwork}
          userAddress={userAddress}
          solanaPublicKey={solanaPublicKey}
          solanaConnected={solanaConnected}
          isSetupCommitted={isSetupCommitted}
          provider={provider}
          solanaWallet={wallet}
          balances={balances}
          onBalanceUpdate={(newBalances) => setBalances(newBalances)}
          connectWallet={() => {}}
          refreshTrigger={balanceRefreshTrigger}
        />
      )}

      {/* Deposit Interface (only when committed) */}
      {isSetupCommitted && (
        <CollapsibleSection title="Deposit funds" icon="gift" defaultExpanded={true}>
          <DepositInterface
            transactionManager={transactionManager}
            savingsContract={savingsContract}
            signer={signer}
            connection={connection}
            networkType={networkType}
            selectedNetwork={selectedNetwork}
            userAddress={userAddress}
            solanaPublicKey={solanaPublicKey}
            solanaConnected={solanaConnected}
            selectedToken={selectedToken}
            setSelectedToken={setSelectedToken}
            onBalanceUpdate={refreshBalances}
          />
        </CollapsibleSection>
      )}

      {/* Withdrawal Interface. Sits above the limits once the wallet is
          locked: taking money out is the routine act, while reviewing the
          limits is occasional. During setup it does not render at all. */}
      {isSetupCommitted && (
        <CollapsibleSection title="Withdraw funds" icon="arrowRight" defaultExpanded={true}>
          <WithdrawalInterface
            transactionManager={transactionManager}
            activeVaultAddress={currentVaultAddress}
            savingsContract={savingsContract}
            signer={signer}
            connection={connection}
            networkType={networkType}
            selectedNetwork={selectedNetwork}
            getCurrentUserAddress={getCurrentUserAddress}
            solanaConnected={solanaConnected}
            solanaPublicKey={solanaPublicKey}
            userAddress={userAddress}
            selectedToken={selectedToken}
            setSelectedToken={setSelectedToken}
            instantWithdrawableAmount={instantWithdrawableAmount}
            limitingPeriod={limitingPeriod}
            spendingLimits={spendingLimits}
            onBalanceUpdate={refreshBalances}
            onSpendingLimitsUpdate={fetchSpendingLimits}
            currentTime={currentTime}
          />
        </CollapsibleSection>
      )}

      {/* Earning on savings. Sits with the money-movement sections, and inside
          the vault-keyed wrapper above so switching vaults refetches it. The
          section hides itself when earning does not apply to this vault. */}
      {isSetupCommitted && isYieldEnabled() && transactionManager?.supportsYield?.() ? (
        <YieldSection transactionManager={transactionManager} />
      ) : null}

      {/* Spending Limits Setup / Management */}
      {isSetupCommitted ? (
        <CollapsibleSection title="Spending limits" icon="clock" defaultExpanded={true}>
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
            activeVaultAddress={currentVaultAddress}
          />
        </CollapsibleSection>
      ) : (
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
          limitsMode={limitsMode}
          onLimitsModeChange={setLimitsMode}
          showModeToggle={transactionManager?.supportsPercentSetupLimits?.() || false}
        />
      )}

      {/* Withdrawal Addresses Setup (only during setup) */}
      {!isSetupCommitted && (
        <WithdrawalAddressSetupStep
          isSetupCommitted={isSetupCommitted}
          spendingLimits={spendingLimits}
          transactionManager={transactionManager}
          savingsContract={savingsContract}
          networkType={networkType}
          solanaConnected={solanaConnected}
          solanaPublicKey={solanaPublicKey}
          userAddress={userAddress}
        />
      )}

      {/* Setup Commit Step (only during setup) */}
      {!isSetupCommitted && (
        <SetupCommitStep
          isSetupCommitted={isSetupCommitted}
          spendingLimits={spendingLimits}
          limitEdits={limitEdits}
          transactionManager={transactionManager}
          savingsContract={savingsContract}
          networkType={networkType}
          solanaConnected={solanaConnected}
          userAddress={userAddress}
          onSetupCommitted={(committed) => {
            setIsSetupCommitted(committed);
            onSetupCommitted?.(committed);
            if (committed) {
              loadUserVaults();
            }
          }}
          onSpendingLimitsRefresh={fetchSpendingLimits}
          limitsMode={limitsMode}
        />
      )}

      {/* Transaction History (only when committed) */}
      {isSetupCommitted && (
        <CollapsibleSection title="Transaction history" icon="eye" defaultExpanded={true}>
          <TransactionHistory
            savingsContract={savingsContract}
            userAddress={userAddress}
            networkType={networkType}
            selectedNetwork={selectedNetwork}
            transactionManager={transactionManager}
          />
        </CollapsibleSection>
      )}

      {/* Referral Program (only when committed) */}
      {isSetupCommitted && transactionManager?.supportsReferrals?.() && (
        <CollapsibleSection title="Invite and earn" icon="chain" defaultExpanded={false}>
          <ReferralSection
            transactionManager={transactionManager}
            userAddress={getCurrentUserAddress()}
          />
        </CollapsibleSection>
      )}

      {/* Recovery Protection (shown whenever the chain supports it, so a
          recovery key can be registered before OR after lock-in and a cold
          key holder can manage a compromised account from here) */}
      {transactionManager?.supportsRecovery?.() && (
        <CollapsibleSection title="Recovery protection" icon="key" defaultExpanded={false}>
          <RecoverySection
            transactionManager={transactionManager}
            userAddress={getCurrentUserAddress()}
          />
        </CollapsibleSection>
      )}

      </div>
    </div>
  );
}

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
  const [evmUserAddress, setEvmUserAddress] = useState("");
  const [currentChainId, setCurrentChainId] = useState(null);
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
  // Raised when someone presses connect with no wallet extension installed
  const [showWalletOnboarding, setShowWalletOnboarding] = useState(false);

  // Solana wallet state
  let solanaConnected = false;
  let solanaPublicKey = null;
  let solanaDisconnect = () => {};
  let solanaWallet = null;
  let solanaSendTransaction = () => {};
  let solanaSignTransaction = () => {};
  let solanaSignAllTransactions = () => {};
  let connection = null;

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

  const [transactionManager, setTransactionManager] = useState(null);
  const [circuitBreakers] = useState(() => createCircuitBreakers());
  const walletOperationInProgress = useRef(false);
  const [isSetupCommitted, setIsSetupCommitted] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const isWideRoute = WIDE_ROUTES.includes(location.pathname);

  // Capture a ?ref= referral link once on load, before any wallet connects
  useEffect(() => {
    captureReferrerFromUrl();
  }, []);

  const clearAllState = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setSavingsContract(null);
    setEvmUserAddress("");
    setIsSetupCommitted(false);
    setTransactionManager(null);
  }, []);

  // Log out of the connected wallet and return to the logged-out home page.
  // Neither MetaMask nor the Solana adapter can be told to forget the site, so
  // the flag is what actually keeps the user logged out across a reload.
  const disconnectWallet = useCallback(async () => {
    const address =
      networkType === "solana" ? solanaPublicKey?.toString() : evmUserAddress;

    markWalletLoggedOut();

    if (networkType === "solana") {
      try {
        await solanaDisconnect();
      } catch (error) {
        console.warn("Solana disconnect failed:", error.message);
      }
      // The adapter's own key — left behind, it boots the app back into Solana
      localStorage.removeItem("walletName");
    }

    clearAllState();
    walletOperationInProgress.current = false;
    clearNetworkStorage(networkType);
    clearVaultCache(address);

    navigate("/");
  }, [networkType, solanaPublicKey, evmUserAddress, solanaDisconnect, clearAllState, navigate]);

  const {
    detectCurrentNetwork,
    initializeTransactionManager,
    switchNetworkType,
    switchNetwork,
  } = useNetworkManager({
    solanaConnected,
    solanaPublicKey,
    solanaSendTransaction,
    solanaSignTransaction,
    solanaSignAllTransactions,
    solanaDisconnect,
    connection,
    setNetworkType,
    setSelectedNetwork,
    setCurrentChainId,
    setTransactionManager,
    setIsNetworkSwitching,
    clearAllState,
  });

  // Auto-initialize TransactionManager when wallet connects
  useEffect(() => {
    const initIfNeeded = async () => {
      if (transactionManager) return;

      if (networkType === "evm" && provider && signer && savingsContract) {
        try {
          await initializeTransactionManager(networkType, selectedNetwork, { provider, signer });
        } catch (error) {
          console.error("Error auto-initializing TransactionManager for EVM:", error);
        }
      } else if (networkType === "solana" && solanaConnected && solanaPublicKey && connection) {
        try {
          await initializeTransactionManager(networkType, selectedNetwork);
        } catch (error) {
          console.error("Error auto-initializing TransactionManager for Solana:", error);
        }
      }
    };
    initIfNeeded();
  }, [networkType, provider, signer, savingsContract, transactionManager,
      initializeTransactionManager, selectedNetwork, solanaConnected, solanaPublicKey, connection]);

  // Timer for countdown updates
  useEffect(() => {
    const timer = setInterval(() => {}, 1000);
    return () => clearInterval(timer);
  }, []);

  // MetaMask event listeners (EVM only)
  useEffect(() => {
    if (!window.ethereum) return;

    const handleChainChanged = (chainId) => {
      const numericChainId = parseInt(chainId, 16);
      setCurrentChainId(numericChainId);
      if (networkType !== "evm") return;
      const networkKey = Object.keys(NETWORKS.evm || {}).find(
        (key) => NETWORKS.evm[key].chainId === numericChainId
      );
      if (networkKey) {
        setSelectedNetwork(networkKey);
        autoConnectWallet();
      }
    };

    const handleAccountsChanged = (accounts) => {
      if (networkType !== "evm") return;
      if (accounts.length === 0) {
        clearAllState();
        walletOperationInProgress.current = false;
      } else {
        autoConnectWallet();
      }
    };

    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("accountsChanged", handleAccountsChanged);

    if (networkType === "evm") {
      detectCurrentNetwork();
      autoConnectWallet();
    }

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener("chainChanged", handleChainChanged);
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, [networkType]);

  // Auto-detect available wallet type on mount
  useEffect(() => {
    const hasMetaMask = !!window.ethereum;
    const hasPhantom = !!(window.phantom?.solana || window.solana?.isPhantom);
    const evmAvailable = hasMetaMask && getAvailableNetworks("evm").some((n) => n.deployed || n.isLocal);
    const solanaAvailable = hasPhantom && getAvailableNetworks("solana").some((n) => n.deployed || n.isLocal);

    if (solanaAvailable && !evmAvailable && networkType !== "solana") {
      switchNetworkType("solana", getDefaultNetwork("solana"));
    } else if (evmAvailable && !solanaAvailable && networkType !== "evm") {
      switchNetworkType("evm", getDefaultNetwork("evm"));
    }
  }, []);

  const connectWalletInternal = async () => {
    if (networkType === "evm") {
      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      const currentChain = parseInt(chainIdHex, 16);
      const expectedNetwork = getCurrentNetwork(networkType, selectedNetwork);
      if (currentChain !== expectedNetwork.chainId) {
        setCurrentChainId(currentChain);
        return;
      }
    }

    let web3Provider, web3Signer;
    try {
      const result = await createProviderAndSigner();
      web3Provider = result.provider;
      web3Signer = result.signer;
    } catch (error) {
      console.error("Failed to create provider:", error.message);
      alert(error.message);
      return;
    }

    const currentNetwork = getCurrentNetwork(networkType, selectedNetwork);
    const contractAddress = currentNetwork.savingsContract;

    if (contractAddress === "0x0000000000000000000000000000000000000000") {
      console.log(`Savings contract not deployed on ${currentNetwork.name} yet.`);
      return;
    }

    try {
      const code = await web3Provider.getCode(contractAddress);
      if (code === "0x" || code === "0x0" || code.length <= 2) {
        alert(`Contract not deployed at ${contractAddress}`);
        return;
      }
    } catch (error) {
      console.error("Contract verification failed:", error.message);
      return;
    }

    const savings = new ethers.Contract(contractAddress, SavingsABI, web3Signer);
    setProvider(web3Provider);
    setSigner(web3Signer);
    setSavingsContract(savings);

    const address = await web3Signer.getAddress();
    setEvmUserAddress(address);

    let txManager = null;
    try {
      txManager = await initializeTransactionManager(networkType, selectedNetwork, {
        provider: web3Provider,
        signer: web3Signer,
      });
    } catch (error) {
      console.error("Error initializing TransactionManager for EVM:", error);
    }

    try {
      if (txManager) {
        // Setup status lives in the ProposalSystemModule — the adapter
        // resolves it through the module registry
        const setupCommitted = await safeContractCall(
          () => txManager.getIsSetupCommitted(address),
          circuitBreakers.contracts
        );
        setIsSetupCommitted(!!setupCommitted);
      }
    } catch (error) {
      console.error("Error checking setup status:", error);
    }
  };

  const autoConnectWallet = debounce(async () => {
    // A user who logged out stays logged out until they connect again
    if (isWalletLoggedOut()) return;
    if (!window.ethereum || walletOperationInProgress.current) return;
    walletOperationInProgress.current = true;
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length === 0) return;

      if (networkType === "evm") {
        const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
        const currentChain = parseInt(chainIdHex, 16);
        const expectedNetwork = getCurrentNetwork(networkType, selectedNetwork);
        if (currentChain !== expectedNetwork.chainId) {
          setCurrentChainId(currentChain);
          return;
        }
      }
      await connectWalletInternal();
    } catch (error) {
      console.log("Auto-connect failed:", error.message);
    } finally {
      walletOperationInProgress.current = false;
    }
  }, 2000);

  const connectWallet = debounce(async () => {
    clearWalletLoggedOut();
    if (window.ethereum && !walletOperationInProgress.current) {
      walletOperationInProgress.current = true;
      try {
        if (networkType === "evm") {
          const networkSwitched = await ensureCorrectNetwork(selectedNetwork);
          if (!networkSwitched) {
            throw new Error(`Failed to switch to ${selectedNetwork} network.`);
          }
        }
        await window.ethereum.request({ method: "eth_requestAccounts" });
        await connectWalletInternal();
      } catch (error) {
        console.error("Wallet connection failed:", error.message);
        if (error.message.includes("User rejected")) {
          alert("Connection cancelled. Please try again.");
        } else {
          const walletErrorHandler = createErrorHandler("wallet_connection");
          const formattedError = walletErrorHandler(error);
          alert(formattedError.userMessage + getDevErrorDetails(formattedError));
        }
      } finally {
        walletOperationInProgress.current = false;
      }
    } else if (!window.ethereum) {
      // No extension at all — this is someone's first time, so explain what a
      // wallet is rather than barking an instruction at them
      setShowWalletOnboarding(true);
    }
  }, 1000);

  const handleConnectPhantom = useCallback(async () => {
    clearWalletLoggedOut();
    const defaultSolana = getDefaultNetwork("solana");
    await switchNetworkType("solana", defaultSolana);
  }, [switchNetworkType]);

  const handleConnectMetaMask = useCallback(async () => {
    clearWalletLoggedOut();
    if (networkType !== "evm") {
      const defaultEvm = getDefaultNetwork("evm");
      await switchNetworkType("evm", defaultEvm);
      setTimeout(() => connectWallet(), 500);
    } else {
      connectWallet();
    }
  }, [networkType, switchNetworkType, connectWallet]);

  const isWalletConnected = networkType === "solana"
    ? (solanaConnected && solanaWallet)
    : !!provider;

  // The logged-out landing page is a full-width page with its own nav and
  // footer — the app chrome would only duplicate them
  const isLanding = location.pathname === "/" && !isWalletConnected;

  const networkConfig = networkType === "solana"
    ? (NETWORKS.solana?.[selectedNetwork] || NETWORKS.solana?.localhost)
    : (NETWORKS.evm?.[selectedNetwork] || {});

  // Additional vaults unlock only after the personal wallet setup is committed.
  // TM answers synchronously on Solana (personal vault presence); on EVM it
  // returns null and we fall back to the on-chain setup check done at connect.
  const vaultsUnlocked = transactionManager?.isSetupCommitted() ?? isSetupCommitted;

  const mainFlowProps = {
    transactionManager,
    navigate,
    networkConfig,
    networkType,
    selectedNetwork,
    onSetupCommitted: setIsSetupCommitted,
    wallet: networkType === "solana" ? { connected: solanaConnected, publicKey: solanaPublicKey } : null,
    connection,
    provider,
    signer,
    savingsContract,
    evmUserAddress,
  };

  return (
    <div
      style={
        isLanding
          ? styles.app.containerLanding
          : isWideRoute
          ? styles.app.containerWide
          : styles.app.container
      }
    >
      <WalletOnboardingModal
        open={showWalletOnboarding}
        onClose={() => setShowWalletOnboarding(false)}
      />

      {!isLanding && <SocialLinks />}

      {!isLanding && (
      <StatusHeader
        provider={provider}
        networkType={networkType}
        selectedNetwork={selectedNetwork}
        isNetworkSwitching={isNetworkSwitching}
        currentChainId={currentChainId}
        userAddress={evmUserAddress}
        solanaWallet={solanaWallet}
        solanaPublicKey={solanaPublicKey}
        solanaConnected={solanaConnected}
        isSetupCommitted={isSetupCommitted}
        switchNetworkType={switchNetworkType}
        switchNetwork={switchNetwork}
        disconnectWallet={disconnectWallet}
      />
      )}

      <Routes>
        {/* Public — readable with or without a wallet */}
        <Route
          path="/savings-visualiser"
          element={
            <Suspense fallback={<div />}>
              <SavingsVisualiser />
            </Suspense>
          }
        />
        {/* Prize pool is feature-flagged off until it ships — with the flag
            off the catch-all below sends /prize-savings back home */}
        {isPrizePoolEnabled() && (
          <Route
            path={PRIZE_SAVINGS_PATH}
            element={
              <Suspense fallback={<div />}>
                <PrizeSavings />
              </Suspense>
            }
          />
        )}
        <Route
          path="/governance"
          element={
            <GovernancePage
              transactionManager={transactionManager}
              navigate={navigate}
            />
          }
        />

        {isWalletConnected && transactionManager ? (
          <>
            <Route path="/" element={<MainFlow {...mainFlowProps} />} />
            <Route
              path="/create"
              element={
                vaultsUnlocked ? (
                  <CreateVault
                    transactionManager={transactionManager}
                    navigate={navigate}
                    networkConfig={networkConfig}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
          </>
        ) : (
          <Route
            path="/"
            element={
              <WalletConnectionPrompt
                provider={provider}
                networkType={networkType}
                solanaConnected={solanaConnected}
                solanaWallet={solanaWallet}
                connectWallet={
                  networkType === "solana" ? handleConnectMetaMask : connectWallet
                }
                onConnectPhantom={handleConnectPhantom}
              />
            }
          />
        )}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!isLanding && <Footer />}
    </div>
  );
}

function AppContent() {
  const [networkType, setNetworkType] = useState(() => {
    // Solana login is feature-flagged off until its programs are deployed
    if (!isSolanaEnabled()) return "evm";
    const saved = localStorage.getItem("preferredNetworkType");
    if (saved === "solana" || saved === "evm") return saved;
    return localStorage.getItem("walletName") ? "solana" : "evm";
  });

  const [selectedNetwork, setSelectedNetwork] = useState(() => {
    const saved = localStorage.getItem(`preferred_${networkType}_network`);
    if (saved) {
      const available = getAvailableNetworks(networkType);
      if (available.some((n) => n.key === saved)) return saved;
    }
    return getDefaultNetwork(networkType);
  });

  if (networkType === "solana") {
    return (
      <SolanaWalletProvider networkType={networkType} selectedNetwork={selectedNetwork}>
        <AppContentInner
          networkType={networkType}
          setNetworkType={setNetworkType}
          selectedNetwork={selectedNetwork}
          setSelectedNetwork={setSelectedNetwork}
        />
      </SolanaWalletProvider>
    );
  }

  return (
    <AppContentInner
      networkType={networkType}
      setNetworkType={setNetworkType}
      selectedNetwork={selectedNetwork}
      setSelectedNetwork={setSelectedNetwork}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
