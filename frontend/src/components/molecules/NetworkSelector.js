import React from "react";

// Import styles
import {
  formStyles,
  layoutStyles,
  utilityStyles,
} from "../../styles";

// Import network filtering utilities
import {
  getAvailableNetworks,
  getNetworkDisplayName,
  hasProductionNetworks,
} from "../../utils/networkFilter";

/**
 * NetworkSelector component - Network switching controls
 * Handles selection between EVM/Solana and specific networks
 * Dynamically filters networks based on deployment status and environment
 */
const NetworkSelector = ({
  networkType,
  selectedNetwork,
  isNetworkSwitching,
  switchNetworkType,
  switchNetwork,
}) => {
  // Get available networks for current type
  const availableNetworks = getAvailableNetworks(networkType);
  const isDevelopment = process.env.NODE_ENV === "development";

  // Check if we have production networks available
  const hasEvmProduction = hasProductionNetworks("evm");
  const hasSolanaProduction = hasProductionNetworks("solana");

  return (
    <div style={layoutStyles.networkSelection}>
      <div style={layoutStyles.networkSelectionGroup}>
        <span style={utilityStyles.label}>Network:</span>
        <select
          value={networkType}
          onChange={(e) => switchNetworkType(e.target.value)}
          style={formStyles.select}
        >
          <option value="evm">
            Ethereum (EVM)
            {!hasEvmProduction && !isDevelopment && " (No Networks)"}
          </option>
          <option value="solana">
            Solana
            {!hasSolanaProduction && !isDevelopment && " (No Networks)"}
          </option>
        </select>
      </div>

      <div style={layoutStyles.networkSelectionGroup}>
        <select
          value={selectedNetwork}
          onChange={(e) => switchNetwork(e.target.value)}
          disabled={isNetworkSwitching || availableNetworks.length === 0}
          style={{
            ...formStyles.select,
            cursor: isNetworkSwitching || availableNetworks.length === 0
              ? "not-allowed"
              : "pointer",
          }}
        >
          {availableNetworks.length === 0 ? (
            <option value="">No networks available</option>
          ) : (
            availableNetworks.map((network) => (
              <option key={network.key} value={network.key}>
                {getNetworkDisplayName(networkType, network.key, isDevelopment)}
              </option>
            ))
          )}
        </select>
        {isNetworkSwitching && (
          <span style={{ color: "#fbb6ce", fontSize: "0.8em" }}>
            Switching...
          </span>
        )}
        {availableNetworks.length === 0 && !isNetworkSwitching && (
          <span style={{ color: "#f56565", fontSize: "0.8em" }}>
            No deployed networks
          </span>
        )}
      </div>
    </div>
  );
};

export default NetworkSelector;