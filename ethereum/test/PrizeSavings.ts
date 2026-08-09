import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const VAULT_TYPE_PERSONAL = 0;
const VAULT_TYPE_COMMUNITY = 1;

const MODE_OFF = 1;
const MODE_STABLE = 2;
const MODE_PRIZE = 3;

const usdt6 = (amount: string) => hre.ethers.parseUnits(amount, 6);
const eth = (amount: string) => hre.ethers.parseEther(amount);

describe("Prize savings", function () {
  async function deployPrizeFixture() {
    const [owner, user1, user2, treasury] = await hre.ethers.getSigners();

    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);

    const VaultSystemModule = await hre.ethers.getContractFactory("VaultSystemModule");
    const vaultModule = await hre.upgrades.deployProxy(VaultSystemModule, [savingsCore.target]);
    await savingsCore.registerModule(
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("VAULT_SYSTEM")),
      vaultModule.target,
    );

    const YieldModule = await hre.ethers.getContractFactory("YieldModule");
    const yieldModule = await hre.upgrades.deployProxy(YieldModule, [savingsCore.target]);
    await savingsCore.registerModule(
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("YIELD_SYSTEM")),
      yieldModule.target,
    );

    // Vault rules live in the shared modules now, so a fixture that creates a
    // vault has to register them — the vault module fails closed without them.
    const deployShared = async (name) => {
      const f = await hre.ethers.getContractFactory(name);
      const proxy = await hre.upgrades.deployProxy(f, [savingsCore.target], { initializer: "initialize" });
      await proxy.waitForDeployment();
      return proxy;
    };
    const limitsModule = await deployShared("TimePeriodLimitsModule");
    const proposalModule = await deployShared("ProposalSystemModule");
    const bypassModule = await deployShared("BypassSystemModule");
    const reg = (id, t) => savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(id)), t);
    await reg("TIME_PERIOD_LIMITS", limitsModule.target);
    await reg("PROPOSAL_SYSTEM", proposalModule.target);
    await reg("BYPASS_SYSTEM", bypassModule.target);
    await savingsCore.setupModuleCrossReferences();

    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    for (const user of [user1, user2]) await usdt.transfer(user.address, usdt6("100000"));

    // The prize token is deliberately NOT the deposited asset — WETH on Optimism.
    const MockWETH = await hre.ethers.getContractFactory("MockWETH");
    const weth = await MockWETH.deploy();

    const MockV5PrizeVault = await hre.ethers.getContractFactory("MockV5PrizeVault");
    const prizeVault = await MockV5PrizeVault.deploy(usdt.target, 6);

    const MockPrizePoolV5 = await hre.ethers.getContractFactory("MockPrizePoolV5");
    const prizePool = await MockPrizePoolV5.deploy(weth.target, eth("3.16"));

    const PoolTogetherStrategy = await hre.ethers.getContractFactory("PoolTogetherStrategy");
    const strategy = await PoolTogetherStrategy.deploy(
      prizeVault.target,
      prizePool.target,
      yieldModule.target,
    );

    await yieldModule.setVaultModule(vaultModule.target);
    await vaultModule.setTreasury(treasury.address);
    await yieldModule.setStrategy(usdt.target, MODE_PRIZE, strategy.target);
    await yieldModule.setYieldWatermark();
    await vaultModule.setYieldModule(yieldModule.target);

    return {
      savingsCore, vaultModule, yieldModule, usdt, weth, prizeVault, prizePool, strategy,
      owner, user1, user2, treasury,
    };
  }

  function vaultParams(ctx: any, overrides: Record<string, unknown> = {}) {
    return {
      name: "Prize Savings",
      description: "lottery vault",
      vaultType: VAULT_TYPE_PERSONAL,
      token: ctx.usdt.target,
      dailyLimit: usdt6("100000"),
      weeklyLimit: usdt6("100000"),
      monthlyLimit: usdt6("100000"),
      limitsArePercentage: false,
      penaltyRateBps: 2000,
      ...overrides,
    };
  }

  /** Create a prize vault, opt in, and deposit. */
  async function createPrizeVault(ctx: any, signer: any, amount: bigint, overrides = {}) {
    await ctx.vaultModule.connect(signer).createVault(vaultParams(ctx, overrides));
    const vaultId = await ctx.vaultModule.getVaultCount();
    await ctx.vaultModule.connect(signer).setVaultYieldMode(vaultId, MODE_PRIZE);
    await ctx.usdt.connect(signer).approve(ctx.vaultModule.target, amount);
    await ctx.vaultModule.connect(signer).deposit(vaultId, amount);
    return vaultId;
  }

  /** A claimer bot pays a prize straight to a winning depositor's position. */
  async function awardPrize(ctx: any, position: string, amount: bigint) {
    await ctx.weth.approve(ctx.prizePool.target, amount);
    await ctx.prizePool.awardPrize(position, amount);
  }

  describe("Per-member positions", function () {
    it("gives each member their own position, which is what earns them real odds", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      await ctx.vaultModule
        .connect(ctx.user1)
        .createVault(vaultParams(ctx, { vaultType: VAULT_TYPE_COMMUNITY }));
      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(1, MODE_PRIZE);

      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user2).joinVault(1);
      await ctx.usdt.connect(ctx.user2).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user2).deposit(1, usdt6("1000"));

      const p1 = await ctx.yieldModule.prizePositionOf(1, ctx.user1.address);
      const p2 = await ctx.yieldModule.prizePositionOf(1, ctx.user2.address);

      // Distinct addresses is the whole point: PoolTogether measures odds per
      // depositing address, so sharing one would make them a single depositor.
      expect(p1).to.not.equal(hre.ethers.ZeroAddress);
      expect(p2).to.not.equal(hre.ethers.ZeroAddress);
      expect(p1).to.not.equal(p2);

      // Each position holds only its own member's money.
      expect(await ctx.prizeVault.balanceOf(p1)).to.equal(usdt6("1000"));
      expect(await ctx.prizeVault.balanceOf(p2)).to.equal(usdt6("1000"));
    });

    it("pays a prize only to the member who won it", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      await ctx.vaultModule
        .connect(ctx.user1)
        .createVault(vaultParams(ctx, { vaultType: VAULT_TYPE_COMMUNITY }));
      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(1, MODE_PRIZE);
      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user2).joinVault(1);
      await ctx.usdt.connect(ctx.user2).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user2).deposit(1, usdt6("1000"));

      const winner = await ctx.yieldModule.prizePositionOf(1, ctx.user1.address);
      await awardPrize(ctx, winner, eth("3"));

      // user1 won; user2 gets nothing. Under a pooled position this prize would
      // have been split, which is the behaviour this design exists to avoid.
      const [claimable1] = await ctx.yieldModule.claimablePrizes(1, ctx.user1.address);
      const [claimable2] = await ctx.yieldModule.claimablePrizes(1, ctx.user2.address);
      expect(claimable1).to.be.gt(0);
      expect(claimable2).to.equal(0);
    });
  });

  describe("Claiming", function () {
    it("pays the prize in the prize token, never touching the deposit", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      const vaultId = await createPrizeVault(ctx, ctx.user1, usdt6("1000"));
      const position = await ctx.yieldModule.prizePositionOf(vaultId, ctx.user1.address);
      await awardPrize(ctx, position, eth("2"));

      const wethBefore = await ctx.weth.balanceOf(ctx.user1.address);
      const usdtBefore = await ctx.usdt.balanceOf(ctx.user1.address);

      await ctx.yieldModule.claimPrizes(vaultId, ctx.user1.address);

      // 5% fee by default, so the member keeps 1.9 WETH of a 2 WETH prize.
      expect((await ctx.weth.balanceOf(ctx.user1.address)) - wethBefore).to.equal(eth("1.9"));
      expect(await ctx.yieldModule.pendingFees(ctx.weth.target)).to.equal(eth("0.1"));

      // The USDT deposit is untouched — a prize is not a withdrawal.
      expect(await ctx.usdt.balanceOf(ctx.user1.address)).to.equal(usdtBefore);
      expect((await ctx.vaultModule.getVaultMember(vaultId, ctx.user1.address)).balance).to.equal(
        usdt6("1000"),
      );
    });

    it("charges nothing to a member who never wins", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      const vaultId = await createPrizeVault(ctx, ctx.user1, usdt6("1000"));

      const [claimable] = await ctx.yieldModule.claimablePrizes(vaultId, ctx.user1.address);
      expect(claimable).to.equal(0);
      expect(await ctx.yieldModule.claimPrizes.staticCall(vaultId, ctx.user1.address)).to.equal(0);
      expect(await ctx.yieldModule.pendingFees(ctx.weth.target)).to.equal(0);
    });

    it("quotes the claimable amount net of the fee", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      const vaultId = await createPrizeVault(ctx, ctx.user1, usdt6("1000"));
      const position = await ctx.yieldModule.prizePositionOf(vaultId, ctx.user1.address);
      await awardPrize(ctx, position, eth("2"));

      const [amount, token] = await ctx.yieldModule.claimablePrizes(vaultId, ctx.user1.address);
      expect(amount).to.equal(eth("1.9")); // what they will actually receive
      expect(token).to.equal(ctx.weth.target);
    });

    it("caps the prize fee so governance cannot take most of a win", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      await expect(ctx.yieldModule.setPrizeFeeBps(1001)).to.be.revertedWith("Fee above maximum");
      await ctx.yieldModule.setPrizeFeeBps(1000);
      expect(await ctx.yieldModule.prizeFeeBps()).to.equal(1000);
    });

    it("sweeps prize fees to the treasury", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      const vaultId = await createPrizeVault(ctx, ctx.user1, usdt6("1000"));
      const position = await ctx.yieldModule.prizePositionOf(vaultId, ctx.user1.address);
      await awardPrize(ctx, position, eth("2"));
      await ctx.yieldModule.claimPrizes(vaultId, ctx.user1.address);

      const before = await ctx.weth.balanceOf(ctx.treasury.address);
      await ctx.yieldModule.sweepFees(ctx.weth.target);
      expect((await ctx.weth.balanceOf(ctx.treasury.address)) - before).to.equal(eth("0.1"));
    });
  });

  describe("Deposits and withdrawals", function () {
    it("routes a deposit into the member's prize position", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      const vaultId = await createPrizeVault(ctx, ctx.user1, usdt6("1000"));
      const position = await ctx.yieldModule.prizePositionOf(vaultId, ctx.user1.address);

      expect(await ctx.prizeVault.balanceOf(position)).to.equal(usdt6("1000"));
      expect(await ctx.usdt.balanceOf(ctx.vaultModule.target)).to.equal(0);
    });

    it("never grows the deposit — the interest funds prizes instead", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      const vaultId = await createPrizeVault(ctx, ctx.user1, usdt6("1000"));
      const position = await ctx.yieldModule.prizePositionOf(vaultId, ctx.user1.address);

      // Even after a win, the deposited balance is exactly what was put in.
      await awardPrize(ctx, position, eth("2"));
      expect((await ctx.vaultModule.getVaultMember(vaultId, ctx.user1.address)).balance).to.equal(
        usdt6("1000"),
      );
      expect(await ctx.yieldModule.pendingYield(vaultId, ctx.user1.address)).to.equal(0);
    });

    it("redeems from the member's own position on withdrawal", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      const vaultId = await createPrizeVault(ctx, ctx.user1, usdt6("1000"));

      const before = await ctx.usdt.balanceOf(ctx.user1.address);
      await ctx.vaultModule.connect(ctx.user1).withdraw(vaultId, usdt6("400"));

      expect((await ctx.usdt.balanceOf(ctx.user1.address)) - before).to.equal(usdt6("400"));
      const position = await ctx.yieldModule.prizePositionOf(vaultId, ctx.user1.address);
      expect(await ctx.prizeVault.balanceOf(position)).to.equal(usdt6("600"));
    });

    it("keeps one member's withdrawal out of another's position", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      await ctx.vaultModule
        .connect(ctx.user1)
        .createVault(vaultParams(ctx, { vaultType: VAULT_TYPE_COMMUNITY }));
      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(1, MODE_PRIZE);
      await ctx.usdt.connect(ctx.user1).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user1).deposit(1, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user2).joinVault(1);
      await ctx.usdt.connect(ctx.user2).approve(ctx.vaultModule.target, usdt6("1000"));
      await ctx.vaultModule.connect(ctx.user2).deposit(1, usdt6("1000"));

      await ctx.vaultModule.connect(ctx.user1).withdraw(1, usdt6("1000"));

      const p2 = await ctx.yieldModule.prizePositionOf(1, ctx.user2.address);
      expect(await ctx.prizeVault.balanceOf(p2)).to.equal(usdt6("1000"));
      expect((await ctx.vaultModule.getVaultMember(1, ctx.user2.address)).balance).to.equal(
        usdt6("1000"),
      );
    });

    it("returns the whole deposit when the owner switches earning off", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      const vaultId = await createPrizeVault(ctx, ctx.user1, usdt6("1000"));

      await ctx.vaultModule.connect(ctx.user1).setVaultYieldMode(vaultId, MODE_OFF);

      expect(await ctx.usdt.balanceOf(ctx.vaultModule.target)).to.equal(usdt6("1000"));
      expect((await ctx.vaultModule.getVaultMember(vaultId, ctx.user1.address)).balance).to.equal(
        usdt6("1000"),
      );
      await ctx.vaultModule.connect(ctx.user1).withdraw(vaultId, usdt6("1000"));
    });
  });

  describe("Configuration", function () {
    it("refuses a strategy whose prize token is the deposited asset", async function () {
      // Otherwise sweeping "prizes" could drain deposits.
      const ctx = await loadFixture(deployPrizeFixture);
      const MockPrizePoolV5 = await hre.ethers.getContractFactory("MockPrizePoolV5");
      const badPool = await MockPrizePoolV5.deploy(ctx.usdt.target, eth("1"));
      const PoolTogetherStrategy = await hre.ethers.getContractFactory("PoolTogetherStrategy");

      await expect(
        PoolTogetherStrategy.deploy(ctx.prizeVault.target, badPool.target, ctx.yieldModule.target),
      ).to.be.revertedWith("Prize token must differ from asset");
    });

    it("reports the grand prize, and zero when the pool cannot be read", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      expect(await ctx.strategy.grandPrize()).to.equal(eth("3.16"));

      await ctx.prizePool.setReverting(true);
      expect(await ctx.strategy.grandPrize()).to.equal(0);
    });

    it("only lets the module drive a member's position", async function () {
      const ctx = await loadFixture(deployPrizeFixture);
      const vaultId = await createPrizeVault(ctx, ctx.user1, usdt6("1000"));
      const accountId = hre.ethers.solidityPackedKeccak256(
        ["uint256", "address"],
        [vaultId, ctx.user1.address],
      );

      await expect(
        ctx.strategy.connect(ctx.user1).withdrawAll(accountId, ctx.user1.address),
      ).to.be.revertedWith("Not controller");
      await expect(
        ctx.strategy.connect(ctx.user1).sweepPrizes(accountId, ctx.user1.address),
      ).to.be.revertedWith("Not controller");

      // And the position itself answers only to the strategy.
      const position = await hre.ethers.getContractAt(
        "PrizePosition",
        await ctx.yieldModule.prizePositionOf(vaultId, ctx.user1.address),
      );
      await expect(
        position.connect(ctx.user1).withdrawAll(ctx.user1.address),
      ).to.be.revertedWith("Not controller");
    });
  });
});
