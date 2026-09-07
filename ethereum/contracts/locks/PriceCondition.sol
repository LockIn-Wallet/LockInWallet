// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IUnlockCondition.sol";
import "./AggregatorV3Interface.sol";

/// @title PriceCondition
/// @notice Met while a Chainlink feed reports a price on the chosen side of a
///         threshold ("unlock when ETH is above $5,000" or "below $1,000").
///
/// A feed that is silent or nonsensical keeps the lock closed rather than
/// opening it: `answer <= 0` and a stale `updatedAt` both return false. The
/// vault's own deadline is the safety valve for a feed that dies for good.
///
/// A feed that *reverts* is deliberately left to bubble — the vault wraps the
/// call in try/catch and treats a revert as "not met", so no revert path here
/// can ever brick a lock, and not swallowing it keeps this contract tiny.
contract PriceCondition is IUnlockCondition {
    AggregatorV3Interface public immutable feed;
    /// @dev In the feed's own decimals; the factory exposes those for the UI.
    int256 public immutable threshold;
    bool public immutable above;
    uint256 public immutable maxStaleness;

    constructor(address _feed, int256 _threshold, bool _above, uint256 _maxStaleness) {
        require(_feed != address(0), "Invalid feed");
        require(_maxStaleness > 0, "Invalid staleness");
        feed = AggregatorV3Interface(_feed);
        threshold = _threshold;
        above = _above;
        maxStaleness = _maxStaleness;
    }

    function isMet() external view override returns (bool) {
        (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
        if (answer <= 0) return false;
        if (updatedAt > block.timestamp || block.timestamp - updatedAt > maxStaleness) return false;
        return above ? answer >= threshold : answer <= threshold;
    }
}
