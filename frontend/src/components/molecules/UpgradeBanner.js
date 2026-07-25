import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

import { buttonStyles, colors, spacing, borderRadius, fontSize } from "../../styles";
import { formatCountdown } from "../../utils/walletUtils.js";

/**
 * UpgradeBanner
 *
 * Shown whenever the on-chain upgrade timelock has queued (not yet executed)
 * operations. Users get the full delay window to review the change on the
 * governance page and, if they disagree, exit with their funds before it
 * lands. Hidden entirely when governance is not deployed or nothing is queued.
 */
const UpgradeBanner = ({ transactionManager, currentTime, navigate }) => {
  const [status, setStatus] = useState(null);

  const loadStatus = useCallback(async () => {
    if (!transactionManager?.getGovernanceStatus) return;
    try {
      const result = await transactionManager.getGovernanceStatus();
      setStatus(result);
    } catch (error) {
      console.error("Error loading governance status:", error);
    }
  }, [transactionManager]);

  useEffect(() => {
    loadStatus();
    const timer = setInterval(loadStatus, 60000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  const queued = (status?.operations || []).filter(
    (op) => op.status === "pending" || op.status === "ready"
  );
  if (!status?.enabled || queued.length === 0) return null;

  const next = queued.reduce((a, b) => (a.readyAt < b.readyAt ? a : b));
  const countdown = formatCountdown(next.readyAt, Math.floor(currentTime / 1000));

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: spacing.lg,
        flexWrap: "wrap",
        padding: spacing.xl,
        marginBottom: spacing.xl,
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.warning.main}`,
        backgroundColor: colors.background.primary,
      }}
    >
      <div>
        <div style={{ color: colors.warning.light, fontWeight: "bold", marginBottom: spacing.xs }}>
          ⏳ {queued.length === 1 ? "A contract upgrade is" : `${queued.length} contract changes are`} queued
        </div>
        <div style={{ color: colors.text.secondary, fontSize: fontSize.sm }}>
          {next.actionLabel} on {next.targetLabel} —{" "}
          {countdown.ready ? "executable now" : `earliest execution in ${countdown.text.replace(" remaining", "")}`}.
          You can review it and, if you disagree, withdraw your funds before it takes effect.
        </div>
      </div>
      <button style={buttonStyles.secondary} onClick={() => navigate("/governance")}>
        Review changes
      </button>
    </div>
  );
};

UpgradeBanner.propTypes = {
  transactionManager: PropTypes.object,
  currentTime: PropTypes.number.isRequired,
  navigate: PropTypes.func.isRequired,
};

export default UpgradeBanner;
