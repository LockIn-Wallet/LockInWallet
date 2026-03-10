// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./SavingsInterfaces.sol";

/// @notice Minimal ERC4626 interface for PoolTogether Prize Vaults
interface IERC4626 {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function asset() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/// @notice PoolTogether v5 PrizePool interface for prize info
interface IPrizePool {
    function getTierPrizeSize(uint8 tier) external view returns (uint104);
    function numberOfTiers() external view returns (uint8);
}

contract PoolTogetherModule is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    ISavingsCore public savingsCore;

    // token => PrizeVault address
    mapping(address => address) public prizeVaults;

    // user => token => vault shares
    mapping(address => mapping(address => uint256)) public userVaultShares;

    // PrizePool for prize calculations
    address public prizePool;

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

    // ========== OWNER CONFIGURATION ==========

    function setPrizeVault(address token, address vault) external onlyOwner {
        require(token != address(0), "Cannot use native token");
        require(vault != address(0), "Invalid vault");
        require(IERC4626(vault).asset() == token, "Vault asset mismatch");
        prizeVaults[token] = vault;
        emit PrizeVaultSet(token, vault);
    }

    function setPrizePool(address _prizePool) external onlyOwner {
        require(_prizePool != address(0), "Invalid prize pool");
        prizePool = _prizePool;
    }

    // ========== DEPOSIT TO VAULT ==========

    /// @notice Deposit user's tokens from SavingsCore into PoolTogether Prize Vault
    function depositToVault(address user, address token, uint256 amount) external onlyCore {
        require(amount > 0, "Amount must be > 0");
        address vault = prizeVaults[token];
        require(vault != address(0), "No vault for token");

        // Transfer tokens from SavingsCore to this module (decreases user balance)
        savingsCore.transferTokensTo(user, token, amount, address(this));

        // Approve vault to spend tokens
        IERC20(token).approve(vault, amount);

        // Deposit into Prize Vault, shares go to this module
        uint256 shares = IERC4626(vault).deposit(amount, address(this));

        // Track user's shares
        userVaultShares[user][token] += shares;

        emit DepositedToVault(user, token, amount, shares);
    }

    // ========== WITHDRAW FROM VAULT ==========

    /// @notice Withdraw user's tokens from Prize Vault back to SavingsCore
    function withdrawFromVault(address user, address token, uint256 sharesToRedeem) external onlyCore {
        require(sharesToRedeem > 0, "Shares must be > 0");
        require(userVaultShares[user][token] >= sharesToRedeem, "Insufficient shares");
        address vault = prizeVaults[token];
        require(vault != address(0), "No vault for token");

        userVaultShares[user][token] -= sharesToRedeem;

        // Redeem shares, tokens come to this module
        uint256 assets = IERC4626(vault).redeem(sharesToRedeem, address(this), address(this));

        // Send tokens back to SavingsCore and increase user balance
        IERC20(token).transfer(address(savingsCore), assets);
        savingsCore.updateTokenBalance(user, token, assets, true);

        emit WithdrawnFromVault(user, token, assets, sharesToRedeem);
    }

    // ========== VIEW FUNCTIONS ==========

    /// @notice Get user's vault shares for a token
    function getUserVaultShares(address user, address token) external view returns (uint256) {
        return userVaultShares[user][token];
    }

    /// @notice Get current asset value of user's vault shares
    function getUserVaultBalance(address user, address token) external view returns (uint256) {
        address vault = prizeVaults[token];
        if (vault == address(0)) return 0;
        uint256 shares = userVaultShares[user][token];
        if (shares == 0) return 0;
        return IERC4626(vault).convertToAssets(shares);
    }

    /// @notice Check if a token has a configured vault
    function hasVault(address token) external view returns (bool) {
        return prizeVaults[token] != address(0);
    }

    /// @notice Get the grand prize (tier 0) size from PrizePool
    function getGrandPrize() external view returns (uint256) {
        if (prizePool == address(0)) return 0;
        return IPrizePool(prizePool).getTierPrizeSize(0);
    }

    /// @notice Get number of prize tiers
    function getNumberOfTiers() external view returns (uint8) {
        if (prizePool == address(0)) return 0;
        return IPrizePool(prizePool).numberOfTiers();
    }

    // ========== EVENTS ==========

    event PrizeVaultSet(address indexed token, address indexed vault);
    event DepositedToVault(address indexed user, address indexed token, uint256 amount, uint256 shares);
    event WithdrawnFromVault(address indexed user, address indexed token, uint256 amount, uint256 shares);
}
