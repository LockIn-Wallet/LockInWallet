import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const DAY = 86400;
const YEAR = 365 * DAY;
const KIND = { None: 0n, Date: 1n, Price: 2n, AllOf: 3n, AnyOf: 4n };
const ZERO = hre.ethers.ZeroAddress;
const SALT = hre.ethers.id("salt-1");
const FEED_DECIMALS = 8;

const usd = (n: string) => hre.ethers.parseUnits(n, 6);
const price = (n: string) => hre.ethers.parseUnits(n, FEED_DECIMALS);

/**
 * A lock is a promise to yourself that nobody — not governance, not us — can
 * break. So it is a standalone immutable contract per lock, with a deadline
 * as the safety valve for any condition that misbehaves.
 */
describe("LockedVaults", function () {
  async function fixture() {
    const [deployer, alice, bob] = await hre.ethers.getSigners();
    const factory = await (await hre.ethers.getContractFactory("LockedVaultFactory")).deploy();
    const usdt = await (await hre.ethers.getContractFactory("MockUSDT")).deploy();
    await usdt.transfer(alice.address, usd("10000"));
    const feed = await (await hre.ethers.getContractFactory("MockAggregatorV3")).deploy(
      FEED_DECIMALS, price("3000"),
    );
    return { factory, usdt, feed, deployer, alice, bob };
  }

  async function deadlineIn(seconds: number) {
    return BigInt((await time.latest()) + seconds);
  }

  /** Creates a lock for `signer` and returns the LockedVault handle. */
  async function makeLock(ctx: any, signer: any, condition: string, deadline: bigint, salt = SALT) {
    const predicted = await ctx.factory.predictLock(signer.address, condition, deadline, salt);
    await ctx.factory.connect(signer).createLock(condition, deadline, salt);
    return hre.ethers.getContractAt("LockedVault", predicted);
  }

  async function createCondition(ctx: any, tx: Promise<any>) {
    const receipt = await (await tx).wait();
    const log = receipt.logs.map((l: any) => ctx.factory.interface.parseLog(l)).find(
      (l: any) => l && l.name === "ConditionCreated",
    );
    return log.args.condition as string;
  }

  describe("date lock", function () {
    it("stays locked until the deadline, then unlocks", async function () {
      const ctx = await loadFixture(fixture);
      const deadline = await deadlineIn(30 * DAY);
      const lock = await makeLock(ctx, ctx.alice, ZERO, deadline);

      expect(await lock.isUnlocked()).to.equal(false);
      await time.increaseTo(deadline);
      expect(await lock.isUnlocked()).to.equal(true);
    });

    it("releases native coin in full to the owner, whoever calls", async function () {
      const ctx = await loadFixture(fixture);
      const deadline = await deadlineIn(DAY);
      const lock = await makeLock(ctx, ctx.alice, ZERO, deadline);
      const amount = hre.ethers.parseEther("1");
      await ctx.bob.sendTransaction({ to: lock.target, value: amount });
      expect(await lock.balanceOf(ZERO)).to.equal(amount);

      await time.increaseTo(deadline);
      const before = await hre.ethers.provider.getBalance(ctx.alice.address);
      // Bob calls; Alice's balance grows by exactly the lock's contents.
      await expect(lock.connect(ctx.bob).release(ZERO)).to.emit(lock, "Released").withArgs(ZERO, amount);
      expect((await hre.ethers.provider.getBalance(ctx.alice.address)) - before).to.equal(amount);
      expect(await lock.balanceOf(ZERO)).to.equal(0n);
    });

    it("releases ERC20 in full to the owner, via deposit() or plain transfer", async function () {
      const ctx = await loadFixture(fixture);
      const deadline = await deadlineIn(DAY);
      const lock = await makeLock(ctx, ctx.alice, ZERO, deadline);

      await ctx.usdt.connect(ctx.alice).approve(lock.target, usd("600"));
      await lock.connect(ctx.alice).deposit(ctx.usdt.target, usd("600"));
      await ctx.usdt.connect(ctx.alice).transfer(lock.target, usd("400"));
      expect(await lock.balanceOf(ctx.usdt.target)).to.equal(usd("1000"));

      await time.increaseTo(deadline);
      const before = await ctx.usdt.balanceOf(ctx.alice.address);
      await lock.connect(ctx.bob).release(ctx.usdt.target);
      expect((await ctx.usdt.balanceOf(ctx.alice.address)) - before).to.equal(usd("1000"));
      expect(await ctx.usdt.balanceOf(ctx.bob.address)).to.equal(0n);
    });

    it("refuses to release before unlock", async function () {
      const ctx = await loadFixture(fixture);
      const lock = await makeLock(ctx, ctx.alice, ZERO, await deadlineIn(DAY));
      await ctx.bob.sendTransaction({ to: lock.target, value: 1n });
      await expect(lock.release(ZERO)).to.be.revertedWith("Still locked");
    });

    it("refuses to release an empty balance", async function () {
      const ctx = await loadFixture(fixture);
      const deadline = await deadlineIn(DAY);
      const lock = await makeLock(ctx, ctx.alice, ZERO, deadline);
      await time.increaseTo(deadline);
      await expect(lock.release(ZERO)).to.be.revertedWith("Nothing to release");
      await expect(lock.release(ctx.usdt.target)).to.be.revertedWith("Nothing to release");
    });
  });

  describe("price lock", function () {
    async function priceLock(ctx: any, threshold: bigint, above: boolean, staleness = DAY) {
      const cond = await createCondition(
        ctx, ctx.factory.createPriceCondition(ctx.feed.target, threshold, above, staleness),
      );
      const lock = await makeLock(ctx, ctx.alice, cond, await deadlineIn(YEAR));
      return { cond, lock };
    }

    it("'above' unlocks only once the feed crosses the threshold", async function () {
      const ctx = await loadFixture(fixture);
      const { lock } = await priceLock(ctx, price("5000"), true);
      expect(await lock.isUnlocked()).to.equal(false);
      await ctx.feed.setAnswer(price("5000"));
      expect(await lock.isUnlocked()).to.equal(true);
      await ctx.feed.setAnswer(price("4999"));
      expect(await lock.isUnlocked()).to.equal(false);
    });

    it("'below' unlocks only once the feed drops to the threshold", async function () {
      const ctx = await loadFixture(fixture);
      const { lock } = await priceLock(ctx, price("1000"), false);
      expect(await lock.isUnlocked()).to.equal(false);
      await ctx.feed.setAnswer(price("1000"));
      expect(await lock.isUnlocked()).to.equal(true);
    });

    it("treats a stale feed as locked", async function () {
      const ctx = await loadFixture(fixture);
      const { lock } = await priceLock(ctx, price("5000"), true, DAY);
      await ctx.feed.setAnswer(price("6000"));
      expect(await lock.isUnlocked()).to.equal(true);
      await time.increase(DAY + 1);
      expect(await lock.isUnlocked()).to.equal(false);
    });

    it("treats a non-positive answer as locked", async function () {
      const ctx = await loadFixture(fixture);
      const { lock } = await priceLock(ctx, price("1000"), false);
      await ctx.feed.setAnswer(0n);
      expect(await lock.isUnlocked()).to.equal(false);
    });

    it("treats a reverting feed as locked, not as an error", async function () {
      const ctx = await loadFixture(fixture);
      const { cond, lock } = await priceLock(ctx, price("5000"), true);
      await ctx.feed.setAnswer(price("6000"));
      await ctx.feed.setReverting(true);
      const condition = await hre.ethers.getContractAt("PriceCondition", cond);
      await expect(condition.isMet()).to.be.revertedWith("Feed down");
      expect(await lock.isUnlocked()).to.equal(false);
      await ctx.bob.sendTransaction({ to: lock.target, value: 1n });
      await expect(lock.release(ZERO)).to.be.revertedWith("Still locked");
    });

    it("unlocks at the deadline regardless of the feed", async function () {
      const ctx = await loadFixture(fixture);
      const { lock } = await priceLock(ctx, price("5000"), true);
      await ctx.feed.setReverting(true);
      await time.increaseTo(await lock.deadline());
      expect(await lock.isUnlocked()).to.equal(true);
      await ctx.bob.sendTransaction({ to: lock.target, value: 1n });
      await lock.release(ZERO);
    });
  });

  describe("combinators", function () {
    async function twoConditions(ctx: any) {
      const date = await createCondition(ctx, ctx.factory.createDateCondition(await deadlineIn(30 * DAY)));
      const priceCond = await createCondition(
        ctx, ctx.factory.createPriceCondition(ctx.feed.target, price("5000"), true, DAY),
      );
      return { date, priceCond };
    }

    it("AllOf needs every member", async function () {
      const ctx = await loadFixture(fixture);
      const { date, priceCond } = await twoConditions(ctx);
      const all = await createCondition(ctx, ctx.factory.createAllOf([date, priceCond]));
      const lock = await makeLock(ctx, ctx.alice, all, await deadlineIn(YEAR));

      expect(await lock.isUnlocked()).to.equal(false);
      await ctx.feed.setAnswer(price("5000"));
      expect(await lock.isUnlocked()).to.equal(false);
      await time.increase(30 * DAY);
      await ctx.feed.setAnswer(price("5000")); // refresh so the feed is not stale
      expect(await lock.isUnlocked()).to.equal(true);
    });

    it("AnyOf needs one member", async function () {
      const ctx = await loadFixture(fixture);
      const { date, priceCond } = await twoConditions(ctx);
      const any = await createCondition(ctx, ctx.factory.createAnyOf([date, priceCond]));
      const lock = await makeLock(ctx, ctx.alice, any, await deadlineIn(YEAR));

      expect(await lock.isUnlocked()).to.equal(false);
      await ctx.feed.setAnswer(price("5000"));
      expect(await lock.isUnlocked()).to.equal(true);
    });

    it("reject members the factory did not create", async function () {
      const ctx = await loadFixture(fixture);
      const { date } = await twoConditions(ctx);
      const rogue = await (await hre.ethers.getContractFactory("DateCondition")).deploy(1n);
      await expect(ctx.factory.createAllOf([date, rogue.target])).to.be.revertedWith("Unknown member");
      await expect(ctx.factory.createAnyOf([rogue.target])).to.be.revertedWith("Unknown member");
      await expect(ctx.factory.createAllOf([])).to.be.revertedWith("Bad member count");
    });
  });

  describe("factory", function () {
    it("rejects a deadline in the past, beyond the horizon, or an unknown condition", async function () {
      const ctx = await loadFixture(fixture);
      const now = BigInt(await time.latest());
      await expect(ctx.factory.createLock(ZERO, now, SALT)).to.be.revertedWith("Deadline in the past");
      await expect(
        ctx.factory.createLock(ZERO, now + BigInt(3650 * DAY) + 100n, SALT),
      ).to.be.revertedWith("Deadline beyond horizon");
      const rogue = await (await hre.ethers.getContractFactory("DateCondition")).deploy(1n);
      await expect(
        ctx.factory.createLock(rogue.target, await deadlineIn(DAY), SALT),
      ).to.be.revertedWith("Unknown condition");
    });

    it("predicts the deployed address and records the lock", async function () {
      const ctx = await loadFixture(fixture);
      const deadline = await deadlineIn(DAY);
      const cond = await createCondition(ctx, ctx.factory.createDateCondition(deadline));
      const predicted = await ctx.factory.predictLock(ctx.alice.address, cond, deadline, SALT);

      await expect(ctx.factory.connect(ctx.alice).createLock(cond, deadline, SALT))
        .to.emit(ctx.factory, "LockCreated")
        .withArgs(ctx.alice.address, predicted, cond, deadline, SALT);

      expect(await ctx.factory.isLock(predicted)).to.equal(true);
      expect(await ctx.factory.lockOwner(predicted)).to.equal(ctx.alice.address);
      expect(await ctx.factory.getLocks(ctx.alice.address)).to.deep.equal([predicted]);
      expect(await ctx.factory.getLocks(ctx.bob.address)).to.deep.equal([]);

      const [owner, condition, dl, unlocked] = await ctx.factory.describeLock(predicted);
      expect([owner, condition, dl, unlocked]).to.deep.equal([ctx.alice.address, cond, deadline, false]);
      await expect(ctx.factory.describeLock(ctx.bob.address)).to.be.revertedWith("Unknown lock");

      const lock = await hre.ethers.getContractAt("LockedVault", predicted);
      expect(await lock.factory()).to.equal(ctx.factory.target);
    });

    it("gives the same owner different addresses for different salts", async function () {
      const ctx = await loadFixture(fixture);
      const deadline = await deadlineIn(DAY);
      const a = await makeLock(ctx, ctx.alice, ZERO, deadline, hre.ethers.id("a"));
      const b = await makeLock(ctx, ctx.alice, ZERO, deadline, hre.ethers.id("b"));
      expect(a.target).to.not.equal(b.target);
      expect(await ctx.factory.getLocks(ctx.alice.address)).to.deep.equal([a.target, b.target]);
    });

    it("describes every condition kind without per-condition ABIs", async function () {
      const ctx = await loadFixture(fixture);
      const unlockAt = await deadlineIn(DAY);
      const date = await createCondition(ctx, ctx.factory.createDateCondition(unlockAt));
      const priceCond = await createCondition(
        ctx, ctx.factory.createPriceCondition(ctx.feed.target, price("5000"), true, DAY),
      );
      const all = await createCondition(ctx, ctx.factory.createAllOf([date, priceCond]));
      const any = await createCondition(ctx, ctx.factory.createAnyOf([priceCond]));

      let d = await ctx.factory.describeCondition(date);
      expect(d.kind).to.equal(KIND.Date);
      expect(d.unlockAt).to.equal(unlockAt);

      d = await ctx.factory.describeCondition(priceCond);
      expect(d.kind).to.equal(KIND.Price);
      expect([d.feed, d.threshold, d.above, d.maxStaleness]).to.deep.equal(
        [ctx.feed.target, price("5000"), true, BigInt(DAY)],
      );

      d = await ctx.factory.describeCondition(all);
      expect(d.kind).to.equal(KIND.AllOf);
      expect(d.members).to.deep.equal([date, priceCond]);

      d = await ctx.factory.describeCondition(any);
      expect(d.kind).to.equal(KIND.AnyOf);
      expect(d.members).to.deep.equal([priceCond]);

      expect((await ctx.factory.describeCondition(ctx.bob.address)).kind).to.equal(KIND.None);
    });
  });

  describe("immutability", function () {
    it("LockedVault exposes no way to change owner, condition or deadline", async function () {
      const iface = (await hre.ethers.getContractFactory("LockedVault")).interface;
      const mutating = iface.fragments
        .filter((f: any) => f.type === "function" && !["view", "pure"].includes(f.stateMutability))
        .map((f: any) => f.name)
        .sort();
      expect(mutating).to.deep.equal(["deposit", "release"]);
      for (const name of ["transferOwnership", "setOwner", "setCondition", "setDeadline", "upgradeTo"]) {
        expect(iface.hasFunction(name), name).to.equal(false);
      }
    });
  });
});
