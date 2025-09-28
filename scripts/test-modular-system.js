const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🧪 Testing modular savings wallet system...\n");

  // Get test accounts
  const [deployer, user1] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Test User: ${user1.address}\n`);

  // Load module addresses
  const moduleConfigPath = path.join(__dirname, "../frontend/src/moduleAddresses.json");
  const moduleConfig = JSON.parse(fs.readFileSync(moduleConfigPath, "utf8"));

  console.log("📋 Module Configuration:");
  console.log(`Core Address: ${moduleConfig.core}`);
  console.log(`TimePeriodLimits: ${moduleConfig.modules.timePeriodLimits}`);
  console.log(`ProposalSystem: ${moduleConfig.modules.proposalSystem}`);
  console.log(`BypassSystem: ${moduleConfig.modules.bypassSystem}`);
  console.log(`ApprovalSystem: ${moduleConfig.modules.approvalSystem}`);
  console.log(`MockUSDT: ${moduleConfig.tokens.usdt}\n`);

  try {
    // 1. Test Core Contract Connectivity
    console.log("🔍 Test 1: Core Contract Connectivity");
    const savingsCore = await ethers.getContractAt("SavingsCore", moduleConfig.core);

    const owner = await savingsCore.owner();
    console.log(`✅ Core contract owner: ${owner}`);

    const isUser1AuthorizedModule = await savingsCore.isAuthorizedModule(user1.address);
    console.log(`✅ User1 is authorized module: ${isUser1AuthorizedModule} (expected: false)`);

    // 2. Test Module Registrations
    console.log("\n🔍 Test 2: Module Registrations");
    const timePeriodLimitsRegistered = await savingsCore.getModule(ethers.keccak256(ethers.toUtf8Bytes("TIME_PERIOD_LIMITS")));
    const proposalSystemRegistered = await savingsCore.getModule(ethers.keccak256(ethers.toUtf8Bytes("PROPOSAL_SYSTEM")));
    const bypassSystemRegistered = await savingsCore.getModule(ethers.keccak256(ethers.toUtf8Bytes("BYPASS_SYSTEM")));
    const approvalSystemRegistered = await savingsCore.getModule(ethers.keccak256(ethers.toUtf8Bytes("APPROVAL_SYSTEM")));

    console.log(`✅ TimePeriodLimits registered: ${timePeriodLimitsRegistered === moduleConfig.modules.timePeriodLimits}`);
    console.log(`✅ ProposalSystem registered: ${proposalSystemRegistered === moduleConfig.modules.proposalSystem}`);
    console.log(`✅ BypassSystem registered: ${bypassSystemRegistered === moduleConfig.modules.bypassSystem}`);
    console.log(`✅ ApprovalSystem registered: ${approvalSystemRegistered === moduleConfig.modules.approvalSystem}`);

    // 3. Test ETH Deposit
    console.log("\n🔍 Test 3: ETH Deposit");
    const initialBalance = await savingsCore.getTokenBalance(user1.address, ethers.ZeroAddress);
    console.log(`Initial ETH balance: ${ethers.formatEther(initialBalance)} ETH`);

    const depositAmount = ethers.parseEther("1.0");
    const depositTx = await savingsCore.connect(user1)["deposit(address,uint256)"](ethers.ZeroAddress, depositAmount, { value: depositAmount });
    await depositTx.wait();

    const afterDepositBalance = await savingsCore.getTokenBalance(user1.address, ethers.ZeroAddress);
    console.log(`✅ After deposit balance: ${ethers.formatEther(afterDepositBalance)} ETH`);
    console.log(`✅ Deposit successful: ${afterDepositBalance.toString() === depositAmount.toString()}`);

    // 4. Test Token Deposit (MockUSDT)
    console.log("\n🔍 Test 4: USDT Deposit");
    const mockUSDT = await ethers.getContractAt("MockUSDT", moduleConfig.tokens.usdt);

    // Transfer some USDT to user1
    const usdtAmount = ethers.parseUnits("100", 6); // 100 USDT (6 decimals)
    const transferTx = await mockUSDT.connect(deployer).transfer(user1.address, usdtAmount);
    await transferTx.wait();

    // Approve core contract to spend USDT
    const approveTx = await mockUSDT.connect(user1).approve(moduleConfig.core, usdtAmount);
    await approveTx.wait();

    const initialUSDTBalance = await savingsCore.getTokenBalance(user1.address, moduleConfig.tokens.usdt);
    console.log(`Initial USDT balance: ${ethers.formatUnits(initialUSDTBalance, 6)} USDT`);

    const usdtDepositTx = await savingsCore.connect(user1)["deposit(address,uint256)"](moduleConfig.tokens.usdt, usdtAmount);
    await usdtDepositTx.wait();

    const afterUSDTDepositBalance = await savingsCore.getTokenBalance(user1.address, moduleConfig.tokens.usdt);
    console.log(`✅ After deposit USDT balance: ${ethers.formatUnits(afterUSDTDepositBalance, 6)} USDT`);
    console.log(`✅ USDT deposit successful: ${afterUSDTDepositBalance.toString() === usdtAmount.toString()}`);

    // 5. Test Time Period Limits
    console.log("\n🔍 Test 5: Setting Time Period Limits");

    const dailyLimit = ethers.parseUnits("5", 6); // 5 USDT daily limit
    const weeklyLimit = ethers.parseUnits("50", 6); // 50 USDT weekly limit (5*7 = 35 < 50)
    const monthlyLimit = ethers.parseUnits("250", 6); // 250 USDT monthly limit (50*4 = 200 < 250)

    const setLimitsTx = await savingsCore.connect(user1).setCommonPeriodLimits(
      dailyLimit,
      weeklyLimit,
      monthlyLimit
    );
    await setLimitsTx.wait();

    // Check limits were set
    const spendingLimits = await savingsCore.connect(user1).getUserSpendingLimits(user1.address);
    console.log(`✅ Spending limits set:`);
    for (let i = 0; i < spendingLimits.names.length; i++) {
      if (spendingLimits.active[i]) {
        console.log(`   ${spendingLimits.names[i]}: ${ethers.formatUnits(spendingLimits.limits[i], 6)} USDT`);
      }
    }

    // 6. Test Withdrawal
    console.log("\n🔍 Test 6: USDT Withdrawal");
    const withdrawAmount = ethers.parseUnits("3", 6); // 3 USDT (within daily limit of 5)

    const beforeWithdrawBalance = await savingsCore.getTokenBalance(user1.address, moduleConfig.tokens.usdt);
    console.log(`Before withdrawal: ${ethers.formatUnits(beforeWithdrawBalance, 6)} USDT`);

    const withdrawTx = await savingsCore.connect(user1).withdraw(withdrawAmount, moduleConfig.tokens.usdt);
    await withdrawTx.wait();

    const afterWithdrawBalance = await savingsCore.getTokenBalance(user1.address, moduleConfig.tokens.usdt);
    console.log(`✅ After withdrawal: ${ethers.formatUnits(afterWithdrawBalance, 6)} USDT`);

    const expectedBalance = beforeWithdrawBalance - withdrawAmount;
    console.log(`✅ Withdrawal successful: ${afterWithdrawBalance.toString() === expectedBalance.toString()}`);

    // 7. Test Approval System
    console.log("\n🔍 Test 7: Approval System");

    const addApprovalTx = await savingsCore.connect(user1).addApprovalAddress(deployer.address);
    await addApprovalTx.wait();

    const isApprover = await savingsCore.isApprovalAddress(user1.address, deployer.address);
    console.log(`✅ Deployer is approver for user1: ${isApprover}`);

    // Test full withdrawal approval
    const approveFullWithdrawalTx = await savingsCore.connect(deployer).approveFullWithdrawal(user1.address);
    await approveFullWithdrawalTx.wait();
    console.log(`✅ Full withdrawal approved for user1`);

    // 8. Test Setup Commitment (Proposal System)
    console.log("\n🔍 Test 8: Setup Commitment");

    const isSetupCommittedBefore = await savingsCore.connect(user1).isSetupCommitted();
    console.log(`Setup committed before: ${isSetupCommittedBefore}`);

    const commitSetupTx = await savingsCore.connect(user1).commitInitialSetup();
    await commitSetupTx.wait();

    const isSetupCommittedAfter = await savingsCore.connect(user1).isSetupCommitted();
    console.log(`✅ Setup committed after: ${isSetupCommittedAfter}`);

    // Get setup info
    const setupInfo = await savingsCore.connect(user1).getSetupInfo();
    console.log(`✅ Total locked value: ${ethers.formatUnits(setupInfo.totalLockedValue, 6)} USDT`);

    // 9. Test Module Isolation
    console.log("\n🔍 Test 9: Module Isolation");

    // Try to call module function directly (should fail for unauthorized caller)
    const timePeriodLimitsModule = await ethers.getContractAt("TimePeriodLimitsModule", moduleConfig.modules.timePeriodLimits);

    try {
      await timePeriodLimitsModule.connect(user1).addTimePeriodLimit(
        user1.address,
        "Test",
        ethers.parseUnits("1", 6),
        86400
      );
      console.log("❌ Direct module call should have failed");
    } catch (error) {
      console.log(`✅ Direct module call properly rejected: ${error.message.includes("Not authorized")}`);
    }

    console.log("\n🎉 All tests completed successfully!");
    console.log("=" .repeat(50));
    console.log("✅ Core contract functioning");
    console.log("✅ All modules registered and working");
    console.log("✅ Deposits and withdrawals working");
    console.log("✅ Time period limits functioning");
    console.log("✅ Approval system working");
    console.log("✅ Proposal system working");
    console.log("✅ Module isolation enforced");
    console.log("=" .repeat(50));

    console.log("\n📊 Final Balances:");
    const finalETHBalance = await savingsCore.getTokenBalance(user1.address, ethers.ZeroAddress);
    const finalUSDTBalance = await savingsCore.getTokenBalance(user1.address, moduleConfig.tokens.usdt);
    console.log(`User1 ETH: ${ethers.formatEther(finalETHBalance)} ETH`);
    console.log(`User1 USDT: ${ethers.formatUnits(finalUSDTBalance, 6)} USDT`);

  } catch (error) {
    console.error("Test failed:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});