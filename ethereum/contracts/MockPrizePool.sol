// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Mock PrizePool for localhost testing of PoolTogether integration.
/// Simulates prize distribution by transferring tokens from a funded prize reserve.
contract MockPrizePool {
    uint104 public grandPrizeSize;
    uint8 public tierCount;
    IERC20 public prizeToken;

    constructor(uint104 _grandPrizeSize, uint8 _tierCount, address _prizeToken) {
        grandPrizeSize = _grandPrizeSize;
        tierCount = _tierCount;
        prizeToken = IERC20(_prizeToken);
    }

    function getTierPrizeSize(uint8 tier) external view returns (uint104) {
        if (tier == 0) return grandPrizeSize;
        if (tier >= tierCount) return 0;
        return grandPrizeSize / uint104(2 ** tier);
    }

    function numberOfTiers() external view returns (uint8) {
        return tierCount;
    }

    /// @notice Simulate a prize claim — transfers prize tokens to the caller.
    /// Must be funded with prize tokens first (via deploy script).
    function claimPrize(address winner, uint8 tier) external returns (uint256 prizeAmount) {
        require(tier < tierCount, "Invalid tier");
        prizeAmount = this.getTierPrizeSize(tier);
        require(prizeAmount > 0, "No prize for tier");
        uint256 available = prizeToken.balanceOf(address(this));
        require(available >= prizeAmount, "Prize pool underfunded");
        prizeToken.transfer(msg.sender, prizeAmount);
        emit PrizeClaimed(winner, tier, prizeAmount);
    }

    function setGrandPrize(uint104 _size) external {
        grandPrizeSize = _size;
    }

    function setTierCount(uint8 _count) external {
        tierCount = _count;
    }

    event PrizeClaimed(address indexed winner, uint8 tier, uint256 amount);
}
