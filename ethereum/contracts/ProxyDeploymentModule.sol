// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SavingsInterfaces.sol";
import "./UserProxy.sol";

interface IOwnable {
    function owner() external view returns (address);
}

contract ProxyDeploymentModule is IProxyDeploymentModule {
    ISavingsCore public immutable savingsCore;

    mapping(address => address) private userProxies;

    address public treasuryAddress;
    address public paymentToken;
    uint256 public proxyDeploymentFee;

    modifier onlyCore() {
        require(msg.sender == address(savingsCore), "Not authorized: only core");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == IOwnable(address(savingsCore)).owner(), "Not authorized: only owner");
        _;
    }

    constructor(address _savingsCore) {
        require(_savingsCore != address(0), "Invalid core address");
        savingsCore = ISavingsCore(_savingsCore);
    }

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
}
