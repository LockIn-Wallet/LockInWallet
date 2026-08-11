import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

/**
 * AaveV3Strategy against the REAL Aave v3 pool on Optimism, over a fork.
 *
 * The unit tests in YieldModule.ts prove the accounting against a mock pool.
 * They cannot prove the two things that depend on Aave's actual deployment:
 *
 *  1. that `AaveReserveData` still matches the live `getReserveData` struct —
 *     Aave reshaped it after v3.1, so a future upgrade would silently reduce
 *     `aprBps()` to 0 (it is try/catch-guarded) and quote every user 0%;
 *  2. that supply/withdraw actually round-trip through the real pool, whose
 *     aTokens rebase and whose `withdraw` returns the amount it moved.
 *
 * Opt-in, because it needs the network:
 *   npm run test:fork
 *
 * The block is deliberately NOT pinned. A pinned recent block stops working
 * once public RPCs prune it, and pinning an old one needs an archive node;
 * `latest` keeps this runnable by anyone. The cost is that the exact interest
 * figures move between runs, so every assertion below is a bound, not an equality.
 */

const RUN = process.env.FORK_OPTIMISM === "true";
const RPC = process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io";

// Aave v3 on Optimism. aUSDC is asserted against the pool's own answer below
// rather than trusted, since that is half the point of this file.
const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const USDC = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";
const A_USDC = "0x38d693cE1dF5AaDF7bC62595A37D667aD57922e5";

const MODE_STABLE = 2;
const DEPOSIT = 1_000_000_000n; // 1,000 USDC (6 decimals)

const usdc = (raw: bigint) => Number(raw) / 1e6;

describe("AaveV3Strategy against live Aave v3 (Optimism fork)", function () {
  // Forking plus real contract deploys is far slower than the mock suite.
  this.timeout(300_000);

  let strategy: any;
  let yieldModule: any;
  let vaultModule: any;
  let token: any;
  let user: any;
  let vaultId: bigint;

  before(async function () {
    if (!RUN) {
      // Skipped rather than failed: the default suite must stay offline.
      this.skip();
    }

    try {
      await hre.network.provider.request({
        method: "hardhat_reset",
        params: [{ forking: { jsonRpcUrl: RPC } }],
      });
    } catch (error) {
      console.error(`\n  Could not fork ${RPC}: ${(error as Error).message}`);
      this.skip();
    }

    const [owner, testUser] = await hre.ethers.getSigners();
    user = testUser;

    // ---- The system under test, pointed at the real pool ----
    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);

    const VaultSystemModule = await hre.ethers.getContractFactory("VaultSystemModule");
    vaultModule = await hre.upgrades.deployProxy(VaultSystemModule, [savingsCore.target]);
    await savingsCore.registerModule(
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("VAULT_SYSTEM")),
      vaultModule.target,
    );

    const YieldModule = await hre.ethers.getContractFactory("YieldModule");
    yieldModule = await hre.upgrades.deployProxy(YieldModule, [savingsCore.target]);
    await savingsCore.registerModule(
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("YIELD_SYSTEM")),
      yieldModule.target,
    );

    const AaveV3Strategy = await hre.ethers.getContractFactory("AaveV3Strategy");
    strategy = await AaveV3Strategy.deploy(USDC, AAVE_POOL, A_USDC, yieldModule.target);

    await yieldModule.setVaultModule(vaultModule.target);
    await vaultModule.setTreasury(owner.address);
    await yieldModule.setStrategy(USDC, MODE_STABLE, strategy.target);
    await yieldModule.setYieldWatermark();
    await vaultModule.setYieldModule(yieldModule.target);

    // ---- Fund the user with real USDC ----
    // The aToken contract custodies the reserve's underlying, so it is a
    // guaranteed-liquid source that does not depend on some whale's balance
    // still being there months from now.
    // Fully qualified: several IERC20 artifacts exist across the OZ packages.
    token = await hre.ethers.getContractAt(
      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
      USDC,
    );
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [A_USDC],
    });
    await hre.network.provider.request({
      method: "hardhat_setBalance",
      params: [A_USDC, "0xde0b6b3a7640000"], // 1 ETH for gas
    });
    const reserve = await hre.ethers.getSigner(A_USDC);
    await token.connect(reserve).transfer(user.address, DEPOSIT);
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [A_USDC],
    });

    expect(await token.balanceOf(user.address)).to.equal(DEPOSIT);

    // ---- A real USDC vault, with earning on by default ----
    await vaultModule.connect(user).createVault({
      name: "Fork Savings",
      description: "live Aave",
      vaultType: 0,
      token: USDC,
      dailyLimit: DEPOSIT * 10n,
      weeklyLimit: DEPOSIT * 10n,
      monthlyLimit: DEPOSIT * 10n,
      limitsArePercentage: false,
      penaltyRateBps: 2000,
    });
    vaultId = await vaultModule.getVaultCount();
  });

  after(async function () {
    // Drop the fork so later test files run offline against a clean chain.
    if (RUN) {
      await hre.network.provider.request({ method: "hardhat_reset", params: [] });
    }
  });

  it("agrees with the pool about which aToken backs USDC", async function () {
    // If Aave reshapes ReserveData, this is the field that silently moves.
    const pool = await hre.ethers.getContractAt("IAavePool", AAVE_POOL);
    const data = await pool.getReserveData(USDC);
    expect(data.aTokenAddress).to.equal(A_USDC);
  });

  it("reads a live supply rate, proving the reserve struct still decodes", async function () {
    const aprBps = await strategy.aprBps();
    console.log(`      live Aave USDC supply rate: ${Number(aprBps) / 100}% APR`);

    // The real assertion: a non-zero rate can only come from correctly decoding
    // currentLiquidityRate out of the live struct. Zero means either the reserve
    // struct changed shape or the call reverted — both are the failure this test
    // exists to catch, and both would quote users 0%.
    expect(aprBps).to.be.gt(0n);
    // Sanity bound: a stablecoin supply rate above 50% means we decoded the
    // wrong field rather than found a bargain.
    expect(aprBps).to.be.lt(5000n);
  });

  it("supplies a real deposit into the pool", async function () {
    await token.connect(user).approve(vaultModule.target, DEPOSIT);
    await vaultModule.connect(user).deposit(vaultId, DEPOSIT);

    expect(await yieldModule.investedPrincipal(vaultId)).to.equal(DEPOSIT);
    // Aave reports scaledBalance * index rounded down, so the position is worth
    // up to a couple of units less than was supplied. Anything more than that
    // would mean value genuinely went missing.
    expect(await strategy.totalAssets()).to.be.gte(DEPOSIT - 2n);
    expect(await strategy.totalAssets()).to.be.lte(DEPOSIT);
    // Nothing is left sitting idle in the vault module.
    expect(await token.balanceOf(vaultModule.target)).to.equal(0n);
    // And the pool can give it back.
    expect(await strategy.maxWithdrawable()).to.be.gte(DEPOSIT - 2n);
  });

  it("accrues real interest, and takes one percentage point of it", async function () {
    // aToken.balanceOf extrapolates from the liquidity index by timestamp, so
    // time travel alone accrues genuine interest — no mock top-up.
    await time.increase(365 * 24 * 60 * 60);
    await yieldModule.accrue(vaultId);

    const y = await yieldModule.getVaultYield(vaultId);
    const gross = y.lifetimeYield + y.lifetimeFees;
    console.log(
      `      after 1 year: gross ${usdc(gross)} USDC, ` +
        `fee ${usdc(y.lifetimeFees)}, to user ${usdc(y.lifetimeYield)}`,
    );

    expect(gross).to.be.gt(0n);

    // One percentage point of the rate on this principal, for one year. Not an
    // equality: the accrual window is a year plus the few seconds of block time
    // the setup transactions took.
    const expectedFee = (DEPOSIT * 100n) / 10_000n;
    expect(y.lifetimeFees).to.be.gte(expectedFee);
    expect(y.lifetimeFees).to.be.lt((expectedFee * 1001n) / 1000n);
    // Never more than what was actually earned — the whole fee promise.
    expect(y.lifetimeFees).to.be.lte(gross);
    // Principal is untouched by the fee.
    expect(y.principal).to.equal(DEPOSIT);

    // Position identity: value + deficit == principal + owedYield + accruedFees,
    // allowing the dust that downward rounding leaves in the pool.
    const value = await yieldModule.investedValue(vaultId);
    const accounted = y.principal + y.owedYield + y.accruedFees;
    expect(value + y.deficit).to.be.gte(accounted - 2n);
    expect(value + y.deficit).to.be.lte(accounted + 2n);
  });

  it("returns principal plus the user's share of the interest", async function () {
    const before = await token.balanceOf(user.address);
    const member = await vaultModule.getVaultMember(vaultId, user.address);
    const pending = await yieldModule.pendingYield(vaultId, user.address);
    const claimable = member.balance + pending;

    await vaultModule.connect(user).withdraw(vaultId, claimable);

    const received = (await token.balanceOf(user.address)) - before;
    console.log(`      withdrew ${usdc(received)} USDC on a ${usdc(DEPOSIT)} deposit`);

    // Exactly what was asked for, to the unit.
    expect(received).to.equal(claimable);
    // More than was deposited: the interest is really there and really paid out.
    expect(received).to.be.gt(DEPOSIT);

    // Not asserted as exactly zero. Against a live pool interest accrues every
    // second, so the block that settles the withdrawal credits a little more
    // than the `pendingYield` read a block earlier — "withdraw everything" can
    // only land on zero if the amount is computed inside the same transaction.
    // What matters is that nothing of substance is stranded.
    const remaining = (await vaultModule.getVaultMember(vaultId, user.address)).balance;
    expect(remaining).to.be.lt(100n); // under 0.0001 USDC

    // The position is not empty even so: the treasury's accrued fee stays
    // invested until it is realized.
    const y = await yieldModule.getVaultYield(vaultId);
    expect(y.principal).to.be.lt(100n);
    expect(y.accruedFees).to.be.gt(0n);
    expect(y.shares).to.be.gt(0n);
  });

  it("sends the collected fee to the treasury", async function () {
    await yieldModule.realizeFees(vaultId);
    const pendingFees = await yieldModule.pendingFees(USDC);

    const treasury = await vaultModule.treasury();
    const before = await token.balanceOf(treasury);
    await yieldModule.sweepFees(USDC);

    expect((await token.balanceOf(treasury)) - before).to.equal(pendingFees);
  });
});
