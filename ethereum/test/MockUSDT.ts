import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("MockUSDT", function () {
  async function deployMockUSDTFixture() {
    const [owner, user1, user2] = await hre.ethers.getSigners();

    // Deploy MockUSDT
    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    return { mockUSDT, owner, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      const { mockUSDT } = await loadFixture(deployMockUSDTFixture);

      expect(await mockUSDT.name()).to.equal("Mock USDT");
      expect(await mockUSDT.symbol()).to.equal("USDT");
    });

    it("Should set the right decimals", async function () {
      const { mockUSDT } = await loadFixture(deployMockUSDTFixture);

      expect(await mockUSDT.decimals()).to.equal(6);
    });

    it("Should mint initial supply to owner", async function () {
      const { mockUSDT, owner } = await loadFixture(deployMockUSDTFixture);

      const expectedSupply = hre.ethers.parseUnits("1000000", 6); // 1M USDT with 6 decimals
      expect(await mockUSDT.totalSupply()).to.equal(expectedSupply);
      expect(await mockUSDT.balanceOf(owner.address)).to.equal(expectedSupply);
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const { mockUSDT, owner, user1 } = await loadFixture(deployMockUSDTFixture);

      const transferAmount = hre.ethers.parseUnits("1000", 6); // 1000 USDT

      await expect(
        mockUSDT.transfer(user1.address, transferAmount)
      ).not.to.be.reverted;

      expect(await mockUSDT.balanceOf(user1.address)).to.equal(transferAmount);
    });

    it("Should fail when transferring more than balance", async function () {
      const { mockUSDT, user1, user2 } = await loadFixture(deployMockUSDTFixture);

      const transferAmount = hre.ethers.parseUnits("1000", 6);

      await expect(
        mockUSDT.connect(user1).transfer(user2.address, transferAmount)
      ).to.be.reverted;
    });

    it("Should emit Transfer events", async function () {
      const { mockUSDT, owner, user1 } = await loadFixture(deployMockUSDTFixture);

      const transferAmount = hre.ethers.parseUnits("1000", 6);

      await expect(
        mockUSDT.transfer(user1.address, transferAmount)
      ).to.emit(mockUSDT, "Transfer")
       .withArgs(owner.address, user1.address, transferAmount);
    });
  });

  describe("Allowances", function () {
    it("Should approve spending allowances", async function () {
      const { mockUSDT, owner, user1 } = await loadFixture(deployMockUSDTFixture);

      const approvalAmount = hre.ethers.parseUnits("500", 6); // 500 USDT

      await expect(
        mockUSDT.approve(user1.address, approvalAmount)
      ).not.to.be.reverted;

      expect(await mockUSDT.allowance(owner.address, user1.address)).to.equal(approvalAmount);
    });

    it("Should allow transferFrom with proper allowance", async function () {
      const { mockUSDT, owner, user1, user2 } = await loadFixture(deployMockUSDTFixture);

      const approvalAmount = hre.ethers.parseUnits("500", 6);
      const transferAmount = hre.ethers.parseUnits("300", 6);

      // Owner approves user1 to spend tokens
      await mockUSDT.approve(user1.address, approvalAmount);

      // user1 transfers tokens from owner to user2
      await expect(
        mockUSDT.connect(user1).transferFrom(owner.address, user2.address, transferAmount)
      ).not.to.be.reverted;

      expect(await mockUSDT.balanceOf(user2.address)).to.equal(transferAmount);
      expect(await mockUSDT.allowance(owner.address, user1.address)).to.equal(approvalAmount - transferAmount);
    });

    it("Should fail transferFrom without sufficient allowance", async function () {
      const { mockUSDT, owner, user1, user2 } = await loadFixture(deployMockUSDTFixture);

      const transferAmount = hre.ethers.parseUnits("300", 6);

      await expect(
        mockUSDT.connect(user1).transferFrom(owner.address, user2.address, transferAmount)
      ).to.be.reverted;
    });

    it("Should emit Approval events", async function () {
      const { mockUSDT, owner, user1 } = await loadFixture(deployMockUSDTFixture);

      const approvalAmount = hre.ethers.parseUnits("500", 6);

      await expect(
        mockUSDT.approve(user1.address, approvalAmount)
      ).to.emit(mockUSDT, "Approval")
       .withArgs(owner.address, user1.address, approvalAmount);
    });
  });

  describe("Integration with SavingsCore", function () {
    it("Should work with SavingsCore for deposits and withdrawals", async function () {
      const { mockUSDT, owner, user1 } = await loadFixture(deployMockUSDTFixture);

      // Deploy SavingsCore for integration test
      const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
      const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);
      await savingsCore.waitForDeployment();

      const transferAmount = hre.ethers.parseUnits("1000", 6); // 1000 USDT
      const depositAmount = hre.ethers.parseUnits("500", 6); // 500 USDT

      // Transfer USDT to user1
      await mockUSDT.transfer(user1.address, transferAmount);

      // user1 approves SavingsCore to spend USDT
      await mockUSDT.connect(user1).approve(savingsCore.target, depositAmount);

      // user1 deposits USDT into SavingsCore
      await expect(
        savingsCore.connect(user1)["deposit(address,uint256)"](mockUSDT.target, depositAmount)
      ).not.to.be.reverted;

      // Check that deposit worked
      const balance = await savingsCore.getTokenBalance(user1.address, mockUSDT.target);
      expect(balance).to.equal(depositAmount);

      // Check that USDT was transferred to SavingsCore
      expect(await mockUSDT.balanceOf(savingsCore.target)).to.equal(depositAmount);
      expect(await mockUSDT.balanceOf(user1.address)).to.equal(transferAmount - depositAmount);
    });

    it("Should handle USDT withdrawals from SavingsCore", async function () {
      const { mockUSDT, owner, user1 } = await loadFixture(deployMockUSDTFixture);

      // Deploy SavingsCore
      const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
      const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);
      await savingsCore.waitForDeployment();

      const transferAmount = hre.ethers.parseUnits("1000", 6);
      const depositAmount = hre.ethers.parseUnits("500", 6);
      const withdrawAmount = hre.ethers.parseUnits("200", 6);

      // Setup: transfer and deposit USDT
      await mockUSDT.transfer(user1.address, transferAmount);
      await mockUSDT.connect(user1).approve(savingsCore.target, depositAmount);
      await savingsCore.connect(user1)["deposit(address,uint256)"](mockUSDT.target, depositAmount);

      // Withdraw USDT
      await expect(
        savingsCore.connect(user1).withdraw(withdrawAmount, mockUSDT.target)
      ).not.to.be.reverted;

      // Check balances after withdrawal
      const remainingBalance = await savingsCore.getTokenBalance(user1.address, mockUSDT.target);
      expect(remainingBalance).to.equal(depositAmount - withdrawAmount);

      const userTokenBalance = await mockUSDT.balanceOf(user1.address);
      const expectedUserBalance = transferAmount - depositAmount + withdrawAmount;
      expect(userTokenBalance).to.equal(expectedUserBalance);
    });
  });
});