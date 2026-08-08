// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../YieldInterfaces.sol";

/// @title PrizePosition
/// @notice One member's own stake in a PoolTogether prize vault.
///
/// This exists for exactly one reason: PoolTogether computes a depositor's odds
/// from the time-weighted balance of a single *address*. Pooling every member
/// behind one address would make them collectively one large depositor — winning
/// occasionally and splitting every prize, which is a variable bonus rate, not
/// the lottery people are opting into. Giving each member their own address
/// gives each their own real odds, including a real shot at the grand prize.
///
/// It is also where prizes land. Claimer bots call the prize pool on the vault's
/// behalf and the prize token is transferred straight to the winning depositor —
/// this contract — so there is nothing to claim from here, only to sweep.
///
/// @dev Deployed as an EIP-1167 minimal proxy, one per member, so a member costs
/// a proxy rather than a full contract. That rules out immutables, hence the
/// initializer. It holds funds, so every mutating call is controller-only.
contract PrizePosition {
    using SafeERC20 for IERC20;

    address public controller;
    address public asset;
    address public prizeVault;
    address public prizeToken;

    modifier onlyController() {
        require(msg.sender == controller, "Not controller");
        _;
    }

    /// @notice Bind this clone to its strategy. Callable once.
    function initialize(address _controller, address _asset, address _prizeVault, address _prizeToken)
        external
    {
        require(controller == address(0), "Already initialized");
        require(_controller != address(0), "Invalid controller");
        require(_asset != address(0) && _prizeVault != address(0), "Invalid config");
        controller = _controller;
        asset = _asset;
        prizeVault = _prizeVault;
        prizeToken = _prizeToken;
    }

    /// @notice Deposit assets already transferred here into the prize vault.
    function deposit(uint256 assets) external onlyController returns (uint256 shares) {
        require(assets > 0, "Invalid amount");
        IERC20(asset).forceApprove(prizeVault, assets);
        shares = IPrizeVault(prizeVault).deposit(assets, address(this));
        require(shares > 0, "Zero shares");
    }

    /// @notice Redeem exactly `assets` and send them to `recipient`.
    function withdraw(uint256 assets, address recipient) external onlyController {
        require(assets > 0, "Invalid amount");
        require(recipient != address(0), "Invalid recipient");
        require(IPrizeVault(prizeVault).maxWithdraw(address(this)) >= assets, "Insufficient strategy liquidity");
        IPrizeVault(prizeVault).withdraw(assets, recipient, address(this));
    }

    /// @notice Exit completely, returning everything to `recipient`.
    function withdrawAll(address recipient) external onlyController returns (uint256 assets) {
        require(recipient != address(0), "Invalid recipient");
        uint256 shares = IPrizeVault(prizeVault).balanceOf(address(this));
        if (shares == 0) return 0;
        assets = IPrizeVault(prizeVault).redeem(shares, recipient, address(this));
    }

    /// @notice Send won prize tokens to `recipient`.
    /// @dev Only ever touches the prize token, which is a different token from
    /// the deposited asset (WETH vs USDC on Optimism). A member's deposit can
    /// therefore never leave through this path.
    function sweepPrizes(address recipient) external onlyController returns (uint256 amount) {
        require(recipient != address(0), "Invalid recipient");
        if (prizeToken == address(0) || prizeToken == asset) return 0;
        amount = IERC20(prizeToken).balanceOf(address(this));
        if (amount == 0) return 0;
        IERC20(prizeToken).safeTransfer(recipient, amount);
    }

    // ---- Views ----

    /// @notice What this member could withdraw right now.
    function investedAssets() external view returns (uint256) {
        return IPrizeVault(prizeVault).maxWithdraw(address(this));
    }

    /// @notice Prize tokens won and not yet swept.
    function claimablePrizes() external view returns (uint256) {
        if (prizeToken == address(0) || prizeToken == asset) return 0;
        return IERC20(prizeToken).balanceOf(address(this));
    }
}
