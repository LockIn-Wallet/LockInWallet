// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./SavingsInterfaces.sol";

/// @title RecoverySystemModule
/// @notice Seed-compromise protection. Users register a cold recovery key
/// that can freeze the account, veto hostile recovery-key changes, and move
/// account ownership to a fresh address — while the (possibly compromised)
/// hot key can only change the recovery key through a long, cancellable
/// timelock. Defensive actions are instant, offensive ones are delayed, so
/// any race between the real owner and an attacker holding the same seed
/// resolves in favor of whoever holds the recovery key.
///
/// Asymmetry rules:
/// - freeze:            hot key or recovery key, instant
/// - unfreeze:          recovery key only
/// - change recovery:   hot key via 30-day timelock (vetoable), recovery key instantly
/// - recoverOwnership:  recovery key only, instant; permanently disables the old account
contract RecoverySystemModule is Initializable, UUPSUpgradeable, OwnableUpgradeable, IRecoverySystemModule {
    struct RecoveryConfig {
        address recoveryAddress;
        bool frozen;
        bool recovered;   // permanently disabled after ownership recovery
    }

    struct RecoveryKeyChangeRequest {
        address newRecovery;
        uint256 executeAfter;
        bool exists;
    }

    ISavingsCore public savingsCore;

    mapping(address => RecoveryConfig) private userRecovery;
    mapping(address => RecoveryKeyChangeRequest) private pendingKeyChanges;

    // Appended for upgrades: proposed recovery keys awaiting on-chain
    // acceptance. A key only becomes active once it accepts, proving the
    // user controls it AND that it can transact — an unverified key would
    // turn any freeze into a permanent lock.
    mapping(address => address) private pendingRecoveryKeys;

    // Appended for upgrades — where each recovered account was moved to, so a
    // repeat call for the remaining tokens cannot redirect them elsewhere.
    mapping(address => address) private recoveredTo;

    modifier onlyRecoveryKey(address user) {
        address recovery = userRecovery[user].recoveryAddress;
        require(recovery != address(0) && msg.sender == recovery, "Only recovery key");
        _;
    }

    modifier notRecovered(address user) {
        require(!userRecovery[user].recovered, "Account was recovered");
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
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ========== RECOVERY KEY MANAGEMENT ==========

    /// @notice Propose the initial recovery key. Activation requires the
    /// proposed key to call acceptRecoveryRole — until then no freeze or
    /// recovery power exists. Re-proposing overwrites (fixes typos); only
    /// allowed while no recovery key is active.
    function setRecoveryAddress(address recovery) external notRecovered(msg.sender) {
        RecoveryConfig storage config = userRecovery[msg.sender];
        require(config.recoveryAddress == address(0), "Recovery key already set - use timelocked change");
        require(recovery != address(0), "Invalid recovery address");
        require(recovery != msg.sender, "Recovery key must differ from account key");

        pendingRecoveryKeys[msg.sender] = recovery;
        emit RecoveryKeyProposed(msg.sender, recovery, msg.sender);
    }

    /// @notice The proposed recovery key confirms it exists, is controlled,
    /// and can transact. Only now does protection activate (or rotate).
    function acceptRecoveryRole(address user) external notRecovered(user) {
        require(pendingRecoveryKeys[user] == msg.sender, "Not the proposed recovery key");

        userRecovery[user].recoveryAddress = msg.sender;
        delete pendingRecoveryKeys[user];
        emit RecoveryAddressSet(user, msg.sender, msg.sender);
    }

    /// @notice Withdraw one's own not-yet-accepted proposal. Harmless even
    /// from a compromised key: a pending proposal has no powers yet, and an
    /// already-active recovery key is untouched.
    function cancelRecoveryKeyProposal() external {
        require(pendingRecoveryKeys[msg.sender] != address(0), "No pending proposal");

        delete pendingRecoveryKeys[msg.sender];
        emit RecoveryKeyProposalCancelled(msg.sender);
    }

    /// @notice Recovery key rotates itself (e.g. new hardware wallet). The
    /// current key stays active until the new one accepts.
    function updateRecoveryAddress(address user, address newRecovery) external onlyRecoveryKey(user) notRecovered(user) {
        require(newRecovery != address(0), "Invalid recovery address");
        require(newRecovery != user, "Recovery key must differ from account key");

        pendingRecoveryKeys[user] = newRecovery;
        emit RecoveryKeyProposed(user, newRecovery, msg.sender);
    }

    /// @notice Hot key requests a recovery-key change (or removal via
    /// address(0)). Long timelock so the real owner can veto with the cold key.
    function requestRecoveryAddressChange(address newRecovery) external notRecovered(msg.sender) {
        RecoveryConfig storage config = userRecovery[msg.sender];
        require(config.recoveryAddress != address(0), "No recovery key set");
        require(!config.frozen, "Account is frozen");
        require(newRecovery != msg.sender, "Recovery key must differ from account key");

        uint256 timelockDuration = savingsCore.getDevelopmentMode() ? 60 seconds : 30 days;
        pendingKeyChanges[msg.sender] = RecoveryKeyChangeRequest({
            newRecovery: newRecovery,
            executeAfter: block.timestamp + timelockDuration,
            exists: true
        });

        emit RecoveryAddressChangeRequested(msg.sender, newRecovery, block.timestamp + timelockDuration);
    }

    function executeRecoveryAddressChange() external notRecovered(msg.sender) {
        RecoveryConfig storage config = userRecovery[msg.sender];
        RecoveryKeyChangeRequest storage request = pendingKeyChanges[msg.sender];
        require(request.exists, "No pending change");
        require(block.timestamp >= request.executeAfter, "Still in timelock");
        require(!config.frozen, "Account is frozen");

        address newRecovery = request.newRecovery;
        delete pendingKeyChanges[msg.sender];

        if (newRecovery == address(0)) {
            // Removal needs no acceptance — there is no new key to verify
            config.recoveryAddress = address(0);
        } else {
            // The old key keeps protecting the account until the new one
            // proves itself by accepting
            pendingRecoveryKeys[msg.sender] = newRecovery;
            emit RecoveryKeyProposed(msg.sender, newRecovery, msg.sender);
        }

        emit RecoveryAddressChangeExecuted(msg.sender, newRecovery);
    }

    /// @notice Veto a pending recovery-key change. Defensive, so it is
    /// instant and allowed for both the account key and the recovery key.
    function cancelRecoveryAddressChange(address user) external {
        require(
            msg.sender == user || msg.sender == userRecovery[user].recoveryAddress,
            "Not authorized"
        );
        require(pendingKeyChanges[user].exists, "No pending change");

        delete pendingKeyChanges[user];
        emit RecoveryAddressChangeCancelled(user, msg.sender);
    }

    // ========== FREEZE MANAGEMENT ==========

    /// @notice Instantly freeze all outgoing funds movement for `user`.
    /// Allowed from the hot key too: worst case an attacker locks the account
    /// until the recovery key unfreezes it — freezing never moves money.
    function freeze(address user) external notRecovered(user) {
        RecoveryConfig storage config = userRecovery[user];
        require(config.recoveryAddress != address(0), "No recovery key set");
        require(
            msg.sender == user || msg.sender == config.recoveryAddress,
            "Not authorized"
        );
        require(!config.frozen, "Already frozen");

        config.frozen = true;
        emit AccountFrozen(user, msg.sender);
    }

    function unfreeze(address user) external onlyRecoveryKey(user) notRecovered(user) {
        require(userRecovery[user].frozen, "Not frozen");

        userRecovery[user].frozen = false;
        emit AccountUnfrozen(user);
    }

    // ========== OWNERSHIP RECOVERY ==========

    /// @notice Move the account to a fresh, uncompromised address. Transfers
    /// the core balances for the given tokens, permanently disables the old
    /// address, and carries the recovery key over to the new account.
    /// @param tokens Token addresses to migrate (address(0) = ETH). Balances
    /// the caller omits stay retrievable: this function can run again for the
    /// same old owner and remaining tokens.
    function recoverOwnership(
        address user,
        address newOwner,
        address[] calldata tokens
    ) external onlyRecoveryKey(user) {
        require(newOwner != address(0) && newOwner != user, "Invalid new owner");
        require(!userRecovery[newOwner].recovered, "New owner was recovered");

        RecoveryConfig storage config = userRecovery[user];
        bool firstRecovery = !config.recovered;

        // The account may only ever land on one address. Without this, funds
        // could be recovered into a *different* wallet that was already locked
        // in under looser limits — the rules below would refuse to migrate and
        // the balances would arrive subject to that wallet's limits instead,
        // turning recovery into an escape from the lock.
        if (firstRecovery) {
            recoveredTo[user] = newOwner;
        } else {
            require(recoveredTo[user] == newOwner, "Already recovered elsewhere");
        }

        config.recovered = true;
        config.frozen = true;
        delete pendingKeyChanges[user];
        delete pendingRecoveryKeys[user];

        // Carry the recovery key over so the new account is protected from day one
        if (userRecovery[newOwner].recoveryAddress == address(0)) {
            userRecovery[newOwner].recoveryAddress = msg.sender;
            emit RecoveryAddressSet(newOwner, msg.sender, msg.sender);
        }

        // Carry the spending rules across before the funds. Recovery replaces
        // the key that controls an account — it is not a way out of the limits
        // that account committed to, so the new address inherits them, spent
        // counters and all. Only the first call migrates; a repeat call for the
        // remaining tokens goes to the same address, whose rules are already in
        // place.
        if (firstRecovery) {
            _migrateSpendingRules(user, newOwner);
        }

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = savingsCore.getTokenBalance(user, tokens[i]);
            if (balance > 0) {
                savingsCore.updateTokenBalance(user, tokens[i], balance, false);
                savingsCore.updateTokenBalance(newOwner, tokens[i], balance, true);
            }
        }

        emit OwnershipRecovered(user, newOwner, tokens.length);
    }

    /// @dev Copy the spending periods and the committed-setup flag onto the
    ///      recovered address. Deliberately not wrapped in try/catch: both
    ///      migrations refuse a target that already carries its own rules, and
    ///      that refusal is the point — recovering into a wallet locked under
    ///      looser limits must fail loudly, not quietly move the funds there.
    ///      Skipped only where a module is absent from this deployment.
    function _migrateSpendingRules(address user, address newOwner) internal {
        address limits = savingsCore.getModule(ModuleIds.TIME_PERIOD_LIMITS);
        if (limits != address(0)) {
            ITimePeriodLimitsModule(limits).migratePeriodsTo(user, newOwner);
        }
        address proposals = savingsCore.getModule(ModuleIds.PROPOSAL_SYSTEM);
        if (proposals != address(0)) {
            IProposalSystemModule(proposals).migrateSetupTo(user, newOwner);
        }
    }

    // ========== VIEW FUNCTIONS ==========

    function getRecoveryConfig(address user) external view returns (address recoveryAddress, bool frozen, bool recovered) {
        RecoveryConfig storage config = userRecovery[user];
        return (config.recoveryAddress, config.frozen, config.recovered);
    }

    function getPendingRecoveryKey(address user) external view returns (address) {
        return pendingRecoveryKeys[user];
    }

    function getPendingRecoveryAddressChange(address user) external view returns (address newRecovery, uint256 executeAfter, bool exists) {
        RecoveryKeyChangeRequest storage request = pendingKeyChanges[user];
        return (request.newRecovery, request.executeAfter, request.exists);
    }

    function isFrozen(address user) public view returns (bool) {
        RecoveryConfig storage config = userRecovery[user];
        return config.frozen || config.recovered;
    }

    function requireNotFrozen(address user) external view {
        require(!isFrozen(user), "Account is frozen");
    }
}
