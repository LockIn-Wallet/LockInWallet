/**
 * Where the keeper gets its addresses.
 *
 * Contract addresses are never hardcoded here. The core address comes from the
 * same `networkConfig.json` the frontend reads, and every module address is
 * resolved from the core's on-chain registry — so an upgrade that moves a
 * module needs no change in this service, and the keeper can never act on a
 * stale address that a deployment has since replaced.
 */

const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');

const NETWORK_CONFIG_PATH = path.join(
  __dirname,
  '../../frontend/src/networkConfig.json'
);

const MODULE_IDS = {
  vaults: 'SAVINGS_VAULTS',
  depositAddresses: 'VAULT_DEPOSIT_ADDRESSES',
};

const CORE_ABI = ['function getModule(bytes32 moduleId) view returns (address)'];

const DEPOSIT_ADDRESS_ABI = [
  'function depositAddressOf(uint256 vaultId, address member) view returns (address)',
  'function isDepositAddressDeployed(uint256 vaultId, address member) view returns (bool)',
  'function deployDepositAddressFor(uint256 vaultId, address member) returns (address)',
  'event DepositAddressDeployed(uint256 indexed vaultId, address indexed member, address proxy)',
];

const VAULTS_ABI = [
  'function getVaultCount() view returns (uint256)',
  'function getVaultMembers(uint256 vaultId) view returns (address[])',
  'event VaultCreated(uint256 indexed vaultId, address indexed creator, uint8 kind, string name)',
  'event VaultJoined(uint256 indexed vaultId, address indexed member)',
];

function readNetworkConfig() {
  return JSON.parse(fs.readFileSync(NETWORK_CONFIG_PATH, 'utf8'));
}

/**
 * Every ERC20 the deployment accepts on this network.
 *
 * Native coin is deliberately absent: the deposit proxy forwards it inside
 * `receive()`, in the same transaction that delivered it, so there is nothing
 * for a keeper to do. Only ERC20 needs sweeping, because a token transfer
 * notifies its recipient of nothing.
 */
function tokensFor(network) {
  const config = readNetworkConfig().evm?.[network];
  if (!config) throw new Error(`Unknown network: ${network}`);

  return Object.entries(config.tokens || {})
    .filter(([, token]) => token.address && token.address !== ethers.ZeroAddress)
    .map(([symbol, token]) => ({
      symbol,
      address: ethers.getAddress(token.address),
      decimals: token.decimals,
    }));
}

function coreAddressFor(network) {
  const address = readNetworkConfig().evm?.[network]?.savingsContract;
  if (!address) throw new Error(`No SavingsCore address for network: ${network}`);
  return ethers.getAddress(address);
}

/** Resolve the modules the keeper needs from the core's registry. */
async function resolveModules(coreAddress, runner) {
  const core = new ethers.Contract(coreAddress, CORE_ABI, runner);
  const resolved = {};

  for (const [key, name] of Object.entries(MODULE_IDS)) {
    const address = await core.getModule(
      ethers.keccak256(ethers.toUtf8Bytes(name))
    );
    if (address === ethers.ZeroAddress) {
      throw new Error(`Module ${name} is not registered on ${coreAddress}`);
    }
    resolved[key] = address;
  }

  return {
    vaults: new ethers.Contract(resolved.vaults, VAULTS_ABI, runner),
    depositAddresses: new ethers.Contract(
      resolved.depositAddresses,
      DEPOSIT_ADDRESS_ABI,
      runner
    ),
  };
}

module.exports = {
  readNetworkConfig,
  tokensFor,
  coreAddressFor,
  resolveModules,
  MODULE_IDS,
  CORE_ABI,
  DEPOSIT_ADDRESS_ABI,
  VAULTS_ABI,
};
