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

// ========== PRIZE SAVINGS ==========

/// @notice A PoolTogether v5 prize vault. It is a normal ERC4626 over the
/// deposited asset, but — unlike a lending vault — the yield is diverted to the
/// prize pool rather than the share price, so shares stay ~1:1 forever and the
/// return arrives as discrete prizes in a different token.
interface IPrizeVault {
    function asset() external view returns (address);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function maxWithdraw(address owner) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice PoolTogether v5 prize pool, for reading prize sizes only.
/// @dev Deliberately no `claimPrize`. Verified against the live Optimism
/// deployment: the real signature is
/// `claimPrize(address,uint8,uint32,address,uint96,address)` and **only the
/// prize vault may call it**. A depositor never claims for itself — third-party
/// claimer bots do it, and the prize token is transferred straight to the
/// winning depositor's address. So a position here simply receives the tokens.
interface IPrizePool {
    function prizeToken() external view returns (address);
    function getTierPrizeSize(uint8 tier) external view returns (uint104);
    function numberOfTiers() external view returns (uint8);
}

/// @notice A prize-savings strategy.
///
/// Deliberately NOT IYieldStrategy. That interface is share-based and pools
/// every vault into one position, which is right for a lending protocol but
/// wrong here: PoolTogether computes odds per depositing *address* from its
/// time-weighted balance, so a shared position would win as one large account
/// and force every prize to be split. Each account therefore gets its own
/// position contract and its own real odds.
///
/// Accounts are addressed by an opaque id (vault + member) so the strategy
/// never needs to know how the caller organises its users.
interface IPrizeStrategy {
    function asset() external view returns (address);

    /// @notice The token prizes are paid in. On Optimism this is WETH — not the
    /// asset that was deposited.
    function prizeToken() external view returns (address);

    function mode() external view returns (uint8);

    function controller() external view returns (address);

    /// @notice The position that holds this account's deposit and receives its
    /// prizes. Deterministic, and address(0) until first funded.
    function positionOf(bytes32 accountId) external view returns (address);

    /// @notice Pull `assets` from the controller into this account's position,
    /// deploying the position on first use.
    function deposit(bytes32 accountId, uint256 assets) external;

    function withdraw(bytes32 accountId, uint256 assets, address recipient) external;

    /// @notice Exit an account entirely. Returns the assets returned.
    function withdrawAll(bytes32 accountId, address recipient) external returns (uint256 assets);

    /// @notice Assets currently deposited for this account.
    function investedAssets(bytes32 accountId) external view returns (uint256);

    /// @notice Prize tokens sitting in this account's position, unclaimed.
    function claimablePrizes(bytes32 accountId) external view returns (uint256);

    /// @notice Move this account's won prize tokens to `recipient`.
    function sweepPrizes(bytes32 accountId, address recipient) external returns (uint256 amount);

    /// @notice Current top-tier prize, for display. 0 when unknown.
    function grandPrize() external view returns (uint256);

    event PositionDeployed(bytes32 indexed accountId, address indexed position);
    event PrizesSwept(bytes32 indexed accountId, address indexed recipient, uint256 amount);
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
    /// @param member the depositor being credited. Stable earning pools a whole
    /// vault into one position and ignores this; prize savings gives each member
    /// their own position, so it must know whose money this is. Passing it
    /// always keeps the vault module from having to know which mode is in force.
    function onDeposit(uint256 vaultId, address token, address member, uint256 amount) external;

    /// @notice How much of a vault's idle balance should be invested right now.
    /// The caller supplies both balances and the module decides, so the vault
    /// module never has to branch on the earning mode.
    function investableAmount(
        uint256 vaultId,
        address member,
        uint256 vaultTotalBalance,
        uint256 memberBalance
    ) external view returns (uint256);

    /// @notice How much must be redeemed to pay out `needed`, given what this
    /// scope already holds idle. Zero when idle funds already cover it.
    function liquidityShortfall(
        uint256 vaultId,
        address member,
        uint256 needed,
        uint256 vaultTotalBalance,
        uint256 memberBalance
    ) external view returns (uint256);

    /// @notice Credit a member's accrued yield. Returns the amount to add to
    /// their balance; the caller writes it into its own ledger.
    function settleMemberYield(uint256 vaultId, address member) external returns (uint256 credited);

    /// @notice Re-baseline a member's yield debt after their balance changed.
    function snapshotMemberYield(uint256 vaultId, address member, uint256 newBalance) external;

    /// @notice Redeem `amount` of `token` from `vaultId`'s position and send it
    /// to `recipient`. Reverts "Insufficient strategy liquidity" rather than
    /// paying out short.
    function ensureLiquidity(
        uint256 vaultId,
        address token,
        address member,
        uint256 amount,
        address recipient
    ) external;

    /// @notice Send a member's won prize tokens to them, net of the fee.
    /// Prizes are paid in a different token from the deposit, so they are never
    /// folded into a balance — they are claimed.
    function claimPrizes(uint256 vaultId, address member) external returns (uint256 amount);

    /// @notice Prize tokens this member has won and not yet claimed, and the
    /// token they are denominated in.
    function claimablePrizes(uint256 vaultId, address member)
        external
        view
        returns (uint256 amount, address token);

    /// @notice Divest everything for `vaultId` back to the vault module, and
    /// set the vault's stored mode. Used when the owner switches earning off.
    function divestAll(uint256 vaultId, address member, address recipient) external returns (uint256 assets);

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
    event PrizesClaimed(uint256 indexed vaultId, address indexed member, address indexed token, uint256 amount, uint256 fee);
    event PrizeFeeSet(uint256 feeBps);
    event ManagementFeeSet(uint256 feeBps);
    event StrategiesPaused(bool paused);
    event YieldWatermarkSet(uint256 fromVaultId);
    event EmergencyExit(uint256 indexed vaultId, address indexed token, uint256 assets);
}

// ========== VAULT-SIDE ACCOUNTANT ==========

/// @notice Earning, as SavingsVaultModule needs to call it. Keyed per
/// (vault, token) because a stables vault holds several assets at once and each
/// earns in its own market.
interface IVaultYieldModule {
    function setMode(uint256 vaultId, address token, uint8 mode) external;
    function modeOf(uint256 vaultId, address token) external view returns (uint8);
    function onDeposit(uint256 vaultId, address token) external;
    function ensureLiquidity(uint256 vaultId, address token, uint256 needed, address recipient) external;
    function divestAll(uint256 vaultId, address token, address recipient) external;
    function settleMember(uint256 vaultId, address token, address member) external returns (uint256 credited);
    function snapshotMember(uint256 vaultId, address token, address member, uint256 newBalance) external;
    function pendingYield(uint256 vaultId, address token, address member) external view returns (uint256);
    function investedPrincipal(uint256 vaultId, address token) external view returns (uint256);
    function currentAprBps(address token) external view returns (uint256);
}
