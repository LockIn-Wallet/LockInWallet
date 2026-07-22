import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const VAULT_TYPE_PERSONAL = 0;
const VAULT_TYPE_COMMUNITY = 1;
const DAY = 24 * 60 * 60;
const WEEK = 7 * DAY;

describe("VaultSystemModule", function () {
  async function deployVaultSystemFixture() {
    const [owner, user1, user2, user3] = await hre.ethers.getSigners();

    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);
    await savingsCore.waitForDeployment();

    const VaultSystemModule = await hre.ethers.getContractFactory("VaultSystemModule");
    const vaultModule = await hre.upgrades.deployProxy(VaultSystemModule, [savingsCore.target], { initializer: "initialize" });
    await vaultModule.waitForDeployment();

    const vaultModuleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("VAULT_SYSTEM"));
    await savingsCore.registerModule(vaultModuleId, vaultModule.target);

    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    await usdt.waitForDeployment();

    // Fund users with USDT
    const usdtAmount = hre.ethers.parseUnits("10000", 6);
    await usdt.transfer(user1.address, usdtAmount);
    await usdt.transfer(user2.address, usdtAmount);

    return { savingsCore, vaultModule, usdt, owner, user1, user2, user3 };
  }

  function ethVaultParams(overrides: Record<string, unknown> = {}) {
    return {
      name: "Personal Savings",
      description: "My savings vault",
      vaultType: VAULT_TYPE_PERSONAL,
      token: hre.ethers.ZeroAddress,
      dailyLimit: hre.ethers.parseEther("1"),
      weeklyLimit: hre.ethers.parseEther("5"),
      monthlyLimit: hre.ethers.parseEther("15"),
      limitsArePercentage: false,
      penaltyRateBps: 2000,
      ...overrides,
    };
  }

  describe("Vault creation", function () {
    it("creates a personal ETH vault and auto-joins the creator", async function () {
      const { vaultModule, user1 } = await loadFixture(deployVaultSystemFixture);

      await expect(vaultModule.connect(user1).createVault(ethVaultParams()))
        .to.emit(vaultModule, "VaultCreated")
        .withArgs(1, user1.address, hre.ethers.ZeroAddress, "Personal Savings", VAULT_TYPE_PERSONAL);

      const vault = await vaultModule.getVault(1);
      expect(vault.creator).to.equal(user1.address);
      expect(vault.name).to.equal("Personal Savings");
      expect(vault.memberCount).to.equal(1);
      expect(vault.isActive).to.equal(true);

      const member = await vaultModule.getVaultMember(1, user1.address);
      expect(member.exists).to.equal(true);
      expect(await vaultModule.getUserVaultIds(user1.address)).to.deep.equal([1n]);
      expect(await vaultModule.getVaultMembers(1)).to.deep.equal([user1.address]);
    });

    it("assigns sequential vault ids", async function () {
      const { vaultModule, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams());
      await vaultModule.connect(user2).createVault(ethVaultParams({ name: "Gambling" }));
      expect(await vaultModule.getVaultCount()).to.equal(2);
      expect((await vaultModule.getVault(2)).name).to.equal("Gambling");
    });

    it("rejects invalid parameters", async function () {
      const { vaultModule, user1 } = await loadFixture(deployVaultSystemFixture);
      const create = (overrides: Record<string, unknown>) =>
        vaultModule.connect(user1).createVault(ethVaultParams(overrides));

      await expect(create({ name: "" })).to.be.revertedWith("Invalid name");
      await expect(create({ name: "x".repeat(33) })).to.be.revertedWith("Invalid name");
      await expect(create({ dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 0 })).to.be.revertedWith("No limits set");
      await expect(create({ penaltyRateBps: 0 })).to.be.revertedWith("Invalid penalty rate");
      await expect(create({ penaltyRateBps: 5001 })).to.be.revertedWith("Invalid penalty rate");
      await expect(create({ dailyLimit: 10, weeklyLimit: 5 })).to.be.revertedWith("Weekly below daily");
      await expect(create({ dailyLimit: 0, weeklyLimit: 10, monthlyLimit: 5 })).to.be.revertedWith("Monthly below weekly");
      await expect(create({ dailyLimit: 10, weeklyLimit: 0, monthlyLimit: 5 })).to.be.revertedWith("Monthly below daily");
      await expect(create({ limitsArePercentage: true, dailyLimit: 10001 })).to.be.revertedWith("Limit exceeds 100%");
      await expect(create({ vaultType: 2 })).to.be.revertedWith("Invalid vault type");
    });
  });

  describe("Membership", function () {
    it("allows joining a community vault but not a personal vault", async function () {
      const { vaultModule, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams({ vaultType: VAULT_TYPE_COMMUNITY }));
      await vaultModule.connect(user1).createVault(ethVaultParams());

      await expect(vaultModule.connect(user2).joinVault(1))
        .to.emit(vaultModule, "VaultJoined").withArgs(1, user2.address);
      expect((await vaultModule.getVault(1)).memberCount).to.equal(2);

      await expect(vaultModule.connect(user2).joinVault(2)).to.be.revertedWith("Personal vault");
      await expect(vaultModule.connect(user2).joinVault(1)).to.be.revertedWith("Already a member");
    });

    it("allows leaving only with zero balance and blocks the creator", async function () {
      const { vaultModule, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams({ vaultType: VAULT_TYPE_COMMUNITY }));
      await vaultModule.connect(user2).joinVault(1);

      const amount = hre.ethers.parseEther("1");
      await vaultModule.connect(user2).deposit(1, amount, { value: amount });
      await expect(vaultModule.connect(user2).leaveVault(1)).to.be.revertedWith("Balance not zero");

      await vaultModule.connect(user2).withdraw(1, amount);
      await expect(vaultModule.connect(user2).leaveVault(1))
        .to.emit(vaultModule, "VaultLeft").withArgs(1, user2.address);
      expect((await vaultModule.getVault(1)).memberCount).to.equal(1);
      expect(await vaultModule.getUserVaultIds(user2.address)).to.deep.equal([]);
      expect(await vaultModule.getVaultMembers(1)).to.deep.equal([user1.address]);

      await expect(vaultModule.connect(user1).leaveVault(1)).to.be.revertedWith("Creator cannot leave");
    });
  });

  describe("Deposits", function () {
    it("accepts ETH deposits with exact msg.value", async function () {
      const { vaultModule, user1 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams());
      const amount = hre.ethers.parseEther("2");

      await expect(vaultModule.connect(user1).deposit(1, amount, { value: amount }))
        .to.emit(vaultModule, "VaultDeposit").withArgs(1, user1.address, amount);
      expect((await vaultModule.getVaultMember(1, user1.address)).balance).to.equal(amount);
      expect((await vaultModule.getVault(1)).totalBalance).to.equal(amount);

      await expect(
        vaultModule.connect(user1).deposit(1, amount, { value: amount - 1n })
      ).to.be.revertedWith("Incorrect ETH amount");
    });

    it("accepts ERC20 deposits and rejects stray ETH", async function () {
      const { vaultModule, usdt, user1 } = await loadFixture(deployVaultSystemFixture);
      const amount = hre.ethers.parseUnits("1000", 6);
      await vaultModule.connect(user1).createVault(ethVaultParams({
        token: usdt.target,
        dailyLimit: hre.ethers.parseUnits("100", 6),
        weeklyLimit: 0,
        monthlyLimit: 0,
      }));

      await usdt.connect(user1).approve(vaultModule.target, amount);
      await vaultModule.connect(user1).deposit(1, amount);
      expect((await vaultModule.getVaultMember(1, user1.address)).balance).to.equal(amount);
      expect(await usdt.balanceOf(vaultModule.target)).to.equal(amount);

      await expect(
        vaultModule.connect(user1).deposit(1, 100, { value: 100 })
      ).to.be.revertedWith("ETH not accepted");
    });

    it("rejects deposits from non-members", async function () {
      const { vaultModule, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams());
      await expect(
        vaultModule.connect(user2).deposit(1, 100, { value: 100 })
      ).to.be.revertedWith("Not a vault member");
    });
  });

  describe("Fixed-amount withdrawal limits", function () {
    it("enforces the daily limit and resets after the window elapses", async function () {
      const { vaultModule, user1 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams());
      const deposit = hre.ethers.parseEther("10");
      await vaultModule.connect(user1).deposit(1, deposit, { value: deposit });

      const daily = hre.ethers.parseEther("1");
      await expect(vaultModule.connect(user1).withdraw(1, daily))
        .to.changeEtherBalance(user1, daily);
      await expect(vaultModule.connect(user1).withdraw(1, 1n)).to.be.revertedWith("Daily limit exceeded");

      await time.increase(DAY + 1);
      await expect(vaultModule.connect(user1).withdraw(1, daily))
        .to.changeEtherBalance(user1, daily);
    });

    it("enforces the weekly limit across multiple days", async function () {
      const { vaultModule, user1 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams({
        dailyLimit: hre.ethers.parseEther("2"),
        weeklyLimit: hre.ethers.parseEther("3"),
        monthlyLimit: 0,
      }));
      const deposit = hre.ethers.parseEther("10");
      await vaultModule.connect(user1).deposit(1, deposit, { value: deposit });

      await vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("2"));
      await time.increase(DAY + 1);
      // Daily window has reset, but only 1 ETH remains within the weekly window
      await expect(
        vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("2"))
      ).to.be.revertedWith("Weekly limit exceeded");
      await vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("1"));

      await time.increase(WEEK + 1);
      await vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("2"));
    });

    it("rejects withdrawals above the member balance", async function () {
      const { vaultModule, user1 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams());
      await vaultModule.connect(user1).deposit(1, 100, { value: 100 });
      await expect(vaultModule.connect(user1).withdraw(1, 101)).to.be.revertedWith("Invalid amount");
    });
  });

  describe("Percentage-based withdrawal limits", function () {
    it("limits withdrawals to a share of the member balance", async function () {
      const { vaultModule, user1 } = await loadFixture(deployVaultSystemFixture);
      // 10% daily of balance
      await vaultModule.connect(user1).createVault(ethVaultParams({
        limitsArePercentage: true,
        dailyLimit: 1000,
        weeklyLimit: 0,
        monthlyLimit: 0,
      }));
      const deposit = hre.ethers.parseEther("10");
      await vaultModule.connect(user1).deposit(1, deposit, { value: deposit });

      // 10% of 10 ETH = 1 ETH
      await expect(
        vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("1") + 1n)
      ).to.be.revertedWith("Daily limit exceeded");
      await vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("1"));

      // Next day the cap shrinks with the balance: 10% of 9 ETH = 0.9 ETH
      await time.increase(DAY + 1);
      await expect(
        vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("1"))
      ).to.be.revertedWith("Daily limit exceeded");
      await vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("0.9"));
    });
  });

  describe("Penalty withdrawals", function () {
    it("bypasses limits and sends the penalty to the treasury for personal vaults", async function () {
      const { vaultModule, owner, user1 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams());
      const deposit = hre.ethers.parseEther("10");
      await vaultModule.connect(user1).deposit(1, deposit, { value: deposit });

      // 5 ETH is far above the 1 ETH daily limit; 20% penalty applies
      const amount = hre.ethers.parseEther("5");
      const penalty = hre.ethers.parseEther("1");
      await expect(vaultModule.connect(user1).withdrawWithPenalty(1, amount))
        .to.changeEtherBalances([user1, owner], [amount - penalty, penalty]);
      expect((await vaultModule.getVaultMember(1, user1.address)).balance).to.equal(deposit - amount);
    });

    it("redistributes the penalty to remaining community members", async function () {
      const { vaultModule, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams({ vaultType: VAULT_TYPE_COMMUNITY }));
      await vaultModule.connect(user2).joinVault(1);

      const deposit = hre.ethers.parseEther("4");
      await vaultModule.connect(user1).deposit(1, deposit, { value: deposit });
      await vaultModule.connect(user2).deposit(1, deposit, { value: deposit });

      // user1 withdraws all 4 ETH with 20% penalty => 0.8 ETH spread over user2's 4 ETH
      const amount = hre.ethers.parseEther("4");
      const penalty = hre.ethers.parseEther("0.8");
      await expect(vaultModule.connect(user1).withdrawWithPenalty(1, amount))
        .to.changeEtherBalance(user1, amount - penalty);

      expect(await vaultModule.pendingPenaltyRewards(1, user2.address)).to.equal(penalty);
      expect(await vaultModule.pendingPenaltyRewards(1, user1.address)).to.equal(0);

      await expect(vaultModule.connect(user2).claimPenaltyRewards(1))
        .to.changeEtherBalance(user2, penalty);
      expect(await vaultModule.pendingPenaltyRewards(1, user2.address)).to.equal(0);
      await expect(vaultModule.connect(user2).claimPenaltyRewards(1)).to.be.revertedWith("Nothing to claim");
    });

    it("falls back to the treasury when no balance remains to redistribute", async function () {
      const { vaultModule, owner, user1 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams({ vaultType: VAULT_TYPE_COMMUNITY }));
      const deposit = hre.ethers.parseEther("2");
      await vaultModule.connect(user1).deposit(1, deposit, { value: deposit });

      const penalty = hre.ethers.parseEther("0.4");
      await expect(vaultModule.connect(user1).withdrawWithPenalty(1, deposit))
        .to.changeEtherBalances([user1, owner], [deposit - penalty, penalty]);
    });

    it("handles ERC20 penalty redistribution", async function () {
      const { vaultModule, usdt, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      const dailyLimit = hre.ethers.parseUnits("100", 6);
      await vaultModule.connect(user1).createVault(ethVaultParams({
        vaultType: VAULT_TYPE_COMMUNITY,
        token: usdt.target,
        dailyLimit,
        weeklyLimit: 0,
        monthlyLimit: 0,
      }));
      await vaultModule.connect(user2).joinVault(1);

      const deposit = hre.ethers.parseUnits("1000", 6);
      await usdt.connect(user1).approve(vaultModule.target, deposit);
      await vaultModule.connect(user1).deposit(1, deposit);
      await usdt.connect(user2).approve(vaultModule.target, deposit);
      await vaultModule.connect(user2).deposit(1, deposit);

      const amount = hre.ethers.parseUnits("500", 6);
      const penalty = hre.ethers.parseUnits("100", 6);
      await expect(vaultModule.connect(user1).withdrawWithPenalty(1, amount))
        .to.changeTokenBalance(usdt, user1, amount - penalty);

      // Penalty spreads over the remaining 1500 USDT: user2 holds 1000/1500
      const user2Share = (penalty * deposit) / (deposit + deposit - amount);
      const pending = await vaultModule.pendingPenaltyRewards(1, user2.address);
      expect(pending).to.be.closeTo(user2Share, 10);
      await expect(vaultModule.connect(user2).claimPenaltyRewards(1))
        .to.changeTokenBalance(usdt, user2, pending);
    });
  });

  describe("Rule updates", function () {
    it("lets only the creator update rules, with validation", async function () {
      const { vaultModule, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams({ vaultType: VAULT_TYPE_COMMUNITY }));
      await vaultModule.connect(user2).joinVault(1);

      await expect(
        vaultModule.connect(user2).updateVaultRules(1, 100, 200, 300, false, 1000)
      ).to.be.revertedWith("Only creator");
      await expect(
        vaultModule.connect(user1).updateVaultRules(1, 0, 0, 0, false, 1000)
      ).to.be.revertedWith("No limits set");

      await expect(vaultModule.connect(user1).updateVaultRules(1, 100, 200, 300, false, 1000))
        .to.emit(vaultModule, "VaultRulesUpdated").withArgs(1);
      const vault = await vaultModule.getVault(1);
      expect(vault.dailyLimit).to.equal(100);
      expect(vault.penaltyRateBps).to.equal(1000);
    });
  });

  describe("Administration", function () {
    it("lets only the owner change the treasury", async function () {
      const { vaultModule, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      await expect(vaultModule.connect(user1).setTreasury(user2.address))
        .to.be.revertedWithCustomError(vaultModule, "OwnableUnauthorizedAccount");
      await vaultModule.setTreasury(user2.address);
      expect(await vaultModule.treasury()).to.equal(user2.address);
    });
  });
});
