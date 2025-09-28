// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SavingsInterfaces.sol";

contract BypassSystemModule is IBypassSystemModule {
    // Core contract that owns this module
    ISavingsCore public immutable savingsCore;

    // Time Period Limits Module for limit checking
    ITimePeriodLimitsModule public timePeriodLimitsModule;

    // Storage for bypass requests
    mapping(address => mapping(bytes32 => BypassRequest)) private userBypassRequests;

    // Add this modifier to prevent reentrancy
    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    bool private locked;

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
        locked = false;
    }

    function setTimePeriodLimitsModule(address _timePeriodLimitsModule) external onlyCore {
        require(_timePeriodLimitsModule != address(0), "Invalid module address");
        timePeriodLimitsModule = ITimePeriodLimitsModule(_timePeriodLimitsModule);
    }

    // ========== BYPASS REQUEST MANAGEMENT ==========

    function requestLimitBypass(
        address user,
        uint256 amount,
        string calldata skipPeriod,
        address token
    ) external onlyAuthorized returns (bytes32 requestId) {
        require(amount > 0 && bytes(skipPeriod).length > 0, "Invalid input");
        require(amount <= savingsCore.getTokenBalance(user, token), "Insufficient balance");

        // Verify the period exists
        require(timePeriodLimitsModule.findPeriodLimit(user, skipPeriod) > 0, "Period not found");

        // Generate unique request ID
        requestId = keccak256(abi.encodePacked(user, skipPeriod, amount, token, block.timestamp));
        require(!userBypassRequests[user][requestId].exists, "Request exists");

        userBypassRequests[user][requestId] = BypassRequest({
            amount: amount,
            skipPeriod: skipPeriod,
            token: token,
            executeAfter: block.timestamp + 24 hours,
            executed: false,
            exists: true
        });

        emit BypassRequested(user, requestId, skipPeriod, amount, token, block.timestamp + 24 hours);
        return requestId;
    }

    function executeBypassWithdrawal(address user, bytes32 requestId) external onlyAuthorized nonReentrant {
        BypassRequest storage request = userBypassRequests[user][requestId];

        require(request.exists && !request.executed, "Invalid request");
        require(block.timestamp >= request.executeAfter, "Still in timelock");
        require(request.amount <= savingsCore.getTokenBalance(user, request.token), "Insufficient balance");

        // Check limits excluding the bypassed period
        timePeriodLimitsModule.checkLimitsWithBypass(user, request.amount, request.skipPeriod);

        // Mark request as executed
        request.executed = true;

        // Update balances and spending for non-bypassed periods
        savingsCore.updateTokenBalance(user, request.token, request.amount, false);
        timePeriodLimitsModule.updateSpendingWithBypass(user, request.amount, request.skipPeriod);

        // Transfer funds
        if (request.token == address(0)) {
            // ETH withdrawal
            payable(user).transfer(request.amount);
        } else {
            // ERC20 withdrawal
            IERC20(request.token).transfer(user, request.amount);
        }

        emit BypassExecuted(user, requestId, request.skipPeriod, request.amount, request.token);
    }

    function cancelBypassRequest(address user, bytes32 requestId) external onlyAuthorized {
        BypassRequest storage request = userBypassRequests[user][requestId];
        require(request.exists && !request.executed, "Invalid request");

        // Delete the request
        delete userBypassRequests[user][requestId];

        emit BypassCancelled(user, requestId);
    }

    // ========== VIEW FUNCTIONS ==========

    function getBypassRequest(address user, bytes32 requestId) external view returns (
        uint256 amount,
        string memory skipPeriod,
        address token,
        uint256 executeAfter,
        bool executed,
        bool exists
    ) {
        BypassRequest storage request = userBypassRequests[user][requestId];
        return (
            request.amount,
            request.skipPeriod,
            request.token,
            request.executeAfter,
            request.executed,
            request.exists
        );
    }

    // ========== HELPER FUNCTIONS ==========

    function getUserActiveBypassRequests(address user) external view returns (
        bytes32[] memory requestIds,
        uint256[] memory amounts,
        string[] memory skipPeriods,
        address[] memory tokens,
        uint256[] memory executeAfters
    ) {
        // Note: This is a simplified implementation
        // In practice, you might want to track request IDs in an array for efficient enumeration
        // For now, this function signature is provided for future implementation

        // Return empty arrays as placeholder
        requestIds = new bytes32[](0);
        amounts = new uint256[](0);
        skipPeriods = new string[](0);
        tokens = new address[](0);
        executeAfters = new uint256[](0);
    }

    function canExecuteBypass(address user, bytes32 requestId) external view returns (bool canExecute, string memory reason) {
        BypassRequest storage request = userBypassRequests[user][requestId];

        if (!request.exists) {
            return (false, "Request does not exist");
        }

        if (request.executed) {
            return (false, "Request already executed");
        }

        if (block.timestamp < request.executeAfter) {
            return (false, "Still in timelock period");
        }

        if (request.amount > savingsCore.getTokenBalance(user, request.token)) {
            return (false, "Insufficient balance");
        }

        // Check if bypassing this request would violate other limits
        try timePeriodLimitsModule.checkLimitsWithBypass(user, request.amount, request.skipPeriod) {
            return (true, "");
        } catch Error(string memory error) {
            return (false, error);
        } catch {
            return (false, "Unknown limit check error");
        }
    }

    function getTimeUntilExecution(address user, bytes32 requestId) external view returns (uint256 timeRemaining) {
        BypassRequest storage request = userBypassRequests[user][requestId];
        require(request.exists, "Request does not exist");

        if (block.timestamp >= request.executeAfter) {
            return 0;
        } else {
            return request.executeAfter - block.timestamp;
        }
    }

    // ========== EMERGENCY FUNCTIONS ==========

    function emergencySetBypassTimelock(uint256 newTimelock) external onlyCore {
        // This function could be used to adjust timelock in emergency situations
        // Implementation would depend on specific requirements
        // For now, this is a placeholder for future emergency functionality
        require(newTimelock >= 1 hours && newTimelock <= 168 hours, "Invalid timelock duration"); // 1 hour to 1 week
    }

    // Allow the contract to receive ETH for bypass withdrawals
    receive() external payable {
        // Only accept ETH from the core contract
        require(msg.sender == address(savingsCore), "Only core contract can send ETH");
    }
}