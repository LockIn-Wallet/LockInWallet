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
import CollapsibleSection from "../atoms/CollapsibleSection.js";
import { isYieldEnabled } from "../../utils/featureFlags.js";
import {
  YIELD_LEDE,
  YIELD_FEE_NOTE,
  YIELD_MODE_LABELS,
  YIELD_OFF_REASSURANCE,
  YIELD_PRIZE_WON_NOTE,
  YIELD_PRIZE_FEE_NOTE,
  YIELD_NO_VAULT_NOTE,
  YIELD_TOKEN_UNSUPPORTED_NOTE,
  YIELD_SECTION_TITLE,
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
  const [prizes, setPrizes] = useState(null);
  const [claiming, setClaiming] = useState(false);
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
      const next = await transactionManager.getYieldStatus();
      setStatus(next);
      // Winnings are a separate token from the deposit, so they are read and
      // shown separately rather than folded into the balance.
      setPrizes(
        next?.mode === "prize" ? await transactionManager.getClaimablePrizes() : null,
      );
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

  const handleClaim = useCallback(async () => {
    setClaiming(true);
    setError(null);
    try {
      await transactionManager.claimActiveVaultPrizes();
      await refresh();
    } catch (claimError) {
      setError(claimError.message);
    } finally {
      setClaiming(false);
    }
  }, [transactionManager, refresh]);

  if (!isYieldEnabled()) return null;
  if (loading) return null;

  // This component owns the whole section, header included. Deciding to render
  // the wrapper anywhere else means a header that expands to nothing whenever
  // the two disagree.
  const noVault = status?.reason === "no-vault";
  // Nothing to say at all when the chain has no yield module.
  if (!status?.supported && !noVault) return null;

  // Two cases worth explaining rather than hiding — a user who has just been
  // told their savings can earn deserves to know why this one can't.
  if (noVault || !status?.tokenSupported) {
    return (
      <CollapsibleSection title={YIELD_SECTION_TITLE} icon="sprout" defaultExpanded={true}>
        <p
          style={{
            margin: 0,
            fontSize: type.small,
            color: colors.text.secondary,
            lineHeight: 1.6,
            textAlign: "left",
          }}
        >
          {noVault ? YIELD_NO_VAULT_NOTE : YIELD_TOKEN_UNSUPPORTED_NOTE}
        </p>
      </CollapsibleSection>
    );
  }

  const isEarning = status.mode !== "off";
  const isPrize = status.mode === "prize";
  const activeOption = status.options?.find((option) => option.key === status.mode);

  return (
    <CollapsibleSection title={YIELD_SECTION_TITLE} icon="sprout" defaultExpanded={true}>
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
          {isPrize ? (
            // No rate exists to quote: the interest funds the draw instead.
            <div style={{ fontSize: type.body, color: colors.text.secondary }}>Prizes only</div>
          ) : isEarning ? (
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
            {isPrize ? "Grand prize" : "Earned so far"}
          </div>
          <div style={{ fontFamily: fontFamily.mono, fontSize: type.body, color: colors.success.light }}>
            {isPrize
              ? activeOption?.grandPrize || "—"
              : `+${status.lifetimeYield} ${status.tokenSymbol}`}
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

      {/* A win arrives in a different token, so it gets its own line and its
          own action rather than quietly changing the balance above. */}
      {prizes?.hasPrizes ? (
        <div style={{ ...cardStyles.yieldStat, marginBottom: space[4] }}>
          <div style={{ fontSize: type.caption, color: colors.text.muted, marginBottom: space[1] }}>
            You won
          </div>
          <div
            style={{
              fontFamily: fontFamily.mono,
              fontSize: type.lead,
              color: colors.success.light,
              marginBottom: space[2],
            }}
          >
            {prizes.amount} {prizes.tokenSymbol}
          </div>
          <p
            style={{
              margin: `0 0 ${space[3]} 0`,
              fontSize: type.caption,
              color: colors.text.muted,
              lineHeight: 1.6,
              textAlign: "left",
            }}
          >
            {YIELD_PRIZE_WON_NOTE}
          </p>
          <button
            type="button"
            style={{ ...(claiming ? buttonStyles.disabled : buttonStyles.success), margin: 0 }}
            onClick={handleClaim}
            disabled={claiming}
          >
            {claiming ? "Claiming…" : `Claim ${prizes.amount} ${prizes.tokenSymbol}`}
          </button>
        </div>
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
        {!isEarning ? YIELD_OFF_REASSURANCE : isPrize ? YIELD_PRIZE_FEE_NOTE : YIELD_FEE_NOTE}
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
    </CollapsibleSection>
  );
};

YieldSection.propTypes = {
  transactionManager: PropTypes.object,
};

export default YieldSection;
