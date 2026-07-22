// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SavingsInterfaces.sol";

/// @title VaultDepositProxy
/// @notice Permanent deposit address bound to one vault. Funds sent here are
/// forwarded into the vault and credited to its beneficiary, so exchanges can
/// withdraw straight into a specific vault. Deployed via CREATE2 by
/// VaultSystemModule, one per vault.
contract VaultDepositProxy {
    IVaultSystemModule public immutable vaultModule;
    uint256 public immutable vaultId;
    address public immutable beneficiary;

    event ProxyVaultDeposit(address indexed token, uint256 amount, uint256 indexed vaultId);

    constructor(address _vaultModule, uint256 _vaultId, address _beneficiary) {
        require(_vaultModule != address(0), "Invalid module");
        require(_beneficiary != address(0), "Invalid beneficiary");
        vaultModule = IVaultSystemModule(_vaultModule);
        vaultId = _vaultId;
        beneficiary = _beneficiary;
    }

    // Forward received ETH straight into the vault
    receive() external payable {
        require(msg.value > 0, "No ETH sent");
        vaultModule.depositFor{value: msg.value}(vaultId, msg.value, beneficiary);
        emit ProxyVaultDeposit(address(0), msg.value, vaultId);
    }

    /// @notice Forward ETH that arrived without triggering receive (e.g. selfdestruct).
    /// Permissionless — funds always go to the vault's beneficiary.
    function sweepETH() external {
        uint256 balance = address(this).balance;
        require(balance > 0, "Nothing to sweep");
        vaultModule.depositFor{value: balance}(vaultId, balance, beneficiary);
        emit ProxyVaultDeposit(address(0), balance, vaultId);
    }

    /// @notice Forward ERC20 tokens sent directly to this address into the vault.
    /// Permissionless — funds always go to the vault's beneficiary.
    function sweepERC20(address token) external {
        require(token != address(0), "Use sweepETH for ETH");
        IERC20 tokenContract = IERC20(token);
        uint256 balance = tokenContract.balanceOf(address(this));
        require(balance > 0, "Nothing to sweep");

        tokenContract.approve(address(vaultModule), balance);
        vaultModule.depositFor(vaultId, balance, beneficiary);
        emit ProxyVaultDeposit(token, balance, vaultId);
    }
}
