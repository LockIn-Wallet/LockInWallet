import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const DELAY = 3600; // 1h timelock for tests

// The Safe is represented by an EOA here — the timelock only sees "the
// proposer address"; whether it is a Gnosis Safe or an EOA is external to it.
describe("Governance (Safe proposer + Timelock)", function () {
  async function deployGovernedSystemFixture() {
    const [deployer, safe, outsider, randomExecutor] = await hre.ethers.getSigners();

    // Minimal governed system: core + limits + proposal + bypass modules
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

    await savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TIME_PERIOD_LIMITS")), timeLimitsModule.target);
    await savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PROPOSAL_SYSTEM")), proposalModule.target);
    await savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BYPASS_SYSTEM")), bypassModule.target);

    // Wire cross-references while the deployer still owns the core —
    // mirrors the real lifecycle (deploy-modular first, governance after)
    await savingsCore.setupModuleCrossReferences();

    // Timelock: Safe proposes/cancels, execution open, self-administered
    const SavingsTimelock = await hre.ethers.getContractFactory("SavingsTimelock");
    const timelock = await SavingsTimelock.deploy(
      DELAY,
      [safe.address],
      [hre.ethers.ZeroAddress], // open executor
      hre.ethers.ZeroAddress
    );
    await timelock.waitForDeployment();

    await savingsCore.transferOwnership(timelock.target);
    await timeLimitsModule.transferOwnership(timelock.target);
    await proposalModule.transferOwnership(timelock.target);
    await bypassModule.transferOwnership(timelock.target);

    return { savingsCore, timeLimitsModule, proposalModule, timelock, deployer, safe, outsider, randomExecutor };
  }

  describe("Ownership handover", function () {
    it("makes the timelock the owner of core and modules", async function () {
      const { savingsCore, timeLimitsModule, proposalModule, timelock } = await loadFixture(deployGovernedSystemFixture);
      expect(await savingsCore.owner()).to.equal(timelock.target);
      expect(await timeLimitsModule.owner()).to.equal(timelock.target);
      expect(await proposalModule.owner()).to.equal(timelock.target);
    });

    it("blocks the former owner EOA from upgrading directly", async function () {
      const { savingsCore, deployer } = await loadFixture(deployGovernedSystemFixture);
      const SavingsCore = await hre.ethers.getContractFactory("SavingsCore", deployer);
      await expect(
        hre.upgrades.upgradeProxy(savingsCore.target, SavingsCore, { redeployImplementation: "always" })
      ).to.be.reverted; // OwnableUnauthorizedAccount
    });

    it("blocks the former owner EOA from registering modules directly", async function () {
      const { savingsCore, timeLimitsModule } = await loadFixture(deployGovernedSystemFixture);
      await expect(
        savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("EVIL")), timeLimitsModule.target)
      ).to.be.reverted;
    });
  });

  describe("Proposer gating", function () {
    it("only the Safe can schedule operations", async function () {
      const { savingsCore, timelock, outsider } = await loadFixture(deployGovernedSystemFixture);
      const data = savingsCore.interface.encodeFunctionData("setDevelopmentMode", [false]);
      await expect(
        timelock.connect(outsider).schedule(savingsCore.target, 0, data, hre.ethers.ZeroHash, hre.ethers.ZeroHash, DELAY)
      ).to.be.reverted; // AccessControlUnauthorizedAccount
    });

    it("only the Safe can cancel a queued operation", async function () {
      const { savingsCore, timelock, safe, outsider } = await loadFixture(deployGovernedSystemFixture);
      const data = savingsCore.interface.encodeFunctionData("setDevelopmentMode", [false]);
      await timelock.connect(safe).schedule(savingsCore.target, 0, data, hre.ethers.ZeroHash, hre.ethers.ZeroHash, DELAY);
      const id = await timelock.hashOperation(savingsCore.target, 0, data, hre.ethers.ZeroHash, hre.ethers.ZeroHash);

      await expect(timelock.connect(outsider).cancel(id)).to.be.reverted;
      await expect(timelock.connect(safe).cancel(id)).not.to.be.reverted;
      expect(await timelock.isOperation(id)).to.be.false;
    });

    it("keeps timelock role management behind the delay too", async function () {
      const { timelock, safe, outsider } = await loadFixture(deployGovernedSystemFixture);
      // admin = address(0): nobody can grant roles directly, not even the Safe
      const proposerRole = await timelock.PROPOSER_ROLE();
      await expect(timelock.connect(safe).grantRole(proposerRole, outsider.address)).to.be.reverted;
    });
  });

  describe("Timelocked upgrades", function () {
    it("performs a full governed upgrade and preserves storage", async function () {
      const { proposalModule, timelock, safe, outsider, randomExecutor } = await loadFixture(deployGovernedSystemFixture);

      // Seed user state that must survive the upgrade
      await proposalModule.connect(outsider).commitSetup(
        hre.ethers.parseUnits("1.0", 6),
        hre.ethers.parseUnits("7.0", 6),
        hre.ethers.parseUnits("30.0", 6)
      );
      expect(await proposalModule.isSetupCommitted(outsider.address)).to.be.true;

      // Prepare the new implementation (permissionless deploy)
      const Factory = await hre.ethers.getContractFactory("ProposalSystemModule");
      const implAddress = await hre.upgrades.prepareUpgrade(proposalModule.target, Factory, {
        redeployImplementation: "always",
      });

      const upgradeData = new hre.ethers.Interface([
        "function upgradeToAndCall(address newImplementation, bytes data) payable",
      ]).encodeFunctionData("upgradeToAndCall", [implAddress, "0x"]);
      const salt = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("upgrade-test"));

      // Safe schedules — countdown starts here
      await timelock.connect(safe).schedule(proposalModule.target, 0, upgradeData, hre.ethers.ZeroHash, salt, DELAY);

      // Executing before the delay must fail — even for the Safe itself
      await expect(
        timelock.connect(safe).execute(proposalModule.target, 0, upgradeData, hre.ethers.ZeroHash, salt)
      ).to.be.reverted; // TimelockUnexpectedOperationState

      // After the delay ANYONE can execute (open executor)
      await time.increase(DELAY + 1);
      await timelock.connect(randomExecutor).execute(proposalModule.target, 0, upgradeData, hre.ethers.ZeroHash, salt);

      expect(await hre.upgrades.erc1967.getImplementationAddress(proposalModule.target as string)).to.equal(implAddress);
      // User state preserved across the governed upgrade
      expect(await proposalModule.isSetupCommitted(outsider.address)).to.be.true;
    });

    it("routes registerModule through the timelock", async function () {
      const { savingsCore, timelock, safe, randomExecutor } = await loadFixture(deployGovernedSystemFixture);

      const ReferralModule = await hre.ethers.getContractFactory("ReferralModule");
      const referralModule = await hre.upgrades.deployProxy(ReferralModule, [savingsCore.target], { initializer: "initialize" });
      await referralModule.waitForDeployment();

      const referralId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("REFERRAL"));
      const registerData = savingsCore.interface.encodeFunctionData("registerModule", [referralId, referralModule.target]);
      const salt = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("register-test"));

      await timelock.connect(safe).schedule(savingsCore.target, 0, registerData, hre.ethers.ZeroHash, salt, DELAY);
      await time.increase(DELAY + 1);
      await timelock.connect(randomExecutor).execute(savingsCore.target, 0, registerData, hre.ethers.ZeroHash, salt);

      expect(await savingsCore.getModule(referralId)).to.equal(referralModule.target);
      expect(await savingsCore.isAuthorizedModule(referralModule.target)).to.be.true;
    });
  });
});
