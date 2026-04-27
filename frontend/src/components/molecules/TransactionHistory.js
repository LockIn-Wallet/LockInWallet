import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { colors, spacing, borderRadius, fontSize, fontWeight } from "../../styles";
import {
  fetchTransactionHistory,
  fetchSolanaTransactionHistory,
  formatTxAmount,
  formatTxTimestamp,
} from "../../services";

const historyStyles = {
  container: {
    padding: spacing.xl,
    color: colors.text.primary,
  },
  emptyState: {
    textAlign: "center",
    padding: spacing.xxl,
    color: colors.text.muted,
    fontSize: fontSize.normal,
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${spacing.lg} ${spacing.md}`,
    borderBottom: `1px solid ${colors.border.default}`,
  },
  itemLeft: {
    display: "flex",
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    fontSize: fontSize.xl,
    width: "28px",
    textAlign: "center",
  },
  label: {
    fontSize: fontSize.normal,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  sublabel: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: "2px",
  },
  amount: {
    fontSize: fontSize.normal,
    fontWeight: fontWeight.semibold,
    textAlign: "right",
  },
  amountDeposit: {
    color: colors.success.light,
  },
  amountWithdrawal: {
    color: colors.error.light,
  },
  amountWinning: {
    color: "#fbd38d",
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    textAlign: "right",
    marginTop: "2px",
  },
  loadingState: {
    textAlign: "center",
    padding: spacing.xxl,
    color: colors.text.muted,
    fontSize: fontSize.normal,
  },
  txLink: {
    fontSize: fontSize.xs,
    color: colors.accent.blue,
    textDecoration: "none",
    cursor: "pointer",
  },
  refreshButton: {
    background: "none",
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.sm,
    color: colors.text.muted,
    cursor: "pointer",
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: fontSize.xs,
    marginBottom: spacing.md,
  },
};

const DEPOSIT_EVENTS = [
  'Deposited', 'DepositedToVault', 'DepositedTo',
  'DepositSol', 'DepositSolSelf', 'DepositSpl', 'DepositSplSelf',
];
const WINNING_EVENTS = ['PrizeClaimed'];

function getTokenDecimals(tokenSymbol, tokens) {
  if (!tokens || !tokenSymbol) return 6;
  const token = tokens[tokenSymbol];
  return token ? token.decimals : 6;
}

const TransactionHistory = ({
  savingsContract,
  userAddress,
  networkType,
  selectedNetwork,
  getCurrentNetwork,
  transactionManager,
}) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const getTokens = useCallback(() => {
    if (!getCurrentNetwork) return {};
    try {
      const network = getCurrentNetwork(networkType, selectedNetwork);
      return network?.tokens || {};
    } catch {
      return {};
    }
  }, [getCurrentNetwork, networkType, selectedNetwork]);

  const loadHistory = useCallback(async () => {
    if (networkType === "solana" && !transactionManager) return;
    if (networkType !== "solana" && (!savingsContract || !userAddress)) return;

    setLoading(true);
    try {
      let history = [];
      if (networkType === "solana") {
        history = await fetchSolanaTransactionHistory({ transactionManager });
      } else {
        const tokens = getTokens();
        history = await fetchTransactionHistory({
          savingsContract,
          userAddress,
          tokens,
        });
      }
      setTransactions(history);
      setLoaded(true);
    } catch (err) {
      console.error("Failed to load transaction history:", err);
    } finally {
      setLoading(false);
    }
  }, [savingsContract, userAddress, networkType, getTokens, transactionManager]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(loadHistory, 30000);
    return () => clearInterval(interval);
  }, [loaded, loadHistory]);

  if (loading && !loaded) {
    return (
      <div style={historyStyles.container}>
        <div style={historyStyles.loadingState}>Loading transaction history...</div>
      </div>
    );
  }

  const tokens = getTokens();

  return (
    <div style={historyStyles.container}>
      <button style={historyStyles.refreshButton} onClick={loadHistory}>
        ↻ Refresh
      </button>

      {transactions.length === 0 ? (
        <div style={historyStyles.emptyState}>No transactions yet.</div>
      ) : (
        <ul style={historyStyles.list}>
          {transactions.map((tx, idx) => {
            const isDeposit = DEPOSIT_EVENTS.includes(tx.eventName);
            const isWinning = WINNING_EVENTS.includes(tx.eventName);
            const decimals = getTokenDecimals(tx.token, tokens);
            const formattedAmount = tx.amount != null
              ? (typeof tx.amount === "number" ? tx.amount.toFixed(2) : formatTxAmount(tx.amount, tx.decimals || decimals))
              : null;

            return (
              <li
                key={`${tx.txHash}-${tx.eventName}-${idx}`}
                style={{
                  ...historyStyles.item,
                  ...(idx === transactions.length - 1 ? { borderBottom: "none" } : {}),
                }}
              >
                <div style={historyStyles.itemLeft}>
                  <span style={historyStyles.icon}>{tx.icon}</span>
                  <div>
                    <div style={historyStyles.label}>{tx.label}</div>
                    <div style={historyStyles.sublabel}>
                      {tx.txHash && (
                        <span style={historyStyles.txLink}>
                          {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-6)}
                        </span>
                      )}
                      {tx.category && tx.category !== "Module" && (
                        <span> · {tx.category}</span>
                      )}
                      {tx.destination && (
                        <span>
                          {" "}
                          · {tx.title || tx.destination.slice(0, 8) + "..."}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  {formattedAmount && (
                    <div
                      style={{
                        ...historyStyles.amount,
                        ...(isWinning
                          ? historyStyles.amountWinning
                          : isDeposit
                          ? historyStyles.amountDeposit
                          : historyStyles.amountWithdrawal),
                      }}
                    >
                      {isDeposit || isWinning ? "+" : "-"}
                      {formattedAmount} {tx.token}
                    </div>
                  )}
                  <div style={historyStyles.timestamp}>
                    {formatTxTimestamp(tx.timestamp)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

TransactionHistory.propTypes = {
  savingsContract: PropTypes.object,
  userAddress: PropTypes.string,
  networkType: PropTypes.string.isRequired,
  selectedNetwork: PropTypes.string,
  getCurrentNetwork: PropTypes.func,
  transactionManager: PropTypes.object,
};

export default TransactionHistory;
