import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  buttonStyles,
  formStyles,
  colors,
  spacing,
  fontSize,
  borderRadius,
} from "../../styles";
import { getTokenDecimals, formatTokenAmount, formatLimit, formatPenalty } from "../../utils/formatUtils";

function VaultDetail({ transactionManager, wallet }) {
  const { address } = useParams();
  const navigate = useNavigate();

  const [vault, setVault] = useState(null);
  const [membership, setMembership] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Deposit/withdraw form
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState("deposit");

  const loadVault = useCallback(async () => {
    try {
      setLoading(true);
      const vaultInfo = await transactionManager.getVaultInfo(address);
      setVault(vaultInfo);

      const memberInfo = await transactionManager.getVaultMemberInfo(address);
      setMembership(memberInfo);

      const vaultMembers = await transactionManager.getVaultMembers(address);
      setMembers(vaultMembers);
    } catch (err) {
      console.error("Failed to load vault:", err);
      setError("Vault not found");
    } finally {
      setLoading(false);
    }
  }, [transactionManager, address]);

  useEffect(() => { loadVault(); }, [loadVault]);

  const handleAction = async (actionFn, successMsg) => {
    setError(null);
    try {
      setActionLoading(true);
      await actionFn();
      setAmount("");
      await loadVault();
    } catch (err) {
      console.error("Action failed:", err);
      setError(err.message || "Transaction failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeposit = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) { setError("Enter a valid amount"); return; }
    handleAction(() => transactionManager.depositToVault(address, val));
  };

  const handleWithdraw = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) { setError("Enter a valid amount"); return; }
    handleAction(() => transactionManager.withdrawFromVault(address, val));
  };

  const handlePenaltyWithdraw = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) { setError("Enter a valid amount"); return; }
    handleAction(() => transactionManager.withdrawFromVaultWithPenalty(address, val));
  };

  const handleJoin = () => handleAction(() => transactionManager.joinVault(address));

  const handleLeave = () => handleAction(() => transactionManager.leaveVault(address));

  const handleClaimRewards = () =>
    handleAction(() => transactionManager.claimVaultPenaltyRewards(address));

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: colors.text.secondary }}>
        Loading vault...
      </div>
    );
  }

  if (!vault) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p style={{ color: "#fc8181" }}>Vault not found</p>
        <button style={buttonStyles.secondary} onClick={() => navigate("/")}>
          Back to Wallet
        </button>
      </div>
    );
  }

  const isPersonal = vault.vaultType === "Personal";
  const isMember = !!membership;
  const decimals = getTokenDecimals(vault);
  const tokenSymbol = vault.tokenSymbol || "TOKEN";
  const tokenLabel =
    tokenSymbol !== "TOKEN" || !vault.tokenMint
      ? tokenSymbol
      : vault.tokenMint.slice(0, 8) + "...";
  const myBalance = membership
    ? formatTokenAmount(membership.balance, decimals)
    : "0";

  const calcAvailable = (limit, spent, balance) => {
    if (!limit || !balance) return 0;
    const max = vault.limitsArePercentage ? (balance * limit) / 10000 : limit;
    return Math.max(0, max - spent);
  };

  const dailyAvail = membership ? calcAvailable(vault.dailyLimit, membership.dailySpent, membership.balance) : 0;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <button
        style={{ ...buttonStyles.secondary, marginBottom: spacing.lg }}
        onClick={() => navigate("/")}
      >
        &larr; Back
      </button>

      {/* Vault header */}
      <div style={{
        backgroundColor: colors.background.primary,
        border: `2px solid ${isPersonal ? colors.success.main : "#805ad5"}`,
        borderRadius: borderRadius.md,
        padding: spacing.xxl,
        marginBottom: spacing.xl,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: "0 0 4px", color: "white" }}>{vault.name}</h2>
            {vault.description && (
              <p style={{ margin: 0, color: colors.text.secondary, fontSize: fontSize.sm }}>
                {vault.description}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: spacing.sm }}>
            <span style={{
              padding: "4px 10px",
              borderRadius: borderRadius.sm,
              backgroundColor: isPersonal ? "rgba(72,187,120,0.2)" : "rgba(128,90,213,0.2)",
              color: isPersonal ? colors.success.light : "#d6bcfa",
              fontSize: fontSize.xs,
            }}>
              {vault.vaultType}
            </span>
            <button
              style={{ ...buttonStyles.secondary, padding: "4px 10px", fontSize: fontSize.xs }}
              onClick={copyShareLink}
            >
              Share Link
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: spacing.lg,
          marginTop: spacing.xl,
        }}>
          <StatBox label="Token" value={tokenLabel} />
          {!isPersonal && <StatBox label="Members" value={vault.memberCount} />}
          <StatBox label="Total Locked" value={`${formatTokenAmount(vault.totalBalance, decimals)} ${tokenSymbol}`} />
          {!isPersonal && <StatBox label="Penalty" value={formatPenalty(vault.penaltyRateBps)} />}
        </div>

        {/* Limits */}
        <div style={{
          display: "flex",
          gap: spacing.lg,
          marginTop: spacing.lg,
          paddingTop: spacing.lg,
          borderTop: `1px solid ${colors.border?.default || "#4a5568"}`,
        }}>
          {vault.dailyLimit > 0 && <StatBox label="Daily Limit" value={formatLimit(vault.dailyLimit, vault)} />}
          {vault.weeklyLimit > 0 && <StatBox label="Weekly Limit" value={formatLimit(vault.weeklyLimit, vault)} />}
          {vault.monthlyLimit > 0 && <StatBox label="Monthly Limit" value={formatLimit(vault.monthlyLimit, vault)} />}
        </div>
      </div>

      {/* Membership actions */}
      {!isMember && vault.vaultType === "Community" && (
        <div style={{ marginBottom: spacing.xl, textAlign: "center" }}>
          <button
            style={{ ...buttonStyles.primary, padding: "12px 32px" }}
            onClick={handleJoin}
            disabled={actionLoading}
          >
            {actionLoading ? "Joining..." : "Join This Vault"}
          </button>
        </div>
      )}

      {/* Member panel */}
      {isMember && (
        <>
          {/* Balance card */}
          <div style={{
            backgroundColor: colors.background.primary,
            borderRadius: borderRadius.md,
            padding: spacing.xl,
            marginBottom: spacing.xl,
            border: `1px solid ${colors.border?.default || "#4a5568"}`,
          }}>
            <div style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>Your Balance</div>
            <div style={{ fontSize: "2em", color: "white", fontWeight: "bold", margin: "4px 0" }}>
              {myBalance} {tokenSymbol}
            </div>
            {vault.dailyLimit > 0 && (
              <div style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>
                Daily available: {formatTokenAmount(dailyAvail, decimals)} {tokenSymbol}
              </div>
            )}
            {membership.unclaimedPenalties > 0 && (
              <div style={{
                marginTop: spacing.md,
                display: "flex",
                alignItems: "center",
                gap: spacing.md,
              }}>
                <span style={{ color: colors.success.light, fontSize: fontSize.sm }}>
                  Penalty rewards: {formatTokenAmount(membership.unclaimedPenalties, decimals)} {tokenSymbol}
                </span>
                <button
                  style={{ ...buttonStyles.success, padding: "4px 12px", fontSize: fontSize.xs }}
                  onClick={handleClaimRewards}
                  disabled={actionLoading}
                >
                  Claim
                </button>
              </div>
            )}
          </div>

          {/* Deposit / Withdraw tabs */}
          <div style={{
            backgroundColor: colors.background.primary,
            borderRadius: borderRadius.md,
            padding: spacing.xl,
            marginBottom: spacing.xl,
            border: `1px solid ${colors.border?.default || "#4a5568"}`,
          }}>
            <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg }}>
              {["deposit", "withdraw", "penalty"].map((tab) => (
                <button
                  key={tab}
                  style={{
                    ...buttonStyles.secondary,
                    flex: 1,
                    border: activeTab === tab ? `2px solid ${colors.success.main}` : "2px solid transparent",
                    textTransform: "capitalize",
                  }}
                  onClick={() => { setActiveTab(tab); setError(null); }}
                >
                  {tab === "penalty" ? "Penalty Withdraw" : tab}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: spacing.md }}>
              <input
                style={{ ...formStyles.input, flex: 1 }}
                type="number"
                step="0.001"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Amount in ${tokenSymbol}`}
              />
              <button
                style={{
                  ...(activeTab === "deposit" ? buttonStyles.primary :
                    activeTab === "penalty" ? buttonStyles.warning : buttonStyles.secondary),
                  opacity: actionLoading ? 0.6 : 1,
                }}
                disabled={actionLoading}
                onClick={
                  activeTab === "deposit" ? handleDeposit :
                  activeTab === "withdraw" ? handleWithdraw :
                  handlePenaltyWithdraw
                }
              >
                {actionLoading ? "..." :
                  activeTab === "deposit" ? "Deposit" :
                  activeTab === "withdraw" ? "Withdraw" :
                  "Penalty Withdraw"
                }
              </button>
            </div>

            {activeTab === "penalty" && (
              <p style={{ fontSize: fontSize.xs, color: "#ed8936", marginTop: spacing.sm }}>
                Penalty withdrawal bypasses limits but charges {formatPenalty(vault.penaltyRateBps)} fee.
                {vault.vaultType === "Community"
                  ? " Fee redistributed to other vault members."
                  : " Fee sent to treasury."}
              </p>
            )}
          </div>

          {/* Leave vault */}
          {vault.vaultType === "Community" && membership.balance === 0 && membership.unclaimedPenalties === 0 && (
            <button
              style={{ ...buttonStyles.danger, width: "100%", marginBottom: spacing.xl }}
              onClick={handleLeave}
              disabled={actionLoading}
            >
              Leave Vault
            </button>
          )}
        </>
      )}

      {/* Error display */}
      {error && (
        <div style={{
          padding: spacing.md,
          marginBottom: spacing.lg,
          backgroundColor: "rgba(229,62,62,0.1)",
          border: "1px solid #e53e3e",
          borderRadius: borderRadius.sm,
          color: "#fc8181",
          fontSize: fontSize.sm,
        }}>
          {error}
          <button
            style={{ marginLeft: spacing.md, background: "none", border: "none", color: "#fc8181", cursor: "pointer" }}
            onClick={() => setError(null)}
          >
            x
          </button>
        </div>
      )}

      {/* Members list (community only) */}
      {!isPersonal && members.length > 0 && (
        <div style={{
          backgroundColor: colors.background.primary,
          borderRadius: borderRadius.md,
          padding: spacing.xl,
          border: `1px solid ${colors.border?.default || "#4a5568"}`,
        }}>
          <h3 style={{ color: "white", marginTop: 0 }}>
            Members ({members.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {members.map((m) => (
              <div
                key={m.member}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: spacing.sm,
                  borderRadius: borderRadius.sm,
                  backgroundColor: "rgba(255,255,255,0.03)",
                }}
              >
                <span style={{ color: colors.text.secondary, fontSize: fontSize.sm }}>
                  {m.member.slice(0, 6)}...{m.member.slice(-4)}
                  {m.member === vault.creator && (
                    <span style={{ color: colors.success.light, marginLeft: spacing.sm }}>creator</span>
                  )}
                </span>
                <span style={{ color: "white", fontSize: fontSize.sm }}>
                  {formatTokenAmount(m.balance, decimals)} {tokenSymbol}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>{label}</div>
      <div style={{ fontSize: fontSize.normal, color: "white", fontWeight: "600" }}>{value}</div>
    </div>
  );
}

export default VaultDetail;
