// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Create2.sol";
import "./IUnlockCondition.sol";
import "./DateCondition.sol";
import "./PriceCondition.sol";
import "./AllOfCondition.sol";
import "./AnyOfCondition.sol";
import "./LockedVault.sol";

/// @title LockedVaultFactory
/// @notice Deploys LockedVaults at predictable addresses and is the registry
///         of conditions the factory itself built.
///
/// The registry is the whole point: a lock may only reference a condition this
/// factory deployed, so a user (or a UI on their behalf) can never be talked
/// into locking behind an arbitrary contract with a hidden `isMet`. Every
/// condition's parameters are readable back through `describeCondition`, so
/// the frontend needs exactly two ABIs — this one and LockedVault's.
///
/// There is no owner. The factory holds nothing and can change nothing after
/// deployment; a new version is simply a new factory.
contract LockedVaultFactory {
    /// @dev Ten years. Long enough for any savings goal, short enough that a
    ///      fat-fingered year cannot lock money for a lifetime.
    uint256 public constant MAX_LOCK_HORIZON = 3650 days;

    enum ConditionKind {
        None,
        Date,
        Price,
        AllOf,
        AnyOf
    }

    mapping(address => ConditionKind) public conditionKind;
    mapping(address => bool) public isLock;
    mapping(address => address) public lockOwner;
    mapping(address => address[]) private _locksOf;

    event ConditionCreated(ConditionKind kind, address condition, address creator);
    event LockCreated(
        address indexed owner, address indexed lock, address condition, uint64 deadline, bytes32 salt
    );

    // ---------------------------------------------------------------------
    // Conditions
    // ---------------------------------------------------------------------

    function createDateCondition(uint64 unlockAt) external returns (address condition) {
        condition = address(new DateCondition(unlockAt));
        _register(ConditionKind.Date, condition);
    }

    function createPriceCondition(address feed, int256 threshold, bool above, uint256 maxStaleness)
        external
        returns (address condition)
    {
        condition = address(new PriceCondition(feed, threshold, above, maxStaleness));
        _register(ConditionKind.Price, condition);
    }

    function createAllOf(address[] calldata members) external returns (address condition) {
        condition = address(new AllOfCondition(_knownMembers(members)));
        _register(ConditionKind.AllOf, condition);
    }

    function createAnyOf(address[] calldata members) external returns (address condition) {
        condition = address(new AnyOfCondition(_knownMembers(members)));
        _register(ConditionKind.AnyOf, condition);
    }

    // ---------------------------------------------------------------------
    // Locks
    // ---------------------------------------------------------------------

    /// @param condition A condition from this factory, or address(0) for a
    ///        pure date lock that opens at `deadline`.
    /// @param salt Caller-chosen; namespaced by msg.sender so two users can
    ///        pick the same salt without colliding.
    function createLock(address condition, uint64 deadline, bytes32 salt) external returns (address lock) {
        require(deadline > block.timestamp, "Deadline in the past");
        require(deadline <= block.timestamp + MAX_LOCK_HORIZON, "Deadline beyond horizon");
        require(condition == address(0) || conditionKind[condition] != ConditionKind.None, "Unknown condition");

        lock = address(new LockedVault{salt: _salt(msg.sender, salt)}(msg.sender, condition, deadline));

        isLock[lock] = true;
        lockOwner[lock] = msg.sender;
        _locksOf[msg.sender].push(lock);
        emit LockCreated(msg.sender, lock, condition, deadline, salt);
    }

    function predictLock(address owner, address condition, uint64 deadline, bytes32 salt)
        external
        view
        returns (address)
    {
        bytes32 initCodeHash =
            keccak256(abi.encodePacked(type(LockedVault).creationCode, abi.encode(owner, condition, deadline)));
        return Create2.computeAddress(_salt(owner, salt), initCodeHash);
    }

    // ---------------------------------------------------------------------
    // Views for the UI
    // ---------------------------------------------------------------------

    function getLocks(address owner) external view returns (address[] memory) {
        return _locksOf[owner];
    }

    function describeLock(address lock)
        external
        view
        returns (address owner, address condition, uint64 deadline, bool unlocked)
    {
        require(isLock[lock], "Unknown lock");
        LockedVault vault = LockedVault(payable(lock));
        return (vault.owner(), address(vault.condition()), vault.deadline(), vault.isUnlocked());
    }

    /// @notice Every parameter of a known condition, so the frontend never
    ///         needs a per-condition ABI. Only the fields for `kind` are set.
    function describeCondition(address c)
        external
        view
        returns (
            ConditionKind kind,
            uint64 unlockAt,
            address feed,
            int256 threshold,
            bool above,
            uint256 maxStaleness,
            address[] memory members
        )
    {
        kind = conditionKind[c];
        if (kind == ConditionKind.Date) {
            unlockAt = DateCondition(c).unlockAt();
        } else if (kind == ConditionKind.Price) {
            PriceCondition p = PriceCondition(c);
            (feed, threshold, above, maxStaleness) = (address(p.feed()), p.threshold(), p.above(), p.maxStaleness());
        } else if (kind == ConditionKind.AllOf || kind == ConditionKind.AnyOf) {
            IUnlockCondition[] memory raw = CompositeCondition(c).members();
            members = new address[](raw.length);
            for (uint256 i = 0; i < raw.length; i++) {
                members[i] = address(raw[i]);
            }
        }
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _register(ConditionKind kind, address condition) private {
        conditionKind[condition] = kind;
        emit ConditionCreated(kind, condition, msg.sender);
    }

    /// @dev Combinators may only wrap conditions this factory built; otherwise
    ///      the registry guarantee would leak through nesting.
    function _knownMembers(address[] calldata members) private view returns (IUnlockCondition[] memory out) {
        out = new IUnlockCondition[](members.length);
        for (uint256 i = 0; i < members.length; i++) {
            require(conditionKind[members[i]] != ConditionKind.None, "Unknown member");
            out[i] = IUnlockCondition(members[i]);
        }
    }

    function _salt(address owner, bytes32 salt) private pure returns (bytes32) {
        return keccak256(abi.encode(owner, salt));
    }
}
