import React from "react";
import PropTypes from "prop-types";
import { toggleStyles } from "../../styles";

/**
 * An on/off switch.
 *
 * A real `<button role="switch">` rather than a styled div: it reaches keyboard
 * and screen-reader users for free, and `aria-checked` says what a coloured
 * track cannot.
 *
 * `busy` is distinct from `disabled` on purpose. Flipping this sends a
 * transaction, and until it confirms the switch must not accept a second click
 * — but it should still read as the thing it is, not as unavailable.
 */
const Toggle = ({ checked, onChange, label, disabled = false, busy = false }) => {
  const inactive = disabled || busy;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={inactive}
      onClick={() => !inactive && onChange(!checked)}
      style={{
        ...toggleStyles.track,
        ...(checked ? toggleStyles.trackOn : toggleStyles.trackOff),
        ...(inactive ? toggleStyles.trackInactive : {}),
      }}
    >
      <span
        style={{
          ...toggleStyles.knob,
          ...(checked ? toggleStyles.knobOn : toggleStyles.knobOff),
        }}
      />
    </button>
  );
};

Toggle.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  /** Announced to screen readers — the track alone says nothing. */
  label: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  busy: PropTypes.bool,
};

export default Toggle;
