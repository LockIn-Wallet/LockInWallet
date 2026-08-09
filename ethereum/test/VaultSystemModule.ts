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

    // Vault rules live in the shared modules now, so a fixture that creates a
    // vault has to register them — the vault module fails closed without them.
    const deployShared = async (name: string) => {
      const f = await hre.ethers.getContractFactory(name);
      const proxy = await hre.upgrades.deployProxy(f, [savingsCore.target], { initializer: "initialize" });
      await proxy.waitForDeployment();
      return proxy;
    };
    const limitsModule = await deployShared("TimePeriodLimitsModule");
    const proposalModule2 = await deployShared("ProposalSystemModule");
    const bypassModule = await deployShared("BypassSystemModule");
    const reg = (id: string, t: any) => savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(id)), t);
    await reg("TIME_PERIOD_LIMITS", limitsModule.target);
    await reg("PROPOSAL_SYSTEM", proposalModule2.target);
    await reg("BYPASS_SYSTEM", bypassModule.target);
    await savingsCore.setupModuleCrossReferences();

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
      await expect(vaultModule.connect(user1).withdraw(1, 1n)).to.be.revertedWith("Exceeds limit");

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
      ).to.be.revertedWith("Exceeds limit");
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
      ).to.be.revertedWith("Exceeds limit");
      await vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("1"));

      // Next day the cap shrinks with the balance: 10% of 9 ETH = 0.9 ETH
      await time.increase(DAY + 1);
      await expect(
        vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("1"))
      ).to.be.revertedWith("Exceeds limit");
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

    it("excludes the withdrawer's remaining balance from their own penalty", async function () {
      const { vaultModule, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams({ vaultType: VAULT_TYPE_COMMUNITY }));
      await vaultModule.connect(user2).joinVault(1);

      const deposit = hre.ethers.parseEther("100");
      await vaultModule.connect(user1).deposit(1, deposit, { value: deposit });
      await vaultModule.connect(user2).deposit(1, deposit, { value: deposit });

      // Partial withdrawal: user1 keeps 50 ETH in the vault after paying a 10 ETH penalty
      await vaultModule.connect(user1).withdrawWithPenalty(1, hre.ethers.parseEther("50"));

      // The withdrawer must not be refunded any share of their own penalty
      expect(await vaultModule.pendingPenaltyRewards(1, user1.address)).to.equal(0);
      // user2's share: 10 ETH spread over the remaining 150 ETH, of which user2 holds 100.
      // Tolerance covers the 1e12 accumulator's truncation dust (< 1e-10 ETH per unit).
      const expected = (hre.ethers.parseEther("10") * deposit) / hre.ethers.parseEther("150");
      expect(await vaultModule.pendingPenaltyRewards(1, user2.address)).to.be.closeTo(expected, 10n ** 9n);
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

  describe("Permanent deposit addresses", function () {
    it("deploys one address per vault, creator only, once", async function () {
      const { vaultModule, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams());

      await expect(vaultModule.connect(user2).deployVaultDepositAddress(1))
        .to.be.revertedWith("Only creator");

      await expect(vaultModule.connect(user1).deployVaultDepositAddress(1))
        .to.emit(vaultModule, "VaultDepositAddressDeployed");
      const proxy = await vaultModule.getVaultDepositAddress(1);
      expect(proxy).to.not.equal(hre.ethers.ZeroAddress);

      await expect(vaultModule.connect(user1).deployVaultDepositAddress(1))
        .to.be.revertedWith("Already deployed");
    });

    it("credits ETH sent to the deposit address straight into the vault", async function () {
      const { vaultModule, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams());
      await vaultModule.connect(user1).deployVaultDepositAddress(1);
      const proxy = await vaultModule.getVaultDepositAddress(1);

      // Anyone (e.g. an exchange hot wallet) can send; the creator is credited
      const amount = hre.ethers.parseEther("2");
      await user2.sendTransaction({ to: proxy, value: amount });

      expect((await vaultModule.getVaultMember(1, user1.address)).balance).to.equal(amount);
      expect((await vaultModule.getVault(1)).totalBalance).to.equal(amount);
    });

    it("sweeps ERC20 tokens sent to the deposit address into the vault", async function () {
      const { vaultModule, usdt, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams({
        token: usdt.target,
        dailyLimit: hre.ethers.parseUnits("100", 6),
        weeklyLimit: 0,
        monthlyLimit: 0,
      }));
      await vaultModule.connect(user1).deployVaultDepositAddress(1);
      const proxyAddress = await vaultModule.getVaultDepositAddress(1);

      const amount = hre.ethers.parseUnits("500", 6);
      await usdt.connect(user2).transfer(proxyAddress, amount);

      // Permissionless sweep credits the vault creator
      const proxy = await hre.ethers.getContractAt("VaultDepositProxy", proxyAddress);
      await proxy.connect(user2).sweepERC20(usdt.target);

      expect((await vaultModule.getVaultMember(1, user1.address)).balance).to.equal(amount);
      await expect(proxy.sweepERC20(usdt.target)).to.be.revertedWith("Nothing to sweep");
    });

    it("rejects depositFor to a non-member beneficiary", async function () {
      const { vaultModule, user1, user2 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams());
      await expect(
        vaultModule.connect(user2).depositFor(1, 100, user2.address, { value: 100 })
      ).to.be.revertedWith("Not a vault member");
    });
  });

  describe("Rule updates", function () {

    it("keeps community vault rules immutable, even for the creator", async function () {
      const { vaultModule, user1 } = await loadFixture(deployVaultSystemFixture);
      await vaultModule.connect(user1).createVault(ethVaultParams({ vaultType: VAULT_TYPE_COMMUNITY }));
      await expect(
        vaultModule.connect(user1).proposeVaultLimitChange(1, "Daily", 100)
      ).to.be.revertedWith("Community rules immutable");
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

describe("VaultSystemModule — shared withdrawal addresses", function () {
  async function deployWithApprovalFixture() {
    const [owner, user1, user2, stranger] = await hre.ethers.getSigners();

    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);

    const VaultSystemModule = await hre.ethers.getContractFactory("VaultSystemModule");
    const vaultModule = await hre.upgrades.deployProxy(VaultSystemModule, [savingsCore.target]);
    await savingsCore.registerModule(
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("VAULT_SYSTEM")),
      vaultModule.target,
    );

    // Vault rules live in the shared modules now, so a fixture that creates a
    // vault has to register them — the vault module fails closed without them.
    const deployShared = async (name: string) => {
      const f = await hre.ethers.getContractFactory(name);
      const proxy = await hre.upgrades.deployProxy(f, [savingsCore.target], { initializer: "initialize" });
      await proxy.waitForDeployment();
      return proxy;
    };
    const limitsModule = await deployShared("TimePeriodLimitsModule");
    const proposalModule2 = await deployShared("ProposalSystemModule");
    const bypassModule = await deployShared("BypassSystemModule");
    const reg = (id: string, t: any) => savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(id)), t);
    await reg("TIME_PERIOD_LIMITS", limitsModule.target);
    await reg("PROPOSAL_SYSTEM", proposalModule2.target);
    await reg("BYPASS_SYSTEM", bypassModule.target);
    await savingsCore.setupModuleCrossReferences();

    const ApprovalSystemModule = await hre.ethers.getContractFactory("ApprovalSystemModule");
    const approvalModule = await hre.upgrades.deployProxy(ApprovalSystemModule, [savingsCore.target]);
    await savingsCore.registerModule(
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("APPROVAL_SYSTEM")),
      approvalModule.target,
    );

    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    await usdt.transfer(user1.address, hre.ethers.parseUnits("10000", 6));

    // A funded personal vault to withdraw from.
    await vaultModule.connect(user1).createVault({
      name: "Savings",
      description: "",
      vaultType: VAULT_TYPE_PERSONAL,
      token: usdt.target,
      dailyLimit: hre.ethers.parseUnits("10000", 6),
      weeklyLimit: hre.ethers.parseUnits("10000", 6),
      monthlyLimit: hre.ethers.parseUnits("10000", 6),
      limitsArePercentage: false,
      penaltyRateBps: 2000,
    });
    await usdt.connect(user1).approve(vaultModule.target, hre.ethers.parseUnits("1000", 6));
    await vaultModule.connect(user1).deposit(1, hre.ethers.parseUnits("1000", 6));

    return { savingsCore, vaultModule, approvalModule, usdt, owner, user1, user2, stranger };
  }

  it("pays a vault withdrawal to your own address without any approval", async function () {
    const { vaultModule, usdt, user1 } = await loadFixture(deployWithApprovalFixture);
    const before = await usdt.balanceOf(user1.address);

    await vaultModule.connect(user1).withdrawTo(1, hre.ethers.parseUnits("100", 6), user1.address);

    expect((await usdt.balanceOf(user1.address)) - before).to.equal(hre.ethers.parseUnits("100", 6));
  });

  it("refuses a destination the member has not saved", async function () {
    const { vaultModule, stranger, user1 } = await loadFixture(deployWithApprovalFixture);

    await expect(
      vaultModule.connect(user1).withdrawTo(1, hre.ethers.parseUnits("100", 6), stranger.address),
    ).to.be.revertedWith("Withdrawal address not approved");
  });

  it("accepts a destination from the member's existing savings list", async function () {
    // The point of the shared list: an address saved for the savings account
    // works in every vault, with no per-vault re-approval.
    const { vaultModule, approvalModule, usdt, user1, user2 } =
      await loadFixture(deployWithApprovalFixture);
    await approvalModule.connect(user1).addWithdrawalAddressDirect(user1.address, "Cold", user2.address);

    const before = await usdt.balanceOf(user2.address);
    await vaultModule.connect(user1).withdrawTo(1, hre.ethers.parseUnits("250", 6), user2.address);

    expect((await usdt.balanceOf(user2.address)) - before).to.equal(hre.ethers.parseUnits("250", 6));
  });

  it("keeps one member's saved list from authorising another's withdrawal", async function () {
    const { vaultModule, approvalModule, user1, user2, stranger } =
      await loadFixture(deployWithApprovalFixture);
    // user2 approves the stranger — that must not help user1.
    await approvalModule.connect(user2).addWithdrawalAddressDirect(user2.address, "Theirs", stranger.address);

    await expect(
      vaultModule.connect(user1).withdrawTo(1, hre.ethers.parseUnits("100", 6), stranger.address),
    ).to.be.revertedWith("Withdrawal address not approved");
  });

  it("rejects the zero address", async function () {
    const { vaultModule, user1 } = await loadFixture(deployWithApprovalFixture);
    await expect(
      vaultModule.connect(user1).withdrawTo(1, hre.ethers.parseUnits("100", 6), hre.ethers.ZeroAddress),
    ).to.be.revertedWith("Invalid destination");
  });

  it("still enforces the vault's spending limits on a whitelisted destination", async function () {
    // A saved address is not a way around the limits.
    const { vaultModule, approvalModule, user1, user2 } =
      await loadFixture(deployWithApprovalFixture);
    await approvalModule.connect(user1).addWithdrawalAddressDirect(user1.address, "Cold", user2.address);

    await expect(
      vaultModule.connect(user1).withdrawTo(1, hre.ethers.parseUnits("5000", 6), user2.address),
    ).to.be.revertedWith("Invalid amount");
  });
});

describe("VaultSystemModule — rules reuse the savings account's modules", function () {
  const DAY = 86400;

  async function fixture() {
    const [owner, user1, user2] = await hre.ethers.getSigners();
    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);
    const deploy = async (n: string) => {
      const f = await hre.ethers.getContractFactory(n);
      const p = await hre.upgrades.deployProxy(f, [savingsCore.target], { initializer: "initialize" });
      await p.waitForDeployment();
      return p;
    };
    const vaultModule = await deploy("VaultSystemModule");
    const limits = await deploy("TimePeriodLimitsModule");
    const proposals = await deploy("ProposalSystemModule");
    const bypass = await deploy("BypassSystemModule");
    const reg = (id: string, t: any) =>
      savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(id)), t);
    await reg("VAULT_SYSTEM", vaultModule.target);
    await reg("TIME_PERIOD_LIMITS", limits.target);
    await reg("PROPOSAL_SYSTEM", proposals.target);
    await reg("BYPASS_SYSTEM", bypass.target);
    await savingsCore.setupModuleCrossReferences();
    await savingsCore.setDevelopmentMode(false); // real waits

    await vaultModule.connect(user1).createVault({
      name: "Savings", description: "", vaultType: VAULT_TYPE_PERSONAL,
      token: hre.ethers.ZeroAddress,
      dailyLimit: hre.ethers.parseEther("1"),
      weeklyLimit: hre.ethers.parseEther("5"),
      monthlyLimit: hre.ethers.parseEther("15"),
      limitsArePercentage: false, penaltyRateBps: 2000,
    });
    await vaultModule.connect(user1).deposit(1, hre.ethers.parseEther("10"), {
      value: hre.ethers.parseEther("10"),
    });
    return { savingsCore, vaultModule, limits, proposals, owner, user1, user2 };
  }

  it("stores a vault's rules in the shared limits module, under its own scope", async function () {
    const { vaultModule, limits, user1 } = await loadFixture(fixture);
    const scope = await vaultModule.vaultScopeOf(1, user1.address);

    expect(await limits.findPeriodLimit(scope, "Daily")).to.equal(hre.ethers.parseEther("1"));
    expect(await limits.findPeriodLimit(scope, "Weekly")).to.equal(hre.ethers.parseEther("5"));
  });

  it("keeps a vault scope distinct from the member's own savings account", async function () {
    // A collision would merge a vault's rules with someone's account, so the
    // derivation is domain-separated rather than merely improbable.
    const { vaultModule, limits, user1 } = await loadFixture(fixture);
    const scope = await vaultModule.vaultScopeOf(1, user1.address);

    expect(scope).to.not.equal(user1.address);
    expect(await limits.findPeriodLimit(user1.address, "Daily")).to.equal(0);
  });

  it("gives every member their own scope, so counters are never shared", async function () {
    const { vaultModule, user1, user2 } = await loadFixture(fixture);
    expect(await vaultModule.vaultScopeOf(1, user1.address)).to.not.equal(
      await vaultModule.vaultScopeOf(1, user2.address),
    );
    expect(await vaultModule.vaultScopeOf(1, user1.address)).to.not.equal(
      await vaultModule.vaultScopeOf(2, user1.address),
    );
  });

  it("enforces the vault's limits through the shared module", async function () {
    const { vaultModule, user1 } = await loadFixture(fixture);
    await expect(
      vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("1.1")),
    ).to.be.revertedWith("Exceeds limit");
    await vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("1"));
  });

  it("locks a vault in at creation, so no limit can be rewritten on the spot", async function () {
    // This is what makes every later change serve the timelock — the same
    // state the savings account reaches when its owner locks in.
    const { vaultModule, limits, user1 } = await loadFixture(fixture);
    const scope = await vaultModule.vaultScopeOf(1, user1.address);

    await expect(
      limits.connect(user1).setPeriodLimit(scope, "Daily", hre.ethers.parseEther("100"), DAY, DAY),
    ).to.be.revertedWith("Not authorized");
  });

  it("makes raising a vault limit serve the wait, then apply", async function () {
    const { vaultModule, limits, proposals, user1 } = await loadFixture(fixture);
    const scope = await vaultModule.vaultScopeOf(1, user1.address);

    const tx = await vaultModule
      .connect(user1)
      .proposeVaultLimitChange(1, "Daily", hre.ethers.parseEther("3"));
    await tx.wait();
    // Read it back from the proposal module — the vault's pending changes are
    // stored there, not in the vault module, which is the whole point.
    const [proposalIds] = await proposals.getUserPendingProposals(scope);
    expect(proposalIds.length).to.equal(1);
    const proposalId = proposalIds[0];

    // Still the old cap until the wait is served.
    await expect(
      vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("1.1")),
    ).to.be.revertedWith("Exceeds limit");
    await expect(
      vaultModule.connect(user1).executeVaultLimitProposal(1, proposalId),
    ).to.be.revertedWith("Still in timelock");

    await time.increase(DAY);
    await vaultModule.connect(user1).executeVaultLimitProposal(1, proposalId);
    expect(await limits.findPeriodLimit(scope, "Daily")).to.equal(hre.ethers.parseEther("3"));
  });

  it("fails closed when the limits module is not registered", async function () {
    // A vault whose limit check silently no-opped would be worse than having
    // no limits, because the app would still promise them.
    const { savingsCore, vaultModule, user1 } = await loadFixture(fixture);
    await savingsCore.unregisterModule(
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TIME_PERIOD_LIMITS")),
    );
    await expect(
      vaultModule.connect(user1).withdraw(1, hre.ethers.parseEther("0.1")),
    ).to.be.revertedWith("Limits module not registered");
  });
});
