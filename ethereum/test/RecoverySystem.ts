import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("RecoverySystemModule", function () {
  // user1 = account key (potentially compromised), recoveryKey = cold key
  async function deployRecoveryFixture() {
    const [owner, user1, recoveryKey, attackerKey, newOwner] = await hre.ethers.getSigners();

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

    const RecoverySystemModule = await hre.ethers.getContractFactory("RecoverySystemModule");
    const recoveryModule = await hre.upgrades.deployProxy(RecoverySystemModule, [savingsCore.target], { initializer: "initialize" });
    await recoveryModule.waitForDeployment();

    const registrations: [string, { target: unknown }][] = [
      ["TIME_PERIOD_LIMITS", timeLimitsModule],
      ["PROPOSAL_SYSTEM", proposalModule],
      ["BYPASS_SYSTEM", bypassModule],
      ["APPROVAL_SYSTEM", approvalModule],
      ["RECOVERY_SYSTEM", recoveryModule],
    ];
    for (const [idString, module] of registrations) {
      await savingsCore.registerModule(
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes(idString)),
        module.target
      );
    }
    await savingsCore.setupModuleCrossReferences();

    const depositAmount = hre.ethers.parseEther("10.0");
    await savingsCore.connect(user1)["deposit(address,uint256)"](hre.ethers.ZeroAddress, depositAmount, { value: depositAmount });

    // Dev-mode timelocks: recovery key change 60s, withdrawal address 10s
    const RECOVERY_CHANGE_DELAY = 61;

    return {
      savingsCore,
      timeLimitsModule,
      proposalModule,
      bypassModule,
      approvalModule,
      recoveryModule,
      owner,
      user1,
      recoveryKey,
      attackerKey,
      newOwner,
      depositAmount,
      RECOVERY_CHANGE_DELAY,
    };
  }

  async function deployWithRecoverySetFixture() {
    const fixture = await deployRecoveryFixture();
    await fixture.recoveryModule.connect(fixture.user1).setRecoveryAddress(fixture.recoveryKey.address);
    await fixture.recoveryModule.connect(fixture.recoveryKey).acceptRecoveryRole(fixture.user1.address);
    return fixture;
  }

  describe("Recovery key registration (propose + accept)", function () {
    it("Should propose a recovery key without activating it", async function () {
      const { recoveryModule, user1, recoveryKey } = await loadFixture(deployRecoveryFixture);

      await expect(recoveryModule.connect(user1).setRecoveryAddress(recoveryKey.address))
        .to.emit(recoveryModule, "RecoveryKeyProposed")
        .withArgs(user1.address, recoveryKey.address, user1.address);

      // Not active yet: no freeze power until the key proves itself
      const [recovery] = await recoveryModule.getRecoveryConfig(user1.address);
      expect(recovery).to.equal(hre.ethers.ZeroAddress);
      expect(await recoveryModule.getPendingRecoveryKey(user1.address)).to.equal(recoveryKey.address);
      await expect(recoveryModule.connect(user1).freeze(user1.address))
        .to.be.revertedWith("No recovery key set");
    });

    it("Should activate on acceptance by the proposed key", async function () {
      const { recoveryModule, user1, recoveryKey } = await loadFixture(deployRecoveryFixture);

      await recoveryModule.connect(user1).setRecoveryAddress(recoveryKey.address);
      await expect(recoveryModule.connect(recoveryKey).acceptRecoveryRole(user1.address))
        .to.emit(recoveryModule, "RecoveryAddressSet")
        .withArgs(user1.address, recoveryKey.address, recoveryKey.address);

      const [recovery, frozen, recovered] = await recoveryModule.getRecoveryConfig(user1.address);
      expect(recovery).to.equal(recoveryKey.address);
      expect(frozen).to.be.false;
      expect(recovered).to.be.false;
      expect(await recoveryModule.getPendingRecoveryKey(user1.address)).to.equal(hre.ethers.ZeroAddress);
    });

    it("Should reject acceptance from anyone but the proposed key", async function () {
      const { recoveryModule, user1, recoveryKey, attackerKey } = await loadFixture(deployRecoveryFixture);

      await recoveryModule.connect(user1).setRecoveryAddress(recoveryKey.address);
      await expect(recoveryModule.connect(attackerKey).acceptRecoveryRole(user1.address))
        .to.be.revertedWith("Not the proposed recovery key");
    });

    it("Should let the user overwrite or cancel a not-yet-accepted proposal", async function () {
      const { recoveryModule, user1, recoveryKey, newOwner } = await loadFixture(deployRecoveryFixture);

      // Typo'd first proposal, overwritten by a second one
      await recoveryModule.connect(user1).setRecoveryAddress(newOwner.address);
      await recoveryModule.connect(user1).setRecoveryAddress(recoveryKey.address);
      expect(await recoveryModule.getPendingRecoveryKey(user1.address)).to.equal(recoveryKey.address);
      await expect(recoveryModule.connect(newOwner).acceptRecoveryRole(user1.address))
        .to.be.revertedWith("Not the proposed recovery key");

      await expect(recoveryModule.connect(user1).cancelRecoveryKeyProposal())
        .to.emit(recoveryModule, "RecoveryKeyProposalCancelled")
        .withArgs(user1.address);
      await expect(recoveryModule.connect(recoveryKey).acceptRecoveryRole(user1.address))
        .to.be.revertedWith("Not the proposed recovery key");
    });

    it("Should reject zero or self as recovery key", async function () {
      const { recoveryModule, user1 } = await loadFixture(deployRecoveryFixture);

      await expect(recoveryModule.connect(user1).setRecoveryAddress(hre.ethers.ZeroAddress))
        .to.be.revertedWith("Invalid recovery address");
      await expect(recoveryModule.connect(user1).setRecoveryAddress(user1.address))
        .to.be.revertedWith("Recovery key must differ from account key");
    });

    it("Should not allow replacing an existing recovery key instantly", async function () {
      const { recoveryModule, user1, attackerKey } = await loadFixture(deployWithRecoverySetFixture);

      await expect(recoveryModule.connect(user1).setRecoveryAddress(attackerKey.address))
        .to.be.revertedWith("Recovery key already set - use timelocked change");
    });

    it("Should rotate the recovery key with the old key active until the new one accepts", async function () {
      const { recoveryModule, user1, recoveryKey, newOwner } = await loadFixture(deployWithRecoverySetFixture);

      await expect(recoveryModule.connect(recoveryKey).updateRecoveryAddress(user1.address, newOwner.address))
        .to.emit(recoveryModule, "RecoveryKeyProposed")
        .withArgs(user1.address, newOwner.address, recoveryKey.address);

      // Old key still active while the new one hasn't accepted
      let [recovery] = await recoveryModule.getRecoveryConfig(user1.address);
      expect(recovery).to.equal(recoveryKey.address);

      await recoveryModule.connect(newOwner).acceptRecoveryRole(user1.address);
      [recovery] = await recoveryModule.getRecoveryConfig(user1.address);
      expect(recovery).to.equal(newOwner.address);
    });

    it("Should not let the account key call updateRecoveryAddress", async function () {
      const { recoveryModule, user1, attackerKey } = await loadFixture(deployWithRecoverySetFixture);

      await expect(recoveryModule.connect(user1).updateRecoveryAddress(user1.address, attackerKey.address))
        .to.be.revertedWith("Only recovery key");
    });
  });

  describe("Freeze", function () {
    it("Should require a recovery key before freezing", async function () {
      const { recoveryModule, user1 } = await loadFixture(deployRecoveryFixture);

      await expect(recoveryModule.connect(user1).freeze(user1.address))
        .to.be.revertedWith("No recovery key set");
    });

    it("Should freeze from either the account key or the recovery key", async function () {
      const { recoveryModule, user1, recoveryKey } = await loadFixture(deployWithRecoverySetFixture);

      await expect(recoveryModule.connect(recoveryKey).freeze(user1.address))
        .to.emit(recoveryModule, "AccountFrozen")
        .withArgs(user1.address, recoveryKey.address);
      expect(await recoveryModule.isFrozen(user1.address)).to.be.true;
    });

    it("Should reject freeze from unrelated accounts", async function () {
      const { recoveryModule, user1, attackerKey } = await loadFixture(deployWithRecoverySetFixture);

      await expect(recoveryModule.connect(attackerKey).freeze(user1.address))
        .to.be.revertedWith("Not authorized");
    });

    it("Should block withdrawals while frozen but still accept deposits", async function () {
      const { savingsCore, recoveryModule, user1, recoveryKey } = await loadFixture(deployWithRecoverySetFixture);

      await recoveryModule.connect(recoveryKey).freeze(user1.address);

      await expect(savingsCore.connect(user1)["withdraw(uint256,address)"](hre.ethers.parseEther("1.0"), hre.ethers.ZeroAddress))
        .to.be.revertedWith("Account is frozen");
      await expect(savingsCore.connect(user1).withdrawTo(hre.ethers.parseEther("1.0"), hre.ethers.ZeroAddress, user1.address))
        .to.be.revertedWith("Account is frozen");

      const extra = hre.ethers.parseEther("1.0");
      await expect(savingsCore.connect(user1)["deposit(address,uint256)"](hre.ethers.ZeroAddress, extra, { value: extra }))
        .not.to.be.reverted;
    });

    it("Should block bypass and withdrawal-address flows while frozen", async function () {
      const { bypassModule, approvalModule, recoveryModule, timeLimitsModule, user1, recoveryKey, attackerKey } =
        await loadFixture(deployWithRecoverySetFixture);

      await timeLimitsModule.connect(user1).setCommonPeriodLimits(
        user1.address,
        hre.ethers.parseEther("1.0"),
        hre.ethers.parseEther("5.0"),
        hre.ethers.parseEther("20.0")
      );

      await recoveryModule.connect(recoveryKey).freeze(user1.address);

      await expect(
        bypassModule.connect(user1).requestLimitBypass(user1.address, hre.ethers.parseEther("2.0"), "Daily", hre.ethers.ZeroAddress)
      ).to.be.revertedWith("Account is frozen");

      await expect(
        approvalModule.connect(user1).requestWithdrawalAddress(user1.address, "Attacker wallet", attackerKey.address)
      ).to.be.revertedWith("Account is frozen");
    });

    it("Should block execution of a withdrawal-address request made before the freeze", async function () {
      const { approvalModule, recoveryModule, user1, recoveryKey, attackerKey } =
        await loadFixture(deployWithRecoverySetFixture);

      const tx = await approvalModule.connect(user1).requestWithdrawalAddress(user1.address, "Attacker wallet", attackerKey.address);
      const receipt = await tx.wait();
      const requestId = receipt!.logs
        .map((log) => { try { return approvalModule.interface.parseLog(log); } catch { return null; } })
        .find((parsed) => parsed?.name === "WithdrawalAddressRequested")!.args.requestId;

      await recoveryModule.connect(recoveryKey).freeze(user1.address);
      await time.increase(15); // past the 10s dev-mode timelock

      await expect(approvalModule.connect(user1).executeWithdrawalAddressRequest(user1.address, requestId))
        .to.be.revertedWith("Account is frozen");
    });

    it("Should only allow the recovery key to unfreeze", async function () {
      const { recoveryModule, user1, recoveryKey } = await loadFixture(deployWithRecoverySetFixture);

      await recoveryModule.connect(user1).freeze(user1.address);

      await expect(recoveryModule.connect(user1).unfreeze(user1.address))
        .to.be.revertedWith("Only recovery key");

      await expect(recoveryModule.connect(recoveryKey).unfreeze(user1.address))
        .to.emit(recoveryModule, "AccountUnfrozen")
        .withArgs(user1.address);
      expect(await recoveryModule.isFrozen(user1.address)).to.be.false;
    });
  });

  describe("Timelocked recovery key change", function () {
    it("Should not execute before the timelock elapses", async function () {
      const { recoveryModule, user1, attackerKey } = await loadFixture(deployWithRecoverySetFixture);

      await recoveryModule.connect(user1).requestRecoveryAddressChange(attackerKey.address);
      await expect(recoveryModule.connect(user1).executeRecoveryAddressChange())
        .to.be.revertedWith("Still in timelock");
    });

    it("Should execute after the timelock into a pending acceptance, not a direct swap", async function () {
      const { recoveryModule, user1, recoveryKey, attackerKey, RECOVERY_CHANGE_DELAY } = await loadFixture(deployWithRecoverySetFixture);

      await recoveryModule.connect(user1).requestRecoveryAddressChange(attackerKey.address);
      await time.increase(RECOVERY_CHANGE_DELAY);

      await expect(recoveryModule.connect(user1).executeRecoveryAddressChange())
        .to.emit(recoveryModule, "RecoveryAddressChangeExecuted")
        .withArgs(user1.address, attackerKey.address);

      // Old key remains in charge until the new key accepts
      let [recovery] = await recoveryModule.getRecoveryConfig(user1.address);
      expect(recovery).to.equal(recoveryKey.address);

      await recoveryModule.connect(attackerKey).acceptRecoveryRole(user1.address);
      [recovery] = await recoveryModule.getRecoveryConfig(user1.address);
      expect(recovery).to.equal(attackerKey.address);
    });

    it("Should apply a removal (change to none) directly, without acceptance", async function () {
      const { recoveryModule, user1, RECOVERY_CHANGE_DELAY } = await loadFixture(deployWithRecoverySetFixture);

      await recoveryModule.connect(user1).requestRecoveryAddressChange(hre.ethers.ZeroAddress);
      await time.increase(RECOVERY_CHANGE_DELAY);
      await recoveryModule.connect(user1).executeRecoveryAddressChange();

      const [recovery] = await recoveryModule.getRecoveryConfig(user1.address);
      expect(recovery).to.equal(hre.ethers.ZeroAddress);
      expect(await recoveryModule.getPendingRecoveryKey(user1.address)).to.equal(hre.ethers.ZeroAddress);
    });

    it("Should let the recovery key veto a pending change", async function () {
      const { recoveryModule, user1, recoveryKey, attackerKey, RECOVERY_CHANGE_DELAY } = await loadFixture(deployWithRecoverySetFixture);

      await recoveryModule.connect(user1).requestRecoveryAddressChange(attackerKey.address);
      await expect(recoveryModule.connect(recoveryKey).cancelRecoveryAddressChange(user1.address))
        .to.emit(recoveryModule, "RecoveryAddressChangeCancelled")
        .withArgs(user1.address, recoveryKey.address);

      await time.increase(RECOVERY_CHANGE_DELAY);
      await expect(recoveryModule.connect(user1).executeRecoveryAddressChange())
        .to.be.revertedWith("No pending change");
    });

    it("Should block requesting and executing a change while frozen", async function () {
      const { recoveryModule, user1, recoveryKey, attackerKey, RECOVERY_CHANGE_DELAY } = await loadFixture(deployWithRecoverySetFixture);

      await recoveryModule.connect(user1).requestRecoveryAddressChange(attackerKey.address);
      await recoveryModule.connect(recoveryKey).freeze(user1.address);
      await time.increase(RECOVERY_CHANGE_DELAY);

      await expect(recoveryModule.connect(user1).executeRecoveryAddressChange())
        .to.be.revertedWith("Account is frozen");
      await expect(recoveryModule.connect(user1).requestRecoveryAddressChange(attackerKey.address))
        .to.be.revertedWith("Account is frozen");
    });
  });

  describe("Ownership recovery", function () {
    it("Should move balances to the new owner and permanently disable the old account", async function () {
      const { savingsCore, recoveryModule, user1, recoveryKey, newOwner, depositAmount } =
        await loadFixture(deployWithRecoverySetFixture);

      await expect(
        recoveryModule.connect(recoveryKey).recoverOwnership(user1.address, newOwner.address, [hre.ethers.ZeroAddress])
      )
        .to.emit(recoveryModule, "OwnershipRecovered")
        .withArgs(user1.address, newOwner.address, 1);

      expect(await savingsCore.getTokenBalance(user1.address, hre.ethers.ZeroAddress)).to.equal(0);
      expect(await savingsCore.getTokenBalance(newOwner.address, hre.ethers.ZeroAddress)).to.equal(depositAmount);

      // Old account is dead: frozen forever, not even the recovery key can revive it
      expect(await recoveryModule.isFrozen(user1.address)).to.be.true;
      await expect(recoveryModule.connect(recoveryKey).unfreeze(user1.address))
        .to.be.revertedWith("Account was recovered");
      await expect(savingsCore.connect(user1)["withdraw(uint256,address)"](hre.ethers.parseEther("1.0"), hre.ethers.ZeroAddress))
        .to.be.revertedWith("Account is frozen");

      // New owner is protected by the same recovery key and can use funds
      const [recovery] = await recoveryModule.getRecoveryConfig(newOwner.address);
      expect(recovery).to.equal(recoveryKey.address);
      await expect(savingsCore.connect(newOwner)["withdraw(uint256,address)"](hre.ethers.parseEther("1.0"), hre.ethers.ZeroAddress))
        .not.to.be.reverted;
    });

    it("Should reject recovery from anyone but the recovery key", async function () {
      const { recoveryModule, user1, attackerKey, newOwner } = await loadFixture(deployWithRecoverySetFixture);

      await expect(
        recoveryModule.connect(user1).recoverOwnership(user1.address, newOwner.address, [hre.ethers.ZeroAddress])
      ).to.be.revertedWith("Only recovery key");
      await expect(
        recoveryModule.connect(attackerKey).recoverOwnership(user1.address, newOwner.address, [hre.ethers.ZeroAddress])
      ).to.be.revertedWith("Only recovery key");
    });

    it("Should cancel a pending recovery key change on recovery", async function () {
      const { recoveryModule, user1, recoveryKey, attackerKey, newOwner } = await loadFixture(deployWithRecoverySetFixture);

      await recoveryModule.connect(user1).requestRecoveryAddressChange(attackerKey.address);
      await recoveryModule.connect(recoveryKey).recoverOwnership(user1.address, newOwner.address, [hre.ethers.ZeroAddress]);

      const [, , exists] = await recoveryModule.getPendingRecoveryAddressChange(user1.address);
      expect(exists).to.be.false;
    });
  });

  describe("Seed compromise scenario", function () {
    it("Owner with the cold key wins the race against an attacker holding the seed", async function () {
      const { savingsCore, approvalModule, recoveryModule, user1, recoveryKey, attackerKey, newOwner, depositAmount } =
        await loadFixture(deployWithRecoverySetFixture);

      // Attacker (controls user1's seed) starts both hostile clocks:
      // whitelist their own address and rotate out the recovery key
      await approvalModule.connect(user1).requestWithdrawalAddress(user1.address, "innocent title", attackerKey.address);
      await recoveryModule.connect(user1).requestRecoveryAddressChange(attackerKey.address);

      // Owner sees the events (off-chain notifier) and responds with the cold key
      await recoveryModule.connect(recoveryKey).freeze(user1.address);
      await recoveryModule.connect(recoveryKey).recoverOwnership(user1.address, newOwner.address, [hre.ethers.ZeroAddress]);

      // Attacker's clocks all run out on a dead account
      await time.increase(3600);
      await expect(recoveryModule.connect(user1).executeRecoveryAddressChange())
        .to.be.revertedWith("Account was recovered");
      await expect(savingsCore.connect(user1)["withdraw(uint256,address)"](hre.ethers.parseEther("0.1"), hre.ethers.ZeroAddress))
        .to.be.revertedWith("Account is frozen");

      // Funds are safe on the fresh key
      expect(await savingsCore.getTokenBalance(newOwner.address, hre.ethers.ZeroAddress)).to.equal(depositAmount);
    });
  });
});
