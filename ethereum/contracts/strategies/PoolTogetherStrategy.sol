// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "../YieldInterfaces.sol";
import "./PrizePosition.sol";

/// @title PoolTogetherStrategy
/// @notice Prize savings: a member's deposit earns no interest of its own —
/// the prize vault diverts all of it to the prize pool — and the return arrives
/// as occasional prizes, paid in the prize token.
///
/// Two facts about PoolTogether v5 shape this contract, both verified against
/// the live Optimism deployment rather than assumed:
///
/// 1. **Odds are per depositing address**, from its time-weighted balance. So
///    every member gets their own `PrizePosition` (an EIP-1167 clone) and their
///    own genuine odds, including a real chance at the grand prize. Pooling
///    members behind one address would have made them a single large depositor
///    whose prizes had to be split — a variable bonus rate, not a lottery.
/// 2. **Prizes are paid in the prize token, which is not the deposited asset**
///    (WETH, not USDC). They are also not claimed by the depositor: only the
///    prize vault may call `claimPrize`, third-party claimer bots do it, and the
///    prize token is transferred straight to the winning depositor. So there is
///    nothing to claim here — prizes simply arrive at the member's position and
///    are swept from it.
///
/// @dev Not upgradeable. Positions custody funds, so changing behaviour means
/// deploying a new strategy and repointing the module through its delayed
/// `setStrategy`, which gives members a window to opt out first.
contract PoolTogetherStrategy is IPrizeStrategy {
    using SafeERC20 for IERC20;

    address public immutable override controller;
    address public immutable override asset;
    address public immutable prizeVault;
    address public immutable prizePool;
    address public immutable override prizeToken;

    /// @notice The clone every member's position is stamped from.
    address public immutable positionImplementation;

    mapping(bytes32 => address) private positions;

    modifier onlyController() {
        require(msg.sender == controller, "Not controller");
        _;
    }

    constructor(address _prizeVault, address _prizePool, address _controller) {
        require(_prizeVault != address(0), "Invalid vault");
        require(_controller != address(0), "Invalid controller");

        prizeVault = _prizeVault;
        prizePool = _prizePool;
        controller = _controller;
        asset = IPrizeVault(_prizeVault).asset();

        // Read the prize token from the pool rather than taking it on trust —
        // it decides which token members are actually paid in.
        prizeToken = _prizePool == address(0) ? address(0) : IPrizePool(_prizePool).prizeToken();
        require(prizeToken != asset, "Prize token must differ from asset");

        positionImplementation = address(new PrizePosition());
    }

    function mode() external pure override returns (uint8) {
        return MODE_PRIZE;
    }

    function positionOf(bytes32 accountId) external view override returns (address) {
        return positions[accountId];
    }

    // ========== FUNDS ==========

    function deposit(bytes32 accountId, uint256 assets) external override onlyController {
        require(assets > 0, "Invalid amount");
        address position = positions[accountId];
        if (position == address(0)) {
            // Deterministic per account, so a position can always be found again.
            position = Clones.cloneDeterministic(positionImplementation, accountId);
            // The position answers to this strategy, not to the module above it.
            PrizePosition(position).initialize(address(this), asset, prizeVault, prizeToken);
            positions[accountId] = position;
            emit PositionDeployed(accountId, position);
        }

        IERC20(asset).safeTransferFrom(msg.sender, position, assets);
        PrizePosition(position).deposit(assets);
    }

    function withdraw(bytes32 accountId, uint256 assets, address recipient)
        external
        override
        onlyController
    {
        address position = positions[accountId];
        require(position != address(0), "Insufficient strategy liquidity");
        PrizePosition(position).withdraw(assets, recipient);
    }

    function withdrawAll(bytes32 accountId, address recipient)
        external
        override
        onlyController
        returns (uint256 assets)
    {
        address position = positions[accountId];
        if (position == address(0)) return 0;
        return PrizePosition(position).withdrawAll(recipient);
    }

    function sweepPrizes(bytes32 accountId, address recipient)
        external
        override
        onlyController
        returns (uint256 amount)
    {
        address position = positions[accountId];
        if (position == address(0)) return 0;
        amount = PrizePosition(position).sweepPrizes(recipient);
        if (amount > 0) emit PrizesSwept(accountId, recipient, amount);
    }

    // ========== VIEWS ==========

    function investedAssets(bytes32 accountId) external view override returns (uint256) {
        address position = positions[accountId];
        if (position == address(0)) return 0;
        return PrizePosition(position).investedAssets();
    }

    function claimablePrizes(bytes32 accountId) external view override returns (uint256) {
        address position = positions[accountId];
        if (position == address(0)) return 0;
        return PrizePosition(position).claimablePrizes();
    }

    /// @notice Top-tier prize size, for display. Zero when the pool cannot be
    /// read, so a reshaped upstream interface shows nothing rather than a lie.
    function grandPrize() external view override returns (uint256) {
        if (prizePool == address(0)) return 0;
        try IPrizePool(prizePool).getTierPrizeSize(0) returns (uint104 size) {
            return uint256(size);
        } catch {
            return 0;
        }
    }
}
