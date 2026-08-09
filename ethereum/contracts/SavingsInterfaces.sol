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
    // Appended for upgrades — proposals that change the period's own unlock
    // delay rather than its spending limit. Safe to append: the struct is only
    // ever reached through a mapping, so elements never share slot ranges.
    bool isDelayChange;      // True when this proposal retunes the unlock delay
    uint256 newUnlockDelay;  // Requested unlock delay, in seconds
}

struct BypassRequest {
    uint256 amount;           // Amount to withdraw
    string skipPeriod;        // Which limit to bypass ("Daily", "Weekly")
    address token;            // Token to withdraw
    uint256 executeAfter;     // When request can be executed (after the period's unlock delay)
    bool executed;            // Whether already processed
    bool exists;              // Track if request exists
}

struct VaultParams {
    string name;
    string description;
    uint8 vaultType;              // 0 = Personal, 1 = Community
    address token;                // address(0) = native coin (ETH)
    uint256 dailyLimit;
    uint256 weeklyLimit;
    uint256 monthlyLimit;
    bool limitsArePercentage;
    uint256 penaltyRateBps;
}

struct VaultInfo {
    address creator;
    uint8 vaultType;              // 0 = Personal, 1 = Community
    address token;                // address(0) = native coin (ETH)
    string name;
    string description;
    uint256 dailyLimit;           // fixed token amount, or bps of member balance
    uint256 weeklyLimit;
    uint256 monthlyLimit;
    bool limitsArePercentage;     // true => limits are basis points of member balance
    uint256 penaltyRateBps;
    uint256 memberCount;
    uint256 totalBalance;
    uint256 accPenaltyPerShare;   // scaled by PENALTY_PRECISION
    bool isActive;
    uint256 createdAt;
    uint256 updatedAt;
}

struct VaultMemberInfo {
    uint256 balance;
    uint256 dailySpent;
    uint256 dailyLastReset;
    uint256 weeklySpent;
    uint256 weeklyLastReset;
    uint256 monthlySpent;
    uint256 monthlyLastReset;
    uint256 penaltyDebt;          // scaled by PENALTY_PRECISION
    uint256 unclaimedPenalties;
    uint256 joinedAt;
    bool exists;
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
    function setPeriodLimits(
        address user,
        string[] calldata names,
        uint256[] calldata limits,
        uint256[] calldata durations,
        uint256[] calldata unlockDelays
    ) external;
    function setProposalSystemModule(address _proposalSystemModule) external;

    // Unlock delays — how long a bypass request or limit-change proposal must
    // wait before it can be executed, tuned per period
    function getUnlockDelay(address user, string calldata periodName) external view returns (uint256);
    function migratePeriodsTo(address from, address to) external;
    function setUnlockDelay(address user, string calldata periodName, uint256 unlockDelay) external;
    function validateUnlockDelay(uint256 unlockDelay) external pure;

    // Limit checking and spending
    function checkAllTimePeriodLimits(address user, uint256 amount) external;
    function checkAllTimePeriodLimitsFor(address user, uint256 amount, uint256 balance) external;
    function setLimitsArePercentage(address user, bool arePercentage) external;
    function limitsArePercentage(address user) external view returns (bool);
    function checkLimitsWithBypass(address user, uint256 amount, string calldata skipPeriod) external view;
    function updateSpendingWithBypass(address user, uint256 amount, string calldata skipPeriod) external;

    // View functions
    function getUserSpendingLimits(address user) external view returns (
        string[] memory names,
        uint256[] memory limits,
        uint256[] memory spent,
        uint256[] memory remaining,
        uint256[] memory durations,
        bool[] memory active,
        uint256[] memory unlockDelays
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
    event UnlockDelaySet(address indexed user, string category, uint256 unlockDelay);
    event PeriodsMigrated(address indexed from, address indexed to, uint256 periodCount);
    event LimitsArePercentageSet(address indexed user, bool arePercentage);
}

interface IProposalSystemModule {
    // Proposal management
    function proposeLimitChange(address user, string calldata periodName, uint256 newLimit) external returns (bytes32 proposalId);
    function proposeLimitRemoval(address user, string calldata periodName) external returns (bytes32 proposalId);
    function proposeUnlockDelayChange(address user, string calldata periodName, uint256 newUnlockDelay) external returns (bytes32 proposalId);
    function executeLimitProposal(address user, bytes32 proposalId) external;
    function cancelLimitProposal(address user, bytes32 proposalId) external;

    // Setup management
    function commitInitialSetup(address user) external;
    function commitSetup(uint256 dailyLimit, uint256 weeklyLimit, uint256 monthlyLimit) external;
    function commitSetupWithReferrer(uint256 dailyLimit, uint256 weeklyLimit, uint256 monthlyLimit, address referrer) external;
    function commitSetupWithPeriods(
        string[] calldata names,
        uint256[] calldata limits,
        uint256[] calldata durations,
        uint256[] calldata unlockDelays,
        address referrer
    ) external;
    function recalculateTotalLockedValue(address user) external;
    function migrateSetupTo(address from, address to) external;
    function setTimePeriodLimitsModule(address _timePeriodLimitsModule) external;
    function setReferralModule(address _referralModule) external;

    // View functions
    function getProposal(address user, bytes32 proposalId) external view returns (
        string memory category,
        uint256 newLimit,
        uint256 executeAfter,
        bool executed,
        bool isIncrease,
        bool exists,
        bool isDelayChange,
        uint256 newUnlockDelay
    );
    function isSetupCommitted(address user) external view returns (bool);
    function getSetupInfo(address user) external view returns (
        bool committed,
        uint256 totalLockedValue,
        uint256 commitTimestamp,
        uint256 increasesInPeriod,
        uint256 lastIncreaseTimestamp
    );
    function getUserPendingProposals(address user) external view returns (
        bytes32[] memory proposalIds,
        string[] memory categories,
        uint256[] memory newLimits,
        uint256[] memory executeAfters,
        bool[] memory isIncreaseFlags,
        bool[] memory isDelayChangeFlags,
        uint256[] memory newUnlockDelays
    );

    // Events
    event SetupCommitted(address indexed user, uint256 timestamp);
    event CategoryIncreaseProposed(address indexed user, string category, uint256 newLimit, uint256 executeAfter, bytes32 proposalId);
    event UnlockDelayChangeProposed(address indexed user, string category, uint256 newUnlockDelay, uint256 executeAfter, bytes32 proposalId);
    event UnlockDelayChanged(address indexed user, string category, uint256 newUnlockDelay);
    event CategoryIncreaseExecuted(address indexed user, string category, uint256 newLimit, bytes32 proposalId);
    event CategoryDecreased(address indexed user, string category, uint256 newLimit);
    event CategoryDeleted(address indexed user, string category);
}

interface IBypassSystemModule {
    // Bypass request management
    function requestLimitBypass(address user, uint256 amount, string calldata skipPeriod, address token) external returns (bytes32 requestId);
    function executeBypassWithdrawal(address user, bytes32 requestId) external;
    function requestBypassFor(address user, uint256 amount, string calldata skipPeriod, address token, uint256 availableBalance) external returns (bytes32);
    function consumeBypassRequest(address user, bytes32 requestId) external returns (uint256 amount, address token);
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
    function addWithdrawalAddressDirect(address user, string calldata title, address destination) external;
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

interface IPoolTogetherModule {
    function depositToVault(address user, address token, uint256 amount) external;
    function withdrawFromVault(address user, address token, uint256 sharesToRedeem) external;
    function claimPrize(address user, address token, uint8 tier) external returns (uint256);
    function getUserVaultShares(address user, address token) external view returns (uint256);
    function getUserVaultBalance(address user, address token) external view returns (uint256);
    function hasVault(address token) external view returns (bool);
    function getGrandPrize() external view returns (uint256);
    function getNumberOfTiers() external view returns (uint8);

    event PrizeVaultSet(address indexed token, address indexed vault);
    event DepositedToVault(address indexed user, address indexed token, uint256 amount, uint256 shares);
    event WithdrawnFromVault(address indexed user, address indexed token, uint256 amount, uint256 shares);
    event PrizeClaimed(address indexed user, address indexed token, uint256 amount, uint8 tier);
}

interface IVaultSystemModule {
    // Vault lifecycle
    function createVault(VaultParams calldata params) external returns (uint256 vaultId);
    function createVaultWithPeriods(
        VaultParams calldata params,
        string[] calldata names,
        uint256[] calldata limits,
        uint256[] calldata durations,
        uint256[] calldata unlockDelays
    ) external returns (uint256 vaultId);
    function joinVault(uint256 vaultId) external;
    function leaveVault(uint256 vaultId) external;
    function vaultScopeOf(uint256 vaultId, address member) external pure returns (address);
    function requestVaultBypass(uint256 vaultId, uint256 amount, string calldata skipPeriod) external returns (bytes32);
    function executeVaultBypass(uint256 vaultId, bytes32 requestId, address destination) external;
    function cancelVaultBypass(uint256 vaultId, bytes32 requestId) external;

    // Funds
    function deposit(uint256 vaultId, uint256 amount) external payable;
    function depositFor(uint256 vaultId, uint256 amount, address beneficiary) external payable;
    function withdraw(uint256 vaultId, uint256 amount) external;
    function withdrawTo(uint256 vaultId, uint256 amount, address destination) external;
    function withdrawWithPenalty(uint256 vaultId, uint256 amount) external;
    function claimPenaltyRewards(uint256 vaultId) external;

    // Permanent deposit addresses
    function deployVaultDepositAddress(uint256 vaultId) external returns (address proxy);
    function getVaultDepositAddress(uint256 vaultId) external view returns (address);

    // Earning on vault balances — the module custodies the funds and delegates
    // the accounting to the yield module
    function setVaultYieldMode(uint256 vaultId, uint8 mode) external;
    function compoundYield(uint256 vaultId, address member) external;

    // Views
    function getVault(uint256 vaultId) external view returns (VaultInfo memory);
    function getVaultMember(uint256 vaultId, address member) external view returns (VaultMemberInfo memory);
    function getUserVaultIds(address user) external view returns (uint256[] memory);
    function getVaultMembers(uint256 vaultId) external view returns (address[] memory);
    function getVaultCount() external view returns (uint256);
    function pendingPenaltyRewards(uint256 vaultId, address member) external view returns (uint256);
    function pendingVaultYield(uint256 vaultId, address member) external view returns (uint256);
    function getVaultYieldInfo(uint256 vaultId) external view returns (
        uint8 mode,
        address strategy,
        uint256 invested,
        uint256 currentValue,
        uint256 lifetimeYield,
        uint256 feeBps
    );

    /// @notice Where penalties and yield fees are sent. Already owner-configured
    /// via setTreasury; exposed so the yield module can reuse it rather than
    /// carrying a second treasury address.
    function treasury() external view returns (address);

    // Events
    event VaultCreated(uint256 indexed vaultId, address indexed creator, address indexed token, string name, uint8 vaultType);
    event VaultJoined(uint256 indexed vaultId, address indexed member);
    event VaultLeft(uint256 indexed vaultId, address indexed member);
    event VaultRulesUpdated(uint256 indexed vaultId);
    event VaultDeposit(uint256 indexed vaultId, address indexed member, uint256 amount);
    event VaultDepositAddressDeployed(uint256 indexed vaultId, address indexed proxy);
    event VaultWithdrawal(uint256 indexed vaultId, address indexed member, uint256 amount, uint256 penalty);
    event PenaltyRewardsClaimed(uint256 indexed vaultId, address indexed member, uint256 amount);
    event VaultYieldModeSet(uint256 indexed vaultId, uint8 mode);
    event VaultYieldCompounded(uint256 indexed vaultId, address indexed member, uint256 amount);
}

interface IRecoverySystemModule {
    // Recovery key management (two-step: propose, then the key accepts)
    function setRecoveryAddress(address recovery) external;
    function acceptRecoveryRole(address user) external;
    function cancelRecoveryKeyProposal() external;
    function updateRecoveryAddress(address user, address newRecovery) external;
    function requestRecoveryAddressChange(address newRecovery) external;
    function executeRecoveryAddressChange() external;
    function cancelRecoveryAddressChange(address user) external;

    // Freeze management
    function freeze(address user) external;
    function unfreeze(address user) external;

    // Ownership recovery
    function recoverOwnership(address user, address newOwner, address[] calldata tokens) external;

    // View functions
    function getRecoveryConfig(address user) external view returns (address recoveryAddress, bool frozen, bool recovered);
    function getPendingRecoveryKey(address user) external view returns (address);
    function getPendingRecoveryAddressChange(address user) external view returns (address newRecovery, uint256 executeAfter, bool exists);
    function isFrozen(address user) external view returns (bool);
    function requireNotFrozen(address user) external view;

    // Events
    event RecoveryKeyProposed(address indexed user, address indexed proposedRecovery, address proposedBy);
    event RecoveryKeyProposalCancelled(address indexed user);
    event RecoveryAddressSet(address indexed user, address indexed recovery, address setBy);
    event RecoveryAddressChangeRequested(address indexed user, address indexed newRecovery, uint256 executeAfter);
    event RecoveryAddressChangeExecuted(address indexed user, address indexed newRecovery);
    event RecoveryAddressChangeCancelled(address indexed user, address cancelledBy);
    event AccountFrozen(address indexed user, address frozenBy);
    event AccountUnfrozen(address indexed user);
    event OwnershipRecovered(address indexed oldOwner, address indexed newOwner, uint256 tokenCount);
}

interface IReferralModule {
    // Referral recording
    function recordReferral(address user, address referrer) external;

    // View functions — a referrer only ever learns how many invitees they have,
    // never which wallets, so referral rewards can't double as a window into
    // an invitee's savings
    function getReferrer(address user) external view returns (address referrer, uint256 referredAt);
    function getReferralCount(address referrer) external view returns (uint256);

    // Events
    event ReferralRecorded(address indexed referrer, uint256 referralCount, uint256 timestamp);
}

interface IProxyDeploymentModule {
    function deployUserProxy(address user) external payable returns (address proxy);
    function isProxyDeployed(address user) external view returns (bool);
    function getUserProxy(address user) external view returns (address);
    function getUserDepositAddress(address user) external view returns (address);
    function setTreasuryAddress(address _treasury) external;
    function setPaymentToken(address _token) external;
    function setProxyDeploymentFee(uint256 _fee) external;
    function getProxyDeploymentFee() external view returns (uint256);

    event ProxyDeployed(address indexed user, address indexed proxy);
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
    function transferTokensTo(address user, address token, uint256 amount, address destination) external;

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
    bytes32 public constant PROXY_DEPLOYMENT = keccak256("PROXY_DEPLOYMENT");
    bytes32 public constant POOL_TOGETHER = keccak256("POOL_TOGETHER");
    bytes32 public constant VAULT_SYSTEM = keccak256("VAULT_SYSTEM");
    bytes32 public constant REFERRAL = keccak256("REFERRAL");
    bytes32 public constant RECOVERY_SYSTEM = keccak256("RECOVERY_SYSTEM");
    bytes32 public constant YIELD_SYSTEM = keccak256("YIELD_SYSTEM");
    bytes32 public constant VAULT_RULES = keccak256("VAULT_RULES");
    bytes32 public constant SAVINGS_VAULTS = keccak256("SAVINGS_VAULTS");
}

// ========== SHARED GUARDS ==========

/// @notice Revert when `user`'s account is frozen or recovered. No-op while
/// the recovery module is not registered, so existing deployments keep
/// working before the module rollout.
function enforceNotFrozen(ISavingsCore core, address user) view {
    address recoveryModule = core.getModule(ModuleIds.RECOVERY_SYSTEM);
    if (recoveryModule != address(0)) {
        IRecoverySystemModule(recoveryModule).requireNotFrozen(user);
    }
}