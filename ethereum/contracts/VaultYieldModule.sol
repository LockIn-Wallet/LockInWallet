// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SavingsInterfaces.sol";
import "./YieldInterfaces.sol";

/// @notice The vault side of earning, as this module needs to see it.
interface ISavingsVaults {
    function balanceOf(uint256 vaultId, address member, address token) external view returns (uint256);
    function totalOf(uint256 vaultId, address token) external view returns (uint256);
    function treasury() external view returns (address);
}

/// @title VaultYieldModule
/// @notice Earning for the unified vault module.
///
/// Same accounting as before, with one structural change that the unified vault
/// forced: a position is per (vault, TOKEN), not per vault. A stables vault
/// holds several assets at once, and each earns in its own market — USDC's Aave
/// reserve knows nothing about DAI's — so one position per vault could not
/// represent it.
///
/// The fee is one percentage point of the rate, time-weighted on principal, and
/// it can never come out of principal: what it takes is capped by the yield
/// actually realized since the last accrual, and any shortfall waits in feeDebt
/// for later yield. That is structural rather than arithmetic — the fee is
/// funded only from the surplus above principal, so there is no code path from
/// a deposit to a fee.
///
/// Position identity, true after every operation while shares > 0:
///   strategy.convertToAssets(shares) + deficit
///     == principal + owedYield + accruedFees      (± down-rounding dust)
contract VaultYieldModule is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    ISavingsCore public savingsCore;
    ISavingsVaults public vaults;
    uint256 public managementFeeBps;
    bool private locked;
    bool public strategiesPaused;
    uint256 public strategyChangeDelay;

    mapping(address => mapping(uint8 => address)) private strategies; // token => mode => strategy
    /// @dev vaultId => token => position. The change that the unified vault
    /// forced: a stables vault earns in several markets at once.
    mapping(uint256 => mapping(address => VaultYieldState)) private positions;
    mapping(uint256 => mapping(address => mapping(address => uint256))) private memberDebt;
    mapping(address => uint256) public pendingFees;
    mapping(bytes32 => uint256) private changeReadyAt;
    /// @dev vaultId => token => member's chosen mode. UNSET defers to the default.
    mapping(uint256 => mapping(address => uint8)) private vaultMode;

    // ==== APPEND NEW STATE BELOW THIS LINE ONLY ====

    /// @dev 1e18, deliberately not the penalty accumulator's 1e12: yield arrives
    /// in far smaller increments, and on a 6-decimal stablecoin 1e12 truncates a
    /// small harvest to zero and loses it permanently.
    uint256 private constant YIELD_PRECISION = 1e18;
    uint256 private constant MAX_FEE_BPS = 200;
    uint256 private constant MAX_BPS = 10000;
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    /// @dev Aave's scaled-balance rounding leaves a position a unit or two short
    /// of what was supplied. That is real and accounted for, but it is not a
    /// protocol loss and should not page anyone.
    uint256 private constant DEFICIT_EVENT_THRESHOLD = 1e6;

    event StrategySet(address indexed token, uint8 indexed mode, address indexed strategy);
    event Invested(uint256 indexed vaultId, address indexed token, uint256 assets, uint256 shares);
    event Divested(uint256 indexed vaultId, address indexed token, uint256 assets);
    event YieldAccrued(uint256 indexed vaultId, address indexed token, uint256 gross, uint256 fee, uint256 net);
    event YieldDeficit(uint256 indexed vaultId, address indexed token, uint256 deficit);
    event MemberYieldSettled(uint256 indexed vaultId, address indexed token, address indexed member, uint256 credited);
    event FeesSwept(address indexed token, address indexed treasury, uint256 amount);
    event VaultModeSet(uint256 indexed vaultId, address indexed token, uint8 mode);
    event StrategyDepositSkipped(uint256 indexed vaultId, address indexed token, uint256 amount);

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyVaults() {
        require(msg.sender == address(vaults), "Not vault module");
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
        strategyChangeDelay = 7 days;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ========== CONFIGURATION ==========

    function setVaultModule(address _vaults) external onlyOwner {
        require(_vaults != address(0), "Invalid vault module");
        vaults = ISavingsVaults(_vaults);
    }

    function setManagementFeeBps(uint256 feeBps) external onlyOwner {
        require(feeBps <= MAX_FEE_BPS, "Fee above maximum");
        managementFeeBps = feeBps;
    }

    function pauseStrategies(bool paused) external onlyOwner {
        strategiesPaused = paused;
    }

    function setStrategyChangeDelay(uint256 delay) external onlyOwner {
        strategyChangeDelay = delay;
    }

    /// @notice Point a token at a strategy. Replacing a live one decides where
    /// custodied funds go, so it must be queued and waited out first — users get
    /// a window to switch earning off before their money moves.
    function setStrategy(address token, address strategy) external onlyOwner {
        require(token != address(0) && strategy != address(0), "Invalid input");
        require(IYieldStrategy(strategy).asset() == token, "Strategy asset mismatch");
        require(IYieldStrategy(strategy).controller() == address(this), "Strategy controller mismatch");

        address current = strategies[token][MODE_STABLE];
        if (current != address(0) && current != strategy) {
            bytes32 key = keccak256(abi.encodePacked(token, strategy));
            require(changeReadyAt[key] != 0, "Strategy change not queued");
            require(block.timestamp >= changeReadyAt[key], "Strategy change not ready");
            delete changeReadyAt[key];
        }
        strategies[token][MODE_STABLE] = strategy;
        emit StrategySet(token, MODE_STABLE, strategy);
    }

    function queueStrategyChange(address token, address strategy) external onlyOwner {
        changeReadyAt[keccak256(abi.encodePacked(token, strategy))] = block.timestamp + strategyChangeDelay;
    }

    // ========== VAULT HOOKS ==========

    /// @notice Choose whether a vault's holding of one token earns.
    function setMode(uint256 vaultId, address token, uint8 mode) external onlyVaults {
        require(mode == MODE_OFF || mode == MODE_STABLE, "Invalid mode");
        vaultMode[vaultId][token] = mode;
        emit VaultModeSet(vaultId, token, mode);
    }

    function modeOf(uint256 vaultId, address token) public view returns (uint8) {
        uint8 stored = vaultMode[vaultId][token];
        return stored == MODE_UNSET ? MODE_OFF : stored;
    }

    /// @notice Invest what this vault holds of one token and has not yet put to
    /// work. A protocol that refuses must never block a user's deposit, so every
    /// failure here leaves the funds with the caller.
    function onDeposit(uint256 vaultId, address token) external onlyVaults {
        if (strategiesPaused || token == address(0)) return;
        if (modeOf(vaultId, token) != MODE_STABLE) return;

        address strategy = strategies[token][MODE_STABLE];
        if (strategy == address(0)) return;

        VaultYieldState storage y = positions[vaultId][token];
        if (y.strategy != address(0) && y.strategy != strategy) return;

        _accrue(vaultId, token);

        uint256 held = vaults.totalOf(vaultId, token);
        if (held <= y.principal) return;
        uint256 toInvest = held - y.principal;

        IERC20 erc20 = IERC20(token);
        uint256 before = erc20.balanceOf(address(this));
        erc20.safeTransferFrom(msg.sender, address(this), toInvest);
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
            erc20.forceApprove(strategy, 0);
            erc20.safeTransfer(msg.sender, received);
            emit StrategyDepositSkipped(vaultId, token, received);
        }
    }

    /// @notice How much must come back out to pay `needed`, after the vault's
    /// own uninvested holding of that token is used first.
    function ensureLiquidity(uint256 vaultId, address token, uint256 needed, address recipient)
        external
        onlyVaults
    {
        VaultYieldState storage y = positions[vaultId][token];
        if (y.principal == 0) return;

        uint256 held = vaults.totalOf(vaultId, token);
        uint256 idle = held > y.principal ? held - y.principal : 0;
        if (needed <= idle) return;

        uint256 shortfall = needed - idle;
        _accrue(vaultId, token);
        require(shortfall <= y.principal, "Insufficient strategy liquidity");

        uint256 burned = IYieldStrategy(y.strategy).withdraw(shortfall, recipient);
        y.shares = burned >= y.shares ? 0 : y.shares - burned;
        y.principal -= shortfall;
        emit Divested(vaultId, token, shortfall);
    }

    /// @notice Pull a position out entirely. Switching earning off has to bring
    /// the whole position home, not just the part backing balances — otherwise
    /// "off" would leave the earnings sitting in Aave.
    function divestAll(uint256 vaultId, address token, address recipient) external onlyVaults {
        _accrue(vaultId, token);
        VaultYieldState storage y = positions[vaultId][token];
        y.principal = 0;
        if (y.strategy == address(0) || y.shares == 0) return;

        // The treasury's cut comes out first, so it is not handed to the vault
        // along with the members' money.
        uint256 fees = y.accruedFees;
        if (fees > 0) {
            uint256 burned = IYieldStrategy(y.strategy).withdraw(fees, address(this));
            y.shares = burned >= y.shares ? 0 : y.shares - burned;
            y.accruedFees = 0;
            pendingFees[token] += fees;
        }

        uint256 assets;
        if (y.shares > 0) assets = IYieldStrategy(y.strategy).redeemShares(y.shares, recipient);
        y.shares = 0;
        // owedYield stays owed. It now sits idle in the vault instead of the
        // strategy, and settleMember adds nothing to principal while shares are
        // zero — so the money is already where the credit will point.
        emit Divested(vaultId, token, assets);
    }

    /// @notice Credit a member their share of the yield on one token.
    function settleMember(uint256 vaultId, address token, address member)
        external
        onlyVaults
        returns (uint256 credited)
    {
        _accrue(vaultId, token);
        VaultYieldState storage y = positions[vaultId][token];
        if (y.accYieldPerShare == 0) return 0;

        uint256 balance = vaults.balanceOf(vaultId, member, token);
        uint256 accumulated = (balance * y.accYieldPerShare) / YIELD_PRECISION;
        uint256 debt = memberDebt[vaultId][token][member];
        // A member who arrived after the accumulator moved must not be credited
        // for yield they were not here for.
        if (debt > accumulated) debt = accumulated;

        credited = accumulated - debt;
        if (credited > y.owedYield) credited = y.owedYield;
        memberDebt[vaultId][token][member] = accumulated;
        if (credited == 0) return 0;

        y.owedYield -= credited;
        // The yield is already inside the strategy, so crediting it moves no
        // tokens — it simply becomes principal and keeps earning.
        if (y.shares > 0) y.principal += credited;
        emit MemberYieldSettled(vaultId, token, member, credited);
    }

    function snapshotMember(uint256 vaultId, address token, address member, uint256 newBalance)
        external
        onlyVaults
    {
        memberDebt[vaultId][token][member] =
            (newBalance * positions[vaultId][token].accYieldPerShare) / YIELD_PRECISION;
    }

    // ========== ACCRUAL ==========

    function accrue(uint256 vaultId, address token) external nonReentrant {
        _accrue(vaultId, token);
    }

    /// @dev Runs before every change to principal, which is what makes the
    /// time-weighted fee exact rather than approximate: principal is constant
    /// across each accrual period by construction.
    function _accrue(uint256 vaultId, address token) private {
        VaultYieldState storage y = positions[vaultId][token];
        if (y.strategy == address(0) || y.shares == 0) {
            y.lastAccrualAt = block.timestamp;
            return;
        }

        uint256 value = IYieldStrategy(y.strategy).convertToAssets(y.shares);
        uint256 accounted = y.principal + y.owedYield + y.accruedFees;

        uint256 gross;
        if (value + y.deficit >= accounted) {
            uint256 surplus = value + y.deficit - accounted;
            // A recorded loss is repaid before anyone earns anything.
            uint256 repay = surplus < y.deficit ? surplus : y.deficit;
            y.deficit -= repay;
            gross = surplus - repay;
        } else {
            uint256 previous = y.deficit;
            y.deficit = accounted - value;
            if ((y.deficit - previous) * DEFICIT_EVENT_THRESHOLD > y.principal) {
                emit YieldDeficit(vaultId, token, y.deficit);
            }
        }

        uint256 feeTaken;
        if (managementFeeBps > 0) {
            uint256 elapsed = block.timestamp - y.lastAccrualAt;
            uint256 target = (y.principal * managementFeeBps * elapsed) / (MAX_BPS * SECONDS_PER_YEAR);
            uint256 owed = y.feeDebt + target;
            // The hard constraint: capped by the yield actually realized. A flat
            // period costs the user nothing and the shortfall waits.
            feeTaken = owed < gross ? owed : gross;
            y.feeDebt = owed - feeTaken;
            if (feeTaken > 0) {
                y.accruedFees += feeTaken;
                y.lifetimeFees += feeTaken;
            }
        }

        uint256 net = gross - feeTaken;
        if (net > 0) {
            uint256 total = vaults.totalOf(vaultId, token);
            if (total > 0) {
                y.accYieldPerShare += (net * YIELD_PRECISION) / total; // rounds down
                y.owedYield += net;
                y.lifetimeYield += net;
            } else {
                net = 0;
            }
        }

        y.lastAccrualAt = block.timestamp;
        if (gross > 0 || feeTaken > 0) emit YieldAccrued(vaultId, token, gross, feeTaken, net);
    }

    // ========== FEES ==========

    /// @notice Redeem a position's accrued fee so it can be swept. Touches only
    /// the treasury's own share.
    function realizeFees(uint256 vaultId, address token) external nonReentrant returns (uint256 amount) {
        _accrue(vaultId, token);
        VaultYieldState storage y = positions[vaultId][token];
        amount = y.accruedFees;
        if (amount == 0 || y.shares == 0) return 0;

        uint256 burned = IYieldStrategy(y.strategy).withdraw(amount, address(this));
        y.shares = burned >= y.shares ? 0 : y.shares - burned;
        y.accruedFees = 0;
        pendingFees[token] += amount;
    }

    /// @notice Permissionless: it can only ever move fees to the treasury the
    /// vault module already names, so there is nothing to abuse.
    function sweepFees(address token) external nonReentrant returns (uint256 amount) {
        address treasury = vaults.treasury();
        require(treasury != address(0), "Invalid treasury");
        amount = pendingFees[token];
        uint256 held = IERC20(token).balanceOf(address(this));
        if (amount > held) amount = held;
        if (amount == 0) return 0;

        pendingFees[token] -= amount;
        IERC20(token).safeTransfer(treasury, amount);
        emit FeesSwept(token, treasury, amount);
    }

    // ========== VIEWS ==========

    function getPosition(uint256 vaultId, address token) external view returns (VaultYieldState memory) {
        return positions[vaultId][token];
    }

    function investedPrincipal(uint256 vaultId, address token) external view returns (uint256) {
        return positions[vaultId][token].principal;
    }

    function investedValue(uint256 vaultId, address token) external view returns (uint256) {
        VaultYieldState storage y = positions[vaultId][token];
        if (y.strategy == address(0) || y.shares == 0) return 0;
        return IYieldStrategy(y.strategy).convertToAssets(y.shares);
    }

    function pendingYield(uint256 vaultId, address token, address member) external view returns (uint256) {
        VaultYieldState storage y = positions[vaultId][token];
        uint256 balance = vaults.balanceOf(vaultId, member, token);
        if (balance == 0 || y.accYieldPerShare == 0) return 0;

        uint256 accumulated = (balance * y.accYieldPerShare) / YIELD_PRECISION;
        uint256 debt = memberDebt[vaultId][token][member];
        if (debt > accumulated) debt = accumulated;
        return accumulated - debt;
    }

    function getStrategy(address token) external view returns (address) {
        return strategies[token][MODE_STABLE];
    }

    /// @notice Current annual rate for a token in basis points, 0 when unknown.
    function currentAprBps(address token) external view returns (uint256) {
        address strategy = strategies[token][MODE_STABLE];
        if (strategy == address(0)) return 0;
        return IYieldStrategy(strategy).aprBps();
    }
}
