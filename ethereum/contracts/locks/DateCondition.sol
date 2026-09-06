// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IUnlockCondition.sol";

/// @title DateCondition
/// @notice Met once the chain's clock passes a fixed timestamp.
///
/// Everything is immutable: a date lock that could be moved is not a lock.
contract DateCondition is IUnlockCondition {
    uint64 public immutable unlockAt;

    constructor(uint64 _unlockAt) {
        unlockAt = _unlockAt;
    }

    function isMet() external view override returns (bool) {
        return block.timestamp >= unlockAt;
    }
}
