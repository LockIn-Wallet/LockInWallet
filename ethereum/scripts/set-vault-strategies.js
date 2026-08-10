const hre = require("hardhat");
const { ethers } = hre;

/**
 * Give each stablecoin a real Aave v3 strategy on a live network.
 *
 * Separate from `deploy-modular` on purpose: that script only ever wires mock
 * markets, because pointing user funds at a real protocol is a decision, not a
 * side effect of deploying.
 *
 * Nothing here is trusted from memory. The only constant below is Aave's own
 * PoolAddressesProvider; the pool comes from that, the aToken comes from the
 * pool, and the aToken is then asked which asset it represents. A coin whose
 * aToken does not name the coin we asked about is skipped rather than wired up
 * — that mismatch is the one mistake that would silently account a vault's
 * balance against the wrong position.
 *
 * Idempotent: a coin that already has a strategy is left alone, since replacing
 * a live one is a timelocked operation and not this script's job.
 */
const PROVIDERS = {
  optimism: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb",
  base: "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D",
};

const PROVIDER_ABI = ["function getPool() view returns (address)"];
const POOL_ABI = [
  "function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))",
];
const ATOKEN_ABI = [
  "function UNDERLYING_ASSET_ADDRESS() view returns (address)",
  "function symbol() view returns (string)",
];

const STABLECOINS = ["USDC", "USDT", "DAI"];
const moduleId = (name) => ethers.keccak256(ethers.toUtf8Bytes(name));

async function main() {
  const network = hre.network.name;
  const providerAddress = PROVIDERS[network];
  if (!providerAddress) throw new Error(`No Aave v3 provider known for ${network}`);

  const config = require("../../frontend/src/networkConfig.json").evm[network];
  if (!config?.savingsContract) throw new Error(`No savingsContract for ${network}`);

  const core = await ethers.getContractAt("SavingsCore", config.savingsContract);
  const yieldAddress = await core.getModule(moduleId("VAULT_YIELD"));
  if (yieldAddress === ethers.ZeroAddress) {
    throw new Error("VAULT_YIELD is not registered — deploy the modules first");
  }
  const yieldModule = await ethers.getContractAt("VaultYieldModule", yieldAddress);

  const provider = new ethers.Contract(providerAddress, PROVIDER_ABI, ethers.provider);
  const poolAddress = await provider.getPool();
  const pool = new ethers.Contract(poolAddress, POOL_ABI, ethers.provider);
  console.log(`${network}: Aave pool ${poolAddress}`);

  const Strategy = await ethers.getContractFactory("AaveV3Strategy");

  for (const symbol of STABLECOINS) {
    const asset = config.tokens?.[symbol]?.address;
    if (!asset || asset === ethers.ZeroAddress) {
      console.log(`  ${symbol.padEnd(5)} no address on this network, skipped`);
      continue;
    }

    const existing = await yieldModule.getStrategy(asset);
    if (existing !== ethers.ZeroAddress) {
      console.log(`  ${symbol.padEnd(5)} already earns via ${existing}`);
      continue;
    }

    let aToken;
    try {
      aToken = (await pool.getReserveData(asset)).aTokenAddress;
    } catch {
      aToken = ethers.ZeroAddress;
    }
    if (aToken === ethers.ZeroAddress) {
      // Not a failure: a coin with no market is simply held and does not earn,
      // and its switch never appears.
      console.log(`  ${symbol.padEnd(5)} no Aave reserve here — will be held, not earned`);
      continue;
    }

    const token = new ethers.Contract(aToken, ATOKEN_ABI, ethers.provider);
    const underlying = await token.UNDERLYING_ASSET_ADDRESS();
    if (underlying.toLowerCase() !== asset.toLowerCase()) {
      console.log(`  ${symbol.padEnd(5)} ⚠️  aToken ${aToken} names ${underlying}, not ${asset} — SKIPPED`);
      continue;
    }

    const strategy = await Strategy.deploy(asset, poolAddress, aToken, yieldAddress);
    await strategy.waitForDeployment();
    const strategyAddress = await strategy.getAddress();
    await (await yieldModule.setStrategy(asset, strategyAddress)).wait();

    const apr = Number(await yieldModule.currentAprBps(asset)) / 100;
    console.log(
      `  ${symbol.padEnd(5)} ✅ ${strategyAddress} via ${await token.symbol()} — ${apr.toFixed(2)}% supply rate`,
    );
  }

  const vaultsAddress = await core.getModule(moduleId("SAVINGS_VAULTS"));
  const vaults = await ethers.getContractAt("SavingsVaultModule", vaultsAddress);
  console.log(`\nfees and penalties go to: ${await vaults.treasury()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
