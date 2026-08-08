// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SavingsInterfaces.sol";
import "./YieldInterfaces.sol";

/// @title YieldModule
/// @notice Accountant for earning on vault balances. VaultSystemModule keeps
/// custody of the funds and calls in here to invest idle balances, settle each
/// member's share of the yield, and redeem on demand for withdrawals.
///
/// The treasury takes a management fee of one percentage point of the rate
/// (`managementFeeBps = 100`), time-weighted on principal. The fee can never
/// come out of principal: `feeTaken` is capped by the yield actually realized
/// since the last accrual, and any shortfall is carried in `feeDebt` and
/// settled out of later yield. There is deliberately no code path from
/// `principal` to `accruedFees`.
///
/// Position identity, true after every operation while `shares > 0`:
///   strategy.convertToAssets(shares) + deficit
///     == principal + owedYield + accruedFees      (± down-rounding dust)
///
/// @dev This module holds strategy shares, not user tokens (except fees awaiting
/// a sweep), so upgrade it in place via `upgrade-module-proxy` — never replace
/// the proxy.
contract YieldModule is Initializable, UUPSUpgradeable, OwnableUpgradeable, IYieldModule {
    using SafeERC20 for IERC20;

    ISavingsCore public savingsCore; // slot 0
    IVaultSystemModule public vaultModule; // slot 1
    uint256 public managementFeeBps; // slot 2 — 100 = one percentage point of the rate
    uint256 public yieldEnabledFromVaultId; // slot 3 — default-on watermark
    bool private locked; // slot 4 (packed)
    bool public strategiesPaused; // slot 4 (packed)
    uint256 public strategyChangeDelay; // slot 5

    mapping(address => mapping(uint8 => address)) private strategies; // slot 6  token => mode => strategy
    mapping(uint256 => VaultYieldState) private vaultYield; // slot 7
    mapping(uint256 => mapping(address => uint256)) private memberYieldDebt; // slot 8
    mapping(address => uint256) public pendingFees; // slot 9 — fee assets held here, awaiting sweep
    mapping(bytes32 => uint256) private strategyChangeReadyAt; // slot 10

    // Prize savings keeps its own books. It shares nothing with the accumulator
    // above: each member has their own position and their own odds, so there is
    // no pooled yield to divide and no fee on a rate that does not exist.
    uint256 public prizeFeeBps; // slot 11 — flat share of each prize claimed
    mapping(uint256 => mapping(address => uint256)) private prizePrincipal; // slot 12
    mapping(uint256 => address) private prizeStrategyOf; // slot 13 — strategy a vault's positions live in

    // ==== APPEND NEW STATE BELOW THIS LINE ONLY ====

    /// @dev Deliberately 1e18 and NOT VaultSystemModule's PENALTY_PRECISION of
    /// 1e12. Yield arrives in far smaller increments than penalties do, and with
    /// a 6-decimal stablecoin and a large totalBalance, 1e12 truncates a small
    /// harvest to zero and loses it permanently. Do not "unify" these.
    uint256 private constant YIELD_PRECISION = 1e18;
    uint256 private constant MAX_FEE_BPS = 200; // the owner can never charge more than 2 pp
    uint256 private constant MAX_PRIZE_FEE_BPS = 1000; // and never more than a tenth of a prize
    uint256 private constant MAX_BPS = 10000;
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint8 private constant VAULT_TYPE_PERSONAL = 0;

    /// @dev Aave's scaled-balance rounding leaves a position a unit or two short
    /// of what was supplied, which lands here as a deficit. That is real and is
    /// accounted for, but it is not a protocol loss and should not page anyone.
    /// Only emit the event once the shortfall is worth more than a millionth of
    /// the vault's principal, which scales with both size and token decimals.
    uint256 private constant DEFICIT_EVENT_THRESHOLD = 1e6;

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    /// @dev Only the vault module moves funds. These calls deliberately carry no
    /// reentrancy lock of their own: the vault module is already `nonReentrant`
    /// and legitimately makes several calls in one transaction (settle, then
    /// invest), which a shared lock here would reject.
    modifier onlyVaultModule() {
        require(msg.sender == address(vaultModule), "Not vault module");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _savingsCore) public initializer {
        require(_savingsCore != address(0), "Invalid core address");
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        savingsCore = ISavingsCore(_savingsCore);
        managementFeeBps = 100; // one percentage point of the rate
        prizeFeeBps = 500; // a twentieth of each prize won
        strategyChangeDelay = 7 days;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ========== OWNER CONFIGURATION ==========

    function setVaultModule(address _vaultModule) external onlyOwner {
        require(_vaultModule != address(0), "Invalid vault module");
        vaultModule = IVaultSystemModule(_vaultModule);
    }

    function setManagementFeeBps(uint256 feeBps) external onlyOwner {
        require(feeBps <= MAX_FEE_BPS, "Fee above maximum");
        managementFeeBps = feeBps;
        emit ManagementFeeSet(feeBps);
    }

    /// @notice Share of each claimed prize kept by the treasury. A prize
    /// position earns no rate, so this is the only thing a fee could come from —
    /// and a member who never wins is never charged.
    function setPrizeFeeBps(uint256 feeBps) external onlyOwner {
        require(feeBps <= MAX_PRIZE_FEE_BPS, "Fee above maximum");
        prizeFeeBps = feeBps;
        emit PrizeFeeSet(feeBps);
    }

    function setStrategyChangeDelay(uint256 delay) external onlyOwner {
        strategyChangeDelay = delay;
    }

    function pauseStrategies(bool paused) external onlyOwner {
        strategiesPaused = paused;
        emit StrategiesPaused(paused);
    }

    /// @notice Turn earning on by default for vaults created from now on.
    /// Existing vaults keep MODE_OFF while their mode is UNSET, so no balance
    /// already in custody is ever invested without a fresh deposit.
    function setYieldWatermark() external onlyOwner {
        uint256 from = vaultModule.getVaultCount() + 1;
        yieldEnabledFromVaultId = from;
        emit YieldWatermarkSet(from);
    }

    /// @notice Point a token+mode at a strategy. Replacing a live strategy
    /// decides where custodied funds go, so it must be queued and waited out —
    /// users get a window to switch earning off first. The first assignment for
    /// a token+mode is immediate, since no funds are parked there yet.
    function setStrategy(address token, uint8 mode, address strategy) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(mode == MODE_STABLE || mode == MODE_PRIZE, "Invalid mode");
        require(strategy != address(0), "Invalid strategy");
        // Prize strategies are a different shape — per member, paying a different
        // token — so they are validated against their own interface.
        if (mode == MODE_PRIZE) {
            require(IPrizeStrategy(strategy).asset() == token, "Strategy asset mismatch");
            require(IPrizeStrategy(strategy).mode() == mode, "Strategy mode mismatch");
            require(IPrizeStrategy(strategy).controller() == address(this), "Strategy controller mismatch");
        } else {
            require(IYieldStrategy(strategy).asset() == token, "Strategy asset mismatch");
            require(IYieldStrategy(strategy).mode() == mode, "Strategy mode mismatch");
            require(IYieldStrategy(strategy).controller() == address(this), "Strategy controller mismatch");
        }

        address current = strategies[token][mode];
        if (current != address(0) && current != strategy) {
            bytes32 key = keccak256(abi.encodePacked(token, mode, strategy));
            uint256 readyAt = strategyChangeReadyAt[key];
            require(readyAt != 0, "Strategy change not queued");
            require(block.timestamp >= readyAt, "Strategy change not ready");
            delete strategyChangeReadyAt[key];
        }

        strategies[token][mode] = strategy;
        emit StrategySet(token, mode, strategy);
    }

    function queueStrategyChange(address token, uint8 mode, address strategy) external onlyOwner {
        require(strategy != address(0), "Invalid strategy");
        bytes32 key = keccak256(abi.encodePacked(token, mode, strategy));
        uint256 readyAt = block.timestamp + strategyChangeDelay;
        strategyChangeReadyAt[key] = readyAt;
        emit StrategyChangeQueued(token, mode, strategy, readyAt);
    }

    // ========== VAULT MODULE HOOKS ==========

    function setVaultMode(uint256 vaultId, address token, uint8 mode) external onlyVaultModule {
        require(mode == MODE_OFF || mode == MODE_STABLE || mode == MODE_PRIZE, "Invalid mode");
        VaultYieldState storage y = vaultYield[vaultId];
        require(y.mode != mode, "Yield mode unchanged");
        if (mode != MODE_OFF) {
            require(strategies[token][mode] != address(0), "No strategy for token");
        }
        y.mode = mode;
        emit VaultModeSet(vaultId, mode, strategies[token][mode]);
    }

    /// @notice Invest `amount` of `token` for `vaultId`. A third-party protocol
    /// must never be able to block a user's deposit, so every failure path here
    /// returns the tokens and leaves them idle instead of reverting.
    /// @dev There is deliberately no minimum. Earning applies whatever the
    /// balance or the deposit — a small saver is exactly who this is for. An
    /// amount too small to buy a single share is simply left idle and swept in
    /// with the next deposit, never stranded.
    function onDeposit(uint256 vaultId, address token, address member, uint256 amount)
        external
        onlyVaultModule
    {
        if (strategiesPaused || token == address(0) || amount == 0) return;

        uint8 mode = effectiveMode(vaultId);
        if (mode == MODE_PRIZE) {
            _investPrize(vaultId, token, member, amount);
            return;
        }
        if (mode != MODE_STABLE) return;

        address strategy = strategies[token][mode];
        if (strategy == address(0)) return;

        VaultYieldState storage y = vaultYield[vaultId];
        // Never mix two strategies in one position — the share price differs.
        if (y.strategy != address(0) && y.strategy != strategy) {
            emit StrategyDepositSkipped(vaultId, token, amount, "Strategy changed");
            return;
        }

        _accrue(vaultId);

        IERC20 erc20 = IERC20(token);
        uint256 before = erc20.balanceOf(address(this));
        erc20.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = erc20.balanceOf(address(this)) - before;
        if (received == 0) return;

        erc20.forceApprove(strategy, received);
        try IYieldStrategy(strategy).deposit(received) returns (uint256 shares) {
            y.strategy = strategy;
            y.shares += shares;
            y.principal += received;
            if (y.lastAccrualAt == 0) y.lastAccrualAt = block.timestamp;
            emit Invested(vaultId, token, received, shares);
        } catch {
            // Reserve paused, supply cap hit, protocol frozen — hand the money
            // back and carry on. The deposit itself still succeeds.
            erc20.forceApprove(strategy, 0);
            erc20.safeTransfer(msg.sender, received);
            emit StrategyDepositSkipped(vaultId, token, received, "Strategy rejected deposit");
        }
    }

    /// @dev Prize savings: the member's own position, so their own odds. Same
    /// contract as stable earning in every other respect — a protocol that
    /// refuses the deposit leaves the funds idle rather than failing the user.
    function _investPrize(uint256 vaultId, address token, address member, uint256 amount) private {
        address strategy = strategies[token][MODE_PRIZE];
        if (strategy == address(0) || member == address(0)) return;

        address current = prizeStrategyOf[vaultId];
        if (current != address(0) && current != strategy) {
            emit StrategyDepositSkipped(vaultId, token, amount, "Strategy changed");
            return;
        }

        IERC20 erc20 = IERC20(token);
        uint256 before = erc20.balanceOf(address(this));
        erc20.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = erc20.balanceOf(address(this)) - before;
        if (received == 0) return;

        erc20.forceApprove(strategy, received);
        try IPrizeStrategy(strategy).deposit(_accountId(vaultId, member), received) {
            prizeStrategyOf[vaultId] = strategy;
            prizePrincipal[vaultId][member] += received;
            emit Invested(vaultId, token, received, 0);
        } catch {
            erc20.forceApprove(strategy, 0);
            erc20.safeTransfer(msg.sender, received);
            emit StrategyDepositSkipped(vaultId, token, received, "Strategy rejected deposit");
        }
    }

    /// @dev One position per (vault, member) — the unit PoolTogether measures
    /// odds over.
    function _accountId(uint256 vaultId, address member) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(vaultId, member));
    }

    function settleMemberYield(uint256 vaultId, address member)
        external
        onlyVaultModule
        returns (uint256 credited)
    {
        // Prize savings pays in a different token and never compounds into a
        // balance, so there is nothing to settle into the ledger here.
        if (effectiveMode(vaultId) == MODE_PRIZE) return 0;

        _accrue(vaultId);
        VaultYieldState storage y = vaultYield[vaultId];
        if (y.accYieldPerShare == 0) return 0;

        uint256 balance = vaultModule.getVaultMember(vaultId, member).balance;
        uint256 accumulated = (balance * y.accYieldPerShare) / YIELD_PRECISION;
        uint256 debt = memberYieldDebt[vaultId][member];
        // Mirrors VaultSystemModule._settlePenalties: a member who joined after
        // the accumulator moved must not be credited for yield they missed.
        if (debt > accumulated) debt = accumulated;

        credited = accumulated - debt;
        if (credited > y.owedYield) credited = y.owedYield; // never over-allocate

        memberYieldDebt[vaultId][member] = accumulated;
        if (credited == 0) return 0;

        y.owedYield -= credited;
        // While the position is live the yield stays inside the strategy and
        // simply becomes principal, so it keeps earning with no token movement.
        // Once divested (shares == 0) those tokens already sit idle in the vault
        // module, so there is no principal to record.
        if (y.shares > 0) y.principal += credited;

        emit MemberYieldSettled(vaultId, member, credited);
    }

    function snapshotMemberYield(uint256 vaultId, address member, uint256 newBalance)
        external
        onlyVaultModule
    {
        memberYieldDebt[vaultId][member] =
            (newBalance * vaultYield[vaultId].accYieldPerShare) / YIELD_PRECISION;
    }

    /// @notice Redeem exactly `amount` for `vaultId` and send it to `recipient`.
    /// The caller passes the shortfall it cannot cover from that vault's own
    /// idle funds, which is what keeps one vault from spending another's.
    function ensureLiquidity(
        uint256 vaultId,
        address token,
        address member,
        uint256 amount,
        address recipient
    ) external onlyVaultModule {
        if (amount == 0) return;

        if (effectiveMode(vaultId) == MODE_PRIZE) {
            address strategy = prizeStrategyOf[vaultId];
            require(strategy != address(0), "Insufficient strategy liquidity");
            uint256 invested = prizePrincipal[vaultId][member];
            require(amount <= invested, "Insufficient strategy liquidity");

            prizePrincipal[vaultId][member] = invested - amount;
            IPrizeStrategy(strategy).withdraw(_accountId(vaultId, member), amount, recipient);
            emit Divested(vaultId, token, amount, 0);
            return;
        }

        VaultYieldState storage y = vaultYield[vaultId];
        require(y.strategy != address(0) && y.shares > 0, "Insufficient strategy liquidity");

        _accrue(vaultId);
        require(amount <= y.principal, "Insufficient strategy liquidity");

        uint256 burned = IYieldStrategy(y.strategy).withdraw(amount, recipient);
        y.shares = burned >= y.shares ? 0 : y.shares - burned;
        y.principal -= amount;
        emit Divested(vaultId, token, amount, burned);
    }

    /// @notice Full exit for one vault: principal and members' yield go back to
    /// the vault module, the treasury's cut stays here awaiting a sweep.
    function divestAll(uint256 vaultId, address member, address recipient)
        external
        onlyVaultModule
        returns (uint256 assets)
    {
        // Prize savings holds one position per member rather than one per vault,
        // so unwinding means emptying that member's own position.
        address prizeStrategy = prizeStrategyOf[vaultId];
        if (prizeStrategy != address(0)) {
            uint256 returned =
                IPrizeStrategy(prizeStrategy).withdrawAll(_accountId(vaultId, member), recipient);
            prizePrincipal[vaultId][member] = 0;
            if (returned > 0) emit Divested(vaultId, IPrizeStrategy(prizeStrategy).asset(), returned, 0);
            return returned;
        }

        VaultYieldState storage y = vaultYield[vaultId];
        if (y.strategy == address(0) || y.shares == 0) {
            y.shares = 0;
            y.strategy = address(0);
            return 0;
        }

        _accrue(vaultId);
        address strategy = y.strategy;
        address token = IYieldStrategy(strategy).asset();

        uint256 redeemed = IYieldStrategy(strategy).redeemShares(y.shares, address(this));
        uint256 fees = y.accruedFees;
        if (fees > redeemed) fees = redeemed;

        assets = redeemed - fees;
        pendingFees[token] += fees;

        y.shares = 0;
        y.principal = 0;
        y.accruedFees = 0;
        y.deficit = 0;
        y.strategy = address(0);
        // owedYield deliberately survives: it is the members' unsettled claim,
        // and those tokens are about to sit idle in the vault module.

        if (assets > 0) IERC20(token).safeTransfer(recipient, assets);
        emit Divested(vaultId, token, assets, 0);
    }

    // ========== ACCRUAL ==========

    function accrue(uint256 vaultId) external nonReentrant {
        _accrue(vaultId);
    }

    /// @dev Folds new yield into the vault's accumulator and takes the fee.
    /// Runs before every change to `principal` — deposit, withdrawal, penalty
    /// withdrawal, mode change, member settlement — which is exactly what makes
    /// the time-weighted fee exact rather than approximate: principal is
    /// constant across each accrual period by construction.
    function _accrue(uint256 vaultId) private {
        VaultYieldState storage y = vaultYield[vaultId];
        if (y.strategy == address(0) || y.shares == 0) {
            y.lastAccrualAt = block.timestamp;
            return;
        }

        uint256 value = IYieldStrategy(y.strategy).convertToAssets(y.shares);
        uint256 accounted = y.principal + y.owedYield + y.accruedFees;

        uint256 gross;
        if (value + y.deficit >= accounted) {
            uint256 surplus = value + y.deficit - accounted;
            // Repay a recorded loss before anyone earns anything.
            uint256 repay = surplus < y.deficit ? surplus : y.deficit;
            y.deficit -= repay;
            gross = surplus - repay;
        } else {
            // Realized loss. Record it in full; never haircut a member's balance.
            uint256 previous = y.deficit;
            y.deficit = accounted - value;
            // Announce it only when it is material — see DEFICIT_EVENT_THRESHOLD.
            uint256 added = y.deficit - previous;
            if (added * DEFICIT_EVENT_THRESHOLD > y.principal) {
                emit YieldDeficit(vaultId, y.deficit);
            }
        }

        uint256 feeTaken;
        // A prize strategy earns nothing between claims, so a time-weighted fee
        // there would only ever accrue debt. Its fee comes out of each claimed
        // prize, so its fee will come out of each claimed prize in Phase 2.
        if (IYieldStrategy(y.strategy).mode() == MODE_STABLE && managementFeeBps > 0) {
            uint256 elapsed = block.timestamp - y.lastAccrualAt;
            uint256 feeTarget = (y.principal * managementFeeBps * elapsed) / (MAX_BPS * SECONDS_PER_YEAR);
            uint256 feeOwed = y.feeDebt + feeTarget;
            // The hard constraint: the fee is capped by the yield actually
            // realized. A flat period costs the user nothing and the shortfall
            // waits in feeDebt.
            feeTaken = feeOwed < gross ? feeOwed : gross;
            y.feeDebt = feeOwed - feeTaken;
            if (feeTaken > 0) {
                y.accruedFees += feeTaken;
                y.lifetimeFees += feeTaken;
            }
        }

        uint256 net = gross - feeTaken;
        if (net > 0) {
            uint256 totalBalance = vaultModule.getVault(vaultId).totalBalance;
            if (totalBalance > 0) {
                y.accYieldPerShare += (net * YIELD_PRECISION) / totalBalance; // rounds down
                y.owedYield += net;
                y.lifetimeYield += net;
            } else {
                // Nobody to credit — leave it in the position for whoever is
                // next in, rather than inventing a claim on it.
                net = 0;
            }
        }

        y.lastAccrualAt = block.timestamp;
        if (gross > 0 || feeTaken > 0) emit YieldAccrued(vaultId, gross, feeTaken, net);
    }

    // ========== FEES ==========

    /// @notice Move collected fees to the treasury. Permissionless — the
    /// destination is the vault module's treasury, so there is nothing to abuse.
    function sweepFees(address token) external nonReentrant returns (uint256 amount) {
        address treasury = vaultModule.treasury();
        require(treasury != address(0), "Invalid treasury");

        amount = pendingFees[token];
        uint256 held = IERC20(token).balanceOf(address(this));
        if (amount > held) amount = held;
        if (amount == 0) return 0;

        pendingFees[token] -= amount;
        IERC20(token).safeTransfer(treasury, amount);
        emit FeesSwept(token, treasury, amount);
    }

    /// @notice Redeem a vault's accrued fees out of its strategy so they can be
    /// swept. Permissionless; touches only the treasury's own share.
    function realizeFees(uint256 vaultId) external nonReentrant returns (uint256 amount) {
        _accrue(vaultId);
        VaultYieldState storage y = vaultYield[vaultId];
        amount = y.accruedFees;
        if (amount == 0 || y.strategy == address(0) || y.shares == 0) return 0;

        address token = IYieldStrategy(y.strategy).asset();
        uint256 burned = IYieldStrategy(y.strategy).withdraw(amount, address(this));
        y.shares = burned >= y.shares ? 0 : y.shares - burned;
        y.accruedFees = 0;
        pendingFees[token] += amount;
    }

    // ========== EMERGENCY ==========

    /// @notice Owner-only full exit for one vault, back into the vault module.
    function emergencyExitVault(uint256 vaultId) external onlyOwner nonReentrant returns (uint256 assets) {
        VaultYieldState storage y = vaultYield[vaultId];
        require(y.strategy != address(0), "Nothing invested");

        address strategy = y.strategy;
        address token = IYieldStrategy(strategy).asset();
        assets = IYieldStrategy(strategy).emergencyExit(address(this));

        y.shares = 0;
        y.principal = 0;
        y.accruedFees = 0;
        y.deficit = 0;
        y.strategy = address(0);
        y.mode = MODE_OFF;

        if (assets > 0) IERC20(token).safeTransfer(address(vaultModule), assets);
        emit EmergencyExit(vaultId, token, assets);
    }

    // ========== VIEWS ==========

    function effectiveMode(uint256 vaultId) public view returns (uint8) {
        uint8 stored = vaultYield[vaultId].mode;
        if (stored != MODE_UNSET) return stored;

        // Default-on, but only from the watermark forward, so nothing already in
        // custody moves without an explicit deposit.
        uint256 from = yieldEnabledFromVaultId;
        if (from == 0 || vaultId < from) return MODE_OFF;

        // And only for personal vaults. A community vault holds other people's
        // money under rules fixed at creation; defaulting it into an outside
        // protocol would commit members who never agreed to that and, since its
        // rules cannot change afterwards, leave them no way out. Its creator
        // opts in explicitly while still its only member.
        if (vaultModule.getVault(vaultId).vaultType != VAULT_TYPE_PERSONAL) return MODE_OFF;
        return MODE_STABLE;
    }

    /// @notice How much to invest right now. Stable earning pools the vault, so
    /// it measures against the vault's balance; prize savings gives each member
    /// their own position, so it measures against theirs. Answering here is what
    /// keeps the vault module from ever branching on the mode.
    function investableAmount(
        uint256 vaultId,
        address member,
        uint256 vaultTotalBalance,
        uint256 memberBalance
    ) external view returns (uint256) {
        if (effectiveMode(vaultId) == MODE_PRIZE) {
            uint256 invested = prizePrincipal[vaultId][member];
            return memberBalance > invested ? memberBalance - invested : 0;
        }
        uint256 vaultInvested = vaultYield[vaultId].principal;
        return vaultTotalBalance > vaultInvested ? vaultTotalBalance - vaultInvested : 0;
    }

    /// @notice How much has to come back out of the protocol to pay `needed`,
    /// after the idle funds belonging to this same scope are used first.
    function liquidityShortfall(
        uint256 vaultId,
        address member,
        uint256 needed,
        uint256 vaultTotalBalance,
        uint256 memberBalance
    ) external view returns (uint256) {
        uint256 invested;
        uint256 backing;
        if (effectiveMode(vaultId) == MODE_PRIZE) {
            invested = prizePrincipal[vaultId][member];
            backing = memberBalance;
        } else {
            invested = vaultYield[vaultId].principal;
            backing = vaultTotalBalance;
        }
        if (invested == 0) return 0;

        uint256 idle = backing > invested ? backing - invested : 0;
        return needed > idle ? needed - idle : 0;
    }

    /// @notice Pay a member their won prize tokens, less the fee.
    /// @dev Permissionless: it only ever moves prizes to the member who won
    /// them. The fee comes out of the prize itself — a prize position earns no
    /// rate, so there is nothing else it could come from, and a member who never
    /// wins is never charged.
    function claimPrizes(uint256 vaultId, address member)
        external
        nonReentrant
        returns (uint256 amount)
    {
        address strategy = prizeStrategyOf[vaultId];
        if (strategy == address(0)) return 0;

        address token = IPrizeStrategy(strategy).prizeToken();
        uint256 swept = IPrizeStrategy(strategy).sweepPrizes(_accountId(vaultId, member), address(this));
        if (swept == 0) return 0;

        uint256 fee = (swept * prizeFeeBps) / MAX_BPS;
        amount = swept - fee;
        if (fee > 0) pendingFees[token] += fee;
        IERC20(token).safeTransfer(member, amount);

        emit PrizesClaimed(vaultId, member, token, amount, fee);
    }

    function claimablePrizes(uint256 vaultId, address member)
        external
        view
        returns (uint256 amount, address token)
    {
        address strategy = prizeStrategyOf[vaultId];
        if (strategy == address(0)) return (0, address(0));
        token = IPrizeStrategy(strategy).prizeToken();
        uint256 gross = IPrizeStrategy(strategy).claimablePrizes(_accountId(vaultId, member));
        amount = gross - (gross * prizeFeeBps) / MAX_BPS;
    }

    /// @notice The member's own prize position, or address(0) before first use.
    function prizePositionOf(uint256 vaultId, address member) external view returns (address) {
        address strategy = prizeStrategyOf[vaultId];
        if (strategy == address(0)) return address(0);
        return IPrizeStrategy(strategy).positionOf(_accountId(vaultId, member));
    }

    function investedPrincipal(uint256 vaultId) external view returns (uint256) {
        return vaultYield[vaultId].principal;
    }

    function pendingYield(uint256 vaultId, address member) external view returns (uint256) {
        VaultYieldState storage y = vaultYield[vaultId];
        uint256 balance = vaultModule.getVaultMember(vaultId, member).balance;
        if (balance == 0) return 0;

        // Include yield that has accrued but not yet been folded in, so the UI
        // doesn't show zero just because nobody has called accrue() lately.
        uint256 acc = y.accYieldPerShare + _projectedAccPerShare(vaultId);
        uint256 accumulated = (balance * acc) / YIELD_PRECISION;
        uint256 debt = memberYieldDebt[vaultId][member];
        if (debt > accumulated) debt = accumulated;
        return accumulated - debt;
    }

    /// @dev View-only mirror of the net-yield half of _accrue, so views can show
    /// what the next accrual would credit without changing state.
    function _projectedAccPerShare(uint256 vaultId) private view returns (uint256) {
        VaultYieldState storage y = vaultYield[vaultId];
        if (y.strategy == address(0) || y.shares == 0) return 0;

        uint256 value = IYieldStrategy(y.strategy).convertToAssets(y.shares);
        uint256 accounted = y.principal + y.owedYield + y.accruedFees;
        if (value + y.deficit <= accounted) return 0;

        uint256 surplus = value + y.deficit - accounted;
        uint256 gross = surplus < y.deficit ? 0 : surplus - y.deficit;
        if (gross == 0) return 0;

        if (IYieldStrategy(y.strategy).mode() == MODE_STABLE && managementFeeBps > 0) {
            uint256 elapsed = block.timestamp - y.lastAccrualAt;
            uint256 feeOwed =
                y.feeDebt + (y.principal * managementFeeBps * elapsed) / (MAX_BPS * SECONDS_PER_YEAR);
            uint256 feeTaken = feeOwed < gross ? feeOwed : gross;
            gross -= feeTaken;
        }
        if (gross == 0) return 0;

        uint256 totalBalance = vaultModule.getVault(vaultId).totalBalance;
        if (totalBalance == 0) return 0;
        return (gross * YIELD_PRECISION) / totalBalance;
    }

    function getVaultYield(uint256 vaultId) external view returns (VaultYieldState memory) {
        return vaultYield[vaultId];
    }

    function getStrategy(address token, uint8 mode) external view returns (address) {
        return strategies[token][mode];
    }

    /// @notice Current asset value of a vault's position, including yield and
    /// fees still inside it.
    function investedValue(uint256 vaultId) external view returns (uint256) {
        VaultYieldState storage y = vaultYield[vaultId];
        if (y.strategy == address(0) || y.shares == 0) return 0;
        return IYieldStrategy(y.strategy).convertToAssets(y.shares);
    }

    /// @notice Annual rate for a token+mode in basis points, 0 when unavailable.
    function currentAprBps(address token, uint8 mode) external view returns (uint256) {
        address strategy = strategies[token][mode];
        if (strategy == address(0)) return 0;
        return IYieldStrategy(strategy).aprBps();
    }

    function memberYieldDebtOf(uint256 vaultId, address member) external view returns (uint256) {
        return memberYieldDebt[vaultId][member];
    }
}
