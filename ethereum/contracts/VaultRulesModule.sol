// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./SavingsInterfaces.sol";

/// @title VaultRulesModule
/// @notice Changing a vault's spending rules, on behalf of its members.
///
/// This is the savings account's own pattern applied to vaults: the account
/// keeps limits, proposals, bypasses and approvals in four separate modules
/// because one contract holding all of it does not fit in 24KB. VaultSystemModule
/// hit exactly that ceiling, so the parts that do not need custody moved here.
///
/// Nothing in this contract can move money. It reads who a member is, derives
/// their rule scope from the vault module, and forwards to the proposal module —
/// so the contract that custodies vault funds stays as small as it can be, which
/// is where size discipline matters most.
contract VaultRulesModule is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    ISavingsCore public savingsCore;

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

    // ========== RULE CHANGES ==========

    /// @notice Propose a change to one of a vault's spending limits. It applies
    /// only after that period's own wait, exactly as on the savings account.
    function proposeVaultLimitChange(uint256 vaultId, string calldata periodName, uint256 newLimit)
        external
        returns (bytes32 proposalId)
    {
        return _proposals().proposeLimitChange(_scopeFor(vaultId), periodName, newLimit);
    }

    /// @notice Propose a change to how long one of a vault's limits takes to
    /// change. Serves the current wait, so shortening it costs the old one.
    function proposeVaultUnlockDelayChange(
        uint256 vaultId,
        string calldata periodName,
        uint256 newUnlockDelay
    ) external returns (bytes32 proposalId) {
        return _proposals().proposeUnlockDelayChange(_scopeFor(vaultId), periodName, newUnlockDelay);
    }

    function executeVaultLimitProposal(uint256 vaultId, bytes32 proposalId) external {
        _proposals().executeLimitProposal(_scopeFor(vaultId), proposalId);
    }

    function cancelVaultLimitProposal(uint256 vaultId, bytes32 proposalId) external {
        _proposals().cancelLimitProposal(_scopeFor(vaultId), proposalId);
    }

    // ========== VIEWS ==========

    /// @notice A member's pending rule changes, straight from the proposal
    /// module — the same store the savings account's changes live in.
    function getPendingVaultRuleChanges(uint256 vaultId, address member)
        external
        view
        returns (
            bytes32[] memory proposalIds,
            string[] memory categories,
            uint256[] memory newLimits,
            uint256[] memory executeAfters
        )
    {
        address scope = _vaults().vaultScopeOf(vaultId, member);
        (proposalIds, categories, newLimits, executeAfters, , , ) =
            _proposals().getUserPendingProposals(scope);
    }

    // ========== INTERNALS ==========

    /// @dev The caller's own rule scope, and proof they may change it: a
    /// member of the vault, and only for a personal one — a community vault's
    /// terms are fixed when it is created so nobody can move them afterwards.
    function _scopeFor(uint256 vaultId) private view returns (address) {
        ISavingsVaultModule vaults = _vaults();
        require(vaults.isVaultMember(vaultId, msg.sender), "Not a vault member");
        require(vaults.vaultTypeOf(vaultId) == 0, "Community rules immutable");
        return vaults.vaultScopeOf(vaultId, msg.sender);
    }

    /// @dev Both fail closed, for the same reason the vault module's do: a rule
    /// change that silently did nothing is worse than one that refuses.
    function _vaults() private view returns (ISavingsVaultModule) {
        address module = savingsCore.getModule(ModuleIds.SAVINGS_VAULTS);
        require(module != address(0), "Vault module not registered");
        return ISavingsVaultModule(module);
    }

    function _proposals() private view returns (IProposalSystemModule) {
        address module = savingsCore.getModule(ModuleIds.PROPOSAL_SYSTEM);
        require(module != address(0), "Proposal module not registered");
        return IProposalSystemModule(module);
    }
}
