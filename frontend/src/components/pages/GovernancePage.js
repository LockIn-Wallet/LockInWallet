import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

import {
  buttonStyles,
  cardStyles,
  layoutStyles,
  utilityStyles,
  colors,
  spacing,
  fontSize,
  borderRadius,
} from "../../styles";
import { formatCountdown } from "../../utils/walletUtils.js";
import { truncateAddress } from "../../utils/addressUtils.js";
import { RELEASE_NOTES, APP_VERSION } from "../../releaseNotes.js";

const RELEASE_NOTES_URL = "https://github.com/LockIn-Wallet/LockInWallet/blob/main/CHANGELOG.md";
const SECURITY_DOC_URL = "https://github.com/LockIn-Wallet/LockInWallet/blob/main/SECURITY.md";

const STATUS_META = {
  pending: { label: "⏳ In timelock", color: colors.warning.light },
  ready: { label: "🟢 Executable", color: colors.success.light },
  executed: { label: "✅ Executed", color: colors.text.muted },
  cancelled: { label: "🚫 Cancelled", color: colors.text.muted },
};

// The protections users rely on, shown regardless of governance deployment.
// Durations mirror the contracts (production mode).
const PROTECTIONS = [
  { name: "Spending limits", detail: "Daily / weekly / monthly caps you lock in yourself; frozen after lock-in — raising one takes a 24h proposal." },
  { name: "Limit change proposals", detail: "24h public delay before any limit increase applies." },
  { name: "New withdrawal address", detail: "24h delay before a new destination becomes usable." },
  { name: "Emergency bypass", detail: "Withdraw beyond your limits after a 24h request delay — your guaranteed exit path." },
  { name: "Referral record", detail: "Written once at lock-in, immutable afterwards." },
];

/**
 * GovernancePage — /governance
 *
 * Shows who can change the contracts, how long changes wait in public view
 * before executing, the full operation history, and what a user can do if
 * they disagree with a queued change.
 */
const GovernancePage = ({ transactionManager, navigate }) => {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const loadStatus = useCallback(async () => {
    // Page is public — without a connected wallet there is no adapter to
    // read the timelock, so show the static content with history disabled
    if (!transactionManager?.getGovernanceStatus) {
      setStatus({ enabled: false, operations: [] });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setStatus(await transactionManager.getGovernanceStatus());
    } catch (error) {
      console.error("Error loading governance status:", error);
      setStatus({ enabled: false, operations: [] });
    } finally {
      setIsLoading(false);
    }
  }, [transactionManager]);

  useEffect(() => {
    loadStatus();
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  const delayHours = status?.minDelay ? Math.round(status.minDelay / 3600) : null;

  return (
    <div style={{ ...cardStyles.statusCard, marginBottom: spacing.xxl }}>
      <div style={{ ...layoutStyles.flexBetween, marginBottom: spacing.lg }}>
        <h2 style={{ ...utilityStyles.textPrimary, margin: 0 }}>🏛️ Governance & Security</h2>
        <button style={buttonStyles.secondary} onClick={() => navigate("/")}>← Back</button>
      </div>

      {/* Who can change the contracts */}
      <div style={{ ...layoutStyles.section, marginBottom: spacing.xl }}>
        <h3 style={{ ...utilityStyles.textPrimary, marginBottom: spacing.md }}>Who can change the contracts</h3>
        {status?.enabled ? (
          <p style={utilityStyles.textSecondary}>
            Changes are proposed by{" "}
            {status.threshold
              ? `a ${status.threshold}-of-${status.signerCount} multisig (Gnosis Safe)`
              : "the project maintainer"}{" "}
            and must sit in a public on-chain waiting room for{" "}
            <strong>{delayHours} hours</strong> before they can take effect. Nothing changes
            silently: every queued change is visible below (and on-chain) for the full waiting
            period — and can still be cancelled during it.
          </p>
        ) : (
          <p style={utilityStyles.textSecondary}>
            Upgrades are currently performed by the project maintainer directly; the on-chain
            timelock + multisig governance layer is built and being rolled out. Your personal
            protections below are live and enforced by the contracts regardless.
          </p>
        )}
      </div>

      {/* What changed recently — plain language, no GitHub required */}
      <div style={{ ...layoutStyles.section, marginBottom: spacing.xl }}>
        <h3 style={{ ...utilityStyles.textPrimary, marginBottom: spacing.md }}>What changed recently</h3>
        {RELEASE_NOTES.map((release) => (
          <div key={release.version} style={{ marginBottom: spacing.lg }}>
            <div style={{ ...utilityStyles.textSuccess, fontWeight: "bold", marginBottom: spacing.sm }}>
              {/* Unreleased entries have no version number to prefix */}
              {/^\d/.test(release.version) ? `v${release.version}` : release.version}{" "}
              — {release.title}
              <span style={{ ...utilityStyles.textMuted, fontWeight: "normal", marginLeft: spacing.sm, fontSize: fontSize.sm }}>
                {release.date}
              </span>
            </div>
            {release.highlights.map((h, i) => (
              <div key={i} style={{ ...utilityStyles.textSecondary, marginBottom: spacing.xs }}>
                {h.emoji} {h.text}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Your protections */}
      <div style={{ ...layoutStyles.section, marginBottom: spacing.xl }}>
        <h3 style={{ ...utilityStyles.textPrimary, marginBottom: spacing.md }}>Your protections</h3>
        {PROTECTIONS.map((p) => (
          <div key={p.name} style={{ marginBottom: spacing.md }}>
            <span style={{ ...utilityStyles.textSuccess, fontWeight: "bold" }}>{p.name}: </span>
            <span style={utilityStyles.textSecondary}>{p.detail}</span>
          </div>
        ))}
      </div>

      {/* Disagree? Exit path */}
      <div
        style={{
          padding: spacing.lg,
          marginBottom: spacing.xl,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.border.default}`,
        }}
      >
        <h3 style={{ ...utilityStyles.textPrimary, marginBottom: spacing.md }}>
          Disagree with a queued change?
        </h3>
        <p style={utilityStyles.textSecondary}>
          You can always leave before it executes: request an <strong>emergency bypass</strong> from the
          Withdraw section immediately — it unlocks your full balance after 24 hours, well inside the
          upgrade waiting period. Vault balances can exit instantly via penalty withdrawal.
        </p>
      </div>

      {/* Operation history */}
      <div style={layoutStyles.section}>
        <h3 style={{ ...utilityStyles.textPrimary, marginBottom: spacing.md }}>Change history</h3>
        {isLoading ? (
          <p style={utilityStyles.loadingText}>Loading on-chain governance history...</p>
        ) : !status?.enabled ? (
          <p style={utilityStyles.textMuted}>
            On-chain governance is not active on this network yet — there is no timelock queue to show.
          </p>
        ) : status.operations.length === 0 ? (
          <p style={utilityStyles.textMuted}>No changes have been queued through the timelock yet.</p>
        ) : (
          status.operations.map((op) => {
            const meta = STATUS_META[op.status] || STATUS_META.pending;
            const countdown = formatCountdown(op.readyAt, Math.floor(currentTime / 1000));
            return (
              <div
                key={op.id}
                style={{
                  ...layoutStyles.flexBetween,
                  gap: spacing.md,
                  flexWrap: "wrap",
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  borderRadius: borderRadius.md,
                  border: `1px solid ${colors.border.default}`,
                }}
              >
                <div>
                  <div style={utilityStyles.textPrimary}>
                    {op.actionLabel} — <span style={utilityStyles.textSecondary}>{op.targetLabel}</span>
                  </div>
                  <div style={{ ...utilityStyles.textMuted, fontSize: fontSize.sm }}>
                    queued {new Date(op.scheduledAt * 1000).toLocaleString()} · id {truncateAddress(op.id)}
                  </div>
                </div>
                <div style={{ color: meta.color, fontSize: fontSize.sm, textAlign: "right" }}>
                  {meta.label}
                  {op.status === "pending" && <div>{countdown.text}</div>}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ ...utilityStyles.textMuted, fontSize: fontSize.sm, marginTop: spacing.xl }}>
        App version v{APP_VERSION} · technical details:{" "}
        <a href={RELEASE_NOTES_URL} target="_blank" rel="noopener noreferrer" style={{ color: colors.text.muted }}>
          full changelog
        </a>{" "}
        ·{" "}
        <a href={SECURITY_DOC_URL} target="_blank" rel="noopener noreferrer" style={{ color: colors.text.muted }}>
          security policy
        </a>
      </div>
    </div>
  );
};

GovernancePage.propTypes = {
  transactionManager: PropTypes.object,
  navigate: PropTypes.func.isRequired,
};

export default GovernancePage;
