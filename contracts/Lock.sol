pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./UserProxy.sol";

contract Savings is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    struct WithdrawalType {
        uint256 limit; // Token-specific limit
        uint256 period;
        uint256 lastReset;
        uint256 spentInPeriod; // Token-specific spent amount
        bool exists;
    }

    struct PendingCategoryChange {
        string category;
        uint256 newLimit; // Token-specific limit
        uint256 newPeriod;
        bool pending;
    }

    struct CategoryUpdateProposal {
        string category;
        uint256 newLimit;
        uint256 executeAfter;    // Timestamp when proposal can be executed
        bool executed;
        bool isIncrease;         // Track if increase or decrease
        bool exists;            // Track if proposal exists
    }

    struct UserData {
        mapping(address => uint256) tokenBalances; // Token address => balance
        mapping(address => bool) approvalAddresses;
        bool approvedForFullWithdrawal;
        mapping(string => WithdrawalType) withdrawalTypes;
        mapping(string => PendingCategoryChange) pendingChanges;
        string[] categoryNames; // Track all category names for enumeration

        // Two-phase system fields
        bool hasCommittedSetup;          // Track if user committed initial setup
        uint256 totalLockedValue;        // Total value across all categories
        uint256 lastIncreaseTimestamp;   // Track increase period start
        uint256 increasesInPeriod;       // Amount increased in current 7-day period
        uint256 commitTimestamp;         // When setup was committed
        mapping(bytes32 => CategoryUpdateProposal) proposals; // Pending proposals
    }

    mapping(address => UserData) private users;
    mapping(address => address) private userProxies; // user => proxy address

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
        require(
            users[msg.sender].approvalAddresses[_approval],
            "Approval address not found"
        );
        users[msg.sender].approvalAddresses[_approval] = false;
        emit ApprovalAddressRevoked(msg.sender, _approval);
    }

    function setApprovalAddress(address _approval) external {
        require(_approval != address(0), "Invalid approval address");
        users[msg.sender].approvalAddresses[_approval] = true;
        emit ApprovalAddressAdded(msg.sender, _approval);
    }

    function setWithdrawalCategory(
        string calldata category,
        uint256 limit,
        uint256 period
    ) external {
        require(bytes(category).length > 0, "Category cannot be empty");
        require(limit > 0 && period > 0, "Limit and period must be positive");

        WithdrawalType storage w = users[msg.sender].withdrawalTypes[category];
        require(!w.exists, "Category already exists");

        // Add category name to the list for enumeration
        users[msg.sender].categoryNames.push(category);

        w.limit = limit;
        w.period = period;
        w.lastReset = block.timestamp;
        w.spentInPeriod = 0;
        w.exists = true;

        emit CategorySet(msg.sender, category, limit, period);
    }

    function requestCategoryChange(
        string calldata category,
        uint256 newLimit,
        uint256 newPeriod
    ) external {
        require(
            newLimit > 0 && newPeriod > 0,
            "Limit and period must be positive"
        );
        require(
            users[msg.sender].withdrawalTypes[category].exists,
            "Category doesn't exist"
        );

        users[msg.sender].pendingChanges[category] = PendingCategoryChange({
            category: category,
            newLimit: newLimit,
            newPeriod: newPeriod,
            pending: true
        });

        emit CategoryChangeRequested(msg.sender, category, newLimit, newPeriod);
    }

    function approveCategoryChange(
        address user,
        string calldata category
    ) external {
        UserData storage u = users[user];
        require(u.approvalAddresses[msg.sender], "Not authorized approver");

        PendingCategoryChange storage pending = u.pendingChanges[category];
        require(pending.pending, "No change requested");

        WithdrawalType storage w = u.withdrawalTypes[category];
        w.limit = pending.newLimit;
        w.period = pending.newPeriod;
        // keep existing spent/lastReset
        pending.pending = false;

        emit CategoryChangeApproved(user, category);
    }

    function withdraw(
        string calldata category,
        uint256 amount,
        address token
    ) external nonReentrant {
        UserData storage user = users[msg.sender];
        WithdrawalType storage w = user.withdrawalTypes[category];

        require(w.exists, "Category not found");
        require(amount <= user.tokenBalances[token], "Insufficient balance");

        if (block.timestamp >= w.lastReset + w.period) {
            w.lastReset = block.timestamp;
            w.spentInPeriod = 0;
        }

        require(w.spentInPeriod + amount <= w.limit, "Exceeds category limit");

        w.spentInPeriod += amount;
        user.tokenBalances[token] -= amount;

        if (token == address(0)) {
            // ETH withdrawal
            payable(msg.sender).transfer(amount);
        } else {
            // ERC20 withdrawal
            IERC20(token).transfer(msg.sender, amount);
        }

        emit Withdrawal(msg.sender, category, amount, token);
    }

    function approveFullWithdrawal(address userAddress) external {
        require(
            users[userAddress].approvalAddresses[msg.sender],
            "Not authorized"
        );
        users[userAddress].approvedForFullWithdrawal = true;
        emit FullWithdrawalApproved(userAddress);
    }

    function withdrawAll() external nonReentrant {
        UserData storage user = users[msg.sender];
        require(
            user.approvedForFullWithdrawal,
            "Not approved for full withdrawal"
        );

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

    function getWithdrawalCategory(
        address user,
        string calldata category
    )
        external
        view
        returns (
            uint256 limit,
            uint256 period,
            uint256 lastReset,
            uint256 spentInPeriod,
            bool exists
        )
    {
        require(
            msg.sender == user || users[user].approvalAddresses[msg.sender],
            "Not authorized"
        );
        WithdrawalType storage w = users[user].withdrawalTypes[category];
        return (w.limit, w.period, w.lastReset, w.spentInPeriod, w.exists);
    }

    function getPendingCategoryChange(
        address user,
        string calldata category
    )
        external
        view
        returns (uint256 newLimit, uint256 newPeriod, bool pending)
    {
        PendingCategoryChange storage p = users[user].pendingChanges[category];
        return (p.newLimit, p.newPeriod, p.pending);
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
        require(!user.hasCommittedSetup, "Setup already committed");

        // Calculate total locked value across all categories
        uint256 totalValue = 0;
        for (uint256 i = 0; i < user.categoryNames.length; i++) {
            WithdrawalType storage category = user.withdrawalTypes[user.categoryNames[i]];
            totalValue += category.limit;
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

    function proposeCategoryIncrease(
        string calldata category,
        uint256 newLimit,
        uint256 timelockHours
    ) external returns (bytes32 proposalId) {
        UserData storage user = users[msg.sender];
        require(user.hasCommittedSetup, "Setup not committed");
        require(timelockHours >= 24 && timelockHours <= 72, "Timelock must be 24-72 hours");

        WithdrawalType storage existingCategory = user.withdrawalTypes[category];
        require(existingCategory.exists, "Category does not exist");
        require(newLimit > existingCategory.limit, "New limit must be higher");

        // Check 7-day increase limits
        _checkIncreaseLimit(user, newLimit - existingCategory.limit);

        // Generate proposal ID
        proposalId = keccak256(abi.encodePacked(msg.sender, category, newLimit, block.timestamp));

        CategoryUpdateProposal storage proposal = user.proposals[proposalId];
        require(!proposal.exists, "Proposal already exists");

        proposal.category = category;
        proposal.newLimit = newLimit;
        proposal.executeAfter = block.timestamp + (timelockHours * 1 hours);
        proposal.executed = false;
        proposal.isIncrease = true;
        proposal.exists = true;

        emit CategoryIncreaseProposed(msg.sender, category, newLimit, proposal.executeAfter, proposalId);
        return proposalId;
    }

    function executeCategoryIncrease(bytes32 proposalId) external {
        UserData storage user = users[msg.sender];
        CategoryUpdateProposal storage proposal = user.proposals[proposalId];

        require(proposal.exists, "Proposal does not exist");
        require(!proposal.executed, "Proposal already executed");
        require(block.timestamp >= proposal.executeAfter, "Timelock not expired");
        require(proposal.isIncrease, "Not an increase proposal");

        WithdrawalType storage category = user.withdrawalTypes[proposal.category];
        require(category.exists, "Category no longer exists");

        uint256 increaseAmount = proposal.newLimit - category.limit;

        // Re-check 7-day limits at execution time
        _checkIncreaseLimit(user, increaseAmount);

        // Update category limit
        category.limit = proposal.newLimit;

        // Update tracking
        user.totalLockedValue += increaseAmount;
        _updateIncreaseTracking(user, increaseAmount);

        // Mark proposal as executed
        proposal.executed = true;

        emit CategoryIncreaseExecuted(msg.sender, proposal.category, proposal.newLimit, proposalId);
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

    function decreaseCategoryLimit(
        string calldata category,
        uint256 newLimit
    ) external {
        UserData storage user = users[msg.sender];
        require(user.hasCommittedSetup, "Setup not committed");

        WithdrawalType storage categoryData = user.withdrawalTypes[category];
        require(categoryData.exists, "Category does not exist");
        require(newLimit < categoryData.limit, "New limit must be lower");
        require(newLimit > 0, "Limit must be greater than zero");

        uint256 decreaseAmount = categoryData.limit - newLimit;

        // Update category limit (immediate)
        categoryData.limit = newLimit;

        // Update total locked value
        user.totalLockedValue -= decreaseAmount;

        emit CategoryDecreased(msg.sender, category, newLimit);
    }

    function deleteCategory(string calldata category) external {
        UserData storage user = users[msg.sender];
        require(user.hasCommittedSetup, "Setup not committed");

        WithdrawalType storage categoryData = user.withdrawalTypes[category];
        require(categoryData.exists, "Category does not exist");

        // Store the limit before deletion for total value update
        uint256 categoryLimit = categoryData.limit;

        // Mark category as deleted
        categoryData.exists = false;
        categoryData.limit = 0;
        categoryData.period = 0;
        categoryData.lastReset = 0;
        categoryData.spentInPeriod = 0;

        // Remove from category names array
        _removeCategoryFromArray(user, category);

        // Update total locked value
        user.totalLockedValue -= categoryLimit;

        emit CategoryDeleted(msg.sender, category);
    }

    function _removeCategoryFromArray(UserData storage user, string memory categoryToRemove) internal {
        uint256 length = user.categoryNames.length;
        for (uint256 i = 0; i < length; i++) {
            if (keccak256(bytes(user.categoryNames[i])) == keccak256(bytes(categoryToRemove))) {
                // Move the last element to this position and pop
                user.categoryNames[i] = user.categoryNames[length - 1];
                user.categoryNames.pop();
                break;
            }
        }
    }

    // Override setWithdrawalCategory to respect committed setup
    function setWithdrawalCategoryV2(
        string calldata category,
        uint256 limit,
        uint256 period
    ) external {
        UserData storage user = users[msg.sender];

        if (user.hasCommittedSetup) {
            revert("Use proposeCategoryIncrease for increases or decreaseCategoryLimit for decreases after setup is committed");
        }

        // Call original logic for setup phase
        require(bytes(category).length > 0, "Category cannot be empty");
        require(limit > 0 && period > 0, "Limit and period must be positive");

        WithdrawalType storage w = user.withdrawalTypes[category];
        require(!w.exists, "Category already exists");

        // Add category name to the list for enumeration
        user.categoryNames.push(category);

        w.limit = limit;
        w.period = period;
        w.lastReset = block.timestamp;
        w.spentInPeriod = 0;
        w.exists = true;

        emit CategorySet(msg.sender, category, limit, period);
    }

    // Utility functions
    function getUserCategories(address user) external view returns (string[] memory) {
        return users[user].categoryNames;
    }

    function getCategoryCount(address user) external view returns (uint256) {
        return users[user].categoryNames.length;
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
        require(userProxies[msg.sender] == address(0), "Proxy already deployed");

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
        revert("Unsupported operation");
    }
}
