import React, { useState } from "react";
import { ethers } from "ethers";
import SavingsABI from "./SavingsABI.json";
import MockUSDT_ABI from "./MockUSDT_ABI.json";

const SAVINGS_CONTRACT_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const ETH_ADDRESS = "0x0000000000000000000000000000000000000000"; // ETH address (native token)

// Stablecoin configuration for localhost development
const STABLECOINS = {
  USDT: {
    address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    recommended: true
  },
  USDC: {
    address: "0x0000000000000000000000000000000000000000", // Placeholder - deploy when needed
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    recommended: true
  },
  DAI: {
    address: "0x0000000000000000000000000000000000000000", // Placeholder - deploy when needed
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    recommended: true
  }
};

// For backward compatibility
const USDT_ADDRESS = STABLECOINS.USDT.address;

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [savingsContract, setSavingsContract] = useState(null);
  const [balances, setBalances] = useState({}); // Multi-token balances
  const [withdrawalLimit, setWithdrawalLimit] = useState("");
  const [withdrawalPeriod, setWithdrawalPeriod] = useState("");
  const [approver, setApprover] = useState("");
  const [categoryName, setCategoryName] = useState(""); // New state for category name
  const [categories, setCategories] = useState([]); // New state for categories
  const [depositAmount, setDepositAmount] = useState(""); // New state for deposit amount
  const [selectedToken, setSelectedToken] = useState("USDT"); // Default to USDT
  const [userAddress, setUserAddress] = useState(""); // Store user address

  // Two-phase system state
  const [isSetupCommitted, setIsSetupCommitted] = useState(false);
  const [setupInfo, setSetupInfo] = useState(null);

  const fetchAllBalances = async (contract = savingsContract, userAddr = null) => {
    if (contract && signer) {
      try {
        const userAddress = userAddr || await signer.getAddress();
        const newBalances = {};

        // Fetch ETH balance
        const ethBalance = await contract.getTokenBalance(userAddress, ETH_ADDRESS);
        newBalances['ETH'] = ethers.formatUnits(ethBalance, 18);

        // Fetch stablecoin balances
        for (const [key, token] of Object.entries(STABLECOINS)) {
          if (token.address !== "0x0000000000000000000000000000000000000000") {
            try {
              const tokenBalance = await contract.getTokenBalance(userAddress, token.address);
              newBalances[key] = ethers.formatUnits(tokenBalance, token.decimals);
            } catch (err) {
              console.log(`Token ${key} not available:`, err.message);
              newBalances[key] = "0";
            }
          } else {
            newBalances[key] = "0";
          }
        }

        setBalances(newBalances);
      } catch (error) {
        console.error("Error fetching balances:", error);
        setBalances({});
      }
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const web3Signer = await web3Provider.getSigner();
      const savings = new ethers.Contract(
        SAVINGS_CONTRACT_ADDRESS,
        SavingsABI,
        web3Signer
      );

      setProvider(web3Provider);
      setSigner(web3Signer);
      setSavingsContract(savings);

      // Store user address
      const address = await web3Signer.getAddress();
      setUserAddress(address);

      // Automatically fetch balances for all recommended tokens after connecting
      try {
        const userAddress = await web3Signer.getAddress();
        await fetchAllBalances(savings, userAddress);

        // Check setup status
        const setupCommitted = await savings.isSetupCommitted();
        setIsSetupCommitted(setupCommitted);

        if (setupCommitted) {
          const info = await savings.getSetupInfo();
          setSetupInfo({
            committed: info.committed,
            totalLockedValue: ethers.formatUnits(info.totalLockedValue, 6),
            commitTimestamp: new Date(Number(info.commitTimestamp) * 1000).toLocaleDateString(),
            increasesInPeriod: ethers.formatUnits(info.increasesInPeriod, 6),
            lastIncreaseTimestamp: new Date(Number(info.lastIncreaseTimestamp) * 1000).toLocaleDateString()
          });
        }
      } catch (error) {
        console.error("Error fetching balances:", error);
        setBalances({});
      }
    } else {
      alert("Please install MetaMask!");
    }
  };


  const deposit = async () => {
    if (savingsContract && selectedToken && depositAmount) {
      try {
        let tokenAddress;
        let decimals;
        let tokenSymbol;

        // Determine token details based on selection
        if (selectedToken === "ETH") {
          tokenAddress = ETH_ADDRESS;
          decimals = 18;
          tokenSymbol = "ETH";
        } else if (STABLECOINS[selectedToken]) {
          const token = STABLECOINS[selectedToken];
          if (token.address === "0x0000000000000000000000000000000000000000") {
            alert(`${token.symbol} is not available on this network`);
            return;
          }
          tokenAddress = token.address;
          decimals = token.decimals;
          tokenSymbol = token.symbol;
        } else {
          alert("Please select a valid token");
          return;
        }

        const amount = ethers.parseUnits(depositAmount, decimals);

        // Approve the Savings contract to spend ERC20 tokens (not needed for ETH)
        if (tokenAddress !== ETH_ADDRESS) {
          const tokenContract = new ethers.Contract(tokenAddress, MockUSDT_ABI, signer);
          const approvalTx = await tokenContract.approve(SAVINGS_CONTRACT_ADDRESS, amount);
          await approvalTx.wait();
          console.log(`${tokenSymbol} approval successful`);
        }

        // Call the deposit function
        const depositTx = await savingsContract.deposit(tokenAddress, amount, {
          value: tokenAddress === ETH_ADDRESS ? amount : 0, // Only send ETH if depositing ETH
        });
        await depositTx.wait();
        alert(`Deposit of ${depositAmount} ${tokenSymbol} successful!`);

        // Clear form and refresh balances
        setDepositAmount("");
        await fetchAllBalances();
      } catch (error) {
        console.error("Deposit error:", error);
        alert("Failed to deposit. Please check the token selection and amount.");
      }
    } else {
      alert("Please select a token and enter an amount");
    }
  };

  const setWithdrawalCategory = async () => {
    if (savingsContract) {
      try {
        if (!categoryName || categoryName.trim() === "") {
          alert("Please enter a category name");
          return;
        }
        const category = categoryName.trim();
        const limit = ethers.parseUnits(withdrawalLimit, 6); // Default to 6 decimals for now
        const periodInDays = parseInt(withdrawalPeriod, 10);
        const periodInSeconds = periodInDays * 24 * 60 * 60; // Convert days to seconds

        const tx = await savingsContract.setWithdrawalCategory(
          category,
          limit,
          periodInSeconds
        );
        await tx.wait();
        alert("Withdrawal category set successfully!");

        // Automatically refresh the categories list
        await fetchCategories();

        // Clear the form
        setCategoryName("");
        setWithdrawalLimit("");
        setWithdrawalPeriod("");
      } catch (error) {
        console.error("Error setting withdrawal category:", error);
        alert("Failed to set withdrawal category. Please try again.");
      }
    }
  };

  const addApprover = async () => {
    if (savingsContract) {
      const tx = await savingsContract.addApprovalAddress(approver);
      await tx.wait();
      alert("Approver added successfully!");
    }
  };

  const withdrawByCategory = async () => {
    if (savingsContract) {
      try {
        if (!categoryName || categoryName.trim() === "") {
          alert("Please enter a category name");
          return;
        }

        const withdrawAmount = prompt("Enter withdrawal amount (USDT):");
        if (!withdrawAmount || isNaN(withdrawAmount) || parseFloat(withdrawAmount) <= 0) {
          alert("Please enter a valid withdrawal amount");
          return;
        }

        const amount = ethers.parseUnits(withdrawAmount, 6); // Default to 6 decimals for now
        const tx = await savingsContract.withdraw(categoryName.trim(), amount, USDT_ADDRESS); // Default to USDT for now
        await tx.wait();
        alert(`Withdrawal of ${withdrawAmount} USDT from category "${categoryName}" successful!`);

        // Refresh balances and categories
        await fetchAllBalances();
        await fetchCategories();
      } catch (error) {
        console.error("Withdrawal error:", error);
        alert("Failed to withdraw. Please check the category name and try again.");
      }
    }
  };

  const commitSetup = async () => {
    if (savingsContract) {
      try {
        const tx = await savingsContract.commitInitialSetup();
        await tx.wait();
        alert("Setup committed successfully! You are now in locked mode.");

        // Refresh setup status
        const setupCommitted = await savingsContract.isSetupCommitted();
        setIsSetupCommitted(setupCommitted);

        if (setupCommitted) {
          const info = await savingsContract.getSetupInfo();
          setSetupInfo({
            committed: info.committed,
            totalLockedValue: ethers.formatUnits(info.totalLockedValue, 6),
            commitTimestamp: new Date(Number(info.commitTimestamp) * 1000).toLocaleDateString(),
            increasesInPeriod: ethers.formatUnits(info.increasesInPeriod, 6),
            lastIncreaseTimestamp: new Date(Number(info.lastIncreaseTimestamp) * 1000).toLocaleDateString()
          });
        }
      } catch (error) {
        console.error("Error committing setup:", error);
        alert("Failed to commit setup. Please try again.");
      }
    }
  };

  const fetchCategories = async () => {
    if (savingsContract && signer) {
      try {
        const userAddress = await signer.getAddress();
        const fetchedCategories = [];

        // Get all user's category names from the smart contract
        const userCategoryNames = await savingsContract.getUserCategories(userAddress);
        console.log("User categories from contract:", userCategoryNames);

        for (const categoryName of userCategoryNames) {
          try {
            const category = await savingsContract.getWithdrawalCategory(userAddress, categoryName);

            // If the category exists (has a limit > 0), add it to the list
            if (category.limit > 0) {
              const limit = ethers.formatUnits(category.limit, 6); // USDT uses 6 decimals
              const remaining = ethers.formatUnits(category.limit - category.spentInPeriod, 6);

              fetchedCategories.push({
                name: categoryName,
                limit,
                remaining: remaining,
                spentInPeriod: ethers.formatUnits(category.spentInPeriod, 6),
                period: category.period.toString()
              });
            }
          } catch (error) {
            console.log(`Error fetching category "${categoryName}":`, error.message);
          }
        }

        setCategories(fetchedCategories);
        console.log("Fetched categories:", fetchedCategories);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1>🔒 Lock In Wallet</h1>
      {!provider ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <div>
          <button onClick={fetchAllBalances}>Refresh Balances</button>
          <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "5px" }}>
            <h3>Deposit 💰</h3>
            <p style={{ fontSize: "0.9em", color: "#666", marginBottom: "15px" }}>Recommended: Use stablecoins (USDT, USDC, DAI) for consistent value</p>

            <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap" }}>
              <select
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", flex: "1", minWidth: "150px" }}
              >
                <option value="">Select Token</option>

                {/* Recommended Stablecoins Section */}
                <optgroup label="🌟 Recommended Stablecoins">
                  {Object.entries(STABLECOINS)
                    .filter(([_, token]) => token.recommended && token.address !== "0x0000000000000000000000000000000000000000")
                    .map(([key, token]) => (
                      <option key={key} value={key}>{token.symbol} - {token.name}</option>
                    ))
                  }
                </optgroup>

                {/* Other Tokens Section */}
                <optgroup label="Other Tokens">
                  <option value="ETH">ETH - Ethereum</option>
                  {Object.entries(STABLECOINS)
                    .filter(([_, token]) => !token.recommended || token.address === "0x0000000000000000000000000000000000000000")
                    .map(([key, token]) => (
                      <option key={key} value={key} disabled={token.address === "0x0000000000000000000000000000000000000000"}>
                        {token.symbol} - {token.name} {token.address === "0x0000000000000000000000000000000000000000" ? "(Not Available)" : ""}
                      </option>
                    ))
                  }
                </optgroup>
              </select>

              <input
                type="text"
                placeholder={`Amount ${selectedToken ? `(${selectedToken})` : ''}`}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", flex: "2", minWidth: "200px" }}
              />

              <button
                onClick={deposit}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: selectedToken && STABLECOINS[selectedToken]?.recommended ? "#28a745" : "#007bff",
                  color: "white",
                  cursor: "pointer",
                  minWidth: "100px"
                }}
              >
                Deposit
              </button>
            </div>

          </div>

          {/* Exchange Deposit Section */}
          <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #333", borderRadius: "5px", backgroundColor: "#2d3748", color: "white" }}>
            <h3 style={{ color: "white" }}>🏦 Direct Deposit from Exchange</h3>
            <p style={{ fontSize: "0.9em", color: "#cbd5e0", marginBottom: "15px" }}>Get your personal deposit address to receive funds directly from exchanges</p>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "15px" }}>
              <strong style={{ color: "white" }}>Your Deposit Address:</strong>
              <code style={{
                backgroundColor: "#4a5568",
                color: "#e2e8f0",
                padding: "8px",
                borderRadius: "4px",
                fontSize: "0.9em",
                wordBreak: "break-all",
                flex: 1
              }}>
                {userAddress || "Connect wallet to see address"}
              </code>
              <button
                onClick={() => {
                  if (userAddress) {
                    navigator.clipboard.writeText(userAddress);
                    alert("Address copied to clipboard!");
                  }
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "#718096",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "0.8em"
                }}
              >
                📋 Copy
              </button>
            </div>
          </div>
          {/* Multi-token balance display */}
          <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #333", borderRadius: "5px", backgroundColor: "#2d3748", color: "white" }}>
            <h3 style={{ color: "white" }}>Your Balances</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
              {/* Show stablecoins by default */}
              {Object.entries(STABLECOINS).map(([key, token]) => (
                <div key={key} style={{
                  padding: "10px",
                  backgroundColor: token.recommended ? "#2f855a" : "#4a5568",
                  borderRadius: "3px",
                  border: token.recommended ? "1px solid #48bb78" : "none",
                  color: "white"
                }}>
                  <strong>{token.symbol}:</strong> {balances[key] || "0"} {token.symbol}
                  {token.recommended && <div style={{ fontSize: "0.8em", color: "#9ae6b4" }}>✓ Recommended</div>}
                </div>
              ))}

              {/* Show ETH only if user has balance */}
              {balances.ETH && parseFloat(balances.ETH) > 0 && (
                <div style={{ padding: "10px", backgroundColor: "#4a5568", borderRadius: "3px", color: "white" }}>
                  <strong>ETH:</strong> {balances.ETH} ETH
                </div>
              )}
            </div>
          </div>

          {/* Two-Phase System Status */}
          <div style={{ marginBottom: "20px", padding: "15px", border: "2px solid #333", borderRadius: "5px", backgroundColor: isSetupCommitted ? "#1a365d" : "#2d3748", color: "white" }}>
            <h3 style={{ color: "white" }}>Setup Status: {isSetupCommitted ? "🔒 Locked Mode" : "⚙️ Setup Mode"}</h3>
            {!isSetupCommitted ? (
              <div>
                <p style={{ color: "#e2e8f0" }}>You are in setup mode. You can freely add/modify categories.</p>
                <p style={{ color: "#fbb6ce" }}><strong>⚠️ Once you commit, increases will require 24-72h timelock!</strong></p>
                <button onClick={commitSetup} style={{ backgroundColor: "#e53e3e", color: "white", padding: "10px 20px", border: "none", borderRadius: "5px", cursor: "pointer" }}>
                  Commit Setup & Enter Locked Mode
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color: "#9ae6b4" }}>✅ Setup committed on {setupInfo?.commitTimestamp}</p>
                <p style={{ color: "#e2e8f0" }}>📊 Total Locked Value: {setupInfo?.totalLockedValue} USDT</p>
                <p style={{ color: "#e2e8f0" }}>📈 Increases This Period: {setupInfo?.increasesInPeriod} USDT</p>
                <p style={{ color: "white" }}><strong>Security Rules:</strong></p>
                <ul style={{ fontSize: "0.9em", color: "#cbd5e0" }}>
                  <li>Increases: 24-72h timelock required</li>
                  <li>Decreases: Immediate</li>
                  <li>Max increase: 20% of locked value per 7 days</li>
                </ul>
              </div>
            )}
          </div>

          <h3>Set Withdrawal Category</h3>
          <input
            type="text"
            placeholder="Category Name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Limit (USDT)"
            value={withdrawalLimit}
            onChange={(e) => setWithdrawalLimit(e.target.value)}
          />
          <input
            type="text"
            placeholder="Period (days)"
            value={withdrawalPeriod}
            onChange={(e) => setWithdrawalPeriod(e.target.value)}
          />
          <button onClick={setWithdrawalCategory}>Set Category</button>

          <div>
            <h3>Withdraw by Category</h3>
            <input
              type="text"
              placeholder="Category Name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
            <button onClick={withdrawByCategory}>Withdraw</button>
          </div>

          <div>
            <h3>Add Approver</h3>
            <input
              type="text"
              placeholder="Approver Address"
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
            />
            <button onClick={addApprover}>Add Approver</button>
          </div>

          <button onClick={fetchCategories}>Refresh Categories</button>
          <div>
            <h3>Categories ({categories.length})</h3>
            {categories.length === 0 ? (
              <p>No categories found. Create a category above to get started.</p>
            ) : (
              <ul>
                {categories.map((category, index) => (
                  <li key={index} style={{ marginBottom: "10px", padding: "10px", border: "1px solid #ccc", borderRadius: "5px" }}>
                    <strong>{category.name}</strong><br/>
                    Limit: {category.limit} USDT<br/>
                    Remaining: {category.remaining} USDT<br/>
                    Spent: {category.spentInPeriod} USDT<br/>
                    Period: {Math.floor(category.period / 86400)} days
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
