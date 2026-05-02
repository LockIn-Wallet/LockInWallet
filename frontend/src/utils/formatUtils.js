export function getTokenDecimals(vault) {
  return vault.isSolVault ? 9 : 6;
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
  const decimals = getTokenDecimals(vault);
  const symbol = vault.isSolVault ? "SOL" : "USD";
  return `${formatTokenAmount(raw, decimals)} ${symbol}`;
}

export function formatPenalty(bps) {
  if (!bps) return "N/A";
  return `${parseFloat((bps / 100).toFixed(1))}%`;
}
