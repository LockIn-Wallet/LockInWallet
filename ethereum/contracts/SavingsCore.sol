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

    // ========== ESSENTIAL CORE FUNCTIONS ==========

    // Core withdraw function with time period limits check
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

    // Core withdrawTo function with approval check
    function withdrawTo(uint256 amount, address token, address destination) external nonReentrant {
        require(amount > 0 && amount <= userTokenBalances[msg.sender][token], "Invalid amount");
        require(destination != address(0), "Invalid destination address");

        // Get approval module to validate withdrawal destination
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        require(address(approvalModule) != address(0), "Approval module not found");

        // Validate destination is either user themselves or an approved withdrawal address
        require(
            destination == msg.sender ||
            approvalModule.isValidWithdrawalDestination(msg.sender, destination),
            "Destination not approved"
        );

        // Check against all active time period limits
        ITimePeriodLimitsModule limitsModule = ITimePeriodLimitsModule(modules[ModuleIds.TIME_PERIOD_LIMITS]);
        if (address(limitsModule) != address(0)) {
            limitsModule.checkAllTimePeriodLimits(msg.sender, amount);
        }

        userTokenBalances[msg.sender][token] -= amount;

        if (token == address(0)) {
            // ETH withdrawal
            payable(destination).transfer(amount);
        } else {
            // ERC20 withdrawal
            IERC20(token).transfer(destination, amount);
        }

        emit Withdrawal(msg.sender, "To-Address", amount, token);
    }

    // Core withdrawAll function with approval check
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

    // ========== ESSENTIAL DELEGATED FUNCTIONS ==========

    // Essential withdrawal address functions (needed for frontend)
    function getUserWithdrawalAddresses() external view returns (
        string[] memory titles,
        address[] memory destinations,
        uint256[] memory timestamps
    ) {
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        if (address(approvalModule) == address(0)) {
            return (new string[](0), new address[](0), new uint256[](0));
        }
        return approvalModule.getUserWithdrawalAddresses(msg.sender);
    }

    function getUserPendingWithdrawalRequests() external view returns (
        bytes32[] memory requestIds,
        string[] memory titles,
        address[] memory destinations,
        uint256[] memory executeAfters
    ) {
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        if (address(approvalModule) == address(0)) {
            return (new bytes32[](0), new string[](0), new address[](0), new uint256[](0));
        }
        return approvalModule.getUserPendingWithdrawalRequests(msg.sender);
    }

    function requestWithdrawalAddress(
        string calldata title,
        address destination
    ) external returns (bytes32 requestId) {
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        require(address(approvalModule) != address(0), "Approval module not found");
        return approvalModule.requestWithdrawalAddress(msg.sender, title, destination);
    }

    // Essential view functions
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

    function isApprovalAddress(address user, address _approval) external view returns (bool) {
        IApprovalSystemModule approvalModule = IApprovalSystemModule(modules[ModuleIds.APPROVAL_SYSTEM]);
        if (address(approvalModule) == address(0)) return false;
        return approvalModule.isApprovalAddress(user, _approval);
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

    // ========== SPENDING LIMITS SETUP FUNCTIONS ==========

    function setCommonPeriodLimits(
        uint256 dailyLimit,
        uint256 weeklyLimit,
        uint256 monthlyLimit
    ) external {
        ITimePeriodLimitsModule limitsModule = ITimePeriodLimitsModule(modules[ModuleIds.TIME_PERIOD_LIMITS]);
        require(address(limitsModule) != address(0), "TimePeriodLimitsModule not registered");
        limitsModule.setCommonPeriodLimits(msg.sender, dailyLimit, weeklyLimit, monthlyLimit);
    }

    function commitInitialSetup() external {
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        require(address(proposalModule) != address(0), "ProposalSystemModule not registered");
        proposalModule.commitInitialSetup(msg.sender);
    }

    /**
     * @dev Unified method that sets spending limits and commits setup in a single transaction
     * @param dailyLimit Daily spending limit (0 to disable)
     * @param weeklyLimit Weekly spending limit (0 to disable)
     * @param monthlyLimit Monthly spending limit (0 to disable)
     */
    function commitSetup(
        uint256 dailyLimit,
        uint256 weeklyLimit,
        uint256 monthlyLimit
    ) external {
        address user = msg.sender; // Store the original caller

        // First set the spending limits - use internal calls to preserve user context
        ITimePeriodLimitsModule limitsModule = ITimePeriodLimitsModule(modules[ModuleIds.TIME_PERIOD_LIMITS]);
        require(address(limitsModule) != address(0), "TimePeriodLimitsModule not registered");
        limitsModule.setCommonPeriodLimits(user, dailyLimit, weeklyLimit, monthlyLimit);

        // Then commit the setup
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        require(address(proposalModule) != address(0), "ProposalSystemModule not registered");
        proposalModule.commitInitialSetup(user);
    }

    function recalculateTotalLockedValue() external {
        IProposalSystemModule proposalModule = IProposalSystemModule(modules[ModuleIds.PROPOSAL_SYSTEM]);
        require(address(proposalModule) != address(0), "ProposalSystemModule not registered");
        proposalModule.recalculateTotalLockedValue(msg.sender);
    }

    // ========== BYPASS SYSTEM FUNCTIONS ==========

    function requestLimitBypass(
        uint256 amount,
        string calldata skipPeriod,
        address token
    ) external returns (bytes32 requestId) {
        IBypassSystemModule bypassModule = IBypassSystemModule(modules[ModuleIds.BYPASS_SYSTEM]);
        require(address(bypassModule) != address(0), "BypassSystemModule not registered");
        return bypassModule.requestLimitBypass(msg.sender, amount, skipPeriod, token);
    }

    function executeBypassWithdrawal(bytes32 requestId) external {
        IBypassSystemModule bypassModule = IBypassSystemModule(modules[ModuleIds.BYPASS_SYSTEM]);
        require(address(bypassModule) != address(0), "BypassSystemModule not registered");
        bypassModule.executeBypassWithdrawal(msg.sender, requestId);
    }

    function getUserActiveBypassRequests() external view returns (
        bytes32[] memory requestIds,
        uint256[] memory amounts,
        string[] memory skipPeriods,
        address[] memory tokens,
        uint256[] memory executeAfters
    ) {
        IBypassSystemModule bypassModule = IBypassSystemModule(modules[ModuleIds.BYPASS_SYSTEM]);
        if (address(bypassModule) == address(0)) {
            return (new bytes32[](0), new uint256[](0), new string[](0), new address[](0), new uint256[](0));
        }
        return bypassModule.getUserActiveBypassRequests(msg.sender);
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
        require(address(bypassModule) != address(0), "BypassSystemModule not registered");
        return bypassModule.getBypassRequest(msg.sender, requestId);
    }

    function cancelBypassRequest(bytes32 requestId) external {
        IBypassSystemModule bypassModule = IBypassSystemModule(modules[ModuleIds.BYPASS_SYSTEM]);
        require(address(bypassModule) != address(0), "BypassSystemModule not registered");
        bypassModule.cancelBypassRequest(msg.sender, requestId);
    }

    // ========== MODULE SETUP FUNCTIONS (OWNER ONLY) ==========

    function setupModuleCrossReferences() external onlyOwner {
        address timePeriodLimitsAddr = modules[ModuleIds.TIME_PERIOD_LIMITS];
        address proposalSystemAddr = modules[ModuleIds.PROPOSAL_SYSTEM];
        address bypassSystemAddr = modules[ModuleIds.BYPASS_SYSTEM];

        require(timePeriodLimitsAddr != address(0), "TimePeriodLimitsModule not registered");
        require(proposalSystemAddr != address(0), "ProposalSystemModule not registered");
        require(bypassSystemAddr != address(0), "BypassSystemModule not registered");

        // Set TimePeriodLimitsModule reference in ProposalSystemModule
        IProposalSystemModule(proposalSystemAddr).setTimePeriodLimitsModule(timePeriodLimitsAddr);

        // Set TimePeriodLimitsModule reference in BypassSystemModule
        IBypassSystemModule(bypassSystemAddr).setTimePeriodLimitsModule(timePeriodLimitsAddr);
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


    // Allow contract to receive ETH for withdrawals
    receive() external payable {
        // Accept ETH - could be from module operations
    }
}