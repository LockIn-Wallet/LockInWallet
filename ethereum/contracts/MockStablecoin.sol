// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only stablecoin with a configurable number of decimals.
///
/// Exists so a local chain can hold more than one dollar coin, which is the
/// only way to exercise what a stablecoins vault is actually for: several
/// pegged assets under a single dollar cap. With one coin deployed, the
/// decimals normalisation that makes 100 USDT (100e6) and 100 DAI (100e18)
/// both count as $100 is never tested by anything but unit tests.
contract MockStablecoin is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_)
    {
        _decimals = decimals_;
        _mint(msg.sender, 1_000_000 * 10 ** decimals_);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /// @notice Top anyone up. Test-only, and deliberately unguarded so a script
    /// can fund whichever account is being looked at.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
