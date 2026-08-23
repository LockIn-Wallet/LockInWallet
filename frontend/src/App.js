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
  isNetworkDeployed,
} from "./utils/networkFilter.js";
import { isSolanaEnabled, isPrizePoolEnabled, isYieldEnabled } from "./utils/featureFlags.js";
import { createEmptyLimitEdits } from "./utils/spendingPeriods.js";
import { initAnalytics } from "./utils/analytics.js";
import { initPostHog, trackEvent, trackPageView } from "./utils/posthog.js";
import { PRIZE_SAVINGS_PATH } from "./utils/prizeSavingsContent.js";
import { CRYPTO_PATH } from "./utils/landingContent.js";
import { SIGNING_IN_PATH } from "./utils/signingInContent.js";
import {
  ensureCorrectNetwork,
  createProviderAndSigner,
} from "./utils/providerManager.js";
import {
  hasWallet,
  getAccounts,
  getChainId,
  requestAccounts,
  onWalletEvent,
  onWalletChanged,
  isEmbeddedWallet,
  getInjectedProvider,
  hasInjectedWallet,
  getInjectedWalletName,
  getInjectedAccount,
} from "./utils/walletProvider.js";
import {
  signInWithPasskey,
  restorePasskeySession,
  signOutOfPasskey,
  hasPasskeySession,
  isPasskeySupported,
} from "./utils/passkeyWallet.js";
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
import WalletChoiceModal from "./components/molecules/WalletChoiceModal.js";
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

// Explaining sign-in is reading, not wallet work — it must load for someone
// deciding whether to sign in at all, so it never waits on a wallet.
const SigningInGuide = lazy(() => import("./components/pages/SigningInGuide.js"));

// The crypto-native landing shares the main page's organisms but only loads
// for visitors who ask for the technical version
const CryptoLanding = lazy(() => import("./components/pages/CryptoLanding.js"));

// Content pages that need the full width — the 800px app column cramps them
const WIDE_ROUTES = ["/savings-visualiser", PRIZE_SAVINGS_PATH, SIGNING_IN_PATH];

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
  // the savings vault by default. Selecting a card switches the whole flow
  // (balances, deposits, withdrawals, limits) to that vault.
  //
  // Locking in creates the savings vault, so every card is a real vault.
  const personalVaultAddress = transactionManager?.getPersonalVaultAddress?.() || null;
  const currentVaultAddress = transactionManager?.getActiveVaultAddress?.() || null;

  const handleSelectVault = async (vaultAddress) => {
    trackEvent("vault_switched");
    // null selects the default: the savings vault
    transactionManager.setActiveVault(
      vaultAddress === personalVaultAddress ? null : vaultAddress
    );
    await fetchSpendingLimits();
    setBalanceRefreshTrigger((prev) => prev + 1);
  };

  const displayVaults = [
    // Deliberately not reordered. Sorting the selected vault to the front means
    // the "Current" badge is always on the first card, so switching vaults looks
    // like nothing moved except the balances — which reads as a bug even though
    // the right vault is selected. A stable order is what makes the change legible.
    ...userVaults.map((entry) => ({
      ...entry,
      isCurrent: entry.vault.address === currentVaultAddress,
    })),
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
            {displayVaults.map(({ vault, membership, isCurrent }) => (
              <VaultCard
                key={vault.address || "default"}
                vault={vault}
                membership={membership}
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
          activeVaultAddress={currentVaultAddress}
          onEarningChanged={refreshBalances}
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
  // Raised when someone presses connect with no wallet available at all
  const [showWalletOnboarding, setShowWalletOnboarding] = useState(false);
  // Bumped whenever the active wallet is swapped — signing in provides one
  // where there was none, so the listeners below have to re-subscribe against
  // the new provider rather than staying bound to the old one (or to nothing).
  const [walletGeneration, setWalletGeneration] = useState(0);

  const [isSigningIn, setIsSigningIn] = useState(false);
  // Asked when someone presses connect and there is a real choice: the two ways
  // in differ in a way no button label conveys, and picking wrongly means an
  // unexpected popup.
  const [showWalletChoice, setShowWalletChoice] = useState(false);
  const [detectedWallet, setDetectedWallet] = useState({ name: null, address: null });

  useEffect(
    () => onWalletChanged(() => setWalletGeneration((n) => n + 1)),
    []
  );

  /**
   * Leave localhost behind when nothing is running there.
   *
   * In development the app prefers localhost whenever the config carries an
   * address from some past deploy — which says nothing about whether a node is
   * up right now. When it is not, the app was asking the wallet to switch to a
   * dead chain and then failing against it, which looks for all the world like
   * the wallet is broken. Probe once and move to a live network instead.
   */
  useEffect(() => {
    if (networkType !== "evm" || selectedNetwork !== "localhost") return;

    let cancelled = false;
    const localRpc = NETWORKS.evm?.localhost?.rpcUrls?.[0];
    if (!localRpc) return;

    (async () => {
      try {
        const response = await fetch(localRpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
        });
        if (response.ok) return; // A node is there; carry on.
      } catch {
        // Nothing listening — fall through and move away.
      }

      const live = getDefaultNetwork("evm", { allowLocalhost: false });
      if (cancelled || !live || live === "localhost") return;

      console.warn(`No local chain at ${localRpc}; switching to ${live}`);
      localStorage.setItem("preferred_evm_network", live);
      setSelectedNetwork(live);
    })();

    return () => {
      cancelled = true;
    };
  }, [networkType, selectedNetwork, setSelectedNetwork]);

  // Bring a returning visitor straight back to their wallet. Only ever attempted
  // for someone who signed in on this device before — prompting for a passkey
  // on a first visit, unasked, is a strange thing to do to a stranger.
  useEffect(() => {
    if (!hasPasskeySession() || isWalletLoggedOut()) return;
    restorePasskeySession().catch((error) =>
      console.log("Passkey session not restored:", error.message)
    );
  }, []);

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
    // Order matters: the referrer is a wallet address, and capturing it takes
    // it out of the URL. Analytics only starts once the URL is clean.
    captureReferrerFromUrl();
    initAnalytics();
    initPostHog();
  }, []);

  useEffect(() => {
    trackPageView();
  }, [location.pathname]);

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

    trackEvent("wallet_disconnected");
    markWalletLoggedOut();

    // A signed-in wallet is the one thing here that can actually be told to
    // forget the site, so say so rather than relying on the flag alone.
    if (hasPasskeySession()) {
      await signOutOfPasskey();
    }

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

  // Wallet event listeners (EVM only)
  useEffect(() => {
    if (!hasWallet()) return;

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

    // An embedded wallet has no account switcher and no network menu, so it
    // may emit neither event; unsubscribing is a no-op there rather than a
    // condition every caller has to remember.
    const unsubscribeChain = onWalletEvent("chainChanged", handleChainChanged);
    const unsubscribeAccounts = onWalletEvent("accountsChanged", handleAccountsChanged);

    if (networkType === "evm") {
      detectCurrentNetwork();
      autoConnectWallet();
    }

    return () => {
      unsubscribeChain();
      unsubscribeAccounts();
    };
  }, [networkType, walletGeneration]);

  // Auto-detect available wallet type on mount
  useEffect(() => {
    const hasEvmWallet = hasWallet();
    const hasPhantom = !!(window.phantom?.solana || window.solana?.isPhantom);
    const evmAvailable = hasEvmWallet && getAvailableNetworks("evm").some((n) => n.deployed || n.isLocal);
    const solanaAvailable = hasPhantom && getAvailableNetworks("solana").some((n) => n.deployed || n.isLocal);

    if (solanaAvailable && !evmAvailable && networkType !== "solana") {
      switchNetworkType("solana", getDefaultNetwork("solana"));
    } else if (evmAvailable && !solanaAvailable && networkType !== "evm") {
      switchNetworkType("evm", getDefaultNetwork("evm"));
    }
  }, []);

  const connectWalletInternal = async () => {
    // The network the rest of this function works against. A signed-in wallet
    // can move it; an extension cannot.
    let activeNetworkKey = selectedNetwork;

    if (networkType === "evm") {
      // A saved preference can outlive the deployment it named — someone who
      // last used Ethereum Mainnet while it was still listed would otherwise
      // be sent back to a chain with no contract on it, every time.
      if (!isNetworkDeployed("evm", activeNetworkKey)) {
        const live = getDefaultNetwork("evm", { allowLocalhost: false });
        if (live && live !== activeNetworkKey) {
          console.warn(`${activeNetworkKey} has no deployment; using ${live}`);
          activeNetworkKey = live;
          setSelectedNetwork(live);
          localStorage.setItem("preferred_evm_network", live);
        }
      }

      const currentChain = await getChainId();
      const expectedNetwork = getCurrentNetwork(networkType, activeNetworkKey);

      if (currentChain !== expectedNetwork.chainId) {
        // Where the wallet already is, if that is somewhere we have deployed.
        const walletNetworkKey = isEmbeddedWallet()
          ? Object.keys(NETWORKS.evm || {}).find(
              (key) =>
                NETWORKS.evm[key].chainId === currentChain &&
                isNetworkDeployed("evm", key)
            )
          : null;

        if (walletNetworkKey) {
          // Follow it. A signed-in wallet has no network menu of its own, so
          // refusing would leave someone who just signed in on the home page
          // with nothing to press and no explanation.
          activeNetworkKey = walletNetworkKey;
          setSelectedNetwork(walletNetworkKey);
          localStorage.setItem("preferred_evm_network", walletNetworkKey);
        } else if (isEmbeddedWallet()) {
          // It is somewhere we cannot use — Ethereum Mainnet, say, which is in
          // the config with no contract behind it. A smart wallet can be asked
          // to move, so ask, rather than stopping dead: signing in appeared to
          // do nothing at all, because the sign-in itself had succeeded and
          // only this silently gave up afterwards.
          if (!(await ensureCorrectNetwork(activeNetworkKey))) {
            setCurrentChainId(currentChain);
            return;
          }
        } else {
          // An extension prompts its own user to switch, and that prompt is
          // still unanswered — stop and let them answer it.
          setCurrentChainId(currentChain);
          return;
        }
      }

      setCurrentChainId(currentChain);
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

    // Resolved above, not read from state: setSelectedNetwork does not take
    // effect until the next render, so `selectedNetwork` here is still the old
    // one and would point at the wrong deployment.
    const currentNetwork = getCurrentNetwork(networkType, activeNetworkKey);
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
      txManager = await initializeTransactionManager(networkType, activeNetworkKey, {
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

    trackEvent("wallet_connected", { network: networkType });
  };

  const autoConnectWallet = debounce(async () => {
    // A user who logged out stays logged out until they connect again
    if (isWalletLoggedOut()) return;
    if (!hasWallet() || walletOperationInProgress.current) return;
    walletOperationInProgress.current = true;
    try {
      const accounts = await getAccounts();
      if (accounts.length === 0) return;

      if (networkType === "evm") {
        const currentChain = await getChainId();
        const expectedNetwork = getCurrentNetwork(networkType, activeNetworkKey);
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

  /**
   * Sign in with a passkey — Face ID, and they have a wallet.
   *
   * Not debounced like `connectWallet`: this opens a popup that the browser
   * only allows because a person just clicked, and a debounce would break the
   * chain between the click and the popup.
   */
  const handleSignInWithPasskey = useCallback(async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    clearWalletLoggedOut();
    trackEvent("signin_method_chosen", { method: "passkey" });

    try {
      await signInWithPasskey();
      // The wallet is registered by now, so this takes the ordinary connect
      // path — nothing downstream needs to know how the wallet arrived.
      await connectWalletInternal();
    } catch (error) {
      // Closing the popup is the most common outcome and is not a failure.
      if (error.message !== "Sign-in cancelled") {
        alert(error.message);
      }
    } finally {
      setIsSigningIn(false);
    }
  }, [isSigningIn]);

  /**
   * What every "connect" button does.
   *
   * Only asks when both ways in actually lead somewhere. Most visitors have no
   * extension installed, and for them the second option leads nowhere — so a
   * dialog would be a question with one real answer, standing between them and
   * the thing they pressed. They go straight to signing in, exactly as before
   * the dialog existed.
   *
   * When an extension IS present the question is genuine, and the dialog names
   * the wallet and the account it has already shared, so choosing does not mean
   * guessing which one the button will open.
   */
  const openWalletChoice = useCallback(async () => {
    if (!hasInjectedWallet()) {
      if (isPasskeySupported()) {
        handleSignInWithPasskey();
      } else {
        // No wallet and no passkey support: nothing to offer but the explainer.
        setShowWalletOnboarding(true);
      }
      return;
    }

    if (!isPasskeySupported()) {
      connectWallet();
      return;
    }

    setDetectedWallet({
      name: getInjectedWalletName(),
      address: await getInjectedAccount(),
    });
    setShowWalletChoice(true);
  }, [handleSignInWithPasskey]);

  const connectWallet = debounce(async () => {
    clearWalletLoggedOut();
    trackEvent("signin_method_chosen", { method: "own_wallet" });

    // This button means "my own wallet", and that is a different wallet from
    // the one signing in provides. Without this it read `getActiveProvider()`,
    // which prefers the signed-in wallet — so anyone who had ever signed in got
    // the passkey popup again when they asked for their extension.
    //
    // Pressing it while signed in is a deliberate switch, so sign out first.
    // Only when there is actually an extension to switch to: otherwise this
    // would sign someone out of the one wallet they have and leave them worse
    // off than before they pressed it.
    if (isEmbeddedWallet() && getInjectedProvider()) {
      await signOutOfPasskey();
    }

    if (hasWallet() && !walletOperationInProgress.current) {
      walletOperationInProgress.current = true;
      try {
        if (networkType === "evm") {
          const networkSwitched = await ensureCorrectNetwork(selectedNetwork);
          if (!networkSwitched) {
            throw new Error(`Failed to switch to ${selectedNetwork} network.`);
          }
        }
        await requestAccounts();
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
    } else if (!hasWallet()) {
      // No wallet at all — this is someone's first time, so explain what a
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

  // The logged-out landing page and the crypto landing are full-width pages
  // with their own nav and footer — the app chrome would only duplicate them
  const isLanding =
    (location.pathname === "/" && !isWalletConnected) ||
    location.pathname === CRYPTO_PATH;

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
      <WalletChoiceModal
        open={showWalletChoice}
        onClose={() => setShowWalletChoice(false)}
        onSignIn={handleSignInWithPasskey}
        onUseOwnWallet={connectWallet}
        canSignIn={isPasskeySupported()}
        walletName={detectedWallet.name}
        walletAddress={detectedWallet.address}
      />

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
        {/* Explaining sign-in has to be readable by someone who has not
            connected anything and is deciding whether to. */}
        <Route
          path={SIGNING_IN_PATH}
          element={
            <Suspense fallback={<div />}>
              <SigningInGuide />
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
        {/* The technical landing — readable with or without a wallet */}
        <Route
          path={CRYPTO_PATH}
          element={
            <Suspense fallback={<div />}>
              <CryptoLanding
                networkType={networkType}
                connectWallet={
                  networkType === "solana" ? handleConnectMetaMask : connectWallet
                }
                onConnectPhantom={handleConnectPhantom}
                onSignInWithPasskey={openWalletChoice}
                isSigningIn={isSigningIn}
              />
            </Suspense>
          }
        />
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
                onSignInWithPasskey={openWalletChoice}
                isSigningIn={isSigningIn}
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
