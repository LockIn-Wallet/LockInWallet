// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./UserProxy.sol";
import "./SavingsInterfaces.sol";

contract SavingsCore is Initializable, UUPSUpgradeable, OwnableUpgradeable, ISavingsCore {
    // User data storage
    mapping(address => mapping(address => uint256)) private userTokenBalances; // user => token => balance
    mapping(address => address) private userProxies; // user => proxy address

    // Module management
    mapping(bytes32 => address) private modules;
    mapping(address => bool) private authorizedModules;

    // Development mode for testing - set to false for production
    bool public developmentMode;

    // Add this modifier to prevent reentrancy
    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    bool private locked;

    modifier onlyAuthorizedModule() {
        require(authorizedModules[msg.sender] || msg.sender == address(this), "Not authorized module");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        locked = false;
        developmentMode = true; // Set to false for production
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // ========== MODULE MANAGEMENT ==========

    function registerModule(bytes32 moduleId, address moduleAddress) external onlyOwner {
        require(moduleAddress != address(0), "Invalid module address");
        modules[moduleId] = moduleAddress;
        authorizedModules[moduleAddress] = true;
    }

    function unregisterModule(bytes32 moduleId) external onlyOwner {
        address moduleAddress = modules[moduleId];
        if (moduleAddress != address(0)) {
            authorizedModules[moduleAddress] = false;
            delete modules[moduleId];
        }
    }

    function getModule(bytes32 moduleId) external view returns (address) {
        return modules[moduleId];
    }

    function isAuthorizedModule(address moduleAddress) external view returns (bool) {
        return authorizedModules[moduleAddress];
    }

    function getDevelopmentMode() external view returns (bool) {
        return developmentMode;
    }

    function setDevelopmentMode(bool _developmentMode) external onlyOwner {
        developmentMode = _developmentMode;
    }

    // ========== CORE DEPOSIT/WITHDRAW FUNCTIONALITY ==========

    function deposit(address token, uint256 amount) external payable {
        require(amount > 0, "Deposit must be greater than zero");
        if (token == address(0)) {
            // ETH deposit
            require(msg.value == amount, "Incorrect ETH amount");
        } else {
            // ERC20 deposit
            IERC20(token).transferFrom(msg.sender, address(this), amount);
        }
        userTokenBalances[msg.sender][token] += amount;
        emit Deposited(msg.sender, token, amount);
    }

    function depositTo(address to) external payable {
        require(msg.value > 0, "Deposit must be greater than zero");
        require(to != address(0), "Invalid recipient address");

        userTokenBalances[to][address(0)] += msg.value;
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

        userTokenBalances[recipient][token] += amount;
        emit Deposited(recipient, token, amount);
    }

    function withdraw(address user, uint256 amount, address token) external onlyAuthorizedModule {
        require(amount > 0 && amount <= userTokenBalances[user][token], "Invalid amount");

        userTokenBalances[user][token] -= amount;

        if (token == address(0)) {
            // ETH withdrawal
            payable(user).transfer(amount);
        } else {
            // ERC20 withdrawal
            IERC20(token).transfer(user, amount);
        }

        emit Withdrawal(user, "Module", amount, token);
    }

    function withdrawAll(address user) external onlyAuthorizedModule {
        // Get approval module
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        require(address(approvalModule) != address(0), "Approval module not found");

        require(approvalModule.isApprovedForFullWithdrawal(user), "Not approved");

        uint256 amount = userTokenBalances[user][address(0)];
        require(amount > 0, "No funds");

        userTokenBalances[user][address(0)] = 0;
        approvalModule.resetFullWithdrawalApproval(user);

        payable(user).transfer(amount);
        emit Withdrawal(user, "ALL", amount, address(0));
    }

    // ========== BALANCE MANAGEMENT ==========

    function getTokenBalance(address user, address token) external view returns (uint256) {
        return userTokenBalances[user][token];
    }

    function updateTokenBalance(address user, address token, uint256 amount, bool increase) external onlyAuthorizedModule {
        if (increase) {
            userTokenBalances[user][token] += amount;
        } else {
            require(userTokenBalances[user][token] >= amount, "Insufficient balance");
            userTokenBalances[user][token] -= amount;
        }
    }

    function getMyBalance() external view returns (uint256) {
        return userTokenBalances[msg.sender][address(0)];
    }

    // ========== DELEGATION TO MODULES ==========

    // Time Period Limits Module Functions
    function addTimePeriodLimit(
        string calldata periodName,
        uint256 limit,
        uint256 durationInSeconds
    ) external {
        ITimePeriodLimitsModule limitsModule = ITimePeriodLimitsModule(modules[ModuleIds.TIME_PERIOD_LIMITS]);
        require(address(limitsModule) != address(0), "Limits module not found");

        // Check if setup is committed via proposal module
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        if (address(proposalModule) != address(0) && proposalModule.isSetupCommitted(msg.sender)) {
            require(limitsModule.findPeriodLimit(msg.sender, periodName) == 0, "Use proposeLimitChange");
        }

        limitsModule.addTimePeriodLimit(msg.sender, periodName, limit, durationInSeconds);
    }

    function setCommonPeriodLimits(
        uint256 dailyLimit,
        uint256 weeklyLimit,
        uint256 monthlyLimit
    ) external {
        require(dailyLimit > 0 || weeklyLimit > 0 || monthlyLimit > 0, "At least one limit must be set");

        ITimePeriodLimitsModule limitsModule = ITimePeriodLimitsModule(modules[ModuleIds.TIME_PERIOD_LIMITS]);
        require(address(limitsModule) != address(0), "Limits module not found");

        // Check if setup is committed
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        if (address(proposalModule) != address(0)) {
            require(!proposalModule.isSetupCommitted(msg.sender), "Use individual proposeLimitChange");
        }

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

        // Add or update common periods
        if (dailyLimit > 0) {
            limitsModule.addTimePeriodLimit(msg.sender, "Daily", dailyLimit, 86400); // 1 day
        }
        if (weeklyLimit > 0) {
            limitsModule.addTimePeriodLimit(msg.sender, "Weekly", weeklyLimit, 604800); // 7 days
        }
        if (monthlyLimit > 0) {
            limitsModule.addTimePeriodLimit(msg.sender, "Monthly", monthlyLimit, 2592000); // 30 days
        }
    }

    function removeTimePeriodLimit(string calldata periodName) external {
        ITimePeriodLimitsModule limitsModule = ITimePeriodLimitsModule(modules[ModuleIds.TIME_PERIOD_LIMITS]);
        require(address(limitsModule) != address(0), "Limits module not found");

        // Check if setup is committed
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        if (address(proposalModule) != address(0)) {
            require(!proposalModule.isSetupCommitted(msg.sender), "Use proposeLimitRemoval");
        }

        limitsModule.removeTimePeriodLimit(msg.sender, periodName);
    }

    function withdraw(uint256 amount, address token) external nonReentrant {
        require(amount > 0 && amount <= userTokenBalances[msg.sender][token], "Invalid amount");

        // Check against all active time period limits
        ITimePeriodLimitsModule limitsModule = ITimePeriodLimitsModule(modules[ModuleIds.TIME_PERIOD_LIMITS]);
        if (address(limitsModule) != address(0)) {
            limitsModule.checkAllTimePeriodLimits(msg.sender, amount);
        }

        userTokenBalances[msg.sender][token] -= amount;

        if (token == address(0)) {
            // ETH withdrawal
            payable(msg.sender).transfer(amount);
        } else {
            // ERC20 withdrawal
            IERC20(token).transfer(msg.sender, amount);
        }

        emit Withdrawal(msg.sender, "Time-Based", amount, token);
    }

    // Proposal System Module Functions
    function proposeLimitChange(string calldata periodName, uint256 newLimit) external returns (bytes32 proposalId) {
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        require(address(proposalModule) != address(0), "Proposal module not found");
        return proposalModule.proposeLimitChange(msg.sender, periodName, newLimit);
    }

    function proposeLimitRemoval(string calldata periodName) external returns (bytes32 proposalId) {
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        require(address(proposalModule) != address(0), "Proposal module not found");
        return proposalModule.proposeLimitRemoval(msg.sender, periodName);
    }

    function executeLimitProposal(bytes32 proposalId) external {
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        require(address(proposalModule) != address(0), "Proposal module not found");
        proposalModule.executeLimitProposal(msg.sender, proposalId);
    }

    function cancelLimitProposal(bytes32 proposalId) external {
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        require(address(proposalModule) != address(0), "Proposal module not found");
        proposalModule.cancelLimitProposal(msg.sender, proposalId);
    }

    function commitInitialSetup() external {
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        require(address(proposalModule) != address(0), "Proposal module not found");
        proposalModule.commitInitialSetup(msg.sender);
    }

    function recalculateTotalLockedValue() external {
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        require(address(proposalModule) != address(0), "Proposal module not found");
        proposalModule.recalculateTotalLockedValue(msg.sender);
    }

    // Bypass System Module Functions
    function requestLimitBypass(
        uint256 amount,
        string calldata skipPeriod,
        address token
    ) external returns (bytes32 requestId) {
        IBypassSystemModule bypassModule = IBypassSystemModule(modules[ModuleIds.BYPASS_SYSTEM]);
        require(address(bypassModule) != address(0), "Bypass module not found");
        return bypassModule.requestLimitBypass(msg.sender, amount, skipPeriod, token);
    }

    function executeBypassWithdrawal(bytes32 requestId) external {
        IBypassSystemModule bypassModule = IBypassSystemModule(modules[ModuleIds.BYPASS_SYSTEM]);
        require(address(bypassModule) != address(0), "Bypass module not found");
        bypassModule.executeBypassWithdrawal(msg.sender, requestId);
    }

    function cancelBypassRequest(bytes32 requestId) external {
        IBypassSystemModule bypassModule = IBypassSystemModule(modules[ModuleIds.BYPASS_SYSTEM]);
        require(address(bypassModule) != address(0), "Bypass module not found");
        bypassModule.cancelBypassRequest(msg.sender, requestId);
    }

    // Approval System Module Functions
    function addApprovalAddress(address _approval) external {
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        require(address(approvalModule) != address(0), "Approval module not found");
        approvalModule.addApprovalAddress(msg.sender, _approval);
    }

    function revokeApprovalAddress(address _approval) external {
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        require(address(approvalModule) != address(0), "Approval module not found");
        approvalModule.revokeApprovalAddress(msg.sender, _approval);
    }

    function setApprovalAddress(address _approval) external {
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        require(address(approvalModule) != address(0), "Approval module not found");
        approvalModule.addApprovalAddress(msg.sender, _approval);
    }

    function approveFullWithdrawal(address userAddress) external {
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        require(address(approvalModule) != address(0), "Approval module not found");
        approvalModule.approveFullWithdrawal(userAddress, msg.sender);
    }

    function withdrawAll() external nonReentrant {
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        require(address(approvalModule) != address(0), "Approval module not found");

        require(approvalModule.isApprovedForFullWithdrawal(msg.sender), "Not approved");

        uint256 amount = userTokenBalances[msg.sender][address(0)];
        require(amount > 0, "No funds");

        userTokenBalances[msg.sender][address(0)] = 0;
        approvalModule.resetFullWithdrawalApproval(msg.sender);

        payable(msg.sender).transfer(amount);
        emit Withdrawal(msg.sender, "ALL", amount, address(0));
    }

    // ========== VIEW FUNCTIONS (DELEGATED) ==========

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
        ITimePeriodLimitsModule limitsModule = ITimePeriodLimitsModule(modules[ModuleIds.TIME_PERIOD_LIMITS]);
        if (address(limitsModule) == address(0)) {
            // Return empty arrays if module not found
            return (new string[](0), new uint256[](0), new uint256[](0), new uint256[](0), new uint256[](0), new bool[](0));
        }

        // Check authorization
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        require(
            msg.sender == user ||
            (address(approvalModule) != address(0) && approvalModule.isApprovalAddress(user, msg.sender)),
            "Not authorized"
        );

        return limitsModule.getUserSpendingLimits(user);
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
        ITimePeriodLimitsModule limitsModule = ITimePeriodLimitsModule(modules[ModuleIds.TIME_PERIOD_LIMITS]);
        if (address(limitsModule) == address(0)) {
            return (0, 0, 0, 0, 0, false, false);
        }

        // Check authorization
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        require(
            msg.sender == user ||
            (address(approvalModule) != address(0) && approvalModule.isApprovalAddress(user, msg.sender)),
            "Not authorized"
        );

        return limitsModule.getTimePeriodLimit(user, periodName);
    }

    function isApprovalAddress(address user, address _approval) external view returns (bool) {
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        if (address(approvalModule) == address(0)) return false;
        return approvalModule.isApprovalAddress(user, _approval);
    }

    function isSetupCommitted() external view returns (bool) {
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        if (address(proposalModule) == address(0)) return false;
        return proposalModule.isSetupCommitted(msg.sender);
    }

    function getSetupInfo() external view returns (
        bool committed,
        uint256 totalLockedValue,
        uint256 commitTimestamp,
        uint256 increasesInPeriod,
        uint256 lastIncreaseTimestamp
    ) {
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        if (address(proposalModule) == address(0)) {
            return (false, 0, 0, 0, 0);
        }
        return proposalModule.getSetupInfo(msg.sender);
    }

    function getProposal(bytes32 proposalId) external view returns (
        string memory category,
        uint256 newLimit,
        uint256 executeAfter,
        bool executed,
        bool isIncrease,
        bool exists
    ) {
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        if (address(proposalModule) == address(0)) {
            return ("", 0, 0, false, false, false);
        }
        return proposalModule.getProposal(msg.sender, proposalId);
    }

    function getBypassRequest(bytes32 requestId) external view returns (
        uint256 amount,
        string memory skipPeriod,
        address token,
        uint256 executeAfter,
        bool executed,
        bool exists
    ) {
        IBypassSystemModule bypassModule = IBypassSystemModule(modules[ModuleIds.BYPASS_SYSTEM]);
        if (address(bypassModule) == address(0)) {
            return (0, "", address(0), 0, false, false);
        }
        return bypassModule.getBypassRequest(msg.sender, requestId);
    }

    function getActivePeriodNames(address user) external view returns (string[] memory) {
        ITimePeriodLimitsModule limitsModule = ITimePeriodLimitsModule(modules[ModuleIds.TIME_PERIOD_LIMITS]);
        if (address(limitsModule) == address(0)) {
            return new string[](0);
        }
        return limitsModule.getActivePeriodNames(user);
    }

    function getActivePeriodCount(address user) external view returns (uint256) {
        ITimePeriodLimitsModule limitsModule = ITimePeriodLimitsModule(modules[ModuleIds.TIME_PERIOD_LIMITS]);
        if (address(limitsModule) == address(0)) {
            return 0;
        }
        return limitsModule.getActivePeriodCount(user);
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

    // ========== EVENTS ==========

    event ProxyDeployed(address indexed user, address indexed proxy);

    // ========== FALLBACK ==========

    fallback() external payable {
        revert("Unsupported");
    }

    // Allow contract to receive ETH for withdrawals
    receive() external payable {
        // Accept ETH - could be from module operations
    }
}