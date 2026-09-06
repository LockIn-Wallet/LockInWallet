// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title AggregatorV3Interface
/// @notice The two Chainlink price-feed calls a PriceCondition needs. Declared
///         here rather than pulled from the Chainlink package so the locks tree
///         stays dependency-free and auditable in one sitting.
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
