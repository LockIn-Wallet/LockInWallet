# EVM Smart Contract Upgrade Guide

This guide covers how to upgrade the SavingsCore proxy and individual modules on any EVM network (localhost, Polygon, etc.).

## Architecture Overview

```
SavingsCore (UUPS Proxy - permanent address)
├── TimePeriodLimitsModule    (standalone contract, registered by keccak256 ID)
├── ProposalSystemModule      (standalone contract, registered by keccak256 ID)
├── BypassSystemModule        (standalone contract, registered by keccak256 ID)
└── ApprovalSystemModule      (standalone contract, registered by keccak256 ID)
```

- **SavingsCore** is a UUPS upgradeable proxy. Its address never changes.
- **Modules** are standalone contracts deployed with `SavingsCore` proxy address as constructor arg. They can be replaced independently.
- **Cross-references**: ProposalSystemModule and BypassSystemModule hold a reference to TimePeriodLimitsModule, configured via `setupModuleCrossReferences()`.

## Deployed Addresses (Polygon Mainnet)

| Contract | Address |
|---|---|
| SavingsCore (proxy) | `0x09AC25686Fb2aB3ce5cF6b92F84C90E9BBdA8e93` |
| TimePeriodLimitsModule | `0x0E8DB1A3dAed303F73Ec62b2bcd5EE37726b08c5` |
| ProposalSystemModule | `0xD1b830850662e2c357C4F411B39Bc654B99CF802` |
| BypassSystemModule | `0xA29477aDd6C305B73fFe2d63d8F557EC3285144C` |
| ApprovalSystemModule | `0x2b4F7120Fa95A728a9218b747c25544456825FdA` |

## Upgrade Types

### 1. Upgrade SavingsCore (UUPS Proxy)

Use when you change `SavingsCore.sol` logic. The proxy address stays the same, only the implementation changes. All user data and module registrations are preserved.

```bash
cd ethereum

# Option A: Full redeploy (upgrades core + redeploys all modules)
npx hardhat run scripts/deploy-modular.js --network polygon

# Option B: Comprehensive upgrade (upgrades core + redeploys modules)
npx hardhat run scripts/upgrade-comprehensive.js --network polygon
```

Both scripts auto-detect the existing proxy address from the frontend config and perform a UUPS upgrade.

**What happens:**
1. New SavingsCore implementation is deployed
2. Proxy's implementation slot is updated to point to the new implementation
3. All modules are redeployed with the (unchanged) proxy address
4. Modules are re-registered and cross-references are set up
5. Frontend ABIs and addresses are updated

### 2. Upgrade a Single Module

Use when you change only one module's code. Cheaper than a full redeploy.

```bash
cd ethereum

npx hardhat run scripts/upgrade-module.js --network polygon \
  <ModuleName> <SavingsCoreProxyAddress>

# Example:
npx hardhat run scripts/upgrade-module.js --network polygon \
  BypassSystemModule 0x09AC25686Fb2aB3ce5cF6b92F84C90E9BBdA8e93
```

**Available modules:** `TimePeriodLimitsModule`, `ProposalSystemModule`, `BypassSystemModule`, `ApprovalSystemModule`

**What happens:**
1. New module contract is deployed with the SavingsCore proxy address
2. If the module is ProposalSystem or BypassSystem, TimePeriodLimitsModule cross-reference is set
3. Module registration is updated in SavingsCore (`registerModule`)
4. Frontend ABIs are updated

### 3. Register Modules (Without Redeploying)

Use when modules are already deployed but need to be registered with SavingsCore (e.g., after a partial deployment).

```bash
cd ethereum
npx hardhat run scripts/register-modules.js --network polygon
```

**Important:** After registering modules, you must call `setupModuleCrossReferences()` to wire up the TimePeriodLimitsModule reference in ProposalSystem and BypassSystem. The `register-modules.js` script does NOT do this automatically.

### 4. Set Up Cross-References Only

If modules are deployed and registered but cross-references are missing (symptoms: `commitSetup` fails with "TimePeriodLimitsModule not set"), call `setupModuleCrossReferences()` on SavingsCore:

```javascript
// In a Hardhat script or console:
const savingsCore = await ethers.getContractAt("SavingsCore", PROXY_ADDRESS);
await savingsCore.setupModuleCrossReferences();
```

**Prerequisites:** All three modules (TimePeriodLimits, ProposalSystem, BypassSystem) must be registered.

## Deployment Steps for a New Network

```bash
cd ethereum

# 1. Configure network in hardhat.config.ts
# 2. Set environment variables:
export PRIVATE_KEY=0x...
export POLYGON_RPC_URL=https://...

# 3. Deploy everything:
PRODUCTION=true npx hardhat run scripts/deploy-modular.js --network polygon

# 4. Update frontend/src/networkConfig.json with the new contract address
```

The `deploy-modular.js` script handles:
- Deploying SavingsCore proxy (or upgrading if address found in frontend config)
- Deploying all 4 modules
- Registering modules with SavingsCore
- Setting up cross-references
- Deploying MockUSDT (fresh deploy only)
- Updating frontend ABIs and addresses

## Common Issues

### "TimePeriodLimitsModule not set"

**Cause:** `setupModuleCrossReferences()` was never called, or the BypassSystem/ProposalSystem module was deployed with the wrong SavingsCore address.

**Fix:**
1. Check that the module's `savingsCore` matches the proxy address:
   ```javascript
   const module = await ethers.getContractAt("BypassSystemModule", moduleAddress);
   const core = await module.savingsCore();
   // Should match the SavingsCore proxy address
   ```
2. If mismatched, redeploy the module with the correct address using `upgrade-module.js`
3. Call `setupModuleCrossReferences()` on SavingsCore

### "TimePeriodLimitsModule not registered" / "ProposalSystemModule not registered"

**Cause:** Module not registered with SavingsCore.

**Fix:** Register the module:
```javascript
const moduleId = ethers.keccak256(ethers.toUtf8Bytes("TIME_PERIOD_LIMITS"));
await savingsCore.registerModule(moduleId, moduleAddress);
```

### Module calls revert with empty data (0x)

**Cause:** The module was deployed with the wrong SavingsCore address. The `onlyCore` modifier fails because `msg.sender` (the proxy) doesn't match the module's stored `savingsCore`.

**Fix:** Redeploy the module with the correct proxy address:
```bash
npx hardhat run scripts/upgrade-module.js --network polygon \
  <ModuleName> <CorrectProxyAddress>
```

### Proxy implementation mismatch

To check what implementation the proxy points to:
```javascript
const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const implStorage = await provider.getStorage(proxyAddress, implSlot);
const implAddress = "0x" + implStorage.slice(26);
```

## Module IDs

Modules are registered using keccak256 hashes of their string identifiers:

| Module | String ID | keccak256 |
|---|---|---|
| TimePeriodLimitsModule | `TIME_PERIOD_LIMITS` | `ethers.keccak256(ethers.toUtf8Bytes("TIME_PERIOD_LIMITS"))` |
| ProposalSystemModule | `PROPOSAL_SYSTEM` | `ethers.keccak256(ethers.toUtf8Bytes("PROPOSAL_SYSTEM"))` |
| BypassSystemModule | `BYPASS_SYSTEM` | `ethers.keccak256(ethers.toUtf8Bytes("BYPASS_SYSTEM"))` |
| ApprovalSystemModule | `APPROVAL_SYSTEM` | `ethers.keccak256(ethers.toUtf8Bytes("APPROVAL_SYSTEM"))` |

## Safety Checklist

Before upgrading on a production network:

- [ ] Test the upgrade on localhost first
- [ ] Verify the deployer account is the contract owner (`savingsCore.owner()`)
- [ ] Ensure sufficient native token balance for gas
- [ ] Back up current contract addresses
- [ ] After upgrade, verify module registration (`savingsCore.getModule(moduleId)`)
- [ ] After upgrade, verify cross-references (`module.timePeriodLimitsModule()`)
- [ ] Test core functions (`commitSetup`, `deposit`, `withdraw`) after upgrade
