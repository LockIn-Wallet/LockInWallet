import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("ReferralModule", function () {
  async function deployReferralFixture() {
    const [owner, user1, user2, user3, referrer] = await hre.ethers.getSigners();

    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);
    await savingsCore.waitForDeployment();

    const TimePeriodLimitsModule = await hre.ethers.getContractFactory("TimePeriodLimitsModule");
    const timeLimitsModule = await hre.upgrades.deployProxy(TimePeriodLimitsModule, [savingsCore.target], { initializer: "initialize" });
    await timeLimitsModule.waitForDeployment();

    const ProposalSystemModule = await hre.ethers.getContractFactory("ProposalSystemModule");
    const proposalModule = await hre.upgrades.deployProxy(ProposalSystemModule, [savingsCore.target], { initializer: "initialize" });
    await proposalModule.waitForDeployment();

    const BypassSystemModule = await hre.ethers.getContractFactory("BypassSystemModule");
    const bypassModule = await hre.upgrades.deployProxy(BypassSystemModule, [savingsCore.target], { initializer: "initialize" });
    await bypassModule.waitForDeployment();

    const ApprovalSystemModule = await hre.ethers.getContractFactory("ApprovalSystemModule");
    const approvalModule = await hre.upgrades.deployProxy(ApprovalSystemModule, [savingsCore.target], { initializer: "initialize" });
    await approvalModule.waitForDeployment();

    const ReferralModule = await hre.ethers.getContractFactory("ReferralModule");
    const referralModule = await hre.upgrades.deployProxy(ReferralModule, [savingsCore.target], { initializer: "initialize" });
    await referralModule.waitForDeployment();

    const timeModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TIME_PERIOD_LIMITS"));
    await savingsCore.registerModule(timeModuleId, timeLimitsModule.target);

    const proposalModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PROPOSAL_SYSTEM"));
    await savingsCore.registerModule(proposalModuleId, proposalModule.target);

    const bypassModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BYPASS_SYSTEM"));
    await savingsCore.registerModule(bypassModuleId, bypassModule.target);

    const approvalModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("APPROVAL_SYSTEM"));
    await savingsCore.registerModule(approvalModuleId, approvalModule.target);

    const referralModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("REFERRAL"));
    await savingsCore.registerModule(referralModuleId, referralModule.target);

    await savingsCore.setupModuleCrossReferences();

    const dailyLimit = hre.ethers.parseEther("1.0");
    const weeklyLimit = hre.ethers.parseEther("7.0");
    const monthlyLimit = hre.ethers.parseEther("30.0");

    return {
      savingsCore,
      proposalModule,
      referralModule,
      referralModuleId,
      owner,
      user1,
      user2,
      user3,
      referrer,
      dailyLimit,
      weeklyLimit,
      monthlyLimit,
    };
  }

  describe("Recording at setup commit", function () {
    it("Should record referrer, timestamp and emit ReferralRecorded on commitSetupWithReferrer", async function () {
      const { savingsCore, proposalModule, referralModule, user1, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      const tx = await savingsCore.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);
      const receipt = await tx.wait();
      const block = await hre.ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(referralModule, "ReferralRecorded")
        .withArgs(user1.address, referrer.address, block!.timestamp);

      const [recordedReferrer, referredAt] = await referralModule.getReferrer(user1.address);
      expect(recordedReferrer).to.equal(referrer.address);
      expect(referredAt).to.equal(block!.timestamp);

      expect(await proposalModule.isSetupCommitted(user1.address)).to.be.true;
      expect(await referralModule.getReferralCount(referrer.address)).to.equal(1);
    });

    it("Should commit setup without a referrer via plain commitSetup", async function () {
      const { savingsCore, proposalModule, referralModule, user1, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await savingsCore.connect(user1).commitSetup(dailyLimit, weeklyLimit, monthlyLimit);

      expect(await proposalModule.isSetupCommitted(user1.address)).to.be.true;
      const [recordedReferrer] = await referralModule.getReferrer(user1.address);
      expect(recordedReferrer).to.equal(hre.ethers.ZeroAddress);
    });

    it("Should skip recording when referrer is the zero address", async function () {
      const { savingsCore, proposalModule, referralModule, user1, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await savingsCore.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, hre.ethers.ZeroAddress);

      expect(await proposalModule.isSetupCommitted(user1.address)).to.be.true;
      const [recordedReferrer] = await referralModule.getReferrer(user1.address);
      expect(recordedReferrer).to.equal(hre.ethers.ZeroAddress);
    });

    it("Should reject self-referral and leave setup uncommitted", async function () {
      const { savingsCore, proposalModule, user1, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await expect(
        savingsCore.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, user1.address)
      ).to.be.revertedWith("Cannot refer yourself");

      expect(await proposalModule.isSetupCommitted(user1.address)).to.be.false;
    });

    it("Should allow a referrer who has not committed setup themselves", async function () {
      const { savingsCore, referralModule, user1, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await savingsCore.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);

      const [recordedReferrer] = await referralModule.getReferrer(user1.address);
      expect(recordedReferrer).to.equal(referrer.address);
    });
  });

  describe("Immutability", function () {
    it("Should reject a second commit with a different referrer and keep the original record", async function () {
      const { savingsCore, referralModule, user1, user2, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await savingsCore.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);

      await expect(
        savingsCore.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, user2.address)
      ).to.be.revertedWith("Referrer already recorded");

      const [recordedReferrer] = await referralModule.getReferrer(user1.address);
      expect(recordedReferrer).to.equal(referrer.address);
      expect(await referralModule.getReferralCount(user2.address)).to.equal(0);
    });

    it("Should not allow adding a referrer after a plain commitSetup", async function () {
      const { savingsCore, referralModule, user1, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await savingsCore.connect(user1).commitSetup(dailyLimit, weeklyLimit, monthlyLimit);

      // Referral write succeeds first but the whole tx reverts on "Already committed"
      await expect(
        savingsCore.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address)
      ).to.be.revertedWith("Already committed");

      const [recordedReferrer] = await referralModule.getReferrer(user1.address);
      expect(recordedReferrer).to.equal(hre.ethers.ZeroAddress);
      expect(await referralModule.getReferralCount(referrer.address)).to.equal(0);
    });

    it("Should reject direct recordReferral calls from non-core addresses", async function () {
      const { referralModule, user1, referrer } = await loadFixture(deployReferralFixture);

      await expect(
        referralModule.connect(user1).recordReferral(user1.address, referrer.address)
      ).to.be.revertedWith("Only core contract");
    });
  });

  describe("Referral list views", function () {
    it("Should return referred users with join timestamps and support pagination", async function () {
      const { savingsCore, referralModule, user1, user2, user3, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      for (const user of [user1, user2, user3]) {
        await savingsCore.connect(user).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);
      }

      expect(await referralModule.getReferralCount(referrer.address)).to.equal(3);

      const [users, joinedAt] = await referralModule.getReferredUsers(referrer.address, 0, 100);
      expect(users).to.deep.equal([user1.address, user2.address, user3.address]);
      expect(joinedAt.length).to.equal(3);
      for (const ts of joinedAt) {
        expect(ts).to.be.greaterThan(0);
      }

      const [page, pageJoinedAt] = await referralModule.getReferredUsers(referrer.address, 1, 1);
      expect(page).to.deep.equal([user2.address]);
      expect(pageJoinedAt.length).to.equal(1);

      const [beyond, beyondJoinedAt] = await referralModule.getReferredUsers(referrer.address, 5, 10);
      expect(beyond.length).to.equal(0);
      expect(beyondJoinedAt.length).to.equal(0);
    });

    it("Should return empty results for an address with no referrals", async function () {
      const { referralModule, referrer } = await loadFixture(deployReferralFixture);

      expect(await referralModule.getReferralCount(referrer.address)).to.equal(0);
      const [users, joinedAt] = await referralModule.getReferredUsers(referrer.address, 0, 100);
      expect(users.length).to.equal(0);
      expect(joinedAt.length).to.equal(0);
    });
  });

  describe("Upgrade safety", function () {
    it("Should preserve referral records across an in-place module upgrade", async function () {
      const { savingsCore, referralModule, user1, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await savingsCore.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);
      const [referrerBefore, referredAtBefore] = await referralModule.getReferrer(user1.address);

      const ReferralModule = await hre.ethers.getContractFactory("ReferralModule");
      const upgraded = await hre.upgrades.upgradeProxy(referralModule.target, ReferralModule);
      await upgraded.waitForDeployment();

      expect(upgraded.target).to.equal(referralModule.target);
      const [referrerAfter, referredAtAfter] = await upgraded.getReferrer(user1.address);
      expect(referrerAfter).to.equal(referrerBefore);
      expect(referredAtAfter).to.equal(referredAtBefore);
      expect(await upgraded.getReferralCount(referrer.address)).to.equal(1);
    });
  });
});
