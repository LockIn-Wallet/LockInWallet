import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const KIND_COIN = 0;
const KIND_STABLES = 1;
const PERSONAL = 0;
const COMMUNITY = 1;
const DAY = 86400;

const usd = (n: string) => hre.ethers.parseUnits(n, 6);

/**
 * One savings primitive: the main wallet is a vault, and so is a pot for a
 * single coin. What differs is only what a vault holds, because that is what
 * decides how its limits can honestly be measured.
 */
describe("SavingsVaultModule", function () {
  async function fixture() {
    const [owner, user1, user2] = await hre.ethers.getSigners();
    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);

    const deploy = async (n: string) => {
      const f = await hre.ethers.getContractFactory(n);
      const p = await hre.upgrades.deployProxy(f, [savingsCore.target], { initializer: "initialize" });
      await p.waitForDeployment();
      return p;
    };
    const vaults = await deploy("SavingsVaultModule");
    const limits = await deploy("TimePeriodLimitsModule");
    const proposals = await deploy("ProposalSystemModule");
    const bypass = await deploy("BypassSystemModule");
    const reg = (id: string, t: any) =>
      savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(id)), t);
    await reg("SAVINGS_VAULTS", vaults.target);
    await reg("TIME_PERIOD_LIMITS", limits.target);
    await reg("PROPOSAL_SYSTEM", proposals.target);
    await reg("BYPASS_SYSTEM", bypass.target);
    await savingsCore.setupModuleCrossReferences();
    await savingsCore.setDevelopmentMode(false);

    // A 6-decimal stable and an 18-decimal one, as on Optimism.
    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    const MockWETH = await hre.ethers.getContractFactory("MockWETH"); // 18dp ERC20
    const dai = await MockWETH.deploy();
    for (const u of [user1, user2]) {
      await usdt.transfer(u.address, usd("100000"));
      await dai.transfer(u.address, hre.ethers.parseEther("100000"));
    }
    return { savingsCore, vaults, limits, proposals, usdt, dai, owner, user1, user2 };
  }

  /** The main wallet: several pegged assets under one dollar cap. */
  async function makeStablesVault(ctx: any, signer: any, dailyUsd = "500") {
    await ctx.vaults.connect(signer).createVault(
      "Savings", KIND_STABLES, PERSONAL,
      [ctx.usdt.target, ctx.dai.target],
      false, 2000,
      ["Daily"], [usd(dailyUsd)], [DAY], [DAY],
    );
    return ctx.vaults.getVaultCount();
  }

  async function fund(ctx: any, signer: any, vaultId: bigint) {
    await ctx.usdt.connect(signer).approve(ctx.vaults.target, usd("5000"));
    await ctx.vaults.connect(signer).deposit(vaultId, ctx.usdt.target, usd("5000"));
    await ctx.dai.connect(signer).approve(ctx.vaults.target, hre.ethers.parseEther("5000"));
    await ctx.vaults.connect(signer).deposit(vaultId, ctx.dai.target, hre.ethers.parseEther("5000"));
  }

  describe("A stables vault is the main wallet", function () {
    it("holds several pegged assets at once", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeStablesVault(ctx, ctx.user1);
      await fund(ctx, ctx.user1, id);

      expect(await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.usdt.target)).to.equal(usd("5000"));
      expect(await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.dai.target)).to.equal(
        hre.ethers.parseEther("5000"),
      );
      // $10,000 across two assets with different decimals, no price feed.
      expect(await ctx.vaults.dollarBalanceOf(id, ctx.user1.address)).to.equal(usd("10000"));
    });

    it("applies ONE dollar cap across them, not one per asset", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeStablesVault(ctx, ctx.user1);
      await fund(ctx, ctx.user1, id);

      await ctx.vaults.connect(ctx.user1).withdraw(id, ctx.usdt.target, usd("300"), ctx.user1.address);
      // $300 of the $500 is spent, so $250 of DAI must not fit.
      await expect(
        ctx.vaults.connect(ctx.user1).withdraw(
          id, ctx.dai.target, hre.ethers.parseEther("250"), ctx.user1.address,
        ),
      ).to.be.revertedWith("Exceeds limit");
      await ctx.vaults.connect(ctx.user1).withdraw(
        id, ctx.dai.target, hre.ethers.parseEther("200"), ctx.user1.address,
      );
    });

    it("measures an 18-decimal stable correctly, which the old account could not", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeStablesVault(ctx, ctx.user1);
      await fund(ctx, ctx.user1, id);

      await ctx.vaults.connect(ctx.user1).withdraw(
        id, ctx.dai.target, hre.ethers.parseEther("500"), ctx.user1.address,
      );
      await expect(
        ctx.vaults.connect(ctx.user1).withdraw(id, ctx.usdt.target, usd("1"), ctx.user1.address),
      ).to.be.revertedWith("Exceeds limit");
    });

    it("refuses a token it was not created to hold", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeStablesVault(ctx, ctx.user1);
      const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
      const other = await MockUSDT.deploy();
      await other.approve(ctx.vaults.target, usd("100"));
      await expect(
        ctx.vaults.deposit(id, other.target, usd("100")),
      ).to.be.revertedWith("Not a vault member");
    });

    it("rejects percentage limits, which would need the assets priced", async function () {
      const ctx = await loadFixture(fixture);
      await expect(
        ctx.vaults.connect(ctx.user1).createVault(
          "Bad", KIND_STABLES, PERSONAL, [ctx.usdt.target, ctx.dai.target],
          true, 2000, ["Daily"], [1000], [DAY], [DAY],
        ),
      ).to.be.revertedWith("Stables vault uses dollar limits");
    });
  });

  describe("A coin vault is the same primitive, one asset", function () {
    it("takes exactly one token", async function () {
      const ctx = await loadFixture(fixture);
      await expect(
        ctx.vaults.connect(ctx.user1).createVault(
          "Two coins", KIND_COIN, PERSONAL, [ctx.usdt.target, ctx.dai.target],
          false, 2000, ["Daily"], [usd("100")], [DAY], [DAY],
        ),
      ).to.be.revertedWith("Coin vault takes one token");
    });

    it("caps a share of the balance, needing no price at all", async function () {
      const ctx = await loadFixture(fixture);
      // 10% a day of whatever ETH is in here.
      await ctx.vaults.connect(ctx.user1).createVault(
        "ETH", KIND_COIN, PERSONAL, [hre.ethers.ZeroAddress],
        true, 2000, ["Daily"], [1000], [DAY], [DAY],
      );
      const id = await ctx.vaults.getVaultCount();
      await ctx.vaults.connect(ctx.user1).deposit(id, hre.ethers.ZeroAddress, hre.ethers.parseEther("10"), {
        value: hre.ethers.parseEther("10"),
      });

      await expect(
        ctx.vaults.connect(ctx.user1).withdraw(
          id, hre.ethers.ZeroAddress, hre.ethers.parseEther("1.1"), ctx.user1.address,
        ),
      ).to.be.revertedWith("Exceeds limit");
      await ctx.vaults.connect(ctx.user1).withdraw(
        id, hre.ethers.ZeroAddress, hre.ethers.parseEther("1"), ctx.user1.address,
      );
    });

    it("holds native coin, which the old main account had to refuse", async function () {
      const ctx = await loadFixture(fixture);
      await ctx.vaults.connect(ctx.user1).createVault(
        "ETH", KIND_COIN, PERSONAL, [hre.ethers.ZeroAddress],
        false, 2000, ["Daily"], [hre.ethers.parseEther("1")], [DAY], [DAY],
      );
      const id = await ctx.vaults.getVaultCount();
      await ctx.vaults.connect(ctx.user1).deposit(id, hre.ethers.ZeroAddress, hre.ethers.parseEther("5"), {
        value: hre.ethers.parseEther("5"),
      });
      expect(await ctx.vaults.balanceOf(id, ctx.user1.address, hre.ethers.ZeroAddress)).to.equal(
        hre.ethers.parseEther("5"),
      );
    });
  });

  describe("Rules come from the savings account's own modules", function () {
    it("stores a vault's limits under its own scope, locked in at creation", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeStablesVault(ctx, ctx.user1);
      const scope = await ctx.vaults.vaultScopeOf(id, ctx.user1.address);

      expect(await ctx.limits.findPeriodLimit(scope, "Daily")).to.equal(usd("500"));
      expect(scope).to.not.equal(ctx.user1.address);
      // Committed at creation, so nothing can be rewritten on the spot.
      await expect(
        ctx.limits.connect(ctx.user1).setPeriodLimit(scope, "Daily", usd("9999"), DAY, DAY),
      ).to.be.revertedWith("Not authorized");
    });

    it("fails closed when the limits module is missing", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeStablesVault(ctx, ctx.user1);
      await fund(ctx, ctx.user1, id);
      await ctx.savingsCore.unregisterModule(
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TIME_PERIOD_LIMITS")),
      );
      await expect(
        ctx.vaults.connect(ctx.user1).withdraw(id, ctx.usdt.target, usd("1"), ctx.user1.address),
      ).to.be.revertedWith("Limits module not registered");
    });

    it("refuses a destination the member has not saved", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeStablesVault(ctx, ctx.user1);
      await fund(ctx, ctx.user1, id);
      await expect(
        ctx.vaults.connect(ctx.user1).withdraw(id, ctx.usdt.target, usd("10"), ctx.user2.address),
      ).to.be.revertedWith("Withdrawal address not approved");
    });
  });

  /**
   * The penalty is what keeps the limits honest. They can be escaped, but only
   * at a price the member agreed to when the vault was created — and in a
   * community vault that price goes to the people who stayed.
   */
  describe("Leaving early costs what the vault said it would", function () {
    async function makeCoinVault(ctx: any, signer: any, type = PERSONAL) {
      await ctx.vaults.connect(signer).createVault(
        "Pot", KIND_COIN, type, [ctx.usdt.target],
        false, 2000, ["Daily"], [usd("100")], [DAY], [DAY],
      );
      return ctx.vaults.getVaultCount();
    }
    const put = async (ctx: any, signer: any, id: bigint, amount: bigint) => {
      await ctx.usdt.connect(signer).approve(ctx.vaults.target, amount);
      await ctx.vaults.connect(signer).deposit(id, ctx.usdt.target, amount);
    };

    it("lets a member exceed their limit by paying the penalty", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeCoinVault(ctx, ctx.user1);
      await put(ctx, ctx.user1, id, usd("1000"));

      // The ordinary path refuses: the daily cap is 100.
      await expect(
        ctx.vaults.connect(ctx.user1).withdraw(id, ctx.usdt.target, usd("500"), ctx.user1.address),
      ).to.be.reverted;

      const before = await ctx.usdt.balanceOf(ctx.user1.address);
      await ctx.vaults.connect(ctx.user1)
        .withdrawWithPenalty(id, ctx.usdt.target, usd("500"), ctx.user1.address);

      // 20% of 500 stays behind; the rest arrives.
      expect(await ctx.usdt.balanceOf(ctx.user1.address)).to.equal(before + usd("400"));
      expect(await ctx.vaults.balanceOf(id, ctx.user1.address, ctx.usdt.target)).to.equal(usd("500"));
    });

    it("sends a personal vault's penalty to the treasury, having nobody to share with", async function () {
      const ctx = await loadFixture(fixture);
      await ctx.vaults.setTreasury(ctx.user2.address);
      const id = await makeCoinVault(ctx, ctx.user1);
      await put(ctx, ctx.user1, id, usd("1000"));

      const before = await ctx.usdt.balanceOf(ctx.user2.address);
      await ctx.vaults.connect(ctx.user1)
        .withdrawWithPenalty(id, ctx.usdt.target, usd("500"), ctx.user1.address);
      expect(await ctx.usdt.balanceOf(ctx.user2.address)).to.equal(before + usd("100"));
    });

    it("shares a community penalty with the members who stayed", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeCoinVault(ctx, ctx.user1, COMMUNITY);
      await ctx.vaults.connect(ctx.user2).joinVault(id);
      await put(ctx, ctx.user1, id, usd("1000"));
      await put(ctx, ctx.user2, id, usd("1000"));

      await ctx.vaults.connect(ctx.user1)
        .withdrawWithPenalty(id, ctx.usdt.target, usd("500"), ctx.user1.address);

      // 100 spread over the 1500 still in the vault: user2 holds 1000 of it.
      expect(await ctx.vaults.pendingPenaltyRewards(id, ctx.usdt.target, ctx.user2.address))
        .to.be.closeTo(usd("66.66"), usd("0.01"));
      const before = await ctx.usdt.balanceOf(ctx.user2.address);
      await ctx.vaults.connect(ctx.user2).claimPenaltyRewards(id, ctx.usdt.target);
      expect(await ctx.usdt.balanceOf(ctx.user2.address)).to.be.closeTo(before + usd("66.66"), usd("0.01"));
    });

    it("excludes the withdrawer from the penalty they just paid", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeCoinVault(ctx, ctx.user1, COMMUNITY);
      await ctx.vaults.connect(ctx.user2).joinVault(id);
      await put(ctx, ctx.user1, id, usd("1000"));
      await put(ctx, ctx.user2, id, usd("1000"));

      await ctx.vaults.connect(ctx.user1)
        .withdrawWithPenalty(id, ctx.usdt.target, usd("500"), ctx.user1.address);

      // They still hold 500 in the vault, but none of their own penalty.
      expect(await ctx.vaults.pendingPenaltyRewards(id, ctx.usdt.target, ctx.user1.address)).to.equal(0);
    });

    it("does not pay a member for penalties charged before they arrived", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeCoinVault(ctx, ctx.user1, COMMUNITY);
      await ctx.vaults.connect(ctx.user2).joinVault(id);
      await put(ctx, ctx.user1, id, usd("1000"));
      await put(ctx, ctx.user2, id, usd("1000"));
      await ctx.vaults.connect(ctx.user1)
        .withdrawWithPenalty(id, ctx.usdt.target, usd("500"), ctx.user1.address);

      // A third member joins only now and deposits into a moved accumulator.
      await ctx.vaults.connect(ctx.owner).joinVault(id);
      await ctx.usdt.connect(ctx.owner).approve(ctx.vaults.target, usd("1000"));
      await ctx.vaults.connect(ctx.owner).deposit(id, ctx.usdt.target, usd("1000"));

      expect(await ctx.vaults.pendingPenaltyRewards(id, ctx.usdt.target, ctx.owner.address)).to.equal(0);
    });

    it("keeps each coin's penalties in its own pot", async function () {
      const ctx = await loadFixture(fixture);
      await ctx.vaults.connect(ctx.user1).createVault(
        "Club", KIND_STABLES, COMMUNITY, [ctx.usdt.target, ctx.dai.target],
        false, 2000, ["Daily"], [usd("100")], [DAY], [DAY],
      );
      const id = await ctx.vaults.getVaultCount();
      await ctx.vaults.connect(ctx.user2).joinVault(id);
      await fund(ctx, ctx.user1, id);
      await fund(ctx, ctx.user2, id);

      await ctx.vaults.connect(ctx.user1)
        .withdrawWithPenalty(id, ctx.usdt.target, usd("1000"), ctx.user1.address);

      // The USDT pot moved; the DAI pot cannot have, because nobody paid into
      // it — paying a USDT penalty out of DAI would take from the wrong people.
      expect(await ctx.vaults.pendingPenaltyRewards(id, ctx.usdt.target, ctx.user2.address))
        .to.be.greaterThan(0);
      expect(await ctx.vaults.pendingPenaltyRewards(id, ctx.dai.target, ctx.user2.address)).to.equal(0);
    });

    it("refuses a destination the member has not saved", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeCoinVault(ctx, ctx.user1);
      await put(ctx, ctx.user1, id, usd("1000"));
      await expect(
        ctx.vaults.connect(ctx.user1)
          .withdrawWithPenalty(id, ctx.usdt.target, usd("500"), ctx.user2.address),
      ).to.be.revertedWith("Withdrawal address not approved");
    });

    it("has nothing to claim when no penalty was ever paid", async function () {
      const ctx = await loadFixture(fixture);
      const id = await makeCoinVault(ctx, ctx.user1);
      await put(ctx, ctx.user1, id, usd("1000"));
      await expect(
        ctx.vaults.connect(ctx.user1).claimPenaltyRewards(id, ctx.usdt.target),
      ).to.be.revertedWith("Nothing to claim");
    });
  });
});
