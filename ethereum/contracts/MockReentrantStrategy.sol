// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./YieldInterfaces.sol";
import "./SavingsInterfaces.sol";

/// @notice Test-only hostile strategy. Holds the tokens itself (no external
/// protocol) and, on withdrawal, tries to re-enter VaultSystemModule.withdraw
/// before returning the funds. Exists to prove the vault module's reentrancy
/// guard still holds now that a withdrawal makes external calls.
contract MockReentrantStrategy is IYieldStrategy {
    using SafeERC20 for IERC20;

    address public immutable override controller;
    address public immutable underlying;
    IVaultSystemModule public immutable vaultModule;
    uint256 public totalShares;

    uint256 public attackVaultId;
    uint256 public attackAmount;
    bool public attacking;

    constructor(address _asset, address _controller, address _vaultModule) {
        underlying = _asset;
        controller = _controller;
        vaultModule = IVaultSystemModule(_vaultModule);
    }

    function armAttack(uint256 vaultId, uint256 amount) external {
        attackVaultId = vaultId;
        attackAmount = amount;
        attacking = true;
    }

    function asset() external view override returns (address) {
        return underlying;
    }

    function mode() external pure override returns (uint8) {
        return MODE_STABLE;
    }

    function totalAssets() public view override returns (uint256) {
        return IERC20(underlying).balanceOf(address(this));
    }

    function deposit(uint256 assets) external override returns (uint256 shares) {
        require(msg.sender == controller, "Not controller");
        uint256 before = totalAssets();
        IERC20(underlying).safeTransferFrom(msg.sender, address(this), assets);
        shares = (totalShares == 0 || before == 0) ? assets : (assets * totalShares) / before;
        totalShares += shares;
    }

    function withdraw(uint256 assets, address recipient) external override returns (uint256 sharesBurned) {
        require(msg.sender == controller, "Not controller");
        if (attacking) {
            attacking = false;
            // Should revert with "Reentrant call" and take this whole call with it.
            vaultModule.withdraw(attackVaultId, attackAmount);
        }
        uint256 assetsTotal = totalAssets();
        sharesBurned = (assets * totalShares + assetsTotal - 1) / assetsTotal;
        if (sharesBurned > totalShares) sharesBurned = totalShares;
        totalShares -= sharesBurned;
        IERC20(underlying).safeTransfer(recipient, assets);
    }

    function redeemShares(uint256 shares, address recipient) external override returns (uint256 assets) {
        require(msg.sender == controller, "Not controller");
        assets = convertToAssets(shares);
        totalShares -= shares;
        if (assets > 0) IERC20(underlying).safeTransfer(recipient, assets);
    }

    function emergencyExit(address recipient) external override returns (uint256 assets) {
        require(msg.sender == controller, "Not controller");
        assets = totalAssets();
        totalShares = 0;
        if (assets > 0) IERC20(underlying).safeTransfer(recipient, assets);
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares * totalAssets()) / totalShares;
    }

    function convertToShares(uint256 assets) external view override returns (uint256) {
        uint256 assetsTotal = totalAssets();
        if (totalShares == 0 || assetsTotal == 0) return assets;
        return (assets * totalShares) / assetsTotal;
    }

    function maxWithdrawable() external view override returns (uint256) {
        return totalAssets();
    }

    function aprBps() external pure override returns (uint256) {
        return 0;
    }

    function harvestRewards(bytes calldata) external pure override returns (uint256) {
        return 0;
    }
}
