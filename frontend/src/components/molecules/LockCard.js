import React, { useState } from "react";
import PropTypes from "prop-types";

import { buttonStyles, formStyles, lockStyles } from "../../styles";
import { describeRule, lockStatus, daysUntil } from "../../utils/locks.js";
import { truncateAddress } from "../../utils/addressUtils.js";

const STATUS_PILL = {
  locked: { style: lockStyles.pillLocked, label: "Locked" },
  ready: { style: lockStyles.pillReady, label: "Ready to release" },
  released: { style: lockStyles.pillReleased, label: "Released" },
};

/**
 * LockCard - one locked vault on the dashboard: its rule, what it holds, and
 * the two things its owner can do (deposit, release when open). The proof
 * link is the same page a stranger would see.
 */
const LockCard = ({ lock, tokens, proofHref, onDeposit, onRelease, busy }) => {
  const [depositToken, setDepositToken] = useState(tokens[0]?.address || "");
  const [depositAmount, setDepositAmount] = useState("");

  const status = lockStatus(lock);
  const pill = STATUS_PILL[status];

  return (
    <article style={lockStyles.card}>
      <div style={lockStyles.cardHeader}>
        <span style={pill.style}>{pill.label}</span>
        {!lock.verified && <span style={lockStyles.pillUnverified}>Unverified rule</span>}
        {status === "locked" && (
          <span style={lockStyles.meta}>{daysUntil(lock.deadline)} days at most</span>
        )}
      </div>

      <p style={lockStyles.rule}>{describeRule(lock)}</p>

      <div style={lockStyles.balanceRow}>
        {lock.balances.length === 0 ? (
          <span style={lockStyles.meta}>Nothing deposited yet</span>
        ) : (
          lock.balances.map((entry) => (
            <span key={entry.token} style={lockStyles.balance}>
              {entry.formatted} {entry.symbol}
            </span>
          ))
        )}
      </div>

      <p style={lockStyles.meta}>Lock address: {lock.address}</p>

      <div style={lockStyles.actions}>
        {status === "ready" &&
          lock.balances.map((entry) => (
            <button
              key={entry.token}
              type="button"
              style={busy ? buttonStyles.disabled : buttonStyles.success}
              disabled={busy}
              onClick={() => onRelease(lock.address, entry.token)}
            >
              Release {entry.symbol}
            </button>
          ))}
        <a href={proofHref} target="_blank" rel="noopener noreferrer" style={buttonStyles.secondary}>
          Public proof page
        </a>
      </div>

      {status === "locked" && (
        <div style={{ ...lockStyles.fieldRow, marginTop: lockStyles.actions.marginTop }}>
          <select
            style={formStyles.select}
            value={depositToken}
            onChange={(event) => setDepositToken(event.target.value)}
          >
            {tokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol} {token.custom ? `(${truncateAddress(token.address)})` : ""}
              </option>
            ))}
          </select>
          <input
            style={formStyles.input}
            type="number"
            min="0"
            step="any"
            placeholder="Amount"
            value={depositAmount}
            onChange={(event) => setDepositAmount(event.target.value)}
          />
          <button
            type="button"
            style={busy || !(Number(depositAmount) > 0) ? buttonStyles.disabled : buttonStyles.primary}
            disabled={busy || !(Number(depositAmount) > 0)}
            onClick={() => {
              onDeposit(lock.address, depositToken, depositAmount);
              setDepositAmount("");
            }}
          >
            Deposit into lock
          </button>
        </div>
      )}
    </article>
  );
};

LockCard.propTypes = {
  lock: PropTypes.object.isRequired,
  tokens: PropTypes.array.isRequired,
  proofHref: PropTypes.string.isRequired,
  onDeposit: PropTypes.func.isRequired,
  onRelease: PropTypes.func.isRequired,
  busy: PropTypes.bool,
};

export default LockCard;
