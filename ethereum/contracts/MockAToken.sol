// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only stand-in for an Aave aToken. The real thing rebases so a
/// holder's balance grows with accrued interest; here the pool mints the extra
/// balance explicitly, which gives tests deterministic control over yield.
contract MockAToken is ERC20 {
    address public immutable pool;
    address public immutable underlying;
    uint8 private immutable _decimals;

    modifier onlyPool() {
        require(msg.sender == pool, "Only pool");
        _;
    }

    constructor(string memory name_, string memory symbol_, address _underlying, address _pool, uint8 decimals_)
        ERC20(name_, symbol_)
    {
        underlying = _underlying;
        pool = _pool;
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external onlyPool {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyPool {
        _burn(from, amount);
    }
}
