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

    /// @dev Early-exit penalties, per (vault, token). A stables vault charges
    /// the penalty in whichever coin was pulled out, so the pot that pays the
    /// members who stayed has to be per coin too — paying a USDC penalty out of
    /// the DAI pot would take from people who had nothing to do with it.
    mapping(uint256 => mapping(address => uint256)) private accPenaltyPerShare;
    mapping(uint256 => mapping(address => mapping(address => uint256))) private penaltyDebt;
    mapping(uint256 => mapping(address => mapping(address => uint256))) private unclaimedPenalties;


    /// @dev Which asset a bypass request was made against. The bypass module
    /// records the amount in the units limits are kept in, which for a stables
    /// vault is dollars rather than any one coin — so the coin has to be
    /// remembered here or the payout would not know what to send.
    mapping(bytes32 => address) private bypassToken;

    /// @dev 1-based position in memberList; 0 means "not in the list". Needed
    /// only so leaving does not leave a hole that iteration would trip over.
    mapping(uint256 => mapping(address => uint256)) private memberIndex;

    uint8 private constant VAULT_TYPE_PERSONAL = 0;
    uint8 private constant VAULT_TYPE_COMMUNITY = 1;
    uint8 private constant DOLLAR_DECIMALS = 6;
    uint256 private constant MAX_BPS = 10000;
    uint256 private constant MAX_PENALTY_BPS = 5000;
    uint256 private constant MAX_NAME_LENGTH = 32;
    uint256 private constant MAX_ACCEPTED_TOKENS = 8;
    uint256 private constant PENALTY_PRECISION = 1e12;

    event VaultCreated(uint256 indexed vaultId, address indexed creator, uint8 kind, string name);
    event VaultJoined(uint256 indexed vaultId, address indexed member);
    event VaultLeft(uint256 indexed vaultId, address indexed member);
    event Deposited(uint256 indexed vaultId, address indexed member, address indexed token, uint256 amount);
    event Withdrawn(uint256 indexed vaultId, address indexed member, address indexed token, uint256 amount, address destination);
    event PenaltyPaid(uint256 indexed vaultId, address indexed member, address indexed token, uint256 amount, uint256 penalty);
    event PenaltyRewardsClaimed(uint256 indexed vaultId, address indexed member, address indexed token, uint256 amount);

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
        uint256[] calldata unlockDelays,
        address referrer
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
        _recordReferrer(referrer);
        emit VaultCreated(vaultId, msg.sender, kind, name);
    }

    /// @dev Best-effort by design. Creating your savings must not fail because
    /// the link you followed was stale, already used, or the referral module is
    /// not deployed on this network.
    function _recordReferrer(address referrer) private {
        if (referrer == address(0) || referrer == msg.sender) return;
        address module = savingsCore.getModule(ModuleIds.REFERRAL);
        if (module == address(0)) return;
        try IReferralModule(module).recordReferral(msg.sender, referrer) {} catch {}
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
        _settlePenalties(vaultId, token, beneficiary);
        _settleYield(vaultId, token, beneficiary);
        balances[vaultId][beneficiary][token] += credited;
        vaultTotals[vaultId][token] += credited;
        _snapshotPenalties(vaultId, token, beneficiary);
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
        _settlePenalties(vaultId, token, msg.sender);
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
        _snapshotPenalties(vaultId, token, msg.sender);
        _snapshotYield(vaultId, token, msg.sender);
        _payOut(token, destination, amount);
        emit Withdrawn(vaultId, msg.sender, token, amount, destination);
    }

    /// @notice Take money out past the limits by paying the vault's penalty.
    ///
    /// This is the pressure valve that keeps the limits honest: they can be
    /// escaped, but only at a price the member agreed to when the vault was
    /// created, and the price goes to whoever stayed.
    function withdrawWithPenalty(uint256 vaultId, address token, uint256 amount, address destination)
        external
        nonReentrant
        onlyMember(vaultId)
    {
        enforceNotFrozen(savingsCore, msg.sender);
        _requireApprovedDestination(msg.sender, destination);
        Vault storage vault = _activeVault(vaultId);
        require(accepted[vaultId][token], "Token not accepted here");

        _settlePenalties(vaultId, token, msg.sender);
        _settleYield(vaultId, token, msg.sender);
        require(amount > 0 && amount <= balances[vaultId][msg.sender][token], "Invalid amount");

        uint256 penalty = (amount * vault.penaltyRateBps) / MAX_BPS;
        // The whole amount has to be liquid, not just the member's share: the
        // penalty stays behind as idle tokens for the people it is owed to.
        _ensureLiquidity(vaultId, token, amount);

        balances[vaultId][msg.sender][token] -= amount;
        vaultTotals[vaultId][token] -= amount;

        bool redistribute = vault.vaultType == VAULT_TYPE_COMMUNITY && vaultTotals[vaultId][token] > 0;
        if (redistribute) {
            accPenaltyPerShare[vaultId][token] +=
                (penalty * PENALTY_PRECISION) / vaultTotals[vaultId][token];
        }
        // Snapshot after the accrual, so the withdrawer's remaining balance is
        // excluded from the penalty they just paid.
        _snapshotPenalties(vaultId, token, msg.sender);
        _snapshotYield(vaultId, token, msg.sender);

        _payOut(token, destination, amount - penalty);
        // A personal vault has nobody to share with, so its penalty is ours.
        if (!redistribute && penalty > 0) _payOut(token, treasury, penalty);
        emit PenaltyPaid(vaultId, msg.sender, token, amount, penalty);
    }

    /// @notice Collect the penalties other members paid while you stayed.
    function claimPenaltyRewards(uint256 vaultId, address token)
        external
        nonReentrant
        onlyMember(vaultId)
    {
        enforceNotFrozen(savingsCore, msg.sender);
        _activeVault(vaultId);
        _settlePenalties(vaultId, token, msg.sender);

        uint256 amount = unclaimedPenalties[vaultId][token][msg.sender];
        require(amount > 0, "Nothing to claim");
        unclaimedPenalties[vaultId][token][msg.sender] = 0;

        // No liquidity call: penalties are never invested — they sit outside
        // vaultTotals, which is exactly what the yield module offers to the
        // strategy — so they are always already here.
        _payOut(token, msg.sender, amount);
        emit PenaltyRewardsClaimed(vaultId, msg.sender, token, amount);
    }

    function pendingPenaltyRewards(uint256 vaultId, address token, address member)
        external
        view
        returns (uint256)
    {
        uint256 accumulated =
            (balances[vaultId][member][token] * accPenaltyPerShare[vaultId][token]) / PENALTY_PRECISION;
        uint256 debt = penaltyDebt[vaultId][token][member];
        if (debt > accumulated) debt = accumulated;
        return unclaimedPenalties[vaultId][token][member] + (accumulated - debt);
    }

    /// @dev The clamp matters: a member who arrived after the accumulator moved
    /// carries a debt above what their balance has accumulated, and without it
    /// the subtraction would underflow rather than credit them nothing.
    function _settlePenalties(uint256 vaultId, address token, address member) private {
        uint256 acc = accPenaltyPerShare[vaultId][token];
        if (acc == 0) return;
        uint256 accumulated = (balances[vaultId][member][token] * acc) / PENALTY_PRECISION;
        uint256 debt = penaltyDebt[vaultId][token][member];
        if (debt > accumulated) debt = accumulated;
        if (accumulated > debt) unclaimedPenalties[vaultId][token][member] += accumulated - debt;
        penaltyDebt[vaultId][token][member] = accumulated;
    }

    function _snapshotPenalties(uint256 vaultId, address token, address member) private {
        penaltyDebt[vaultId][token][member] =
            (balances[vaultId][member][token] * accPenaltyPerShare[vaultId][token]) / PENALTY_PRECISION;
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

    /// @dev The inverse of _toDollars. Exact for a 6-decimal stable; for one
    /// with more decimals it can drop sub-cent dust, which is the cost of
    /// letting several coins share a single dollar cap.
    function _fromDollars(address token, uint256 amount) private view returns (uint256) {
        uint8 decimals = _decimalsOf(token);
        if (decimals == DOLLAR_DECIMALS) return amount;
        if (decimals > DOLLAR_DECIMALS) return amount * (10 ** (decimals - DOLLAR_DECIMALS));
        return amount / (10 ** (DOLLAR_DECIMALS - decimals));
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

    /// @notice Membership, for the modules that act on a member's behalf without
    /// holding any of their money — the deposit-address factory, chiefly.
    function isVaultMember(uint256 vaultId, address member) external view returns (bool) {
        return isMember[vaultId][member];
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
        memberIndex[vaultId][member] = memberList[vaultId].length;
        userVaultIds[member].push(vaultId);
    }

    /// @notice Leave a vault you have emptied.
    ///
    /// Everything has to be out first — balance, unclaimed penalties and any
    /// earnings still owed — because leaving deletes the record those are paid
    /// against, and a member who left with yield pending would simply lose it.
    function leaveVault(uint256 vaultId) external nonReentrant onlyMember(vaultId) {
        Vault storage vault = _activeVault(vaultId);
        require(msg.sender != vault.creator, "Creator cannot leave");

        address[] storage tokens = acceptedList[vaultId];
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            _settlePenalties(vaultId, token, msg.sender);
            _settleYield(vaultId, token, msg.sender);
            require(balances[vaultId][msg.sender][token] == 0, "Balance not zero");
            require(unclaimedPenalties[vaultId][token][msg.sender] == 0, "Rewards not claimed");
        }

        vault.memberCount--;
        isMember[vaultId][msg.sender] = false;
        _removeFromMemberList(vaultId, msg.sender);
        _removeUserVaultId(msg.sender, vaultId);
        emit VaultLeft(vaultId, msg.sender);
    }

    /// @dev Swap-and-pop, with the moved member's index kept in step.
    function _removeFromMemberList(uint256 vaultId, address member) private {
        uint256 position = memberIndex[vaultId][member];
        if (position == 0) return;
        address[] storage list = memberList[vaultId];
        uint256 last = list.length - 1;
        if (position - 1 != last) {
            address moved = list[last];
            list[position - 1] = moved;
            memberIndex[vaultId][moved] = position;
        }
        list.pop();
        delete memberIndex[vaultId][member];
    }

    function _removeUserVaultId(address member, uint256 vaultId) private {
        uint256[] storage ids = userVaultIds[member];
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == vaultId) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                return;
            }
        }
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

    // ========== EMERGENCY BYPASS ==========
    //
    // The request and its wait live in BypassSystemModule, under the same scope
    // as the vault's limits — so bypassing a vault limit serves exactly the wait
    // that limit was committed with. Only the payout is here, because only this
    // module holds the money.

    function requestBypass(uint256 vaultId, address token, uint256 amount, string calldata skipPeriod)
        external
        onlyMember(vaultId)
        returns (bytes32 requestId)
    {
        Vault storage vault = _activeVault(vaultId);
        require(accepted[vaultId][token], "Token not accepted here");
        require(amount > 0 && amount <= balances[vaultId][msg.sender][token], "Invalid amount");

        (uint256 measured, uint256 against) = _measure(vaultId, vault, msg.sender, token, amount);
        requestId = _bypass().requestBypassFor(
            _scope(vaultId, msg.sender), measured, skipPeriod, token, against
        );
        bypassToken[requestId] = token;
    }

    function executeBypass(uint256 vaultId, bytes32 requestId, address destination)
        external
        nonReentrant
        onlyMember(vaultId)
    {
        enforceNotFrozen(savingsCore, msg.sender);
        _requireApprovedDestination(msg.sender, destination);
        Vault storage vault = _activeVault(vaultId);

        address token = bypassToken[requestId];
        require(token != address(0) || accepted[vaultId][address(0)], "Request not found");
        delete bypassToken[requestId];

        _settlePenalties(vaultId, token, msg.sender);
        _settleYield(vaultId, token, msg.sender);

        (uint256 measured, ) = _bypass().consumeBypassRequest(_scope(vaultId, msg.sender), requestId);
        uint256 amount = vault.kind == VAULT_KIND_STABLES ? _fromDollars(token, measured) : measured;
        require(amount > 0 && amount <= balances[vaultId][msg.sender][token], "Invalid amount");

        _ensureLiquidity(vaultId, token, amount);
        balances[vaultId][msg.sender][token] -= amount;
        vaultTotals[vaultId][token] -= amount;
        _snapshotPenalties(vaultId, token, msg.sender);
        _snapshotYield(vaultId, token, msg.sender);

        _payOut(token, destination, amount);
        emit Withdrawn(vaultId, msg.sender, token, amount, destination);
    }

    function cancelBypass(uint256 vaultId, bytes32 requestId) external onlyMember(vaultId) {
        delete bypassToken[requestId];
        _bypass().cancelBypassRequest(_scope(vaultId, msg.sender), requestId);
    }

    function _bypass() private view returns (IBypassSystemModule) {
        address module = savingsCore.getModule(ModuleIds.BYPASS_SYSTEM);
        require(module != address(0), "Bypass module not registered");
        return IBypassSystemModule(module);
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
