pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

    struct UserData {
        mapping(address => uint256) tokenBalances; // Token address => balance
        mapping(address => bool) approvalAddresses;
        bool approvedForFullWithdrawal;
        mapping(string => WithdrawalType) withdrawalTypes;
        mapping(string => PendingCategoryChange) pendingChanges;
    }

    mapping(address => UserData) private users;

    event Deposited(
        address indexed user,
        address indexed token,
        uint256 amount
    );
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

    fallback() external payable {
        revert("Unsupported operation");
    }
}
