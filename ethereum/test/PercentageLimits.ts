import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const DAY = 86400;
const usdt = (n: string) => hre.ethers.parseUnits(n, 6);

/**
 * Percentage limits in TimePeriodLimitsModule.
 *
 * A cap on a volatile asset has to be a fraction of the balance: a fixed
 * amount means nothing once the asset's value moves, and pricing it would put
 * an oracle in the enforcement path — a new trust root in the one place the
 * wallet's promise depends on. The balance is supplied by the caller at check
 * time, so the percentage resolves with no price data at all.
 *
 * This module enforces limits for every existing savings account, so these
 * tests also pin that fixed-amount scopes are completely unaffected.
 */
describe("Percentage spending limits", function () {
  async function deployFixture() {
    const [owner, fixedUser, pctUser] = await hre.ethers.getSigners();

    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);

    const TimePeriodLimitsModule = await hre.ethers.getContractFactory("TimePeriodLimitsModule");
    const limits = await hre.upgrades.deployProxy(TimePeriodLimitsModule, [savingsCore.target]);
    await savingsCore.registerModule(
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TIME_PERIOD_LIMITS")),
      limits.target,
    );

    // A conventional fixed-amount account: 100 USDT a day.
    await limits.connect(fixedUser).setPeriodLimits(
      fixedUser.address, ["Daily"], [usdt("100")], [DAY], [DAY],
    );

    // A vault-style scope: 10% a day (1000 bps).
    await limits.connect(pctUser).setPeriodLimits(
      pctUser.address, ["Daily"], [1000], [DAY], [DAY],
    );

    return { savingsCore, limits, owner, fixedUser, pctUser };
  }

  /** Only a registered module or the core may drive the checks. */
  async function asModule(savingsCore: any, limits: any) {
    const [owner] = await hre.ethers.getSigners();
    await savingsCore.registerModule(
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TEST_CALLER")),
      owner.address,
    );
    return limits.connect(owner);
  }

  it("leaves fixed-amount accounts exactly as they were", async function () {
    const { savingsCore, limits, fixedUser } = await loadFixture(deployFixture);
    const mod = await asModule(savingsCore, limits);

    expect(await limits.limitsArePercentage(fixedUser.address)).to.equal(false);
    await mod.checkAllTimePeriodLimits(fixedUser.address, usdt("100"));
    await expect(
      mod.checkAllTimePeriodLimits(fixedUser.address, 1),
    ).to.be.revertedWith("Exceeds limit");
  });

  it("resolves a percentage cap against the balance it is given", async function () {
    const { savingsCore, limits, pctUser } = await loadFixture(deployFixture);
    const mod = await asModule(savingsCore, limits);
    await mod.setLimitsArePercentage(pctUser.address, true);

    // 10% of 1,000 is 100 — no price data involved anywhere.
    await expect(
      mod.checkAllTimePeriodLimitsFor(pctUser.address, usdt("101"), usdt("1000")),
    ).to.be.revertedWith("Exceeds limit");
    await mod.checkAllTimePeriodLimitsFor(pctUser.address, usdt("100"), usdt("1000"));
  });

  it("scales the same cap with a bigger balance, which is the point", async function () {
    const { savingsCore, limits, pctUser } = await loadFixture(deployFixture);
    const mod = await asModule(savingsCore, limits);
    await mod.setLimitsArePercentage(pctUser.address, true);

    // The identical 10% rule now permits 500 against a 5,000 balance. A fixed
    // amount could not track that without someone rewriting the limit.
    await mod.checkAllTimePeriodLimitsFor(pctUser.address, usdt("500"), usdt("5000"));
  });

  it("still spends the window, so a percentage cap is not a per-call allowance", async function () {
    const { savingsCore, limits, pctUser } = await loadFixture(deployFixture);
    const mod = await asModule(savingsCore, limits);
    await mod.setLimitsArePercentage(pctUser.address, true);

    await mod.checkAllTimePeriodLimitsFor(pctUser.address, usdt("60"), usdt("1000"));
    await expect(
      mod.checkAllTimePeriodLimitsFor(pctUser.address, usdt("41"), usdt("1000")),
    ).to.be.revertedWith("Exceeds limit");
    await mod.checkAllTimePeriodLimitsFor(pctUser.address, usdt("40"), usdt("1000"));
  });

  it("ignores the balance for a fixed scope, so one entry point serves both", async function () {
    const { savingsCore, limits, fixedUser } = await loadFixture(deployFixture);
    const mod = await asModule(savingsCore, limits);

    // A wildly wrong balance changes nothing when the scope is not percentage.
    await mod.checkAllTimePeriodLimitsFor(fixedUser.address, usdt("100"), usdt("999999"));
    await expect(
      mod.checkAllTimePeriodLimitsFor(fixedUser.address, 1, usdt("999999")),
    ).to.be.revertedWith("Exceeds limit");
  });

  it("reports what a stored limit actually permits", async function () {
    const { savingsCore, limits, pctUser, fixedUser } = await loadFixture(deployFixture);
    const mod = await asModule(savingsCore, limits);
    await mod.setLimitsArePercentage(pctUser.address, true);

    expect(await limits.effectiveLimit(pctUser.address, 1000, usdt("2000"))).to.equal(usdt("200"));
    // A fixed scope returns the stored amount untouched.
    expect(await limits.effectiveLimit(fixedUser.address, usdt("100"), usdt("2000"))).to.equal(
      usdt("100"),
    );
  });

  it("lets only an authorized module set the percentage flag", async function () {
    const { limits, pctUser } = await loadFixture(deployFixture);
    await expect(
      limits.connect(pctUser).setLimitsArePercentage(pctUser.address, true),
    ).to.be.revertedWith("Not authorized");
  });
});
