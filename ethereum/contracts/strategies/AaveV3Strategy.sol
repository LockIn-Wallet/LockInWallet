// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../YieldInterfaces.sol";

/// @notice Aave v3 reserve state. Laid out to match Aave v3.0/3.1's
/// `DataTypes.ReserveData` so `getReserveData` decodes. Only used for the
/// display rate, and every read is wrapped in try/catch — if a future Aave
/// release reshapes this struct the strategy reports an unknown rate instead of
/// breaking.
struct AaveReserveData {
    uint256 configuration;
    uint128 liquidityIndex;
    uint128 currentLiquidityRate;
    uint128 variableBorrowIndex;
    uint128 currentVariableBorrowRate;
    uint128 currentStableBorrowRate;
    uint40 lastUpdateTimestamp;
    uint16 id;
    address aTokenAddress;
    address stableDebtTokenAddress;
    address variableDebtTokenAddress;
    address interestRateStrategyAddress;
    uint128 accruedToTreasury;
    uint128 unbacked;
    uint128 isolationModeTotalDebt;
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;

    function withdraw(address asset, uint256 amount, address to) external returns (uint256);

    function getReserveData(address asset) external view returns (AaveReserveData memory);
}

/// @title AaveV3Strategy
/// @notice Supplies a single token to Aave v3 on behalf of the YieldModule.
/// Deliberately NOT upgradeable: a strategy holds funds, so the way to change
/// its behaviour is to deploy a new one and repoint the module through its
/// queued, delayed `setStrategy` — which gives users a window to opt out first.
///
/// Accounting is share-based (an internal ERC4626 without a token) so the module
/// can treat an accrual protocol and a prize protocol identically. aTokens
/// rebase 1:1 with the underlying, so `totalAssets()` is simply the aToken
/// balance and interest shows up as a rising share price.
contract AaveV3Strategy is IYieldStrategy {
    using SafeERC20 for IERC20;

    address public immutable override controller;
    address public immutable underlying;
    IAavePool public immutable pool;
    IERC20 public immutable aToken;

    uint256 public totalShares;

    /// @dev One ray, Aave's fixed-point scale for per-second rates.
    uint256 private constant RAY = 1e27;
    uint256 private constant MAX_BPS = 10000;

    /// @dev Aave stores a scaled balance and reports `balanceOf` as
    /// `scaledBalance * liquidityIndex`, rounded down — so supplying N units
    /// mints a position worth N-1. Verified against the live Optimism pool:
    /// supplying 1_000_000_000 USDC yields a 999_999_999 aUSDC balance. The
    /// guard below therefore has to allow a couple of units of rounding, while
    /// still rejecting a fee-on-transfer token, which loses whole basis points.
    uint256 private constant ROUNDING_TOLERANCE = 2;

    modifier onlyController() {
        require(msg.sender == controller, "Not controller");
        _;
    }

    constructor(address _asset, address _pool, address _aToken, address _controller) {
        require(_asset != address(0), "Invalid asset");
        require(_pool != address(0), "Invalid pool");
        require(_aToken != address(0), "Invalid aToken");
        require(_controller != address(0), "Invalid controller");
        underlying = _asset;
        pool = IAavePool(_pool);
        aToken = IERC20(_aToken);
        controller = _controller;
    }

    function asset() external view override returns (address) {
        return underlying;
    }

    function mode() external pure override returns (uint8) {
        return MODE_STABLE;
    }

    // ========== FUNDS ==========

    function deposit(uint256 assets) external override onlyController returns (uint256 shares) {
        require(assets > 0, "Invalid amount");
        uint256 assetsBefore = totalAssets();

        IERC20(underlying).safeTransferFrom(msg.sender, address(this), assets);
        IERC20(underlying).forceApprove(address(pool), assets);
        pool.supply(underlying, assets, address(this), 0);

        // What the position actually grew by, which is the only thing worth
        // issuing shares against. Rejects a fee-on-transfer or rebasing token,
        // whose loss dwarfs ROUNDING_TOLERANCE.
        uint256 gained = totalAssets() - assetsBefore;
        require(gained + ROUNDING_TOLERANCE >= assets, "Strategy deposit shortfall");

        // Priced off `gained`, not `assets`: issuing shares for value the pool
        // never credited would dilute every other vault in this strategy by the
        // rounding loss. Rounds down, so the depositor never gets more shares
        // than they paid for.
        shares = (totalShares == 0 || assetsBefore == 0) ? gained : (gained * totalShares) / assetsBefore;
        require(shares > 0, "Zero shares");
        totalShares += shares;
    }

    function withdraw(uint256 assets, address recipient)
        external
        override
        onlyController
        returns (uint256 sharesBurned)
    {
        require(assets > 0, "Invalid amount");
        require(recipient != address(0), "Invalid recipient");

        uint256 assetsTotal = totalAssets();
        require(assetsTotal >= assets, "Insufficient strategy liquidity");

        // Rounds up: burning the fractional share too leaves the dust in the
        // pool rather than handing it to the withdrawer.
        sharesBurned = (assets * totalShares + assetsTotal - 1) / assetsTotal;
        if (sharesBurned > totalShares) sharesBurned = totalShares;
        totalShares -= sharesBurned;

        uint256 received = pool.withdraw(underlying, assets, recipient);
        // Aave returns the amount actually withdrawn; never pay out short.
        require(received >= assets, "Insufficient strategy liquidity");
    }

    function redeemShares(uint256 shares, address recipient)
        external
        override
        onlyController
        returns (uint256 assets)
    {
        require(shares > 0 && shares <= totalShares, "Invalid shares");
        require(recipient != address(0), "Invalid recipient");

        assets = convertToAssets(shares);
        totalShares -= shares;
        if (assets == 0) return 0;

        uint256 received = pool.withdraw(underlying, assets, recipient);
        require(received >= assets, "Insufficient strategy liquidity");
    }

    function emergencyExit(address recipient) external override onlyController returns (uint256 assets) {
        require(recipient != address(0), "Invalid recipient");
        assets = totalAssets();
        totalShares = 0;
        if (assets == 0) return 0;
        assets = pool.withdraw(underlying, assets, recipient);
    }

    /// @notice Aave pays interest through the share price, so there is nothing
    /// discrete to claim here.
    function harvestRewards(bytes calldata) external pure override returns (uint256) {
        return 0;
    }

    // ========== VIEWS ==========

    function totalAssets() public view override returns (uint256) {
        return aToken.balanceOf(address(this));
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares * totalAssets()) / totalShares; // rounds down
    }

    function convertToShares(uint256 assets) external view override returns (uint256) {
        uint256 assetsTotal = totalAssets();
        if (totalShares == 0 || assetsTotal == 0) return assets;
        return (assets * totalShares) / assetsTotal;
    }

    /// @notice What Aave could actually pay out right now — the underlying sitting
    /// in the aToken contract. Falls below totalAssets() when the reserve is
    /// fully utilized, which is the case that makes a withdrawal revert.
    function maxWithdrawable() external view override returns (uint256) {
        uint256 available = IERC20(underlying).balanceOf(address(aToken));
        uint256 ours = totalAssets();
        return available < ours ? available : ours;
    }

    /// @notice Aave's current supply APR in basis points, or 0 when it cannot be
    /// read. This is APR, not compounded APY — the frontend compounds it and
    /// labels the result variable.
    function aprBps() external view override returns (uint256) {
        try pool.getReserveData(underlying) returns (AaveReserveData memory data) {
            // currentLiquidityRate is a per-year rate expressed in rays.
            return (uint256(data.currentLiquidityRate) * MAX_BPS) / RAY;
        } catch {
            return 0;
        }
    }
}
