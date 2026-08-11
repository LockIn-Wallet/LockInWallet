import { useCallback, useEffect, useMemo, useState } from "react";
import { isYieldEnabled } from "../utils/featureFlags.js";

/**
 * Earning, per coin, for the selected vault.
 *
 * A vault holds several coins and each earns in its own market, so what is on
 * offer differs between them — one may have a prize pool where another has only
 * a steady rate, and a third has neither. That is why this is keyed by coin
 * rather than by vault: a single answer for the whole vault would either hide
 * the prize pool from the coin that has one or claim it for the coin that does
 * not. The contract has always been per coin; this exposes what is there.
 *
 * Returns `null` for a coin the vault does not hold, or one nothing will take
 * yet, so callers can simply not render a control for it.
 */
export function useVaultEarning(transactionManager, activeVaultAddress) {
  const [status, setStatus] = useState(null);
  const [savingToken, setSavingToken] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!isYieldEnabled() || !transactionManager?.supportsYield?.()) {
      setStatus(null);
      return;
    }
    try {
      setStatus(await transactionManager.getYieldStatus());
    } catch {
      // Earning is an extra; it must never be why a balance fails to render.
      setStatus(null);
    }
  }, [transactionManager]);

  useEffect(() => {
    reload();
  }, [reload, activeVaultAddress]);

  /** Coin address (lowercased) -> its earning state, for a quick lookup by card. */
  const byAddress = useMemo(() => {
    const map = {};
    for (const token of status?.tokens || []) {
      if (token.address) map[token.address.toLowerCase()] = token;
    }
    return map;
  }, [status]);

  const earningFor = useCallback(
    (tokenAddress) => {
      if (!status?.supported || !tokenAddress) return null;
      const token = byAddress[tokenAddress.toLowerCase()];
      return token?.canEarn ? token : null;
    },
    [status, byAddress],
  );

  const setMode = useCallback(
    async (tokenAddress, mode) => {
      setSavingToken(tokenAddress);
      setError(null);
      try {
        await transactionManager.setYieldMode(mode, tokenAddress);
        await reload();
        return true;
      } catch (err) {
        setError(err?.message || "Could not change how your savings earn");
        return false;
      } finally {
        setSavingToken(null);
      }
    },
    [transactionManager, reload],
  );

  return { status, earningFor, setMode, savingToken, error, clearError: () => setError(null), reload };
}
