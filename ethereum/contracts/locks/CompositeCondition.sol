// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IUnlockCondition.sol";

/// @title CompositeCondition
/// @notice Shared storage and bounds for the AllOf / AnyOf combinators, so the
///         two differ only in the fold they apply.
///
/// The member cap keeps `isMet()` bounded in gas: a vault must never become
/// unreleasable because its condition grew too expensive to evaluate.
abstract contract CompositeCondition is IUnlockCondition {
    uint256 public constant MAX_MEMBERS = 8;

    IUnlockCondition[] internal _members;

    constructor(IUnlockCondition[] memory members_) {
        require(members_.length > 0 && members_.length <= MAX_MEMBERS, "Bad member count");
        for (uint256 i = 0; i < members_.length; i++) {
            require(address(members_[i]) != address(0), "Zero member");
            _members.push(members_[i]);
        }
    }

    function members() external view returns (IUnlockCondition[] memory) {
        return _members;
    }
}
