import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const VAULT_TYPE_PERSONAL = 0;
const VAULT_TYPE_COMMUNITY = 1;

const MODE_OFF = 1;
const MODE_STABLE = 2;

const DAY = 24 * 60 * 60;
const YEAR = 365 * DAY;

const usdt6 = (amount: string) => hre.ethers.parseUnits(amount, 6);

/** Aave expresses annual rates in rays; 5% is 0.05e27. */
const rateRay = (percent: number) => (BigInt(percent * 100) * 10n ** 27n) / 10000n;

describe("YieldModule", function () {
  async function deployBase() {
    const [owner, user1, user2, treasury] = await hre.ethers.getSigners();

    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);
    await savingsCore.waitForDeployment();

    const VaultSystemModule = await hre.ethers.getContractFactory("VaultSystemModule");
    const vaultModule = await hre.upgrades.deployProxy(VaultSystemModule, [savingsCore.target]);
    await vaultModule.waitForDeployment();
    await savingsCore.registerModule(
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("VAULT_SYSTEM")),
      vaultModule.target,
    );

    const YieldModule = await hre.ethers.getContractFactory("YieldModule");
    const yieldModule = await hre.upgrades.deployProxy(YieldModule, [savingsCore.target]);
    await yieldModule.waitForDeployment();
    await savingsCore.registerModule(
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("YIELD_SYSTEM")),
      yieldModule.target,
    );

    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    await usdt.waitForDeployment();
    for (const user of [user1, user2]) {
      await usdt.transfer(user.address, usdt6("100000"));
    }

    const MockAavePool = await hre.ethers.getContractFactory("MockAavePool");
    const pool = await MockAavePool.deploy();
    await pool.waitForDeployment();

    const MockAToken = await hre.ethers.getContractFactory("MockAToken");
    const aToken = await MockAToken.deploy("Aave USDT", "aUSDT", usdt.target, pool.target, 6);
    await aToken.waitForDeployment();
    await pool.registerReserve(usdt.target, aToken.target);
    await pool.setLiquidityRate(usdt.target, rateRay(5));

    await yieldModule.setVaultModule(vaultModule.target);
    await vaultModule.setTreasury(treasury.address);

    return { savingsCore, vaultModule, yieldModule, usdt, pool, aToken, owner, user1, user2, treasury };
  }

  async function deployYieldFixture() {
    const base = await deployBase();
    const AaveV3Strategy = await hre.ethers.getContractFactory("AaveV3Strategy");
    const strategy = await AaveV3Strategy.deploy(
      base.usdt.target,
      base.pool.target,
      base.aToken.target,
      base.yieldModule.target,
    );
    await strategy.waitForDeployment();

    await base.yieldModule.setStrategy(base.usdt.target, MODE_STABLE, strategy.target);
    await base.yieldModule.setYieldWatermark();
    await base.vaultModule.setYieldModule(base.yieldModule.target);

    return { ...base, strategy };
  }

  /** Same wiring, but the position is held by the hostile strategy. */
  async function deployReentrantFixture() {
    const base = await deployBase();
    const MockReentrantStrategy = await hre.ethers.getContractFactory("MockReentrantStrategy");
    const strategy = await MockReentrantStrategy.deploy(
      base.usdt.target,
      base.yieldModule.target,
      base.vaultModule.target,
    );
    await strategy.waitForDeployment();

    await base.yieldModule.setStrategy(base.usdt.target, MODE_STABLE, strategy.target);
    await base.yieldModule.setYieldWatermark();
    await base.vaultModule.setYieldModule(base.yieldModule.target);

    return { ...base, strategy };
  }

  function usdtVaultParams(overrides: Record<string, unknown> = {}) {
    return {
      name: "Stable Savings",
      description: "Earning vault",
      vaultType: VAULT_TYPE_PERSONAL,
      token: hre.ethers.ZeroAddress,
      dailyLimit: usdt6("100000"),
      weeklyLimit: usdt6("100000"),
      monthlyLimit: usdt6("100000"),
      limitsArePercentage: false,
      penaltyRateBps: 2000,
      ...overrides,
    };
  }

  /** Create a USDT vault and deposit, mirroring the real user flow. */
  async function createAndDeposit(
    ctx: Awaited<ReturnType<typeof deployYieldFixture>>,
    signer: any,
    amount: bigint,
    overrides: Record<string, unknown> = {},
  ) {
    await ctx.vaultModule
      .connect(signer)
      .createVault(usdtVaultParams({ token: ctx.usdt.target, ...overrides }));
    const vaultId = await ctx.vaultModule.getVaultCount();
    await ctx.usdt.connect(signer).approve(ctx.vaultModule.target, amount);
    await ctx.vaultModule.connect(signer).deposit(vaultId, amount);
    return vaultId;
  }

  /** Credit real interest into the strategy's position, funded by the owner. */
  async function earn(ctx: Awaited<ReturnType<typeof deployYieldFixture>>, amount: bigint) {
    await ctx.usdt.approve(ctx.pool.target, amount);
    await ctx.pool.simulateYield(ctx.usdt.target, ctx.strategy.target, amount);
  }

  /**
   * The custody invariant, in its post-yield form: what the module holds plus
   * what is invested must cover every recorded obligation.
   */
  async function expectSolvent(
    ctx: Awaited<ReturnType<typeof deployYieldFixture>>,
    vaultIds: bigint[],
  ) {
    const idle = await ctx.usdt.balanceOf(ctx.vaultModule.target);
    let invested = 0n;
    let obligations = 0n;
    for (const vaultId of vaultIds) {
      invested += await ctx.yieldModule.investedValue(vaultId);
      const vault = await ctx.vaultModule.getVault(vaultId);
      obligations += vault.totalBalance;
      for (const member of await ctx.vaultModule.getVaultMembers(vaultId)) {
        obligations += (await ctx.vaultModule.getVaultMember(vaultId, member)).unclaimedPenalties;
      }
    }
    expect(idle + invested).to.be.gte(obligations);
  }

  /** vault.totalBalance == sum(member.balance), which yield must not disturb. */
  async function expectLedgerIdentity(ctx: any, vaultId: bigint) {
    const vault = await ctx.vaultModule.getVault(vaultId);
    let sum = 0n;
    for (const member of await ctx.vaultModule.getVaultMembers(vaultId)) {
      sum += (await ctx.vaultModule.getVaultMember(vaultId, member)).balance;
    }
    expect(sum).to.equal(vault.totalBalance);
  }

  /**
   * strategy.convertToAssets(shares) + deficit
   *   == principal + owedYield + accruedFees
   * Holds while the position is live; dust from downward rounding is allowed in
   * the pool's favour only.
   */
  async function expectPositionIdentity(ctx: any, vaultId: bigint) {
    const y = await ctx.yieldModule.getVaultYield(vaultId);
    if (y.shares === 0n) return;
    const value = await ctx.yieldModule.investedValue(vaultId);
    const accounted = y.principal + y.owedYield + y.accruedFees;
    expect(value + y.deficit).to.be.gte(accounted - 2n);
    expect(value + y.deficit).to.be.lte(accounted + 2n);
  }

  describe("Investing deposits", function () {
    it("routes a stablecoin deposit into the strategy and records the principal", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));

      expect(await ctx.yieldModule.investedPrincipal(vaultId)).to.equal(usdt6("1000"));
      expect(await ctx.strategy.totalAssets()).to.equal(usdt6("1000"));
      // The vault module keeps no idle tokens once the balance is invested.
      expect(await ctx.usdt.balanceOf(ctx.vaultModule.target)).to.equal(0);
      expect((await ctx.vaultModule.getVault(vaultId)).totalBalance).to.equal(usdt6("1000"));

      await expectSolvent(ctx, [vaultId]);
      await expectPositionIdentity(ctx, vaultId);
      await expectLedgerIdentity(ctx, vaultId);
    });

    it("leaves an ETH vault and an unsupported token completely untouched", async function () {
      const ctx = await loadFixture(deployYieldFixture);

      await ctx.vaultModule.connect(ctx.user1).createVault(
        usdtVaultParams({
          token: hre.ethers.ZeroAddress,
          dailyLimit: hre.ethers.parseEther("10"),
          weeklyLimit: hre.ethers.parseEther("10"),
          monthlyLimit: hre.ethers.parseEther("10"),
        }),
      );
      await ctx.vaultModule
        .connect(ctx.user1)
        .deposit(1, hre.ethers.parseEther("1"), { value: hre.ethers.parseEther("1") });

      expect(await ctx.yieldModule.investedPrincipal(1)).to.equal(0);
      expect(await hre.ethers.provider.getBalance(ctx.vaultModule.target)).to.equal(
        hre.ethers.parseEther("1"),
      );

      // A token with no configured strategy behaves the same way.
      const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
      const other = await MockUSDT.deploy();
      await other.transfer(ctx.user1.address, usdt6("100"));
      await ctx.vaultModule.connect(ctx.user1).createVault(usdtVaultParams({ token: other.target }));
      await other.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("100"));
      await ctx.vaultModule.connect(ctx.user1).deposit(2, usdt6("100"));

      expect(await ctx.yieldModule.investedPrincipal(2)).to.equal(0);
      expect(await other.balanceOf(ctx.vaultModule.target)).to.equal(usdt6("100"));
    });

    it("still credits the deposit when the protocol refuses it", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      await ctx.pool.setSupplyPaused(true);

      await ctx.vaultModule.connect(ctx.user1).createVault(usdtVaultParams({ token: ctx.usdt.target }));
      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));
      await expect(ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000")))
        .to.emit(ctx.yieldModule, "StrategyDepositSkipped");

      // The user's money is safe and idle; only the investment was skipped.
      expect((await ctx.vaultModule.getVaultMember(1, ctx.user1.address)).balance).to.equal(usdt6("1000"));
      expect(await ctx.usdt.balanceOf(ctx.vaultModule.target)).to.equal(usdt6("1000"));
      expect(await ctx.yieldModule.investedPrincipal(1)).to.equal(0);
      await expectSolvent(ctx, [1n]);
    });

    it("accepts a deposit that Aave credits one unit short", async function () {
      // Real Aave mints scaledBalance * index rounded down, so supplying N units
      // leaves a position worth N-1. A strict receipt check rejected every live
      // deposit; only a fork test caught it, so this pins the behaviour offline.
      const ctx = await loadFixture(deployYieldFixture);
      await ctx.pool.setSupplyShortfall(1);

      await ctx.vaultModule.connect(ctx.user1).createVault(usdtVaultParams({ token: ctx.usdt.target }));
      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));
      await expect(ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000")))
        .to.not.emit(ctx.yieldModule, "StrategyDepositSkipped");

      // The member is credited in full and the money really is invested.
      expect((await ctx.vaultModule.getVaultMember(1, ctx.user1.address)).balance).to.equal(usdt6("1000"));
      expect(await ctx.yieldModule.investedPrincipal(1)).to.equal(usdt6("1000"));
      expect(await ctx.strategy.totalAssets()).to.equal(usdt6("1000") - 1n);

      // The one unit the pool kept shows up as a deficit — recorded honestly,
      // never taken out of the member's balance.
      await ctx.yieldModule.accrue(1);
      let y = await ctx.yieldModule.getVaultYield(1);
      expect(y.deficit).to.equal(1n);
      expect(y.principal).to.equal(usdt6("1000"));
      expect((await ctx.vaultModule.getVaultMember(1, ctx.user1.address)).balance).to.equal(usdt6("1000"));

      // The first real interest repays it, before any fee or member yield.
      await earn(ctx, usdt6("10"));
      await ctx.yieldModule.accrue(1);
      y = await ctx.yieldModule.getVaultYield(1);
      expect(y.deficit).to.equal(0n);

      // And a full exit still pays out everything the member is owed.
      const before = await ctx.usdt.balanceOf(ctx.user1.address);
      const member = await ctx.vaultModule.getVaultMember(1, ctx.user1.address);
      const pending = await ctx.yieldModule.pendingYield(1, ctx.user1.address);
      await ctx.vaultModule.connect(ctx.user1).withdraw(1, member.balance + pending);
      expect((await ctx.usdt.balanceOf(ctx.user1.address)) - before).to.equal(member.balance + pending);
    });

    it("refuses a deposit that loses real value, rather than absorbing it", async function () {
      // The rounding tolerance must not become a hole a fee-on-transfer token
      // fits through. A whole unit of USDT is 500,000x the two-unit slack.
      const ctx = await loadFixture(deployYieldFixture);
      await ctx.pool.setSupplyShortfall(usdt6("1"));

      await ctx.vaultModule.connect(ctx.user1).createVault(usdtVaultParams({ token: ctx.usdt.target }));
      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));

      // Skipped, not accepted — and the user's deposit still succeeds.
      await expect(ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000")))
        .to.emit(ctx.yieldModule, "StrategyDepositSkipped");

      expect((await ctx.vaultModule.getVaultMember(1, ctx.user1.address)).balance).to.equal(usdt6("1000"));
      expect(await ctx.yieldModule.investedPrincipal(1)).to.equal(0);
      // The money stayed here rather than being handed to a lossy protocol.
      expect(await ctx.usdt.balanceOf(ctx.vaultModule.target)).to.equal(usdt6("1000"));
      await expectSolvent(ctx, [1n]);
    });

    it("invests a balance that predates opting in on the next deposit", async function () {
      const ctx = await loadFixture(deployBase);
      // No yield module attached yet — this is the pre-upgrade world.
      await ctx.vaultModule.connect(ctx.user1).createVault(usdtVaultParams({ token: ctx.usdt.target }));
      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000"));
      expect(await ctx.usdt.balanceOf(ctx.vaultModule.target)).to.equal(usdt6("1000"));

      // Now the upgrade lands.
      const AaveV3Strategy = await hre.ethers.getContractFactory("AaveV3Strategy");
      const strategy = await AaveV3Strategy.deploy(
        ctx.usdt.target,
        ctx.pool.target,
        ctx.aToken.target,
        ctx.yieldModule.target,
      );
      await ctx.yieldModule.setStrategy(ctx.usdt.target, MODE_STABLE, strategy.target);
      await ctx.vaultModule.setYieldModule(ctx.yieldModule.target);

      // The existing vault is below the watermark, so it stays off entirely.
      await ctx.yieldModule.setYieldWatermark();
      expect(await ctx.yieldModule.effectiveMode(1)).to.equal(MODE_OFF);
      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("500"));
      await ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("500"));
      expect(await ctx.yieldModule.investedPrincipal(1)).to.equal(0);

      // Opting in and depositing again sweeps the whole balance in.
      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(1, MODE_STABLE);
      expect(await ctx.yieldModule.investedPrincipal(1)).to.equal(usdt6("1500"));
    });
  });

  describe("Fee math", function () {
    it("takes exactly one percentage point of the rate, leaving the user 4% of a 5% year", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));

      await time.increase(YEAR);
      await earn(ctx, usdt6("50")); // a 5% year
      await ctx.yieldModule.accrue(vaultId);

      const y = await ctx.yieldModule.getVaultYield(vaultId);
      // 1% of 1000 for one year.
      expect(y.lifetimeFees).to.equal(usdt6("10"));
      expect(y.lifetimeYield).to.equal(usdt6("40"));
      expect(y.feeDebt).to.equal(0);
      expect(await ctx.yieldModule.pendingYield(vaultId, ctx.user1.address)).to.equal(usdt6("40"));
      await expectPositionIdentity(ctx, vaultId);
    });

    it("charges nothing in a flat period and never touches principal", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));

      await time.increase(YEAR);
      await ctx.yieldModule.accrue(vaultId); // no yield at all this year

      let y = await ctx.yieldModule.getVaultYield(vaultId);
      expect(y.lifetimeFees).to.equal(0);
      expect(y.accruedFees).to.equal(0);
      expect(y.principal).to.equal(usdt6("1000")); // untouched
      expect(y.feeDebt).to.equal(usdt6("10")); // carried forward instead
      expect((await ctx.vaultModule.getVaultMember(vaultId, ctx.user1.address)).balance).to.equal(
        usdt6("1000"),
      );

      // The debt settles out of the next yield, not out of the deposit.
      await earn(ctx, usdt6("50"));
      await ctx.yieldModule.accrue(vaultId);
      y = await ctx.yieldModule.getVaultYield(vaultId);
      expect(y.feeDebt).to.equal(0);
      expect(y.lifetimeFees).to.equal(usdt6("10"));
      expect(y.lifetimeYield).to.equal(usdt6("40"));
      expect(y.principal).to.equal(usdt6("1000"));
    });

    it("caps the fee at the yield actually realized", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));

      await time.increase(YEAR);
      await earn(ctx, usdt6("4")); // a poor year: less than the 10 owed
      await ctx.yieldModule.accrue(vaultId);

      const y = await ctx.yieldModule.getVaultYield(vaultId);
      expect(y.lifetimeFees).to.equal(usdt6("4")); // all of it, but no more
      expect(y.lifetimeYield).to.equal(0);
      expect(y.feeDebt).to.equal(usdt6("6"));
      expect(y.principal).to.equal(usdt6("1000")); // still untouched
    });

    it("never reduces a member's balance across a long sequence of operations", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));
      const balanceOf = async () =>
        (await ctx.vaultModule.getVaultMember(vaultId, ctx.user1.address)).balance;

      let previous = await balanceOf();
      for (let i = 0; i < 6; i++) {
        await time.increase(30 * DAY);
        // Alternate earning years with flat ones so feeDebt builds and settles.
        if (i % 2 === 0) await earn(ctx, usdt6("5"));
        await ctx.yieldModule.accrue(vaultId);
        await ctx.vaultModule.compoundYield(vaultId, ctx.user1.address);

        const current = await balanceOf();
        expect(current).to.be.gte(previous);
        previous = current;
        await expectPositionIdentity(ctx, vaultId);
        await expectLedgerIdentity(ctx, vaultId);
        await expectSolvent(ctx, [vaultId]);
      }
      // Some yield actually landed, so this is not vacuously true.
      expect(previous).to.be.gt(usdt6("1000"));
    });

    it("sweeps collected fees to the treasury and nowhere else", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));

      await time.increase(YEAR);
      await earn(ctx, usdt6("50"));
      await ctx.yieldModule.realizeFees(vaultId);

      const before = await ctx.usdt.balanceOf(ctx.treasury.address);
      await ctx.yieldModule.sweepFees(ctx.usdt.target);
      expect((await ctx.usdt.balanceOf(ctx.treasury.address)) - before).to.equal(usdt6("10"));
      expect(await ctx.yieldModule.pendingFees(ctx.usdt.target)).to.equal(0);
    });

    it("refuses a management fee above the hard maximum", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      await expect(ctx.yieldModule.setManagementFeeBps(201)).to.be.revertedWith("Fee above maximum");
      await ctx.yieldModule.setManagementFeeBps(200);
      expect(await ctx.yieldModule.managementFeeBps()).to.equal(200);
    });
  });

  describe("Distributing yield between members", function () {
    it("credits members pro-rata and never allocates more than the net yield", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      // Isolate the split from the fee: at this principal even the few seconds of
      // block time during setup accrue a real management fee, which has its own
      // tests above.
      await ctx.yieldModule.setManagementFeeBps(0);

      // Community vault so two members share one position.
      await ctx.vaultModule
        .connect(ctx.user1)
        .createVault(usdtVaultParams({ token: ctx.usdt.target, vaultType: VAULT_TYPE_COMMUNITY }));
      // Community vaults never default into earning, so the creator opts in
      // while still the only member — before anyone joins under those terms.
      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(1, MODE_STABLE);
      const vaultId = 1n;

      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("3000"));
      await ctx.vaultModule.connect(ctx.user1).deposit(vaultId, usdt6("3000"));
      await ctx.vaultModule.connect(ctx.user2).joinVault(vaultId);
      await ctx.usdt.connect(ctx.user2).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user2).deposit(vaultId, usdt6("1000"));

      // 100 of yield on 4000, split 3:1. No time has passed, so no fee.
      await earn(ctx, usdt6("100"));
      await ctx.yieldModule.accrue(vaultId);

      const pending1 = await ctx.yieldModule.pendingYield(vaultId, ctx.user1.address);
      const pending2 = await ctx.yieldModule.pendingYield(vaultId, ctx.user2.address);
      expect(pending1).to.equal(usdt6("75"));
      expect(pending2).to.equal(usdt6("25"));

      const y = await ctx.yieldModule.getVaultYield(vaultId);
      expect(pending1 + pending2).to.be.lte(y.lifetimeYield);

      await ctx.vaultModule.compoundYield(vaultId, ctx.user1.address);
      await ctx.vaultModule.compoundYield(vaultId, ctx.user2.address);
      expect((await ctx.vaultModule.getVaultMember(vaultId, ctx.user1.address)).balance).to.equal(
        usdt6("3075"),
      );
      expect((await ctx.vaultModule.getVaultMember(vaultId, ctx.user2.address)).balance).to.equal(
        usdt6("1025"),
      );
      await expectLedgerIdentity(ctx, vaultId);
      await expectSolvent(ctx, [vaultId]);
    });

    it("does not credit a member for yield earned before they joined", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      await ctx.vaultModule
        .connect(ctx.user1)
        .createVault(usdtVaultParams({ token: ctx.usdt.target, vaultType: VAULT_TYPE_COMMUNITY }));
      // Community vaults never default into earning, so the creator opts in
      // while still the only member — before anyone joins under those terms.
      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(1, MODE_STABLE);

      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000"));
      await earn(ctx, usdt6("100"));
      await ctx.yieldModule.accrue(1);

      // user2 arrives only now.
      await ctx.vaultModule.connect(ctx.user2).joinVault(1);
      await ctx.usdt.connect(ctx.user2).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user2).deposit(1, usdt6("1000"));

      expect(await ctx.yieldModule.pendingYield(1, ctx.user2.address)).to.equal(0);
      expect(await ctx.yieldModule.pendingYield(1, ctx.user1.address)).to.equal(usdt6("100"));
    });

    it("keeps one vault from spending another vault's invested funds", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultA = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));
      const vaultB = await createAndDeposit(ctx, ctx.user2, usdt6("1000"));

      await ctx.vaultModule.connect(ctx.user1).withdraw(vaultA, usdt6("1000"));

      expect(await ctx.yieldModule.investedPrincipal(vaultA)).to.equal(0);
      // Vault B's position is untouched.
      expect(await ctx.yieldModule.investedPrincipal(vaultB)).to.equal(usdt6("1000"));
      expect((await ctx.vaultModule.getVault(vaultB)).totalBalance).to.equal(usdt6("1000"));
      await expectSolvent(ctx, [vaultA, vaultB]);
    });
  });

  describe("Withdrawals", function () {
    it("redeems on demand and returns principal plus yield in full", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));

      await earn(ctx, usdt6("100")); // no fee: no time has passed
      const before = await ctx.usdt.balanceOf(ctx.user1.address);

      // The yield is withdrawable, which means settling has to happen before the
      // balance check — 1100 is more than was ever deposited.
      await ctx.vaultModule.connect(ctx.user1).withdraw(vaultId, usdt6("1100"));

      expect((await ctx.usdt.balanceOf(ctx.user1.address)) - before).to.equal(usdt6("1100"));
      expect((await ctx.vaultModule.getVaultMember(vaultId, ctx.user1.address)).balance).to.equal(0);
      expect(await ctx.yieldModule.investedPrincipal(vaultId)).to.equal(0);
      expect((await ctx.yieldModule.getVaultYield(vaultId)).shares).to.equal(0);
    });

    it("pays a partial withdrawal from the strategy and keeps the rest invested", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));

      await ctx.vaultModule.connect(ctx.user1).withdraw(vaultId, usdt6("400"));

      expect(await ctx.yieldModule.investedPrincipal(vaultId)).to.equal(usdt6("600"));
      expect((await ctx.vaultModule.getVault(vaultId)).totalBalance).to.equal(usdt6("600"));
      expect(await ctx.strategy.totalAssets()).to.equal(usdt6("600"));
      await expectPositionIdentity(ctx, vaultId);
      await expectSolvent(ctx, [vaultId]);
    });

    it("reverts rather than paying out short when the protocol is illiquid", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));

      // Drain the reserve behind the strategy's back.
      await ctx.pool.simulateLoss(ctx.usdt.target, ctx.strategy.target, usdt6("1000"));

      await expect(
        ctx.vaultModule.connect(ctx.user1).withdraw(vaultId, usdt6("1000")),
      ).to.be.revertedWith("Insufficient strategy liquidity");
      // The member's recorded balance survives the failed attempt.
      expect((await ctx.vaultModule.getVaultMember(vaultId, ctx.user1.address)).balance).to.equal(
        usdt6("1000"),
      );
    });

    it("settles yield before a percentage limit is measured", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      await ctx.vaultModule.connect(ctx.user1).createVault(
        usdtVaultParams({
          token: ctx.usdt.target,
          limitsArePercentage: true,
          dailyLimit: 1000, // 10%
          weeklyLimit: 5000,
          monthlyLimit: 10000,
        }),
      );
      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000"));

      await earn(ctx, usdt6("100"));
      // 10% of the post-settle balance (1100) is 110, so this clears — it would
      // not have on the pre-settle balance of 1000.
      await ctx.vaultModule.connect(ctx.user1).withdraw(1, usdt6("110"));
      expect((await ctx.vaultModule.getVaultMember(1, ctx.user1.address)).balance).to.equal(usdt6("990"));
    });
  });

  describe("Penalties alongside yield", function () {
    it("keeps penalties idle and never invests them", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      await ctx.vaultModule
        .connect(ctx.user1)
        .createVault(usdtVaultParams({ token: ctx.usdt.target, vaultType: VAULT_TYPE_COMMUNITY }));
      // Community vaults never default into earning, so the creator opts in
      // while still the only member — before anyone joins under those terms.
      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(1, MODE_STABLE);

      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user2).joinVault(1);
      await ctx.usdt.connect(ctx.user2).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user2).deposit(1, usdt6("1000"));

      // user2 exits early and pays a 20% penalty, redistributed to user1.
      await ctx.vaultModule.connect(ctx.user2).withdrawWithPenalty(1, usdt6("1000"));
      const penalty = usdt6("200");

      expect(await ctx.vaultModule.pendingPenaltyRewards(1, ctx.user1.address)).to.equal(penalty);
      // The penalty is sitting here as idle tokens, not inside the strategy.
      expect(await ctx.usdt.balanceOf(ctx.vaultModule.target)).to.equal(penalty);
      expect(await ctx.yieldModule.investedPrincipal(1)).to.equal(usdt6("1000"));

      // Claiming it needs no redemption at all.
      await ctx.vaultModule.connect(ctx.user1).claimPenaltyRewards(1);
      expect(await ctx.usdt.balanceOf(ctx.vaultModule.target)).to.equal(0);
      expect(await ctx.yieldModule.investedPrincipal(1)).to.equal(usdt6("1000"));
      await expectSolvent(ctx, [1n]);
    });

    it("still excludes the withdrawer from their own penalty when yield is in play", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      await ctx.vaultModule
        .connect(ctx.user1)
        .createVault(usdtVaultParams({ token: ctx.usdt.target, vaultType: VAULT_TYPE_COMMUNITY }));
      // Community vaults never default into earning, so the creator opts in
      // while still the only member — before anyone joins under those terms.
      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(1, MODE_STABLE);

      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user2).joinVault(1);
      await ctx.usdt.connect(ctx.user2).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user2).deposit(1, usdt6("1000"));

      await earn(ctx, usdt6("200"));
      // user2 withdraws half, paying a penalty the remaining half must not earn.
      await ctx.vaultModule.connect(ctx.user2).withdrawWithPenalty(1, usdt6("500"));

      const rewards2 = await ctx.vaultModule.pendingPenaltyRewards(1, ctx.user2.address);
      expect(rewards2).to.equal(0);
      expect(await ctx.vaultModule.pendingPenaltyRewards(1, ctx.user1.address)).to.be.gt(0);
      await expectLedgerIdentity(ctx, 1n);
      await expectSolvent(ctx, [1n]);
    });
  });

  describe("Losses", function () {
    it("records a deficit without reducing any member's balance", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));

      await ctx.pool.simulateLoss(ctx.usdt.target, ctx.strategy.target, usdt6("100"));
      await expect(ctx.yieldModule.accrue(vaultId)).to.emit(ctx.yieldModule, "YieldDeficit");

      const y = await ctx.yieldModule.getVaultYield(vaultId);
      expect(y.deficit).to.equal(usdt6("100"));
      expect(y.principal).to.equal(usdt6("1000"));
      expect((await ctx.vaultModule.getVaultMember(vaultId, ctx.user1.address)).balance).to.equal(
        usdt6("1000"),
      );
      await expectPositionIdentity(ctx, vaultId);
    });

    it("repays the deficit out of later yield before paying any fee", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));

      await ctx.pool.simulateLoss(ctx.usdt.target, ctx.strategy.target, usdt6("100"));
      await ctx.yieldModule.accrue(vaultId);

      await time.increase(YEAR);
      await earn(ctx, usdt6("100")); // exactly covers the hole, nothing more
      await ctx.yieldModule.accrue(vaultId);

      const y = await ctx.yieldModule.getVaultYield(vaultId);
      expect(y.deficit).to.equal(0);
      expect(y.lifetimeYield).to.equal(0); // members earn nothing yet
      expect(y.lifetimeFees).to.equal(0); // and neither does the treasury
      expect(y.feeDebt).to.equal(usdt6("10")); // the fee waits its turn
    });
  });

  describe("Switching modes", function () {
    it("divests fully when the creator switches earning off", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));
      await earn(ctx, usdt6("50"));

      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(vaultId, MODE_OFF);

      expect(await ctx.yieldModule.investedPrincipal(vaultId)).to.equal(0);
      expect(await ctx.strategy.totalAssets()).to.equal(0);
      expect(await ctx.yieldModule.effectiveMode(vaultId)).to.equal(MODE_OFF);
      // The member keeps the yield they earned; it is simply idle now.
      const member = await ctx.vaultModule.getVaultMember(vaultId, ctx.user1.address);
      expect(member.balance).to.equal(usdt6("1050"));
      await expectLedgerIdentity(ctx, vaultId);
      await expectSolvent(ctx, [vaultId]);

      // And it is still fully withdrawable.
      await ctx.vaultModule.connect(ctx.user1).withdraw(vaultId, usdt6("1050"));
      expect((await ctx.vaultModule.getVaultMember(vaultId, ctx.user1.address)).balance).to.equal(0);
    });

    it("never defaults a community vault into earning", async function () {
      // A community vault holds other people's money under rules fixed at
      // creation. Defaulting it into an outside protocol would commit members
      // who never agreed and leave them no way out.
      const ctx = await loadFixture(deployYieldFixture);
      await ctx.vaultModule
        .connect(ctx.user1)
        .createVault(usdtVaultParams({ token: ctx.usdt.target, vaultType: VAULT_TYPE_COMMUNITY }));

      expect(await ctx.yieldModule.effectiveMode(1)).to.equal(MODE_OFF);

      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000"));
      expect(await ctx.yieldModule.investedPrincipal(1)).to.equal(0);
      expect(await ctx.usdt.balanceOf(ctx.vaultModule.target)).to.equal(usdt6("1000"));
    });

    it("lets a community creator opt in only while they are the only member", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      await ctx.vaultModule
        .connect(ctx.user1)
        .createVault(usdtVaultParams({ token: ctx.usdt.target, vaultType: VAULT_TYPE_COMMUNITY }));

      // Alone: allowed, so members can see the setting before they join.
      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(1, MODE_STABLE);
      expect(await ctx.yieldModule.effectiveMode(1)).to.equal(MODE_STABLE);

      // Once someone else has joined, the terms are fixed like every other rule.
      await ctx.vaultModule.connect(ctx.user2).joinVault(1);
      await expect(
        ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(1, MODE_OFF),
      ).to.be.revertedWith("Community yield immutable");
    });

    it("lets a personal vault owner switch off at any time", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));
      expect(await ctx.yieldModule.effectiveMode(vaultId)).to.equal(MODE_STABLE);
      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(vaultId, MODE_OFF);
      expect(await ctx.yieldModule.effectiveMode(vaultId)).to.equal(MODE_OFF);
    });

    it("lets only the creator change the mode, and rejects a no-op change", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));

      await expect(
        ctx.vaultModule.connect(ctx.user2).setVaultYieldMode(vaultId, MODE_OFF),
      ).to.be.revertedWith("Only creator");
      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(vaultId, MODE_OFF);
      await expect(
        ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(vaultId, MODE_OFF),
      ).to.be.revertedWith("Yield mode unchanged");
    });
  });

  describe("Owner controls", function () {
    it("requires a queued, matured change before replacing a live strategy", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const AaveV3Strategy = await hre.ethers.getContractFactory("AaveV3Strategy");
      const replacement = await AaveV3Strategy.deploy(
        ctx.usdt.target,
        ctx.pool.target,
        ctx.aToken.target,
        ctx.yieldModule.target,
      );

      await expect(
        ctx.yieldModule.setStrategy(ctx.usdt.target, MODE_STABLE, replacement.target),
      ).to.be.revertedWith("Strategy change not queued");

      await ctx.yieldModule.queueStrategyChange(ctx.usdt.target, MODE_STABLE, replacement.target);
      await expect(
        ctx.yieldModule.setStrategy(ctx.usdt.target, MODE_STABLE, replacement.target),
      ).to.be.revertedWith("Strategy change not ready");

      await time.increase(7 * DAY);
      await ctx.yieldModule.setStrategy(ctx.usdt.target, MODE_STABLE, replacement.target);
      expect(await ctx.yieldModule.getStrategy(ctx.usdt.target, MODE_STABLE)).to.equal(
        replacement.target,
      );
    });

    it("rejects a strategy that does not match the token, mode or controller", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
      const other = await MockUSDT.deploy();
      const AaveV3Strategy = await hre.ethers.getContractFactory("AaveV3Strategy");

      const wrongAsset = await AaveV3Strategy.deploy(
        other.target,
        ctx.pool.target,
        ctx.aToken.target,
        ctx.yieldModule.target,
      );
      await expect(
        ctx.yieldModule.setStrategy(ctx.usdt.target, MODE_STABLE, wrongAsset.target),
      ).to.be.revertedWith("Strategy asset mismatch");

      const wrongController = await AaveV3Strategy.deploy(
        ctx.usdt.target,
        ctx.pool.target,
        ctx.aToken.target,
        ctx.vaultModule.target,
      );
      await expect(
        ctx.yieldModule.setStrategy(ctx.usdt.target, MODE_STABLE, wrongController.target),
      ).to.be.revertedWith("Strategy controller mismatch");
    });

    it("stops new investment while paused without blocking withdrawals", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));
      await ctx.yieldModule.pauseStrategies(true);

      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("500"));
      await ctx.vaultModule.connect(ctx.user1).deposit(vaultId, usdt6("500"));
      expect(await ctx.yieldModule.investedPrincipal(vaultId)).to.equal(usdt6("1000")); // no new money in

      // The already-invested balance remains fully withdrawable.
      await ctx.vaultModule.connect(ctx.user1).withdraw(vaultId, usdt6("1500"));
      expect((await ctx.vaultModule.getVaultMember(vaultId, ctx.user1.address)).balance).to.equal(0);
    });

    it("returns everything to the vault module on an emergency exit", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));
      await earn(ctx, usdt6("50"));

      await ctx.yieldModule.emergencyExitVault(vaultId);

      expect(await ctx.usdt.balanceOf(ctx.vaultModule.target)).to.equal(usdt6("1050"));
      expect(await ctx.strategy.totalAssets()).to.equal(0);
      expect(await ctx.yieldModule.effectiveMode(vaultId)).to.equal(MODE_OFF);
      await expectSolvent(ctx, [vaultId]);
    });

    it("reports the strategy's rate, and zero when Aave cannot be read", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      expect(await ctx.yieldModule.currentAprBps(ctx.usdt.target, MODE_STABLE)).to.equal(500);

      await ctx.pool.setReserveDataBroken(true);
      expect(await ctx.yieldModule.currentAprBps(ctx.usdt.target, MODE_STABLE)).to.equal(0);
    });

    it("only lets the vault module drive the accounting hooks", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const vaultId = await createAndDeposit(ctx, ctx.user1, usdt6("1000"));

      await expect(
        ctx.yieldModule.connect(ctx.user1).settleMemberYield(vaultId, ctx.user1.address),
      ).to.be.revertedWith("Not vault module");
      await expect(
        ctx.yieldModule
          .connect(ctx.user1)
          .onDeposit(vaultId, ctx.usdt.target, ctx.user1.address, usdt6("1")),
      ).to.be.revertedWith("Not vault module");
      await expect(
        ctx.yieldModule
          .connect(ctx.user1)
          .ensureLiquidity(vaultId, ctx.usdt.target, ctx.user1.address, usdt6("1"), ctx.user1.address),
      ).to.be.revertedWith("Not vault module");
    });
  });

  describe("Storage and reentrancy safety", function () {
    it("keeps yieldModule appended at slot 10, leaving the existing layout intact", async function () {
      const ctx = await loadFixture(deployYieldFixture);
      const read = async (slot: number) =>
        hre.ethers.getAddress(
          "0x" + (await hre.ethers.provider.getStorage(ctx.vaultModule.target, slot)).slice(-40),
        );

      // The pre-existing layout, unchanged: savingsCore, treasury, then
      // vaultCount and the mappings, with `locked` and vaultDepositProxies at
      // 8 and 9. Yield is appended after all of it.
      expect(await read(0)).to.equal(hre.ethers.getAddress(ctx.savingsCore.target as string));
      expect(await read(1)).to.equal(ctx.treasury.address);
      expect(await read(10)).to.equal(hre.ethers.getAddress(ctx.yieldModule.target as string));
    });

    it("blocks a strategy that tries to re-enter a withdrawal", async function () {
      const ctx = await loadFixture(deployReentrantFixture);
      await ctx.vaultModule.connect(ctx.user1).createVault(usdtVaultParams({ token: ctx.usdt.target }));
      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000"));

      await ctx.strategy.armAttack(1, usdt6("10"));
      await expect(
        ctx.vaultModule.connect(ctx.user1).withdraw(1, usdt6("500")),
      ).to.be.revertedWith("Reentrant call");
    });
  });
});
