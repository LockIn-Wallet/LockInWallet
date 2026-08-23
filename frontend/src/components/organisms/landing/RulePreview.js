import React, { useState } from "react";

import { landingStyles } from "../../../styles";

import { PREVIEW } from "../../../utils/landingContent.js";
import { formatUSD } from "../../../utils/homeDemo.js";

const parseAmount = (value) => Math.max(0, parseFloat(value) || 0);

/**
 * RulePreview - the hero widget: type an amount, an allowance and a wait, and
 * read back exactly what the rules would do. Pure client-side arithmetic — no
 * sign-in, no network — because the sentence it produces is the pitch.
 */
const RulePreview = ({ onLaunch }) => {
  const [amount, setAmount] = useState(String(PREVIEW.defaultAmount));
  const [allowance, setAllowance] = useState(String(PREVIEW.defaultAllowance));
  const [wait, setWait] = useState(PREVIEW.waitOptions[0].value);

  const total = parseAmount(amount);
  const weekly = parseAmount(allowance);
  const protectedAmount = Math.max(0, total - weekly);
  const allProtected = weekly === 0;

  return (
    <div style={landingStyles.previewCard}>
      <div style={landingStyles.consoleBar}>
        <span style={landingStyles.consoleLabel}>{PREVIEW.label}</span>
      </div>

      <div style={landingStyles.previewFields}>
        <label style={landingStyles.previewField}>
          <span style={landingStyles.balanceLabel}>{PREVIEW.amountLabel}</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            style={landingStyles.previewInput}
          />
        </label>

        <label style={landingStyles.previewField}>
          <span style={landingStyles.balanceLabel}>
            {PREVIEW.allowanceLabel}
          </span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={allowance}
            onChange={(event) => setAllowance(event.target.value)}
            style={landingStyles.previewInput}
          />
        </label>

        <label style={landingStyles.previewField}>
          <span style={landingStyles.balanceLabel}>{PREVIEW.waitLabel}</span>
          <select
            value={wait}
            onChange={(event) => setWait(event.target.value)}
            style={landingStyles.previewInput}
          >
            {PREVIEW.waitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p style={landingStyles.previewSentence} aria-live="polite">
        {weekly >= total && !allProtected ? (
          <>
            All{" "}
            <span style={landingStyles.previewStrong}>{formatUSD(total)}</span>{" "}
            would reach you instantly — pick an allowance smaller than the
            amount to put any of it out of reach.
          </>
        ) : (
          <>
            <span style={landingStyles.previewStrong}>
              {formatUSD(protectedAmount)}
            </span>{" "}
            stays out of reach.{" "}
            {allProtected ? (
              "Nothing reaches you without announcing itself"
            ) : (
              <>
                <span style={landingStyles.previewStrong}>
                  {formatUSD(weekly)}
                </span>{" "}
                a week reaches you instantly. Anything more announces itself
              </>
            )}{" "}
            and waits <span style={landingStyles.previewStrong}>{wait}</span> —
            and no one can skip the wait. Not us. Not you.
          </>
        )}
      </p>

      <div style={landingStyles.previewCtaRow}>
        <button
          type="button"
          style={landingStyles.ctaPrimary}
          onClick={onLaunch}
        >
          {PREVIEW.cta}
        </button>
      </div>
    </div>
  );
};

export default RulePreview;
