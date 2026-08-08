// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MockAToken.sol";
import "./strategies/AaveV3Strategy.sol";

/// @notice Test-only Aave v3 Pool. Holds the underlying and mints aTokens 1:1.
/// Yield is not simulated implicitly — a test calls `simulateYield`, which pulls
/// real underlying from the caller before minting the matching aTokens, so the
/// pool can always honour a withdrawal and tests can never "earn" money that
/// does not exist.
contract MockAavePool {
    using SafeERC20 for IERC20;

    mapping(address => address) public aTokens; // underlying => aToken
    mapping(address => uint256) public liquidityRateRay; // underlying => annual rate in rays

    bool public supplyPaused;
    bool public reserveDataBroken;
    uint256 public supplyShortfall;

    function registerReserve(address asset, address aToken) external {
        aTokens[asset] = aToken;
    }

    /// @notice Make `supply` revert, standing in for a paused or frozen reserve
    /// or a hit supply cap.
    function setSupplyPaused(bool paused) external {
        supplyPaused = paused;
    }

    /// @notice Make `getReserveData` revert, standing in for a future Aave
    /// release that reshapes the struct.
    function setReserveDataBroken(bool broken) external {
        reserveDataBroken = broken;
    }

    function setLiquidityRate(address asset, uint256 rateRay) external {
        liquidityRateRay[asset] = rateRay;
    }

    /// @notice Credit `units` fewer aTokens than were supplied.
    ///
    /// At 1 unit this reproduces real Aave's scaled-balance rounding: it stores
    /// `amount / index` and reports `scaled * index` rounded down, so supplying
    /// N units leaves a position worth N-1 (verified on the live Optimism pool).
    /// At a larger value it stands in for a fee-on-transfer token, which the
    /// strategy must refuse rather than absorb. Zero by default so the
    /// arithmetic in most tests stays readable.
    function setSupplyShortfall(uint256 units) external {
        supplyShortfall = units;
    }

    /// @notice Credit `amount` of interest to `holder`, funded by the caller.
    function simulateYield(address asset, address holder, uint256 amount) external {
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        MockAToken(aTokens[asset]).mint(holder, amount);
    }

    /// @notice Burn `amount` of a holder's position without returning anything,
    /// standing in for protocol bad debt.
    function simulateLoss(address asset, address holder, uint256 amount) external {
        MockAToken(aTokens[asset]).burn(holder, amount);
        IERC20(asset).safeTransfer(msg.sender, amount);
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        require(!supplyPaused, "Reserve paused");
        address aToken = aTokens[asset];
        require(aToken != address(0), "Reserve not registered");
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        uint256 credited = amount > supplyShortfall ? amount - supplyShortfall : 0;
        if (credited > 0) MockAToken(aToken).mint(onBehalfOf, credited);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        address aToken = aTokens[asset];
        require(aToken != address(0), "Reserve not registered");
        // Mirrors the real failure: the reserve is short of underlying even
        // though the position says otherwise.
        require(IERC20(asset).balanceOf(address(this)) >= amount, "Not enough liquidity");
        MockAToken(aToken).burn(msg.sender, amount);
        IERC20(asset).safeTransfer(to, amount);
        return amount;
    }

    function getReserveData(address asset) external view returns (AaveReserveData memory data) {
        require(!reserveDataBroken, "Reserve data unavailable");
        data.currentLiquidityRate = uint128(liquidityRateRay[asset]);
        data.aTokenAddress = aTokens[asset];
    }
}
