import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

/**
 * Permanent deposit addresses.
 *
 * Generating one used to cost a fee, which put a paywall in front of the first
 * thing a new saver has to do. It is free now, and free means a sponsor can pay
 * the gas on someone's behalf — so deployment is permissionless while no fee is
 * set, and restricted again if one ever is.
 */
describe("ProxyDeploymentModule", function () {
  async function deployFixture() {
    const [owner, user, stranger, treasury] = await hre.ethers.getSigners();

    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);
    await savingsCore.waitForDeployment();

    const ProxyDeploymentModule = await hre.ethers.getContractFactory(
      "ProxyDeploymentModule",
    );
    const proxyModule = await hre.upgrades.deployProxy(
      ProxyDeploymentModule,
      [savingsCore.target],
      { initializer: "initialize" },
    );
    await proxyModule.waitForDeployment();

    const moduleId = hre.ethers.keccak256(
      hre.ethers.toUtf8Bytes("PROXY_DEPLOYMENT"),
    );
    await savingsCore.registerModule(moduleId, proxyModule.target);

    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    return { savingsCore, proxyModule, mockUSDT, owner, user, stranger, treasury };
  }

  it("costs nothing by default", async function () {
    const { proxyModule } = await loadFixture(deployFixture);

    expect(await proxyModule.getProxyDeploymentFee()).to.equal(0);
  });

  it("lets a stranger deploy an address for someone else", async function () {
    // This is the sponsor case: a keeper paying the gas so a brand-new saver
    // never needs a coin of their own to get started.
    const { proxyModule, user, stranger } = await loadFixture(deployFixture);

    const expected = await proxyModule.getUserDepositAddress(user.address);

    await expect(proxyModule.connect(stranger).deployUserProxy(user.address))
      .to.emit(proxyModule, "ProxyDeployed")
      .withArgs(user.address, expected);

    expect(await proxyModule.isProxyDeployed(user.address)).to.equal(true);
  });

  it("gives the sponsored proxy to the user, not the sponsor", async function () {
    const { proxyModule, user, stranger } = await loadFixture(deployFixture);

    await proxyModule.connect(stranger).deployUserProxy(user.address);
    const proxyAddress = await proxyModule.getUserProxy(user.address);

    const proxy = await hre.ethers.getContractAt("UserProxy", proxyAddress);
    expect(await proxy.owner()).to.equal(user.address);
    expect(await proxyModule.isProxyDeployed(stranger.address)).to.equal(false);
  });

  it("reports the same address before and after deployment", async function () {
    const { proxyModule, user } = await loadFixture(deployFixture);

    const predicted = await proxyModule.getUserDepositAddress(user.address);
    await proxyModule.connect(user).deployUserProxy(user.address);

    expect(await proxyModule.getUserDepositAddress(user.address)).to.equal(predicted);
    expect(await proxyModule.getUserProxy(user.address)).to.equal(predicted);
  });

  it("returns the stored proxy once deployed, not a recomputed guess", async function () {
    // The counterfactual is derived from UserProxy's creation code as it is
    // today. If that code ever changes, existing users must keep being shown
    // the proxy they actually have — anything else sends their next deposit to
    // an address that can never be deployed.
    const { proxyModule, user } = await loadFixture(deployFixture);

    await proxyModule.connect(user).deployUserProxy(user.address);
    const stored = await proxyModule.getUserProxy(user.address);

    expect(await proxyModule.getUserDepositAddress(user.address)).to.equal(stored);
    expect(await hre.ethers.provider.getCode(stored)).to.not.equal("0x");
  });

  it("refuses a second deployment", async function () {
    const { proxyModule, user } = await loadFixture(deployFixture);

    await proxyModule.connect(user).deployUserProxy(user.address);

    await expect(
      proxyModule.connect(user).deployUserProxy(user.address),
    ).to.be.revertedWith("Already deployed");
  });

  it("rejects the zero address", async function () {
    const { proxyModule, stranger } = await loadFixture(deployFixture);

    await expect(
      proxyModule.connect(stranger).deployUserProxy(hre.ethers.ZeroAddress),
    ).to.be.revertedWith("Invalid user");
  });

  describe("when a fee is set", function () {
    async function feeFixture() {
      const base = await deployFixture();
      const { proxyModule, mockUSDT, treasury, user } = base;
      const fee = 3_000_000n; // 3 USDT, 6 decimals

      await proxyModule.setPaymentToken(mockUSDT.target);
      await proxyModule.setTreasuryAddress(treasury.address);
      await proxyModule.setProxyDeploymentFee(fee);

      // MockUSDT mints its whole supply to the deployer, so fund from there.
      await mockUSDT.connect(base.owner).transfer(user.address, fee * 10n);
      await mockUSDT.connect(user).approve(proxyModule.target, fee);

      return { ...base, fee };
    }

    it("stops a stranger spending the user's approval", async function () {
      // Permissionless deployment is only safe because it is free. With a fee
      // charged to the user, a stranger deploying for them would be spending
      // their money without asking.
      const { proxyModule, user, stranger } = await loadFixture(feeFixture);

      await expect(
        proxyModule.connect(stranger).deployUserProxy(user.address),
      ).to.be.revertedWith("Not authorized");
    });

    it("still lets the user pay it themselves", async function () {
      const { proxyModule, mockUSDT, user, treasury, fee } =
        await loadFixture(feeFixture);

      await expect(
        proxyModule.connect(user).deployUserProxy(user.address),
      ).to.changeTokenBalance(mockUSDT, treasury, fee);
    });
  });
});
