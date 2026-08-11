// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./SavingsInterfaces.sol";

/**
 * @title SavingsCore
 * @dev Custody kernel of the modular savings system. Holds user balances,
 *      the module registry, and the withdrawal flows that spend them.
 *
 *      Everything else — spending limits, proposals, bypass, approvals,
 *      referrals, deposit proxies, PoolTogether — lives in self-authenticating
 *      modules that users call directly (Pattern B): user-facing module
 *      functions authenticate via msg.sender, so the core carries no
 *      per-feature forwarders.
 */
contract SavingsCore is Initializable, UUPSUpgradeable, OwnableUpgradeable, ISavingsCore {
    // User data storage
    mapping(address => mapping(address => uint256)) private userTokenBalances; // user => token => balance

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

    // Blocks outgoing funds movement for accounts frozen by the recovery
    // system. Deposits and the recovery flow itself (updateTokenBalance)
    // stay available while frozen.
    modifier notFrozen(address user) {
        address recoveryModule = modules[ModuleIds.RECOVERY_SYSTEM];
        if (recoveryModule != address(0)) {
            IRecoverySystemModule(recoveryModule).requireNotFrozen(user);
        }
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

    /// @notice Decimals spending limits are stored in, so amounts in different
    ///         stablecoins can be measured against one shared cap.
    uint8 public constant LIMIT_DECIMALS = 6;

    /// @notice Restate a token amount in the units spending limits are kept in.
    ///
    /// This account holds several stablecoins at once and applies ONE limit
    /// across them, so the amounts have to share a scale. Limits are stored at
    /// 6 decimals, and a stablecoin is worth a dollar, so dividing out the
    /// token's own decimals turns any of them into the same dollar figure:
    /// 100 USDT (100e6) and 100 DAI (100e18) both become 100e6.
    ///
    /// Without this, the limit was compared against raw amounts. A "$100 a day"
    /// cap read as 100e6, so 100 DAI measured as 100e18 — a trillion times over
    /// — and DAI was effectively unwithdrawable, while a token with fewer
    /// decimals would have slipped through almost unmetered.
    ///
    /// No price feed is involved, and none is needed: the peg is what makes a
    /// shared limit meaningful here. That is exactly why this account takes
    /// stablecoins and anything else belongs in a vault of its own, where its
    /// limits are denominated in that coin.
    function _toLimitUnits(address token, uint256 amount) internal view returns (uint256) {
        // Native coin is deliberately NOT rescaled. Rescaling assumes a unit is
        // worth a dollar, which is true of a stablecoin and wildly false of ETH:
        // it would let one ETH count as one dollar against the cap and turn a
        // "$100 a day" limit into thousands. Left at face value, the existing
        // conservative behaviour stands: a native withdrawal is measured at
        // face value, so the cap binds hard rather than loosely. Closing native
        // deposits is a separate change — it is a product decision with a much
        // wider blast radius than this bug fix.
        if (token == address(0)) return amount;

        uint8 decimals = _tokenDecimals(token);
        if (decimals == LIMIT_DECIMALS) return amount;
        if (decimals > LIMIT_DECIMALS) return amount / (10 ** (decimals - LIMIT_DECIMALS));
        return amount * (10 ** (LIMIT_DECIMALS - decimals));
    }

    /// @dev decimals() is optional in ERC20, so a token that omits it is read
    /// as 18 — the same assumption every wallet makes.
    function _tokenDecimals(address token) internal view returns (uint8) {
        if (token == address(0)) return 18; // native coin
        try IERC20Metadata(token).decimals() returns (uint8 d) {
            return d;
        } catch {
            return 18;
        }
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
        // This account applies ONE spending limit across everything it holds,
        // denominated in dollars — which only means something for assets pegged
        // to one. A coin whose value moves cannot be measured against it:
        // rescaling would let one ETH count as one dollar, and not rescaling
        // caps it at a trillionth of its worth. Neither is a limit.
        //
        // So it belongs in a vault of its own, where limits are denominated in
        // that coin or as a share of the balance. Anything already deposited
        // here stays fully withdrawable.
        require(token != address(0), "Native coin belongs in a vault");
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

    /// @dev Deposit addresses forward native coin through here. Refusing means
    /// it bounces back to whoever sent it rather than landing somewhere its
    /// value cannot be measured — nothing is stranded either way.
    function depositTo(address) external payable {
        revert("Native coin belongs in a vault");
    }


    // Enhanced deposit function that works with proxy forwarding
    function deposit(address token, uint256 amount, address beneficiary) external payable {
        require(token != address(0), "Native coin belongs in a vault");
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

    function withdraw(address user, uint256 amount, address token) external onlyAuthorizedModule notFrozen(user) {
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

    function withdrawAll(address user) external onlyAuthorizedModule notFrozen(user) {
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

    /// @notice Transfer tokens held by SavingsCore to a destination on behalf of a user
    /// @dev Only callable by authorized modules. Decreases user balance and transfers tokens.
    function transferTokensTo(address user, address token, uint256 amount, address destination) external onlyAuthorizedModule notFrozen(user) {
        require(amount > 0 && amount <= userTokenBalances[user][token], "Invalid amount");
        require(destination != address(0), "Invalid destination");
        require(token != address(0), "Only ERC20 tokens supported");

        userTokenBalances[user][token] -= amount;
        IERC20(token).transfer(destination, amount);
    }

    function getMyBalance() external view returns (uint256) {
        return userTokenBalances[msg.sender][address(0)];
    }

    // ========== USER WITHDRAWAL FLOWS ==========

    // Core withdraw function with time period limits check
    function withdraw(uint256 amount, address token) external nonReentrant notFrozen(msg.sender) {
        require(amount > 0 && amount <= userTokenBalances[msg.sender][token], "Invalid amount");

        // Check against all active time period limits
        ITimePeriodLimitsModule limitsModule = ITimePeriodLimitsModule(modules[ModuleIds.TIME_PERIOD_LIMITS]);
        if (address(limitsModule) != address(0)) {
            limitsModule.checkAllTimePeriodLimits(msg.sender, _toLimitUnits(token, amount));
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
    function withdrawTo(uint256 amount, address token, address destination) external nonReentrant notFrozen(msg.sender) {
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
            limitsModule.checkAllTimePeriodLimits(msg.sender, _toLimitUnits(token, amount));
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
    function withdrawAll() external nonReentrant notFrozen(msg.sender) {
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

    // ========== MODULE SETUP FUNCTIONS (OWNER ONLY) ==========

    function setupModuleCrossReferences() external onlyOwner {
        address timePeriodLimitsAddr = modules[ModuleIds.TIME_PERIOD_LIMITS];
        address proposalSystemAddr = modules[ModuleIds.PROPOSAL_SYSTEM];
        address bypassSystemAddr = modules[ModuleIds.BYPASS_SYSTEM];
        address referralAddr = modules[ModuleIds.REFERRAL];

        require(timePeriodLimitsAddr != address(0), "TimePeriodLimitsModule not registered");
        require(proposalSystemAddr != address(0), "ProposalSystemModule not registered");
        require(bypassSystemAddr != address(0), "BypassSystemModule not registered");

        // Set TimePeriodLimitsModule reference in ProposalSystemModule
        IProposalSystemModule(proposalSystemAddr).setTimePeriodLimitsModule(timePeriodLimitsAddr);

        // Set TimePeriodLimitsModule reference in BypassSystemModule
        IBypassSystemModule(bypassSystemAddr).setTimePeriodLimitsModule(timePeriodLimitsAddr);

        // Set ProposalSystemModule reference in TimePeriodLimitsModule
        ITimePeriodLimitsModule(timePeriodLimitsAddr).setProposalSystemModule(proposalSystemAddr);

        // Set ReferralModule reference in ProposalSystemModule (optional module)
        if (referralAddr != address(0)) {
            IProposalSystemModule(proposalSystemAddr).setReferralModule(referralAddr);
        }
    }

    // Allow contract to receive ETH for withdrawals
    receive() external payable {
        // Accept ETH - could be from module operations
    }
}
