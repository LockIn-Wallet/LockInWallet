import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

import CollapsibleSection from "../atoms/CollapsibleSection.js";
import LockCard from "../molecules/LockCard.js";
import CreateLockForm from "../molecules/CreateLockForm.js";

import { buttonStyles, formStyles, lockStyles } from "../../styles";
import { getPriceFeeds, lockProofPath } from "../../utils/locks.js";
import { LOCKS_SECTION_TITLE, LOCKS_LEDE, LOCK_NO_FUNDS_NOTE } from "../../utils/lockContent.js";
import { trackEvent } from "../../utils/posthog.js";

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * LocksSection - the locked-vaults panel on the dashboard.
 *
 * The only component that talks to the adapter about locks. It renders
 * nothing when the network has no lock factory, so no caller has to know
 * which chain it is on.
 */
const LocksSection = ({ transactionManager, networkConfig, chainKey }) => {
  const [locks, setLocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [customToken, setCustomToken] = useState("");

  const supported = transactionManager?.supportsLocks?.() ?? false;

  const tokens = useMemo(() => {
    const listed = Object.values(networkConfig?.tokens || {})
      .filter((token) => token.address && token.address !== ZERO)
      .map((token) => ({ address: token.address, symbol: token.symbol }));
    const native = networkConfig?.nativeCurrency
      ? [{ address: ZERO, symbol: networkConfig.nativeCurrency.symbol }]
      : [];
    const custom = /^0x[0-9a-fA-F]{40}$/.test(customToken)
      ? [{ address: customToken, symbol: "Custom token", custom: true }]
      : [];
    return [...native, ...listed, ...custom];
  }, [networkConfig, customToken]);

  const refresh = useCallback(async () => {
    if (!supported) {
      setLoading(false);
      return;
    }
    try {
      setLocks(await transactionManager.getLocks());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [transactionManager, supported]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (action, eventName) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (eventName) trackEvent(eventName);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  return (
    <CollapsibleSection title={LOCKS_SECTION_TITLE} icon="lock" defaultExpanded={false}>
      <p style={lockStyles.lede}>{LOCKS_LEDE}</p>

      {loading ? (
        <p style={lockStyles.meta}>Reading your locks…</p>
      ) : locks.length === 0 ? (
        <p style={lockStyles.meta}>{LOCK_NO_FUNDS_NOTE}</p>
      ) : (
        <div style={lockStyles.list}>
          {locks.map((lock) => (
            <LockCard
              key={lock.address}
              lock={lock}
              tokens={tokens}
              proofHref={lockProofPath(chainKey, lock.address)}
              busy={busy}
              onDeposit={(lockAddress, tokenAddress, amount) =>
                run(
                  () => transactionManager.depositToLock(lockAddress, tokenAddress, amount),
                  "lock_deposit_completed",
                )
              }
              onRelease={(lockAddress, tokenAddress) =>
                run(() => transactionManager.releaseLock(lockAddress, tokenAddress), "lock_released")
              }
            />
          ))}
        </div>
      )}

      {error && <p style={lockStyles.error}>{error}</p>}

      <label style={formStyles.fieldLabel}>
        Custom token address (optional)
        <input
          style={formStyles.input}
          type="text"
          placeholder="0x…"
          value={customToken}
          onChange={(event) => setCustomToken(event.target.value.trim())}
        />
      </label>

      {showForm ? (
        <CreateLockForm
          priceFeeds={getPriceFeeds(networkConfig)}
          busy={busy}
          onCreate={(draft) =>
            run(async () => {
              await transactionManager.createLock({
                ...draft,
                tokenAddress: customToken || null,
              });
              setShowForm(false);
            }, "lock_created")
          }
        />
      ) : (
        <button type="button" style={buttonStyles.primary} onClick={() => setShowForm(true)}>
          Create a locked vault
        </button>
      )}
    </CollapsibleSection>
  );
};

LocksSection.propTypes = {
  transactionManager: PropTypes.object,
  networkConfig: PropTypes.object,
  chainKey: PropTypes.string,
};

export default LocksSection;
