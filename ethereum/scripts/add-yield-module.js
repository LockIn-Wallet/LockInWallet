const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Adds the YieldModule and an Aave v3 strategy to an EXISTING deployment.
 *
 * Safe for live networks: purely additive. The steps are ordered so every
 * behaviour-changing call comes last — nothing about any user's funds changes
 * until `vaultModule.setYieldModule(...)`, and no vault earns by default until
 * `setYieldWatermark()`. Both are printed clearly before they run.
 *
 * The watermark is what keeps consent honest: only vaults created from that
 * point on default to earning, so a balance already in custody is never routed
 * into Aave without the owner making a fresh deposit or opting in explicitly.
 *
 * IMPORTANT: VaultSystemModule must already be upgraded to a build that has
 * `setYieldModule`. Do that first, in place:
 *   MODULE=VaultSystemModule npx hardhat run scripts/upgrade-module-proxy.js --network optimism
 *
 * Usage: npx hardhat run scripts/add-yield-module.js --network optimism
 * Requires PRIVATE_KEY of the SavingsCore owner in ethereum/.env.
 */

// Aave v3 deployment addresses, kept here rather than in Solidity so the same
// strategy contract works on any network. Source: Aave address book.
const AAVE_V3 = {
  optimism: {
    pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    reserves: {
      USDC: {
        token: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        aToken: "0x38d693cE1dF5AaDF7bC62595A37D667aD57922e5",
      },
    },
  },
};

const MODE_STABLE = 2;
const STRATEGY_CHANGE_DELAY = 7 * 24 * 60 * 60;
const MANAGEMENT_FEE_BPS = 100; // one percentage point of the rate

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name === "hardhat" ? "localhost" : hre.network.name;

  const networkConfigPath = path.join(__dirname, "../../frontend/src/networkConfig.json");
  const networkConfig = JSON.parse(fs.readFileSync(networkConfigPath, "utf8"));
  const coreAddress = networkConfig.evm?.[network]?.savingsContract;
  if (!coreAddress || coreAddress === ethers.ZeroAddress) {
    throw new Error(`No SavingsCore address configured for network: ${network}`);
  }

  const aave = AAVE_V3[network];
  if (!aave) {
    throw new Error(
      `No Aave v3 addresses recorded for network: ${network}. Add them to AAVE_V3 in this script.`,
    );
  }

  console.log(`Network:      ${network}`);
  console.log(`SavingsCore:  ${coreAddress}`);
  console.log(`Deployer:     ${deployer.address}`);
  console.log(
    `Balance:      ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`,
  );

  const savingsCore = await ethers.getContractAt("SavingsCore", coreAddress);
  const owner = await savingsCore.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer is not the SavingsCore owner (owner: ${owner})`);
  }

  const vaultSystemId = ethers.keccak256(ethers.toUtf8Bytes("VAULT_SYSTEM"));
  const vaultModuleAddress = await savingsCore.getModule(vaultSystemId);
  if (vaultModuleAddress === ethers.ZeroAddress) {
    throw new Error("VaultSystemModule is not registered — run add-vault-module.js first");
  }
  const vaultModule = await ethers.getContractAt("VaultSystemModule", vaultModuleAddress);

  // Fail early and loudly rather than half-way through: an un-upgraded vault
  // module has no setYieldModule, and the yield module would sit inert.
  if (typeof vaultModule.setYieldModule !== "function") {
    throw new Error("Deployed VaultSystemModule has no setYieldModule — upgrade it in place first");
  }

  // ---- 1. Deploy and register the YieldModule ----
  const yieldSystemId = ethers.keccak256(ethers.toUtf8Bytes("YIELD_SYSTEM"));
  const existing = await savingsCore.getModule(yieldSystemId);
  const YieldModule = await ethers.getContractFactory("YieldModule");

  let yieldModuleAddress;
  if (existing !== ethers.ZeroAddress) {
    console.log(`YieldModule already registered at ${existing} — upgrading in place...`);
    const upgraded = await upgrades.upgradeProxy(existing, YieldModule);
    await upgraded.waitForDeployment();
    yieldModuleAddress = existing;
    console.log("✅ Implementation upgraded; proxy address and accounting preserved");
  } else {
    console.log("Deploying YieldModule proxy...");
    const proxy = await upgrades.deployProxy(YieldModule, [coreAddress], { initializer: "initialize" });
    await proxy.waitForDeployment();
    yieldModuleAddress = await proxy.getAddress();
    console.log(`✅ YieldModule proxy deployed to: ${yieldModuleAddress}`);

    console.log("Registering module on SavingsCore...");
    let tx = await savingsCore.registerModule(yieldSystemId, yieldModuleAddress);
    await tx.wait();
    console.log("✅ Module registered");
  }

  const registered = await savingsCore.getModule(yieldSystemId);
  if (registered !== yieldModuleAddress) {
    throw new Error(`Registration verification failed: ${registered} !== ${yieldModuleAddress}`);
  }

  const yieldModule = await ethers.getContractAt("YieldModule", yieldModuleAddress);

  // ---- 2. Configure the accountant (still inert: nothing is wired to it) ----
  console.log("\nConfiguring the yield module...");
  let tx = await yieldModule.setVaultModule(vaultModuleAddress);
  await tx.wait();
  console.log(`   Vault module:        ${vaultModuleAddress}`);

  tx = await yieldModule.setManagementFeeBps(MANAGEMENT_FEE_BPS);
  await tx.wait();
  console.log(`   Management fee:      ${MANAGEMENT_FEE_BPS} bps of the rate (one percentage point)`);

  tx = await yieldModule.setStrategyChangeDelay(STRATEGY_CHANGE_DELAY);
  await tx.wait();
  console.log(`   Strategy change delay: ${STRATEGY_CHANGE_DELAY / 86400} days`);

  // ---- 3. Deploy the Aave strategy per reserve ----
  const AaveV3Strategy = await ethers.getContractFactory("AaveV3Strategy");
  const deployed = {};
  for (const [symbol, reserve] of Object.entries(aave.reserves)) {
    console.log(`\nDeploying AaveV3Strategy for ${symbol}...`);
    const strategy = await AaveV3Strategy.deploy(
      reserve.token,
      aave.pool,
      reserve.aToken,
      yieldModuleAddress,
    );
    await strategy.waitForDeployment();
    const strategyAddress = await strategy.getAddress();
    deployed[symbol] = strategyAddress;
    console.log(`✅ ${symbol} strategy: ${strategyAddress}`);
    console.log(`   Reported rate: ${Number(await strategy.aprBps()) / 100}% a year`);

    tx = await yieldModule.setStrategy(reserve.token, MODE_STABLE, strategyAddress);
    await tx.wait();
    console.log(`   ✅ Registered as the stable-earning strategy for ${symbol}`);
  }

  // ---- 4. The only two calls that change behaviour ----
  console.log("\n⚠️  Everything above was inert. The next call makes vault deposits start earning.");
  tx = await vaultModule.setYieldModule(yieldModuleAddress);
  await tx.wait();
  console.log("✅ Vault module now routes idle balances through the yield module");

  console.log("\n⚠️  The next call turns earning on by default for NEW vaults only.");
  const vaultCountBefore = await vaultModule.getVaultCount();
  tx = await yieldModule.setYieldWatermark();
  await tx.wait();
  const watermark = await yieldModule.yieldEnabledFromVaultId();
  console.log(`✅ Watermark set to vault #${watermark}`);

  console.log(`\nSummary`);
  console.log(`  YieldModule:        ${yieldModuleAddress}`);
  console.log(`  Vault module:       ${vaultModuleAddress}`);
  console.log(`  Treasury:           ${await vaultModule.treasury()}`);
  console.log(`  Management fee:     ${await yieldModule.managementFeeBps()} bps of the rate`);
  console.log(`  Strategies:         ${JSON.stringify(deployed, null, 2)}`);
  console.log(
    `\nVaults 1-${vaultCountBefore} keep earning switched off until their owner opts in.`,
  );
  console.log(`Vaults from #${watermark} on default to stable earning.`);
  console.log(`No existing balance moves until its owner makes a deposit or opts in.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
