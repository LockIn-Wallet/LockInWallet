const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Upgrades a proxy through the governance timelock.
 *
 * Usage:
 *   GOV_ACTION=schedule GOV_CONTRACT=SavingsCore \
 *     npx hardhat run scripts/governance-upgrade.js --network <net>
 *   ... public delay elapses ...
 *   GOV_ACTION=execute GOV_CONTRACT=SavingsCore GOV_IMPL=0x... \
 *     npx hardhat run scripts/governance-upgrade.js --network <net>
 *
 * schedule:
 *   1. validates + deploys the new implementation (permissionless)
 *   2. if the connected signer holds the timelock PROPOSER role (localhost
 *      dev setups), calls timelock.schedule(...) directly;
 *      otherwise prints the exact transaction (to + data) to load into the
 *      Gnosis Safe UI (New transaction -> Transaction Builder) — the Safe's
 *      M-of-N confirmation queues it, which starts the public countdown
 *
 * execute:
 *   execution is open (anyone) once the delay elapses — the script calls
 *   timelock.execute(...) directly from the connected signer.
 */

const MODULE_ID_BY_CONTRACT = {
  SavingsCore: null, // the core proxy itself
  TimePeriodLimitsModule: "TIME_PERIOD_LIMITS",
  ProposalSystemModule: "PROPOSAL_SYSTEM",
  BypassSystemModule: "BYPASS_SYSTEM",
  ApprovalSystemModule: "APPROVAL_SYSTEM",
  ProxyDeploymentModule: "PROXY_DEPLOYMENT",
  PoolTogetherModule: "POOL_TOGETHER",
  VaultSystemModule: "VAULT_SYSTEM",
  ReferralModule: "REFERRAL",
  RecoverySystemModule: "RECOVERY_SYSTEM",
};

const UUPS_ABI = ["function upgradeToAndCall(address newImplementation, bytes data) payable"];

async function main() {
  const action = process.env.GOV_ACTION;
  const contractName = process.env.GOV_CONTRACT;
  if (!["schedule", "execute"].includes(action) || !(contractName in MODULE_ID_BY_CONTRACT)) {
    console.log("Usage: GOV_ACTION=schedule|execute GOV_CONTRACT=<ContractName> [GOV_IMPL=0x..]");
    console.log("Contracts:", Object.keys(MODULE_ID_BY_CONTRACT).join(", "));
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  const networkName = process.env.HARDHAT_NETWORK || "localhost";
  const networkConfigPath = path.join(__dirname, "../../frontend/src/networkConfig.json");
  const networkConfig = JSON.parse(fs.readFileSync(networkConfigPath, "utf8"));
  const evmConfig = networkConfig.evm?.[networkName];
  if (!evmConfig?.governance) throw new Error(`No governance config for evm.${networkName} — run deploy-governance.js first`);

  const core = await ethers.getContractAt("SavingsCore", evmConfig.savingsContract);
  const moduleId = MODULE_ID_BY_CONTRACT[contractName];
  const proxyAddress = moduleId
    ? await core.getModule(ethers.keccak256(ethers.toUtf8Bytes(moduleId)))
    : evmConfig.savingsContract;
  if (proxyAddress === ethers.ZeroAddress) throw new Error(`${contractName} is not registered on ${networkName}`);

  const timelock = await ethers.getContractAt("SavingsTimelock", evmConfig.governance.timelock);
  const minDelay = await timelock.getMinDelay();

  // Deterministic salt ties schedule and execute to the same operation
  const saltFor = (impl) => ethers.keccak256(ethers.toUtf8Bytes(`upgrade:${contractName}:${impl.toLowerCase()}`));

  if (action === "schedule") {
    console.log(`🧪 Validating and deploying new ${contractName} implementation...`);
    const Factory = await ethers.getContractFactory(contractName);
    const opts = contractName === "ProxyDeploymentModule" ? { unsafeAllow: ["constructor"] } : {};
    const implAddress = await upgrades.prepareUpgrade(proxyAddress, Factory, opts);
    console.log(`   ✅ Implementation: ${implAddress}`);

    const upgradeData = new ethers.Interface(UUPS_ABI).encodeFunctionData("upgradeToAndCall", [implAddress, "0x"]);
    const scheduleData = timelock.interface.encodeFunctionData("schedule", [
      proxyAddress, 0, upgradeData, ethers.ZeroHash, saltFor(implAddress), minDelay,
    ]);

    const proposerRole = await timelock.PROPOSER_ROLE();
    if (await timelock.hasRole(proposerRole, signer.address)) {
      // Dev setups where the connected EOA is the proposer
      await (await signer.sendTransaction({ to: timelock.target, data: scheduleData })).wait();
      console.log(`   ✅ Scheduled directly — executable after ${minDelay}s`);
    } else {
      // Production: the Safe is the proposer — hand the payload to its UI
      console.log("\n🔐 Load this transaction into the Safe (New transaction -> Transaction Builder):");
      console.log(`   Safe:            ${evmConfig.governance.proposer}`);
      console.log(`   To (timelock):   ${timelock.target}`);
      console.log(`   Value:           0`);
      console.log(`   Data:            ${scheduleData}`);
      console.log("\n   The public countdown starts when the Safe executes this transaction.");
    }
    console.log(`\n   To execute after the delay:`);
    console.log(`   GOV_ACTION=execute GOV_CONTRACT=${contractName} GOV_IMPL=${implAddress}`);
  } else {
    const implAddress = process.env.GOV_IMPL;
    if (!implAddress) throw new Error("GOV_IMPL=<implementation address printed by schedule> is required");

    const upgradeData = new ethers.Interface(UUPS_ABI).encodeFunctionData("upgradeToAndCall", [implAddress, "0x"]);
    const operationId = await timelock.hashOperation(proxyAddress, 0, upgradeData, ethers.ZeroHash, saltFor(implAddress));
    if (!(await timelock.isOperationReady(operationId))) {
      const readyAt = await timelock.getTimestamp(operationId);
      throw new Error(`Operation not ready (executable at unix ${readyAt})`);
    }

    // Executor role is open — anyone can land a ready operation
    await (await timelock.connect(signer).execute(
      proxyAddress, 0, upgradeData, ethers.ZeroHash, saltFor(implAddress),
    )).wait();
    const current = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log(`🎉 ${contractName} upgraded — implementation now ${current}`);
  }

  console.log(`\nSigner used: ${signer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
