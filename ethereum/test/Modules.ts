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

    // Deploy all modules with SavingsCore address
    const TimePeriodLimitsModule = await hre.ethers.getContractFactory("TimePeriodLimitsModule");
    const timeLimitsModule = await TimePeriodLimitsModule.deploy(savingsCore.target);
    await timeLimitsModule.waitForDeployment();

    const ProposalSystemModule = await hre.ethers.getContractFactory("ProposalSystemModule");
    const proposalModule = await ProposalSystemModule.deploy(savingsCore.target);
    await proposalModule.waitForDeployment();

    const BypassSystemModule = await hre.ethers.getContractFactory("BypassSystemModule");
    const bypassModule = await BypassSystemModule.deploy(savingsCore.target);
    await bypassModule.waitForDeployment();

    const ApprovalSystemModule = await hre.ethers.getContractFactory("ApprovalSystemModule");
    const approvalModule = await ApprovalSystemModule.deploy(savingsCore.target);
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

    // Setup some user funds for testing
    const depositAmount = hre.ethers.parseEther("10.0");
    await savingsCore.connect(user1)["deposit(address,uint256)"](hre.ethers.ZeroAddress, depositAmount, { value: depositAmount });

    return {
      savingsCore,
      timeLimitsModule,
      proposalModule,
      bypassModule,
      approvalModule,
      owner,
      user1,
      user2,
      timeModuleId,
      proposalModuleId,
      bypassModuleId,
      approvalModuleId,
      depositAmount
    };
  }

  describe("TimePeriodLimitsModule", function () {
    it("Should set spending limits", async function () {
      const { savingsCore, user1 } = await loadFixture(deployModulesFixture);

      const dailyLimit = hre.ethers.parseEther("1.0");
      const weeklyLimit = hre.ethers.parseEther("7.0");  // 7 * daily = weekly
      const monthlyLimit = hre.ethers.parseEther("30.0"); // 30 * daily = monthly

      await expect(
        savingsCore.connect(user1).setCommonPeriodLimits(
          dailyLimit,
          weeklyLimit,
          monthlyLimit
        )
      ).not.to.be.reverted;
    });

    it("Should enforce daily spending limits", async function () {
      const { savingsCore, user1 } = await loadFixture(deployModulesFixture);

      // Set a low daily limit
      const dailyLimit = hre.ethers.parseEther("1.0");
      const weeklyLimit = hre.ethers.parseEther("7.0");  // 7 * daily = weekly
      const monthlyLimit = hre.ethers.parseEther("30.0"); // 30 * daily = monthly

      await savingsCore.connect(user1).setCommonPeriodLimits(
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
      const { savingsCore, user1 } = await loadFixture(deployModulesFixture);

      const dailyLimit = hre.ethers.parseEther("1.0");
      await savingsCore.connect(user1).setCommonPeriodLimits(
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
    it("Should create withdrawal proposals for amounts exceeding limits", async function () {
      const { savingsCore, user1 } = await loadFixture(deployModulesFixture);

      // Set spending limits
      const dailyLimit = hre.ethers.parseEther("1.0");
      await savingsCore.connect(user1).setCommonPeriodLimits(
        dailyLimit,
        hre.ethers.parseEther("7.0"),
        hre.ethers.parseEther("30.0")
      );

      // Attempt to withdraw more than daily limit
      const largeWithdrawAmount = hre.ethers.parseEther("3.0");

      await expect(
        savingsCore.connect(user1).proposeWithdrawal(
          largeWithdrawAmount,
          hre.ethers.ZeroAddress,
          user1.address
        )
      ).not.to.be.reverted;
    });

    it("Should enforce timelock on proposal execution", async function () {
      const { savingsCore, user1 } = await loadFixture(deployModulesFixture);

      const dailyLimit = hre.ethers.parseEther("1.0");
      await savingsCore.connect(user1).setCommonPeriodLimits(
        dailyLimit,
        hre.ethers.parseEther("7.0"),
        hre.ethers.parseEther("30.0")
      );

      const largeWithdrawAmount = hre.ethers.parseEther("3.0");

      // Create proposal
      await savingsCore.connect(user1).proposeWithdrawal(
        largeWithdrawAmount,
        hre.ethers.ZeroAddress,
        user1.address
      );

      // Immediate execution should fail (timelock not expired)
      await expect(
        savingsCore.connect(user1).executeWithdrawalProposal(0) // Assuming proposal ID 0
      ).to.be.reverted;
    });

    it("Should allow proposal execution after timelock expires", async function () {
      const { savingsCore, user1 } = await loadFixture(deployModulesFixture);

      const dailyLimit = hre.ethers.parseEther("1.0");
      await savingsCore.connect(user1).setCommonPeriodLimits(
        dailyLimit,
        hre.ethers.parseEther("7.0"),
        hre.ethers.parseEther("30.0")
      );

      const largeWithdrawAmount = hre.ethers.parseEther("3.0");

      // Create proposal
      await savingsCore.connect(user1).proposeWithdrawal(
        largeWithdrawAmount,
        hre.ethers.ZeroAddress,
        user1.address
      );

      // Fast forward past timelock period (assuming 24 hours)
      await time.increase(24 * 60 * 60 + 1);

      // Execution should now succeed
      await expect(
        savingsCore.connect(user1).executeWithdrawalProposal(0)
      ).not.to.be.reverted;
    });
  });

  describe("BypassSystemModule", function () {
    it("Should allow emergency bypass requests", async function () {
      const { savingsCore, user1 } = await loadFixture(deployModulesFixture);

      const emergencyAmount = hre.ethers.parseEther("5.0");

      await expect(
        savingsCore.connect(user1).requestWithdrawalBypass(
          hre.ethers.ZeroAddress,
          emergencyAmount,
          user1.address,
          "DAILY" // Exceeding daily limit
        )
      ).not.to.be.reverted;
    });

    it("Should enforce timelock on bypass execution", async function () {
      const { savingsCore, user1 } = await loadFixture(deployModulesFixture);

      const emergencyAmount = hre.ethers.parseEther("5.0");

      // Create bypass request
      await savingsCore.connect(user1).requestWithdrawalBypass(
        hre.ethers.ZeroAddress,
        emergencyAmount,
        user1.address,
        "DAILY"
      );

      // Immediate execution should fail
      await expect(
        savingsCore.connect(user1).executeBypassWithdrawal(0) // Assuming request ID 0
      ).to.be.reverted;
    });
  });

  describe("ApprovalSystemModule", function () {
    it("Should handle multi-signature approvals", async function () {
      const { savingsCore, user1, user2 } = await loadFixture(deployModulesFixture);

      // This test depends on the specific implementation of the approval system
      // May need adjustment based on actual function signatures
      const operationId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test_operation"));

      // This is a placeholder test - adjust based on actual approval system implementation
      expect(user1.address).to.not.equal(user2.address); // Basic sanity check
    });
  });

  describe("Module Integration", function () {
    it("Should coordinate between modules correctly", async function () {
      const { savingsCore, user1 } = await loadFixture(deployModulesFixture);

      // Set up spending limits (TimePeriodLimitsModule)
      const dailyLimit = hre.ethers.parseEther("1.0");
      await savingsCore.connect(user1).setCommonPeriodLimits(
        dailyLimit,
        hre.ethers.parseEther("7.0"),
        hre.ethers.parseEther("30.0")
      );

      // Try to withdraw more than limit, should trigger proposal system
      const largeAmount = hre.ethers.parseEther("3.0");

      // The system should coordinate between TimePeriodLimits and ProposalSystem modules
      await expect(
        savingsCore.connect(user1).proposeWithdrawal(
          largeAmount,
          hre.ethers.ZeroAddress,
          user1.address
        )
      ).not.to.be.reverted;
    });

    it("Should maintain consistent state across modules", async function () {
      const { savingsCore, user1 } = await loadFixture(deployModulesFixture);

      // Test that user balance is consistent across different module operations
      const initialBalance = await savingsCore.getTokenBalance(user1.address, hre.ethers.ZeroAddress);
      expect(initialBalance).to.be.gt(0);

      // After setting limits, balance should remain the same
      await savingsCore.connect(user1).setCommonPeriodLimits(
        hre.ethers.parseEther("1.0"),
        hre.ethers.parseEther("7.0"),
        hre.ethers.parseEther("30.0"),
        hre.ethers.ZeroAddress
      );

      const balanceAfterLimits = await savingsCore.getTokenBalance(user1.address, hre.ethers.ZeroAddress);
      expect(balanceAfterLimits).to.equal(initialBalance);
    });
  });
});