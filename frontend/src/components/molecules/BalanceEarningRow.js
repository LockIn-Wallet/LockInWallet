import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";

import { balanceEarningStyles } from "../../styles";
import Toggle from "../atoms/Toggle.js";
import Icon from "../atoms/Icon.js";
import YieldModal from "./YieldModal.js";
import { isYieldEnabled } from "../../utils/featureFlags.js";
import { BALANCE_EARNING } from "../../utils/yieldContent.js";

/**
 * The everyday earning switch, sitting under the balance.
 *
 * Earning belongs next to the money it applies to — that is where people look,
 * and "is my balance earning?" is a property of the balance, not a separate
 * topic. The panel further down still owns the figures and the explanation.
 *
 * The switch is the two-state answer; the sliders open the same dialog the panel
 * uses, for the three-way choice. Sharing that dialog rather than growing a
 * second one is what keeps the two places from drifting apart.
 *
 * It renders nothing unless earning genuinely applies: flag off, no yield module
 * on this chain, no vault selected, or a vault holding nothing that can earn. A
 * dead switch is worse than no switch.
 */
const BalanceEarningRow = ({ transactionManager, activeVaultAddress, onChanged }) => {
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [configuring, setConfiguring] = useState(false);

  const load = useCallback(async () => {
    if (!isYieldEnabled() || !transactionManager?.supportsYield?.()) {
      setStatus(null);
      return;
    }
    try {
      setStatus(await transactionManager.getYieldStatus());
    } catch {
      // Earning is an extra, never a reason the balance fails to render.
      setStatus(null);
    }
  }, [transactionManager]);

  useEffect(() => {
    load();
  }, [load, activeVaultAddress]);

  const applyMode = async (mode) => {
    setSaving(true);
    setError(null);
    try {
      await transactionManager.setYieldMode(mode);
      await load();
      setConfiguring(false);
      onChanged?.();
    } catch (err) {
      setError(err?.message || "Could not change how your savings earn");
    } finally {
      setSaving(false);
    }
  };

  if (!status?.supported || !status.tokenSupported) return null;

  const tokens = status.tokens || [];
  const earningTokens = tokens.filter((token) => token.mode !== "off");
  const idleTokens = tokens.filter((token) => token.mode === "off" && token.canEarn);

  // "mixed" means some coins earn and some do not — a state a two-state switch
  // cannot represent, so say it rather than rounding to one or the other.
  const isMixed = status.mode === "mixed";
  const isOn = status.mode !== "off";
  const rate = tokens
    .find((token) => token.canEarn)
    ?.options?.find((option) => option.key === "stable")?.netApyPercent;

  // What is actually in the protocol, which is not always the whole balance: a
  // deposit made while earning was off sits in the vault until it is invested.
  // Grouped and trimmed, so it reads like the balances above it rather than
  // like raw contract output ("4,000 USDT", not "4000.0 USDT").
  const amountsEarning = earningTokens.map(
    (token) =>
      `${Number(token.invested).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${token.symbol}`,
  );
  const coinNames = (list) => list.map((token) => token.symbol);

  const detail = isMixed
    ? BALANCE_EARNING.mixedDetail(coinNames(earningTokens), coinNames(idleTokens))
    : isOn
      ? BALANCE_EARNING.onDetail(amountsEarning)
      : BALANCE_EARNING.offDetail(coinNames(idleTokens));

  return (
    <>
      <div style={balanceEarningStyles.row}>
        <div style={balanceEarningStyles.text}>
          <div style={balanceEarningStyles.headline}>
            {isMixed
              ? BALANCE_EARNING.mixed
              : isOn
                ? BALANCE_EARNING.on(rate)
                : BALANCE_EARNING.off(rate)}
          </div>
          <div style={balanceEarningStyles.sub}>{detail}</div>
          {error ? (
            <div role="alert" style={balanceEarningStyles.error}>
              {error}
            </div>
          ) : null}
        </div>

        <div style={balanceEarningStyles.controls}>
          <button
            type="button"
            onClick={() => setConfiguring(true)}
            aria-label={BALANCE_EARNING.configureLabel}
            title={BALANCE_EARNING.configureLabel}
            style={balanceEarningStyles.configureButton}
          >
            <Icon name="sliders" size={18} />
          </button>

          <Toggle
            checked={isOn}
            busy={saving}
            onChange={(next) => applyMode(next ? "stable" : "off")}
            label={BALANCE_EARNING.toggleLabel}
          />
        </div>
      </div>

      {/* The same dialog the panel below opens, not a second copy of it. */}
      <YieldModal
        open={configuring}
        currentMode={isMixed ? "off" : status.mode}
        options={status.options}
        onClose={() => setConfiguring(false)}
        onConfirm={applyMode}
        saving={saving}
        error={error}
      />
    </>
  );
};

BalanceEarningRow.propTypes = {
  transactionManager: PropTypes.object,
  activeVaultAddress: PropTypes.string,
  /** Lets the balance refresh once funds have moved in or out of the strategy. */
  onChanged: PropTypes.func,
};

export default BalanceEarningRow;
