// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title MockSmartAccount
/// @notice Stand-in for a contract wallet — a Safe, or an ERC-4337 account of
/// the kind a Google-sign-in user would hold. Its `receive()` writes storage,
/// so accepting native coin costs far more than the 2300-gas stipend that
/// `address.transfer()` forwards. That is exactly the condition that made
/// native withdrawals to contract wallets revert.
contract MockSmartAccount {
    uint256 public totalReceived;
    uint256 public receiveCount;

    receive() external payable {
        totalReceived += msg.value;
        receiveCount += 1;
    }

    /// @notice Perform an arbitrary call, the way a smart account executes a
    /// user operation. Bubbles the callee's revert reason so tests assert on
    /// the real error rather than a generic failure.
    function execute(address target, bytes calldata data) external returns (bytes memory) {
        (bool ok, bytes memory ret) = target.call(data);
        if (!ok) {
            assembly {
                revert(add(ret, 0x20), mload(ret))
            }
        }
        return ret;
    }
}

/// @notice Sends native coin the old way, with the 2300-gas stipend. Exists so
/// the tests can prove MockSmartAccount really is too expensive for
/// `transfer()` — otherwise a mock that happened to fit in the stipend would
/// make the regression tests pass for the wrong reason.
contract StipendSender {
    receive() external payable {}

    function sendWithStipend(address payable target) external {
        target.transfer(address(this).balance);
    }
}
