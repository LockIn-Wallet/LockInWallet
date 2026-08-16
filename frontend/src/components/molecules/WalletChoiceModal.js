import React, { useEffect } from "react";
import PropTypes from "prop-types";

import { modalStyles } from "../../styles";

import { truncateAddress } from "../../utils/addressUtils.js";

const TITLE_ID = "wallet-choice-title";

/**
 * WalletChoiceModal — asked when someone presses connect and there is a real
 * choice to make.
 *
 * Two ways in, and what separates them is not visible from a label: one creates
 * a wallet for you and the other uses one you already have. Presenting them as
 * bare buttons meant people pressed the wrong one and got a popup they were not
 * expecting, so each option gets a sentence.
 *
 * The caller only opens this when an extension is actually installed. With no
 * wallet there is nothing to choose between, and a dialog whose second option
 * leads nowhere is worse than no dialog at all.
 *
 * The privacy line is deliberate and deliberately unflattering. Signing in is
 * non-custodial — the passkey never leaves the device — but a Coinbase-operated
 * service does see the requests and the IP behind them. This page has already
 * had to retract one claim it could not back, and the fix is to say the true
 * thing where the choice is made, not to leave it out.
 */
const WalletChoiceModal = ({
  open,
  onClose,
  onSignIn,
  onUseOwnWallet,
  canSignIn,
  walletName,
  walletAddress,
}) => {
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

  const choose = (action) => () => {
    onClose();
    action();
  };

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

        <p style={modalStyles.eyebrow}>Get started</p>
        <h2 id={TITLE_ID} style={modalStyles.title}>
          Which one sounds like you?
        </h2>

        <div style={modalStyles.optionGrid}>
          {canSignIn && (
            <button
              type="button"
              style={{ ...modalStyles.option, ...modalStyles.optionRecommended }}
              onClick={choose(onSignIn)}
            >
              <span style={modalStyles.optionBadge}>Easiest</span>
              <span style={modalStyles.optionTitle}>
                I'm new to this — make me a wallet
              </span>
              <span style={modalStyles.optionText}>
                Nothing to install and no seed phrase to keep. You sign in with
                a code sent to your email, or your fingerprint if your device
                offers it, and a wallet is created for you.
                <br />
                <br />
                The trade: Coinbase runs that sign-in, so an email code leaves
                them holding your email address next to your wallet — a record
                that connects your savings to you. They can never move your
                money, but they do know it is yours.
              </span>
            </button>
          )}

          {canSignIn && (
            <a href="/signing-in" style={modalStyles.footnote}>
              How signing in works, what it tells Coinbase, and how to get back
              in if you lose your phone →
            </a>
          )}

          <button
            type="button"
            style={modalStyles.option}
            onClick={choose(onUseOwnWallet)}
          >
            <span style={modalStyles.optionTitle}>
              {walletName
                ? `I already use crypto — connect ${walletName}`
                : "I already use crypto — connect my wallet"}
            </span>
            <span style={modalStyles.optionText}>
              {walletAddress ? (
                <>
                  Already connected as{" "}
                  <strong>{truncateAddress(walletAddress)}</strong>. The private
                  option: no email, no account with anyone, nothing about you
                  shared. You keep your own key and pay your own network fees —
                  which also means nobody can help you if you lose it.
                </>
              ) : (
                <>
                  The private option: no email, no account with anyone, nothing
                  about you shared. You keep your own key and pay your own
                  network fees — which also means nobody can help you if you
                  lose it.
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

WalletChoiceModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSignIn: PropTypes.func.isRequired,
  onUseOwnWallet: PropTypes.func.isRequired,
  canSignIn: PropTypes.bool,
  /** Name of the installed extension, when one was detected. */
  walletName: PropTypes.string,
  /** Account it has already shared with this site, if any. */
  walletAddress: PropTypes.string,
};

export default WalletChoiceModal;
