// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SavingsInterfaces.sol";
import "./YieldInterfaces.sol";

// What a vault holds, and therefore how its limits can honestly be measured.
uint8 constant VAULT_KIND_COIN = 0; // exactly one asset
uint8 constant VAULT_KIND_STABLES = 1; // several dollar-pegged assets

/// @title SavingsVaultModule
/// @notice One savings primitive. The main wallet is a vault; a pot for a
/// single coin is a vault. There is no separate account with its own custody,
/// its own balances and its own copy of the limit logic — that duplication is
/// what this replaces.
///
/// A vault comes in two kinds, and the difference is forced by what limits can
/// honestly mean:
///
/// - STABLES holds several dollar-pegged assets under ONE cap. That works
///   because dividing out each token's decimals restates them all in the same
///   dollars: 100 USDT (100e6) and 100 DAI (100e18) are both $100. No price
///   feed is involved, and none is needed — the peg carries the meaning.
/// - COIN holds exactly one asset, and its cap is denominated in that asset or
///   as a share of the balance. Assets whose value moves cannot share a cap
///   without pricing them, and pricing them would put an oracle in the
///   enforcement path of a wallet whose whole promise is enforcement.
///
/// Which tokens count as pegged is decided by whoever creates the vault, from
/// the set the app offers. The contract cannot know what is pegged without an
/// oracle or a governed list; a vault whose owner adds something that is not
/// pegged breaks their own cap and nobody else's.
///
/// @dev Rules — limits, timelocked changes, bypasses, withdrawal addresses —
/// live in the savings account's own modules, keyed by a scope derived from
/// (vaultId, member). This contract owns custody and nothing else.
contract SavingsVaultModule is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    struct Vault {
        address creator;
        uint8 kind;
        uint8 vaultType; // 0 = personal, 1 = community
        bool limitsArePercentage;
        bool isActive;
        uint256 penaltyRateBps;
        uint256 memberCount;
        uint256 createdAt;
        string name;
    }

    ISavingsCore public savingsCore;
    address public treasury;
    uint256 public vaultCount;

    mapping(uint256 => Vault) private vaults;
    /// @dev Which assets a vault accepts. One entry for COIN, the chosen set
    /// for STABLES.
    mapping(uint256 => mapping(address => bool)) private accepted;
    mapping(uint256 => address[]) private acceptedList;
    /// @dev vaultId => token => total held for all members.
    mapping(uint256 => mapping(address => uint256)) private vaultTotals;
    /// @dev vaultId => member => token => balance.
    mapping(uint256 => mapping(address => mapping(address => uint256))) private balances;
    mapping(uint256 => mapping(address => bool)) private isMember;
    mapping(uint256 => address[]) private memberList;
    mapping(address => uint256[]) private userVaultIds;

    bool private locked;

    // ==== APPEND NEW STATE BELOW THIS LINE ONLY ====

    IVaultYieldModule public yieldModule;

    uint8 private constant VAULT_TYPE_PERSONAL = 0;
    uint8 private constant VAULT_TYPE_COMMUNITY = 1;
    uint8 private constant DOLLAR_DECIMALS = 6;
    uint256 private constant MAX_BPS = 10000;
    uint256 private constant MAX_PENALTY_BPS = 5000;
    uint256 private constant MAX_NAME_LENGTH = 32;
    uint256 private constant MAX_ACCEPTED_TOKENS = 8;

    event VaultCreated(uint256 indexed vaultId, address indexed creator, uint8 kind, string name);
    event VaultJoined(uint256 indexed vaultId, address indexed member);
    event Deposited(uint256 indexed vaultId, address indexed member, address indexed token, uint256 amount);
    event Withdrawn(uint256 indexed vaultId, address indexed member, address indexed token, uint256 amount, address destination);

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyMember(uint256 vaultId) {
        require(isMember[vaultId][msg.sender], "Not a vault member");
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

    // ========== LIFECYCLE ==========

    /// @notice Create a vault and lock its rules in, in one transaction.
    ///
    /// The rules are committed immediately, which is what makes every later
    /// change serve the timelock — the same state the savings account reached
    /// when its owner locked in.
    function createVault(
        string calldata name,
        uint8 kind,
        uint8 vaultType,
        address[] calldata tokens,
        bool limitsArePercentage,
        uint256 penaltyRateBps,
        string[] calldata periodNames,
        uint256[] calldata limits,
        uint256[] calldata durations,
        uint256[] calldata unlockDelays
    ) external returns (uint256 vaultId) {
        require(bytes(name).length > 0 && bytes(name).length <= MAX_NAME_LENGTH, "Invalid name");
        require(kind <= VAULT_KIND_STABLES, "Invalid kind");
        require(vaultType <= VAULT_TYPE_COMMUNITY, "Invalid vault type");
        require(penaltyRateBps > 0 && penaltyRateBps <= MAX_PENALTY_BPS, "Invalid penalty rate");
        require(tokens.length > 0 && tokens.length <= MAX_ACCEPTED_TOKENS, "Invalid token set");
        // One asset is what makes a COIN vault's cap mean something in that
        // asset; several is the whole point of a STABLES vault.
        require(kind == VAULT_KIND_STABLES || tokens.length == 1, "Coin vault takes one token");
        // A percentage of a mixed balance would need the assets priced against
        // each other, which is exactly what a stables vault avoids.
        require(kind == VAULT_KIND_COIN || !limitsArePercentage, "Stables vault uses dollar limits");
        require(periodNames.length > 0, "No limits set");
        require(
            periodNames.length == limits.length &&
                periodNames.length == durations.length &&
                periodNames.length == unlockDelays.length,
            "Length mismatch"
        );

        vaultId = ++vaultCount;
        Vault storage vault = vaults[vaultId];
        vault.creator = msg.sender;
        vault.kind = kind;
        vault.vaultType = vaultType;
        vault.limitsArePercentage = limitsArePercentage;
        vault.penaltyRateBps = penaltyRateBps;
        vault.isActive = true;
        vault.createdAt = block.timestamp;
        vault.name = name;

        for (uint256 i = 0; i < tokens.length; i++) {
            require(!accepted[vaultId][tokens[i]], "Duplicate token");
            accepted[vaultId][tokens[i]] = true;
            acceptedList[vaultId].push(tokens[i]);
        }

        _addMember(vaultId, msg.sender);
        _installRules(vaultId, msg.sender, periodNames, limits, durations, unlockDelays, limitsArePercentage);
        emit VaultCreated(vaultId, msg.sender, kind, name);
    }

    function joinVault(uint256 vaultId) external {
        Vault storage vault = _activeVault(vaultId);
        require(vault.vaultType == VAULT_TYPE_COMMUNITY, "Personal vault");
        require(!isMember[vaultId][msg.sender], "Already a member");

        _addMember(vaultId, msg.sender);
        // Members join under the terms they can see: the creator's rules,
        // copied into the joiner's own scope so their counters are their own.
        _limits().migratePeriodsTo(_scope(vaultId, vault.creator), _scope(vaultId, msg.sender));
        _limits().setLimitsArePercentage(_scope(vaultId, msg.sender), vault.limitsArePercentage);
        _proposals().commitInitialSetup(_scope(vaultId, msg.sender));
        emit VaultJoined(vaultId, msg.sender);
    }

    // ========== FUNDS ==========

    function deposit(uint256 vaultId, address token, uint256 amount)
        external
        payable
        nonReentrant
        onlyMember(vaultId)
    {
        _deposit(vaultId, token, amount, msg.sender);
    }

    /// @notice Deposit on someone else's behalf — used by permanent deposit
    /// addresses forwarding funds from an exchange.
    function depositFor(uint256 vaultId, address token, uint256 amount, address beneficiary)
        external
        payable
        nonReentrant
    {
        require(isMember[vaultId][beneficiary], "Not a vault member");
        _deposit(vaultId, token, amount, beneficiary);
    }

    function _deposit(uint256 vaultId, address token, uint256 amount, address beneficiary) private {
        _activeVault(vaultId);
        require(amount > 0, "Invalid amount");
        require(accepted[vaultId][token], "Token not accepted here");

        uint256 credited = amount;
        if (token == address(0)) {
            require(msg.value == amount, "Incorrect ETH amount");
        } else {
            require(msg.value == 0, "ETH not accepted");
            // Credit what actually arrived, so a fee-on-transfer token cannot
            // make the ledger claim more than is held.
            IERC20 erc20 = IERC20(token);
            uint256 before = erc20.balanceOf(address(this));
            erc20.safeTransferFrom(msg.sender, address(this), amount);
            credited = erc20.balanceOf(address(this)) - before;
            require(credited > 0, "Nothing received");
        }

        // Settle before the balance moves and snapshot after, so the depositor
        // is credited for the yield earned on what they held and not a unit
        // more on what they are about to add.
        _settleYield(vaultId, token, beneficiary);
        balances[vaultId][beneficiary][token] += credited;
        vaultTotals[vaultId][token] += credited;
        _snapshotYield(vaultId, token, beneficiary);
        emit Deposited(vaultId, beneficiary, token, credited);

        _investIdle(vaultId, token);
    }

    function withdraw(uint256 vaultId, address token, uint256 amount, address destination)
        external
        nonReentrant
        onlyMember(vaultId)
    {
        enforceNotFrozen(savingsCore, msg.sender);
        _requireApprovedDestination(msg.sender, destination);
        Vault storage vault = _activeVault(vaultId);
        // Earnings land in the balance first, so they can be withdrawn in the
        // same transaction and — where limits are a percentage — count toward
        // what the member is allowed to take.
        _settleYield(vaultId, token, msg.sender);
        require(amount > 0 && amount <= balances[vaultId][msg.sender][token], "Invalid amount");

        // How the amount is measured depends on what the vault holds. A stables
        // vault counts dollars, so several assets share one cap; a coin vault
        // counts that coin, so its cap needs no price at all.
        (uint256 measured, uint256 against) = _measure(vaultId, vault, msg.sender, token, amount);
        _limits().checkAllTimePeriodLimitsFor(_scope(vaultId, msg.sender), measured, against);

        // Bring back only the shortfall, measured against the balance as it
        // still stands — netting it against the reduced total would divest more
        // than the withdrawal needs and stop that much earning for nothing.
        _ensureLiquidity(vaultId, token, amount);

        balances[vaultId][msg.sender][token] -= amount;
        vaultTotals[vaultId][token] -= amount;
        _snapshotYield(vaultId, token, msg.sender);
        _payOut(token, destination, amount);
        emit Withdrawn(vaultId, msg.sender, token, amount, destination);
    }

    /// @dev Returns the amount as the limit counts it, and the balance a
    /// percentage cap would apply to.
    function _measure(
        uint256 vaultId,
        Vault storage vault,
        address member,
        address token,
        uint256 amount
    ) private view returns (uint256 measured, uint256 against) {
        if (vault.kind == VAULT_KIND_STABLES) {
            return (_toDollars(token, amount), _dollarBalance(vaultId, member));
        }
        return (amount, balances[vaultId][member][token]);
    }

    /// @notice A member's whole balance in this vault, in dollars. Only
    /// meaningful for a stables vault, where every asset is pegged to one.
    function dollarBalanceOf(uint256 vaultId, address member) external view returns (uint256) {
        return _dollarBalance(vaultId, member);
    }

    function _dollarBalance(uint256 vaultId, address member) private view returns (uint256 total) {
        address[] storage tokens = acceptedList[vaultId];
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 held = balances[vaultId][member][tokens[i]];
            if (held > 0) total += _toDollars(tokens[i], held);
        }
    }

    /// @dev Restate an amount in the units limits are kept in. Dividing out the
    /// token's decimals is exact for a pegged asset and needs no price feed —
    /// which is the entire reason a stables vault can share one cap and a coin
    /// vault cannot.
    function _toDollars(address token, uint256 amount) private view returns (uint256) {
        uint8 decimals = _decimalsOf(token);
        if (decimals == DOLLAR_DECIMALS) return amount;
        if (decimals > DOLLAR_DECIMALS) return amount / (10 ** (decimals - DOLLAR_DECIMALS));
        return amount * (10 ** (DOLLAR_DECIMALS - decimals));
    }

    function _decimalsOf(address token) private view returns (uint8) {
        if (token == address(0)) return 18;
        try IERC20Metadata(token).decimals() returns (uint8 d) {
            return d;
        } catch {
            return 18;
        }
    }

    // ========== VIEWS ==========

    function getVault(uint256 vaultId)
        external
        view
        returns (
            address creator,
            uint8 kind,
            uint8 vaultType,
            string memory name,
            bool limitsArePercentage,
            uint256 penaltyRateBps,
            uint256 memberCount,
            bool isActive,
            address[] memory tokens
        )
    {
        Vault storage v = vaults[vaultId];
        return (
            v.creator,
            v.kind,
            v.vaultType,
            v.name,
            v.limitsArePercentage,
            v.penaltyRateBps,
            v.memberCount,
            v.isActive,
            acceptedList[vaultId]
        );
    }

    function balanceOf(uint256 vaultId, address member, address token) external view returns (uint256) {
        return balances[vaultId][member][token];
    }

    function totalOf(uint256 vaultId, address token) external view returns (uint256) {
        return vaultTotals[vaultId][token];
    }

    function acceptsToken(uint256 vaultId, address token) external view returns (bool) {
        return accepted[vaultId][token];
    }

    function getUserVaultIds(address user) external view returns (uint256[] memory) {
        return userVaultIds[user];
    }

    function getVaultMembers(uint256 vaultId) external view returns (address[] memory) {
        return memberList[vaultId];
    }

    function getVaultCount() external view returns (uint256) {
        return vaultCount;
    }

    /// @notice Where this member's rules are stored. Domain-separated so it
    /// cannot collide with a real account — a collision would merge a vault's
    /// rules with somebody's savings.
    function vaultScopeOf(uint256 vaultId, address member) external pure returns (address) {
        return _scope(vaultId, member);
    }

    // ========== INTERNALS ==========

    function _scope(uint256 vaultId, address member) private pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encode("LOCKIN_VAULT_SCOPE", vaultId, member)))));
    }

    function _activeVault(uint256 vaultId) private view returns (Vault storage vault) {
        require(vaultId > 0 && vaultId <= vaultCount, "Vault not found");
        vault = vaults[vaultId];
        require(vault.isActive, "Vault not active");
    }

    function _addMember(uint256 vaultId, address member) private {
        vaults[vaultId].memberCount++;
        isMember[vaultId][member] = true;
        memberList[vaultId].push(member);
        userVaultIds[member].push(vaultId);
    }

    function _installRules(
        uint256 vaultId,
        address member,
        string[] calldata names,
        uint256[] calldata limits,
        uint256[] calldata durations,
        uint256[] calldata unlockDelays,
        bool limitsArePercentage
    ) private {
        address scope = _scope(vaultId, member);
        ITimePeriodLimitsModule limitsModule = _limits();
        limitsModule.setPeriodLimits(scope, names, limits, durations, unlockDelays);
        limitsModule.setLimitsArePercentage(scope, limitsArePercentage);
        _proposals().commitInitialSetup(scope);
    }

    /// @dev A destination is the member or one they saved. The list lives in the
    /// approval module under their real address, so every vault they own shares
    /// it — where money may go is a property of the person, not the asset.
    function _requireApprovedDestination(address member, address destination) private view {
        require(destination != address(0), "Invalid destination");
        if (destination == member) return;
        address module = savingsCore.getModule(ModuleIds.APPROVAL_SYSTEM);
        require(module != address(0), "Withdrawal address not approved");
        require(
            IApprovalSystemModule(module).isValidWithdrawalDestination(member, destination),
            "Withdrawal address not approved"
        );
    }

    /// @dev Both fail closed. A limit check that silently did nothing because a
    /// module was missing would be worse than having no limits, because the app
    /// would still promise them.
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

    // ========== EARNING ==========

    /// @notice Point this module at the earning accountant. Until it is set,
    /// every hook below is a no-op and nothing leaves the vault.
    function setYieldModule(address module) external onlyOwner {
        yieldModule = IVaultYieldModule(module);
    }

    /// @notice Turn earning on or off for one of this vault's assets.
    ///
    /// Only the creator, and only for a personal vault: a community vault's
    /// terms are fixed at creation, and one member must not be able to route
    /// everyone else's money into an outside protocol.
    function setYieldMode(uint256 vaultId, address token, uint8 mode) external nonReentrant {
        Vault storage vault = _activeVault(vaultId);
        require(msg.sender == vault.creator, "Not the vault creator");
        // A community vault's terms are what people join under, so its earning
        // setting can only be chosen while the creator is still alone in it.
        require(
            vault.vaultType == VAULT_TYPE_PERSONAL || vault.memberCount == 1,
            "Community yield immutable"
        );
        require(accepted[vaultId][token], "Token not accepted here");
        require(address(yieldModule) != address(0), "Yield module not configured");

        // Switching off has to bring the money home, not merely stop adding to
        // it — otherwise "off" would leave the balance sitting in Aave.
        if (mode == MODE_OFF) yieldModule.divestAll(vaultId, token, address(this));
        yieldModule.setMode(vaultId, token, mode);
        if (mode != MODE_OFF) _investIdle(vaultId, token);
    }

    /// @notice Credit a member their earnings without them having to move any
    /// money. Permissionless, because it can only ever pay the named member.
    function compoundYield(uint256 vaultId, address token, address member) external nonReentrant {
        require(isMember[vaultId][member], "Not a vault member");
        _settleYield(vaultId, token, member);
        _snapshotYield(vaultId, token, member);
    }

    function pendingYield(uint256 vaultId, address token, address member) external view returns (uint256) {
        if (address(yieldModule) == address(0)) return 0;
        return yieldModule.pendingYield(vaultId, token, member);
    }

    /// @dev Yield already sits inside the strategy, so crediting it moves no
    /// tokens — it becomes part of the member's balance and keeps earning.
    function _settleYield(uint256 vaultId, address token, address member) private {
        if (address(yieldModule) == address(0) || token == address(0)) return;
        uint256 credited = yieldModule.settleMember(vaultId, token, member);
        if (credited == 0) return;
        balances[vaultId][member][token] += credited;
        vaultTotals[vaultId][token] += credited;
    }

    function _snapshotYield(uint256 vaultId, address token, address member) private {
        if (address(yieldModule) == address(0) || token == address(0)) return;
        yieldModule.snapshotMember(vaultId, token, member, balances[vaultId][member][token]);
    }

    /// @dev The allowance is what makes this safe to grant: the yield module
    /// pulls exactly what it is about to invest, and the approval is cleared
    /// whether or not it took anything.
    function _investIdle(uint256 vaultId, address token) private {
        if (address(yieldModule) == address(0) || token == address(0)) return;
        uint256 held = vaultTotals[vaultId][token];
        if (held == 0) return;

        IERC20(token).forceApprove(address(yieldModule), held);
        yieldModule.onDeposit(vaultId, token);
        IERC20(token).forceApprove(address(yieldModule), 0);
    }

    function _ensureLiquidity(uint256 vaultId, address token, uint256 amount) private {
        if (address(yieldModule) == address(0) || token == address(0)) return;
        yieldModule.ensureLiquidity(vaultId, token, amount, address(this));
    }

    function _payOut(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            (bool ok, ) = payable(to).call{value: amount}("");
            require(ok, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}
