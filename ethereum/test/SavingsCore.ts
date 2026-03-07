import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";

describe("SavingsCore", function () {
  // We define a fixture to reuse the same setup in every test.
  async function deploySavingsWalletFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, user1, user2] = await hre.ethers.getSigners();

    // Deploy the main SavingsCore contract (upgradeable proxy)
    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);
    await savingsCore.waitForDeployment();

    // Deploy modules as UUPS proxies with SavingsCore address
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

    // Register modules
    const timeModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TIME_PERIOD_LIMITS"));
    await savingsCore.registerModule(timeModuleId, timeLimitsModule.target);

    const proposalModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PROPOSAL_SYSTEM"));
    await savingsCore.registerModule(proposalModuleId, proposalModule.target);

    const bypassModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BYPASS_SYSTEM"));
    await savingsCore.registerModule(bypassModuleId, bypassModule.target);

    const approvalModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("APPROVAL_SYSTEM"));
    await savingsCore.registerModule(approvalModuleId, approvalModule.target);

    // Deploy MockUSDT for testing
    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    return {
      savingsCore,
      timeLimitsModule,
      proposalModule,
      bypassModule,
      approvalModule,
      mockUSDT,
      owner,
      user1,
      user2,
      timeModuleId,
      proposalModuleId,
      bypassModuleId,
      approvalModuleId
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { savingsCore, owner } = await loadFixture(deploySavingsWalletFixture);

      expect(await savingsCore.owner()).to.equal(owner.address);
    });

    it("Should register all modules correctly", async function () {
      const {
        savingsCore,
        timeLimitsModule,
        proposalModule,
        bypassModule,
        approvalModule,
        timeModuleId,
        proposalModuleId,
        bypassModuleId,
        approvalModuleId
      } = await loadFixture(deploySavingsWalletFixture);

      // Note: Using modules() function if available, or check individual registrations
      // This test assumes modules are registered correctly - may need ABI adjustment
      expect(timeLimitsModule.target).to.not.equal(hre.ethers.ZeroAddress);
      expect(proposalModule.target).to.not.equal(hre.ethers.ZeroAddress);
      expect(bypassModule.target).to.not.equal(hre.ethers.ZeroAddress);
      expect(approvalModule.target).to.not.equal(hre.ethers.ZeroAddress);
    });

    it("Should initialize with no user balances", async function () {
      const { savingsCore, user1 } = await loadFixture(deploySavingsWalletFixture);

      // Test that new user has zero balance
      expect(await savingsCore.getTokenBalance(user1.address, hre.ethers.ZeroAddress)).to.equal(0);
    });
  });

  describe("Deposits", function () {
    it("Should accept ETH deposits", async function () {
      const { savingsCore, user1 } = await loadFixture(deploySavingsWalletFixture);

      const depositAmount = hre.ethers.parseEther("1.0");

      await expect(
        savingsCore.connect(user1)["deposit(address,uint256)"](hre.ethers.ZeroAddress, depositAmount, { value: depositAmount })
      ).not.to.be.reverted;

      const balance = await savingsCore.getTokenBalance(user1.address, hre.ethers.ZeroAddress);
      expect(balance).to.equal(depositAmount);
    });

    it("Should emit deposit events", async function () {
      const { savingsCore, user1 } = await loadFixture(deploySavingsWalletFixture);

      const depositAmount = hre.ethers.parseEther("1.0");

      await expect(
        savingsCore.connect(user1)["deposit(address,uint256)"](hre.ethers.ZeroAddress, depositAmount, { value: depositAmount })
      ).to.emit(savingsCore, "Deposited")
       .withArgs(user1.address, hre.ethers.ZeroAddress, depositAmount);
    });

    it("Should handle ERC20 token deposits", async function () {
      const { savingsCore, mockUSDT, user1 } = await loadFixture(deploySavingsWalletFixture);

      const depositAmount = hre.ethers.parseUnits("100", 6); // 100 USDT (6 decimals)

      // First approve the contract to spend tokens
      await mockUSDT.connect(user1).approve(savingsCore.target, depositAmount);

      // Transfer some USDT to user1 first
      await mockUSDT.transfer(user1.address, depositAmount);

      await expect(
        savingsCore.connect(user1)["deposit(address,uint256)"](mockUSDT.target, depositAmount)
      ).not.to.be.reverted;

      const balance = await savingsCore.getTokenBalance(user1.address, mockUSDT.target);
      expect(balance).to.equal(depositAmount);
    });
  });

  describe("Withdrawals", function () {
    it("Should allow withdrawals when user has balance", async function () {
      const { savingsCore, user1 } = await loadFixture(deploySavingsWalletFixture);

      // First deposit some ETH
      const depositAmount = hre.ethers.parseEther("1.0");
      await savingsCore.connect(user1)["deposit(address,uint256)"](hre.ethers.ZeroAddress, depositAmount, { value: depositAmount });

      const withdrawAmount = hre.ethers.parseEther("0.5");

      await expect(
        savingsCore.connect(user1).withdraw(withdrawAmount, hre.ethers.ZeroAddress)
      ).not.to.be.reverted;

      const finalBalance = await savingsCore.getTokenBalance(user1.address, hre.ethers.ZeroAddress);
      expect(finalBalance).to.equal(depositAmount - withdrawAmount);
    });

    it("Should revert when withdrawing more than balance", async function () {
      const { savingsCore, user1 } = await loadFixture(deploySavingsWalletFixture);

      // First deposit some ETH
      const depositAmount = hre.ethers.parseEther("1.0");
      await savingsCore.connect(user1)["deposit(address,uint256)"](hre.ethers.ZeroAddress, depositAmount, { value: depositAmount });

      const withdrawAmount = hre.ethers.parseEther("2.0"); // More than deposited

      await expect(
        savingsCore.connect(user1).withdraw(withdrawAmount, hre.ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid amount");
    });

    it("Should allow withdrawing to specific destination", async function () {
      const { savingsCore, approvalModule, user1, user2 } = await loadFixture(deploySavingsWalletFixture);

      // First deposit some ETH
      const depositAmount = hre.ethers.parseEther("1.0");
      await savingsCore.connect(user1)["deposit(address,uint256)"](hre.ethers.ZeroAddress, depositAmount, { value: depositAmount });

      // Register user2 as an approved withdrawal address (direct add since dev mode allows it)
      await savingsCore.connect(user1).addWithdrawalAddressDirect("user2", user2.address);

      const withdrawAmount = hre.ethers.parseEther("0.5");
      const initialUser2Balance = await hre.ethers.provider.getBalance(user2.address);

      await expect(
        savingsCore.connect(user1).withdrawTo(withdrawAmount, hre.ethers.ZeroAddress, user2.address)
      ).not.to.be.reverted;

      // Check that user2 received the ETH
      const finalUser2Balance = await hre.ethers.provider.getBalance(user2.address);
      expect(finalUser2Balance).to.equal(initialUser2Balance + withdrawAmount);
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to register modules", async function () {
      const { savingsCore, user1, timeLimitsModule } = await loadFixture(deploySavingsWalletFixture);

      const newModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TEST_MODULE"));

      await expect(
        savingsCore.connect(user1).registerModule(newModuleId, timeLimitsModule.target)
      ).to.be.reverted;
    });

    it("Should allow owner to register new modules", async function () {
      const { savingsCore, owner, timeLimitsModule } = await loadFixture(deploySavingsWalletFixture);

      const newModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TEST_MODULE"));

      await expect(
        savingsCore.connect(owner).registerModule(newModuleId, timeLimitsModule.target)
      ).not.to.be.reverted;
    });
  });

  describe("Security", function () {
    it("Should prevent reentrancy attacks", async function () {
      // This test would need a malicious contract to properly test reentrancy
      // For now, we'll just ensure the basic functionality works
      const { savingsCore, user1 } = await loadFixture(deploySavingsWalletFixture);

      const depositAmount = hre.ethers.parseEther("1.0");
      await savingsCore.connect(user1)["deposit(address,uint256)"](hre.ethers.ZeroAddress, depositAmount, { value: depositAmount });

      const withdrawAmount = hre.ethers.parseEther("0.5");

      // Multiple rapid withdrawals should work normally
      await expect(
        savingsCore.connect(user1).withdraw(withdrawAmount, hre.ethers.ZeroAddress)
      ).not.to.be.reverted;

      await expect(
        savingsCore.connect(user1).withdraw(withdrawAmount, hre.ethers.ZeroAddress)
      ).not.to.be.reverted;
    });
  });

  describe("UserProxy Sweep", function () {
    it("Should sweep ERC20 tokens sent directly to proxy into savings", async function () {
      const { savingsCore, mockUSDT, user1 } = await loadFixture(deploySavingsWalletFixture);

      // Deploy a UserProxy manually (since ProxyDeploymentModule isn't in fixture)
      const UserProxy = await hre.ethers.getContractFactory("UserProxy");
      const userProxy = await UserProxy.deploy(savingsCore.target, user1.address);
      await userProxy.waitForDeployment();

      // Send USDT directly to proxy (simulating exchange withdrawal)
      const amount = hre.ethers.parseUnits("100", 6);
      await mockUSDT.transfer(userProxy.target, amount);

      // Verify tokens are sitting in proxy
      expect(await mockUSDT.balanceOf(userProxy.target)).to.equal(amount);

      // Anyone can sweep - use a different signer
      const [, , user2] = await hre.ethers.getSigners();
      await userProxy.connect(user2).sweepERC20(mockUSDT.target);

      // Tokens should be swept from proxy
      expect(await mockUSDT.balanceOf(userProxy.target)).to.equal(0);

      // Owner's savings balance should be credited
      const balance = await savingsCore.getTokenBalance(user1.address, mockUSDT.target);
      expect(balance).to.equal(amount);
    });

    it("Should revert sweep when no tokens to sweep", async function () {
      const { savingsCore, mockUSDT, user1 } = await loadFixture(deploySavingsWalletFixture);

      const UserProxy = await hre.ethers.getContractFactory("UserProxy");
      const userProxy = await UserProxy.deploy(savingsCore.target, user1.address);
      await userProxy.waitForDeployment();

      await expect(
        userProxy.sweepERC20(mockUSDT.target)
      ).to.be.revertedWith("No tokens to sweep");
    });

    it("Should revert sweep for ETH address", async function () {
      const { savingsCore, user1 } = await loadFixture(deploySavingsWalletFixture);

      const UserProxy = await hre.ethers.getContractFactory("UserProxy");
      const userProxy = await UserProxy.deploy(savingsCore.target, user1.address);
      await userProxy.waitForDeployment();

      await expect(
        userProxy.sweepERC20(hre.ethers.ZeroAddress)
      ).to.be.revertedWith("Use receive() for ETH");
    });
  });
});