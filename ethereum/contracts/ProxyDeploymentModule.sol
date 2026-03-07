// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./SavingsInterfaces.sol";
import "./UserProxy.sol";

interface IOwnable {
    function owner() external view returns (address);
}

contract ProxyDeploymentModule is Initializable, UUPSUpgradeable, OwnableUpgradeable, IProxyDeploymentModule {
    ISavingsCore public savingsCore;

    mapping(address => address) private userProxies;

    address public treasuryAddress;
    address public paymentToken;
    uint256 public proxyDeploymentFee;

    // Migration flag
    bool public migrationComplete;

    modifier onlyCore() {
        require(msg.sender == address(savingsCore), "Not authorized: only core");
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

    function deployUserProxy(address user) external onlyCore returns (address proxy) {
        require(userProxies[user] == address(0), "Already deployed");

        if (proxyDeploymentFee > 0) {
            require(paymentToken != address(0), "Payment token not configured");
            require(treasuryAddress != address(0), "Treasury address not configured");
            IERC20(paymentToken).transferFrom(user, treasuryAddress, proxyDeploymentFee);
        }

        bytes32 salt = keccak256(abi.encodePacked(user));
        proxy = address(new UserProxy{salt: salt}(address(savingsCore), user));

        userProxies[user] = proxy;
        emit ProxyDeployed(user, proxy);

        return proxy;
    }

    function isProxyDeployed(address user) external view returns (bool) {
        return userProxies[user] != address(0);
    }

    function getUserProxy(address user) external view returns (address) {
        return userProxies[user];
    }

    function getUserDepositAddress(address user) external view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(user));
        bytes32 bytecodeHash = keccak256(abi.encodePacked(
            type(UserProxy).creationCode,
            abi.encode(address(savingsCore), user)
        ));

        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            bytecodeHash
        )))));
    }

    function setTreasuryAddress(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        treasuryAddress = _treasury;
    }

    function setPaymentToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid payment token address");
        paymentToken = _token;
    }

    function setProxyDeploymentFee(uint256 _fee) external onlyOwner {
        proxyDeploymentFee = _fee;
    }

    function getProxyDeploymentFee() external view returns (uint256) {
        return proxyDeploymentFee;
    }

    // Migration: register existing proxies during one-time migration from old module
    function registerExistingProxy(address user, address proxy) external onlyOwner {
        require(!migrationComplete, "Migration already complete");
        require(user != address(0), "Invalid user");
        require(proxy != address(0), "Invalid proxy");
        require(userProxies[user] == address(0), "Already registered");
        userProxies[user] = proxy;
        emit ProxyDeployed(user, proxy);
    }

    function lockMigration() external onlyOwner {
        migrationComplete = true;
    }
}
