// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CompositeCondition.sol";

/// @title AnyOfCondition
/// @notice Met as soon as at least one member condition is met (logical OR).
contract AnyOfCondition is CompositeCondition {
    constructor(IUnlockCondition[] memory members_) CompositeCondition(members_) {}

    function isMet() external view override returns (bool) {
        for (uint256 i = 0; i < _members.length; i++) {
            if (_members[i].isMet()) return true;
        }
        return false;
    }
}
