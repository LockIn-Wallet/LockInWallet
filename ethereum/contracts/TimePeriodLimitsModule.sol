// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./SavingsInterfaces.sol";

contract TimePeriodLimitsModule is Initializable, UUPSUpgradeable, OwnableUpgradeable, ITimePeriodLimitsModule {
    ISavingsCore public savingsCore;

    // Storage for user spending limits
    mapping(address => UserSpendingLimits) private userSpendingLimits;

    // Migration flag
    bool public migrationComplete;

    // Appended for upgrades — lets addTimePeriodLimit refresh the committed
    // total locked value without routing through the core
    IProposalSystemModule public proposalSystemModule;

    // Appended for upgrades — per-period unlock delay (seconds a bypass request
    // or limit-change proposal for that period must wait). Kept in its own
    // mapping rather than on TimePeriodLimit because that struct lives in a
    // dynamic array, where appending a field would shift every later element.
    // Keyed by keccak256(periodName); 0 means "never set", which reads back as
    // DEFAULT_UNLOCK_DELAY so periods created before this upgrade keep the
    // 24-hour wait they were committed under.
    mapping(address => mapping(bytes32 => uint256)) private periodUnlockDelays;

    /// @notice Wait applied to periods with no explicit delay (legacy data).
    uint256 public constant DEFAULT_UNLOCK_DELAY = 24 hours;
    /// @notice A delay shorter than this would make the lock meaningless.
    uint256 public constant MIN_UNLOCK_DELAY = 1 hours;
    /// @notice Ceiling on any wait. Bounds how long a mistake — or a hostile
    ///         setting — can keep someone out of their own funds. Accounts
    ///         with no recovery key have no faster way back, so this is the
    ///         real worst case for them.
    uint256 public constant MAX_UNLOCK_DELAY = 90 days;
    /// @notice Shortest period a limit may cover.
    uint256 public constant MIN_PERIOD_DURATION = 1 hours;

    modifier onlyAuthorized() {
        require(
            msg.sender == address(savingsCore) ||
            savingsCore.isAuthorizedModule(msg.sender),
            "Not authorized"
        );
        _;
    }

    // Users act on their own data directly; the core and modules keep access
    // for cross-module orchestration (Pattern B self-authentication)
    modifier onlyAuthorizedOrSelf(address user) {
        require(
            msg.sender == user ||
            msg.sender == address(savingsCore) ||
            savingsCore.isAuthorizedModule(msg.sender),
            "Not authorized"
        );
        _;
    }

    modifier onlyCore() {
        require(msg.sender == address(savingsCore), "Only core contract");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _savingsCore) public initializer {
        require(_savingsCore != address(0), "Invalid core address");
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        savingsCore = ISavingsCore(_savingsCore);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setProposalSystemModule(address _proposalSystemModule) external onlyCore {
        require(_proposalSystemModule != address(0), "Invalid module address");
        proposalSystemModule = IProposalSystemModule(_proposalSystemModule);
    }

    /// @dev After lock-in, existing limits may only change through the
    ///      timelocked proposal flow — never instantly.
    function _isCommitted(address user) internal view returns (bool) {
        return
            address(proposalSystemModule) != address(0) &&
            proposalSystemModule.isSetupCommitted(user);
    }

    // ========== PERIOD MANAGEMENT ==========

    function addTimePeriodLimit(
        address user,
        string calldata periodName,
        uint256 limit,
        uint256 durationInSeconds
    ) external onlyAuthorizedOrSelf(user) {
        // No delay supplied — keep whatever the period already carries, or fall
        // back to the 24-hour default for a brand new one
        _setPeriod(user, periodName, limit, durationInSeconds, getUnlockDelay(user, periodName), true);
        _syncTotalLockedValue(user);
    }

    /// @notice Add or retune a period, choosing how long its bypasses and
    ///         limit-change proposals must wait.
    function setPeriodLimit(
        address user,
        string calldata periodName,
        uint256 limit,
        uint256 durationInSeconds,
        uint256 unlockDelay
    ) external onlyAuthorizedOrSelf(user) {
        _setPeriod(user, periodName, limit, durationInSeconds, unlockDelay, true);
        _syncTotalLockedValue(user);
    }

    /// @dev Single implementation behind every path that writes a period, so
    ///      the create/update/commit flows can never drift apart.
    /// @param guardCommitted When true, overwriting an existing period after
    ///        lock-in is rejected — that would sidestep the proposal timelock.
    ///        New (tightening) periods stay allowed either way.
    function _setPeriod(
        address user,
        string memory periodName,
        uint256 limit,
        uint256 durationInSeconds,
        uint256 unlockDelay,
        bool guardCommitted
    ) internal {
        require(bytes(periodName).length > 0 && limit > 0 && durationInSeconds >= MIN_PERIOD_DURATION, "Invalid input");

        UserSpendingLimits storage userLimits = userSpendingLimits[user];
        uint256 existingIndex = _findPeriodIndex(user, periodName);
        bool periodExists = existingIndex < userLimits.periods.length;

        // A period added after lock-in always starts at the default wait.
        // Adding one is instant because it only tightens the wallet — but if
        // the caller could also pick the wait, anyone holding the key could
        // add a dust-sized hourly limit with a long wait and freeze the wallet
        // for that long. Overridden before validation, so a hostile value is
        // ignored rather than reverting. Lengthening it afterwards goes
        // through the timelock like every other change.
        if (!periodExists && guardCommitted && _isCommitted(user)) {
            unlockDelay = DEFAULT_UNLOCK_DELAY;
        }
        _validateUnlockDelay(unlockDelay);

        if (periodExists) {
            if (guardCommitted) {
                require(!_isCommitted(user), "Setup committed - use proposals");
            }
            // Update existing period
            TimePeriodLimit storage existing = userLimits.periods[existingIndex];
            existing.limit = limit;
            existing.duration = durationInSeconds;
            existing.active = true;
        } else {
            // Add new period
            userLimits.periods.push(TimePeriodLimit({
                limit: limit,
                spent: 0,
                lastReset: block.timestamp,
                duration: durationInSeconds,
                name: periodName,
                active: true
            }));

            // Update index mapping (store actual index)
            userLimits.periodIndexes[periodName] = userLimits.periods.length - 1;
            userLimits.periodCount++;
        }

        periodUnlockDelays[user][keccak256(bytes(periodName))] = unlockDelay;

        emit CategorySet(user, periodName, limit, durationInSeconds);
        emit UnlockDelaySet(user, periodName, unlockDelay);
    }

    /// @dev Keep the committed total locked value in sync (moved here from the
    ///      former SavingsCore.addTimePeriodLimit forwarder).
    function _syncTotalLockedValue(address user) internal {
        if (
            address(proposalSystemModule) != address(0) &&
            proposalSystemModule.isSetupCommitted(user)
        ) {
            proposalSystemModule.recalculateTotalLockedValue(user);
        }
    }

    // ========== UNLOCK DELAYS ==========

    /// @notice How long a bypass request or limit-change proposal for this
    ///         period must wait before it can be executed.
    function getUnlockDelay(address user, string memory periodName) public view returns (uint256) {
        uint256 stored = periodUnlockDelays[user][keccak256(bytes(periodName))];
        return stored == 0 ? DEFAULT_UNLOCK_DELAY : stored;
    }

    /// @notice Set a period's unlock delay. Reached through the proposal
    ///         module after its timelock, never instantly by the user — any
    ///         change to the wait has to serve out the current wait first.
    function setUnlockDelay(
        address user,
        string calldata periodName,
        uint256 unlockDelay
    ) external onlyAuthorized {
        _validateUnlockDelay(unlockDelay);
        require(_findPeriodIndex(user, periodName) < userSpendingLimits[user].periods.length, "Period not found");
        periodUnlockDelays[user][keccak256(bytes(periodName))] = unlockDelay;
        emit UnlockDelaySet(user, periodName, unlockDelay);
    }

    /// @notice Reverts unless the delay is within the accepted bounds. Exposed
    ///         so the proposal module validates against the same rule.
    function validateUnlockDelay(uint256 unlockDelay) external pure {
        _validateUnlockDelay(unlockDelay);
    }

    function _validateUnlockDelay(uint256 unlockDelay) internal pure {
        require(
            unlockDelay >= MIN_UNLOCK_DELAY && unlockDelay <= MAX_UNLOCK_DELAY,
            "Invalid unlock delay"
        );
    }

    /// @dev Index of `periodName`, or periods.length when absent.
    function _findPeriodIndex(address user, string memory periodName) internal view returns (uint256) {
        UserSpendingLimits storage userLimits = userSpendingLimits[user];
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (keccak256(bytes(userLimits.periods[i].name)) == keccak256(bytes(periodName))) {
                return i;
            }
        }
        return userLimits.periods.length;
    }

    function removeTimePeriodLimit(address user, string calldata periodName) external onlyAuthorized {
        require(bytes(periodName).length > 0, "Period name cannot be empty");

        UserSpendingLimits storage userLimits = userSpendingLimits[user];
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (keccak256(bytes(userLimits.periods[i].name)) == keccak256(bytes(periodName))) {
                userLimits.periods[i].active = false;
                userLimits.periodCount--;
                emit CategoryDeleted(user, periodName);
                return;
            }
        }
        revert("Period not found");
    }

    function updateTimePeriodLimit(address user, string calldata periodName, uint256 newLimit) external onlyAuthorized {
        UserSpendingLimits storage userLimits = userSpendingLimits[user];
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (keccak256(bytes(userLimits.periods[i].name)) == keccak256(bytes(periodName))) {
                userLimits.periods[i].limit = newLimit;
                return;
            }
        }
        revert("Period not found");
    }

    // ========== LIMIT CHECKING AND SPENDING ==========

    function checkAllTimePeriodLimits(address user, uint256 amount) external onlyAuthorized {
        UserSpendingLimits storage userLimits = userSpendingLimits[user];

        // Check and update each active time period
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            TimePeriodLimit storage period = userLimits.periods[i];

            if (!period.active) continue;

            // Reset period if duration has passed
            if (block.timestamp >= period.lastReset + period.duration) {
                period.lastReset = block.timestamp;
                period.spent = 0;
            }

            // Check if this withdrawal would exceed the period limit
            require(period.spent + amount <= period.limit, "Exceeds limit");
        }

        // If all checks pass, deduct from all active periods
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            TimePeriodLimit storage period = userLimits.periods[i];
            if (period.active) {
                period.spent += amount;
            }
        }
    }

    function checkLimitsWithBypass(
        address user,
        uint256 amount,
        string calldata skipPeriod
    ) external view onlyAuthorized {
        UserSpendingLimits storage userLimits = userSpendingLimits[user];

        // Check each active time period except the skipped one
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            TimePeriodLimit storage period = userLimits.periods[i];

            if (!period.active) continue;

            // Skip the bypassed period
            if (keccak256(bytes(period.name)) == keccak256(bytes(skipPeriod))) continue;

            // Calculate current spent (reset if duration has passed)
            uint256 currentSpent = period.spent;
            if (block.timestamp >= period.lastReset + period.duration) {
                currentSpent = 0; // Would be reset
            }

            // Check if this withdrawal would exceed the period limit
            require(currentSpent + amount <= period.limit, "Exceeds limit");
        }
    }

    function updateSpendingWithBypass(
        address user,
        uint256 amount,
        string calldata skipPeriod
    ) external onlyAuthorized {
        UserSpendingLimits storage userLimits = userSpendingLimits[user];

        // Update spending for all active periods except the skipped one
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            TimePeriodLimit storage period = userLimits.periods[i];

            if (!period.active) continue;

            // Skip the bypassed period
            if (keccak256(bytes(period.name)) == keccak256(bytes(skipPeriod))) continue;

            // Reset period if duration has passed
            if (block.timestamp >= period.lastReset + period.duration) {
                period.lastReset = block.timestamp;
                period.spent = 0;
            }

            period.spent += amount;
        }
    }

    // ========== VIEW FUNCTIONS ==========

    function getUserSpendingLimits(address user)
        external
        view
        returns (
            string[] memory names,
            uint256[] memory limits,
            uint256[] memory spent,
            uint256[] memory remaining,
            uint256[] memory durations,
            bool[] memory active,
            uint256[] memory unlockDelays
        )
    {
        UserSpendingLimits storage userLimits = userSpendingLimits[user];
        uint256 length = userLimits.periods.length;

        names = new string[](length);
        limits = new uint256[](length);
        spent = new uint256[](length);
        remaining = new uint256[](length);
        durations = new uint256[](length);
        active = new bool[](length);
        unlockDelays = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            TimePeriodLimit storage period = userLimits.periods[i];
            names[i] = period.name;
            limits[i] = period.limit;
            durations[i] = period.duration;
            active[i] = period.active;
            unlockDelays[i] = getUnlockDelay(user, period.name);

            // Calculate current spent (reset if period expired)
            if (block.timestamp >= period.lastReset + period.duration) {
                spent[i] = 0; // Would be reset
            } else {
                spent[i] = period.spent;
            }

            // Calculate remaining
            if (period.limit > spent[i]) {
                remaining[i] = period.limit - spent[i];
            } else {
                remaining[i] = 0;
            }
        }

        return (names, limits, spent, remaining, durations, active, unlockDelays);
    }

    function getTimePeriodLimit(
        address user,
        string calldata periodName
    )
        external
        view
        returns (
            uint256 limit,
            uint256 spent,
            uint256 remaining,
            uint256 duration,
            uint256 lastReset,
            bool active,
            bool exists
        )
    {
        UserSpendingLimits storage userLimits = userSpendingLimits[user];

        // Find the period
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            TimePeriodLimit storage period = userLimits.periods[i];
            if (keccak256(bytes(period.name)) == keccak256(bytes(periodName))) {
                limit = period.limit;
                duration = period.duration;
                lastReset = period.lastReset;
                active = period.active;
                exists = true;

                // Calculate current spent (reset if period expired)
                if (block.timestamp >= period.lastReset + period.duration) {
                    spent = 0; // Would be reset
                } else {
                    spent = period.spent;
                }

                // Calculate remaining
                if (limit > spent) {
                    remaining = limit - spent;
                } else {
                    remaining = 0;
                }

                return (limit, spent, remaining, duration, lastReset, active, exists);
            }
        }

        return (0, 0, 0, 0, 0, false, false);
    }

    function findPeriodLimit(address user, string calldata periodName) external view returns (uint256) {
        UserSpendingLimits storage userLimits = userSpendingLimits[user];
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (keccak256(bytes(userLimits.periods[i].name)) == keccak256(bytes(periodName)) &&
                userLimits.periods[i].active) {
                return userLimits.periods[i].limit;
            }
        }
        return 0;
    }

    function getActivePeriodNames(address user) external view returns (string[] memory) {
        UserSpendingLimits storage userLimits = userSpendingLimits[user];

        // Count active periods
        uint256 activeCount = 0;
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (userLimits.periods[i].active) {
                activeCount++;
            }
        }

        // Create array of active period names
        string[] memory activeNames = new string[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (userLimits.periods[i].active) {
                activeNames[index] = userLimits.periods[i].name;
                index++;
            }
        }

        return activeNames;
    }

    function getActivePeriodCount(address user) external view returns (uint256) {
        return userSpendingLimits[user].periodCount;
    }

    // ========== HELPER FUNCTIONS FOR COMMON OPERATIONS ==========

    /// @notice Daily/Weekly/Monthly convenience wrapper, kept so existing
    ///         callers keep working. Each period takes its default wait.
    function setCommonPeriodLimits(
        address user,
        uint256 dailyLimit,
        uint256 weeklyLimit,
        uint256 monthlyLimit
    ) external onlyAuthorizedOrSelf(user) {
        uint256 count = (dailyLimit > 0 ? 1 : 0) + (weeklyLimit > 0 ? 1 : 0) + (monthlyLimit > 0 ? 1 : 0);
        require(count > 0, "At least one limit must be set");

        string[] memory names = new string[](count);
        uint256[] memory limits = new uint256[](count);
        uint256[] memory durations = new uint256[](count);
        uint256[] memory unlockDelays = new uint256[](count);

        uint256 next = 0;
        if (dailyLimit > 0) {
            (names[next], limits[next], durations[next], unlockDelays[next]) = ("Daily", dailyLimit, 1 days, 24 hours);
            next++;
        }
        if (weeklyLimit > 0) {
            (names[next], limits[next], durations[next], unlockDelays[next]) = ("Weekly", weeklyLimit, 7 days, 7 days);
            next++;
        }
        if (monthlyLimit > 0) {
            (names[next], limits[next], durations[next], unlockDelays[next]) = ("Monthly", monthlyLimit, 30 days, 30 days);
        }

        _setPeriodLimits(user, names, limits, durations, unlockDelays);
    }

    /// @notice Set an arbitrary set of periods in one call — the path used by
    ///         setup, so hourly through yearly limits all arrive together with
    ///         their own wait times. Adding a period (quarterly, a salary
    ///         cycle) needs no contract change.
    function setPeriodLimits(
        address user,
        string[] calldata names,
        uint256[] calldata limits,
        uint256[] calldata durations,
        uint256[] calldata unlockDelays
    ) external onlyAuthorizedOrSelf(user) {
        _setPeriodLimits(user, names, limits, durations, unlockDelays);
    }

    function _setPeriodLimits(
        address user,
        string[] memory names,
        uint256[] memory limits,
        uint256[] memory durations,
        uint256[] memory unlockDelays
    ) internal {
        require(!_isCommitted(user), "Setup committed - use proposals");
        require(names.length > 0, "At least one limit must be set");
        require(
            names.length == limits.length &&
            names.length == durations.length &&
            names.length == unlockDelays.length,
            "Length mismatch"
        );

        // A shorter window may never allow more spending than a longer one,
        // whatever periods the caller picked
        for (uint256 i = 0; i < names.length; i++) {
            for (uint256 j = 0; j < names.length; j++) {
                if (durations[i] < durations[j]) {
                    require(limits[i] <= limits[j], "Shorter period exceeds longer period");
                }
            }
        }

        for (uint256 i = 0; i < names.length; i++) {
            // Committed setups were rejected above, so the overwrite guard has
            // nothing left to catch here
            _setPeriod(user, names[i], limits[i], durations[i], unlockDelays[i], false);
        }
    }

    // ========== MIGRATION FUNCTIONS ==========

    function migrateUserLimit(
        address user,
        string calldata periodName,
        uint256 limit,
        uint256 spentAmount,
        uint256 lastReset,
        uint256 duration,
        bool activeFlag
    ) external onlyOwner {
        require(!migrationComplete, "Migration already complete");

        UserSpendingLimits storage userLimits = userSpendingLimits[user];
        userLimits.periods.push(TimePeriodLimit({
            limit: limit,
            spent: spentAmount,
            lastReset: lastReset,
            duration: duration,
            name: periodName,
            active: activeFlag
        }));
        userLimits.periodIndexes[periodName] = userLimits.periods.length - 1;
        if (activeFlag) {
            userLimits.periodCount++;
        }
    }

    function lockMigration() external onlyOwner {
        migrationComplete = true;
    }
}
