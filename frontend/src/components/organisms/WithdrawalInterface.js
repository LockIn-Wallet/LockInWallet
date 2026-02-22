import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";

// Import components
import WithdrawalAddressSelector from "../WithdrawalAddressSelector.js";

// Import styles
import {
  layoutStyles,
  utilityStyles,
  colors,
  spacingUtilities,
} from "../../styles";

// Import utilities
import { formatCountdown, detectExceedingPeriod } from "../../utils/walletUtils.js";
import { ethers } from "ethers";

// Import services
import {
  fetchWithdrawalAddresses as fetchWithdrawalAddressesService,
  fetchPendingWithdrawalRequests as fetchPendingWithdrawalRequestsService,
  fetchPendingBypassRequests as fetchPendingBypassRequestsService,
} from "../../services";

/**
 * WithdrawalInterface Component
 *
 * Handles all withdrawal-related functionality including:
 * - Token and amount selection
 * - Instant withdrawal calculation display
 * - Destination selection and management
 * - Withdrawal execution (instant vs bypass)
 * - Pending withdrawal and bypass requests management
 */
const WithdrawalInterface = ({
  // Blockchain services (dependency injection)
  transactionManager,
  savingsContract,
  signer,
  connection,

  // Network & config
  networkType,
  selectedNetwork,
  getCurrentUserAddress,
  getCurrentNetwork,

  // Wallet state
  solanaConnected,
  solanaPublicKey,
  userAddress,

  // Shared token state (shared with DepositInterface)
  selectedToken,
  setSelectedToken,

  // Calculated values
  instantWithdrawableAmount,
  limitingPeriod,
  spendingLimits,

  // Callbacks for App.js state updates
  onBalanceUpdate,
  onSpendingLimitsUpdate,
  onWithdrawalDataUpdate,

  // Utilities
  currentTime,
}) => {
  // Internal withdrawal state
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [selectedWithdrawalDestination, setSelectedWithdrawalDestination] = useState("self");

  // Withdrawal address form state
  const [showWithdrawalAddressForm, setShowWithdrawalAddressForm] = useState(false);
  const [newWithdrawalTitle, setNewWithdrawalTitle] = useState("");
  const [newWithdrawalAddress, setNewWithdrawalAddress] = useState("");

  // Internal data state
  const [withdrawalAddresses, setWithdrawalAddresses] = useState([]);
  const [pendingWithdrawalRequests, setPendingWithdrawalRequests] = useState([]);
  const [pendingBypassRequests, setPendingBypassRequests] = useState([]);

  // Compute limit-exceeding status from local withdrawal amount
  const exceedingPeriod = detectExceedingPeriod(withdrawalAmount, spendingLimits);
  const exceedsInstantLimit = parseFloat(withdrawalAmount || 0) > instantWithdrawableAmount;

  // Loading states
  const [isLoading, setIsLoading] = useState(false);

  // Data fetching function
  const fetchWithdrawalData = async () => {
    if (!transactionManager && !savingsContract) return;

    try {
      const [addresses, requests, bypasses] = await Promise.all([
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
        fetchPendingBypassRequestsService({
          transactionManager,
          savingsContract,
          networkType,
          userAddress,
          solanaPublicKey,
        }),
      ]);

      setWithdrawalAddresses(addresses);
      setPendingWithdrawalRequests(requests);
      setPendingBypassRequests(bypasses);

      // Notify App.js of data updates
      if (onWithdrawalDataUpdate) {
        onWithdrawalDataUpdate('addresses', addresses);
        onWithdrawalDataUpdate('requests', requests);
        onWithdrawalDataUpdate('bypasses', bypasses);
      }
    } catch (error) {
      console.error('Error fetching withdrawal data:', error);
    }
  };

  // Load data when dependencies change
  useEffect(() => {
    // Only fetch data when transactionManager is available
    if (transactionManager) {
      fetchWithdrawalData();
    }
  }, [transactionManager, savingsContract, solanaConnected, networkType]);

  // Withdrawal execution function (moved from App.js)
  const withdrawToDestination = async () => {
    // Network-aware connection check
    if (networkType === "solana" && (!transactionManager || !solanaConnected)) {
      alert("Please connect your Solana wallet first");
      return;
    }
    if (networkType === "evm" && (!savingsContract || !selectedToken || !withdrawalAmount)) {
      alert("Please connect your MetaMask wallet first");
      return;
    }

    // Validate inputs
    if (!withdrawalAmount || isNaN(withdrawalAmount) || parseFloat(withdrawalAmount) <= 0) {
      alert("Please enter a valid withdrawal amount");
      return;
    }

    setIsLoading(true);
    try {
      if (networkType === "solana") {
        // Solana withdrawal to destination logic
        console.log("💸 Solana: Withdrawing to destination", withdrawalAmount, selectedToken, selectedWithdrawalDestination);

        const adapter = transactionManager.getCurrentAdapter();
        const amountValue = parseFloat(withdrawalAmount);
        let destinationAddress = selectedWithdrawalDestination;

        // Handle "self" destination - use user's wallet address
        if (selectedWithdrawalDestination === "self") {
          if (!solanaPublicKey) {
            throw new Error("Solana wallet not connected");
          }
          destinationAddress = solanaPublicKey.toString();
        }

        let txHash;
        if (selectedToken === "SOL") {
          // Withdraw SOL to destination
          const amountLamports = Math.floor(amountValue * Math.pow(10, 9)); // Convert to lamports
          txHash = await adapter.withdrawSolToDestination(destinationAddress, amountLamports);
        } else {
          // Withdraw SPL token to destination
          const network = getCurrentNetwork(networkType, selectedNetwork);
          const tokenInfo = network.tokens[selectedToken];
          if (!tokenInfo) {
            throw new Error(`Token ${selectedToken} not found in network configuration`);
          }
          const amountTokens = Math.floor(amountValue * Math.pow(10, tokenInfo.decimals));
          txHash = await adapter.withdrawSplToDestination(destinationAddress, tokenInfo.address, amountTokens);
        }

        alert(`✅ Solana withdrawal successful!\n\nTransaction: ${txHash}\nAmount: ${withdrawalAmount} ${selectedToken}\nDestination: ${destinationAddress.slice(0, 8)}...${destinationAddress.slice(-4)}`);
      } else {
        // EVM withdrawal to destination logic
        console.log("💸 EVM: Withdrawing to destination", withdrawalAmount, selectedToken, selectedWithdrawalDestination);

        let destinationAddress = selectedWithdrawalDestination;

        // Handle "self" destination - use user's wallet address
        if (selectedWithdrawalDestination === "self") {
          destinationAddress = getCurrentUserAddress();
        }

        let tx;
        if (selectedToken === "ETH") {
          // Withdraw ETH to destination
          const amountWei = ethers.parseEther(withdrawalAmount);
          tx = await savingsContract.withdrawTo(amountWei, ethers.ZeroAddress, destinationAddress);
        } else {
          // Withdraw ERC20 token to destination
          const network = getCurrentNetwork(networkType, selectedNetwork);
          const tokenInfo = network.tokens[selectedToken];
          if (!tokenInfo) {
            throw new Error(`Token ${selectedToken} not found in network configuration`);
          }
          const amountTokens = ethers.parseUnits(withdrawalAmount, tokenInfo.decimals);
          tx = await savingsContract.withdrawTo(amountTokens, tokenInfo.address, destinationAddress);
        }

        await tx.wait();
        alert(`✅ EVM withdrawal successful!\n\nTransaction: ${tx.hash}\nAmount: ${withdrawalAmount} ${selectedToken}\nDestination: ${destinationAddress.slice(0, 8)}...${destinationAddress.slice(-4)}`);
      }

      // Clear form and notify parent components
      setWithdrawalAmount("");

      // Notify App.js to refresh global state
      if (onBalanceUpdate) await onBalanceUpdate();
      if (onSpendingLimitsUpdate) await onSpendingLimitsUpdate();

      // Refresh internal data
      await fetchWithdrawalData();

    } catch (error) {
      console.error(`${networkType.toUpperCase()} withdrawal error:`, error);
      alert(`Failed to withdraw ${selectedToken}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Request bypass for withdrawal function (moved from App.js)
  const requestBypassForWithdrawal = async () => {
    // Network-aware validation
    if (networkType === "solana" && (!transactionManager || !solanaConnected || !withdrawalAmount || !exceedingPeriod)) {
      alert("Invalid withdrawal request - please connect Solana wallet and enter withdrawal details");
      return;
    }
    if (networkType === "evm" && (!savingsContract || !withdrawalAmount || !exceedingPeriod)) {
      alert("Invalid withdrawal request - please connect MetaMask and enter withdrawal details");
      return;
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Request withdrawal of ${withdrawalAmount} ${selectedToken} above ${exceedingPeriod} limit?\n\n` +
      `This will require a 24-hour waiting period before you can execute the withdrawal.\n\n` +
      `Click OK to submit the request.`
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      if (networkType === "solana") {
        // Solana bypass request logic
        console.log("🔒 Solana: Requesting bypass for", withdrawalAmount, selectedToken, exceedingPeriod);
        const adapter = transactionManager.getCurrentAdapter();
        let tokenAddress;
        let destination = selectedWithdrawalDestination;

        // Handle "self" destination
        if (selectedWithdrawalDestination === "self") {
          if (!solanaPublicKey) {
            throw new Error("Solana wallet not connected");
          }
          destination = solanaPublicKey.toString();
        }

        // Determine token address
        if (selectedToken === "SOL") {
          tokenAddress = "So11111111111111111111111111111111111111112"; // SOL mint
        } else {
          const currentNetwork = getCurrentNetwork(networkType, selectedNetwork);
          const token = currentNetwork.tokens[selectedToken];
          if (token) {
            tokenAddress = token.address;
          } else {
            alert("Please select a valid token");
            return;
          }
        }

        const amountValue = parseFloat(withdrawalAmount);
        const amountInSmallestUnit = selectedToken === "SOL"
          ? Math.floor(amountValue * Math.pow(10, 9)) // Convert to lamports
          : Math.floor(amountValue * Math.pow(10, currentNetwork.tokens[selectedToken].decimals));

        const txHash = await adapter.requestWithdrawalBypass(
          tokenAddress,
          amountInSmallestUnit,
          destination,
          exceedingPeriod
        );

        alert(`✅ Solana bypass request submitted!\n\nTransaction: ${txHash}\nAmount: ${withdrawalAmount} ${selectedToken}\nPeriod: ${exceedingPeriod}\n\nYou can execute this request after the 24-hour waiting period.`);
      } else {
        // EVM bypass request logic
        console.log("🔒 EVM: Requesting bypass for", withdrawalAmount, selectedToken, exceedingPeriod);

        let tx;
        if (selectedToken === "ETH") {
          const amountWei = ethers.parseEther(withdrawalAmount);
          tx = await savingsContract.requestLimitBypass(amountWei, exceedingPeriod, ethers.ZeroAddress);
        } else {
          const network = getCurrentNetwork(networkType, selectedNetwork);
          const tokenInfo = network.tokens[selectedToken];
          if (!tokenInfo) {
            throw new Error(`Token ${selectedToken} not found in network configuration`);
          }
          const amountTokens = ethers.parseUnits(withdrawalAmount, tokenInfo.decimals);
          tx = await savingsContract.requestLimitBypass(amountTokens, exceedingPeriod, tokenInfo.address);
        }

        await tx.wait();
        alert(`✅ EVM bypass request submitted!\n\nTransaction: ${tx.hash}\nAmount: ${withdrawalAmount} ${selectedToken}\nPeriod: ${exceedingPeriod}\n\nYou can execute this request after the 24-hour waiting period.`);
      }

      // Clear form and refresh data
      setWithdrawalAmount("");

      // Refresh internal data
      await fetchWithdrawalData();

    } catch (error) {
      console.error(`${networkType.toUpperCase()} bypass request error:`, error);
      alert(`Failed to request bypass: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Remove withdrawal address function (moved from App.js)
  const removeWithdrawalAddress = async (destination) => {
    if (!destination) {
      alert("Invalid destination address");
      return;
    }

    const confirmed = window.confirm(`Remove withdrawal address: ${destination}?`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      if (networkType === "solana") {
        const adapter = transactionManager.getCurrentAdapter();
        const txHash = await adapter.removeWithdrawalDestination(destination);
        alert(`✅ Solana withdrawal address removed!\n\nTransaction: ${txHash}\nRemoved: ${destination.slice(0, 8)}...${destination.slice(-4)}`);
      } else {
        const tx = await savingsContract.removeWithdrawalDestination(destination);
        await tx.wait();
        alert(`✅ EVM withdrawal address removed!\n\nTransaction: ${tx.hash}\nRemoved: ${destination.slice(0, 8)}...${destination.slice(-4)}`);
      }

      // Refresh internal data
      await fetchWithdrawalData();

    } catch (error) {
      console.error(`${networkType.toUpperCase()} remove address error:`, error);
      alert(`Failed to remove withdrawal address: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Execute bypass request function (moved from App.js)
  const executeBypassRequest = async (requestId) => {
    const confirmed = window.confirm("Execute this bypass request?");
    if (!confirmed) return;

    setIsLoading(true);
    try {
      if (networkType === "solana") {
        const adapter = transactionManager.getCurrentAdapter();
        const txHash = await adapter.executeWithdrawalBypass(requestId);
        alert(`✅ Solana bypass request executed!\n\nTransaction: ${txHash}`);
      } else {
        const tx = await savingsContract.executeWithdrawalBypass(requestId);
        await tx.wait();
        alert(`✅ EVM bypass request executed!\n\nTransaction: ${tx.hash}`);
      }

      // Notify parent components of state changes
      if (onBalanceUpdate) await onBalanceUpdate();
      if (onSpendingLimitsUpdate) await onSpendingLimitsUpdate();

      // Refresh internal data
      await fetchWithdrawalData();

    } catch (error) {
      console.error(`${networkType.toUpperCase()} execute bypass error:`, error);
      alert(`Failed to execute bypass request: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel bypass request function (moved from App.js)
  const cancelBypassRequest = async (requestId) => {
    const confirmed = window.confirm("Cancel this bypass request?");
    if (!confirmed) return;

    setIsLoading(true);
    try {
      if (networkType === "solana") {
        const adapter = transactionManager.getCurrentAdapter();
        const txHash = await adapter.cancelWithdrawalBypass(requestId);
        alert(`✅ Solana bypass request cancelled!\n\nTransaction: ${txHash}`);
      } else {
        const tx = await savingsContract.cancelBypassRequest(requestId);
        await tx.wait();
        alert(`✅ EVM bypass request cancelled!\n\nTransaction: ${tx.hash}`);
      }

      // Refresh internal data
      await fetchWithdrawalData();

    } catch (error) {
      console.error(`${networkType.toUpperCase()} cancel bypass error:`, error);
      alert(`Failed to cancel bypass request: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Execute withdrawal address request function (similar to bypass execution pattern)
  const executeWithdrawalRequest = async (request) => {
    const confirmed = window.confirm("Execute this withdrawal address request?");
    if (!confirmed) return;

    setIsLoading(true);
    try {
      if (networkType === "solana") {
        const adapter = transactionManager.getCurrentAdapter();
        const txHash = await adapter.executeWithdrawalDestinationRequest(request.requestId || request);
        alert(`✅ Solana withdrawal address approved!\n\nTransaction: ${txHash}`);
      } else {
        // EVM execution logic
        const adapter = transactionManager.getCurrentAdapter();
        const txHash = await adapter.executeWithdrawalAddressRequest(request.requestId || request);
        alert(`✅ EVM withdrawal address approved!\n\nTransaction: ${txHash}`);
      }

      // Refresh internal data
      await fetchWithdrawalData();

    } catch (error) {
      console.error(`${networkType.toUpperCase()} execute withdrawal request error:`, error);
      alert(`Failed to execute withdrawal request: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel withdrawal address request function (similar to bypass cancellation pattern)
  const cancelWithdrawalRequest = async (requestId) => {
    const confirmed = window.confirm("Cancel this withdrawal address request?");
    if (!confirmed) return;

    setIsLoading(true);
    try {
      if (networkType === "solana") {
        const adapter = transactionManager.getCurrentAdapter();
        const txHash = await adapter.cancelWithdrawalDestinationRequest(requestId);
        alert(`✅ Solana withdrawal address request cancelled!\n\nTransaction: ${txHash}`);
      } else {
        const tx = await savingsContract.cancelWithdrawalAddressRequest(requestId);
        await tx.wait();
        alert(`✅ EVM withdrawal address request cancelled!\n\nTransaction: ${tx.hash}`);
      }

      // Refresh internal data
      await fetchWithdrawalData();

    } catch (error) {
      console.error(`${networkType.toUpperCase()} cancel withdrawal request error:`, error);
      alert(`Failed to cancel withdrawal address request: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Request withdrawal address function (adapted from WithdrawalAddressSetupStep)
  const requestWithdrawalAddress = async (title, address) => {
    // Network-aware validation
    if (networkType === "solana" && (!transactionManager || !title || !address)) {
      alert("Please fill in all fields and connect your Solana wallet");
      return;
    }
    if (networkType === "evm" && (!savingsContract || !title || !address)) {
      alert("Please fill in all fields and connect your MetaMask wallet");
      return;
    }

    try {
      if (networkType === "solana") {
        // Solana address request logic
        if (address.length !== 44) {
          alert("Please enter a valid Solana address (44 characters)");
          return;
        }

        const adapter = transactionManager.getCurrentAdapter();
        const txHash = await adapter.addWithdrawalDestination(address, title);

        alert(
          `✅ Solana withdrawal address processed successfully!\n\n` +
          `Title: ${title}\n` +
          `Address: ${address}\n` +
          `Transaction: ${txHash}\n\n` +
          `The address has been processed. Check the withdrawal destinations or pending requests sections.`
        );
      } else {
        // EVM address request logic
        if (!ethers.isAddress(address)) {
          alert("Please enter a valid Ethereum address");
          return;
        }

        // Use the unified adapter interface we just implemented
        const adapter = transactionManager.getCurrentAdapter();
        const txHash = await adapter.addWithdrawalDestination(address, title);

        alert(
          `✅ EVM withdrawal address processed successfully!\n\n` +
          `Title: ${title}\n` +
          `Address: ${address}\n` +
          `Transaction: ${txHash}\n\n` +
          `The address has been processed based on your contract lock status. Check the withdrawal destinations or pending requests sections.`
        );
      }

      // Refresh internal data
      await fetchWithdrawalData();
    } catch (error) {
      console.error(`Error requesting ${networkType} withdrawal address:`, error);

      // Network-aware error handling
      if (error.message.includes("already exists")) {
        alert("This address is already in your withdrawal destinations");
      } else if (error.message.includes("own address")) {
        alert("You cannot add your own wallet address as a withdrawal destination");
      } else {
        alert(`Failed to add withdrawal address: ${error.message}`);
      }
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
        marginBottom: "20px",
        padding: "15px",
        border: "1px solid #333",
        borderRadius: "5px",
        backgroundColor: "#2d3748",
        color: "white",
        position: "relative",
      }}
    >
      <h3 style={{ color: colors.text.primary }}>💸 Withdraw Funds</h3>
      <p
        style={{
          fontSize: "0.9em",
          color: "#cbd5e0",
          marginBottom: "15px",
        }}
      >
        Withdrawals are automatically checked against all your active
        spending limits. You can withdraw to your own wallet or to
        approved withdrawal addresses.
      </p>

      {/* Token and Amount Selection */}
      <div style={layoutStyles.marginBottom}>
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "10px",
            flexWrap: "wrap",
          }}
        >
          <select
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #4a5568",
              backgroundColor: "#4a5568",
              color: "white",
              flex: "1",
              minWidth: "120px",
            }}
          >
            <option value="ETH">ETH</option>
            {Object.entries(
              getCurrentNetwork(networkType, selectedNetwork).tokens
            )
              .filter(
                ([_, token]) =>
                  token.address !==
                  "0x0000000000000000000000000000000000000000"
              )
              .map(([key, token]) => (
                <option key={key} value={key}>
                  {token.symbol}
                </option>
              ))}
          </select>

          <input
            type="text"
            placeholder={`Amount (${selectedToken})`}
            value={withdrawalAmount}
            onChange={(e) => setWithdrawalAmount(e.target.value)}
            style={{
              flex: "2",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #4a5568",
              backgroundColor: "#4a5568",
              color: "white",
              minWidth: "150px",
            }}
          />
        </div>
      </div>

      {/* Instant Withdrawal Information */}
      <div
        style={{
          marginBottom: "15px",
          padding: "10px",
          backgroundColor: "#1a202c",
          borderRadius: "4px",
          border: "1px solid #4a5568",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "5px",
          }}
        >
          <span style={{ fontSize: "0.9em", color: "#cbd5e0" }}>
            💡 Instant Withdrawable:
          </span>
          <span style={{ fontWeight: "bold", color: "#48bb78" }}>
            {(typeof instantWithdrawableAmount === "number"
              ? instantWithdrawableAmount
              : 0
            ).toFixed(2)}{" "}
            {selectedToken}
          </span>
        </div>
        {limitingPeriod && (
          <div style={{ fontSize: "0.8em", color: "#a0aec0" }}>
            Limited by: {limitingPeriod} spending limit
          </div>
        )}
        {withdrawalAmount && exceedsInstantLimit && exceedingPeriod && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              backgroundColor: "#2d3748",
              borderRadius: "4px",
              border: "1px solid #ed8936",
            }}
          >
            <div
              style={{
                fontSize: "0.85em",
                color: "#ed8936",
                fontWeight: "bold",
              }}
            >
              ⚠️ Amount exceeds {exceedingPeriod} limit
            </div>
            <div
              style={{
                fontSize: "0.8em",
                color: "#a0aec0",
                marginTop: "2px",
              }}
            >
              This withdrawal will require a 24-hour approval period
            </div>
          </div>
        )}
      </div>

      {/* Destination Selection as Radio Buttons */}
      <WithdrawalAddressSelector
        mode="selection"
        selectedDestination={selectedWithdrawalDestination}
        onDestinationChange={setSelectedWithdrawalDestination}
        showAddButton={true}
        title="Withdraw To:"
        withdrawalAddresses={withdrawalAddresses}
        getCurrentUserAddress={getCurrentUserAddress}
        removeWithdrawalAddress={removeWithdrawalAddress}
        showWithdrawalAddressForm={showWithdrawalAddressForm}
        setShowWithdrawalAddressForm={setShowWithdrawalAddressForm}
      />

      {/* Dynamic Withdrawal Buttons */}
      <div
        style={{ ...layoutStyles.flexGap, ...layoutStyles.fullWidth }}
      >
        {!exceedsInstantLimit ? (
          <button
            onClick={withdrawToDestination}
            disabled={
              !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
            }
            style={{
              padding: "12px 24px",
              borderRadius: "4px",
              border: "none",
              backgroundColor:
                !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                  ? "#4a5568"
                  : "#48bb78",
              color: "white",
              cursor:
                !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                  ? "not-allowed"
                  : "pointer",
              fontWeight: "bold",
              flex: "1",
              fontSize: "1em",
              opacity:
                !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                  ? 0.5
                  : 1,
            }}
          >
            ⚡ Instant Withdraw {selectedToken}
          </button>
        ) : (
          <>
            <button
              disabled={true}
              style={{
                padding: "12px 24px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: "#4a5568",
                color: "#a0aec0",
                cursor: "not-allowed",
                fontWeight: "bold",
                flex: "1",
                fontSize: "1em",
                opacity: 0.5,
              }}
            >
              ⚡ Instant Withdraw
            </button>
            <button
              onClick={() => requestBypassForWithdrawal()}
              disabled={
                !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
              }
              style={{
                padding: "12px 24px",
                borderRadius: "4px",
                border: "none",
                backgroundColor:
                  !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                    ? "#4a5568"
                    : "#ed8936",
                color: "white",
                cursor:
                  !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                    ? "not-allowed"
                    : "pointer",
                fontWeight: "bold",
                flex: "1",
                fontSize: "0.9em",
                opacity:
                  !withdrawalAmount || parseFloat(withdrawalAmount) <= 0
                    ? 0.5
                    : 1,
              }}
            >
              🕐 Request Above {exceedingPeriod} Limit
            </button>
          </>
        )}
      </div>

      {/* Add New Withdrawal Address Form */}
      {showWithdrawalAddressForm && (
        <div
          style={{
            marginTop: "15px",
            padding: "15px",
            backgroundColor: "#1a202c",
            borderRadius: "6px",
            border: "1px solid #4a5568",
          }}
        >
          <h5
            style={{
              color: "#fbb043",
              margin: "0 0 15px 0",
              fontSize: "1em",
              fontWeight: "bold",
            }}
          >
            📍 Add New Withdrawal Address
          </h5>

          <div
            style={{
              display: "grid",
              gap: "10px",
              marginBottom: "15px",
            }}
          >
            {/* Address Title Input */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  color: "#e2e8f0",
                  fontSize: "0.9em",
                  fontWeight: "bold",
                }}
              >
                Address Title
              </label>
              <input
                type="text"
                placeholder="e.g., 'Hardware Wallet', 'Exchange Account'"
                value={newWithdrawalTitle}
                onChange={(e) => setNewWithdrawalTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #4a5568",
                  backgroundColor: "#4a5568",
                  color: "white",
                  fontSize: "0.9em",
                }}
              />
            </div>

            {/* Address Input */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  color: "#e2e8f0",
                  fontSize: "0.9em",
                  fontWeight: "bold",
                }}
              >
                {networkType === "solana" ? "Solana Address" : "Ethereum Address"}
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
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #4a5568",
                  backgroundColor: "#4a5568",
                  color: "white",
                  fontSize: "0.9em",
                  fontFamily: "monospace",
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleRequestWithdrawalAddress}
              disabled={
                !newWithdrawalTitle.trim() || !newWithdrawalAddress.trim()
              }
              style={{
                flex: "1",
                padding: "10px 16px",
                borderRadius: "4px",
                border: "none",
                backgroundColor:
                  !newWithdrawalTitle.trim() || !newWithdrawalAddress.trim()
                    ? "#4a5568"
                    : "#fbb043",
                color: "white",
                cursor:
                  !newWithdrawalTitle.trim() || !newWithdrawalAddress.trim()
                    ? "not-allowed"
                    : "pointer",
                fontWeight: "bold",
                fontSize: "0.9em",
                opacity:
                  !newWithdrawalTitle.trim() || !newWithdrawalAddress.trim()
                    ? 0.5
                    : 1,
              }}
            >
              📍 Add Withdrawal Address
            </button>
            <button
              onClick={() => {
                setShowWithdrawalAddressForm(false);
                setNewWithdrawalTitle("");
                setNewWithdrawalAddress("");
              }}
              style={{
                padding: "10px 16px",
                borderRadius: "4px",
                border: "1px solid #718096",
                backgroundColor: "transparent",
                color: "#718096",
                cursor: "pointer",
                fontSize: "0.9em",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pending Withdrawal Address Requests */}
      {pendingWithdrawalRequests.length > 0 && (
        <div
          style={{
            marginTop: "15px",
            paddingTop: "15px",
            borderTop: "1px solid #4a5568",
          }}
        >
          <div>
            <h5
              style={{
                color: colors.warning.light,
                margin: `0 0 ${spacingUtilities.mb3} 0`,
              }}
            >
              ⏳ Pending Requests ({pendingWithdrawalRequests.length})
            </h5>
            <div style={{ ...utilityStyles.grid, gap: spacingUtilities.mb2 }}>
              {pendingWithdrawalRequests.map((request, index) => {
                const countdown = formatCountdown(
                  request.executeAfter,
                  currentTime
                );
                return (
                  <div
                    key={index}
                    style={{
                      padding: "10px",
                      backgroundColor: "#1a202c",
                      borderRadius: "6px",
                      border: countdown.ready
                        ? "1px solid #48bb78"
                        : "1px solid #ed8936",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "white",
                            fontWeight: "bold",
                          }}
                        >
                          📍 {request.title}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8em",
                            color: "#a0aec0",
                            fontFamily: "monospace",
                          }}
                        >
                          {request.destination}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {countdown.ready && (
                          <button
                            onClick={() =>
                              executeWithdrawalRequest(
                                request.requestId
                              )
                            }
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              border: "none",
                              backgroundColor: "#48bb78",
                              color: "white",
                              cursor: "pointer",
                              fontSize: "0.7em",
                              fontWeight: "bold",
                            }}
                          >
                            ⚡ Execute
                          </button>
                        )}
                        <button
                          onClick={() =>
                            cancelWithdrawalRequest(request.requestId)
                          }
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid #e53e3e",
                            backgroundColor: "transparent",
                            color: "#e53e3e",
                            cursor: "pointer",
                            fontSize: "0.7em",
                          }}
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "6px 10px",
                        backgroundColor: "#4a5568",
                        borderRadius: "4px",
                        textAlign: "center",
                        color: countdown.color,
                        fontWeight: "bold",
                        fontSize: "0.8em",
                      }}
                    >
                      {countdown.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pending Bypass Requests */}
      {pendingBypassRequests.length > 0 && (
        <div
          style={{
            marginTop: "15px",
            paddingTop: "15px",
            borderTop: "1px solid #4a5568",
          }}
        >
          <div>
            <h5
              style={{
                color: colors.warning.light,
                margin: `0 0 ${spacingUtilities.mb3} 0`,
              }}
            >
              🔒 Pending Bypass Requests ({pendingBypassRequests.length}
              )
            </h5>
            <div style={{ ...utilityStyles.grid, gap: spacingUtilities.mb2 }}>
              {pendingBypassRequests.map((request, index) => {
                const countdown = formatCountdown(
                  request.executeAfter,
                  currentTime
                );
                return (
                  <div
                    key={index}
                    style={{
                      padding: "10px",
                      backgroundColor: "#1a202c",
                      borderRadius: "6px",
                      border: countdown.ready
                        ? "1px solid #48bb78"
                        : "1px solid #ed8936",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "white",
                            fontWeight: "bold",
                          }}
                        >
                          🔒 {request.amount} {request.token}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8em",
                            color: "#a0aec0",
                          }}
                        >
                          Period: {request.period} • To:{" "}
                          {request.destination?.slice(0, 8)}...
                          {request.destination?.slice(-4)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {countdown.ready && (
                          <button
                            onClick={() =>
                              executeBypassRequest(request.requestId)
                            }
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              border: "none",
                              backgroundColor: "#48bb78",
                              color: "white",
                              cursor: "pointer",
                              fontSize: "0.7em",
                              fontWeight: "bold",
                            }}
                          >
                            ⚡ Execute
                          </button>
                        )}
                        <button
                          onClick={() =>
                            cancelBypassRequest(request.requestId)
                          }
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid #e53e3e",
                            backgroundColor: "transparent",
                            color: "#e53e3e",
                            cursor: "pointer",
                            fontSize: "0.7em",
                          }}
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "6px 10px",
                        backgroundColor: "#4a5568",
                        borderRadius: "4px",
                        textAlign: "center",
                        color: countdown.color,
                        fontWeight: "bold",
                        fontSize: "0.8em",
                      }}
                    >
                      {countdown.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

WithdrawalInterface.propTypes = {
  // Blockchain services (dependency injection)
  transactionManager: PropTypes.object,
  savingsContract: PropTypes.object,
  signer: PropTypes.object,
  connection: PropTypes.object,

  // Network & config
  networkType: PropTypes.string.isRequired,
  selectedNetwork: PropTypes.string.isRequired,
  getCurrentUserAddress: PropTypes.func.isRequired,
  getCurrentNetwork: PropTypes.func.isRequired,

  // Wallet state
  solanaConnected: PropTypes.bool,
  solanaPublicKey: PropTypes.object,
  userAddress: PropTypes.string,

  // Shared token state (shared with DepositInterface)
  selectedToken: PropTypes.string.isRequired,
  setSelectedToken: PropTypes.func.isRequired,

  // Calculated values
  instantWithdrawableAmount: PropTypes.number.isRequired,
  limitingPeriod: PropTypes.string,
  spendingLimits: PropTypes.array.isRequired,

  // Callbacks for App.js state updates
  onBalanceUpdate: PropTypes.func,
  onSpendingLimitsUpdate: PropTypes.func,
  onWithdrawalDataUpdate: PropTypes.func,

  // Utilities
  currentTime: PropTypes.number.isRequired,
};

export default WithdrawalInterface;