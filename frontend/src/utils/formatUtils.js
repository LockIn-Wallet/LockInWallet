export function getTokenDecimals(vault) {
  if (vault?.tokenDecimals != null) return vault.tokenDecimals;
  return vault?.isNativeToken ?? vault?.isSolVault ? 9 : 6;
}

export function getTokenSymbol(vault) {
  if (vault?.tokenSymbol) return vault.tokenSymbol;
  return vault?.isNativeToken ?? vault?.isSolVault ? "SOL" : "TOKEN";
}

export function formatTokenAmount(raw, decimals) {
  const num = raw / 10 ** decimals;
  const displayDecimals = decimals <= 6 ? 2 : 4;
  return parseFloat(num.toFixed(displayDecimals)).toString();
}

export function formatLimit(raw, vault) {
  if (!raw) return "N/A";
  if (vault.limitsArePercentage) {
    return `${parseFloat((raw / 100).toFixed(1))}%`;
  }
  return `${formatTokenAmount(raw, getTokenDecimals(vault))} ${getTokenSymbol(vault)}`;
}

export function formatPenalty(bps) {
  if (!bps) return "N/A";
  return `${parseFloat((bps / 100).toFixed(1))}%`;
}
