// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./SavingsInterfaces.sol";

/**
 * @title LegacyReferralModule
 * @notice Test fixture only — the pre-privacy ReferralModule, kept so tests can
 *         upgrade a proxy that already holds invitee lists in `referredUsers`
 *         and prove ReferralModule still counts those referrals. Not deployed
 *         by any deployment script.
 */
contract LegacyReferralModule is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    ISavingsCore public savingsCore;

    struct ReferralRecord {
        address referrer;
        uint64 referredAt;
    }

    mapping(address => ReferralRecord) private referralOf;
    mapping(address => address[]) private referredUsers;

    event ReferralRecorded(address indexed user, address indexed referrer, uint256 timestamp);

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

    function recordReferral(address user, address referrer) external onlyAuthorized {
        require(referrer != address(0), "Invalid referrer");
        require(referrer != user, "Cannot refer yourself");
        require(referralOf[user].referrer == address(0), "Referrer already recorded");

        referralOf[user] = ReferralRecord(referrer, uint64(block.timestamp));
        referredUsers[referrer].push(user);

        emit ReferralRecorded(user, referrer, block.timestamp);
    }

    function getReferralCount(address referrer) external view returns (uint256) {
        return referredUsers[referrer].length;
    }

    function getReferrer(address user) external view returns (address referrer, uint256 referredAt) {
        ReferralRecord storage record = referralOf[user];
        return (record.referrer, record.referredAt);
    }
}
