import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;
const MAX_DELAY = 90 * DAY;

/**
 * Per-period unlock delays: every spending period carries its own wait, which
 * governs both bypassing that limit and changing it. Deployments start in
 * development mode (10s/30s waits), so these tests switch it off to exercise
 * the real durations.
 */
describe("Per-period unlock delays", function () {
  async function deployFixture() {
    const [owner, user1, user2] = await hre.ethers.getSigners();

    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);
    await savingsCore.waitForDeployment();

    const deployModule = async (name: string) => {
      const factory = await hre.ethers.getContractFactory(name);
      const proxy = await hre.upgrades.deployProxy(factory, [savingsCore.target], {
        initializer: "initialize",
      });
      await proxy.waitForDeployment();
      return proxy;
    };

    const timeLimitsModule = await deployModule("TimePeriodLimitsModule");
    const proposalModule = await deployModule("ProposalSystemModule");
    const bypassModule = await deployModule("BypassSystemModule");

    const register = async (id: string, target: any) =>
      savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(id)), target);

    await register("TIME_PERIOD_LIMITS", timeLimitsModule.target);
    await register("PROPOSAL_SYSTEM", proposalModule.target);
    await register("BYPASS_SYSTEM", bypassModule.target);
    await savingsCore.setupModuleCrossReferences();

    // Real timelocks — development mode collapses every wait to seconds
    await savingsCore.setDevelopmentMode(false);

    const depositAmount = hre.ethers.parseEther("10.0");
    await savingsCore
      .connect(user1)
      ["deposit(address,uint256)"](hre.ethers.ZeroAddress, depositAmount, { value: depositAmount });

    return { savingsCore, timeLimitsModule, proposalModule, bypassModule, owner, user1, user2 };
  }

  /** Timestamp of the block a transaction landed in. */
  async function blockTimeOf(tx: any) {
    const receipt = await tx.wait();
    const block = await hre.ethers.provider.getBlock(receipt.blockNumber);
    return block!.timestamp;
  }

  /**
   * Request/proposal ids are derived from block.timestamp, so a staticCall
   * preview never matches the id the real transaction produces. Read them back
   * from the module's own enumeration instead.
   */
  async function latestBypassRequest(bypassModule: any, user: string) {
    const [ids, , , , executeAfters] = await bypassModule.getUserActiveBypassRequests(user);
    return { id: ids[ids.length - 1], executeAfter: executeAfters[executeAfters.length - 1] };
  }

  async function latestProposal(proposalModule: any, user: string) {
    const [ids, , , executeAfters] = await proposalModule.getUserPendingProposals(user);
    return { id: ids[ids.length - 1], executeAfter: executeAfters[executeAfters.length - 1] };
  }

  /** Hourly through yearly, each with the default wait for its period. */
  function fullPeriodSet() {
    const amount = (value: string) => hre.ethers.parseUnits(value, 6);
    return {
      names: ["Hourly", "Daily", "Weekly", "Monthly", "Yearly"],
      limits: [amount("0.5"), amount("1.0"), amount("7.0"), amount("30.0"), amount("365.0")],
      durations: [HOUR, DAY, WEEK, MONTH, YEAR],
      unlockDelays: [DAY, DAY, WEEK, MONTH, MONTH],
    };
  }

  describe("Setting periods", function () {
    it("stores hourly through yearly limits with their own unlock delays", async function () {
      const { timeLimitsModule, user1 } = await loadFixture(deployFixture);
      const { names, limits, durations, unlockDelays } = fullPeriodSet();

      await timeLimitsModule
        .connect(user1)
        .setPeriodLimits(user1.address, names, limits, durations, unlockDelays);

      const result = await timeLimitsModule.getUserSpendingLimits(user1.address);
      expect(result[0]).to.deep.equal(names);
      expect(result[1]).to.deep.equal(limits);
      expect(result[4]).to.deep.equal(durations.map(BigInt));
      expect(result[6]).to.deep.equal(unlockDelays.map(BigInt));

      for (let i = 0; i < names.length; i++) {
        expect(await timeLimitsModule.getUnlockDelay(user1.address, names[i])).to.equal(
          unlockDelays[i],
        );
      }
    });

    it("gives the daily/weekly/monthly wrapper its default waits", async function () {
      const { timeLimitsModule, user1 } = await loadFixture(deployFixture);

      await timeLimitsModule
        .connect(user1)
        .setCommonPeriodLimits(
          user1.address,
          hre.ethers.parseUnits("1.0", 6),
          hre.ethers.parseUnits("7.0", 6),
          hre.ethers.parseUnits("30.0", 6),
        );

      expect(await timeLimitsModule.getUnlockDelay(user1.address, "Daily")).to.equal(DAY);
      expect(await timeLimitsModule.getUnlockDelay(user1.address, "Weekly")).to.equal(WEEK);
      expect(await timeLimitsModule.getUnlockDelay(user1.address, "Monthly")).to.equal(MONTH);
    });

    it("reads back 24 hours for a period that never had a delay set", async function () {
      const { timeLimitsModule, user1 } = await loadFixture(deployFixture);

      // A period carrying no stored delay — the state every limit created
      // before this upgrade is in
      expect(await timeLimitsModule.getUnlockDelay(user1.address, "Quarterly")).to.equal(DAY);
      expect(await timeLimitsModule.DEFAULT_UNLOCK_DELAY()).to.equal(DAY);
    });

    it("rejects a shorter period allowing more spending than a longer one", async function () {
      const { timeLimitsModule, user1 } = await loadFixture(deployFixture);

      await expect(
        timeLimitsModule
          .connect(user1)
          .setPeriodLimits(
            user1.address,
            ["Monthly", "Yearly"],
            [hre.ethers.parseUnits("500.0", 6), hre.ethers.parseUnits("100.0", 6)],
            [MONTH, YEAR],
            [MONTH, MONTH],
          ),
      ).to.be.revertedWith("Shorter period exceeds longer period");
    });

    it("rejects unlock delays outside the accepted bounds", async function () {
      const { timeLimitsModule, user1 } = await loadFixture(deployFixture);
      const limit = hre.ethers.parseUnits("1.0", 6);

      const setDelay = (delay: number) =>
        timeLimitsModule
          .connect(user1)
          .setPeriodLimits(user1.address, ["Daily"], [limit], [DAY], [delay]);

      await expect(setDelay(HOUR - 1)).to.be.revertedWith("Invalid unlock delay");
      await expect(setDelay(MAX_DELAY + 1)).to.be.revertedWith("Invalid unlock delay");
      await expect(setDelay(MAX_DELAY)).not.to.be.reverted;
      await expect(setDelay(HOUR)).not.to.be.reverted;
    });

    it("rejects mismatched array lengths", async function () {
      const { timeLimitsModule, user1 } = await loadFixture(deployFixture);

      await expect(
        timeLimitsModule
          .connect(user1)
          .setPeriodLimits(
            user1.address,
            ["Daily", "Weekly"],
            [hre.ethers.parseUnits("1.0", 6)],
            [DAY, WEEK],
            [DAY, WEEK],
          ),
      ).to.be.revertedWith("Length mismatch");
    });
  });

  describe("Committing setup", function () {
    it("commits a full hourly-to-yearly set in one transaction", async function () {
      const { timeLimitsModule, proposalModule, user1 } = await loadFixture(deployFixture);
      const { names, limits, durations, unlockDelays } = fullPeriodSet();

      await proposalModule
        .connect(user1)
        .commitSetupWithPeriods(names, limits, durations, unlockDelays, hre.ethers.ZeroAddress);

      expect(await proposalModule.isSetupCommitted(user1.address)).to.be.true;
      expect(await timeLimitsModule.findPeriodLimit(user1.address, "Yearly")).to.equal(limits[4]);
      expect(await timeLimitsModule.getUnlockDelay(user1.address, "Yearly")).to.equal(MONTH);
    });

    it("forces the default wait on a period added after lock-in", async function () {
      const { proposalModule, timeLimitsModule, user1 } = await loadFixture(deployFixture);
      const { names, limits, durations, unlockDelays } = fullPeriodSet();

      await proposalModule
        .connect(user1)
        .commitSetupWithPeriods(names, limits, durations, unlockDelays, hre.ethers.ZeroAddress);

      // Anyone holding the key could otherwise add a dust-sized limit with a
      // year-long wait and freeze the wallet for that year
      await timeLimitsModule
        .connect(user1)
        .setPeriodLimit(user1.address, "Quarterly", 1, 90 * DAY, YEAR);

      expect(await timeLimitsModule.getUnlockDelay(user1.address, "Quarterly")).to.equal(DAY);
    });

    it("still honours the chosen wait for periods set before lock-in", async function () {
      const { timeLimitsModule, user1 } = await loadFixture(deployFixture);

      await timeLimitsModule
        .connect(user1)
        .setPeriodLimits(
          user1.address,
          ["Monthly"],
          [hre.ethers.parseUnits("1000", 6)],
          [MONTH],
          [90 * DAY],
        );

      expect(await timeLimitsModule.getUnlockDelay(user1.address, "Monthly")).to.equal(90 * DAY);
    });

    it("caps an added-limit freeze at the default wait, not the attacker's choice", async function () {
      const { proposalModule, timeLimitsModule, user1 } = await loadFixture(deployFixture);

      await proposalModule
        .connect(user1)
        .commitSetupWithPeriods(
          ["Daily"],
          [hre.ethers.parseUnits("100", 6)],
          [DAY],
          [DAY],
          hre.ethers.ZeroAddress,
        );

      // The freeze: a 1-unit hourly cap blocks every meaningful withdrawal
      await timeLimitsModule
        .connect(user1)
        .setPeriodLimit(user1.address, "Hourly", 1, HOUR, YEAR);

      // Undoing it waits a day, not the year the caller asked for
      const tx = await proposalModule
        .connect(user1)
        .proposeLimitChange(user1.address, "Hourly", hre.ethers.parseUnits("100", 6));
      const proposedAt = await blockTimeOf(tx);
      const { id, executeAfter } = await latestProposal(proposalModule, user1.address);
      expect(executeAfter).to.equal(BigInt(proposedAt + DAY));

      await time.increase(DAY + 60);
      await expect(proposalModule.connect(user1).executeLimitProposal(user1.address, id)).not.to.be
        .reverted;
      expect(await timeLimitsModule.findPeriodLimit(user1.address, "Hourly")).to.equal(
        hre.ethers.parseUnits("100", 6),
      );
    });

    it("blocks rewriting periods once setup is committed", async function () {
      const { proposalModule, timeLimitsModule, user1 } = await loadFixture(deployFixture);
      const { names, limits, durations, unlockDelays } = fullPeriodSet();

      await proposalModule
        .connect(user1)
        .commitSetupWithPeriods(names, limits, durations, unlockDelays, hre.ethers.ZeroAddress);

      await expect(
        timeLimitsModule
          .connect(user1)
          .setPeriodLimits(user1.address, names, limits, durations, unlockDelays),
      ).to.be.revertedWith("Setup committed - use proposals");
    });
  });

  describe("Bypass waits", function () {
    async function committedFixture() {
      const ctx = await loadFixture(deployFixture);
      const { names, limits, durations, unlockDelays } = fullPeriodSet();
      await ctx.proposalModule
        .connect(ctx.user1)
        .commitSetupWithPeriods(names, limits, durations, unlockDelays, hre.ethers.ZeroAddress);
      return ctx;
    }

    it("waits 24 hours to bypass a daily limit and a week for a weekly one", async function () {
      const { bypassModule, user1 } = await committedFixture();
      const amount = hre.ethers.parseUnits("0.2", 6);

      for (const [period, expectedWait] of [
        ["Hourly", DAY],
        ["Daily", DAY],
        ["Weekly", WEEK],
        ["Monthly", MONTH],
        ["Yearly", MONTH],
      ] as const) {
        const tx = await bypassModule
          .connect(user1)
          .requestLimitBypass(user1.address, amount, period, hre.ethers.ZeroAddress);
        const requestedAt = await blockTimeOf(tx);

        const { executeAfter } = await latestBypassRequest(bypassModule, user1.address);
        expect(executeAfter, `${period} bypass wait`).to.equal(BigInt(requestedAt + expectedWait));
      }
    });

    it("keeps a weekly bypass locked until the full week has passed", async function () {
      const { bypassModule, user1 } = await committedFixture();
      const amount = hre.ethers.parseUnits("0.2", 6);

      await bypassModule
        .connect(user1)
        .requestLimitBypass(user1.address, amount, "Weekly", hre.ethers.ZeroAddress);
      const { id } = await latestBypassRequest(bypassModule, user1.address);

      // A day in — enough for the old fixed 24-hour wait, not for this one
      await time.increase(DAY + 60);
      expect((await bypassModule.canExecuteBypass(user1.address, id))[0]).to.be.false;

      await time.increase(WEEK);
      expect((await bypassModule.canExecuteBypass(user1.address, id))[0]).to.be.true;
    });
  });

  describe("Limit-change waits", function () {
    async function committedFixture() {
      const ctx = await loadFixture(deployFixture);
      const { names, limits, durations, unlockDelays } = fullPeriodSet();
      await ctx.proposalModule
        .connect(ctx.user1)
        .commitSetupWithPeriods(names, limits, durations, unlockDelays, hre.ethers.ZeroAddress);
      return ctx;
    }

    it("times a limit change by the period's own wait", async function () {
      const { proposalModule, user1 } = await committedFixture();

      const tx = await proposalModule
        .connect(user1)
        .proposeLimitChange(user1.address, "Weekly", hre.ethers.parseUnits("8.0", 6));
      const proposedAt = await blockTimeOf(tx);

      const { id, executeAfter } = await latestProposal(proposalModule, user1.address);
      expect(executeAfter).to.equal(BigInt(proposedAt + WEEK));

      await time.increase(DAY + 60);
      await expect(
        proposalModule.connect(user1).executeLimitProposal(user1.address, id),
      ).to.be.revertedWith("Still in timelock");

      await time.increase(WEEK);
      await expect(proposalModule.connect(user1).executeLimitProposal(user1.address, id)).not.to.be
        .reverted;
    });
  });

  describe("Changing the wait itself", function () {
    async function committedFixture() {
      const ctx = await loadFixture(deployFixture);
      const { names, limits, durations, unlockDelays } = fullPeriodSet();
      await ctx.proposalModule
        .connect(ctx.user1)
        .commitSetupWithPeriods(names, limits, durations, unlockDelays, hre.ethers.ZeroAddress);
      return ctx;
    }

    it("makes a shorter wait serve out the current, longer one first", async function () {
      const { proposalModule, timeLimitsModule, user1 } = await committedFixture();

      await proposalModule.connect(user1).proposeUnlockDelayChange(user1.address, "Weekly", DAY);
      const { id } = await latestProposal(proposalModule, user1.address);

      // Still the old wait until the proposal executes
      expect(await timeLimitsModule.getUnlockDelay(user1.address, "Weekly")).to.equal(WEEK);

      await time.increase(DAY + 60);
      await expect(
        proposalModule.connect(user1).executeLimitProposal(user1.address, id),
      ).to.be.revertedWith("Still in timelock");

      await time.increase(WEEK);
      await proposalModule.connect(user1).executeLimitProposal(user1.address, id);
      expect(await timeLimitsModule.getUnlockDelay(user1.address, "Weekly")).to.equal(DAY);
    });

    it("makes a longer wait serve out the current one too", async function () {
      const { proposalModule, timeLimitsModule, user1 } = await committedFixture();

      await proposalModule.connect(user1).proposeUnlockDelayChange(user1.address, "Daily", WEEK);
      const { id } = await latestProposal(proposalModule, user1.address);

      await expect(
        proposalModule.connect(user1).executeLimitProposal(user1.address, id),
      ).to.be.revertedWith("Still in timelock");

      await time.increase(DAY + 60);
      await proposalModule.connect(user1).executeLimitProposal(user1.address, id);
      expect(await timeLimitsModule.getUnlockDelay(user1.address, "Daily")).to.equal(WEEK);
    });

    it("applies the new wait to the next bypass request", async function () {
      const { proposalModule, bypassModule, user1 } = await committedFixture();

      await proposalModule.connect(user1).proposeUnlockDelayChange(user1.address, "Weekly", DAY);
      const { id } = await latestProposal(proposalModule, user1.address);
      await time.increase(WEEK + 60);
      await proposalModule.connect(user1).executeLimitProposal(user1.address, id);

      const amount = hre.ethers.parseUnits("0.2", 6);
      const tx = await bypassModule
        .connect(user1)
        .requestLimitBypass(user1.address, amount, "Weekly", hre.ethers.ZeroAddress);
      const requestedAt = await blockTimeOf(tx);

      const { executeAfter } = await latestBypassRequest(bypassModule, user1.address);
      expect(executeAfter).to.equal(BigInt(requestedAt + DAY));
    });

    it("rejects an out-of-range or unchanged wait up front", async function () {
      const { proposalModule, user1 } = await committedFixture();

      await expect(
        proposalModule.connect(user1).proposeUnlockDelayChange(user1.address, "Daily", HOUR - 1),
      ).to.be.revertedWith("Invalid unlock delay");
      await expect(
        proposalModule.connect(user1).proposeUnlockDelayChange(user1.address, "Daily", MAX_DELAY + 1),
      ).to.be.revertedWith("Invalid unlock delay");
      await expect(
        proposalModule.connect(user1).proposeUnlockDelayChange(user1.address, "Daily", DAY),
      ).to.be.revertedWith("Unlock delay unchanged");
    });

    it("rejects a wait change for a period that does not exist", async function () {
      const { proposalModule, user1 } = await committedFixture();

      await expect(
        proposalModule.connect(user1).proposeUnlockDelayChange(user1.address, "Quarterly", WEEK),
      ).to.be.revertedWith("Period not found or inactive");
    });

    it("does not let another account retune your wait", async function () {
      const { proposalModule, timeLimitsModule, user1, user2 } = await committedFixture();

      await expect(
        proposalModule.connect(user2).proposeUnlockDelayChange(user1.address, "Weekly", DAY),
      ).to.be.revertedWith("Not authorized");

      // The limits module only accepts the change from a registered module
      await expect(
        timeLimitsModule.connect(user2).setUnlockDelay(user1.address, "Weekly", DAY),
      ).to.be.revertedWith("Not authorized");
      await expect(
        timeLimitsModule.connect(user1).setUnlockDelay(user1.address, "Weekly", DAY),
      ).to.be.revertedWith("Not authorized");
    });
  });
});
