import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

import {
  buttonStyles,
  cardStyles,
  formStyles,
  layoutStyles,
  utilityStyles,
  spacing,
} from "../../styles";
import { truncateAddress } from "../../utils/addressUtils.js";

/**
 * RecoverySection Component
 *
 * Seed-compromise protection for the connected account:
 * - Register a cold recovery key (hardware wallet / offline seed)
 * - See and veto pending recovery-key changes (the 30-day timelock)
 * - Freeze the account instantly if the seed leaks
 *
 * Plus a recovery-key console: when the connected wallet IS the recovery key
 * for another account, it can freeze/unfreeze that account and move it to a
 * fresh address.
 */
const RecoverySection = ({ transactionManager, userAddress }) => {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [changeInput, setChangeInput] = useState("");
  const [showChangeForm, setShowChangeForm] = useState(false);

  // Recovery-key console state (acting on someone else's account)
  const [targetInput, setTargetInput] = useState("");
  const [targetStatus, setTargetStatus] = useState(null);
  const [newOwnerInput, setNewOwnerInput] = useState("");

  const loadStatus = useCallback(async () => {
    if (!transactionManager || !userAddress) return;
    setIsLoading(true);
    try {
      setStatus(await transactionManager.getRecoveryStatus(userAddress));
    } catch (error) {
      console.error("Error loading recovery status:", error);
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [transactionManager, userAddress]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const run = async (action, successMessage) => {
    setIsBusy(true);
    try {
      await action();
      if (successMessage) alert(successMessage);
      await loadStatus();
      if (targetInput) await checkTarget(targetInput);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  const checkTarget = async (address) => {
    try {
      setTargetStatus(await transactionManager.getRecoveryStatus(address));
    } catch (error) {
      console.error("Error loading target recovery status:", error);
      setTargetStatus(null);
      alert(error.message);
    }
  };

  const handleProtect = () =>
    run(
      () => transactionManager.setRecoveryAddress(recoveryInput.trim()),
      "Recovery key registered. Keep it offline and never use it for daily transactions.",
    );

  const handleFreeze = () => {
    if (
      !window.confirm(
        "Freeze this account? All outgoing transfers will be blocked until your RECOVERY KEY unfreezes it — this wallet cannot undo the freeze.",
      )
    )
      return;
    run(() => transactionManager.freezeAccount(), "Account frozen.");
  };

  const handleRecover = () => {
    if (
      !window.confirm(
        `Move account ${truncateAddress(targetInput)} and ALL its savings to ${truncateAddress(newOwnerInput)}? The old account is disabled permanently — this cannot be undone.`,
      )
    )
      return;
    run(
      () => transactionManager.recoverAccount(targetInput.trim(), newOwnerInput.trim()),
      "Account recovered — the savings now belong to the new address.",
    );
  };

  const pendingChangeReady =
    status?.pendingChange && Date.now() >= status.pendingChange.executeAfter.getTime();

  if (isLoading) {
    return <p style={utilityStyles.loadingText}>Loading recovery status...</p>;
  }

  if (!status?.supported) {
    return (
      <p style={utilityStyles.textMuted}>
        Recovery protection is not available on this network yet.
      </p>
    );
  }

  return (
    <div>
      {status.isRecovered ? (
        <div style={cardStyles.warningCard}>
          This account was recovered: its savings were moved to a new address
          and this account is permanently disabled.
        </div>
      ) : (
        <>
          {status.isFrozen && (
            <div style={cardStyles.warningCard}>
              🧊 This account is <strong>frozen</strong> — every outgoing
              transfer is blocked. Only the recovery key can unfreeze it or
              move the savings to a fresh address.
            </div>
          )}

          {!status.recoveryAddress ? (
            <div style={layoutStyles.section}>
              <p style={{ ...utilityStyles.textSecondary, marginBottom: spacing.md }}>
                If your seed phrase ever leaks, a thief can withdraw at your
                spending-limit rate. A <strong>recovery key</strong> — a
                hardware wallet or a second seed you keep offline — can
                instantly freeze this account and move your savings to a new
                address, and a thief can never remove it: trying starts a
                30-day public countdown your recovery key can always cancel.
              </p>
              <div style={{ ...layoutStyles.flexAlignCenter, gap: spacing.md }}>
                <input
                  type="text"
                  placeholder="Recovery address (0x…)"
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                  style={{ ...formStyles.input, ...utilityStyles.addressText }}
                />
                <button
                  style={isBusy || !recoveryInput.trim() ? buttonStyles.disabled : buttonStyles.primary}
                  disabled={isBusy || !recoveryInput.trim()}
                  onClick={handleProtect}
                >
                  🛟 Protect my account
                </button>
              </div>
              <p style={{ ...utilityStyles.textMuted, marginTop: spacing.sm }}>
                Use an address whose key is NOT derived from this wallet's seed
                and is stored offline.
              </p>
            </div>
          ) : (
            <div style={layoutStyles.section}>
              <div style={{ ...layoutStyles.flexBetween, marginBottom: spacing.md }}>
                <span style={utilityStyles.textSecondary}>Recovery key</span>
                <span style={{ ...utilityStyles.addressText, ...utilityStyles.textSuccess }}>
                  {truncateAddress(status.recoveryAddress)} ✅
                </span>
              </div>

              {status.pendingChange && (
                <div style={cardStyles.warningCard}>
                  <p style={{ marginBottom: spacing.sm }}>
                    ⚠️ Pending recovery key change to{" "}
                    <span style={utilityStyles.addressText}>
                      {status.pendingChange.newRecovery
                        ? truncateAddress(status.pendingChange.newRecovery)
                        : "none (removal)"}
                    </span>{" "}
                    — executable after{" "}
                    {status.pendingChange.executeAfter.toLocaleString()}. If
                    you didn't request this, freeze your account now and use
                    your recovery key.
                  </p>
                  <div style={{ ...layoutStyles.flexAlignCenter, gap: spacing.md }}>
                    <button
                      style={isBusy ? buttonStyles.disabled : buttonStyles.warning}
                      disabled={isBusy}
                      onClick={() =>
                        run(
                          () => transactionManager.cancelRecoveryKeyChange(),
                          "Pending recovery key change cancelled.",
                        )
                      }
                    >
                      Cancel change
                    </button>
                    {pendingChangeReady && !status.isFrozen && (
                      <button
                        style={isBusy ? buttonStyles.disabled : buttonStyles.primary}
                        disabled={isBusy}
                        onClick={() =>
                          run(
                            () => transactionManager.executeRecoveryKeyChange(),
                            "Recovery key changed.",
                          )
                        }
                      >
                        Apply change
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ ...layoutStyles.flexAlignCenter, gap: spacing.md, marginTop: spacing.md }}>
                {!status.isFrozen && (
                  <button
                    style={isBusy ? buttonStyles.disabled : buttonStyles.danger}
                    disabled={isBusy}
                    onClick={handleFreeze}
                  >
                    🧊 Freeze account now
                  </button>
                )}
                {!status.pendingChange && !status.isFrozen && (
                  <button
                    style={buttonStyles.secondary}
                    onClick={() => setShowChangeForm(!showChangeForm)}
                  >
                    Change recovery key…
                  </button>
                )}
              </div>

              {showChangeForm && !status.pendingChange && !status.isFrozen && (
                <div style={{ marginTop: spacing.md }}>
                  <p style={{ ...utilityStyles.textMuted, marginBottom: spacing.sm }}>
                    Changing the recovery key from this wallet takes 30 days
                    and is publicly visible — your current recovery key can
                    cancel it at any time. (Your recovery key itself can switch
                    instantly.)
                  </p>
                  <div style={{ ...layoutStyles.flexAlignCenter, gap: spacing.md }}>
                    <input
                      type="text"
                      placeholder="New recovery address (empty = remove)"
                      value={changeInput}
                      onChange={(e) => setChangeInput(e.target.value)}
                      style={{ ...formStyles.input, ...utilityStyles.addressText }}
                    />
                    <button
                      style={isBusy ? buttonStyles.disabled : buttonStyles.warning}
                      disabled={isBusy}
                      onClick={() =>
                        run(
                          () => transactionManager.requestRecoveryKeyChange(changeInput.trim() || null),
                          "Recovery key change requested — it can be applied in 30 days unless cancelled.",
                        )
                      }
                    >
                      Start 30-day change
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Recovery-key console: this wallet acting as someone's cold key */}
      <div style={layoutStyles.section}>
        <h4 style={{ ...utilityStyles.textPrimary, marginBottom: spacing.sm }}>
          Act as a recovery key
        </h4>
        <p style={{ ...utilityStyles.textMuted, marginBottom: spacing.md }}>
          If this wallet is the recovery key for another account, manage that
          account here.
        </p>
        <div style={{ ...layoutStyles.flexAlignCenter, gap: spacing.md }}>
          <input
            type="text"
            placeholder="Protected account address (0x…)"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            style={{ ...formStyles.input, ...utilityStyles.addressText }}
          />
          <button
            style={!targetInput.trim() ? buttonStyles.disabled : buttonStyles.secondary}
            disabled={!targetInput.trim()}
            onClick={() => checkTarget(targetInput.trim())}
          >
            Check
          </button>
        </div>

        {targetStatus?.supported && (
          <div style={{ marginTop: spacing.md }}>
            {!targetStatus.isRecoveryKeyFor ? (
              <p style={utilityStyles.textMuted}>
                This wallet is not the recovery key for that account.
              </p>
            ) : targetStatus.isRecovered ? (
              <p style={utilityStyles.textMuted}>
                That account was already recovered to a new address.
              </p>
            ) : (
              <>
                <p style={{ ...utilityStyles.textSecondary, marginBottom: spacing.md }}>
                  ✅ This wallet is the recovery key for{" "}
                  <span style={utilityStyles.addressText}>{truncateAddress(targetInput)}</span>
                  {targetStatus.isFrozen && " — currently frozen"}
                  {targetStatus.pendingChange &&
                    " — has a PENDING recovery key change you may want to cancel"}
                </p>
                <div style={{ ...layoutStyles.flexAlignCenter, gap: spacing.md, marginBottom: spacing.md }}>
                  {targetStatus.isFrozen ? (
                    <button
                      style={isBusy ? buttonStyles.disabled : buttonStyles.success}
                      disabled={isBusy}
                      onClick={() =>
                        run(() => transactionManager.unfreezeAccount(targetInput.trim()), "Account unfrozen.")
                      }
                    >
                      Unfreeze
                    </button>
                  ) : (
                    <button
                      style={isBusy ? buttonStyles.disabled : buttonStyles.danger}
                      disabled={isBusy}
                      onClick={() =>
                        run(() => transactionManager.freezeAccount(targetInput.trim()), "Account frozen.")
                      }
                    >
                      🧊 Freeze
                    </button>
                  )}
                  {targetStatus.pendingChange && (
                    <button
                      style={isBusy ? buttonStyles.disabled : buttonStyles.warning}
                      disabled={isBusy}
                      onClick={() =>
                        run(
                          () => transactionManager.cancelRecoveryKeyChange(targetInput.trim()),
                          "Pending recovery key change cancelled.",
                        )
                      }
                    >
                      Cancel pending key change
                    </button>
                  )}
                </div>
                <div style={{ ...layoutStyles.flexAlignCenter, gap: spacing.md }}>
                  <input
                    type="text"
                    placeholder="New owner address (fresh, uncompromised)"
                    value={newOwnerInput}
                    onChange={(e) => setNewOwnerInput(e.target.value)}
                    style={{ ...formStyles.input, ...utilityStyles.addressText }}
                  />
                  <button
                    style={isBusy || !newOwnerInput.trim() ? buttonStyles.disabled : buttonStyles.danger}
                    disabled={isBusy || !newOwnerInput.trim()}
                    onClick={handleRecover}
                  >
                    Move account
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

RecoverySection.propTypes = {
  transactionManager: PropTypes.object,
  userAddress: PropTypes.string,
};

export default RecoverySection;
