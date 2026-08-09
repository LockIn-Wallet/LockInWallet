// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISavingsVaultDeposits {
    function depositFor(uint256 vaultId, address token, uint256 amount, address beneficiary)
        external
        payable;
}

/// @title SavingsVaultDepositProxy
/// @notice A permanent address that pays into one member's share of one vault.
///
/// This exists because exchanges withdraw to an address, not to a contract call.
/// Without it, funding a vault means moving money to your own wallet first and
/// then depositing — two steps, and a window where the savings rules do not
/// apply to it yet.
///
/// It is bound to a **member**, not to the vault, which matters for a shared
/// vault: everyone gets their own address, so an arriving transfer credits the
/// person it came from rather than whoever created the pot.
///
/// Anyone may call the sweeps. There is nothing to gain by it — every path ends
/// at the same beneficiary's balance in the same vault — and making them
/// permissionless means a stuck transfer can be rescued by anyone, including us,
/// without the member needing gas.
contract SavingsVaultDepositProxy {
    using SafeERC20 for IERC20;

    ISavingsVaultDeposits public immutable vaults;
    uint256 public immutable vaultId;
    address public immutable beneficiary;

    event Forwarded(uint256 indexed vaultId, address indexed beneficiary, address indexed token, uint256 amount);

    constructor(address _vaults, uint256 _vaultId, address _beneficiary) {
        require(_vaults != address(0) && _beneficiary != address(0), "Invalid input");
        vaults = ISavingsVaultDeposits(_vaults);
        vaultId = _vaultId;
        beneficiary = _beneficiary;
    }

    /// @dev Forwards on arrival, so the money is under the vault's rules in the
    /// same transaction that delivered it.
    receive() external payable {
        _forwardNative(msg.value);
    }

    /// @notice Push through native coin that arrived without running `receive`
    /// — a `selfdestruct` payment, or a transfer that ran out of gas here.
    function sweepNative() external {
        _forwardNative(address(this).balance);
    }

    function sweep(address token) external {
        require(token != address(0), "Use sweepNative");
        IERC20 erc20 = IERC20(token);
        uint256 balance = erc20.balanceOf(address(this));
        require(balance > 0, "Nothing to sweep");

        erc20.forceApprove(address(vaults), balance);
        vaults.depositFor(vaultId, token, balance, beneficiary);
        emit Forwarded(vaultId, beneficiary, token, balance);
    }

    function _forwardNative(uint256 amount) private {
        require(amount > 0, "Nothing to sweep");
        vaults.depositFor{value: amount}(vaultId, address(0), amount, beneficiary);
        emit Forwarded(vaultId, beneficiary, address(0), amount);
    }
}
