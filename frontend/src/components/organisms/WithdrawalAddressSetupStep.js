import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { ethers } from "ethers";

// Import components
import WithdrawalAddressSelector from "../WithdrawalAddressSelector.js";

// Import services
import {
  fetchWithdrawalAddresses as fetchWithdrawalAddressesService,
  fetchPendingWithdrawalRequests as fetchPendingWithdrawalRequestsService,
} from "../../services";

// Import styles
import {
  stepStyles,
  layoutStyles,
  colors,
  spacing,
  fontSize,
  fontWeight,
  utilityStyles,
  cardStyles,
  formStyles,
  buttonStyles,
  getStepContainerStyle,
  getStepTitleColor,
} from "../../styles";

/**
 * WithdrawalAddressSetupStep Component
 *
 * Manages withdrawal destination setup before wallet commitment
 *
 * Features:
 * - Withdrawal address management during setup
 * - Add new withdrawal address form
 * - Pending withdrawal address requests display
 * - Network-aware address validation (Ethereum vs Solana)
 */
const WithdrawalAddressSetupStep = ({
  // Setup state
  isSetupCommitted,
  spendingLimits,

  // Blockchain services (dependency injection)
  transactionManager,
  savingsContract,

  // Network context
  networkType,
  solanaConnected,
  solanaPublicKey,
  userAddress,
}) => {
  // Component-specific form state
  const [showWithdrawalAddressForm, setShowWithdrawalAddressForm] = useState(false);
  const [newWithdrawalTitle, setNewWithdrawalTitle] = useState("");
  const [newWithdrawalAddress, setNewWithdrawalAddress] = useState("");

  // Internal data state (moved from App.js props)
  const [withdrawalAddresses, setWithdrawalAddresses] = useState([]);
  const [pendingWithdrawalRequests, setPendingWithdrawalRequests] = useState([]);

  // Helper function to get current user address based on network
  const getCurrentUserAddress = () => {
    if (networkType === "solana") {
      return solanaPublicKey?.toString();
    } else {
      return userAddress;
    }
  };

  // Data fetching function (similar to WithdrawalInterface)
  const fetchWithdrawalData = async () => {
    if (!transactionManager && !savingsContract) return;

    try {
      const [addresses, requests] = await Promise.all([
        fetchWithdrawalAddressesService({
          transactionManager,
          savingsContract,
          networkType,
          userAddress,
          solanaPublicKey,
        }),
        fetchPendingWithdrawalRequestsService({
          transactionManager,
          savingsContract,
          networkType,
          userAddress,
          solanaPublicKey,
        }),
      ]);

      setWithdrawalAddresses(addresses);
      setPendingWithdrawalRequests(requests);
    } catch (error) {
      console.error('Error fetching withdrawal data:', error);
    }
  };

  // Load data when dependencies change
  useEffect(() => {
    fetchWithdrawalData();
  }, [transactionManager, savingsContract, solanaConnected, networkType]);

  // Request withdrawal address function (moved from App.js)
  const requestWithdrawalAddress = async (title, address) => {
    // Network-aware validation
    if (
      networkType === "solana" &&
      (!transactionManager || !title || !address)
    ) {
      alert("Please fill in all fields and connect your Solana wallet");
      return;
    }
    if (
      networkType === "evm" &&
      (!savingsContract || !title || !address)
    ) {
      alert("Please fill in all fields and connect your MetaMask wallet");
      return;
    }

    try {
      if (networkType === "solana") {
        // Solana address request logic (with timelock, same as EVM)
        // Basic Solana address validation (44 characters, base58)
        if (address.length !== 44) {
          alert("Please enter a valid Solana address (44 characters)");
          return;
        }

        const adapter = transactionManager.getCurrentAdapter();
        const txHash = await adapter.addWithdrawalDestination(
          address,
          title
        );

        alert(
          `✅ Solana withdrawal address processed successfully!\n\n` +
            `Title: ${title}\n` +
            `Address: ${address}\n` +
            `Transaction: ${txHash}\n\n` +
            `The address has been processed based on your contract lock status. Check the withdrawal destinations or pending requests sections.`
        );
      } else {
        // EVM address request logic (existing - requires timelock)
        // Validate address format
        if (!ethers.isAddress(address)) {
          alert("Please enter a valid Ethereum address");
          return;
        }

        const tx = await savingsContract.requestWithdrawalAddress(
          title,
          address
        );
        await tx.wait();

        alert(
          `✅ EVM withdrawal address request submitted successfully!\n\n` +
            `Title: ${title}\n` +
            `Address: ${address}\n` +
            `Executable after: 24 hours\n\n` +
            `You can execute this request from the "Pending Withdrawal Requests" section once the waiting period is over.`
        );
      }

      // Refresh internal data
      await fetchWithdrawalData();
    } catch (error) {
      console.error(
        `Error requesting ${networkType} withdrawal address:`,
        error
      );

      // Network-aware error handling
      if (networkType === "solana") {
        if (error.message.includes("already exists")) {
          alert(
            "This Solana address is already in your withdrawal destinations"
          );
        } else if (error.message.includes("own address")) {
          alert(
            "You cannot add your own Solana wallet address as a withdrawal destination"
          );
        } else {
          alert(`Failed to add Solana withdrawal address: ${error.message}`);
        }
      } else {
        // EVM error handling
        if (error.message.includes("Address already exists")) {
          alert("This address is already in your withdrawal addresses");
        } else if (error.message.includes("Cannot set own address")) {
          alert(
            "You cannot add your own wallet address as a withdrawal destination"
          );
        } else {
          alert(`Failed to request withdrawal address: ${error.message}`);
        }
      }
    }
  };

  // Remove withdrawal address function (moved from App.js)
  const removeWithdrawalAddress = async (destination) => {
    try {
      if (networkType === "solana") {
        // Solana implementation
        if (!transactionManager) {
          throw new Error("Transaction manager not initialized");
        }

        const solanaAdapter = transactionManager.getCurrentAdapter();
        const txHash = await solanaAdapter.removeWithdrawalDestination(
          destination
        );
        console.log("Solana withdrawal address removal transaction:", txHash);
        alert("Withdrawal address removed successfully!");
      } else {
        // EVM implementation
        if (!savingsContract) {
          throw new Error("Savings contract not initialized");
        }

        const tx = await savingsContract.removeWithdrawalAddress(destination);
        await tx.wait();
        alert("Withdrawal address removed successfully!");
      }

      // Refresh internal data
      await fetchWithdrawalData();
    } catch (error) {
      console.error("Error removing withdrawal address:", error);
      alert(`Failed to remove withdrawal address: ${error.message}`);
    }
  };

  // Handle form submission
  const handleRequestWithdrawalAddress = async () => {
    try {
      await requestWithdrawalAddress(newWithdrawalTitle, newWithdrawalAddress);
      // Clear form fields after successful submission
      setNewWithdrawalTitle("");
      setNewWithdrawalAddress("");
      setShowWithdrawalAddressForm(false);
    } catch (error) {
      console.error("Error requesting withdrawal address:", error);
      // Keep form open on error so user can retry
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#2d3748",
        borderRadius: "8px",
        padding: "20px",
        margin: "20px 0",
        border: "1px solid #4a5568",
      }}
    >
      {/* Header */}
      <div style={stepStyles.stepHeader}>
        <h3
          style={{
            ...stepStyles.step2Title,
            color: colors.primary?.light || "#63b3ed",
          }}
        >
          🔑 Withdrawal Addresses
        </h3>
      </div>

      {/* Description */}
      <p style={stepStyles.stepDescription}>
        {isSetupCommitted
          ? "Manage your approved withdrawal addresses. New addresses require 24-48 hour approval after wallet is locked."
          : "Add addresses where you'll be able to withdraw funds. After lock-in, new addresses will require 24-48 hour approval for security."}
      </p>

      {/* Progress Tips for Setup Mode */}
      {!isSetupCommitted && (
        <div
          style={{
            ...cardStyles.progressTipCard,
            marginBottom: spacing.md,
          }}
        >
          <span style={{ fontSize: fontSize.sm, color: colors.text.secondary }}>
            💡 <strong>Tip:</strong> "My Wallet" is automatically added.
            Add other addresses you'll withdraw to (exchanges, hardware
            wallets, etc.).
          </span>
        </div>
      )}

      {/* Withdrawal Address Management */}
      {!isSetupCommitted && (
        <div>
          <WithdrawalAddressSelector
            mode="management"
            title="Your Withdrawal Addresses:"
            withdrawalAddresses={withdrawalAddresses}
            getCurrentUserAddress={getCurrentUserAddress}
            removeWithdrawalAddress={removeWithdrawalAddress}
            showWithdrawalAddressForm={showWithdrawalAddressForm}
            setShowWithdrawalAddressForm={setShowWithdrawalAddressForm}
          />

          {/* Add New Withdrawal Address Form */}
          {showWithdrawalAddressForm && (
            <div
              style={{
                ...cardStyles.baseCard,
                marginTop: spacing.md,
              }}
            >
              <h5
                style={{
                  color: colors.warning.light,
                  margin: `0 0 ${spacing.md} 0`
                }}
              >
                📍 Add New Withdrawal Address
              </h5>

              <div
                style={{
                  display: "grid",
                  gap: spacing.sm,
                  marginBottom: spacing.md,
                }}
              >
                {/* Address Title Input */}
                <div>
                  <label style={formStyles.label}>
                    Address Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 'Hardware Wallet', 'Exchange Account'"
                    value={newWithdrawalTitle}
                    onChange={(e) => setNewWithdrawalTitle(e.target.value)}
                    style={formStyles.input}
                  />
                </div>

                {/* Address Input */}
                <div>
                  <label style={formStyles.label}>
                    {networkType === "solana"
                      ? "Solana Address"
                      : "Ethereum Address"}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      networkType === "solana"
                        ? "Solana address..."
                        : "0x..."
                    }
                    value={newWithdrawalAddress}
                    onChange={(e) => setNewWithdrawalAddress(e.target.value)}
                    style={{
                      ...formStyles.input,
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleRequestWithdrawalAddress}
                disabled={
                  !newWithdrawalTitle.trim() ||
                  !newWithdrawalAddress.trim()
                }
                style={{
                  ...buttonStyles.warning,
                  ...((!newWithdrawalTitle.trim() || !newWithdrawalAddress.trim())
                    ? buttonStyles.disabled
                    : {}),
                  width: "100%",
                }}
              >
                📍 Add Withdrawal Address
              </button>
            </div>
          )}

          {/* Pending Withdrawal Address Requests */}
          {pendingWithdrawalRequests.length > 0 && (
            <div style={{ marginTop: spacing.md }}>
              <h5
                style={{
                  color: colors.warning.light,
                  margin: `0 0 ${spacing.md} 0`,
                }}
              >
                ⏳ Pending New Addresses ({pendingWithdrawalRequests.length})
              </h5>

              <div style={{ ...utilityStyles.grid, gap: spacing.sm }}>
                {pendingWithdrawalRequests.map((request, index) => (
                  <div
                    key={index}
                    style={{
                      ...cardStyles.warningCard,
                      padding: spacing.sm,
                    }}
                  >
                    <div style={layoutStyles.flexBetween}>
                      <div>
                        <div
                          style={{
                            color: colors.text.primary,
                            fontWeight: fontWeight.bold,
                          }}
                        >
                          📍 {request.title}
                        </div>
                        <div
                          style={{
                            fontSize: fontSize.xs,
                            color: colors.text.secondary,
                            fontFamily: "monospace",
                          }}
                        >
                          {request.destination.length > 50
                            ? `${request.destination.slice(0, 25)}...${request.destination.slice(-15)}`
                            : request.destination}
                        </div>
                        <div
                          style={{
                            fontSize: fontSize.xs,
                            color: colors.warning.light,
                            marginTop: "4px",
                          }}
                        >
                          ⏰ Will be available after setup is locked
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

WithdrawalAddressSetupStep.propTypes = {
  // Setup state
  isSetupCommitted: PropTypes.bool.isRequired,
  spendingLimits: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,

  // Blockchain services (dependency injection)
  transactionManager: PropTypes.object,
  savingsContract: PropTypes.object,

  // Network context
  networkType: PropTypes.string.isRequired,
  solanaConnected: PropTypes.bool,
  solanaPublicKey: PropTypes.object,
  userAddress: PropTypes.string,
};

export default WithdrawalAddressSetupStep;