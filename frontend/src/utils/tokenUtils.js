const EVM_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const SOLANA_DEFAULT_PUBKEY = "11111111111111111111111111111111";

export const STABLECOIN_SYMBOLS = ["USDT", "USDC", "DAI", "BUSD", "TUSD"];

export function isStablecoin(symbol) {
  return STABLECOIN_SYMBOLS.includes(symbol);
}

export function isNativeTokenAddress(tokenAddress) {
  return (
    !tokenAddress ||
    tokenAddress === "native" ||
    tokenAddress === EVM_ZERO_ADDRESS ||
    tokenAddress === SOLANA_DEFAULT_PUBKEY
  );
}

/**
 * Resolve display metadata for a token on the current network.
 * Works for both chains: EVM networks describe their native coin via
 * `nativeCurrency`, Solana networks list SOL in `tokens` with address "native".
 */
export function getTokenMeta(networkConfig, tokenAddress) {
  const tokens = networkConfig?.tokens || {};

  if (isNativeTokenAddress(tokenAddress)) {
    if (networkConfig?.nativeCurrency) {
      return {
        symbol: networkConfig.nativeCurrency.symbol,
        decimals: networkConfig.nativeCurrency.decimals,
        isNative: true,
      };
    }
    const nativeToken = Object.values(tokens).find((t) => t.address === "native");
    return {
      symbol: nativeToken?.symbol || "SOL",
      decimals: nativeToken?.decimals ?? 9,
      isNative: true,
    };
  }

  const match = Object.values(tokens).find((t) => t.address === tokenAddress);
  return {
    symbol: match?.symbol || "TOKEN",
    decimals: match?.decimals ?? 6,
    isNative: false,
  };
}
