// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SavingsInterfaces.sol";
import "./VaultDepositProxy.sol";

/// @title VaultSystemModule
/// @notice Named savings vaults with per-member time-window withdrawal limits.
/// Mirrors the Solana savings-core vault program so both chains share one
/// frontend adapter interface:
/// - Each vault holds exactly one token (address(0) = native ETH).
/// - Limits are either fixed token amounts or basis points of the member's
///   balance (`limitsArePercentage`), enforced per member per rolling window.
/// - Penalty withdrawals bypass limits; the penalty is redistributed to the
///   remaining members of a Community vault (reward-per-share accumulator) or
///   sent to the treasury for a Personal vault.
/// @dev This module custodies vault funds itself; upgrade it only via
/// `upgrade-module` (UUPS upgradeProxy) so the proxy address keeps the funds.
contract VaultSystemModule is Initializable, UUPSUpgradeable, OwnableUpgradeable, IVaultSystemModule {
    using SafeERC20 for IERC20;

    ISavingsCore public savingsCore;
    address public treasury;
    uint256 public vaultCount;

    mapping(uint256 => VaultInfo) private vaults;
    mapping(uint256 => mapping(address => VaultMemberInfo)) private vaultMembers;
    mapping(uint256 => address[]) private vaultMemberList;
    mapping(uint256 => mapping(address => uint256)) private memberListIndex; // 1-based; 0 = not in list
    mapping(address => uint256[]) private userVaultIds;

    bool private locked;

    // Appended for upgrades: permanent per-vault deposit addresses
    mapping(uint256 => address) private vaultDepositProxies;

    uint8 private constant VAULT_TYPE_PERSONAL = 0;
    uint8 private constant VAULT_TYPE_COMMUNITY = 1;
    uint256 private constant MAX_BPS = 10000;
    uint256 private constant MAX_PENALTY_BPS = 5000;
    uint256 private constant MAX_NAME_LENGTH = 32;
    uint256 private constant MAX_DESCRIPTION_LENGTH = 256;
    uint256 private constant PENALTY_PRECISION = 1e12;
    uint256 private constant DAILY_DURATION = 1 days;
    uint256 private constant WEEKLY_DURATION = 7 days;
    uint256 private constant MONTHLY_DURATION = 30 days;

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyMember(uint256 vaultId) {
        require(vaultMembers[vaultId][msg.sender].exists, "Not a vault member");
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
        treasury = msg.sender;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    // ========== VAULT LIFECYCLE ==========

    function createVault(VaultParams calldata params) external returns (uint256 vaultId) {
        require(params.vaultType <= VAULT_TYPE_COMMUNITY, "Invalid vault type");
        _validateVaultParams(
            params.name,
            params.description,
            params.dailyLimit,
            params.weeklyLimit,
            params.monthlyLimit,
            params.limitsArePercentage,
            params.penaltyRateBps
        );

        vaultId = ++vaultCount;
        VaultInfo storage vault = vaults[vaultId];
        vault.creator = msg.sender;
        vault.vaultType = params.vaultType;
        vault.token = params.token;
        vault.name = params.name;
        vault.description = params.description;
        vault.dailyLimit = params.dailyLimit;
        vault.weeklyLimit = params.weeklyLimit;
        vault.monthlyLimit = params.monthlyLimit;
        vault.limitsArePercentage = params.limitsArePercentage;
        vault.penaltyRateBps = params.penaltyRateBps;
        vault.isActive = true;
        vault.createdAt = block.timestamp;
        vault.updatedAt = block.timestamp;

        _addMember(vaultId, msg.sender);
        emit VaultCreated(vaultId, msg.sender, params.token, params.name, params.vaultType);
    }

    function joinVault(uint256 vaultId) external {
        VaultInfo storage vault = _activeVault(vaultId);
        require(vault.vaultType == VAULT_TYPE_COMMUNITY, "Personal vault");
        require(!vaultMembers[vaultId][msg.sender].exists, "Already a member");
        _addMember(vaultId, msg.sender);
        vault.updatedAt = block.timestamp;
        emit VaultJoined(vaultId, msg.sender);
    }

    function leaveVault(uint256 vaultId) external onlyMember(vaultId) {
        VaultInfo storage vault = _activeVault(vaultId);
        VaultMemberInfo storage member = vaultMembers[vaultId][msg.sender];
        _settlePenalties(vault, member);
        require(member.balance == 0 && member.unclaimedPenalties == 0, "Balance not zero");
        require(msg.sender != vault.creator, "Creator cannot leave");

        vault.memberCount--;
        vault.updatedAt = block.timestamp;
        _removeFromMemberList(vaultId, msg.sender);
        delete vaultMembers[vaultId][msg.sender];
        _removeUserVaultId(msg.sender, vaultId);
        emit VaultLeft(vaultId, msg.sender);
    }

    function updateVaultRules(
        uint256 vaultId,
        uint256 dailyLimit,
        uint256 weeklyLimit,
        uint256 monthlyLimit,
        bool limitsArePercentage,
        uint256 penaltyRateBps
    ) external {
        VaultInfo storage vault = _activeVault(vaultId);
        require(msg.sender == vault.creator, "Only creator");
        // Community vault rules are immutable — members join under fixed terms
        require(vault.vaultType == VAULT_TYPE_PERSONAL, "Community rules immutable");
        _validateVaultParams(vault.name, vault.description, dailyLimit, weeklyLimit, monthlyLimit, limitsArePercentage, penaltyRateBps);

        vault.dailyLimit = dailyLimit;
        vault.weeklyLimit = weeklyLimit;
        vault.monthlyLimit = monthlyLimit;
        vault.limitsArePercentage = limitsArePercentage;
        vault.penaltyRateBps = penaltyRateBps;
        vault.updatedAt = block.timestamp;
        emit VaultRulesUpdated(vaultId);
    }

    // ========== FUNDS ==========

    function deposit(uint256 vaultId, uint256 amount) external payable nonReentrant onlyMember(vaultId) {
        _deposit(vaultId, amount, msg.sender);
    }

    /// @notice Deposit on behalf of an existing member — used by the vault's
    /// permanent deposit address to credit funds sent from exchanges.
    function depositFor(uint256 vaultId, uint256 amount, address beneficiary) external payable nonReentrant {
        require(vaultMembers[vaultId][beneficiary].exists, "Not a vault member");
        _deposit(vaultId, amount, beneficiary);
    }

    /// @dev Funds always come from msg.sender; the credit goes to `beneficiary`.
    function _deposit(uint256 vaultId, uint256 amount, address beneficiary) private {
        require(amount > 0, "Invalid amount");
        VaultInfo storage vault = _activeVault(vaultId);
        VaultMemberInfo storage member = vaultMembers[vaultId][beneficiary];

        uint256 credited = amount;
        if (vault.token == address(0)) {
            require(msg.value == amount, "Incorrect ETH amount");
        } else {
            require(msg.value == 0, "ETH not accepted");
            // Credit what actually arrived so fee-on-transfer tokens cannot
            // make recorded balances exceed the module's holdings
            IERC20 token = IERC20(vault.token);
            uint256 balanceBefore = token.balanceOf(address(this));
            token.safeTransferFrom(msg.sender, address(this), amount);
            credited = token.balanceOf(address(this)) - balanceBefore;
            require(credited > 0, "Nothing received");
        }

        _settlePenalties(vault, member);
        member.balance += credited;
        vault.totalBalance += credited;
        _snapshotDebt(vault, member);
        vault.updatedAt = block.timestamp;
        emit VaultDeposit(vaultId, beneficiary, credited);
    }

    // ========== PERMANENT DEPOSIT ADDRESSES ==========

    /// @notice Deploy the vault's permanent deposit address. Anything sent to
    /// it (ETH or the vault's token) is forwarded into the vault and credited
    /// to the creator, so exchanges can withdraw straight into this vault.
    function deployVaultDepositAddress(uint256 vaultId) external returns (address proxy) {
        VaultInfo storage vault = _activeVault(vaultId);
        require(msg.sender == vault.creator, "Only creator");
        require(vaultDepositProxies[vaultId] == address(0), "Already deployed");

        proxy = address(new VaultDepositProxy{salt: bytes32(vaultId)}(address(this), vaultId, vault.creator));
        vaultDepositProxies[vaultId] = proxy;
        emit VaultDepositAddressDeployed(vaultId, proxy);
    }

    function getVaultDepositAddress(uint256 vaultId) external view returns (address) {
        return vaultDepositProxies[vaultId];
    }

    /// @notice Withdraw within the vault's spending limits.
    function withdraw(uint256 vaultId, uint256 amount) external nonReentrant onlyMember(vaultId) {
        VaultInfo storage vault = _activeVault(vaultId);
        VaultMemberInfo storage member = vaultMembers[vaultId][msg.sender];
        require(amount > 0 && amount <= member.balance, "Invalid amount");

        _settlePenalties(vault, member);
        _checkAndUpdateLimits(vault, member, amount);

        member.balance -= amount;
        vault.totalBalance -= amount;
        _snapshotDebt(vault, member);
        vault.updatedAt = block.timestamp;

        _payOut(vault.token, msg.sender, amount);
        emit VaultWithdrawal(vaultId, msg.sender, amount, 0);
    }

    /// @notice Withdraw bypassing spending limits by paying the vault's penalty rate.
    function withdrawWithPenalty(uint256 vaultId, uint256 amount) external nonReentrant onlyMember(vaultId) {
        VaultInfo storage vault = _activeVault(vaultId);
        VaultMemberInfo storage member = vaultMembers[vaultId][msg.sender];
        require(amount > 0 && amount <= member.balance, "Invalid amount");

        _settlePenalties(vault, member);

        uint256 penalty = (amount * vault.penaltyRateBps) / MAX_BPS;
        uint256 userAmount = amount - penalty;

        member.balance -= amount;
        vault.totalBalance -= amount;
        vault.updatedAt = block.timestamp;

        bool redistribute = vault.vaultType == VAULT_TYPE_COMMUNITY && vault.totalBalance > 0;
        if (redistribute) {
            // Reward-per-share accrual over the members still in the vault
            vault.accPenaltyPerShare += (penalty * PENALTY_PRECISION) / vault.totalBalance;
        }
        // Snapshot AFTER the accrual so the withdrawer's remaining balance is
        // excluded from the penalty they just paid
        _snapshotDebt(vault, member);

        _payOut(vault.token, msg.sender, userAmount);
        if (!redistribute && penalty > 0) {
            _payOut(vault.token, treasury, penalty);
        }
        emit VaultWithdrawal(vaultId, msg.sender, amount, penalty);
    }

    function claimPenaltyRewards(uint256 vaultId) external nonReentrant onlyMember(vaultId) {
        VaultInfo storage vault = _activeVault(vaultId);
        VaultMemberInfo storage member = vaultMembers[vaultId][msg.sender];

        _settlePenalties(vault, member);
        uint256 amount = member.unclaimedPenalties;
        require(amount > 0, "Nothing to claim");
        member.unclaimedPenalties = 0;

        _payOut(vault.token, msg.sender, amount);
        emit PenaltyRewardsClaimed(vaultId, msg.sender, amount);
    }

    // ========== VIEWS ==========

    function getVault(uint256 vaultId) external view returns (VaultInfo memory) {
        require(_vaultExists(vaultId), "Vault not found");
        return vaults[vaultId];
    }

    function getVaultMember(uint256 vaultId, address member) external view returns (VaultMemberInfo memory) {
        return vaultMembers[vaultId][member];
    }

    function getUserVaultIds(address user) external view returns (uint256[] memory) {
        return userVaultIds[user];
    }

    function getVaultMembers(uint256 vaultId) external view returns (address[] memory) {
        return vaultMemberList[vaultId];
    }

    function getVaultCount() external view returns (uint256) {
        return vaultCount;
    }

    function pendingPenaltyRewards(uint256 vaultId, address memberAddr) external view returns (uint256) {
        VaultInfo storage vault = vaults[vaultId];
        VaultMemberInfo storage member = vaultMembers[vaultId][memberAddr];
        uint256 accumulated = (member.balance * vault.accPenaltyPerShare) / PENALTY_PRECISION;
        uint256 debt = member.penaltyDebt > accumulated ? accumulated : member.penaltyDebt;
        return member.unclaimedPenalties + (accumulated - debt);
    }

    // ========== INTERNALS ==========

    function _vaultExists(uint256 vaultId) private view returns (bool) {
        return vaultId > 0 && vaultId <= vaultCount;
    }

    function _activeVault(uint256 vaultId) private view returns (VaultInfo storage vault) {
        require(_vaultExists(vaultId), "Vault not found");
        vault = vaults[vaultId];
        require(vault.isActive, "Vault not active");
    }

    function _addMember(uint256 vaultId, address member) private {
        VaultInfo storage vault = vaults[vaultId];
        vault.memberCount++;
        VaultMemberInfo storage m = vaultMembers[vaultId][member];
        m.exists = true;
        m.joinedAt = block.timestamp;
        m.dailyLastReset = block.timestamp;
        m.weeklyLastReset = block.timestamp;
        m.monthlyLastReset = block.timestamp;
        vaultMemberList[vaultId].push(member);
        memberListIndex[vaultId][member] = vaultMemberList[vaultId].length;
        userVaultIds[member].push(vaultId);
    }

    function _removeFromMemberList(uint256 vaultId, address member) private {
        address[] storage list = vaultMemberList[vaultId];
        uint256 index = memberListIndex[vaultId][member];
        require(index > 0, "Not in member list");
        address last = list[list.length - 1];
        list[index - 1] = last;
        memberListIndex[vaultId][last] = index;
        list.pop();
        delete memberListIndex[vaultId][member];
    }

    function _removeUserVaultId(address user, uint256 vaultId) private {
        uint256[] storage ids = userVaultIds[user];
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == vaultId) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                break;
            }
        }
    }

    /// @dev Credit accrued penalty rewards and re-snapshot the debt baseline.
    function _settlePenalties(VaultInfo storage vault, VaultMemberInfo storage member) private {
        uint256 accumulated = (member.balance * vault.accPenaltyPerShare) / PENALTY_PRECISION;
        uint256 debt = member.penaltyDebt > accumulated ? accumulated : member.penaltyDebt;
        member.unclaimedPenalties += accumulated - debt;
        member.penaltyDebt = accumulated;
    }

    function _snapshotDebt(VaultInfo storage vault, VaultMemberInfo storage member) private {
        member.penaltyDebt = (member.balance * vault.accPenaltyPerShare) / PENALTY_PRECISION;
    }

    /// @dev Reset expired windows, verify the amount fits every active limit
    /// (percentage limits apply to the balance before this withdrawal), then
    /// add the amount to the spent counters.
    function _checkAndUpdateLimits(VaultInfo storage vault, VaultMemberInfo storage member, uint256 amount) private {
        uint256 balance = member.balance;
        if (vault.dailyLimit > 0) {
            if (block.timestamp >= member.dailyLastReset + DAILY_DURATION) {
                member.dailySpent = 0;
                member.dailyLastReset = block.timestamp;
            }
            require(member.dailySpent + amount <= _effectiveLimit(vault, vault.dailyLimit, balance), "Daily limit exceeded");
            member.dailySpent += amount;
        }
        if (vault.weeklyLimit > 0) {
            if (block.timestamp >= member.weeklyLastReset + WEEKLY_DURATION) {
                member.weeklySpent = 0;
                member.weeklyLastReset = block.timestamp;
            }
            require(member.weeklySpent + amount <= _effectiveLimit(vault, vault.weeklyLimit, balance), "Weekly limit exceeded");
            member.weeklySpent += amount;
        }
        if (vault.monthlyLimit > 0) {
            if (block.timestamp >= member.monthlyLastReset + MONTHLY_DURATION) {
                member.monthlySpent = 0;
                member.monthlyLastReset = block.timestamp;
            }
            require(member.monthlySpent + amount <= _effectiveLimit(vault, vault.monthlyLimit, balance), "Monthly limit exceeded");
            member.monthlySpent += amount;
        }
    }

    function _effectiveLimit(VaultInfo storage vault, uint256 limitValue, uint256 balance) private view returns (uint256) {
        if (limitValue == 0) return 0;
        if (vault.limitsArePercentage) {
            return (balance * limitValue) / MAX_BPS;
        }
        return limitValue;
    }

    function _validateVaultParams(
        string memory name,
        string memory description,
        uint256 dailyLimit,
        uint256 weeklyLimit,
        uint256 monthlyLimit,
        bool limitsArePercentage,
        uint256 penaltyRateBps
    ) private pure {
        require(bytes(name).length > 0 && bytes(name).length <= MAX_NAME_LENGTH, "Invalid name");
        require(bytes(description).length <= MAX_DESCRIPTION_LENGTH, "Invalid description");
        require(dailyLimit > 0 || weeklyLimit > 0 || monthlyLimit > 0, "No limits set");
        if (limitsArePercentage) {
            require(dailyLimit <= MAX_BPS && weeklyLimit <= MAX_BPS && monthlyLimit <= MAX_BPS, "Limit exceeds 100%");
        }
        require(penaltyRateBps > 0 && penaltyRateBps <= MAX_PENALTY_BPS, "Invalid penalty rate");
        if (dailyLimit > 0 && weeklyLimit > 0) {
            require(weeklyLimit >= dailyLimit, "Weekly below daily");
        }
        if (weeklyLimit > 0 && monthlyLimit > 0) {
            require(monthlyLimit >= weeklyLimit, "Monthly below weekly");
        }
        if (dailyLimit > 0 && monthlyLimit > 0 && weeklyLimit == 0) {
            require(monthlyLimit >= dailyLimit, "Monthly below daily");
        }
    }

    function _payOut(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            // .call instead of .transfer so smart-contract wallets can receive;
            // all callers are nonReentrant and update state before paying out
            (bool success, ) = payable(to).call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}
