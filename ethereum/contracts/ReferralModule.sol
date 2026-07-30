// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./SavingsInterfaces.sol";

/**
 * @title ReferralModule
 * @notice Records who invited whom, once, at lock-in.
 *
 *         A referrer only ever learns *how many* people they invited, never
 *         which wallets: balances on this chain are public, so an invitee list
 *         would turn a referral reward into a window into that person's
 *         savings. Hence no list view, no invitee in the event, and a
 *         self-only reverse lookup.
 *
 *         This is friction, not cryptography — storage is readable by slot,
 *         `eth_call` lets the caller pick `from`, and the lock-in transaction
 *         carries the referrer in its calldata. Closing that gap needs blinded
 *         attribution; see REFERRAL_INCENTIVES.md §8.
 */
contract ReferralModule is Initializable, UUPSUpgradeable, OwnableUpgradeable, IReferralModule {
    ISavingsCore public savingsCore;

    struct ReferralRecord {
        address referrer;
        uint64 referredAt;
    }

    // Invitee => who referred them (recorded once, at setup commit)
    mapping(address => ReferralRecord) private referralOf;

    /// Deprecated: the per-referrer invitee list. No longer written or read as
    /// a list — a referrer must not be able to enumerate the wallets they
    /// invited. Kept declared so the storage layout stays upgrade-compatible,
    /// and its lengths still count towards getReferralCount so pre-upgrade
    /// referrals aren't lost.
    /// @custom:oz-renamed-from referredUsers
    mapping(address => address[]) private legacyReferredUsers;

    // Referrer => number of invitees recorded after the list was retired
    mapping(address => uint256) private referralCountOf;

    modifier onlyAuthorized() {
        require(
            msg.sender == address(savingsCore) ||
            savingsCore.isAuthorizedModule(msg.sender),
            "Not authorized"
        );
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

    // ========== REFERRAL RECORDING ==========

    function recordReferral(address user, address referrer) external onlyAuthorized {
        require(referrer != address(0), "Invalid referrer");
        require(referrer != user, "Cannot refer yourself");
        require(referralOf[user].referrer == address(0), "Referrer already recorded");

        referralOf[user] = ReferralRecord(referrer, uint64(block.timestamp));
        referralCountOf[referrer] += 1;

        // The invitee is deliberately absent from the event: an indexed invitee
        // makes the referrer => invitee mapping a one-call log query, which is
        // the cheapest way to link a referrer to their invitees' balances.
        emit ReferralRecorded(referrer, _referralCount(referrer), block.timestamp);
    }

    // ========== VIEW FUNCTIONS ==========

    /**
     * @notice Who referred `user`. Restricted to the user themselves and to
     *         authorized modules (fee hooks look up the referrer at collection
     *         time) so the public ABI can't be used to walk known signups and
     *         rebuild a referrer's invitee list.
     */
    function getReferrer(address user) external view returns (address referrer, uint256 referredAt) {
        require(
            msg.sender == user ||
            msg.sender == address(savingsCore) ||
            savingsCore.isAuthorizedModule(msg.sender),
            "Referral lookup is self-only"
        );

        ReferralRecord storage record = referralOf[user];
        return (record.referrer, record.referredAt);
    }

    function getReferralCount(address referrer) external view returns (uint256) {
        return _referralCount(referrer);
    }

    /// Post-upgrade counter plus the length of the retired invitee list, so
    /// referrals recorded before the list was retired still count.
    function _referralCount(address referrer) internal view returns (uint256) {
        return referralCountOf[referrer] + legacyReferredUsers[referrer].length;
    }
}
