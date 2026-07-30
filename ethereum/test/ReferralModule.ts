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

      const tx = await proposalModule.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);
      const receipt = await tx.wait();
      const block = await hre.ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(referralModule, "ReferralRecorded")
        .withArgs(referrer.address, 1, block!.timestamp);

      const [recordedReferrer, referredAt] = await referralModule.connect(user1).getReferrer(user1.address);
      expect(recordedReferrer).to.equal(referrer.address);
      expect(referredAt).to.equal(block!.timestamp);

      expect(await proposalModule.isSetupCommitted(user1.address)).to.be.true;
      expect(await referralModule.getReferralCount(referrer.address)).to.equal(1);
    });

    it("Should commit setup without a referrer via plain commitSetup", async function () {
      const { savingsCore, proposalModule, referralModule, user1, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await proposalModule.connect(user1).commitSetup(dailyLimit, weeklyLimit, monthlyLimit);

      expect(await proposalModule.isSetupCommitted(user1.address)).to.be.true;
      const [recordedReferrer] = await referralModule.connect(user1).getReferrer(user1.address);
      expect(recordedReferrer).to.equal(hre.ethers.ZeroAddress);
    });

    it("Should skip recording when referrer is the zero address", async function () {
      const { savingsCore, proposalModule, referralModule, user1, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await proposalModule.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, hre.ethers.ZeroAddress);

      expect(await proposalModule.isSetupCommitted(user1.address)).to.be.true;
      const [recordedReferrer] = await referralModule.connect(user1).getReferrer(user1.address);
      expect(recordedReferrer).to.equal(hre.ethers.ZeroAddress);
    });

    it("Should reject self-referral and leave setup uncommitted", async function () {
      const { savingsCore, proposalModule, user1, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await expect(
        proposalModule.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, user1.address)
      ).to.be.revertedWith("Cannot refer yourself");

      expect(await proposalModule.isSetupCommitted(user1.address)).to.be.false;
    });

    it("Should allow a referrer who has not committed setup themselves", async function () {
      const { savingsCore, proposalModule, referralModule, user1, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await proposalModule.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);

      const [recordedReferrer] = await referralModule.connect(user1).getReferrer(user1.address);
      expect(recordedReferrer).to.equal(referrer.address);
    });
  });

  describe("Immutability", function () {
    it("Should reject a second commit with a different referrer and keep the original record", async function () {
      const { savingsCore, proposalModule, referralModule, user1, user2, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await proposalModule.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);

      await expect(
        proposalModule.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, user2.address)
      ).to.be.revertedWith("Referrer already recorded");

      const [recordedReferrer] = await referralModule.connect(user1).getReferrer(user1.address);
      expect(recordedReferrer).to.equal(referrer.address);
      expect(await referralModule.getReferralCount(user2.address)).to.equal(0);
    });

    it("Should not allow adding a referrer after a plain commitSetup", async function () {
      const { savingsCore, proposalModule, referralModule, user1, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await proposalModule.connect(user1).commitSetup(dailyLimit, weeklyLimit, monthlyLimit);

      // Referral write happens first but the whole tx reverts — the post-lock
      // limits freeze now fires before commitInitialSetup's own guard
      await expect(
        proposalModule.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address)
      ).to.be.revertedWith("Setup committed - use proposals");

      const [recordedReferrer] = await referralModule.connect(user1).getReferrer(user1.address);
      expect(recordedReferrer).to.equal(hre.ethers.ZeroAddress);
      expect(await referralModule.getReferralCount(referrer.address)).to.equal(0);
    });

    it("Should reject direct recordReferral calls from non-core addresses", async function () {
      const { referralModule, user1, referrer } = await loadFixture(deployReferralFixture);

      await expect(
        referralModule.connect(user1).recordReferral(user1.address, referrer.address)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Invitee privacy", function () {
    it("Should count referrals without exposing which wallets they are", async function () {
      const { proposalModule, referralModule, user1, user2, user3, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      for (const user of [user1, user2, user3]) {
        await proposalModule.connect(user).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);
      }

      expect(await referralModule.getReferralCount(referrer.address)).to.equal(3);

      // No invitee list is exposed at all — the count is the whole story
      expect((referralModule as any).getReferredUsers).to.be.undefined;
    });

    it("Should not let a referrer look up who they referred", async function () {
      const { proposalModule, referralModule, user1, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await proposalModule.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);

      await expect(
        referralModule.connect(referrer).getReferrer(user1.address)
      ).to.be.revertedWith("Referral lookup is self-only");
    });

    it("Should keep the invitee out of the ReferralRecorded event", async function () {
      const { proposalModule, referralModule, user1, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      const tx = await proposalModule.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);
      const receipt = await tx.wait();

      const logs = receipt!.logs.filter((log) => log.address === referralModule.target);
      expect(logs.length).to.equal(1);

      const encodedUser = user1.address.slice(2).toLowerCase().padStart(64, "0");
      const encoded = (logs[0].topics.join("") + logs[0].data).toLowerCase();
      expect(encoded).to.not.include(encodedUser);
    });

    it("Should report a zero count for an address with no referrals", async function () {
      const { referralModule, referrer } = await loadFixture(deployReferralFixture);

      expect(await referralModule.getReferralCount(referrer.address)).to.equal(0);
    });
  });

  describe("Upgrade safety", function () {
    it("Should keep the storage layout compatible with the pre-privacy module", async function () {
      const legacy = await hre.ethers.getContractFactory("LegacyReferralModule");
      const next = await hre.ethers.getContractFactory("ReferralModule");

      await hre.upgrades.validateUpgrade(legacy, next, { kind: "uups" });
    });

    it("Should still count referrals recorded before the invitee list was retired", async function () {
      const { savingsCore, proposalModule, referralModuleId, user1, user2, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      // Stand up the pre-privacy module so the referral lands in `referredUsers`
      const LegacyReferralModule = await hre.ethers.getContractFactory("LegacyReferralModule");
      const legacyModule = await hre.upgrades.deployProxy(LegacyReferralModule, [savingsCore.target], { initializer: "initialize" });
      await legacyModule.waitForDeployment();

      await savingsCore.registerModule(referralModuleId, legacyModule.target);
      await savingsCore.setupModuleCrossReferences();

      await proposalModule.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);
      expect(await legacyModule.getReferralCount(referrer.address)).to.equal(1);

      const ReferralModule = await hre.ethers.getContractFactory("ReferralModule");
      const newImpl = await ReferralModule.deploy();
      await newImpl.waitForDeployment();
      await legacyModule.upgradeToAndCall(newImpl.target, "0x");

      const upgraded = ReferralModule.attach(legacyModule.target);
      expect(await upgraded.getReferralCount(referrer.address)).to.equal(1);

      const [recordedReferrer] = await upgraded.connect(user1).getReferrer(user1.address);
      expect(recordedReferrer).to.equal(referrer.address);

      // A referral recorded after the upgrade adds to the legacy count
      await proposalModule.connect(user2).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);
      expect(await upgraded.getReferralCount(referrer.address)).to.equal(2);
    });

    it("Should preserve referral records across an in-place module upgrade", async function () {
      const { savingsCore, proposalModule, referralModule, user1, referrer, dailyLimit, weeklyLimit, monthlyLimit } =
        await loadFixture(deployReferralFixture);

      await proposalModule.connect(user1).commitSetupWithReferrer(dailyLimit, weeklyLimit, monthlyLimit, referrer.address);
      const [referrerBefore, referredAtBefore] = await referralModule.connect(user1).getReferrer(user1.address);

      // Upgrade manually (new implementation + upgradeToAndCall) — the OZ
      // plugin's manifest mis-associates reused snapshot addresses across
      // test files; layout validation is exercised by the deploy scripts
      const ReferralModule = await hre.ethers.getContractFactory("ReferralModule");
      const newImpl = await ReferralModule.deploy();
      await newImpl.waitForDeployment();
      await referralModule.upgradeToAndCall(newImpl.target, "0x");
      const upgraded = referralModule;

      expect(await hre.upgrades.erc1967.getImplementationAddress(referralModule.target as string)).to.equal(newImpl.target);
      const [referrerAfter, referredAtAfter] = await upgraded.connect(user1).getReferrer(user1.address);
      expect(referrerAfter).to.equal(referrerBefore);
      expect(referredAtAfter).to.equal(referredAtBefore);
      expect(await upgraded.getReferralCount(referrer.address)).to.equal(1);
    });
  });
});
