import React from "react";
import PropTypes from "prop-types";

import { balanceEarningStyles } from "../../styles";
import Toggle from "../atoms/Toggle.js";
import { BALANCE_EARNING } from "../../utils/yieldContent.js";

/**
 * The earning switch for one coin, on that coin's balance.
 *
 * Per coin because each earns in its own market and what is on offer differs
 * between them: one may have a prize pool where another has only a steady rate.
 * A single switch for the whole vault could not express that without either
 * hiding the prize pool from the coin that has one, or claiming it for the coin
 * that does not.
 *
 * Flipping it opens the dialog rather than switching straight to a steady rate.
 * There are three answers, not two, and picking one of them on the user's
 * behalf because the control has two positions would be choosing for them.
 */
const CoinEarningToggle = ({ earning, busy = false, onOpen }) => {
  if (!earning) return null;

  const isOn = earning.mode !== "off";
  const rate = earning.options?.find((option) => option.key === "stable")?.netApyPercent;

  const label =
    earning.mode === "prize"
      ? BALANCE_EARNING.prize
      : isOn
        ? BALANCE_EARNING.earning(rate)
        : BALANCE_EARNING.idle(rate);

  return (
    <div style={balanceEarningStyles.row}>
      <span style={{ ...balanceEarningStyles.label, ...(isOn ? balanceEarningStyles.labelOn : {}) }}>
        {label}
      </span>
      <Toggle
        checked={isOn}
        busy={busy}
        // Both directions open the dialog: turning earning off is a real
        // decision — it moves money out of a protocol — and deserves the same
        // moment of confirmation as turning it on.
        onChange={onOpen}
        label={BALANCE_EARNING.toggleLabel(earning.symbol)}
      />
    </div>
  );
};

CoinEarningToggle.propTypes = {
  /** One entry from the yield status's `tokens`, or null to render nothing. */
  earning: PropTypes.shape({
    address: PropTypes.string,
    symbol: PropTypes.string,
    mode: PropTypes.string,
    options: PropTypes.array,
  }),
  busy: PropTypes.bool,
  onOpen: PropTypes.func.isRequired,
};

export default CoinEarningToggle;
