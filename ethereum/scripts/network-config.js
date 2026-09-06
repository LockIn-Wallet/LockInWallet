const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

/**
 * Where deploy scripts read and write the frontend's per-network addresses.
 *
 * One place for "which entry is this network" so a script run with
 * `--network optimism` can never write an address under `localhost` because
 * it derived the key differently from its neighbour.
 */
const TARGET_NETWORK = hre.network.name === "hardhat" ? "localhost" : hre.network.name;
const NETWORK_CONFIG_PATH = path.join(__dirname, "../../frontend/src/networkConfig.json");

function readNetworkConfig() {
  return JSON.parse(fs.readFileSync(NETWORK_CONFIG_PATH, "utf8"));
}

/**
 * Sets `evm.<network>.<key>` and saves. Returns true when the value changed.
 */
function writeNetworkAddress(key, address) {
  const config = readNetworkConfig();
  if (!config.evm) config.evm = {};
  if (!config.evm[TARGET_NETWORK]) config.evm[TARGET_NETWORK] = {};
  if (config.evm[TARGET_NETWORK][key] === address) return false;
  config.evm[TARGET_NETWORK][key] = address;
  fs.writeFileSync(NETWORK_CONFIG_PATH, JSON.stringify(config, null, 2));
  return true;
}

module.exports = { TARGET_NETWORK, NETWORK_CONFIG_PATH, readNetworkConfig, writeNetworkAddress };
