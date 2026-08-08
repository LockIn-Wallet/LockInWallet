import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";

import {
  cardStyles,
  layoutStyles,
  buttonStyles,
  colors,
  space,
  type,
  fontWeight,
  fontFamily,
} from "../../styles";
import ApyBadge from "../atoms/ApyBadge.js";
import YieldModal from "../molecules/YieldModal.js";
import { isYieldEnabled } from "../../utils/featureFlags.js";
import {
  YIELD_LEDE,
  YIELD_FEE_NOTE,
  YIELD_MODE_LABELS,
  YIELD_OFF_REASSURANCE,
} from "../../utils/yieldContent.js";

/**
 * YieldSection - the earning panel on the post-lock-in dashboard.
 *
 * The only component that talks to the adapter about earning. It renders nothing
 * at all when earning is unavailable — flag off, chain without a yield module,
 * no vault selected, or a vault whose token has no strategy — so no caller has
 * to work out whether the section applies.
 */
const YieldSection = ({ transactionManager }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!transactionManager?.supportsYield?.()) {
      setStatus(null);
      setLoading(false);
      return;
    }
    try {
      setStatus(await transactionManager.getYieldStatus());
    } catch (loadError) {
      // A failed read must not take the dashboard down; the section just hides.
      console.error("Could not load earning status:", loadError);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [transactionManager]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleConfirm = useCallback(
    async (mode) => {
      setSaving(true);
      setError(null);
      try {
        await transactionManager.setYieldMode(mode);
        setModalOpen(false);
        await refresh();
      } catch (saveError) {
        // The adapter already translated this into a sentence for the user.
        setError(saveError.message);
      } finally {
        setSaving(false);
      }
    },
    [transactionManager, refresh],
  );

  if (!isYieldEnabled()) return null;
  if (loading) return null;
  if (!status?.supported || !status?.tokenSupported) return null;

  const isEarning = status.mode !== "off";
  const activeOption = status.options?.find((option) => option.key === status.mode);

  return (
    <div>
      <p
        style={{
          margin: `0 0 ${space[4]} 0`,
          fontSize: type.small,
          color: colors.text.secondary,
          lineHeight: 1.6,
          textAlign: "left",
        }}
      >
        {YIELD_LEDE}
      </p>

      <div style={cardStyles.yieldStatRow}>
        <div style={cardStyles.yieldStat}>
          <div style={{ fontSize: type.caption, color: colors.text.muted, marginBottom: space[1] }}>
            Currently
          </div>
          <div
            style={{
              fontSize: type.body,
              fontWeight: fontWeight.medium,
              color: isEarning ? colors.success.light : colors.text.primary,
            }}
          >
            {YIELD_MODE_LABELS[status.mode] || "Not earning"}
          </div>
        </div>

        <div style={cardStyles.yieldStat}>
          <div style={{ fontSize: type.caption, color: colors.text.muted, marginBottom: space[1] }}>
            Your rate
          </div>
          {isEarning ? (
            <ApyBadge apyPercent={activeOption?.netApyPercent ?? 0} />
          ) : (
            <div style={{ fontSize: type.body, color: colors.text.muted }}>—</div>
          )}
        </div>

        <div style={cardStyles.yieldStat}>
          <div style={{ fontSize: type.caption, color: colors.text.muted, marginBottom: space[1] }}>
            Earning now
          </div>
          <div style={{ fontFamily: fontFamily.mono, fontSize: type.body, color: colors.text.primary }}>
            {status.invested} {status.tokenSymbol}
          </div>
        </div>

        <div style={cardStyles.yieldStat}>
          <div style={{ fontSize: type.caption, color: colors.text.muted, marginBottom: space[1] }}>
            Earned so far
          </div>
          <div style={{ fontFamily: fontFamily.mono, fontSize: type.body, color: colors.success.light }}>
            +{status.lifetimeYield} {status.tokenSymbol}
          </div>
        </div>
      </div>

      {/* Uncollected yield is real money the user owns but has not yet had folded
          into their balance, so it gets said out loud rather than hidden. */}
      {Number(status.pendingYield) > 0 ? (
        <p
          style={{
            margin: `0 0 ${space[4]} 0`,
            fontFamily: fontFamily.mono,
            fontSize: type.caption,
            color: colors.text.light,
            textAlign: "left",
          }}
        >
          {status.pendingYield} {status.tokenSymbol} of interest is waiting to be added to your
          balance. It is added automatically on your next deposit or withdrawal.
        </p>
      ) : null}

      <p
        style={{
          margin: `0 0 ${space[4]} 0`,
          fontSize: type.caption,
          color: colors.text.muted,
          lineHeight: 1.6,
          textAlign: "left",
        }}
      >
        {isEarning ? YIELD_FEE_NOTE : YIELD_OFF_REASSURANCE}
      </p>

      <div style={layoutStyles.flexAlignCenter}>
        {/* margin: 0 overrides index.css's global `button { margin: 10px auto }`,
            which would otherwise centre this against the left-aligned section. */}
        <button
          type="button"
          style={{ ...buttonStyles.primary, margin: 0 }}
          onClick={() => setModalOpen(true)}
        >
          {isEarning ? "Change how it earns" : "Start earning"}
        </button>
      </div>

      <YieldModal
        open={modalOpen}
        currentMode={status.mode}
        options={status.options}
        saving={saving}
        error={error}
        onClose={() => {
          setError(null);
          setModalOpen(false);
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

YieldSection.propTypes = {
  transactionManager: PropTypes.object,
};

export default YieldSection;
