import React from "react";

// Import styles
import {
  formStyles,
  layoutStyles,
  utilityStyles,
} from "../../styles";

/**
 * NetworkSelector component - Network switching controls
 * Handles selection between EVM/Solana and specific networks
 */
const NetworkSelector = ({
  networkType,
  selectedNetwork,
  isNetworkSwitching,
  switchNetworkType,
  switchNetwork,
}) => {
  return (
    <div style={layoutStyles.networkSelection}>
      <div style={layoutStyles.networkSelectionGroup}>
        <span style={utilityStyles.label}>Network:</span>
        <select
          value={networkType}
          onChange={(e) => switchNetworkType(e.target.value)}
          style={formStyles.select}
        >
          <option value="evm">Ethereum (EVM)</option>
          <option value="solana">Solana</option>
        </select>
      </div>

      <div style={layoutStyles.networkSelectionGroup}>
        <select
          value={selectedNetwork}
          onChange={(e) => switchNetwork(e.target.value)}
          disabled={isNetworkSwitching}
          style={{
            ...formStyles.select,
            cursor: isNetworkSwitching ? "not-allowed" : "pointer",
          }}
        >
          {networkType === "solana" ? (
            <>
              <option value="localhost">Solana Localhost</option>
              <option value="devnet">Solana Devnet</option>
              <option value="mainnet">Solana Mainnet</option>
            </>
          ) : (
            <>
              <option value="localhost">Localhost</option>
              <option value="ethereum">Ethereum Mainnet</option>
              <option value="optimism">Optimism</option>
            </>
          )}
        </select>
        {isNetworkSwitching && (
          <span style={{ color: "#fbb6ce", fontSize: "0.8em" }}>
            Switching...
          </span>
        )}
      </div>
    </div>
  );
};

export default NetworkSelector;