import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const { ensureDepositAddress, sweepToken } = require("../../keeper/src/actions");
const { OUTCOME, isRace } = require("../../keeper/src/outcomes");
const { Sender } = require("../../keeper/src/sender");
const { reconcileOnce } = require("../../keeper/src/reconcile");

const KIND_STABLES = 1;
const PERSONAL = 0;
const DAY = 86400;
const usd = (n: string) => hre.ethers.parseUnits(n, 6);

/**
 * The keeper pays for the two transactions a saver who arrives with a bank card
 * and no coin cannot yet make: creating their deposit address, and sweeping
 * what lands on it into the vault.
 *
 * The behaviour worth pinning is not the happy path — it is what happens when
 * the keeper and the user both act. They race by design, because the fallback
 * for "keeper is down" is "user pays their own gas", and both call the same
 * permissionless function. Whoever arrives second reverts, and that revert has
 * to read as success or the common case of everything working correctly shows
 * somebody an error.
 */
describe("Keeper", function () {
  async function fixture() {
    const [owner, user, keeper] = await hre.ethers.getSigners();

    const SavingsCore = await hre.ethers.getContractFactory("SavingsCore");
    const savingsCore = await hre.upgrades.deployProxy(SavingsCore, []);

    const deploy = async (name: string) => {
      const factory = await hre.ethers.getContractFactory(name);
      const proxy = await hre.upgrades.deployProxy(factory, [savingsCore.target], {
        initializer: "initialize",
      });
      await proxy.waitForDeployment();
      return proxy;
    };

    const vaults = await deploy("SavingsVaultModule");
    const limits = await deploy("TimePeriodLimitsModule");
    const proposals = await deploy("ProposalSystemModule");
    const bypass = await deploy("BypassSystemModule");
    const depositAddresses = await deploy("VaultDepositAddressModule");

    const register = (id: string, target: any) =>
      savingsCore.registerModule(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(id)), target);
    await register("SAVINGS_VAULTS", vaults.target);
    await register("TIME_PERIOD_LIMITS", limits.target);
    await register("PROPOSAL_SYSTEM", proposals.target);
    await register("BYPASS_SYSTEM", bypass.target);
    await register("VAULT_DEPOSIT_ADDRESSES", depositAddresses.target);
    await savingsCore.setupModuleCrossReferences();
    await savingsCore.setDevelopmentMode(false);

    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    await usdt.transfer(user.address, usd("100000"));

    await vaults
      .connect(user)
      .createVault(
        "Savings",
        KIND_STABLES,
        PERSONAL,
        [usdt.target],
        false,
        2000,
        ["Daily"],
        [usd("500")],
        [DAY],
        [DAY],
        hre.ethers.ZeroAddress
      );
    const vaultId = await vaults.getVaultCount();

    // The keeper signs its own transactions and holds no role on any contract.
    const sender = new Sender(keeper, { log: () => {} });
    const send = (build: any) => sender.send(build);

    return {
      savingsCore,
      vaults,
      // Connected to the keeper, exactly as `resolveModules` wires it in
      // production. Tests that act as the user re-connect explicitly.
      depositAddresses: depositAddresses.connect(keeper),
      usdt,
      owner,
      user,
      keeper,
      vaultId,
      send,
      tokens: [{ symbol: "USDT", address: usdt.target as string, decimals: 6 }],
    };
  }

  /** An exchange pays out to the address the member was shown. */
  async function payTheAddress(ctx: any, amount: bigint) {
    const address = await ctx.depositAddresses.depositAddressOf(ctx.vaultId, ctx.user.address);
    await ctx.usdt.connect(ctx.user).transfer(address, amount);
    return address;
  }

  describe("Paying for a saver's first transaction", function () {
    it("creates the deposit address and sweeps what is on it", async function () {
      const ctx = await loadFixture(fixture);
      const address = await payTheAddress(ctx, usd("300"));

      const ensured = await ensureDepositAddress(
        ctx.depositAddresses,
        ctx.vaultId,
        ctx.user.address,
        ctx.send
      );
      expect(ensured.outcome).to.equal(OUTCOME.DONE);
      expect(ensured.address).to.equal(address);

      const swept = await sweepToken(address, ctx.usdt.target, ctx.keeper, ctx.send);
      expect(swept.outcome).to.equal(OUTCOME.DONE);

      expect(
        await ctx.vaults.balanceOf(ctx.vaultId, ctx.user.address, ctx.usdt.target)
      ).to.equal(usd("300"));
    });

    it("costs the saver nothing", async function () {
      // The whole point: their balance is untouched by the transactions that
      // put money into their vault.
      const ctx = await loadFixture(fixture);
      await payTheAddress(ctx, usd("300"));
      const before = await hre.ethers.provider.getBalance(ctx.user.address);

      await reconcileOnce({
        signer: ctx.keeper,
        vaults: ctx.vaults,
        depositAddresses: ctx.depositAddresses,
        tokens: ctx.tokens,
        send: ctx.send,
        log: () => {},
      });

      expect(await hre.ethers.provider.getBalance(ctx.user.address)).to.equal(before);
      expect(
        await ctx.vaults.balanceOf(ctx.vaultId, ctx.user.address, ctx.usdt.target)
      ).to.equal(usd("300"));
    });
  });

  describe("Racing the user", function () {
    it("reports success when the user created the address first", async function () {
      const ctx = await loadFixture(fixture);
      await payTheAddress(ctx, usd("100"));

      await ctx.depositAddresses.connect(ctx.user).deployDepositAddress(ctx.vaultId);

      const ensured = await ensureDepositAddress(
        ctx.depositAddresses,
        ctx.vaultId,
        ctx.user.address,
        ctx.send
      );
      // Idle rather than raced: we saw it existed and never sent anything.
      expect(ensured.outcome).to.equal(OUTCOME.IDLE);
    });

    it("reports success when the user swept first", async function () {
      const ctx = await loadFixture(fixture);
      const address = await payTheAddress(ctx, usd("100"));
      await ctx.depositAddresses.connect(ctx.user).deployDepositAddress(ctx.vaultId);

      const proxy = await hre.ethers.getContractAt("SavingsVaultDepositProxy", address);
      await proxy.connect(ctx.user).sweep(ctx.usdt.target);

      const swept = await sweepToken(address, ctx.usdt.target, ctx.keeper, ctx.send);
      expect(swept.outcome).to.equal(OUTCOME.IDLE);
      expect(
        await ctx.vaults.balanceOf(ctx.vaultId, ctx.user.address, ctx.usdt.target)
      ).to.equal(usd("100"));
    });

    it("treats a lost race as success rather than an error", async function () {
      // The genuine dead heat: we check, decide to act, and the user's
      // transaction lands in between. The revert must not read as a failure.
      const ctx = await loadFixture(fixture);
      await payTheAddress(ctx, usd("100"));

      const stale = {
        depositAddressOf: ctx.depositAddresses.depositAddressOf.bind(ctx.depositAddresses),
        // Reports "not deployed" even after the user deployed it.
        isDepositAddressDeployed: async () => false,
        deployDepositAddressFor: ctx.depositAddresses.deployDepositAddressFor.bind(
          ctx.depositAddresses
        ),
      };

      await ctx.depositAddresses.connect(ctx.user).deployDepositAddress(ctx.vaultId);

      const ensured = await ensureDepositAddress(stale, ctx.vaultId, ctx.user.address, ctx.send);
      expect(ensured.outcome).to.equal(OUTCOME.RACED);
    });

    it("does not mistake a real failure for a race", async function () {
      // The narrowness of the race test matters: if it matched loosely, a
      // genuine bug would be swallowed by the same silence.
      const ctx = await loadFixture(fixture);
      const [, , , stranger] = await hre.ethers.getSigners();

      await expect(
        ensureDepositAddress(ctx.depositAddresses, ctx.vaultId, stranger.address, ctx.send)
      ).to.be.rejected;

      expect(isRace(new Error("execution reverted: Not a vault member"))).to.equal(false);
      expect(isRace(new Error("execution reverted: Already deployed"))).to.equal(true);
    });
  });

  describe("Reconciling from current state", function () {
    it("finds money that arrived before the address existed", async function () {
      // The normal case for an exchange withdrawal: the member publishes the
      // address the moment they are shown it, long before it is deployed.
      const ctx = await loadFixture(fixture);
      await payTheAddress(ctx, usd("250"));

      expect(
        await ctx.depositAddresses.isDepositAddressDeployed(ctx.vaultId, ctx.user.address)
      ).to.equal(false);

      const stats = await reconcileOnce({
        signer: ctx.keeper,
        vaults: ctx.vaults,
        depositAddresses: ctx.depositAddresses,
        tokens: ctx.tokens,
        send: ctx.send,
        log: () => {},
      });

      expect(stats.deployed).to.equal(1);
      expect(stats.swept).to.equal(1);
      expect(
        await ctx.vaults.balanceOf(ctx.vaultId, ctx.user.address, ctx.usdt.target)
      ).to.equal(usd("250"));
    });

    it("spends nothing when there is nothing to do", async function () {
      const ctx = await loadFixture(fixture);
      const before = await hre.ethers.provider.getBalance(ctx.keeper.address);

      const stats = await reconcileOnce({
        signer: ctx.keeper,
        vaults: ctx.vaults,
        depositAddresses: ctx.depositAddresses,
        tokens: ctx.tokens,
        send: ctx.send,
        log: () => {},
      });

      expect(stats).to.deep.equal({ swept: 0, deployed: 0, raced: 0, failed: 0 });
      // An empty address must never be deployed on spec — that is gas for nothing.
      expect(await hre.ethers.provider.getBalance(ctx.keeper.address)).to.equal(before);
      expect(
        await ctx.depositAddresses.isDepositAddressDeployed(ctx.vaultId, ctx.user.address)
      ).to.equal(false);
    });

    it("is safe to run twice", async function () {
      const ctx = await loadFixture(fixture);
      await payTheAddress(ctx, usd("400"));
      const context = {
        signer: ctx.keeper,
        vaults: ctx.vaults,
        depositAddresses: ctx.depositAddresses,
        tokens: ctx.tokens,
        send: ctx.send,
        log: () => {},
      };

      await reconcileOnce(context);
      const second = await reconcileOnce(context);

      expect(second.swept).to.equal(0);
      expect(second.failed).to.equal(0);
      expect(
        await ctx.vaults.balanceOf(ctx.vaultId, ctx.user.address, ctx.usdt.target)
      ).to.equal(usd("400"));
    });

    it("keeps going when one member fails", async function () {
      // One member's problem must not stop everybody else's deposits landing.
      const ctx = await loadFixture(fixture);
      await payTheAddress(ctx, usd("100"));

      const broken = { ...ctx.tokens[0], address: ctx.vaults.target as string };

      const stats = await reconcileOnce({
        signer: ctx.keeper,
        vaults: ctx.vaults,
        depositAddresses: ctx.depositAddresses,
        tokens: [broken, ctx.tokens[0]],
        send: ctx.send,
        log: () => {},
      });

      // The good token still went in.
      expect(
        await ctx.vaults.balanceOf(ctx.vaultId, ctx.user.address, ctx.usdt.target)
      ).to.equal(usd("100"));
      expect(stats.swept).to.equal(1);
    });
  });

  describe("Sending transactions", function () {
    it("serialises so concurrent sends cannot collide on a nonce", async function () {
      // The failure this prevents is nasty: two transactions claiming one
      // nonce, one silently dropped, and a keeper that looks healthy while
      // delivering nothing.
      const ctx = await loadFixture(fixture);
      const [, , , a, b, c] = await hre.ethers.getSigners();

      const sender = new Sender(ctx.keeper, { log: () => {} });
      const receipts = await Promise.all(
        [a, b, c].map((to) =>
          sender.send((overrides: any) =>
            ctx.keeper.sendTransaction({ to: to.address, value: 1n, ...overrides })
          )
        )
      );

      const nonces = receipts.map((r: any) => r.nonce ?? null);
      expect(receipts).to.have.length(3);
      // Three distinct transactions landed, none dropped.
      expect(new Set(receipts.map((r: any) => r.hash)).size).to.equal(3);
      if (nonces.every((n: any) => n !== null)) {
        expect(new Set(nonces).size).to.equal(3);
      }
    });

    it("keeps working after a failed send", async function () {
      const ctx = await loadFixture(fixture);
      const [, , , recipient] = await hre.ethers.getSigners();
      const sender = new Sender(ctx.keeper, { log: () => {} });

      await expect(
        sender.send(() => {
          throw new Error("boom");
        })
      ).to.be.rejectedWith("boom");

      const receipt = await sender.send((overrides: any) =>
        ctx.keeper.sendTransaction({ to: recipient.address, value: 1n, ...overrides })
      );
      expect(receipt.status).to.equal(1);
    });
  });
});
