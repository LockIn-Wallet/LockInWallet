// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Test-only PoolTogether v5 prize vault.
///
/// The defining behaviour, and the reason a lending-vault mock will not do:
/// shares stay 1:1 with the asset FOREVER. All the interest the underlying
/// earns is diverted to the prize pool, so a depositor's balance never grows —
/// their return arrives only as prizes, in a different token.
contract MockV5PrizeVault is ERC20 {
    using SafeERC20 for IERC20;

    address public immutable asset;
    uint8 private immutable _decimals;

    constructor(address _asset, uint8 decimals_) ERC20("Prize USDT", "pzUSDT") {
        asset = _asset;
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        IERC20(asset).safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, assets); // 1:1, always
        return assets;
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        require(msg.sender == owner, "Not owner");
        _burn(owner, assets);
        IERC20(asset).safeTransfer(receiver, assets);
        return assets;
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        require(msg.sender == owner, "Not owner");
        _burn(owner, shares);
        IERC20(asset).safeTransfer(receiver, shares);
        return shares;
    }

    function convertToAssets(uint256 shares) external pure returns (uint256) {
        return shares;
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return balanceOf(owner);
    }
}

/// @notice Test-only PoolTogether v5 prize pool.
///
/// Only the read side is modelled, because that is all a depositor touches.
/// Winning is simulated by `awardPrize`, which transfers the prize token
/// straight to the winner's address — exactly what a claimer bot's call to the
/// real `claimPrize` ends up doing. Note the prize token is NOT the deposited
/// asset: on Optimism it is WETH.
contract MockPrizePoolV5 {
    using SafeERC20 for IERC20;

    address public immutable prizeToken;
    uint8 public numberOfTiers = 7;
    uint104 public grandPrizeSize;
    bool public reverting;

    constructor(address _prizeToken, uint104 _grandPrizeSize) {
        prizeToken = _prizeToken;
        grandPrizeSize = _grandPrizeSize;
    }

    function setGrandPrizeSize(uint104 size) external {
        grandPrizeSize = size;
    }

    /// @notice Make the read side fail, standing in for a reshaped upstream ABI.
    function setReverting(bool value) external {
        reverting = value;
    }

    function getTierPrizeSize(uint8 tier) external view returns (uint104) {
        require(!reverting, "Prize pool unavailable");
        return tier == 0 ? grandPrizeSize : grandPrizeSize / 10;
    }

    /// @notice Pay a prize to a winning depositor, funded by the caller.
    function awardPrize(address winner, uint256 amount) external {
        IERC20(prizeToken).safeTransferFrom(msg.sender, winner, amount);
    }
}

/// @notice Test-only WETH stand-in — the token prizes are actually paid in.
contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {
        _mint(msg.sender, 1_000_000 ether);
    }
}
