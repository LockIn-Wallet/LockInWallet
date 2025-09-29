// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ========== SHARED DATA STRUCTURES ==========

struct TimePeriodLimit {
    uint256 limit;          // Spending limit for this period
    uint256 spent;          // Amount spent in current period
    uint256 lastReset;      // When this period was last reset
    uint256 duration;       // Period duration in seconds
    string name;            // "Daily", "Weekly", "Salary Cycle", etc.
    bool active;            // Whether this limit is active
}

struct UserSpendingLimits {
    TimePeriodLimit[] periods;  // Array of time-based limits
    mapping(string => uint256) periodIndexes; // name => array index for quick lookup
    uint256 periodCount; // Track number of active periods
}

struct CategoryUpdateProposal {
    string category;
    uint256 newLimit;
    uint256 executeAfter;    // Timestamp when proposal can be executed
    bool executed;
    bool isIncrease;         // Track if increase or decrease
    bool exists;            // Track if proposal exists
}

struct BypassRequest {
    uint256 amount;           // Amount to withdraw
    string skipPeriod;        // Which limit to bypass ("Daily", "Weekly")
    address token;            // Token to withdraw
    uint256 executeAfter;     // When request can be executed (24h later)
    bool executed;            // Whether already processed
    bool exists;              // Track if request exists
}

struct UserSetupData {
    bool hasCommittedSetup;          // Track if user committed initial setup
    uint256 totalLockedValue;        // Total value across all periods
    uint256 lastIncreaseTimestamp;   // Track increase period start
    uint256 increasesInPeriod;       // Amount increased in current 7-day period
    uint256 commitTimestamp;         // When setup was committed
}

// ========== MODULE INTERFACES ==========

interface ITimePeriodLimitsModule {
    // Period management
    function addTimePeriodLimit(address user, string calldata periodName, uint256 limit, uint256 durationInSeconds) external;
    function removeTimePeriodLimit(address user, string calldata periodName) external;
    function updateTimePeriodLimit(address user, string calldata periodName, uint256 newLimit) external;
    function setCommonPeriodLimits(address user, uint256 dailyLimit, uint256 weeklyLimit, uint256 monthlyLimit) external;

    // Limit checking and spending
    function checkAllTimePeriodLimits(address user, uint256 amount) external;
    function checkLimitsWithBypass(address user, uint256 amount, string calldata skipPeriod) external view;
    function updateSpendingWithBypass(address user, uint256 amount, string calldata skipPeriod) external;

    // View functions
    function getUserSpendingLimits(address user) external view returns (
        string[] memory names,
        uint256[] memory limits,
        uint256[] memory spent,
        uint256[] memory remaining,
        uint256[] memory durations,
        bool[] memory active
    );
    function getTimePeriodLimit(address user, string calldata periodName) external view returns (
        uint256 limit,
        uint256 spent,
        uint256 remaining,
        uint256 duration,
        uint256 lastReset,
        bool active,
        bool exists
    );
    function findPeriodLimit(address user, string calldata periodName) external view returns (uint256);
    function getActivePeriodNames(address user) external view returns (string[] memory);
    function getActivePeriodCount(address user) external view returns (uint256);

    // Events
    event CategorySet(address indexed user, string category, uint256 limit, uint256 period);
    event CategoryDeleted(address indexed user, string category);
}

interface IProposalSystemModule {
    // Proposal management
    function proposeLimitChange(address user, string calldata periodName, uint256 newLimit) external returns (bytes32 proposalId);
    function proposeLimitRemoval(address user, string calldata periodName) external returns (bytes32 proposalId);
    function executeLimitProposal(address user, bytes32 proposalId) external;
    function cancelLimitProposal(address user, bytes32 proposalId) external;

    // Setup management
    function commitInitialSetup(address user) external;
    function recalculateTotalLockedValue(address user) external;
    function setTimePeriodLimitsModule(address _timePeriodLimitsModule) external;

    // View functions
    function getProposal(address user, bytes32 proposalId) external view returns (
        string memory category,
        uint256 newLimit,
        uint256 executeAfter,
        bool executed,
        bool isIncrease,
        bool exists
    );
    function isSetupCommitted(address user) external view returns (bool);
    function getSetupInfo(address user) external view returns (
        bool committed,
        uint256 totalLockedValue,
        uint256 commitTimestamp,
        uint256 increasesInPeriod,
        uint256 lastIncreaseTimestamp
    );

    // Events
    event SetupCommitted(address indexed user, uint256 timestamp);
    event CategoryIncreaseProposed(address indexed user, string category, uint256 newLimit, uint256 executeAfter, bytes32 proposalId);
    event CategoryIncreaseExecuted(address indexed user, string category, uint256 newLimit, bytes32 proposalId);
    event CategoryDecreased(address indexed user, string category, uint256 newLimit);
    event CategoryDeleted(address indexed user, string category);
}

interface IBypassSystemModule {
    // Bypass request management
    function requestLimitBypass(address user, uint256 amount, string calldata skipPeriod, address token) external returns (bytes32 requestId);
    function executeBypassWithdrawal(address user, bytes32 requestId) external;
    function cancelBypassRequest(address user, bytes32 requestId) external;

    // View functions
    function getBypassRequest(address user, bytes32 requestId) external view returns (
        uint256 amount,
        string memory skipPeriod,
        address token,
        uint256 executeAfter,
        bool executed,
        bool exists
    );

    function getUserActiveBypassRequests(address user) external view returns (
        bytes32[] memory requestIds,
        uint256[] memory amounts,
        string[] memory skipPeriods,
        address[] memory tokens,
        uint256[] memory executeAfters
    );

    // Module setup
    function setTimePeriodLimitsModule(address _timePeriodLimitsModule) external;

    // Events
    event BypassRequested(address indexed user, bytes32 indexed requestId, string skipPeriod, uint256 amount, address token, uint256 executeAfter);
    event BypassExecuted(address indexed user, bytes32 indexed requestId, string skipPeriod, uint256 amount, address token);
    event BypassCancelled(address indexed user, bytes32 indexed requestId);
}

interface IApprovalSystemModule {
    // Approval management
    function addApprovalAddress(address user, address approval) external;
    function revokeApprovalAddress(address user, address approval) external;
    function approveFullWithdrawal(address user, address approver) external;
    function resetFullWithdrawalApproval(address user) external;

    // View functions
    function isApprovalAddress(address user, address approval) external view returns (bool);
    function isApprovedForFullWithdrawal(address user) external view returns (bool);

    // Withdrawal address management
    function requestWithdrawalAddress(address user, string calldata title, address destination) external returns (bytes32 requestId);
    function executeWithdrawalAddressRequest(address user, bytes32 requestId) external;
    function cancelWithdrawalAddressRequest(address user, bytes32 requestId) external;
    function removeWithdrawalAddress(address user, address destination) external;

    // Withdrawal address view functions
    function getUserWithdrawalAddresses(address user) external view returns (string[] memory titles, address[] memory destinations, uint256[] memory timestamps);
    function getWithdrawalRequest(address user, bytes32 requestId) external view returns (string memory title, address destination, uint256 requestTimestamp, uint256 executeAfter, bool exists, bool executed);
    function getUserPendingWithdrawalRequests(address user) external view returns (bytes32[] memory requestIds, string[] memory titles, address[] memory destinations, uint256[] memory executeAfters);
    function isValidWithdrawalDestination(address user, address destination) external view returns (bool);

    // Events
    event ApprovalAddressAdded(address indexed user, address approval);
    event ApprovalAddressRevoked(address indexed user, address approval);
    event FullWithdrawalApproved(address indexed user);

    // Withdrawal address events
    event WithdrawalAddressRequested(address indexed user, bytes32 indexed requestId, string title, address destination, uint256 executeAfter);
    event WithdrawalAddressAdded(address indexed user, address destination, string title);
    event WithdrawalAddressRemoved(address indexed user, address destination);
    event WithdrawalAddressRequestCancelled(address indexed user, bytes32 indexed requestId);
}

// ========== MAIN CONTRACT INTERFACE ==========

interface ISavingsCore {
    // Core deposit/withdraw
    function deposit(address token, uint256 amount) external payable;
    function depositTo(address to) external payable;
    function withdraw(address user, uint256 amount, address token) external;
    function withdraw(uint256 amount, address token) external;
    function withdrawTo(uint256 amount, address token, address destination) external;
    function withdrawAll(address user) external;

    // Balance management
    function getTokenBalance(address user, address token) external view returns (uint256);
    function updateTokenBalance(address user, address token, uint256 amount, bool increase) external;

    // Module management
    function registerModule(bytes32 moduleId, address moduleAddress) external;
    function getModule(bytes32 moduleId) external view returns (address);
    function isAuthorizedModule(address moduleAddress) external view returns (bool);

    // Development mode
    function getDevelopmentMode() external view returns (bool);

    // Events
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawal(address indexed user, string category, uint256 amount, address token);
    event DepositedTo(address indexed from, address indexed to, uint256 amount);
}

// ========== MODULE IDENTIFIERS ==========

library ModuleIds {
    bytes32 public constant TIME_PERIOD_LIMITS = keccak256("TIME_PERIOD_LIMITS");
    bytes32 public constant PROPOSAL_SYSTEM = keccak256("PROPOSAL_SYSTEM");
    bytes32 public constant BYPASS_SYSTEM = keccak256("BYPASS_SYSTEM");
    bytes32 public constant APPROVAL_SYSTEM = keccak256("APPROVAL_SYSTEM");
}