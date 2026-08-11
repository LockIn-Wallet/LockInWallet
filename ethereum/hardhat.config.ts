import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
// import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config";

// Auto-update frontend ABIs after compilation
import { subtask } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_COMPILE } from "hardhat/builtin-tasks/task-names";

subtask(TASK_COMPILE_SOLIDITY_COMPILE, async (args, _hre, runSuper) => {
  const result = await runSuper(args);

  // Auto-update ABIs after successful compilation
  try {
    const { updateABIs } = require("./scripts/post-compile.js");
    await updateABIs();
  } catch (error: any) {
    console.log("⚠️  Could not auto-update ABIs:", error.message);
  }

  return result;
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1
      },
      viaIR: true
    }
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      // Forking is not configured here on purpose. The Aave fork test calls
      // `hardhat_reset` with a forking config itself and resets afterwards, so
      // the default `npx hardhat test` run never reaches for the network — it
      // stays fast and offline. See test/AaveV3StrategyFork.ts and
      // `npm run test:fork`.
    },
    // goerli: {
    //   url: process.env.ALCHEMY_API_URL,
    //   accounts: [process.env.PRIVATE_KEY!]
    // },
    localhost: {
      url: "http://127.0.0.1:8545",
      allowUnlimitedContractSize: true,
    },
    optimism: {
      url: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
      chainId: 10,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      timeout: 120000
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      chainId: 8453,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      timeout: 120000
    }
  }
};

export default config;
