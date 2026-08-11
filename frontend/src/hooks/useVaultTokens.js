import { useState, useEffect } from "react";

/**
 * The coins the selected vault actually accepts.
 *
 * A vault is created holding a specific set of coins and refuses the rest, so
 * offering the whole network's token list means offering choices that revert.
 * Rather than let a deposit fail at the contract, the pickers ask this and show
 * only what will work.
 *
 * Returns `null` while unknown — for a wallet whose savings predate vaults, or
 * before the vault has loaded. Callers should read that as "no restriction to
 * apply yet" and fall back to the network list, rather than showing an empty
 * picker.
 *
 * @returns {Array<{address: string|null, symbol: string, decimals: number,
 *   isNative: boolean}>|null}
 */
export function useVaultTokens(transactionManager, activeVaultAddress) {
  const [tokens, setTokens] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!transactionManager || !activeVaultAddress) {
      setTokens(null);
      return undefined;
    }

    transactionManager
      .getActiveVault()
      .then((vault) => {
        if (cancelled) return;
        setTokens(vault?.tokens?.length ? vault.tokens : null);
      })
      .catch(() => {
        // A vault we cannot read is not a vault that accepts nothing. Leaving
        // this null keeps the full list on offer instead of blocking deposits.
        if (!cancelled) setTokens(null);
      });

    return () => {
      cancelled = true;
    };
  }, [transactionManager, activeVaultAddress]);

  return tokens;
}

/**
 * Narrow a network's token map to what the vault takes, keeping the map shape
 * the pickers already render.
 */
export function filterToVaultTokens(networkTokens, vaultTokens) {
  if (!vaultTokens) return networkTokens;
  const accepted = new Set(
    vaultTokens.map((token) => (token.address || "").toLowerCase()),
  );
  return Object.fromEntries(
    Object.entries(networkTokens || {}).filter(([, token]) =>
      accepted.has((token.address || "").toLowerCase()),
    ),
  );
}

/** Whether the vault takes native coin at all — ETH is not in the token map. */
export function vaultAcceptsNative(vaultTokens) {
  if (!vaultTokens) return true;
  return vaultTokens.some((token) => token.isNative || !token.address);
}
