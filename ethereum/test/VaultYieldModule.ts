import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const KIND_COIN = 0;
const KIND_STABLES = 1;
const PERSONAL = 0;
const COMMUNITY = 1;
const MODE_OFF = 1;
const MODE_STABLE = 2;
const DAY = 24 * 60 * 60;
const YEAR = 365 * DAY;

const usd = (amount: string) => hre.ethers.parseUnits(amount, 6);
/** Aave expresses annual rates in rays; 5% is 0.05e27. */
const rateRay = (percent: number) => (BigInt(percent * 100) * 10n ** 27n) / 10000n;

/**
 * Earning, on the unified vault.
 *
 * The property worth defending is narrow and absolute: the fee comes out of
 * yield or it does not get taken. Several of these tests exist only to try to
 * make a balance shrink, and none of them can.
 */
describe("VaultYieldModule", function () {
  async function fixture() {
    const [owner, user1, user2, treasury] = await hre.ethers.getSigners();

    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);
    await savingsCore.waitForDeployment();

    const deploy = async (name: string) => {
      const f = await hre.ethers.getContractFactory(name);
      const p = await hre.upgrades.deployProxy(f, [savingsCore.target], { initializer: "initialize" });
      await p.waitForDeployment();
      return p;
    };
    const vaults = await deploy("SavingsVaultModule");
    const limits = await deploy("TimePeriodLimitsModule");
    const proposals = await deploy("ProposalSystemModule");
    const bypass = await deploy("BypassSystemModule");
    const yieldModule = await deploy("VaultYieldModule");
    const reg = (id: string, t: any) =>
      savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(id)), t);
    await reg("SAVINGS_VAULTS", vaults.target);
    await reg("TIME_PERIOD_LIMITS", limits.target);
    await reg("PROPOSAL_SYSTEM", proposals.target);
    await reg("BYPASS_SYSTEM", bypass.target);
    await reg("VAULT_YIELD", yieldModule.target);
    await savingsCore.setupModuleCrossReferences();

    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    const usdc = await MockUSDT.deploy();
    await usdt.waitForDeployment();
    await usdc.waitForDeployment();
    for (const user of [user1, user2]) {
      await usdt.transfer(user.address, usd("100000"));
      await usdc.transfer(user.address, usd("100000"));
    }

    // A lending market per asset, as in the real thing: USDC's reserve knows
    // nothing about USDT's, which is what forced positions to be per token.
    const MockAavePool = await hre.ethers.getContractFactory("MockAavePool");
    const MockAToken = await hre.ethers.getContractFactory("MockAToken");
    const Strategy = await hre.ethers.getContractFactory("AaveV3Strategy");
    const pool = await MockAavePool.deploy();
    await pool.waitForDeployment();

    const makeMarket = async (token: any, symbol: string) => {
      const aToken = await MockAToken.deploy(symbol, symbol, token.target, pool.target, 6);
      await aToken.waitForDeployment();
      await pool.registerReserve(token.target, aToken.target);
      await pool.setLiquidityRate(token.target, rateRay(5));
      const strategy = await Strategy.deploy(
        token.target, pool.target, aToken.target, yieldModule.target,
      );
      await strategy.waitForDeployment();
      await yieldModule.setStrategy(token.target, strategy.target);
      return { aToken, strategy };
    };
    const usdtMarket = await makeMarket(usdt, "aUSDT");
    const usdcMarket = await makeMarket(usdc, "aUSDC");

    // simulateYield is funded by its caller, so the pool needs an allowance.
    await usdt.approve(pool.target, usd("1000000"));
    await usdc.approve(pool.target, usd("1000000"));

    await yieldModule.setVaultModule(vaults.target);
    await vaults.setYieldModule(yieldModule.target);
    await vaults.setTreasury(treasury.address);

    return {
      savingsCore, vaults, limits, yieldModule, usdt, usdc, pool,
      usdtMarket, usdcMarket, owner, user1, user2, treasury,
    };
  }

  /** A single-coin vault, the simplest thing that can earn. */
  async function coinVault(ctx: any, signer: any, token: any, earning = true) {
    await ctx.vaults.connect(signer).createVault(
      "Savings", KIND_COIN, PERSONAL, [token.target],
      false, 2000, ["Daily"], [usd("100000")], [DAY], [DAY],
    );
    const id = await ctx.vaults.getVaultCount();
    if (earning) await ctx.vaults.connect(signer).setYieldMode(id, token.target, MODE_STABLE);
    return id;
  }

  async function deposit(ctx: any, signer: any, id: bigint, token: any, amount: bigint) {
    await token.connect(signer).approve(ctx.vaults.target, amount);
    await ctx.vaults.connect(signer).deposit(id, token.target, amount);
  }

  /** Add yield to a position by growing what the strategy holds. */
  async function earn(ctx: any, token: any, market: any, amount: bigint) {
    await ctx.pool.simulateYield(token.target, market.strategy.target, amount);
  }

  /**
   * The identity all the accounting rests on. While it holds after every
   * operation, no member's balance is funded out of another's.
   */
  async function expectPositionIdentity(ctx: any, id: bigint, token: any, market: any) {
    const p = await ctx.yieldModule.getPosition(id, token.target);
    const value = p.shares === 0n ? 0n : await market.strategy.convertToAssets(p.shares);
    const diff = value + p.deficit - (p.principal + p.owedYield + p.accruedFees);
    expect(diff).to.be.gte(-2n).and.lte(2n);
  }

  describe("investing", function () {
    it("routes a deposit into the strategy", async function () {
      const ctx = await loadFixture(fixture);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("1000"));

      expect(await ctx.yieldModule.investedPrincipal(id, ctx.usdt.target)).to.equal(usd("1000"));
      expect(await ctx.usdt.balanceOf(ctx.vaults.target)).to.equal(0);
      // Where the money sits does not change what the ledger says it is.
      expect(await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.usdt.target)).to.equal(usd("1000"));
      await expectPositionIdentity(ctx, id, ctx.usdt, ctx.usdtMarket);
    });

    it("leaves a vault alone when earning was never switched on", async function () {
      const ctx = await loadFixture(fixture);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt, false);
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("1000"));

      expect(await ctx.yieldModule.investedPrincipal(id, ctx.usdt.target)).to.equal(0);
      expect(await ctx.usdt.balanceOf(ctx.vaults.target)).to.equal(usd("1000"));
    });

    it("keeps a stables vault's assets in their own markets", async function () {
      const ctx = await loadFixture(fixture);
      await ctx.vaults.connect(ctx.user1).createVault(
        "Savings", KIND_STABLES, PERSONAL, [ctx.usdt.target, ctx.usdc.target],
        false, 2000, ["Daily"], [usd("100000")], [DAY], [DAY],
      );
      const id = await ctx.vaults.getVaultCount();
      await ctx.vaults.connect(ctx.user1).setYieldMode(id, ctx.usdt.target, MODE_STABLE);
      await ctx.vaults.connect(ctx.user1).setYieldMode(id, ctx.usdc.target, MODE_STABLE);

      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("1000"));
      await deposit(ctx, ctx.user1, id, ctx.usdc, usd("2000"));

      // One vault, two positions. A single per-vault position could not
      // represent this, which is exactly why the keying changed.
      expect(await ctx.yieldModule.investedPrincipal(id, ctx.usdt.target)).to.equal(usd("1000"));
      expect(await ctx.yieldModule.investedPrincipal(id, ctx.usdc.target)).to.equal(usd("2000"));

      // And switching one off must not disturb the other.
      await ctx.vaults.connect(ctx.user1).setYieldMode(id, ctx.usdt.target, MODE_OFF);
      expect(await ctx.yieldModule.investedPrincipal(id, ctx.usdt.target)).to.equal(0);
      expect(await ctx.yieldModule.investedPrincipal(id, ctx.usdc.target)).to.equal(usd("2000"));
    });

    it("still accepts the deposit when the protocol refuses it", async function () {
      const ctx = await loadFixture(fixture);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await ctx.pool.setSupplyPaused(true);

      await ctx.usdt.connect(ctx.user1).approve(ctx.vaults.target, usd("1000"));
      await expect(ctx.vaults.connect(ctx.user1).deposit(id, ctx.usdt.target, usd("1000")))
        .to.emit(ctx.yieldModule, "StrategyDepositSkipped");

      // The user's money is theirs whatever Aave happens to be doing.
      expect(await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.usdt.target)).to.equal(usd("1000"));
      expect(await ctx.usdt.balanceOf(ctx.vaults.target)).to.equal(usd("1000"));
    });
  });

  describe("distribution", function () {
    it("credits earnings into the balance, where they keep earning", async function () {
      const ctx = await loadFixture(fixture);
      // Isolate distribution from the fee, which is measured on its own below.
      await ctx.yieldModule.setManagementFeeBps(0);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("4000"));

      await earn(ctx, ctx.usdt, ctx.usdtMarket, usd("400"));
      await ctx.vaults.compoundYield(id, ctx.usdt.target, ctx.user1.address);

      expect(await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.usdt.target))
        .to.be.closeTo(usd("4400"), 2n);
      // Compounded yield moved no tokens — it just became principal.
      expect(await ctx.yieldModule.investedPrincipal(id, ctx.usdt.target))
        .to.be.closeTo(usd("4400"), 2n);
      await expectPositionIdentity(ctx, id, ctx.usdt, ctx.usdtMarket);
    });

    it("splits yield between two members in proportion to their balances", async function () {
      const ctx = await loadFixture(fixture);
      await ctx.yieldModule.setManagementFeeBps(0);
      await ctx.vaults.connect(ctx.user1).createVault(
        "Club", KIND_COIN, COMMUNITY, [ctx.usdt.target],
        false, 2000, ["Daily"], [usd("100000")], [DAY], [DAY],
      );
      const id = await ctx.vaults.getVaultCount();
      // Settled while the creator is still alone — after that the terms people
      // joined under are fixed.
      await ctx.vaults.connect(ctx.user1).setYieldMode(id, ctx.usdt.target, MODE_STABLE);
      await ctx.vaults.connect(ctx.user2).joinVault(id);

      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("3000"));
      await deposit(ctx, ctx.user2, id, ctx.usdt, usd("1000"));
      await earn(ctx, ctx.usdt, ctx.usdtMarket, usd("400"));

      await ctx.vaults.compoundYield(id, ctx.usdt.target, ctx.user1.address);
      await ctx.vaults.compoundYield(id, ctx.usdt.target, ctx.user2.address);

      expect(await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.usdt.target))
        .to.be.closeTo(usd("3300"), usd("1"));
      expect(await ctx.vaults.balanceOf(id, ctx.user2.address, ctx.usdt.target))
        .to.be.closeTo(usd("1100"), usd("1"));
      await expectPositionIdentity(ctx, id, ctx.usdt, ctx.usdtMarket);
    });

    it("does not pay a member for yield earned before they arrived", async function () {
      const ctx = await loadFixture(fixture);
      await ctx.yieldModule.setManagementFeeBps(0);
      await ctx.vaults.connect(ctx.user1).createVault(
        "Club", KIND_COIN, COMMUNITY, [ctx.usdt.target],
        false, 2000, ["Daily"], [usd("100000")], [DAY], [DAY],
      );
      const id = await ctx.vaults.getVaultCount();
      await ctx.vaults.connect(ctx.user1).setYieldMode(id, ctx.usdt.target, MODE_STABLE);

      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("1000"));
      await earn(ctx, ctx.usdt, ctx.usdtMarket, usd("100"));

      // user2 arrives only now, after the accumulator has already moved.
      await ctx.vaults.connect(ctx.user2).joinVault(id);
      await deposit(ctx, ctx.user2, id, ctx.usdt, usd("1000"));
      await ctx.vaults.compoundYield(id, ctx.usdt.target, ctx.user2.address);

      expect(await ctx.vaults.balanceOf(id, ctx.user2.address, ctx.usdt.target)).to.equal(usd("1000"));
      await ctx.vaults.compoundYield(id, ctx.usdt.target, ctx.user1.address);
      expect(await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.usdt.target))
        .to.be.closeTo(usd("1100"), 2n);
    });
  });

  describe("the fee", function () {
    it("takes one percentage point of the rate, time-weighted on principal", async function () {
      const ctx = await loadFixture(fixture);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("10000"));

      // Plenty of yield, so the fee is not capped by it — this measures the
      // rate, not the cap.
      await earn(ctx, ctx.usdt, ctx.usdtMarket, usd("1000"));
      await time.increase(YEAR);
      await ctx.yieldModule.accrue(id, ctx.usdt.target);

      const p = await ctx.yieldModule.getPosition(id, ctx.usdt.target);
      expect(p.accruedFees).to.be.closeTo(usd("100"), usd("1"));
      expect(p.principal).to.be.gte(usd("10000"));
      await expectPositionIdentity(ctx, id, ctx.usdt, ctx.usdtMarket);
    });

    it("takes nothing from a flat period and carries the shortfall", async function () {
      const ctx = await loadFixture(fixture);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("10000"));

      await time.increase(YEAR);
      await ctx.yieldModule.accrue(id, ctx.usdt.target);

      let p = await ctx.yieldModule.getPosition(id, ctx.usdt.target);
      expect(p.accruedFees).to.equal(0);
      // A whole year owed, waiting on yield that never came.
      expect(p.feeDebt).to.be.closeTo(usd("100"), usd("1"));
      expect(p.principal).to.equal(usd("10000"));

      await earn(ctx, ctx.usdt, ctx.usdtMarket, usd("500"));
      await ctx.yieldModule.accrue(id, ctx.usdt.target);
      p = await ctx.yieldModule.getPosition(id, ctx.usdt.target);
      expect(p.feeDebt).to.equal(0);
      expect(p.accruedFees).to.be.closeTo(usd("100"), usd("1"));
    });

    it("never lets a balance shrink, however long it goes without yield", async function () {
      const ctx = await loadFixture(fixture);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("10000"));

      let previous = await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.usdt.target);
      for (let i = 0; i < 5; i++) {
        await time.increase(YEAR);
        await ctx.vaults.compoundYield(id, ctx.usdt.target, ctx.user1.address);
        const now = await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.usdt.target);
        // Monotonic: the direct statement of the guarantee.
        expect(now).to.be.gte(previous);
        previous = now;
      }
      expect(previous).to.equal(usd("10000"));
    });

    it("caps what the owner can ever set", async function () {
      const ctx = await loadFixture(fixture);
      await expect(ctx.yieldModule.setManagementFeeBps(201)).to.be.revertedWith("Fee above maximum");
      await ctx.yieldModule.setManagementFeeBps(200);
    });

    it("sends realized fees to the treasury and nowhere else", async function () {
      const ctx = await loadFixture(fixture);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("10000"));
      await earn(ctx, ctx.usdt, ctx.usdtMarket, usd("1000"));
      await time.increase(YEAR);

      await ctx.yieldModule.realizeFees(id, ctx.usdt.target);
      // Permissionless, because it can only pay the treasury the vault names.
      await ctx.yieldModule.connect(ctx.user2).sweepFees(ctx.usdt.target);

      expect(await ctx.usdt.balanceOf(ctx.treasury.address)).to.be.closeTo(usd("100"), usd("1"));
      await expectPositionIdentity(ctx, id, ctx.usdt, ctx.usdtMarket);
    });
  });

  describe("getting the money back", function () {
    it("redeems on demand for a withdrawal", async function () {
      const ctx = await loadFixture(fixture);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("1000"));

      const before = await ctx.usdt.balanceOf(ctx.user1.address);
      await ctx.vaults.connect(ctx.user1)
        .withdraw(id, ctx.usdt.target, usd("400"), ctx.user1.address);

      expect(await ctx.usdt.balanceOf(ctx.user1.address)).to.equal(before + usd("400"));
      expect(await ctx.yieldModule.investedPrincipal(id, ctx.usdt.target)).to.equal(usd("600"));
      await expectPositionIdentity(ctx, id, ctx.usdt, ctx.usdtMarket);
    });

    it("returns principal and yield together on a full exit", async function () {
      const ctx = await loadFixture(fixture);
      await ctx.yieldModule.setManagementFeeBps(0);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("1000"));
      await earn(ctx, ctx.usdt, ctx.usdtMarket, usd("50"));

      await ctx.vaults.compoundYield(id, ctx.usdt.target, ctx.user1.address);
      const owned = await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.usdt.target);
      expect(owned).to.be.closeTo(usd("1050"), 2n);

      const before = await ctx.usdt.balanceOf(ctx.user1.address);
      await ctx.vaults.connect(ctx.user1).withdraw(id, ctx.usdt.target, owned, ctx.user1.address);

      expect(await ctx.usdt.balanceOf(ctx.user1.address)).to.equal(before + owned);
      expect((await ctx.yieldModule.getPosition(id, ctx.usdt.target)).principal).to.equal(0);
    });

    it("refuses rather than paying out short when the protocol is illiquid", async function () {
      const ctx = await loadFixture(fixture);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("1000"));
      await ctx.pool.drainLiquidity(ctx.usdt.target, usd("900"));

      await expect(
        ctx.vaults.connect(ctx.user1).withdraw(id, ctx.usdt.target, usd("400"), ctx.user1.address),
      ).to.be.reverted;
      // Nothing half-done: the ledger still shows every cent.
      expect(await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.usdt.target)).to.equal(usd("1000"));
    });

    it("brings everything home when earning is switched off", async function () {
      const ctx = await loadFixture(fixture);
      await ctx.yieldModule.setManagementFeeBps(0);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("1000"));
      await earn(ctx, ctx.usdt, ctx.usdtMarket, usd("50"));

      await ctx.vaults.connect(ctx.user1).setYieldMode(id, ctx.usdt.target, MODE_OFF);

      // "Off" means the money is back, not merely that no more goes out.
      expect(await ctx.yieldModule.investedPrincipal(id, ctx.usdt.target)).to.equal(0);
      expect(await ctx.usdt.balanceOf(ctx.vaults.target)).to.be.gte(usd("1000"));

      // And a later deposit must not quietly re-invest it.
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("100"));
      expect(await ctx.yieldModule.investedPrincipal(id, ctx.usdt.target)).to.equal(0);
    });
  });

  describe("who may switch it on", function () {
    it("refuses anyone but the vault's creator", async function () {
      const ctx = await loadFixture(fixture);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await expect(
        ctx.vaults.connect(ctx.user2).setYieldMode(id, ctx.usdt.target, MODE_OFF),
      ).to.be.revertedWith("Not the vault creator");
    });

    it("refuses a token the vault does not hold", async function () {
      const ctx = await loadFixture(fixture);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await expect(
        ctx.vaults.connect(ctx.user1).setYieldMode(id, ctx.usdc.target, MODE_STABLE),
      ).to.be.revertedWith("Token not accepted here");
    });

    it("fixes a community vault's setting once anyone has joined", async function () {
      const ctx = await loadFixture(fixture);
      await ctx.vaults.connect(ctx.user1).createVault(
        "Club", KIND_COIN, COMMUNITY, [ctx.usdt.target],
        false, 2000, ["Daily"], [usd("100000")], [DAY], [DAY],
      );
      const id = await ctx.vaults.getVaultCount();
      await ctx.vaults.connect(ctx.user2).joinVault(id);

      // One member must not be able to route everyone else's money into an
      // outside protocol after they joined on other terms.
      await expect(
        ctx.vaults.connect(ctx.user1).setYieldMode(id, ctx.usdt.target, MODE_STABLE),
      ).to.be.revertedWith("Community yield immutable");
    });
  });

  describe("when the protocol loses money", function () {
    it("records the loss without reducing a balance, and repays it first", async function () {
      const ctx = await loadFixture(fixture);
      await ctx.yieldModule.setManagementFeeBps(0);
      const id = await coinVault(ctx, ctx.user1, ctx.usdt);
      await deposit(ctx, ctx.user1, id, ctx.usdt, usd("1000"));

      await ctx.pool.simulateLoss(ctx.usdt.target, ctx.usdtMarket.strategy.target, usd("100"));
      await ctx.yieldModule.accrue(id, ctx.usdt.target);

      let p = await ctx.yieldModule.getPosition(id, ctx.usdt.target);
      expect(p.deficit).to.equal(usd("100"));
      // The ledger is not haircut — a loss is carried, not passed on silently.
      expect(await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.usdt.target)).to.equal(usd("1000"));

      // Later yield fills the hole before anybody earns anything.
      await earn(ctx, ctx.usdt, ctx.usdtMarket, usd("60"));
      await ctx.yieldModule.accrue(id, ctx.usdt.target);
      p = await ctx.yieldModule.getPosition(id, ctx.usdt.target);
      expect(p.deficit).to.equal(usd("40"));
      expect(p.owedYield).to.equal(0);
    });
  });

  describe("storage layout", function () {
    it("keeps the vault module upgradeable in place", async function () {
      const ctx = await loadFixture(fixture);
      const factory = await hre.ethers.getContractFactory("SavingsVaultModule");
      // The module custodies funds, so it is upgraded, never replaced.
      await hre.upgrades.validateUpgrade(ctx.vaults.target as string, factory, { kind: "uups" });
    });
  });
});
