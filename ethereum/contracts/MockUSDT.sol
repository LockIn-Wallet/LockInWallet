// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {
        // Mint 1,000,000 USDT (with 6 decimals) to the deployer
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }

    // Override decimals to match USDT's 6 decimals
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
