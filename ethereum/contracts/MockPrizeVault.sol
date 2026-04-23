// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mock ERC4626 Prize Vault for localhost testing of PoolTogether integration.
/// Shares are minted 1:1 with deposited assets (no yield simulation).
contract MockPrizeVault is ERC20 {
    IERC20 public immutable underlying;

    constructor(address _asset) ERC20("Mock Prize Vault Share", "mpvUSDT") {
        require(_asset != address(0), "Invalid asset");
        underlying = IERC20(_asset);
    }

    function asset() external view returns (address) {
        return address(underlying);
    }

    function totalAssets() external view returns (uint256) {
        return underlying.balanceOf(address(this));
    }

    function convertToAssets(uint256 shares) external pure returns (uint256) {
        return shares;
    }

    function convertToShares(uint256 assets) external pure returns (uint256) {
        return assets;
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        require(assets > 0, "Zero deposit");
        underlying.transferFrom(msg.sender, address(this), assets);
        shares = assets;
        _mint(receiver, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        require(shares > 0, "Zero redeem");
        require(balanceOf(owner) >= shares, "Insufficient shares");
        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            require(allowed >= shares, "Not approved");
            _approve(owner, msg.sender, allowed - shares);
        }
        _burn(owner, shares);
        assets = shares;
        underlying.transfer(receiver, assets);
    }
}
