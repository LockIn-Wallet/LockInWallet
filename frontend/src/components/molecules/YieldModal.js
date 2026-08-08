import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

import { modalStyles, landingStyles, buttonStyles } from "../../styles";
import YieldOptionCards from "./YieldOptionCards.js";
import {
  YIELD_MODAL_EYEBROW,
  YIELD_MODAL_TITLE,
  YIELD_LEDE,
  YIELD_FEE_NOTE,
  YIELD_RISK_NOTE,
  YIELD_APY_CAVEAT,
} from "../../utils/yieldContent.js";

const TITLE_ID = "yield-options-title";

/**
 * YieldModal - pick how a vault's balance earns.
 *
 * Dialog mechanics follow WalletOnboardingModal exactly: Escape closes, the page
 * behind stops scrolling, clicking the backdrop dismisses, and the panel stops
 * click propagation so an inside click never closes it.
 *
 * The choice is staged locally and only submitted on confirm — switching earning
 * off divests real funds, so it should not fire on a stray click.
 */
const YieldModal = ({ open, currentMode, options, onClose, onConfirm, saving = false }) => {
  const [choice, setChoice] = useState(currentMode);

  // Re-sync whenever the dialog reopens, so a cancelled edit does not persist.
  useEffect(() => {
    if (open) setChoice(currentMode);
  }, [open, currentMode]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const unchanged = choice === currentMode;

  return (
    <div style={modalStyles.overlay} onClick={onClose} role="presentation">
      <div
        style={modalStyles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          style={modalStyles.close}
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <p style={modalStyles.eyebrow}>{YIELD_MODAL_EYEBROW}</p>
        <h2 id={TITLE_ID} style={modalStyles.title}>
          {YIELD_MODAL_TITLE}
        </h2>
        <p style={modalStyles.lede}>{YIELD_LEDE}</p>

        <YieldOptionCards
          options={options}
          selected={choice}
          onSelect={setChoice}
          disabled={saving}
        />

        <p style={modalStyles.note}>
          <span aria-hidden="true">💰</span>
          <span>{YIELD_FEE_NOTE}</span>
        </p>

        {/* Only warn about protocol risk for the options that carry it. */}
        {choice === "off" ? null : (
          <p style={modalStyles.note}>
            <span aria-hidden="true">⚠️</span>
            <span>{YIELD_RISK_NOTE}</span>
          </p>
        )}

        <div style={modalStyles.footer}>
          <button
            type="button"
            style={unchanged || saving ? buttonStyles.disabled : landingStyles.ctaPrimary}
            onClick={() => onConfirm(choice)}
            disabled={unchanged || saving}
          >
            {saving ? "Saving…" : "Save choice"}
          </button>
          <button
            type="button"
            style={landingStyles.ctaSecondary}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>

        <p style={modalStyles.footnote}>{YIELD_APY_CAVEAT}</p>
      </div>
    </div>
  );
};

YieldModal.propTypes = {
  open: PropTypes.bool.isRequired,
  currentMode: PropTypes.string,
  options: PropTypes.array,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  saving: PropTypes.bool,
};

YieldModal.defaultProps = {
  currentMode: "off",
  options: [],
};

export default YieldModal;
