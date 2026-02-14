// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./SavingsInterfaces.sol";

contract ProposalSystemModule is IProposalSystemModule {
    // Core contract that owns this module
    ISavingsCore public immutable savingsCore;

    // Time Period Limits Module for limit checking
    ITimePeriodLimitsModule public timePeriodLimitsModule;

    // Storage for user setup data and proposals
    mapping(address => UserSetupData) private userSetupData;
    mapping(address => mapping(bytes32 => CategoryUpdateProposal)) private userProposals;

    // Track proposal IDs per user for enumeration
    mapping(address => bytes32[]) private userProposalIds;

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

    function setTimePeriodLimitsModule(address _timePeriodLimitsModule) external onlyCore {
        require(_timePeriodLimitsModule != address(0), "Invalid module address");
        timePeriodLimitsModule = ITimePeriodLimitsModule(_timePeriodLimitsModule);
    }

    // ========== PROPOSAL MANAGEMENT ==========

    function proposeLimitChange(
        address user,
        string calldata periodName,
        uint256 newLimit
    ) external onlyAuthorized returns (bytes32 proposalId) {
        require(bytes(periodName).length > 0 && newLimit > 0, "Invalid input");

        UserSetupData storage userData = userSetupData[user];
        require(userData.hasCommittedSetup, "Setup must be committed for proposals");

        uint256 currentLimit = timePeriodLimitsModule.findPeriodLimit(user, periodName);
        require(currentLimit > 0, "Period not found or inactive");

        bool isIncrease = newLimit > currentLimit;
        if (isIncrease) {
            _checkIncreaseLimit(user, userData, newLimit - currentLimit);
        }

        proposalId = keccak256(abi.encodePacked(user, periodName, newLimit, block.timestamp));
        require(!userProposals[user][proposalId].exists, "Proposal already exists");

        userProposals[user][proposalId] = CategoryUpdateProposal({
            category: periodName,
            newLimit: newLimit,
            executeAfter: block.timestamp + (savingsCore.getDevelopmentMode() ? 30 : 24 hours),
            executed: false,
            isIncrease: isIncrease,
            exists: true
        });

        // Add to proposal tracking
        userProposalIds[user].push(proposalId);

        emit CategoryIncreaseProposed(user, periodName, newLimit, userProposals[user][proposalId].executeAfter, proposalId);
        return proposalId;
    }

    function proposeLimitRemoval(address user, string calldata periodName) external onlyAuthorized returns (bytes32 proposalId) {
        require(bytes(periodName).length > 0, "Period name cannot be empty");

        UserSetupData storage userData = userSetupData[user];
        require(userData.hasCommittedSetup, "Setup must be committed for proposals");
        require(timePeriodLimitsModule.findPeriodLimit(user, periodName) > 0, "Period not found or inactive");

        proposalId = keccak256(abi.encodePacked(user, periodName, uint256(0), block.timestamp, "REMOVE"));
        require(!userProposals[user][proposalId].exists, "Proposal already exists");

        userProposals[user][proposalId] = CategoryUpdateProposal({
            category: periodName,
            newLimit: 0,
            executeAfter: block.timestamp,
            executed: false,
            isIncrease: false,
            exists: true
        });

        // Add to proposal tracking
        userProposalIds[user].push(proposalId);

        emit CategoryIncreaseProposed(user, periodName, 0, block.timestamp, proposalId);
        return proposalId;
    }

    function executeLimitProposal(address user, bytes32 proposalId) external onlyAuthorized {
        UserSetupData storage userData = userSetupData[user];
        CategoryUpdateProposal storage proposal = userProposals[user][proposalId];

        require(proposal.exists && !proposal.executed, "Invalid proposal");
        require(block.timestamp >= proposal.executeAfter, "Still in timelock");

        proposal.executed = true;

        if (proposal.newLimit == 0) {
            timePeriodLimitsModule.removeTimePeriodLimit(user, proposal.category);
            emit CategoryDeleted(user, proposal.category);
        } else {
            if (proposal.isIncrease) {
                uint256 currentLimit = timePeriodLimitsModule.findPeriodLimit(user, proposal.category);
                _updateIncreaseTracking(userData, proposal.newLimit - currentLimit);
            }
            timePeriodLimitsModule.updateTimePeriodLimit(user, proposal.category, proposal.newLimit);
            emit CategoryIncreaseExecuted(user, proposal.category, proposal.newLimit, proposalId);
        }
    }

    function cancelLimitProposal(address user, bytes32 proposalId) external onlyAuthorized {
        require(userProposals[user][proposalId].exists && !userProposals[user][proposalId].executed, "Invalid proposal");
        delete userProposals[user][proposalId];
        // Reusing BypassCancelled event for now - could create specific event
    }

    // ========== SETUP MANAGEMENT ==========

    function commitInitialSetup(address user) external onlyAuthorized {
        UserSetupData storage userData = userSetupData[user];
        require(!userData.hasCommittedSetup, "Already committed");
        require(address(timePeriodLimitsModule) != address(0), "TimePeriodLimitsModule not set");

        // Calculate maximum spending limit across all time periods
        (,uint256[] memory limits,,,,bool[] memory active) = timePeriodLimitsModule.getUserSpendingLimits(user);

        uint256 totalValue = 0;
        for (uint256 i = 0; i < limits.length; i++) {
            if (active[i] && limits[i] > totalValue) {
                totalValue = limits[i];
            }
        }

        userData.hasCommittedSetup = true;
        userData.totalLockedValue = totalValue;
        userData.commitTimestamp = block.timestamp;
        userData.lastIncreaseTimestamp = block.timestamp;
        userData.increasesInPeriod = 0;

        emit SetupCommitted(user, block.timestamp);
    }

    function recalculateTotalLockedValue(address user) external onlyAuthorized {
        UserSetupData storage userData = userSetupData[user];
        require(userData.hasCommittedSetup, "Setup not committed yet");

        // Recalculate using the new logic (maximum limit instead of sum)
        (,uint256[] memory limits,,,,bool[] memory active) = timePeriodLimitsModule.getUserSpendingLimits(user);

        uint256 maxValue = 0;
        for (uint256 i = 0; i < limits.length; i++) {
            if (active[i] && limits[i] > maxValue) {
                maxValue = limits[i];
            }
        }

        userData.totalLockedValue = maxValue;
        emit SetupCommitted(user, block.timestamp); // Reuse event for update notification
    }

    // ========== VIEW FUNCTIONS ==========

    function getProposal(address user, bytes32 proposalId) external view returns (
        string memory category,
        uint256 newLimit,
        uint256 executeAfter,
        bool executed,
        bool isIncrease,
        bool exists
    ) {
        CategoryUpdateProposal storage proposal = userProposals[user][proposalId];
        return (
            proposal.category,
            proposal.newLimit,
            proposal.executeAfter,
            proposal.executed,
            proposal.isIncrease,
            proposal.exists
        );
    }

    function isSetupCommitted(address user) external view returns (bool) {
        return userSetupData[user].hasCommittedSetup;
    }

    function getSetupInfo(address user) external view returns (
        bool committed,
        uint256 totalLockedValue,
        uint256 commitTimestamp,
        uint256 increasesInPeriod,
        uint256 lastIncreaseTimestamp
    ) {
        UserSetupData storage userData = userSetupData[user];
        return (
            userData.hasCommittedSetup,
            userData.totalLockedValue,
            userData.commitTimestamp,
            userData.increasesInPeriod,
            userData.lastIncreaseTimestamp
        );
    }

    // ========== INTERNAL HELPER FUNCTIONS ==========

    function _checkIncreaseLimit(address /* user */, UserSetupData storage /* userData */, uint256 /* increaseAmount */) internal pure {
        // Allow unlimited increases - no restrictions
        return;
    }

    function _updateIncreaseTracking(UserSetupData storage userData, uint256 increaseAmount) internal {
        // Reset tracking if 7 days have passed
        if (block.timestamp >= userData.lastIncreaseTimestamp + 7 days) {
            userData.lastIncreaseTimestamp = block.timestamp;
            userData.increasesInPeriod = increaseAmount;
        } else {
            userData.increasesInPeriod += increaseAmount;
        }
    }

    // ========== PUBLIC HELPER FUNCTIONS ==========

    function getIncreaseCapacity(address user) external view returns (uint256 remainingCapacity, uint256 totalCapacity) {
        UserSetupData storage userData = userSetupData[user];
        require(userData.hasCommittedSetup, "Setup not committed");

        totalCapacity = userData.totalLockedValue * 20 / 100; // 20% of total locked value

        // Check if 7-day period has reset
        if (block.timestamp >= userData.lastIncreaseTimestamp + 7 days) {
            remainingCapacity = totalCapacity;
        } else {
            if (totalCapacity > userData.increasesInPeriod) {
                remainingCapacity = totalCapacity - userData.increasesInPeriod;
            } else {
                remainingCapacity = 0;
            }
        }

        return (remainingCapacity, totalCapacity);
    }

    function getUserPendingProposals(address user) external view returns (
        bytes32[] memory proposalIds,
        string[] memory categories,
        uint256[] memory newLimits,
        uint256[] memory executeAfters,
        bool[] memory isIncreaseFlags
    ) {
        bytes32[] memory allProposalIds = userProposalIds[user];
        uint256 pendingCount = 0;

        // First pass: count pending proposals
        for (uint256 i = 0; i < allProposalIds.length; i++) {
            CategoryUpdateProposal storage proposal = userProposals[user][allProposalIds[i]];
            if (proposal.exists && !proposal.executed) {
                pendingCount++;
            }
        }

        // Second pass: populate arrays with pending proposals
        proposalIds = new bytes32[](pendingCount);
        categories = new string[](pendingCount);
        newLimits = new uint256[](pendingCount);
        executeAfters = new uint256[](pendingCount);
        isIncreaseFlags = new bool[](pendingCount);

        uint256 pendingIndex = 0;
        for (uint256 i = 0; i < allProposalIds.length; i++) {
            CategoryUpdateProposal storage proposal = userProposals[user][allProposalIds[i]];
            if (proposal.exists && !proposal.executed) {
                proposalIds[pendingIndex] = allProposalIds[i];
                categories[pendingIndex] = proposal.category;
                newLimits[pendingIndex] = proposal.newLimit;
                executeAfters[pendingIndex] = proposal.executeAfter;
                isIncreaseFlags[pendingIndex] = proposal.isIncrease;
                pendingIndex++;
            }
        }
    }

    function canIncreaseLimit(address user, uint256 increaseAmount) external view returns (bool) {
        UserSetupData storage userData = userSetupData[user];
        if (!userData.hasCommittedSetup) return false;

        try this._checkIncreaseLimit(user, userData, increaseAmount) {
            return true;
        } catch {
            return false;
        }
    }

    // External wrapper for internal function to support try/catch
    function _checkIncreaseLimit(address /* user */, UserSetupData calldata /* userData */, uint256 /* increaseAmount */) external pure {
        // Allow unlimited increases - no restrictions
        return;
    }
}