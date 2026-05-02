import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
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
  calculateInstantWithdrawableAmount,
} from "./utils/walletUtils.js";
import { TransactionManager } from "./adapters/TransactionManager.js";
import {
  fetchSpendingLimits as fetchSpendingLimitsService,
} from "./services";

import SolanaWalletProvider from "./components/SolanaWalletProvider.js";
import SocialLinks from "./components/atoms/SocialLinks.js";
import Footer from "./components/atoms/Footer.js";
import CollapsibleSection from "./components/atoms/CollapsibleSection.js";
import WalletHeader from "./components/molecules/WalletHeader.js";
import BalanceDisplay from "./components/molecules/BalanceDisplay.js";
import DepositInterface from "./components/molecules/DepositInterface.js";
import TransactionHistory from "./components/molecules/TransactionHistory.js";
import SpendingLimitsSetup from "./components/organisms/SpendingLimitsSetup.js";
import SetupCommitStep from "./components/organisms/SetupCommitStep.js";
import WithdrawalAddressSetupStep from "./components/organisms/WithdrawalAddressSetupStep.js";
import WithdrawalInterface from "./components/organisms/WithdrawalInterface.js";
import VaultCard from "./components/molecules/VaultCard.js";

import CreateVault from "./components/pages/CreateVault.js";
import VaultDetail from "./components/pages/VaultDetail.js";
import Explore from "./components/pages/Explore.js";

function MainFlow({ transactionManager, navigate, networkConfig, wallet, connection }) {
  const networkType = "solana";
  const selectedNetwork = localStorage.getItem("preferred_solana_network") || "localhost";
  const solanaConnected = wallet?.connected || false;
  const solanaPublicKey = wallet?.publicKey || null;
  const userAddress = wallet?.publicKey?.toString() || null;

  const [isSetupCommitted, setIsSetupCommitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [spendingLimits, setSpendingLimits] = useState([]);
  const [limitEdits, setLimitEdits] = useState({
    Daily: { value: "", isActive: false, isEditing: false },
    Weekly: { value: "", isActive: false, isEditing: false },
    Monthly: { value: "", isActive: false, isEditing: false },
  });
  const [balances, setBalances] = useState({});
  const [selectedToken, setSelectedToken] = useState("USDT");
  const [instantWithdrawableAmount, setInstantWithdrawableAmount] = useState(0);
  const [limitingPeriod, setLimitingPeriod] = useState("");

  const [userVaults, setUserVaults] = useState([]);
  const [balanceRefreshTrigger, setBalanceRefreshTrigger] = useState(0);

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
  }, [transactionManager]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const committed = transactionManager.isSetupCommitted();
        setIsSetupCommitted(committed);
        if (committed) {
          await fetchSpendingLimits();
          await loadUserVaults();
        }
      } catch (err) {
        console.error("Setup check failed:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [transactionManager, fetchSpendingLimits]);

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
      {/* My Vaults Section (only when committed) */}
      {isSetupCommitted && (
        <div style={{ marginBottom: spacing.xl }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.lg,
          }}>
            <h3 style={{ color: "white", margin: 0 }}>My Vaults</h3>
            <div style={{ display: "flex", gap: spacing.sm }}>
              <button style={buttonStyles.primary} onClick={() => navigate("/create")}>
                + Create Vault
              </button>
              <button style={buttonStyles.secondary} onClick={() => navigate("/explore")}>
                Explore
              </button>
              <button
                style={{ ...buttonStyles.secondary, fontSize: fontSize.xs }}
                onClick={loadUserVaults}
              >
                Refresh
              </button>
            </div>
          </div>

          {userVaults.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: spacing.xxl,
              color: colors.text.secondary,
              backgroundColor: colors.background.primary,
              borderRadius: "8px",
              border: "1px dashed #4a5568",
            }}>
              <p>Create additional vaults for SPL tokens, or join community vaults.</p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: spacing.lg,
            }}>
              {userVaults.map(({ vault, membership: m }) => (
                <VaultCard
                  key={vault.address}
                  vault={vault}
                  membership={m}
                  onClick={() => navigate(`/vault/${vault.address}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Balance Display (only when setup committed) */}
      {isSetupCommitted && (
        <BalanceDisplay
          transactionManager={transactionManager}
          savingsContract={null}
          signer={null}
          connection={connection}
          networkType={networkType}
          selectedNetwork={selectedNetwork}
          userAddress={userAddress}
          solanaPublicKey={solanaPublicKey}
          solanaConnected={solanaConnected}
          isSetupCommitted={isSetupCommitted}
          provider={null}
          solanaWallet={wallet}
          balances={balances}
          onBalanceUpdate={(newBalances) => setBalances(newBalances)}
          connectWallet={() => {}}
          refreshTrigger={balanceRefreshTrigger}
        />
      )}

      {/* Tutorial section during setup */}
      {!isSetupCommitted && (
        <div style={{
          marginBottom: "20px",
          padding: "16px",
          backgroundColor: "#1a365d",
          border: "2px solid #48bb78",
          borderRadius: "8px",
          color: "white",
        }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "12px", gap: "8px" }}>
            <span style={{ fontSize: "1.25rem" }}>🛡️</span>
            <h4 style={{ margin: 0, color: "#9ae6b4", fontSize: "1.1em", fontWeight: "600" }}>
              Protect your Bankroll/Savings/Profits even from yourself
            </h4>
          </div>
          <div style={{ fontSize: "0.9em", lineHeight: "1.6", color: "#e2e8f0" }}>
            <p style={{ margin: "0 0 8px 0" }}>
              <strong>🏦 No-trading wallet:</strong> Designed for storing stablecoins for your peace of mind.
            </p>
            <p style={{ margin: "0 0 8px 0" }}>
              <strong>🔐 Set up withdrawal allowance:</strong> Changes to allowance or bypassing withdrawal limits are timelocked to combat spending/risking impulses.
            </p>
            <p style={{ margin: "0 0 8px 0" }}>
              <strong>🛡️ Compromise-Resistant:</strong> Funds are safe even when your private key is compromised (coming soon)
            </p>
            <p style={{ margin: "0" }}>
              <strong>⛓️ Fully On-Chain:</strong> No intermediaries
            </p>
          </div>
        </div>
      )}

      {/* Deposit Interface (only when committed) */}
      {isSetupCommitted && (
        <CollapsibleSection title="Deposit Funds" icon="📥" defaultExpanded={true}>
          <DepositInterface
            transactionManager={transactionManager}
            savingsContract={null}
            signer={null}
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

      {/* Spending Limits Setup / Management */}
      {isSetupCommitted ? (
        <CollapsibleSection title="Spending Limits" icon="⏱️" defaultExpanded={true}>
          <SpendingLimitsSetup
            isSetupCommitted={isSetupCommitted}
            currentTime={currentTime}
            networkType={networkType}
            transactionManager={transactionManager}
            solanaConnected={solanaConnected}
            savingsContract={null}
            getCurrentUserAddress={getCurrentUserAddress}
            spendingLimits={spendingLimits}
            onSpendingLimitsUpdate={handleSpendingLimitsUpdate}
          />
        </CollapsibleSection>
      ) : (
        <SpendingLimitsSetup
          isSetupCommitted={isSetupCommitted}
          currentTime={currentTime}
          networkType={networkType}
          transactionManager={transactionManager}
          solanaConnected={solanaConnected}
          savingsContract={null}
          getCurrentUserAddress={getCurrentUserAddress}
          spendingLimits={spendingLimits}
          onSpendingLimitsUpdate={handleSpendingLimitsUpdate}
        />
      )}

      {/* Withdrawal Addresses Setup (only during setup) */}
      {!isSetupCommitted && (
        <WithdrawalAddressSetupStep
          isSetupCommitted={isSetupCommitted}
          spendingLimits={spendingLimits}
          transactionManager={transactionManager}
          savingsContract={null}
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
          savingsContract={null}
          networkType={networkType}
          solanaConnected={solanaConnected}
          onSetupCommitted={(committed) => {
            setIsSetupCommitted(committed);
            if (committed) {
              loadUserVaults();
            }
          }}
          onSpendingLimitsRefresh={fetchSpendingLimits}
        />
      )}

      {/* Withdrawal Interface (only when committed) */}
      {isSetupCommitted && (
        <CollapsibleSection title="Withdraw Funds" icon="💸" defaultExpanded={true}>
          <WithdrawalInterface
            transactionManager={transactionManager}
            savingsContract={null}
            signer={null}
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

      {/* Transaction History (only when committed) */}
      {isSetupCommitted && (
        <CollapsibleSection title="Transaction History" icon="📜" defaultExpanded={true}>
          <TransactionHistory
            savingsContract={null}
            userAddress={userAddress}
            networkType={networkType}
            selectedNetwork={selectedNetwork}
            transactionManager={transactionManager}
          />
        </CollapsibleSection>
      )}

    </div>
  );
}

function AppInner() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [transactionManager, setTransactionManager] = useState(null);
  const navigate = useNavigate();

  const selectedNetwork = localStorage.getItem("preferred_solana_network") || "localhost";
  const networkConfig = NETWORKS.solana[selectedNetwork] || NETWORKS.solana.localhost;

  useEffect(() => {
    const init = async () => {
      if (!wallet.connected || !wallet.publicKey || !connection) {
        setTransactionManager(null);
        return;
      }

      try {
        const tm = new TransactionManager();
        await tm.initialize(networkConfig, { wallet, connection });
        setTransactionManager(tm);
      } catch (err) {
        console.error("Failed to initialize TransactionManager:", err);
      }
    };
    init();
  }, [wallet.connected, wallet.publicKey, connection, selectedNetwork]);

  return (
    <div style={styles.app.container}>
      <SocialLinks />
      <WalletHeader wallet={wallet} selectedNetwork={selectedNetwork} />

      {wallet.connected && transactionManager ? (
        <Routes>
          <Route
            path="/"
            element={
              <MainFlow
                transactionManager={transactionManager}
                navigate={navigate}
                networkConfig={networkConfig}
                wallet={wallet}
                connection={connection}
              />
            }
          />
          <Route
            path="/create"
            element={
              <CreateVault
                transactionManager={transactionManager}
                navigate={navigate}
                networkConfig={networkConfig}
              />
            }
          />
          <Route
            path="/vault/:address"
            element={
              <VaultDetail
                transactionManager={transactionManager}
                wallet={wallet}
              />
            }
          />
          <Route
            path="/explore"
            element={
              <Explore
                transactionManager={transactionManager}
                navigate={navigate}
                wallet={wallet}
              />
            }
          />
        </Routes>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#e2e8f0" }}>
          <h2 style={{ color: "#9ae6b4", marginBottom: "16px" }}>
            Savings Wallet
          </h2>
          <p style={{ maxWidth: "500px", margin: "0 auto 24px", lineHeight: "1.6" }}>
            Set up your personal savings wallet with withdrawal limits.
            Create or join community vaults to save together.
          </p>
          <p style={{ color: "#a0aec0" }}>
            Connect your Solana wallet to get started.
          </p>
        </div>
      )}
      <Footer />
    </div>
  );
}

function App() {
  const selectedNetwork = localStorage.getItem("preferred_solana_network") || "localhost";

  return (
    <BrowserRouter>
      <SolanaWalletProvider networkType="solana" selectedNetwork={selectedNetwork}>
        <AppInner />
      </SolanaWalletProvider>
    </BrowserRouter>
  );
}

export default App;
