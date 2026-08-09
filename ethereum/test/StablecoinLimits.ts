import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const DAY = 86400;

/**
 * One spending limit across several stablecoins.
 *
 * The main savings account holds more than one stablecoin and applies a single
 * cap to all of them, so the amounts have to share a scale. Limits are kept at
 * 6 decimals and a stablecoin is a dollar, so dividing out each token's own
 * decimals makes them comparable — with no price feed anywhere, because the peg
 * is what carries the meaning.
 *
 * Before this, the cap was compared against raw amounts, so an 18-decimal
 * stablecoin was measured a trillion times too large and could not be withdrawn
 * at all.
 */
describe("Stablecoin spending limits", function () {
  async function fixture() {
    const [owner, user1] = await hre.ethers.getSigners();
    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);

    const deploy = async (n: string) => {
      const f = await hre.ethers.getContractFactory(n);
      const p = await hre.upgrades.deployProxy(f, [savingsCore.target], { initializer: "initialize" });
      await p.waitForDeployment();
      return p;
    };
    const limits = await deploy("TimePeriodLimitsModule");
    const proposals = await deploy("ProposalSystemModule");
    const bypass = await deploy("BypassSystemModule");
    const reg = (id: string, t: any) =>
      savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(id)), t);
    await reg("TIME_PERIOD_LIMITS", limits.target);
    await reg("PROPOSAL_SYSTEM", proposals.target);
    await reg("BYPASS_SYSTEM", bypass.target);
    await savingsCore.setupModuleCrossReferences();

    // A 6-decimal stable and an 18-decimal one, as on Optimism.
    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    const MockWETH = await hre.ethers.getContractFactory("MockWETH"); // 18dp ERC20
    const dai = await MockWETH.deploy();

    await usdt.transfer(user1.address, hre.ethers.parseUnits("10000", 6));
    await dai.transfer(user1.address, hre.ethers.parseEther("10000"));

    // "$500 a day", stored at 6 decimals like the app writes it.
    await limits.connect(user1).setPeriodLimits(
      user1.address, ["Daily"], [hre.ethers.parseUnits("500", 6)], [DAY], [DAY],
    );

    await usdt.connect(user1).approve(savingsCore.target, hre.ethers.parseUnits("5000", 6));
    await savingsCore.connect(user1)["deposit(address,uint256)"](usdt.target, hre.ethers.parseUnits("5000", 6));
    await dai.connect(user1).approve(savingsCore.target, hre.ethers.parseEther("5000"));
    await savingsCore.connect(user1)["deposit(address,uint256)"](dai.target, hre.ethers.parseEther("5000"));

    return { savingsCore, limits, usdt, dai, user1 };
  }

  it("lets an 18-decimal stablecoin be withdrawn at all", async function () {
    // The bug: 100 DAI measured as 100e18 against a 500e6 cap — a trillion
    // times over — so DAI was effectively frozen in the account.
    const { savingsCore, dai, user1 } = await loadFixture(fixture);
    await savingsCore.connect(user1).withdraw(hre.ethers.parseEther("100"), dai.target);
    expect(await dai.balanceOf(user1.address)).to.equal(hre.ethers.parseEther("5100"));
  });

  it("applies one cap across both coins, not one each", async function () {
    const { savingsCore, usdt, dai, user1 } = await loadFixture(fixture);
    await savingsCore.connect(user1).withdraw(hre.ethers.parseUnits("300", 6), usdt.target);

    // $300 of the $500 is gone, so $250 of DAI must not fit.
    await expect(
      savingsCore.connect(user1).withdraw(hre.ethers.parseEther("250"), dai.target),
    ).to.be.revertedWith("Exceeds limit");
    await savingsCore.connect(user1).withdraw(hre.ethers.parseEther("200"), dai.target);
  });

  it("still stops an 18-decimal stablecoin going over the cap", async function () {
    const { savingsCore, dai, user1 } = await loadFixture(fixture);
    await expect(
      savingsCore.connect(user1).withdraw(hre.ethers.parseEther("501"), dai.target),
    ).to.be.revertedWith("Exceeds limit");
  });

});
