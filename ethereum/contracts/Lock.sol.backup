pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./UserProxy.sol";

contract Savings is Initializable, UUPSUpgradeable, OwnableUpgradeable {
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

    struct UserData {
        mapping(address => uint256) tokenBalances; // Token address => balance
        mapping(address => bool) approvalAddresses;
        bool approvedForFullWithdrawal;
        UserSpendingLimits spendingLimits; // New time-based spending limits

        // Two-phase system fields (for overall setup, not individual limits)
        bool hasCommittedSetup;          // Track if user committed initial setup
        uint256 totalLockedValue;        // Total value across all periods
        uint256 lastIncreaseTimestamp;   // Track increase period start
        uint256 increasesInPeriod;       // Amount increased in current 7-day period
        uint256 commitTimestamp;         // When setup was committed
        mapping(bytes32 => CategoryUpdateProposal) proposals; // Pending proposals for system changes
        mapping(bytes32 => BypassRequest) bypassRequests; // Pending bypass requests
    }

    mapping(address => UserData) private users;
    mapping(address => address) private userProxies; // user => proxy address

    // Development mode for testing - set to false for production
    bool public developmentMode;

    event Deposited(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event ProxyDeployed(address indexed user, address indexed proxy);
    event Withdrawal(
        address indexed user,
        string category,
        uint256 amount,
        address token
    );
    event ApprovalAddressAdded(address indexed user, address approval);
    event ApprovalAddressRevoked(address indexed user, address approval);
    event FullWithdrawalApproved(address indexed user);
    event CategorySet(
        address indexed user,
        string category,
        uint256 limit,
        uint256 period
    );
    event CategoryChangeRequested(
        address indexed user,
        string category,
        uint256 limit,
        uint256 period
    );
    event CategoryChangeApproved(address indexed user, string category);
    event DepositedTo(address indexed from, address indexed to, uint256 amount);

    // Two-phase system events
    event SetupCommitted(address indexed user, uint256 timestamp);
    event CategoryIncreaseProposed(address indexed user, string category, uint256 newLimit, uint256 executeAfter, bytes32 proposalId);
    event CategoryIncreaseExecuted(address indexed user, string category, uint256 newLimit, bytes32 proposalId);
    event CategoryDecreased(address indexed user, string category, uint256 newLimit);
    event CategoryDeleted(address indexed user, string category);

    // Bypass system events
    event BypassRequested(address indexed user, bytes32 indexed requestId, string skipPeriod, uint256 amount, address token, uint256 executeAfter);
    event BypassExecuted(address indexed user, bytes32 indexed requestId, string skipPeriod, uint256 amount, address token);
    event BypassCancelled(address indexed user, bytes32 indexed requestId);

    // Add this modifier to prevent reentrancy
    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    bool private locked;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        locked = false; // Initialize the `locked` state variable
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // --- Core Features ---

    // Original deposit function (backwards compatibility)
    function deposit(address token, uint256 amount) external payable {
        require(amount > 0, "Deposit must be greater than zero");
        if (token == address(0)) {
            // ETH deposit
            require(msg.value == amount, "Incorrect ETH amount");
        } else {
            // ERC20 deposit
            IERC20(token).transferFrom(msg.sender, address(this), amount);
        }
        users[msg.sender].tokenBalances[token] += amount;
        emit Deposited(msg.sender, token, amount);
    }

    function depositTo(address to) external payable {
        require(msg.value > 0, "Deposit must be greater than zero");
        require(to != address(0), "Invalid recipient address");

        users[to].tokenBalances[address(0)] += msg.value;
        emit DepositedTo(msg.sender, to, msg.value);
    }

    // Enhanced deposit function that works with proxy forwarding
    function deposit(address token, uint256 amount, address beneficiary) external payable {
        require(amount > 0, "Deposit must be greater than zero");

        address recipient = beneficiary != address(0) ? beneficiary : msg.sender;

        if (token == address(0)) {
            // ETH deposit
            require(msg.value == amount, "Incorrect ETH amount");
        } else {
            // ERC20 deposit
            IERC20(token).transferFrom(msg.sender, address(this), amount);
        }

        users[recipient].tokenBalances[token] += amount;
        emit Deposited(recipient, token, amount);
    }

    function addApprovalAddress(address _approval) external {
        require(_approval != address(0), "Invalid approval address");
        users[msg.sender].approvalAddresses[_approval] = true;
        emit ApprovalAddressAdded(msg.sender, _approval);
    }

    function revokeApprovalAddress(address _approval) external {
        require(users[msg.sender].approvalAddresses[_approval], "Not found");
        users[msg.sender].approvalAddresses[_approval] = false;
        emit ApprovalAddressRevoked(msg.sender, _approval);
    }

    function setApprovalAddress(address _approval) external {
        require(_approval != address(0), "Invalid approval address");
        users[msg.sender].approvalAddresses[_approval] = true;
        emit ApprovalAddressAdded(msg.sender, _approval);
    }

    function addTimePeriodLimit(
        string calldata periodName,
        uint256 limit,
        uint256 durationInSeconds
    ) external {
        UserData storage user = users[msg.sender];
        if (user.hasCommittedSetup) {
            require(_findPeriodLimit(periodName) == 0, "Use proposeLimitChange");
        }
        _addTimePeriodLimitInternal(periodName, limit, durationInSeconds);
    }

    function _addTimePeriodLimitInternal(
        string memory periodName,
        uint256 limit,
        uint256 durationInSeconds
    ) internal {
        require(bytes(periodName).length > 0 && limit > 0 && durationInSeconds >= 3600, "Invalid input");

        UserSpendingLimits storage userLimits = users[msg.sender].spendingLimits;

        // Check if period already exists
        if (userLimits.periodIndexes[periodName] > 0 ||
            (userLimits.periods.length > 0 &&
             keccak256(bytes(userLimits.periods[0].name)) == keccak256(bytes(periodName)))) {
            // Update existing period
            uint256 index = userLimits.periodIndexes[periodName];
            if (index == 0 && userLimits.periods.length > 0 &&
                keccak256(bytes(userLimits.periods[0].name)) == keccak256(bytes(periodName))) {
                index = 0;
            }

            TimePeriodLimit storage existing = userLimits.periods[index];
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

            // Update index mapping (0-based, but we store 1-based to distinguish from default)
            userLimits.periodIndexes[periodName] = userLimits.periods.length - 1;
            if (userLimits.periods.length == 1) {
                // First element special case
                userLimits.periodIndexes[periodName] = 0;
            }
            userLimits.periodCount++;
        }

        emit CategorySet(msg.sender, periodName, limit, durationInSeconds);
    }

    function setCommonPeriodLimits(
        uint256 dailyLimit,
        uint256 weeklyLimit,
        uint256 monthlyLimit
    ) external {
        require(dailyLimit > 0 || weeklyLimit > 0 || monthlyLimit > 0, "At least one limit must be set");

        UserData storage user = users[msg.sender];

        // If setup is committed, require using individual proposals for changes
        require(!user.hasCommittedSetup, "Use individual proposeLimitChange");

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

        // Add or update common periods - use internal function calls
        if (dailyLimit > 0) {
            _addTimePeriodLimitInternal("Daily", dailyLimit, 86400); // 1 day
        }
        if (weeklyLimit > 0) {
            _addTimePeriodLimitInternal("Weekly", weeklyLimit, 604800); // 7 days
        }
        if (monthlyLimit > 0) {
            _addTimePeriodLimitInternal("Monthly", monthlyLimit, 2592000); // 30 days
        }
    }

    function removeTimePeriodLimit(string calldata periodName) external {
        require(bytes(periodName).length > 0, "Period name cannot be empty");
        UserData storage user = users[msg.sender];
        require(!user.hasCommittedSetup, "Use proposeLimitRemoval");
        _removePeriodInternal(periodName);
    }

    // ========== TIMELOCK PROPOSAL SYSTEM ==========

    function proposeLimitChange(
        string calldata periodName,
        uint256 newLimit
    ) external returns (bytes32 proposalId) {
        require(bytes(periodName).length > 0 && newLimit > 0, "Invalid input");

        UserData storage user = users[msg.sender];
        require(user.hasCommittedSetup, "Setup must be committed for proposals");

        uint256 currentLimit = _findPeriodLimit(periodName);
        require(currentLimit > 0, "Period not found or inactive");

        bool isIncrease = newLimit > currentLimit;
        if (isIncrease) {
            _checkIncreaseLimit(user, newLimit - currentLimit);
        }

        proposalId = keccak256(abi.encodePacked(msg.sender, periodName, newLimit, block.timestamp));
        require(!user.proposals[proposalId].exists, "Proposal already exists");

        user.proposals[proposalId] = CategoryUpdateProposal({
            category: periodName,
            newLimit: newLimit,
            executeAfter: block.timestamp + (developmentMode ? 30 : 24 hours),
            executed: false,
            isIncrease: isIncrease,
            exists: true
        });

        emit CategoryIncreaseProposed(msg.sender, periodName, newLimit, user.proposals[proposalId].executeAfter, proposalId);
        return proposalId;
    }

    function proposeLimitRemoval(string calldata periodName) external returns (bytes32 proposalId) {
        require(bytes(periodName).length > 0, "Period name cannot be empty");
        UserData storage user = users[msg.sender];
        require(user.hasCommittedSetup, "Setup must be committed for proposals");
        require(_findPeriodLimit(periodName) > 0, "Period not found or inactive");

        proposalId = keccak256(abi.encodePacked(msg.sender, periodName, uint256(0), block.timestamp, "REMOVE"));
        require(!user.proposals[proposalId].exists, "Proposal already exists");

        user.proposals[proposalId] = CategoryUpdateProposal({
            category: periodName,
            newLimit: 0,
            executeAfter: block.timestamp,
            executed: false,
            isIncrease: false,
            exists: true
        });

        emit CategoryIncreaseProposed(msg.sender, periodName, 0, block.timestamp, proposalId);
        return proposalId;
    }

    function _findPeriodLimit(string memory periodName) internal view returns (uint256) {
        UserSpendingLimits storage userLimits = users[msg.sender].spendingLimits;
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (keccak256(bytes(userLimits.periods[i].name)) == keccak256(bytes(periodName)) &&
                userLimits.periods[i].active) {
                return userLimits.periods[i].limit;
            }
        }
        return 0;
    }

    function executeLimitProposal(bytes32 proposalId) external {
        UserData storage user = users[msg.sender];
        CategoryUpdateProposal storage proposal = user.proposals[proposalId];

        require(proposal.exists && !proposal.executed, "Invalid proposal");
        require(block.timestamp >= proposal.executeAfter, "Still in timelock");

        proposal.executed = true;

        if (proposal.newLimit == 0) {
            _removePeriodInternal(proposal.category);
            emit CategoryDeleted(msg.sender, proposal.category);
        } else {
            if (proposal.isIncrease) {
                uint256 currentLimit = _findPeriodLimit(proposal.category);
                _updateIncreaseTracking(user, proposal.newLimit - currentLimit);
            }
            _updateTimePeriodLimitInternal(proposal.category, proposal.newLimit);
            emit CategoryIncreaseExecuted(msg.sender, proposal.category, proposal.newLimit, proposalId);
        }
    }

    function cancelLimitProposal(bytes32 proposalId) external {
        UserData storage user = users[msg.sender];
        require(user.proposals[proposalId].exists && !user.proposals[proposalId].executed, "Invalid proposal");
        delete user.proposals[proposalId];
        emit BypassCancelled(msg.sender, proposalId);
    }

    function _updateTimePeriodLimitInternal(string memory periodName, uint256 newLimit) internal {
        UserSpendingLimits storage userLimits = users[msg.sender].spendingLimits;
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (keccak256(bytes(userLimits.periods[i].name)) == keccak256(bytes(periodName))) {
                userLimits.periods[i].limit = newLimit;
                return;
            }
        }
        revert("Period not found");
    }

    function _removePeriodInternal(string memory periodName) internal {
        UserSpendingLimits storage userLimits = users[msg.sender].spendingLimits;
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (keccak256(bytes(userLimits.periods[i].name)) == keccak256(bytes(periodName))) {
                userLimits.periods[i].active = false;
                userLimits.periodCount--;
                return;
            }
        }
    }

    // ========== BYPASS SYSTEM FUNCTIONS ==========

    function requestLimitBypass(
        uint256 amount,
        string calldata skipPeriod,
        address token
    ) external returns (bytes32 requestId) {
        require(amount > 0 && bytes(skipPeriod).length > 0, "Invalid input");

        UserData storage user = users[msg.sender];
        require(amount <= user.tokenBalances[token], "Insufficient balance");

        // Verify the period exists
        require(_findPeriodLimit(skipPeriod) > 0, "Period not found");

        // Generate unique request ID
        requestId = keccak256(abi.encodePacked(msg.sender, skipPeriod, amount, token, block.timestamp));
        require(!user.bypassRequests[requestId].exists, "Request exists");

        user.bypassRequests[requestId] = BypassRequest({
            amount: amount,
            skipPeriod: skipPeriod,
            token: token,
            executeAfter: block.timestamp + 24 hours,
            executed: false,
            exists: true
        });

        emit BypassRequested(msg.sender, requestId, skipPeriod, amount, token, block.timestamp + 24 hours);
        return requestId;
    }

    function executeBypassWithdrawal(bytes32 requestId) external nonReentrant {
        UserData storage user = users[msg.sender];
        BypassRequest storage request = user.bypassRequests[requestId];

        require(request.exists && !request.executed, "Invalid request");
        require(block.timestamp >= request.executeAfter, "Still in timelock");
        require(request.amount <= user.tokenBalances[request.token], "Insufficient balance");

        // Check limits excluding the bypassed period
        _checkLimitsWithBypass(user.spendingLimits, request.amount, request.skipPeriod);

        // Mark request as executed
        request.executed = true;

        // Update balances and spending for non-bypassed periods
        user.tokenBalances[request.token] -= request.amount;
        _updateSpendingWithBypass(user.spendingLimits, request.amount, request.skipPeriod);

        // Transfer funds
        if (request.token == address(0)) {
            // ETH withdrawal
            payable(msg.sender).transfer(request.amount);
        } else {
            // ERC20 withdrawal
            IERC20(request.token).transfer(msg.sender, request.amount);
        }

        emit BypassExecuted(msg.sender, requestId, request.skipPeriod, request.amount, request.token);
        emit Withdrawal(msg.sender, string(abi.encodePacked("Bypass-", request.skipPeriod)), request.amount, request.token);
    }

    function cancelBypassRequest(bytes32 requestId) external {
        UserData storage user = users[msg.sender];
        BypassRequest storage request = user.bypassRequests[requestId];

        require(request.exists && !request.executed, "Invalid request");

        // Delete the request
        delete user.bypassRequests[requestId];

        emit BypassCancelled(msg.sender, requestId);
    }

    function _checkLimitsWithBypass(
        UserSpendingLimits storage userLimits,
        uint256 amount,
        string memory skipPeriod
    ) internal {
        // Check and update each active time period except the skipped one
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

            // Check if this withdrawal would exceed the period limit
            require(period.spent + amount <= period.limit, "Exceeds limit");
        }
    }

    function _updateSpendingWithBypass(
        UserSpendingLimits storage userLimits,
        uint256 amount,
        string memory skipPeriod
    ) internal {
        // Update spending for all active periods except the skipped one
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            TimePeriodLimit storage period = userLimits.periods[i];

            if (!period.active) continue;

            // Skip the bypassed period
            if (keccak256(bytes(period.name)) == keccak256(bytes(skipPeriod))) continue;

            period.spent += amount;
        }
    }

    function getBypassRequest(bytes32 requestId) external view returns (
        uint256 amount,
        string memory skipPeriod,
        address token,
        uint256 executeAfter,
        bool executed,
        bool exists
    ) {
        BypassRequest storage request = users[msg.sender].bypassRequests[requestId];
        return (
            request.amount,
            request.skipPeriod,
            request.token,
            request.executeAfter,
            request.executed,
            request.exists
        );
    }


    function withdraw(
        uint256 amount,
        address token
    ) external nonReentrant {
        UserData storage user = users[msg.sender];
        require(amount > 0 && amount <= user.tokenBalances[token], "Invalid amount");

        // Check against all active time period limits
        _checkAllTimePeriodLimits(user.spendingLimits, amount);

        user.tokenBalances[token] -= amount;

        if (token == address(0)) {
            // ETH withdrawal
            payable(msg.sender).transfer(amount);
        } else {
            // ERC20 withdrawal
            IERC20(token).transfer(msg.sender, amount);
        }

        emit Withdrawal(msg.sender, "Time-Based", amount, token);
    }

    function _checkAllTimePeriodLimits(
        UserSpendingLimits storage userLimits,
        uint256 amount
    ) internal {
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

    function approveFullWithdrawal(address userAddress) external {
        require(users[userAddress].approvalAddresses[msg.sender], "Not authorized");
        users[userAddress].approvedForFullWithdrawal = true;
        emit FullWithdrawalApproved(userAddress);
    }

    function withdrawAll() external nonReentrant {
        UserData storage user = users[msg.sender];
        require(user.approvedForFullWithdrawal, "Not approved");

        uint256 amount = user.tokenBalances[address(0)];
        require(amount > 0, "No funds");

        user.tokenBalances[address(0)] = 0;
        user.approvedForFullWithdrawal = false;

        payable(msg.sender).transfer(amount);
        emit Withdrawal(msg.sender, "ALL", amount, address(0));
    }

    // --- View Helpers ---

    function getMyBalance() external view returns (uint256) {
        return users[msg.sender].tokenBalances[address(0)];
    }

    function getTokenBalance(
        address user,
        address token
    ) external view returns (uint256) {
        return users[user].tokenBalances[token];
    }

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
        require(msg.sender == user || users[user].approvalAddresses[msg.sender], "Not authorized");

        UserSpendingLimits storage userLimits = users[user].spendingLimits;
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
        require(msg.sender == user || users[user].approvalAddresses[msg.sender], "Not authorized");

        UserSpendingLimits storage userLimits = users[user].spendingLimits;

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


    function isApprovalAddress(
        address user,
        address _approval
    ) external view returns (bool) {
        return users[user].approvalAddresses[_approval];
    }

    // ========== TWO-PHASE SYSTEM FUNCTIONS ==========

    function commitInitialSetup() external {
        UserData storage user = users[msg.sender];
        require(!user.hasCommittedSetup, "Already committed");

        // Calculate maximum spending limit across all time periods
        // (Use the highest limit since periods are overlapping, not additive)
        uint256 totalValue = 0;
        UserSpendingLimits storage userLimits = user.spendingLimits;
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (userLimits.periods[i].active && userLimits.periods[i].limit > totalValue) {
                totalValue = userLimits.periods[i].limit;
            }
        }

        user.hasCommittedSetup = true;
        user.totalLockedValue = totalValue;
        user.commitTimestamp = block.timestamp;
        user.lastIncreaseTimestamp = block.timestamp;
        user.increasesInPeriod = 0;

        emit SetupCommitted(msg.sender, block.timestamp);
    }

    function isSetupCommitted() external view returns (bool) {
        return users[msg.sender].hasCommittedSetup;
    }

    function getSetupInfo() external view returns (
        bool committed,
        uint256 totalLockedValue,
        uint256 commitTimestamp,
        uint256 increasesInPeriod,
        uint256 lastIncreaseTimestamp
    ) {
        UserData storage user = users[msg.sender];
        return (
            user.hasCommittedSetup,
            user.totalLockedValue,
            user.commitTimestamp,
            user.increasesInPeriod,
            user.lastIncreaseTimestamp
        );
    }

    function recalculateTotalLockedValue() external {
        UserData storage user = users[msg.sender];
        require(user.hasCommittedSetup, "Setup not committed yet");

        // Recalculate using the new logic (maximum limit instead of sum)
        uint256 maxValue = 0;
        UserSpendingLimits storage userLimits = user.spendingLimits;
        for (uint256 i = 0; i < userLimits.periods.length; i++) {
            if (userLimits.periods[i].active && userLimits.periods[i].limit > maxValue) {
                maxValue = userLimits.periods[i].limit;
            }
        }

        user.totalLockedValue = maxValue;
        emit SetupCommitted(msg.sender, block.timestamp); // Reuse event for update notification
    }


    function _checkIncreaseLimit(UserData storage user, uint256 increaseAmount) internal view {
        // Reset period if 7 days have passed
        if (block.timestamp >= user.lastIncreaseTimestamp + 7 days) {
            // Period has reset, any increase is allowed up to 20%
            uint256 maxIncrease = user.totalLockedValue * 20 / 100; // 20% of total locked value
            require(increaseAmount <= maxIncrease, "Increase exceeds 20% of locked value");
        } else {
            // Within 7-day period, check cumulative increases
            uint256 maxIncrease = user.totalLockedValue * 20 / 100;
            require(user.increasesInPeriod + increaseAmount <= maxIncrease, "Exceeds 7-day increase limit");
        }
    }

    function _updateIncreaseTracking(UserData storage user, uint256 increaseAmount) internal {
        // Reset tracking if 7 days have passed
        if (block.timestamp >= user.lastIncreaseTimestamp + 7 days) {
            user.lastIncreaseTimestamp = block.timestamp;
            user.increasesInPeriod = increaseAmount;
        } else {
            user.increasesInPeriod += increaseAmount;
        }
    }

    function getProposal(bytes32 proposalId) external view returns (
        string memory category,
        uint256 newLimit,
        uint256 executeAfter,
        bool executed,
        bool isIncrease,
        bool exists
    ) {
        CategoryUpdateProposal storage proposal = users[msg.sender].proposals[proposalId];
        return (
            proposal.category,
            proposal.newLimit,
            proposal.executeAfter,
            proposal.executed,
            proposal.isIncrease,
            proposal.exists
        );
    }



    // Utility functions
    function getActivePeriodNames(address user) external view returns (string[] memory) {
        UserSpendingLimits storage userLimits = users[user].spendingLimits;

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
        return users[user].spendingLimits.periodCount;
    }

    // ========== USER PROXY FUNCTIONS ==========

    function getUserDepositAddress(address user) external view returns (address) {
        // Calculate deterministic address using CREATE2
        bytes32 salt = keccak256(abi.encodePacked(user));
        bytes32 bytecodeHash = keccak256(abi.encodePacked(
            type(UserProxy).creationCode,
            abi.encode(address(this), user)
        ));

        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            bytecodeHash
        )))));
    }

    function deployUserProxy() external returns (address proxy) {
        require(userProxies[msg.sender] == address(0), "Already deployed");

        bytes32 salt = keccak256(abi.encodePacked(msg.sender));

        // Deploy using CREATE2 for deterministic address
        proxy = address(new UserProxy{salt: salt}(address(this), msg.sender));

        userProxies[msg.sender] = proxy;
        emit ProxyDeployed(msg.sender, proxy);

        return proxy;
    }

    function isProxyDeployed(address user) external view returns (bool) {
        return userProxies[user] != address(0);
    }

    function getUserProxy(address user) external view returns (address) {
        return userProxies[user];
    }

    fallback() external payable {
        revert("Unsupported");
    }
}
