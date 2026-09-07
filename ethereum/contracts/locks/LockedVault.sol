// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IUnlockCondition.sol";

/// @title LockedVault
/// @notice A tiny, immutable box that holds one owner's coins until a condition
///         is met or a deadline passes, then hands everything back to that owner.
///
/// Why a separate contract per lock, and not a module: the savings modules are
/// upgradeable behind a timelock, which is the right trade for features but
/// the wrong one for "nobody, including us, can touch this". A lock is worth
/// only as much as the guarantee that governance cannot reach into it, so it
/// gets its own bytecode with no owner functions, no admin, no upgrade path.
///
/// The deadline is the safety valve: however the condition behaves — reverts,
/// dead oracle, a combinator that can never be satisfied — the owner gets the
/// money back on that date. `release` is permissionless because there is
/// nothing to gain from calling it: funds only ever move to `owner`.
contract LockedVault {
    using SafeERC20 for IERC20;

    address public immutable owner;
    IUnlockCondition public immutable condition;
    uint64 public immutable deadline;
    address public immutable factory;

    event Released(address indexed token, uint256 amount);

    constructor(address _owner, address _condition, uint64 _deadline) {
        require(_owner != address(0), "Invalid owner");
        owner = _owner;
        condition = IUnlockCondition(_condition);
        deadline = _deadline;
        factory = msg.sender;
    }

    /// @dev Plain transfers work too; this is only so a UI can deposit in one
    ///      approve-then-call flow instead of asking the user to "send here".
    receive() external payable {}

    function deposit(address token, uint256 amount) external {
        require(amount > 0, "Nothing to deposit");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice True once the deadline has passed, or earlier if the condition
    ///         says so. A reverting condition counts as "not met" so it can
    ///         delay a release but never block the deadline.
    function isUnlocked() public view returns (bool) {
        if (block.timestamp >= deadline) return true;
        if (address(condition) == address(0)) return false;
        try condition.isMet() returns (bool met) {
            return met;
        } catch {
            return false;
        }
    }

    function balanceOf(address token) public view returns (uint256) {
        return token == address(0) ? address(this).balance : IERC20(token).balanceOf(address(this));
    }

    /// @notice Sends the vault's whole balance of `token` to the owner.
    ///         `address(0)` is the native coin.
    function release(address token) external {
        require(isUnlocked(), "Still locked");
        uint256 amount = balanceOf(token);
        require(amount > 0, "Nothing to release");

        if (token == address(0)) {
            (bool ok, ) = owner.call{value: amount}("");
            require(ok, "Native transfer failed");
        } else {
            IERC20(token).safeTransfer(owner, amount);
        }
        emit Released(token, amount);
    }
}
