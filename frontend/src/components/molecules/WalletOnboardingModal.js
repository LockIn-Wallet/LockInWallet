import React, { useEffect } from "react";
import PropTypes from "prop-types";

import { modalStyles, landingStyles } from "../../styles";

import {
  METAMASK_DOWNLOAD_URL,
  ONBOARDING_TITLE,
  ONBOARDING_LEDE,
  ONBOARDING_BLOCKS,
  ONBOARDING_STEPS,
  ONBOARDING_WARNING,
  ONBOARDING_FOOTNOTE,
} from "../../utils/walletOnboardingContent.js";

const TITLE_ID = "wallet-onboarding-title";

/**
 * WalletOnboardingModal - shown when someone presses connect without a wallet
 * installed.
 *
 * The old behaviour was `alert("Please install MetaMask!")`, which tells a
 * newcomer neither what MetaMask is nor why a savings account needs one. This
 * explains both in plain words, then points at the download.
 */
const WalletOnboardingModal = ({ open, onClose }) => {
  // Escape closes, and the page behind stops scrolling while the dialog is up
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

  return (
    <div
      style={modalStyles.overlay}
      onClick={onClose}
      role="presentation"
    >
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

        <p style={modalStyles.eyebrow}>New here</p>
        <h2 id={TITLE_ID} style={modalStyles.title}>
          {ONBOARDING_TITLE}
        </h2>
        <p style={modalStyles.lede}>{ONBOARDING_LEDE}</p>

        {ONBOARDING_BLOCKS.map((block) => (
          <div key={block.title} style={modalStyles.block}>
            <span style={modalStyles.blockIcon} aria-hidden="true">
              {block.icon}
            </span>
            <span>
              <h3 style={modalStyles.blockTitle}>{block.title}</h3>
              <p style={modalStyles.blockText}>{block.text}</p>
            </span>
          </div>
        ))}

        <ol style={modalStyles.steps}>
          {ONBOARDING_STEPS.map((step, index) => (
            <li key={step} style={modalStyles.step}>
              <span style={modalStyles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <p style={modalStyles.note}>
          <span aria-hidden="true">⚠️</span>
          <span>{ONBOARDING_WARNING}</span>
        </p>

        <div style={modalStyles.footer}>
          <a
            href={METAMASK_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={landingStyles.ctaPrimary}
          >
            Get MetaMask →
          </a>
          <button
            type="button"
            style={landingStyles.ctaSecondary}
            onClick={() => window.location.reload()}
          >
            I've installed it
          </button>
        </div>

        <p style={modalStyles.footnote}>{ONBOARDING_FOOTNOTE}</p>
      </div>
    </div>
  );
};

WalletOnboardingModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
};

export default WalletOnboardingModal;
