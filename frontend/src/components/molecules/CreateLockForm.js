import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";

import { buttonStyles, formStyles, lockStyles } from "../../styles";
import {
  LOCK_RULE_TYPES,
  DATE_PRESETS,
  PRICE_DIRECTIONS,
  fromDateInputValue,
  toDateInputValue,
  validateLockDraft,
} from "../../utils/locks.js";
import { LOCK_CONFIRMATION } from "../../utils/lockContent.js";

const RULE_OPTIONS = [
  { value: LOCK_RULE_TYPES.date, label: "On a date" },
  { value: LOCK_RULE_TYPES.price, label: "When a price is reached" },
];

const now = () => Math.floor(Date.now() / 1000);

/**
 * CreateLockForm - choose what the lock watches and when it opens at the
 * latest. Validation is the same function the adapter trusts, so the form can
 * never send a draft the contract would refuse for a reason we could have
 * caught here.
 */
const CreateLockForm = ({ priceFeeds, onCreate, busy }) => {
  const [ruleType, setRuleType] = useState(LOCK_RULE_TYPES.date);
  const [unlockAt, setUnlockAt] = useState(now() + DATE_PRESETS[2].seconds);
  const [feed, setFeed] = useState(priceFeeds[0]?.address || "");
  const [direction, setDirection] = useState(PRICE_DIRECTIONS[0].value);
  const [threshold, setThreshold] = useState("");
  const [deadline, setDeadline] = useState(now() + DATE_PRESETS[3].seconds);
  const [confirmed, setConfirmed] = useState(false);

  const draft = useMemo(
    () => ({
      ruleType,
      unlockAt,
      feed,
      threshold,
      above: direction === "above",
      deadline,
    }),
    [ruleType, unlockAt, feed, threshold, direction, deadline],
  );
  const error = validateLockDraft(draft);
  const canSubmit = !error && confirmed && !busy;
  const isDate = ruleType === LOCK_RULE_TYPES.date;

  return (
    <form
      style={lockStyles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onCreate(draft);
      }}
    >
      <label style={formStyles.fieldLabel}>
        The lock opens
        <select
          style={formStyles.select}
          value={ruleType}
          onChange={(event) => setRuleType(event.target.value)}
        >
          {RULE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {isDate ? (
        <>
          <div style={lockStyles.presetRow}>
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                style={buttonStyles.small}
                onClick={() => setUnlockAt(now() + preset.seconds)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label style={formStyles.fieldLabel}>
            Unlock date
            <input
              style={formStyles.input}
              type="date"
              value={toDateInputValue(unlockAt)}
              onChange={(event) => setUnlockAt(fromDateInputValue(event.target.value))}
            />
          </label>
        </>
      ) : (
        <>
          {priceFeeds.length === 0 ? (
            <p style={lockStyles.error}>No verified price feeds on this network yet.</p>
          ) : (
            <div style={lockStyles.fieldRow}>
              <label style={formStyles.fieldLabel}>
                Watch
                <select
                  style={formStyles.select}
                  value={feed}
                  onChange={(event) => setFeed(event.target.value)}
                >
                  {priceFeeds.map((option) => (
                    <option key={option.address} value={option.address}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={formStyles.fieldLabel}>
                Until it
                <select
                  style={formStyles.select}
                  value={direction}
                  onChange={(event) => setDirection(event.target.value)}
                >
                  {PRICE_DIRECTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={formStyles.fieldLabel}>
                Price
                <input
                  style={formStyles.input}
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 5000"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                />
              </label>
            </div>
          )}
          <label style={formStyles.fieldLabel}>
            Opens on this date at the latest, whatever the price does
            <input
              style={formStyles.input}
              type="date"
              value={toDateInputValue(deadline)}
              onChange={(event) => setDeadline(fromDateInputValue(event.target.value))}
            />
          </label>
        </>
      )}

      <div style={lockStyles.warning}>
        {LOCK_CONFIRMATION}
        <label style={{ ...formStyles.fieldLabel, display: "block", marginTop: lockStyles.actions.marginTop }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />{" "}
          I understand there is no early exit.
        </label>
      </div>

      {error && confirmed && <p style={lockStyles.error}>{error}</p>}

      <button type="submit" style={canSubmit ? buttonStyles.primary : buttonStyles.disabled} disabled={!canSubmit}>
        {busy ? "Creating lock…" : "Create lock"}
      </button>
    </form>
  );
};

CreateLockForm.propTypes = {
  priceFeeds: PropTypes.array.isRequired,
  onCreate: PropTypes.func.isRequired,
  busy: PropTypes.bool,
};

export default CreateLockForm;
