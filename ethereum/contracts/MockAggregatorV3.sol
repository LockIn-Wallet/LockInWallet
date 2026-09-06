// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./locks/AggregatorV3Interface.sol";

/// @title MockAggregatorV3
/// @notice Test-only Chainlink feed with a settable answer, timestamp and
///         decimals, plus a switch to make `latestRoundData` revert so the
///         "dead oracle keeps the lock closed" path can be exercised.
contract MockAggregatorV3 is AggregatorV3Interface {
    uint8 public override decimals;
    int256 public answer;
    uint256 public updatedAt;
    bool public reverting;

    constructor(uint8 _decimals, int256 _answer) {
        decimals = _decimals;
        answer = _answer;
        updatedAt = block.timestamp;
    }

    function setAnswer(int256 _answer) external {
        answer = _answer;
        updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 _updatedAt) external {
        updatedAt = _updatedAt;
    }

    function setDecimals(uint8 _decimals) external {
        decimals = _decimals;
    }

    function setReverting(bool _reverting) external {
        reverting = _reverting;
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        require(!reverting, "Feed down");
        return (1, answer, updatedAt, updatedAt, 1);
    }
}
