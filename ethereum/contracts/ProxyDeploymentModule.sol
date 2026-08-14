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

    // Users act on their own data directly; the core and modules keep access
    // for cross-module orchestration (Pattern B self-authentication)
    function _requireAuthorizedOrSelf(address user) internal view {
        require(
            msg.sender == user ||
            msg.sender == address(savingsCore) ||
            savingsCore.isAuthorizedModule(msg.sender),
            "Not authorized"
        );
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

    /// @notice Deploy a user's permanent deposit address.
    /// @dev Permissionless while no fee is charged. The proxy address is
    /// derived from `user`, and everything that lands on it can only ever reach
    /// that user's savings — so a stranger who deploys it can do nothing but a
    /// favour, and paying the gas on a new saver's behalf is exactly the
    /// favour we want. It is the same reasoning that makes `sweepERC20`
    /// permissionless.
    ///
    /// A non-zero fee is charged to `user`, so that path stays restricted to
    /// the user (or the core) — otherwise anyone could spend someone else's
    /// ERC20 approval by deploying for them.
    function deployUserProxy(address user) external payable returns (address proxy) {
        require(user != address(0), "Invalid user");
        require(userProxies[user] == address(0), "Already deployed");

        if (proxyDeploymentFee > 0) {
            _requireAuthorizedOrSelf(user);
            require(treasuryAddress != address(0), "Treasury address not configured");
            if (paymentToken == address(0)) {
                // Pay in native ETH
                require(msg.value >= proxyDeploymentFee, "Insufficient ETH for fee");
                (bool sent, ) = treasuryAddress.call{value: msg.value}("");
                require(sent, "ETH transfer failed");
            } else {
                // Pay in ERC20
                IERC20(paymentToken).transferFrom(user, treasuryAddress, proxyDeploymentFee);
            }
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

    /// @notice A user's permanent deposit address: the deployed proxy if one
    /// exists, otherwise the CREATE2 address `deployUserProxy` would produce.
    /// @dev The stored address wins deliberately. The counterfactual is derived
    /// from `type(UserProxy).creationCode` as it is *today*, so any change to
    /// UserProxy would otherwise silently hand every existing user a different
    /// address than the proxy they already have — and funds sent there could
    /// never be reached, since `deployUserProxy` refuses a second deployment.
    function getUserDepositAddress(address user) external view returns (address) {
        address deployed = userProxies[user];
        if (deployed != address(0)) {
            return deployed;
        }

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
        // address(0) means native ETH payment
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
