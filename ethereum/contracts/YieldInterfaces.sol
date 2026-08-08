// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ========== YIELD MODES ==========

/// @dev A vault's earning setting. UNSET is the zero value, which lets the
/// YieldModule watermark decide the default without writing to every vault:
/// vaults created at or after `yieldEnabledFromVaultId` are treated as STABLE
/// while UNSET, older ones as OFF. See YieldModule.effectiveMode.
uint8 constant MODE_UNSET = 0;
uint8 constant MODE_OFF = 1;
uint8 constant MODE_STABLE = 2; // accrual: position value grows over time
uint8 constant MODE_PRIZE = 3; // prize: value stays flat, returns arrive as claims

// ========== SHARED DATA STRUCTURES ==========

/// @notice Per-vault yield position. Reached only through a mapping, so new
/// fields are safe to append at the end.
/// @dev The position identity that must hold after every operation:
///   strategy.convertToAssets(shares) + deficit
///     == principal + owedYield + accruedFees   (± down-rounding dust)
struct VaultYieldState {
    uint8 mode; // MODE_*; UNSET defers to the watermark
    address strategy; // strategy currently holding this vault's position
    uint256 shares; // strategy shares owned by this vault
    uint256 principal; // assets inside the strategy backing member balances
    uint256 owedYield; // net yield allocated to members, still inside the strategy
    uint256 accruedFees; // treasury's cut, still inside the strategy
    uint256 feeDebt; // management fee earned but not yet funded by yield
    uint256 deficit; // realized loss awaiting repayment from future yield
    uint256 accYieldPerShare; // scaled by YIELD_PRECISION
    uint256 lastAccrualAt; // timestamp of the last accrue()
    uint256 lifetimeYield; // display only
    uint256 lifetimeFees; // display only
}

// ========== STRATEGY INTERFACE ==========

/// @notice A yield source, wrapped so the accountant never learns which
/// protocol it is talking to. Share-based on purpose — an internal ERC4626
/// without a token — so an accrual protocol (value rises) and a prize protocol
/// (value flat, returns arrive as discrete claims) both account through one
/// code path.
///
/// Rounding rules every implementation must follow, all favouring the pool:
/// - minting shares on deposit rounds DOWN
/// - burning shares on withdrawal rounds UP
/// - convertToAssets rounds DOWN
/// No rounding may ever let the sum of claims exceed totalAssets().
interface IYieldStrategy {
    /// @notice The underlying token this strategy accepts. Never address(0).
    function asset() external view returns (address);

    /// @notice MODE_STABLE or MODE_PRIZE — how returns arrive.
    function mode() external view returns (uint8);

    /// @notice The only address allowed to move funds: the YieldModule.
    function controller() external view returns (address);

    /// @notice Pull `assets` from msg.sender and supply them. Reverts on any
    /// shortfall so the caller never records more principal than arrived.
    function deposit(uint256 assets) external returns (uint256 shares);

    /// @notice Burn however many shares `assets` costs and send exactly
    /// `assets` to `recipient`. Reverts rather than paying out short.
    function withdraw(uint256 assets, address recipient) external returns (uint256 sharesBurned);

    /// @notice Redeem an exact share count — used for full exits, where the
    /// asset amount is whatever the shares are worth.
    function redeemShares(uint256 shares, address recipient) external returns (uint256 assets);

    function convertToAssets(uint256 shares) external view returns (uint256);

    function convertToShares(uint256 assets) external view returns (uint256);

    function totalAssets() external view returns (uint256);

    /// @notice Assets that could be withdrawn right now. Less than
    /// totalAssets() when the underlying protocol is illiquid or paused.
    function maxWithdrawable() external view returns (uint256);

    /// @notice Current annual rate in basis points, or 0 when unknown. This is
    /// APR — the frontend compounds it and labels it variable.
    function aprBps() external view returns (uint256);

    /// @notice PRIZE mode only: claim discrete proceeds and send them to
    /// msg.sender. Returns 0 when there is nothing to claim. ACCRUAL
    /// strategies return 0 without doing anything.
    function harvestRewards(bytes calldata data) external returns (uint256 assets);

    /// @notice Controller-only full exit. Redeems everything to `recipient`.
    function emergencyExit(address recipient) external returns (uint256 assets);
}

// ========== MODULE INTERFACE ==========

/// @notice The accountant. VaultSystemModule custodies vault funds and calls
/// into this module to invest idle balances, settle each member's share of the
/// yield, and redeem on demand for withdrawals.
interface IYieldModule {
    // ---- Called by VaultSystemModule ----

    /// @notice Invest `amount` of `token` on behalf of `vaultId`. Pulls the
    /// tokens from msg.sender. Never reverts because of the underlying
    /// protocol — a failing strategy leaves the funds with the caller and
    /// emits StrategyDepositSkipped, so a user's deposit can't be blocked by a
    /// third party.
    function onDeposit(uint256 vaultId, address token, uint256 amount) external;

    /// @notice Credit a member's accrued yield. Returns the amount to add to
    /// their balance; the caller writes it into its own ledger.
    function settleMemberYield(uint256 vaultId, address member) external returns (uint256 credited);

    /// @notice Re-baseline a member's yield debt after their balance changed.
    function snapshotMemberYield(uint256 vaultId, address member, uint256 newBalance) external;

    /// @notice Redeem `amount` of `token` from `vaultId`'s position and send it
    /// to `recipient`. Reverts "Insufficient strategy liquidity" rather than
    /// paying out short.
    function ensureLiquidity(uint256 vaultId, address token, uint256 amount, address recipient) external;

    /// @notice Divest everything for `vaultId` back to the vault module, and
    /// set the vault's stored mode. Used when the owner switches earning off.
    function divestAll(uint256 vaultId, address recipient) external returns (uint256 assets);

    /// @notice Record the vault's chosen mode. Vault-module only.
    function setVaultMode(uint256 vaultId, address token, uint8 mode) external;

    // ---- Views ----

    /// @notice Assets currently invested for this vault, excluding yield and
    /// fees still sitting in the position.
    function investedPrincipal(uint256 vaultId) external view returns (uint256);

    /// @notice Current asset value of the vault's position, including yield and
    /// fees still inside it. Zero once divested.
    function investedValue(uint256 vaultId) external view returns (uint256);

    /// @notice Yield a member could claim right now, net of fees.
    function pendingYield(uint256 vaultId, address member) external view returns (uint256);

    /// @notice The mode actually in force, resolving UNSET against the watermark.
    function effectiveMode(uint256 vaultId) external view returns (uint8);

    function getVaultYield(uint256 vaultId) external view returns (VaultYieldState memory);

    function getStrategy(address token, uint8 mode) external view returns (address);

    function managementFeeBps() external view returns (uint256);

    // ---- Permissionless upkeep ----

    /// @notice Fold new yield into the vault's accumulator and take the fee.
    /// Anyone may call; it only ever helps.
    function accrue(uint256 vaultId) external;

    /// @notice Move collected fees for `token` to the treasury.
    function sweepFees(address token) external returns (uint256 amount);

    // ---- Events ----

    event StrategySet(address indexed token, uint8 indexed mode, address indexed strategy);
    event StrategyChangeQueued(address indexed token, uint8 indexed mode, address indexed strategy, uint256 readyAt);
    event StrategyDepositSkipped(uint256 indexed vaultId, address indexed token, uint256 amount, string reason);
    event VaultModeSet(uint256 indexed vaultId, uint8 mode, address strategy);
    event Invested(uint256 indexed vaultId, address indexed token, uint256 assets, uint256 shares);
    event Divested(uint256 indexed vaultId, address indexed token, uint256 assets, uint256 shares);
    event YieldAccrued(uint256 indexed vaultId, uint256 grossYield, uint256 fee, uint256 netYield);
    event YieldDeficit(uint256 indexed vaultId, uint256 deficit);
    event MemberYieldSettled(uint256 indexed vaultId, address indexed member, uint256 credited);
    event FeesSwept(address indexed token, address indexed treasury, uint256 amount);
    event ManagementFeeSet(uint256 feeBps);
    event StrategiesPaused(bool paused);
    event YieldWatermarkSet(uint256 fromVaultId);
    event EmergencyExit(uint256 indexed vaultId, address indexed token, uint256 assets);
}
