// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SavingsInterfaces.sol";
import "./YieldInterfaces.sol";
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

    // Appended for upgrades: earning on idle vault balances. The module keeps
    // custody; the yield module only accounts for what is invested. Nothing
    // above this line moves.
    IYieldModule public yieldModule;

    uint8 private constant VAULT_TYPE_PERSONAL = 0;
    uint8 private constant VAULT_TYPE_COMMUNITY = 1;
    uint256 private constant MAX_BPS = 10000;
    uint256 private constant MAX_PENALTY_BPS = 5000;
    uint256 private constant MAX_NAME_LENGTH = 32;
    uint256 private constant MAX_DESCRIPTION_LENGTH = 256;
    uint256 private constant PENALTY_PRECISION = 1e12;
    // Same bounds as the savings account, so a vault is not a weaker place to
    // keep money than the account it sits beside.
    uint256 private constant DEFAULT_UNLOCK_DELAY = 24 hours;
    uint256 private constant MIN_UNLOCK_DELAY = 1 hours;
    uint256 private constant MAX_UNLOCK_DELAY = 90 days;
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

    /// @notice Attach the yield module. Until this is set, every yield hook below
    /// is a no-op, so the upgrade changes nothing for anyone until this call.
    function setYieldModule(address _yieldModule) external onlyOwner {
        yieldModule = IYieldModule(_yieldModule);
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
        _installMemberRules(vaultId, vault, msg.sender);
        emit VaultCreated(vaultId, msg.sender, params.token, params.name, params.vaultType);
    }

    function joinVault(uint256 vaultId) external {
        VaultInfo storage vault = _activeVault(vaultId);
        require(vault.vaultType == VAULT_TYPE_COMMUNITY, "Personal vault");
        require(!vaultMembers[vaultId][msg.sender].exists, "Already a member");
        _addMember(vaultId, msg.sender);
        // Members join under the terms they can see, written into their own
        // scope so their spent counters are theirs alone.
        _installMemberRules(vaultId, vault, msg.sender);
        vault.updatedAt = block.timestamp;
        emit VaultJoined(vaultId, msg.sender);
    }

    function leaveVault(uint256 vaultId) external onlyMember(vaultId) {
        VaultInfo storage vault = _activeVault(vaultId);
        VaultMemberInfo storage member = vaultMembers[vaultId][msg.sender];
        _settlePenalties(vault, member);
        _settleYield(vaultId, vault, member, msg.sender);
        require(member.balance == 0 && member.unclaimedPenalties == 0, "Balance not zero");
        require(_pendingYield(vaultId, msg.sender) == 0, "Pending yield not zero");
        require(msg.sender != vault.creator, "Creator cannot leave");

        vault.memberCount--;
        vault.updatedAt = block.timestamp;
        _removeFromMemberList(vaultId, msg.sender);
        delete vaultMembers[vaultId][msg.sender];
        _removeUserVaultId(msg.sender, vaultId);
        emit VaultLeft(vaultId, msg.sender);
    }

    /// @notice Propose a change to one of this vault's spending limits.
    ///
    /// Vault rules live in the same modules as the savings account's, keyed by
    /// a scope derived from (vault, member). That is deliberate: a vault should
    /// not be a second, weaker implementation of the same protections. It
    /// inherits the timelock, the per-period waits and the increase-rate
    /// tracking exactly as the account has them.
    function proposeVaultLimitChange(uint256 vaultId, string calldata periodName, uint256 newLimit)
        external
        onlyMember(vaultId)
        returns (bytes32 proposalId)
    {
        VaultInfo storage vault = _activeVault(vaultId);
        require(vault.vaultType == VAULT_TYPE_PERSONAL, "Community rules immutable");
        return _proposals().proposeLimitChange(_vaultScope(vaultId, msg.sender), periodName, newLimit);
    }

    /// @notice Propose a change to how long this vault's limits take to change.
    function proposeVaultUnlockDelayChange(
        uint256 vaultId,
        string calldata periodName,
        uint256 newUnlockDelay
    ) external onlyMember(vaultId) returns (bytes32 proposalId) {
        VaultInfo storage vault = _activeVault(vaultId);
        require(vault.vaultType == VAULT_TYPE_PERSONAL, "Community rules immutable");
        return _proposals().proposeUnlockDelayChange(
            _vaultScope(vaultId, msg.sender), periodName, newUnlockDelay
        );
    }

    function executeVaultLimitProposal(uint256 vaultId, bytes32 proposalId)
        external
        onlyMember(vaultId)
    {
        _proposals().executeLimitProposal(_vaultScope(vaultId, msg.sender), proposalId);
    }

    function cancelVaultLimitProposal(uint256 vaultId, bytes32 proposalId)
        external
        onlyMember(vaultId)
    {
        _proposals().cancelLimitProposal(_vaultScope(vaultId, msg.sender), proposalId);
    }

    /// @notice The scope a member's vault rules are stored under.
    ///
    /// Domain-separated so it cannot collide with a real account: an address
    /// derived this way is not one anybody can hold a key for, and it is not
    /// derived the way any other address in this system is. A collision would
    /// merge a vault's rules with someone's savings account, so improbable is
    /// not good enough — it has to be structurally distinct.
    function vaultScopeOf(uint256 vaultId, address member) external pure returns (address) {
        return _vaultScope(vaultId, member);
    }

    function _vaultScope(uint256 vaultId, address member) private pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encode("LOCKIN_VAULT_SCOPE", vaultId, member)))));
    }

    /// @dev Both fail closed. A vault whose limit check silently no-opped
    /// because a module was missing would be worse than having no limits at
    /// all, because the UI would still promise them.
    function _limits() private view returns (ITimePeriodLimitsModule) {
        address module = savingsCore.getModule(ModuleIds.TIME_PERIOD_LIMITS);
        require(module != address(0), "Limits module not registered");
        return ITimePeriodLimitsModule(module);
    }

    function _proposals() private view returns (IProposalSystemModule) {
        address module = savingsCore.getModule(ModuleIds.PROPOSAL_SYSTEM);
        require(module != address(0), "Proposal module not registered");
        return IProposalSystemModule(module);
    }

    /// @dev Copy the vault's rules into a member's own scope, then lock it in.
    /// Locking at creation is what makes every later change serve the timelock
    /// — the same state the savings account reaches when the user locks in.
    function _installMemberRules(uint256 vaultId, VaultInfo storage vault, address member) private {
        address scope = _vaultScope(vaultId, member);

        uint256 count;
        if (vault.dailyLimit > 0) count++;
        if (vault.weeklyLimit > 0) count++;
        if (vault.monthlyLimit > 0) count++;

        string[] memory names = new string[](count);
        uint256[] memory limits = new uint256[](count);
        uint256[] memory durations = new uint256[](count);
        uint256[] memory delays = new uint256[](count);

        uint256 i;
        if (vault.dailyLimit > 0) {
            names[i] = "Daily"; limits[i] = vault.dailyLimit;
            durations[i] = DAILY_DURATION; delays[i] = DEFAULT_UNLOCK_DELAY; i++;
        }
        if (vault.weeklyLimit > 0) {
            names[i] = "Weekly"; limits[i] = vault.weeklyLimit;
            durations[i] = WEEKLY_DURATION; delays[i] = WEEKLY_DURATION; i++;
        }
        if (vault.monthlyLimit > 0) {
            names[i] = "Monthly"; limits[i] = vault.monthlyLimit;
            durations[i] = MONTHLY_DURATION; delays[i] = MONTHLY_DURATION; i++;
        }

        ITimePeriodLimitsModule limitsModule = _limits();
        limitsModule.setPeriodLimits(scope, names, limits, durations, delays);
        limitsModule.setLimitsArePercentage(scope, vault.limitsArePercentage);
        _proposals().commitInitialSetup(scope);
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
        _settleYield(vaultId, vault, member, beneficiary);
        member.balance += credited;
        vault.totalBalance += credited;
        _snapshotDebt(vault, member);
        _snapshotYield(vaultId, member, beneficiary);
        vault.updatedAt = block.timestamp;
        emit VaultDeposit(vaultId, beneficiary, credited);

        // Put the vault's idle balance to work. A balance that predates the
        // vault opting in joins on the first deposit after, which is what keeps
        // funds already in custody from moving on their own.
        _investIdle(vaultId, vault, member, beneficiary);
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

    /// @notice Withdraw within the vault's spending limits, to your own address.
    function withdraw(uint256 vaultId, uint256 amount) external nonReentrant onlyMember(vaultId) {
        _withdraw(vaultId, amount, msg.sender);
    }

    /// @notice Withdraw to a saved withdrawal address.
    ///
    /// The list is deliberately the member's own — the same one the savings
    /// account uses — rather than one per vault. Where money may go is a
    /// property of the person, not of the asset, and per-vault lists would
    /// mean re-approving the same destination repeatedly, which is how people
    /// end up approving carelessly.
    function withdrawTo(uint256 vaultId, uint256 amount, address destination)
        external
        nonReentrant
        onlyMember(vaultId)
    {
        _withdraw(vaultId, amount, destination);
    }

    function _withdraw(uint256 vaultId, uint256 amount, address destination) private {
        enforceNotFrozen(savingsCore, msg.sender);
        _requireApprovedDestination(msg.sender, destination);
        VaultInfo storage vault = _activeVault(vaultId);
        VaultMemberInfo storage member = vaultMembers[vaultId][msg.sender];
        require(amount > 0, "Invalid amount");

        _settlePenalties(vault, member);
        // Settle before the balance check so earned yield is withdrawable, and
        // before the limit check so a percentage limit is measured against the
        // balance the member actually has.
        _settleYield(vaultId, vault, member, msg.sender);
        require(amount <= member.balance, "Invalid amount");
        _limits().checkAllTimePeriodLimitsFor(_vaultScope(vaultId, msg.sender), amount, member.balance);

        // Redeem while totalBalance still includes this withdrawal — the vault's
        // own idle share is derived from it.
        _ensureLiquidity(vaultId, vault, member, msg.sender, amount);

        member.balance -= amount;
        vault.totalBalance -= amount;
        _snapshotDebt(vault, member);
        _snapshotYield(vaultId, member, msg.sender);
        vault.updatedAt = block.timestamp;

        _payOut(vault.token, destination, amount);
        emit VaultWithdrawal(vaultId, msg.sender, amount, 0);
    }

    /// @notice Withdraw bypassing spending limits by paying the vault's penalty rate.
    function withdrawWithPenalty(uint256 vaultId, uint256 amount) external nonReentrant onlyMember(vaultId) {
        enforceNotFrozen(savingsCore, msg.sender);
        VaultInfo storage vault = _activeVault(vaultId);
        VaultMemberInfo storage member = vaultMembers[vaultId][msg.sender];
        require(amount > 0, "Invalid amount");

        _settlePenalties(vault, member);
        _settleYield(vaultId, vault, member, msg.sender);
        require(amount <= member.balance, "Invalid amount");

        uint256 penalty = (amount * vault.penaltyRateBps) / MAX_BPS;
        uint256 userAmount = amount - penalty;

        // The full amount must be liquid: the user's share leaves, and the
        // penalty stays here as idle tokens to redistribute or send to treasury.
        _ensureLiquidity(vaultId, vault, member, msg.sender, amount);

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
        _snapshotYield(vaultId, member, msg.sender);

        _payOut(vault.token, msg.sender, userAmount);
        if (!redistribute && penalty > 0) {
            _payOut(vault.token, treasury, penalty);
        }
        emit VaultWithdrawal(vaultId, msg.sender, amount, penalty);
    }

    function claimPenaltyRewards(uint256 vaultId) external nonReentrant onlyMember(vaultId) {
        enforceNotFrozen(savingsCore, msg.sender);
        VaultInfo storage vault = _activeVault(vaultId);
        VaultMemberInfo storage member = vaultMembers[vaultId][msg.sender];

        _settlePenalties(vault, member);
        _settleYield(vaultId, vault, member, msg.sender);
        _snapshotYield(vaultId, member, msg.sender);
        uint256 amount = member.unclaimedPenalties;
        require(amount > 0, "Nothing to claim");
        member.unclaimedPenalties = 0;

        // No _ensureLiquidity: penalties are never invested, so they are always
        // already sitting here as idle tokens.
        _payOut(vault.token, msg.sender, amount);
        emit PenaltyRewardsClaimed(vaultId, msg.sender, amount);
    }

    // ========== EARNING ==========

    /// @notice Choose how this vault's balance earns.
    ///
    /// A personal vault's owner can change this whenever they like. A community
    /// vault's creator can only set it while they are still its only member —
    /// the same principle as its other rules: members join under terms they can
    /// see, and nobody else can route their funds into an outside protocol after
    /// the fact.
    function setVaultYieldMode(uint256 vaultId, uint8 mode) external nonReentrant {
        require(address(yieldModule) != address(0), "Yield module not configured");
        VaultInfo storage vault = _activeVault(vaultId);
        require(msg.sender == vault.creator, "Only creator");
        require(
            vault.vaultType == VAULT_TYPE_PERSONAL || vault.memberCount == 1,
            "Community yield immutable"
        );

        VaultMemberInfo storage member = vaultMembers[vaultId][msg.sender];
        _settleYield(vaultId, vault, member, msg.sender);
        // Fully exit the old position before repointing — never mix two share
        // prices in one position.
        // Only the creator can reach this, and a community vault's mode is fixed
        // once anyone else joins — so the caller is the only member with a
        // position to unwind.
        yieldModule.divestAll(vaultId, msg.sender, address(this));
        yieldModule.setVaultMode(vaultId, vault.token, mode);
        _snapshotYield(vaultId, member, msg.sender);
        vault.updatedAt = block.timestamp;

        if (mode != MODE_OFF) _investIdle(vaultId, vault, member, msg.sender);
        emit VaultYieldModeSet(vaultId, mode);
    }

    /// @notice Fold a member's earned yield into their balance. Permissionless,
    /// because it only ever credits the member named — it lets the app (or
    /// anyone) keep idle members' accounting current.
    function compoundYield(uint256 vaultId, address memberAddr) external nonReentrant {
        require(address(yieldModule) != address(0), "Yield module not configured");
        VaultInfo storage vault = _activeVault(vaultId);
        VaultMemberInfo storage member = vaultMembers[vaultId][memberAddr];
        require(member.exists, "Not a vault member");

        uint256 before = member.balance;
        _settleYield(vaultId, vault, member, memberAddr);
        _snapshotYield(vaultId, member, memberAddr);
        vault.updatedAt = block.timestamp;
        emit VaultYieldCompounded(vaultId, memberAddr, member.balance - before);
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

    function pendingVaultYield(uint256 vaultId, address memberAddr) external view returns (uint256) {
        return _pendingYield(vaultId, memberAddr);
    }

    function getVaultYieldInfo(uint256 vaultId)
        external
        view
        returns (
            uint8 mode,
            address strategy,
            uint256 invested,
            uint256 currentValue,
            uint256 lifetimeYield,
            uint256 feeBps
        )
    {
        if (address(yieldModule) == address(0)) return (MODE_OFF, address(0), 0, 0, 0, 0);
        VaultYieldState memory y = yieldModule.getVaultYield(vaultId);
        return (
            yieldModule.effectiveMode(vaultId),
            y.strategy,
            y.principal,
            yieldModule.investedValue(vaultId),
            y.lifetimeYield,
            yieldModule.managementFeeBps()
        );
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

    // ========== YIELD INTERNALS ==========

    /// @dev Credit the member's share of the yield. Mirrors _settlePenalties:
    /// call it before any balance change. The yield module keeps its own
    /// accumulator; this module stays the single owner of the balance ledger, so
    /// `vault.totalBalance == sum(member.balance)` still holds.
    function _settleYield(
        uint256 vaultId,
        VaultInfo storage vault,
        VaultMemberInfo storage member,
        address who
    ) private {
        if (address(yieldModule) == address(0) || !member.exists) return;
        uint256 credited = yieldModule.settleMemberYield(vaultId, who);
        if (credited == 0) return;
        member.balance += credited;
        vault.totalBalance += credited;
    }

    /// @dev Re-baseline the member's yield debt. Mirrors _snapshotDebt: call it
    /// after the balance change.
    function _snapshotYield(uint256 vaultId, VaultMemberInfo storage member, address who) private {
        if (address(yieldModule) == address(0)) return;
        yieldModule.snapshotMemberYield(vaultId, who, member.balance);
    }

    /// @dev Invest this vault's uninvested balance. Deliberately derived from
    /// `vault.totalBalance - investedPrincipal` rather than from this module's
    /// token balance, so one vault can never invest another's funds — and so
    /// penalties awaiting a claim are never invested at all.
    function _investIdle(
        uint256 vaultId,
        VaultInfo storage vault,
        VaultMemberInfo storage member,
        address who
    ) private {
        if (address(yieldModule) == address(0) || vault.token == address(0)) return;

        // The yield module decides how much, because only it knows whether this
        // vault pools its balance (stable earning) or gives each member their
        // own position (prize savings). This module stays mode-agnostic.
        uint256 toInvest =
            yieldModule.investableAmount(vaultId, who, vault.totalBalance, member.balance);
        if (toInvest == 0) return;

        IERC20(vault.token).forceApprove(address(yieldModule), toInvest);
        yieldModule.onDeposit(vaultId, vault.token, who, toInvest);
        IERC20(vault.token).forceApprove(address(yieldModule), 0);
    }

    /// @dev Make `needed` liquid for a payout, redeeming only the part this
    /// vault cannot cover from its own idle share. Must be called while
    /// `vault.totalBalance` still includes the amount being withdrawn.
    function _ensureLiquidity(
        uint256 vaultId,
        VaultInfo storage vault,
        VaultMemberInfo storage member,
        address who,
        uint256 needed
    ) private {
        if (address(yieldModule) == address(0) || vault.token == address(0)) return;

        uint256 shortfall =
            yieldModule.liquidityShortfall(vaultId, who, needed, vault.totalBalance, member.balance);
        if (shortfall == 0) return;
        yieldModule.ensureLiquidity(vaultId, vault.token, who, shortfall, address(this));
    }

    function _pendingYield(uint256 vaultId, address memberAddr) private view returns (uint256) {
        if (address(yieldModule) == address(0)) return 0;
        return yieldModule.pendingYield(vaultId, memberAddr);
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

    /// @dev A destination is either the member themselves or one they added to
    /// their saved list, which sits in the approval module keyed by their real
    /// address — so every vault they own shares the one list.
    ///
    /// If that module is not registered, only self-withdrawal is possible.
    /// Failing closed matters here: the alternative would let an attacker send
    /// vault funds anywhere on a chain where the whitelist happens to be absent.
    function _requireApprovedDestination(address member, address destination) private view {
        require(destination != address(0), "Invalid destination");
        if (destination == member) return;

        address approvalModule = savingsCore.getModule(ModuleIds.APPROVAL_SYSTEM);
        require(approvalModule != address(0), "Withdrawal address not approved");
        require(
            IApprovalSystemModule(approvalModule).isValidWithdrawalDestination(member, destination),
            "Withdrawal address not approved"
        );
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
