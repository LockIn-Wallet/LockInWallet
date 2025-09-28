// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./SavingsInterfaces.sol";

contract ApprovalSystemModule is IApprovalSystemModule {
    // Core contract that owns this module
    ISavingsCore public immutable savingsCore;

    // Storage for approval addresses and full withdrawal approvals
    mapping(address => mapping(address => bool)) private userApprovalAddresses;
    mapping(address => bool) private userFullWithdrawalApprovals;

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

    // ========== APPROVAL ADDRESS MANAGEMENT ==========

    function addApprovalAddress(address user, address approval) external onlyAuthorized {
        require(approval != address(0), "Invalid approval address");
        require(approval != user, "Cannot approve yourself");
        userApprovalAddresses[user][approval] = true;
        emit ApprovalAddressAdded(user, approval);
    }

    function revokeApprovalAddress(address user, address approval) external onlyAuthorized {
        require(userApprovalAddresses[user][approval], "Approval address not found");
        userApprovalAddresses[user][approval] = false;
        emit ApprovalAddressRevoked(user, approval);
    }

    // ========== FULL WITHDRAWAL APPROVAL ==========

    function approveFullWithdrawal(address user, address approver) external onlyAuthorized {
        require(userApprovalAddresses[user][approver], "Not authorized approver");
        userFullWithdrawalApprovals[user] = true;
        emit FullWithdrawalApproved(user);
    }

    function resetFullWithdrawalApproval(address user) external onlyAuthorized {
        userFullWithdrawalApprovals[user] = false;
    }

    // ========== VIEW FUNCTIONS ==========

    function isApprovalAddress(address user, address approval) external view returns (bool) {
        return userApprovalAddresses[user][approval];
    }

    function isApprovedForFullWithdrawal(address user) external view returns (bool) {
        return userFullWithdrawalApprovals[user];
    }

    // ========== HELPER FUNCTIONS ==========

    function getUserApprovalAddresses(address user) external view returns (address[] memory) {
        // Note: This is a simplified implementation
        // In practice, you might want to track approval addresses in an array for efficient enumeration
        // For now, this function signature is provided for future implementation

        // Return empty array as placeholder - would need to track addresses in an array
        return new address[](0);
    }

    function getApprovalCount(address user) external view returns (uint256) {
        // This would require tracking approval addresses in an array to implement efficiently
        // For now, returning 0 as placeholder
        return 0;
    }

    function hasAnyApprovalAddresses(address user) external view returns (bool) {
        // This would require tracking approval addresses to implement efficiently
        // For now, returning false as placeholder
        return false;
    }

    // ========== BATCH OPERATIONS ==========

    function addMultipleApprovalAddresses(
        address user,
        address[] calldata approvals
    ) external onlyAuthorized {
        require(approvals.length > 0, "No approvals provided");
        require(approvals.length <= 10, "Too many approvals at once"); // Limit for gas

        for (uint256 i = 0; i < approvals.length; i++) {
            require(approvals[i] != address(0), "Invalid approval address");
            require(approvals[i] != user, "Cannot approve yourself");

            // Check for duplicates in the input array
            for (uint256 j = i + 1; j < approvals.length; j++) {
                require(approvals[i] != approvals[j], "Duplicate approval address");
            }

            userApprovalAddresses[user][approvals[i]] = true;
            emit ApprovalAddressAdded(user, approvals[i]);
        }
    }

    function revokeMultipleApprovalAddresses(
        address user,
        address[] calldata approvals
    ) external onlyAuthorized {
        require(approvals.length > 0, "No approvals provided");
        require(approvals.length <= 10, "Too many revocations at once"); // Limit for gas

        for (uint256 i = 0; i < approvals.length; i++) {
            require(userApprovalAddresses[user][approvals[i]], "Approval address not found");
            userApprovalAddresses[user][approvals[i]] = false;
            emit ApprovalAddressRevoked(user, approvals[i]);
        }
    }

    // ========== SECURITY FUNCTIONS ==========

    function requireValidApprover(address user, address approver) external view {
        require(userApprovalAddresses[user][approver], "Not authorized approver");
    }

    function requireFullWithdrawalApproval(address user) external view {
        require(userFullWithdrawalApprovals[user], "Full withdrawal not approved");
    }

    // ========== EMERGENCY FUNCTIONS ==========

    function emergencyRevokeAllApprovals(address user) external onlyCore {
        // This function could be used in emergency situations to revoke all approvals
        // Implementation would require tracking approval addresses in an array
        // For now, this is a placeholder for future emergency functionality

        // Reset full withdrawal approval
        userFullWithdrawalApprovals[user] = false;

        // Note: To fully implement this, we'd need to iterate through all approval addresses
        // which would require tracking them in an array
    }

    function emergencySetApprovalAddress(
        address user,
        address newApprover,
        bool approved
    ) external onlyCore {
        // Emergency function to set approval status
        require(newApprover != address(0), "Invalid approval address");
        require(newApprover != user, "Cannot approve yourself");

        bool wasApproved = userApprovalAddresses[user][newApprover];
        userApprovalAddresses[user][newApprover] = approved;

        if (approved && !wasApproved) {
            emit ApprovalAddressAdded(user, newApprover);
        } else if (!approved && wasApproved) {
            emit ApprovalAddressRevoked(user, newApprover);
        }
    }

    // ========== UTILITY FUNCTIONS ==========

    function checkApprovalStatus(
        address user,
        address[] calldata potentialApprovers
    ) external view returns (bool[] memory statuses) {
        statuses = new bool[](potentialApprovers.length);
        for (uint256 i = 0; i < potentialApprovers.length; i++) {
            statuses[i] = userApprovalAddresses[user][potentialApprovers[i]];
        }
        return statuses;
    }

    function canApproveFullWithdrawal(address user, address approver) external view returns (bool) {
        return userApprovalAddresses[user][approver];
    }

    // ========== COMPATIBILITY FUNCTIONS ==========

    // These functions maintain compatibility with the original contract interface
    function setApprovalAddress(address user, address approval) external onlyAuthorized {
        // This is equivalent to addApprovalAddress for backward compatibility
        this.addApprovalAddress(user, approval);
    }
}