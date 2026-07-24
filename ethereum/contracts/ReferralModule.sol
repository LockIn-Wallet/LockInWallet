// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./SavingsInterfaces.sol";

contract ReferralModule is Initializable, UUPSUpgradeable, OwnableUpgradeable, IReferralModule {
    ISavingsCore public savingsCore;

    struct ReferralRecord {
        address referrer;
        uint64 referredAt;
    }

    // Invitee => who referred them (recorded once, at setup commit)
    mapping(address => ReferralRecord) private referralOf;

    // Referrer => list of invitees
    mapping(address => address[]) private referredUsers;

    modifier onlyCore() {
        require(msg.sender == address(savingsCore), "Only core contract");
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

    function recordReferral(address user, address referrer) external onlyCore {
        require(referrer != address(0), "Invalid referrer");
        require(referrer != user, "Cannot refer yourself");
        require(referralOf[user].referrer == address(0), "Referrer already recorded");

        referralOf[user] = ReferralRecord(referrer, uint64(block.timestamp));
        referredUsers[referrer].push(user);

        emit ReferralRecorded(user, referrer, block.timestamp);
    }

    // ========== VIEW FUNCTIONS ==========

    function getReferrer(address user) external view returns (address referrer, uint256 referredAt) {
        ReferralRecord storage record = referralOf[user];
        return (record.referrer, record.referredAt);
    }

    function getReferralCount(address referrer) external view returns (uint256) {
        return referredUsers[referrer].length;
    }

    function getReferredUsers(address referrer, uint256 offset, uint256 limit)
        external view returns (address[] memory users, uint256[] memory joinedAt)
    {
        address[] storage all = referredUsers[referrer];
        uint256 total = all.length;

        if (offset >= total) {
            return (new address[](0), new uint256[](0));
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        users = new address[](size);
        joinedAt = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            address user = all[offset + i];
            users[i] = user;
            joinedAt[i] = referralOf[user].referredAt;
        }
    }
}
