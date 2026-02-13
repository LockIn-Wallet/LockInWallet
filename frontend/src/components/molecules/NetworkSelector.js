import React from "react";

// Import styles
import {
  formStyles,
  layoutStyles,
  utilityStyles,
} from "../../styles";

// Import network filtering utilities
import {
  getAllNetworksUnified,
} from "../../utils/networkFilter";

/**
 * NetworkSelector component - Unified network switching
 * Single dropdown for both EVM and Solana networks
 * Dynamically filters networks based on deployment status and environment
 */
const NetworkSelector = ({
  networkType,
  selectedNetwork,
  isNetworkSwitching,
  switchNetworkType,
  switchNetwork,
}) => {
  // Get unified network list
  const allNetworks = getAllNetworksUnified();
  const isDevelopment = process.env.NODE_ENV === "development";

  // Current value for the dropdown
  const currentValue = `${networkType}:${selectedNetwork}`;

  // Handle network change
  const handleNetworkChange = async (value) => {
    const [newNetworkType, newNetworkKey] = value.split(":");

    // If network type is changing, call switchNetworkType
    if (newNetworkType !== networkType) {
      await switchNetworkType(newNetworkType, newNetworkKey);
    } else {
      // Same network type, just switch network
      await switchNetwork(newNetworkKey, networkType);
    }
  };

  return (
    <div style={layoutStyles.networkSelection}>
      <div style={layoutStyles.networkSelectionGroup}>
        <span style={utilityStyles.label}>Network:</span>
        <select
          value={currentValue}
          onChange={(e) => handleNetworkChange(e.target.value)}
          disabled={isNetworkSwitching || allNetworks.length === 0}
          style={{
            ...formStyles.select,
            cursor: isNetworkSwitching || allNetworks.length === 0
              ? "not-allowed"
              : "pointer",
          }}
        >
          {allNetworks.length === 0 ? (
            <option value="">No networks available</option>
          ) : (
            allNetworks.map((network) => (
              <option key={network.value} value={network.value}>
                {network.label}
                {isDevelopment && !network.deployed && !network.isLocal && " (Not Deployed)"}
              </option>
            ))
          )}
        </select>
        {isNetworkSwitching && (
          <span style={{ color: "#fbb6ce", fontSize: "0.8em", marginLeft: "8px" }}>
            Switching...
          </span>
        )}
        {allNetworks.length === 0 && !isNetworkSwitching && (
          <span style={{ color: "#f56565", fontSize: "0.8em", marginLeft: "8px" }}>
            No deployed networks
          </span>
        )}
      </div>
    </div>
  );
};

export default NetworkSelector;