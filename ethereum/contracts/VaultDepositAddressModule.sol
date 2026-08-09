// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./SavingsInterfaces.sol";
import "./SavingsVaultDepositProxy.sol";

interface ISavingsVaultMembership {
    function isVaultMember(uint256 vaultId, address member) external view returns (bool);
}

/// @title VaultDepositAddressModule
/// @notice The factory for members' permanent deposit addresses.
///
/// This is separate from the vault module for one reason: predicting an address
/// before it exists means holding the proxy's entire creation code, which cost
/// the vault module 2.7KB and left it inside 4KB of the 24KB ceiling. That is
/// the same slope the old VaultSystemModule slid down until it would not deploy
/// at all, and the fix then was the same as the fix now — move out whatever does
/// not need custody.
///
/// Nothing here can move money. It deploys proxies that pay into the vault
/// module and checks that the caller is a member; every transfer is settled by
/// the vault module under its own rules.
contract VaultDepositAddressModule is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    ISavingsCore public savingsCore;

    /// @dev vaultId => member => their deposit address, once deployed.
    mapping(uint256 => mapping(address => address)) private proxies;

    // ==== APPEND NEW STATE BELOW THIS LINE ONLY ====

    event DepositAddressDeployed(uint256 indexed vaultId, address indexed member, address proxy);

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

    /// @notice Deploy the caller's permanent deposit address for this vault.
    ///
    /// It lands at the address `depositAddressOf` already predicted, so a member
    /// can be shown their address and hand it to an exchange before any contract
    /// exists there — and money that arrives meanwhile is not lost, it waits to
    /// be swept in once the address is deployed.
    function deployDepositAddress(uint256 vaultId) external returns (address proxy) {
        address vaults = _vaults();
        require(ISavingsVaultMembership(vaults).isVaultMember(vaultId, msg.sender), "Not a vault member");
        require(proxies[vaultId][msg.sender] == address(0), "Already deployed");

        proxy = address(
            new SavingsVaultDepositProxy{salt: _salt(vaultId, msg.sender)}(vaults, vaultId, msg.sender)
        );
        proxies[vaultId][msg.sender] = proxy;
        emit DepositAddressDeployed(vaultId, msg.sender, proxy);
    }

    /// @notice Where this member's deposit address is, or will be.
    function depositAddressOf(uint256 vaultId, address member) public view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                _salt(vaultId, member),
                keccak256(
                    abi.encodePacked(
                        type(SavingsVaultDepositProxy).creationCode,
                        abi.encode(_vaults(), vaultId, member)
                    )
                )
            )
        );
        return address(uint160(uint256(hash)));
    }

    function isDepositAddressDeployed(uint256 vaultId, address member) external view returns (bool) {
        return proxies[vaultId][member] != address(0);
    }

    function _salt(uint256 vaultId, address member) private pure returns (bytes32) {
        return keccak256(abi.encode(vaultId, member));
    }

    /// @dev Fails closed. A predicted address computed against the wrong vault
    /// module would be an address nobody can ever sweep.
    function _vaults() private view returns (address) {
        address module = savingsCore.getModule(ModuleIds.SAVINGS_VAULTS);
        require(module != address(0), "Vault module not registered");
        return module;
    }
}
