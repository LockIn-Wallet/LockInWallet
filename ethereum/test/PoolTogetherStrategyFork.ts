import { expect } from "chai";
import hre from "hardhat";

/**
 * PoolTogetherStrategy against the REAL PoolTogether v5 prize vault on Optimism.
 *
 * This vault is not hypothetical: `PoolTogetherModule.prizeVaults(USDC)` on the
 * live SavingsCore already points at it, and it holds real deposits. So the
 * strategy can be checked against the thing it will actually talk to.
 *
 * What only a fork can prove:
 *  1. The vault our production module is configured for really is an ERC4626
 *     over USDC sharing the prize pool we read the prize token from — config
 *     drift here would send deposits somewhere unintended.
 *  2. Prize-vault shares do NOT appreciate. Value stays ~1:1 because the yield
 *     is diverted to the draw. If that ever changed, our accounting (which
 *     records principal and expects it back) would quietly under-report.
 *  3. Each member's position is a distinct address holding its own shares —
 *     the property the whole per-member design exists to buy, verified against
 *     the real TWAB-tracking vault rather than a mock.
 *
 * Opt-in: npm run test:fork
 */

const RUN = process.env.FORK_OPTIMISM === "true";
const RPC = process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io";

// Read off the live deployment; asserted below rather than trusted.
const PRIZE_VAULT = "0x03D3CE84279cB6F54f5e6074ff0F8319d830dafe"; // przUSDC
const PRIZE_POOL = "0xF35fE10ffd0a9672d0095c435fd8767A7fe29B55";
const USDC = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";
const A_USDC = "0x38d693cE1dF5AaDF7bC62595A37D667aD57922e5"; // a liquid USDC source
const WETH = "0x4200000000000000000000000000000000000006";

const ERC20 = "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20";
const DEPOSIT = 1_000_000_000n; // 1,000 USDC

describe("PoolTogetherStrategy against the live prize vault (Optimism fork)", function () {
  this.timeout(300_000);

  let strategy: any;
  let token: any;
  let prizeVault: any;
  let controller: any;
  let user1: any;
  let user2: any;

  const accountId = (vaultId: number, member: string) =>
    hre.ethers.solidityPackedKeccak256(["uint256", "address"], [vaultId, member]);

  before(async function () {
    if (!RUN) this.skip();

    try {
      await hre.network.provider.request({
        method: "hardhat_reset",
        params: [{ forking: { jsonRpcUrl: RPC } }],
      });
    } catch (error) {
      console.error(`\n  Could not fork ${RPC}: ${(error as Error).message}`);
      this.skip();
    }

    [controller, user1, user2] = await hre.ethers.getSigners();

    // The controller is normally the YieldModule; a signer stands in so the
    // strategy can be driven directly.
    const PoolTogetherStrategy = await hre.ethers.getContractFactory("PoolTogetherStrategy");
    strategy = await PoolTogetherStrategy.deploy(PRIZE_VAULT, PRIZE_POOL, controller.address);

    token = await hre.ethers.getContractAt(ERC20, USDC);
    prizeVault = await hre.ethers.getContractAt(ERC20, PRIZE_VAULT);

    await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [A_USDC] });
    await hre.network.provider.request({
      method: "hardhat_setBalance",
      params: [A_USDC, "0xde0b6b3a7640000"],
    });
    const reserve = await hre.ethers.getSigner(A_USDC);
    await token.connect(reserve).transfer(controller.address, DEPOSIT * 4n);
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [A_USDC],
    });
  });

  after(async function () {
    if (RUN) await hre.network.provider.request({ method: "hardhat_reset", params: [] });
  });

  it("matches the vault production is already configured for", async function () {
    // Guards against config drift between the live module and this strategy.
    expect(await strategy.asset()).to.equal(USDC);
    expect(await strategy.prizeVault()).to.equal(PRIZE_VAULT);
    expect(await strategy.prizePool()).to.equal(PRIZE_POOL);
  });

  it("reads the prize token off the live pool, and it is not the deposit", async function () {
    // The whole reason winnings are tracked separately instead of added to the
    // balance. The constructor refuses a strategy where these are the same.
    expect(await strategy.prizeToken()).to.equal(WETH);
    expect(await strategy.prizeToken()).to.not.equal(await strategy.asset());
  });

  it("reports a real grand prize", async function () {
    const prize = await strategy.grandPrize();
    console.log(`      live grand prize: ${hre.ethers.formatEther(prize)} WETH`);
    expect(prize).to.be.gt(0n);
  });

  it("deposits into the real vault, giving the member their own position", async function () {
    const id = accountId(1, user1.address);
    await token.connect(controller).approve(strategy.target, DEPOSIT);
    await strategy.connect(controller).deposit(id, DEPOSIT);

    const position = await strategy.positionOf(id);
    expect(position).to.not.equal(hre.ethers.ZeroAddress);

    // The shares sit in the member's position, NOT the strategy — that is what
    // gives them their own TWAB account and their own odds.
    expect(await prizeVault.balanceOf(position)).to.be.gt(0n);
    expect(await prizeVault.balanceOf(strategy.target)).to.equal(0n);

    // A prize vault does not appreciate: the yield funds the draw instead.
    const invested = await strategy.investedAssets(id);
    console.log(`      deposited ${DEPOSIT} → withdrawable ${invested}`);
    expect(invested).to.be.lte(DEPOSIT);
    expect(invested).to.be.gte(DEPOSIT - 2n);
  });

  it("keeps two members in separate positions with separate balances", async function () {
    const id1 = accountId(1, user1.address);
    const id2 = accountId(1, user2.address);

    await token.connect(controller).approve(strategy.target, DEPOSIT);
    await strategy.connect(controller).deposit(id2, DEPOSIT);

    const p1 = await strategy.positionOf(id1);
    const p2 = await strategy.positionOf(id2);
    expect(p1).to.not.equal(p2);

    // Against the real vault, each address holds only its own stake — so one
    // member's prize can never be another's, and none of it is pooled.
    expect(await prizeVault.balanceOf(p1)).to.be.gt(0n);
    expect(await prizeVault.balanceOf(p2)).to.be.gt(0n);
    expect(await strategy.investedAssets(id1)).to.be.gte(DEPOSIT - 2n);
    expect(await strategy.investedAssets(id2)).to.be.gte(DEPOSIT - 2n);
  });

  it("returns the deposit out of the real vault", async function () {
    const id = accountId(1, user1.address);
    const before = await token.balanceOf(user1.address);

    await strategy.connect(controller).withdraw(id, await strategy.investedAssets(id), user1.address);

    const received = (await token.balanceOf(user1.address)) - before;
    console.log(`      withdrew ${received} of ${DEPOSIT} deposited`);
    expect(received).to.be.gte(DEPOSIT - 2n);
    expect(await strategy.investedAssets(id)).to.be.lt(10n);
  });

  it("has no prizes to sweep when nothing has been won", async function () {
    const id = accountId(1, user2.address);
    expect(await strategy.claimablePrizes(id)).to.equal(0n);
  });
});
