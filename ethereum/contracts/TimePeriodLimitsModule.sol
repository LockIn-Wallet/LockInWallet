// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./SavingsInterfaces.sol";

contract TimePeriodLimitsModule is ITimePeriodLimitsModule {
    // Core contract that owns this module
    ISavingsCore public immutable savingsCore;

    // Storage for user spending limits
    mapping(address => UserSpendingLimits) private userSpendingLimits;

    modifier onlyAuthorized() {
        require(
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

    constructor(address _savingsCore) {
        require(_savingsCore != address(0), "Invalid core address");
        savingsCore = ISavingsCore(_savingsCore);
    }

    // ========== PERIOD MANAGEMENT ==========

    function addTimePeriodLimit(
        address user,
        string calldata periodName,
        uint256 limit,
        uint256 durationInSeconds
    ) external onlyAuthorized {
        require(bytes(periodName).length > 0 && limit > 0 && durationInSeconds >= 3600, "Invalid input");

        UserSpendingLimits storage userLimits = userSpendingLimits[user];

        // Check if period already exists
        bool periodExists = false;
        uint256 existingIndex = 0;

        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (keccak256(bytes(userLimits.periods[i].name)) == keccak256(bytes(periodName))) {
                periodExists = true;
                existingIndex = i;
                break;
            }
        }

        if (periodExists) {
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

        emit CategorySet(user, periodName, limit, durationInSeconds);
    }

    // Internal version of addTimePeriodLimit without external authorization check
    function _addTimePeriodLimitInternal(
        address user,
        string memory periodName,
        uint256 limit,
        uint256 durationInSeconds
    ) internal {
        require(bytes(periodName).length > 0 && limit > 0 && durationInSeconds >= 3600, "Invalid input");

        UserSpendingLimits storage userLimits = userSpendingLimits[user];

        // Check if period already exists
        bool periodExists = false;
        uint256 existingIndex = 0;

        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (keccak256(bytes(userLimits.periods[i].name)) == keccak256(bytes(periodName))) {
                periodExists = true;
                existingIndex = i;
                break;
            }
        }

        if (periodExists) {
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

        emit CategorySet(user, periodName, limit, durationInSeconds);
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
            bool[] memory active
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

        for (uint256 i = 0; i < length; i++) {
            TimePeriodLimit storage period = userLimits.periods[i];
            names[i] = period.name;
            limits[i] = period.limit;
            durations[i] = period.duration;
            active[i] = period.active;

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

        return (names, limits, spent, remaining, durations, active);
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

    function setCommonPeriodLimits(
        address user,
        uint256 dailyLimit,
        uint256 weeklyLimit,
        uint256 monthlyLimit
    ) external onlyAuthorized {
        require(dailyLimit > 0 || weeklyLimit > 0 || monthlyLimit > 0, "At least one limit must be set");

        // Validate logical limit ordering
        if (dailyLimit > 0 && weeklyLimit > 0) {
            require(dailyLimit * 7 <= weeklyLimit, "Daily limit too high for weekly limit");
        }
        if (weeklyLimit > 0 && monthlyLimit > 0) {
            require(weeklyLimit * 4 <= monthlyLimit, "Weekly limit too high for monthly limit");
        }
        if (dailyLimit > 0 && monthlyLimit > 0) {
            require(dailyLimit * 30 <= monthlyLimit, "Daily limit too high for monthly limit");
        }

        // Add or update common periods - use internal calls to avoid authorization issues
        if (dailyLimit > 0) {
            _addTimePeriodLimitInternal(user, "Daily", dailyLimit, 86400); // 1 day
        }
        if (weeklyLimit > 0) {
            _addTimePeriodLimitInternal(user, "Weekly", weeklyLimit, 604800); // 7 days
        }
        if (monthlyLimit > 0) {
            _addTimePeriodLimitInternal(user, "Monthly", monthlyLimit, 2592000); // 30 days
        }
    }
}