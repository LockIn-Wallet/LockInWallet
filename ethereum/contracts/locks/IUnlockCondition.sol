// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IUnlockCondition
/// @notice The one question a LockedVault asks: may the money leave yet?
///
/// Conditions are pure oracles of "is it time" — they never hold funds and never
/// know which vault is asking, so a broken or malicious condition can at worst
/// keep a lock closed until its deadline, never redirect anything.
interface IUnlockCondition {
    function isMet() external view returns (bool);
}
