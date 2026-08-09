/**
 * Which coins the app treats as dollars.
 *
 * This list lives here, not in a contract, and that is deliberate. A contract
 * cannot know what is pegged without either an oracle or a governed list, and
 * both put something in the enforcement path of a wallet whose whole promise is
 * enforcement. What the contract does instead is honest and small: it divides
 * out each coin's decimals so 100 USDT (100e6) and 100 DAI (100e18) both count
 * as $100 against one cap. That arithmetic is exact for anything actually
 * pegged, and meaningless for anything that is not — so the only judgement
 * needed is *which coins are pegged*, and that is a product decision the app
 * makes when it offers the choice.
 *
 * Adding one is a one-line change here plus an entry in networkConfig. A vault
 * already created keeps the coins it was created with; the list only decides
 * what a new one is offered.
 */
export const STABLECOIN_SYMBOLS = ["USDC", "USDT", "DAI"];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * The stablecoins actually usable on a network, in the order above.
 *
 * A coin the config lists without a real address is one that is not deployed
 * there — on a local chain that is most of them — and including it would make
 * a vault that accepts a token nobody can send.
 *
 * @returns {Array<{address: string, symbol: string, decimals: number}>}
 */
export function getStablecoins(networkConfig) {
  const tokens = networkConfig?.tokens || {};
  return STABLECOIN_SYMBOLS.map((symbol) => tokens[symbol])
    .filter((token) => token?.address && token.address !== ZERO_ADDRESS && token.address !== "native")
    .map(({ address, symbol, decimals }) => ({ address, symbol, decimals }));
}

/** Whether a coin belongs in the shared dollar cap rather than a pot of its own. */
export function isStablecoin(symbol) {
  return STABLECOIN_SYMBOLS.includes(symbol);
}
