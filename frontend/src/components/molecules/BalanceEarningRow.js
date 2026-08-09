import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";

import { balanceEarningStyles } from "../../styles";
import Toggle from "../atoms/Toggle.js";
import { isYieldEnabled } from "../../utils/featureFlags.js";
import { BALANCE_EARNING } from "../../utils/yieldContent.js";

/**
 * The everyday earning switch, sitting under the balance.
 *
 * Earning belongs next to the money it applies to — that is where people look,
 * and "is my balance earning?" is a property of the balance, not a separate
 * topic. The full panel further down still owns the three-way choice, the
 * figures and the explanation; this is only the switch.
 *
 * It renders nothing unless earning genuinely applies: flag off, no yield
 * module on this chain, no vault selected, or a vault holding nothing that can
 * earn. A dead switch is worse than no switch.
 */
const BalanceEarningRow = ({ transactionManager, activeVaultAddress, onChanged }) => {
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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

  const handleToggle = async (next) => {
    setSaving(true);
    setError(null);
    try {
      await transactionManager.setYieldMode(next ? "stable" : "off");
      await load();
      onChanged?.();
    } catch (err) {
      setError(err?.message || "Could not change how your savings earn");
    } finally {
      setSaving(false);
    }
  };

  if (!status?.supported || !status.tokenSupported) return null;

  // "mixed" means some coins earn and some do not, which a two-state switch
  // cannot represent. Say so rather than rounding it to one or the other, and
  // let the switch turn everything on.
  const isMixed = status.mode === "mixed";
  const isOn = status.mode !== "off";
  const rate = status.tokens?.find((token) => token.mode !== "off" || token.canEarn)
    ?.options?.find((option) => option.key === "stable")?.netApyPercent;

  return (
    <div style={balanceEarningStyles.row}>
      <div style={balanceEarningStyles.text}>
        <div style={balanceEarningStyles.headline}>
          {isMixed
            ? BALANCE_EARNING.mixed
            : isOn
              ? BALANCE_EARNING.on(rate)
              : BALANCE_EARNING.off(rate)}
        </div>
        <div style={balanceEarningStyles.sub}>
          {isOn ? BALANCE_EARNING.onDetail : BALANCE_EARNING.offDetail}
        </div>
        {error ? (
          <div role="alert" style={balanceEarningStyles.error}>
            {error}
          </div>
        ) : null}
      </div>

      <Toggle
        checked={isOn}
        busy={saving}
        onChange={handleToggle}
        label={BALANCE_EARNING.toggleLabel}
      />
    </div>
  );
};

BalanceEarningRow.propTypes = {
  transactionManager: PropTypes.object,
  activeVaultAddress: PropTypes.string,
  /** Lets the balance refresh once funds have moved in or out of the strategy. */
  onChanged: PropTypes.func,
};

export default BalanceEarningRow;
