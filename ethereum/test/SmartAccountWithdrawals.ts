import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

/**
 * Native withdrawals to contract wallets.
 *
 * The core used to send native coin with `payable(x).transfer(...)`, which
 * forwards a 2300-gas stipend. Any contract wallet — a Safe, or the ERC-4337
 * account a Google-sign-in user would hold — does real work in `receive()` and
 * blows through that stipend, so every native withdrawal to one reverted.
 *
 * These tests pin the fix: the core sends with `Address.sendValue`, which
 * forwards all remaining gas.
 */
describe("Native withdrawals to smart accounts", function () {
  async function deployFixture() {
    const [owner, user1] = await hre.ethers.getSigners();

    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);
    await savingsCore.waitForDeployment();

    const moduleSpecs = [
      ["TimePeriodLimitsModule", "TIME_PERIOD_LIMITS"],
      ["ProposalSystemModule", "PROPOSAL_SYSTEM"],
      ["BypassSystemModule", "BYPASS_SYSTEM"],
      ["ApprovalSystemModule", "APPROVAL_SYSTEM"],
    ] as const;

    for (const [contractName, moduleName] of moduleSpecs) {
      const factory = await hre.ethers.getContractFactory(contractName);
      const module = await hre.upgrades.deployProxy(factory, [savingsCore.target], {
        initializer: "initialize",
      });
      await module.waitForDeployment();
      const moduleId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(moduleName));
      await savingsCore.registerModule(moduleId, module.target);
    }

    const MockSmartAccount = await hre.ethers.getContractFactory("MockSmartAccount");
    const smartAccount = await MockSmartAccount.deploy();
    await smartAccount.waitForDeployment();

    return { savingsCore, smartAccount, owner, user1 };
  }

  /**
   * Credit a native balance directly. The savings account no longer accepts
   * native coin through deposit(), but balances already held stay withdrawable
   * — and that is the path under test. Mirrors the helper in SavingsCore.ts.
   */
  async function seedNativeBalance(savingsCore: any, holder: string, amount: bigint) {
    const [owner] = await hre.ethers.getSigners();
    const seederId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TEST_SEEDER"));
    if ((await savingsCore.getModule(seederId)) !== owner.address) {
      await savingsCore.registerModule(seederId, owner.address);
    }
    await owner.sendTransaction({ to: savingsCore.target, value: amount });
    await savingsCore
      .connect(owner)
      .updateTokenBalance(holder, hre.ethers.ZeroAddress, amount, true);
  }

  it("the mock really is too expensive for a 2300-gas stipend", async function () {
    // Guards every other test in this file: if MockSmartAccount's receive()
    // ever became cheap enough for transfer(), the regressions below would
    // pass without proving anything.
    const { smartAccount, owner } = await loadFixture(deployFixture);

    const StipendSender = await hre.ethers.getContractFactory("StipendSender");
    const sender = await StipendSender.deploy();
    await sender.waitForDeployment();
    await owner.sendTransaction({ to: sender.target, value: hre.ethers.parseEther("1.0") });

    await expect(sender.sendWithStipend(smartAccount.target)).to.be.reverted;
  });

  it("withdraw() pays a smart account", async function () {
    const { savingsCore, smartAccount } = await loadFixture(deployFixture);

    const balance = hre.ethers.parseEther("1.0");
    const amount = hre.ethers.parseEther("0.4");
    await seedNativeBalance(savingsCore, smartAccount.target as string, balance);

    const calldata = savingsCore.interface.encodeFunctionData("withdraw(uint256,address)", [
      amount,
      hre.ethers.ZeroAddress,
    ]);
    await expect(smartAccount.execute(savingsCore.target, calldata)).not.to.be.reverted;

    expect(await smartAccount.totalReceived()).to.equal(amount);
    expect(
      await savingsCore.getTokenBalance(smartAccount.target, hre.ethers.ZeroAddress),
    ).to.equal(balance - amount);
  });

  it("withdrawTo() pays a smart account", async function () {
    const { savingsCore, smartAccount } = await loadFixture(deployFixture);

    const balance = hre.ethers.parseEther("1.0");
    const amount = hre.ethers.parseEther("0.25");
    await seedNativeBalance(savingsCore, smartAccount.target as string, balance);

    // Destination is the account itself, which is always an allowed destination.
    const calldata = savingsCore.interface.encodeFunctionData("withdrawTo", [
      amount,
      hre.ethers.ZeroAddress,
      smartAccount.target,
    ]);
    await expect(smartAccount.execute(savingsCore.target, calldata)).not.to.be.reverted;

    expect(await smartAccount.totalReceived()).to.equal(amount);
  });

  it("an EOA withdrawal still works", async function () {
    // sendValue forwards all gas rather than a stipend; make sure the ordinary
    // path did not regress in the process.
    const { savingsCore, user1 } = await loadFixture(deployFixture);

    const balance = hre.ethers.parseEther("1.0");
    const amount = hre.ethers.parseEther("0.5");
    await seedNativeBalance(savingsCore, user1.address, balance);

    await expect(
      savingsCore.connect(user1).withdraw(amount, hre.ethers.ZeroAddress),
    ).to.changeEtherBalance(user1, amount);
  });
});
