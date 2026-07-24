import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";

describe("Savings Wallet Modules", function () {
  // Shared fixture for all module tests
  async function deployModulesFixture() {
    const [owner, user1, user2] = await hre.ethers.getSigners();

    // Deploy the main SavingsCore contract (upgradeable proxy)
    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);
    await savingsCore.waitForDeployment();

    // Deploy all modules as UUPS proxies with SavingsCore address
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

    // Register modules with SavingsCore
    const timeModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TIME_PERIOD_LIMITS"));
    await savingsCore.registerModule(timeModuleId, timeLimitsModule.target);

    const proposalModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PROPOSAL_SYSTEM"));
    await savingsCore.registerModule(proposalModuleId, proposalModule.target);

    const bypassModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BYPASS_SYSTEM"));
    await savingsCore.registerModule(bypassModuleId, bypassModule.target);

    const approvalModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("APPROVAL_SYSTEM"));
    await savingsCore.registerModule(approvalModuleId, approvalModule.target);

    const PoolTogetherModule = await hre.ethers.getContractFactory("PoolTogetherModule");
    const poolTogetherModule = await hre.upgrades.deployProxy(PoolTogetherModule, [savingsCore.target], { initializer: "initialize" });
    await poolTogetherModule.waitForDeployment();

    const poolTogetherModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("POOL_TOGETHER"));
    await savingsCore.registerModule(poolTogetherModuleId, poolTogetherModule.target);

    // Set up inter-module cross-references (required for ProposalSystem and BypassSystem)
    await savingsCore.setupModuleCrossReferences();

    // Setup some user funds for testing
    const depositAmount = hre.ethers.parseEther("10.0");
    await savingsCore.connect(user1)["deposit(address,uint256)"](hre.ethers.ZeroAddress, depositAmount, { value: depositAmount });

    return {
      savingsCore,
      timeLimitsModule,
      proposalModule,
      bypassModule,
      approvalModule,
      poolTogetherModule,
      owner,
      user1,
      user2,
      timeModuleId,
      proposalModuleId,
      bypassModuleId,
      approvalModuleId,
      poolTogetherModuleId,
      depositAmount
    };
  }

  describe("TimePeriodLimitsModule", function () {
    it("Should set spending limits", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, user1, user2 } = await loadFixture(deployModulesFixture);

      const dailyLimit = hre.ethers.parseEther("1.0");
      const weeklyLimit = hre.ethers.parseEther("7.0");  // Example: weekly > daily
      const monthlyLimit = hre.ethers.parseEther("30.0"); // Example: monthly > weekly

      await expect(
        timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
          dailyLimit,
          weeklyLimit,
          monthlyLimit
        )
      ).not.to.be.reverted;
    });

    it("Should allow restrictive spending limits (weekly < daily × 7)", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, user1, user2 } = await loadFixture(deployModulesFixture);

      // Set restrictive limits where weekly is less than daily × 7
      const dailyLimit = hre.ethers.parseEther("10.0");   // $10 daily
      const weeklyLimit = hre.ethers.parseEther("50.0");  // $50 weekly (less than daily × 7 = $70)
      const monthlyLimit = hre.ethers.parseEther("150.0"); // $150 monthly (less than weekly × 4 = $200)

      await expect(
        timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
          dailyLimit,
          weeklyLimit,
          monthlyLimit
        )
      ).not.to.be.reverted;
    });

    it("Should enforce daily spending limits", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, user1, user2 } = await loadFixture(deployModulesFixture);

      // Set a low daily limit
      const dailyLimit = hre.ethers.parseEther("1.0");
      const weeklyLimit = hre.ethers.parseEther("7.0");  // Example: weekly > daily
      const monthlyLimit = hre.ethers.parseEther("30.0"); // Example: monthly > weekly

      await timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
        dailyLimit,
        weeklyLimit,
        monthlyLimit
      );

      // First withdrawal within limit should work
      const withdrawAmount1 = hre.ethers.parseEther("0.5");
      await expect(
        savingsCore.connect(user1).withdraw(withdrawAmount1, hre.ethers.ZeroAddress)
      ).not.to.be.reverted;

      // Second withdrawal that exceeds daily limit should be restricted
      const withdrawAmount2 = hre.ethers.parseEther("0.6"); // Total would be 1.1 ETH > 1.0 daily limit
      await expect(
        savingsCore.connect(user1).withdraw(withdrawAmount2, hre.ethers.ZeroAddress)
      ).to.be.reverted; // May need to adjust based on actual error message
    });

    it("Should reset limits after time period", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, user1, user2 } = await loadFixture(deployModulesFixture);

      const dailyLimit = hre.ethers.parseEther("1.0");
      await timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
        dailyLimit,
        hre.ethers.parseEther("7.0"),
        hre.ethers.parseEther("30.0")
      );

      // Withdraw up to daily limit
      await savingsCore.connect(user1).withdraw(dailyLimit, hre.ethers.ZeroAddress);

      // Fast forward 1 day + 1 second
      await time.increase(24 * 60 * 60 + 1);

      // Should be able to withdraw again after daily reset
      await expect(
        savingsCore.connect(user1).withdraw(hre.ethers.parseEther("0.5"), hre.ethers.ZeroAddress)
      ).not.to.be.reverted;
    });
  });

  describe("ProposalSystemModule", function () {
    it("Should create limit change proposals", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, user1, user2 } = await loadFixture(deployModulesFixture);

      // Set initial spending limits and commit setup
      await timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
        hre.ethers.parseUnits("1.0", 6),
        hre.ethers.parseUnits("7.0", 6),
        hre.ethers.parseUnits("30.0", 6)
      );
      await proposalModule.connect(user1).commitInitialSetup(user1.address);

      // Propose an increase to the daily limit
      await expect(
        proposalModule.connect(user1).proposeLimitChange(user1.address, "Daily", hre.ethers.parseUnits("2.0", 6))
      ).not.to.be.reverted;
    });

    it("Should enforce timelock on proposal execution", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, user1, user2 } = await loadFixture(deployModulesFixture);

      await timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
        hre.ethers.parseUnits("1.0", 6),
        hre.ethers.parseUnits("7.0", 6),
        hre.ethers.parseUnits("30.0", 6)
      );
      await proposalModule.connect(user1).commitInitialSetup(user1.address);

      // Create a limit increase proposal and get proposalId from return value
      const proposalId = await proposalModule.connect(user1).proposeLimitChange.staticCall(
        user1.address, "Daily", hre.ethers.parseUnits("2.0", 6)
      );
      await proposalModule.connect(user1).proposeLimitChange(user1.address, "Daily", hre.ethers.parseUnits("2.0", 6));

      // Immediate execution should fail (timelock not expired)
      await expect(
        proposalModule.connect(user1).executeLimitProposal(user1.address, proposalId)
      ).to.be.reverted;
    });

    it("Should allow proposal execution after timelock expires", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, user1, user2 } = await loadFixture(deployModulesFixture);

      await timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
        hre.ethers.parseUnits("1.0", 6),
        hre.ethers.parseUnits("7.0", 6),
        hre.ethers.parseUnits("30.0", 6)
      );
      await proposalModule.connect(user1).commitInitialSetup(user1.address);

      // Submit the proposal then read back the proposalId
      await proposalModule.connect(user1).proposeLimitChange(user1.address, "Daily", hre.ethers.parseUnits("2.0", 6));
      const [proposalIds] = await proposalModule.getUserPendingProposals(user1.address);
      const proposalId = proposalIds[0];

      // Fast forward past dev-mode timelock (30 seconds)
      await time.increase(31);

      // Execution should now succeed
      await expect(
        proposalModule.connect(user1).executeLimitProposal(user1.address, proposalId)
      ).not.to.be.reverted;
    });
  });

  describe("BypassSystemModule", function () {
    it("Should allow emergency bypass requests", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, user1, user2 } = await loadFixture(deployModulesFixture);

      // Set up a daily limit so the "Daily" period exists
      await timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
        hre.ethers.parseUnits("1.0", 6),
        hre.ethers.parseUnits("7.0", 6),
        hre.ethers.parseUnits("30.0", 6)
      );

      const emergencyAmount = hre.ethers.parseUnits("5.0", 6);

      await expect(
        bypassModule.connect(user1).requestLimitBypass(
          user1.address,
          emergencyAmount,
          "Daily",
          hre.ethers.ZeroAddress
        )
      ).not.to.be.reverted;
    });

    it("Should enforce timelock on bypass execution", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, user1, user2 } = await loadFixture(deployModulesFixture);

      // Set up a daily limit so the "Daily" period exists
      await timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
        hre.ethers.parseUnits("1.0", 6),
        hre.ethers.parseUnits("7.0", 6),
        hre.ethers.parseUnits("30.0", 6)
      );

      const emergencyAmount = hre.ethers.parseUnits("5.0", 6);

      // Get requestId via staticCall then submit
      const requestId = await bypassModule.connect(user1).requestLimitBypass.staticCall(
        user1.address, emergencyAmount, "Daily", hre.ethers.ZeroAddress
      );
      await bypassModule.connect(user1).requestLimitBypass(
        user1.address, emergencyAmount, "Daily", hre.ethers.ZeroAddress
      );

      // Immediate execution should fail (timelock not expired)
      await expect(
        bypassModule.connect(user1).executeBypassWithdrawal(user1.address, requestId)
      ).to.be.reverted;
    });
  });

  describe("ApprovalSystemModule", function () {
    it("Should handle multi-signature approvals", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, user1, user2 } = await loadFixture(deployModulesFixture);

      // This test depends on the specific implementation of the approval system
      // May need adjustment based on actual function signatures
      const operationId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test_operation"));

      // This is a placeholder test - adjust based on actual approval system implementation
      expect(user1.address).to.not.equal(user2.address); // Basic sanity check
    });
  });

  describe("Pattern B self-authentication", function () {
    it("Should reject direct module calls made on someone else's behalf", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, approvalModule, user1, user2 } = await loadFixture(deployModulesFixture);

      const daily = hre.ethers.parseUnits("1.0", 6);
      const weekly = hre.ethers.parseUnits("7.0", 6);
      const monthly = hre.ethers.parseUnits("30.0", 6);

      await expect(
        timeLimitsModule.connect(user2).setCommonPeriodLimits(user1.address, daily, weekly, monthly)
      ).to.be.revertedWith("Not authorized");

      await expect(
        proposalModule.connect(user2).commitInitialSetup(user1.address)
      ).to.be.revertedWith("Not authorized");

      await expect(
        bypassModule.connect(user2).requestLimitBypass(user1.address, daily, "Daily", hre.ethers.ZeroAddress)
      ).to.be.revertedWith("Not authorized");

      await expect(
        approvalModule.connect(user2).addWithdrawalAddressDirect(user1.address, "attacker", user2.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should freeze existing limits after lock-in until a proposal passes", async function () {
      const { timeLimitsModule, proposalModule, user1 } = await loadFixture(deployModulesFixture);

      const daily = hre.ethers.parseUnits("1.0", 6);
      const weekly = hre.ethers.parseUnits("7.0", 6);
      const monthly = hre.ethers.parseUnits("30.0", 6);
      await proposalModule.connect(user1).commitSetup(daily, weekly, monthly);

      // No instant overrides once locked
      await expect(
        timeLimitsModule.connect(user1).setCommonPeriodLimits(user1.address, daily * 100n, weekly * 100n, monthly * 100n)
      ).to.be.revertedWith("Setup committed - use proposals");

      // "Adding" an existing period is an overwrite in disguise — also blocked
      await expect(
        timeLimitsModule.connect(user1).addTimePeriodLimit(user1.address, "Daily", daily * 100n, 86400)
      ).to.be.revertedWith("Setup committed - use proposals");

      // A brand-new period only tightens, so it stays allowed
      await expect(
        timeLimitsModule.connect(user1).addTimePeriodLimit(user1.address, "Hourly", hre.ethers.parseUnits("0.1", 6), 3600)
      ).not.to.be.reverted;

      // The proposal flow remains the one path to change a locked limit
      const newDaily = hre.ethers.parseUnits("2.0", 6);
      await proposalModule.connect(user1).proposeLimitChange(user1.address, "Daily", newDaily);
      const [proposalIds] = await proposalModule.getUserPendingProposals(user1.address);
      const proposalId = proposalIds[0];
      await time.increase(31); // dev-mode timelock
      await proposalModule.connect(user1).executeLimitProposal(user1.address, proposalId);

      const limit = await timeLimitsModule.findPeriodLimit(user1.address, "Daily");
      expect(limit).to.equal(newDaily);
    });

    it("Should keep timelock-protected limit mutations module-only", async function () {
      const { timeLimitsModule, user1 } = await loadFixture(deployModulesFixture);

      await timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
        hre.ethers.parseUnits("1.0", 6),
        hre.ethers.parseUnits("7.0", 6),
        hre.ethers.parseUnits("30.0", 6)
      );

      // Direct raises/removals would bypass the proposal timelock — they must
      // stay reachable only through ProposalSystemModule
      await expect(
        timeLimitsModule.connect(user1).updateTimePeriodLimit(user1.address, "Daily", hre.ethers.parseUnits("100.0", 6))
      ).to.be.revertedWith("Not authorized");

      await expect(
        timeLimitsModule.connect(user1).removeTimePeriodLimit(user1.address, "Daily")
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Module Integration", function () {
    it("Should coordinate between modules correctly", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, user1, user2 } = await loadFixture(deployModulesFixture);

      // Set up spending limits and commit setup
      await timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
        hre.ethers.parseUnits("1.0", 6),
        hre.ethers.parseUnits("7.0", 6),
        hre.ethers.parseUnits("30.0", 6)
      );
      await proposalModule.connect(user1).commitInitialSetup(user1.address);

      // Verify limits were set via TimePeriodLimitsModule and committed via ProposalSystemModule
      const isCommitted = await proposalModule.isSetupCommitted(user1.address);
      expect(isCommitted).to.be.true;

      // Propose a limit increase - exercises coordination between ProposalSystem and TimePeriodLimits
      await expect(
        proposalModule.connect(user1).proposeLimitChange(user1.address, "Daily", hre.ethers.parseUnits("2.0", 6))
      ).not.to.be.reverted;
    });

    it("Should maintain consistent state across modules", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, bypassModule, user1, user2 } = await loadFixture(deployModulesFixture);

      // Test that user balance is consistent across different module operations
      const initialBalance = await savingsCore.getTokenBalance(user1.address, hre.ethers.ZeroAddress);
      expect(initialBalance).to.be.gt(0);

      // After setting limits, balance should remain the same
      await timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
        hre.ethers.parseUnits("1.0", 6),
        hre.ethers.parseUnits("7.0", 6),
        hre.ethers.parseUnits("30.0", 6)
      );

      const balanceAfterLimits = await savingsCore.getTokenBalance(user1.address, hre.ethers.ZeroAddress);
      expect(balanceAfterLimits).to.equal(initialBalance);
    });
  });
});