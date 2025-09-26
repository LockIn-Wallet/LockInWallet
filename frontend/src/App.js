import React, { useState } from "react";
import { ethers } from "ethers";
import SavingsABI from "./SavingsABI.json";
import MockUSDT_ABI from "./MockUSDT_ABI.json";

const SAVINGS_CONTRACT_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const USDT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Replace with actual USDT address
// const USDT_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678"; // Replace with actual USDT address
const ETH_ADDRESS = "0x0000000000000000000000000000000000000000"; // ETH address (native token)

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [savingsContract, setSavingsContract] = useState(null);
  const [balance, setBalance] = useState(0);
  const [withdrawalLimit, setWithdrawalLimit] = useState("");
  const [withdrawalPeriod, setWithdrawalPeriod] = useState("");
  const [approver, setApprover] = useState("");
  const [categoryName, setCategoryName] = useState(""); // New state for category name
  const [categories, setCategories] = useState([]); // New state for categories
  const [depositAmount, setDepositAmount] = useState(""); // New state for deposit amount
  const [tokenAddress, setTokenAddress] = useState(""); // New state for token address

  // Two-phase system state
  const [isSetupCommitted, setIsSetupCommitted] = useState(false);
  const [setupInfo, setSetupInfo] = useState(null);

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

      // Automatically fetch USDT balance after connecting
      try {
        const userAddress = await web3Signer.getAddress();
        const userBalance = await savings.getTokenBalance(userAddress, USDT_ADDRESS);
        setBalance(ethers.formatUnits(userBalance, 6)); // USDT uses 6 decimals

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
        console.error("Error fetching balance:", error);
        setBalance("0");
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const getBalance = async () => {
    if (savingsContract && signer) {
      try {
        const userAddress = await signer.getAddress();
        const userBalance = await savingsContract.getTokenBalance(userAddress, USDT_ADDRESS);
        setBalance(ethers.formatUnits(userBalance, 6)); // USDT uses 6 decimals
      } catch (error) {
        console.error("Error fetching balance:", error);
        setBalance("0");
      }
    }
  };

  const deposit = async () => {
    if (savingsContract) {
      try {
        const amount = ethers.parseUnits(depositAmount, 6); // Convert input to USDT format

        // Approve the Savings contract to spend USDT
        if (tokenAddress !== ETH_ADDRESS) {
          const usdt = new ethers.Contract(tokenAddress, MockUSDT_ABI, signer);
          const approvalTx = await usdt.approve(SAVINGS_CONTRACT_ADDRESS, amount);
          await approvalTx.wait();
          console.log("Approval successful");
        }

        // Call the deposit function
        const depositTx = await savingsContract.deposit(tokenAddress, amount, {
          value: tokenAddress === ETH_ADDRESS ? amount : 0, // Only send ETH if depositing ETH
        });
        await depositTx.wait();
        alert(`Deposit of ${depositAmount} successful!`);
      } catch (error) {
        console.error("Deposit error:", error);
        alert("Failed to deposit. Please check the token address and amount.");
      }
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
        const limit = ethers.parseUnits(withdrawalLimit, 6); // USDT uses 6 decimals
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

        const amount = ethers.parseUnits(withdrawAmount, 6); // USDT uses 6 decimals
        const tx = await savingsContract.withdraw(categoryName.trim(), amount, USDT_ADDRESS);
        await tx.wait();
        alert(`Withdrawal of ${withdrawAmount} USDT from category "${categoryName}" successful!`);

        // Refresh balance and categories
        await getBalance();
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
      <h1>Savings Wallet</h1>
      {!provider ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <div>
          <button onClick={getBalance}>Get Balance</button>
          <div>
            <h3>Deposit</h3>
            <select
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
            >
              <option value="">Select Token</option>
              <option value={USDT_ADDRESS}>USDT</option>
              <option value={ETH_ADDRESS}>ETH</option>
            </select>
            <input
              type="text"
              placeholder="Amount (USDT)"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <button onClick={deposit}>Deposit</button>
          </div>
          <p>Your USDT Balance: {balance} USDT</p>

          {/* Two-Phase System Status */}
          <div style={{ marginBottom: "20px", padding: "15px", border: "2px solid #ddd", borderRadius: "5px", backgroundColor: isSetupCommitted ? "#f0f8ff" : "#fff8dc" }}>
            <h3>Setup Status: {isSetupCommitted ? "🔒 Locked Mode" : "⚙️ Setup Mode"}</h3>
            {!isSetupCommitted ? (
              <div>
                <p>You are in setup mode. You can freely add/modify categories.</p>
                <p><strong>⚠️ Once you commit, increases will require 24-72h timelock!</strong></p>
                <button onClick={commitSetup} style={{ backgroundColor: "#ff6b6b", color: "white", padding: "10px 20px", border: "none", borderRadius: "5px", cursor: "pointer" }}>
                  Commit Setup & Enter Locked Mode
                </button>
              </div>
            ) : (
              <div>
                <p>✅ Setup committed on {setupInfo?.commitTimestamp}</p>
                <p>📊 Total Locked Value: {setupInfo?.totalLockedValue} USDT</p>
                <p>📈 Increases This Period: {setupInfo?.increasesInPeriod} USDT</p>
                <p><strong>Security Rules:</strong></p>
                <ul style={{ fontSize: "0.9em", color: "#666" }}>
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
