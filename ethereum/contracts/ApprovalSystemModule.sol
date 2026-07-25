// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./SavingsInterfaces.sol";

contract ApprovalSystemModule is Initializable, UUPSUpgradeable, OwnableUpgradeable, IApprovalSystemModule {
    ISavingsCore public savingsCore;

    // Storage for approval addresses and full withdrawal approvals
    mapping(address => mapping(address => bool)) private userApprovalAddresses;
    mapping(address => bool) private userFullWithdrawalApprovals;

    // Storage for withdrawal addresses and requests
    struct WithdrawalAddress {
        string title;
        address destination;
        uint256 addedTimestamp;
        bool active;
    }

    struct WithdrawalRequest {
        string title;
        address destination;
        uint256 requestTimestamp;
        uint256 executeAfter;
        bool exists;
        bool executed;
    }

    mapping(address => WithdrawalAddress[]) private userWithdrawalAddresses;
    mapping(address => mapping(bytes32 => WithdrawalRequest)) private userWithdrawalRequests;
    mapping(address => bytes32[]) private userPendingRequestIds;

    // Migration flag
    bool public migrationComplete;

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
        return 0;
    }

    function hasAnyApprovalAddresses(address user) external view returns (bool) {
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
        // Reset full withdrawal approval
        userFullWithdrawalApprovals[user] = false;
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

    // ========== WITHDRAWAL ADDRESS MANAGEMENT ==========

    function requestWithdrawalAddress(
        address user,
        string calldata title,
        address destination
    ) external onlyAuthorizedOrSelf(user) returns (bytes32 requestId) {
        require(destination != address(0), "Invalid destination address");
        require(destination != user, "Cannot set own address as destination");
        require(bytes(title).length > 0 && bytes(title).length <= 50, "Invalid title length");

        // Check for duplicate destinations
        WithdrawalAddress[] storage addresses = userWithdrawalAddresses[user];
        for (uint256 i = 0; i < addresses.length; i++) {
            require(addresses[i].destination != destination || !addresses[i].active, "Address already exists");
        }

        // Generate unique request ID
        requestId = keccak256(abi.encodePacked(user, title, destination, block.timestamp, block.number));

        // Create withdrawal request with timelock (10 seconds in dev mode, 24 hours in production)
        uint256 timelockDuration = savingsCore.getDevelopmentMode() ? 10 seconds : 24 hours;
        userWithdrawalRequests[user][requestId] = WithdrawalRequest({
            title: title,
            destination: destination,
            requestTimestamp: block.timestamp,
            executeAfter: block.timestamp + timelockDuration,
            exists: true,
            executed: false
        });

        // Track pending request
        userPendingRequestIds[user].push(requestId);

        emit WithdrawalAddressRequested(user, requestId, title, destination, block.timestamp + timelockDuration);
        return requestId;
    }

    function addWithdrawalAddressDirect(
        address user,
        string calldata title,
        address destination
    ) external onlyAuthorizedOrSelf(user) {
        require(destination != address(0), "Invalid destination address");
        require(destination != user, "Cannot set own address as destination");
        require(bytes(title).length > 0 && bytes(title).length <= 50, "Invalid title length");

        // Check that setup is not committed (only allow direct adds during setup)
        IProposalSystemModule proposalModule = IProposalSystemModule(savingsCore.getModule(keccak256("PROPOSAL_SYSTEM")));
        require(address(proposalModule) != address(0), "Proposal module not found");
        require(!proposalModule.isSetupCommitted(user), "Setup already committed - use timelock method");

        // Check for duplicate destinations
        WithdrawalAddress[] storage addresses = userWithdrawalAddresses[user];
        for (uint256 i = 0; i < addresses.length; i++) {
            require(addresses[i].destination != destination || !addresses[i].active, "Address already exists");
        }

        // Add directly to user's withdrawal addresses (no timelock)
        userWithdrawalAddresses[user].push(WithdrawalAddress({
            title: title,
            destination: destination,
            addedTimestamp: block.timestamp,
            active: true
        }));

        emit WithdrawalAddressAdded(user, destination, title);
    }

    function executeWithdrawalAddressRequest(
        address user,
        bytes32 requestId
    ) external onlyAuthorizedOrSelf(user) {
        WithdrawalRequest storage request = userWithdrawalRequests[user][requestId];
        require(request.exists, "Request does not exist");
        require(!request.executed, "Request already executed");
        require(block.timestamp >= request.executeAfter, "Request still in timelock");

        // Add to user's withdrawal addresses
        userWithdrawalAddresses[user].push(WithdrawalAddress({
            title: request.title,
            destination: request.destination,
            addedTimestamp: block.timestamp,
            active: true
        }));

        // Mark request as executed
        request.executed = true;

        // Remove from pending requests
        _removePendingRequest(user, requestId);

        emit WithdrawalAddressAdded(user, request.destination, request.title);
    }

    function cancelWithdrawalAddressRequest(
        address user,
        bytes32 requestId
    ) external onlyAuthorizedOrSelf(user) {
        WithdrawalRequest storage request = userWithdrawalRequests[user][requestId];
        require(request.exists, "Request does not exist");
        require(!request.executed, "Request already executed");

        // Mark as executed to prevent future execution
        request.executed = true;

        // Remove from pending requests
        _removePendingRequest(user, requestId);

        emit WithdrawalAddressRequestCancelled(user, requestId);
    }

    function removeWithdrawalAddress(
        address user,
        address destination
    ) external onlyAuthorizedOrSelf(user) {
        WithdrawalAddress[] storage addresses = userWithdrawalAddresses[user];

        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i].destination == destination && addresses[i].active) {
                addresses[i].active = false;
                emit WithdrawalAddressRemoved(user, destination);
                return;
            }
        }

        revert("Withdrawal address not found");
    }

    // ========== WITHDRAWAL ADDRESS VIEW FUNCTIONS ==========

    function getUserWithdrawalAddresses(address user)
        external
        view
        returns (
            string[] memory titles,
            address[] memory destinations,
            uint256[] memory timestamps
        )
    {
        WithdrawalAddress[] storage addresses = userWithdrawalAddresses[user];

        // Count active addresses
        uint256 activeCount = 0;
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i].active) {
                activeCount++;
            }
        }

        // Create arrays for active addresses
        titles = new string[](activeCount);
        destinations = new address[](activeCount);
        timestamps = new uint256[](activeCount);

        uint256 index = 0;
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i].active) {
                titles[index] = addresses[i].title;
                destinations[index] = addresses[i].destination;
                timestamps[index] = addresses[i].addedTimestamp;
                index++;
            }
        }
    }

    function getWithdrawalRequest(address user, bytes32 requestId)
        external
        view
        returns (
            string memory title,
            address destination,
            uint256 requestTimestamp,
            uint256 executeAfter,
            bool exists,
            bool executed
        )
    {
        WithdrawalRequest storage request = userWithdrawalRequests[user][requestId];
        return (
            request.title,
            request.destination,
            request.requestTimestamp,
            request.executeAfter,
            request.exists,
            request.executed
        );
    }

    function getUserPendingWithdrawalRequests(address user)
        external
        view
        returns (
            bytes32[] memory requestIds,
            string[] memory titles,
            address[] memory destinations,
            uint256[] memory executeAfters
        )
    {
        bytes32[] storage pendingIds = userPendingRequestIds[user];

        // Count valid pending requests
        uint256 validCount = 0;
        for (uint256 i = 0; i < pendingIds.length; i++) {
            WithdrawalRequest storage request = userWithdrawalRequests[user][pendingIds[i]];
            if (request.exists && !request.executed) {
                validCount++;
            }
        }

        // Create arrays for valid pending requests
        requestIds = new bytes32[](validCount);
        titles = new string[](validCount);
        destinations = new address[](validCount);
        executeAfters = new uint256[](validCount);

        uint256 index = 0;
        for (uint256 i = 0; i < pendingIds.length; i++) {
            WithdrawalRequest storage request = userWithdrawalRequests[user][pendingIds[i]];
            if (request.exists && !request.executed) {
                requestIds[index] = pendingIds[i];
                titles[index] = request.title;
                destinations[index] = request.destination;
                executeAfters[index] = request.executeAfter;
                index++;
            }
        }
    }

    function isValidWithdrawalDestination(address user, address destination)
        external
        view
        returns (bool)
    {
        if (destination == user) {
            return true; // User can always withdraw to their own address
        }

        WithdrawalAddress[] storage addresses = userWithdrawalAddresses[user];
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i].destination == destination && addresses[i].active) {
                return true;
            }
        }
        return false;
    }

    // ========== INTERNAL HELPER FUNCTIONS ==========

    function _removePendingRequest(address user, bytes32 requestId) internal {
        bytes32[] storage pendingIds = userPendingRequestIds[user];

        for (uint256 i = 0; i < pendingIds.length; i++) {
            if (pendingIds[i] == requestId) {
                // Move last element to current position and remove last
                pendingIds[i] = pendingIds[pendingIds.length - 1];
                pendingIds.pop();
                break;
            }
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

    function setApprovalAddress(address user, address approval) external onlyAuthorized {
        this.addApprovalAddress(user, approval);
    }

    // ========== MIGRATION FUNCTIONS ==========

    function migrateWithdrawalAddresses(
        address user,
        string[] calldata titles,
        address[] calldata destinations,
        uint256[] calldata timestamps
    ) external onlyOwner {
        require(!migrationComplete, "Migration already complete");
        require(
            titles.length == destinations.length &&
            destinations.length == timestamps.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < titles.length; i++) {
            userWithdrawalAddresses[user].push(WithdrawalAddress({
                title: titles[i],
                destination: destinations[i],
                addedTimestamp: timestamps[i],
                active: true
            }));
        }
    }

    function migrateApprovalAddress(
        address user,
        address approver,
        bool approved
    ) external onlyOwner {
        require(!migrationComplete, "Migration already complete");
        userApprovalAddresses[user][approver] = approved;
    }

    function migrateFullWithdrawalApproval(
        address user,
        bool approved
    ) external onlyOwner {
        require(!migrationComplete, "Migration already complete");
        userFullWithdrawalApprovals[user] = approved;
    }

    function lockMigration() external onlyOwner {
        migrationComplete = true;
    }
}
