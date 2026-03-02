// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISavings {
    function depositTo(address to) external payable;
    function deposit(address token, uint256 amount) external payable;
    function deposit(address token, uint256 amount, address beneficiary) external payable;
}

contract UserProxy {
    address public immutable mainContract;
    address public immutable owner;

    event ProxyDeposit(address indexed token, uint256 amount, address indexed owner);

    constructor(address _mainContract, address _owner) {
        require(_mainContract != address(0), "Invalid main contract");
        require(_owner != address(0), "Invalid owner");
        mainContract = _mainContract;
        owner = _owner;
    }

    // Receive ETH and forward to main contract
    receive() external payable {
        require(msg.value > 0, "No ETH sent");
        ISavings(mainContract).depositTo{value: msg.value}(owner);
        emit ProxyDeposit(address(0), msg.value, owner);
    }

    // Handle ERC20 token deposits
    function depositERC20(address token, uint256 amount) external {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than zero");

        // Transfer tokens from sender to this proxy
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Approve main contract to spend tokens
        IERC20(token).approve(mainContract, amount);

        // Deposit tokens to main contract for the owner
        ISavings(mainContract).deposit(token, amount);

        emit ProxyDeposit(token, amount, owner);
    }

    // Sweep ERC20 tokens sent directly to proxy into savings for owner
    // Permissionless - anyone can call, funds always go to the owner's savings
    function sweepERC20(address token) external {
        require(token != address(0), "Use receive() for ETH");
        IERC20 tokenContract = IERC20(token);
        uint256 balance = tokenContract.balanceOf(address(this));
        require(balance > 0, "No tokens to sweep");

        tokenContract.approve(mainContract, balance);
        ISavings(mainContract).deposit(token, balance, owner);

        emit ProxyDeposit(token, balance, owner);
    }

    // Emergency function to recover stuck tokens (only owner)
    function emergencyWithdraw(address token) external {
        require(msg.sender == owner, "Only owner can withdraw");

        if (token == address(0)) {
            // Withdraw ETH
            uint256 balance = address(this).balance;
            if (balance > 0) {
                payable(owner).transfer(balance);
            }
        } else {
            // Withdraw ERC20 tokens
            IERC20 tokenContract = IERC20(token);
            uint256 balance = tokenContract.balanceOf(address(this));
            if (balance > 0) {
                tokenContract.transfer(owner, balance);
            }
        }
    }

    // View function to get proxy info
    function getProxyInfo() external view returns (address, address) {
        return (mainContract, owner);
    }
}