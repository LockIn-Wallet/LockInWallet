import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
// import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";

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
        runs: 200
      }
    }
  },
  networks: {
    // goerli: {
    //   url: process.env.ALCHEMY_API_URL,
    //   accounts: [process.env.PRIVATE_KEY!]
    // },
    localhost: {
      url: "http://127.0.0.1:8545",
      // optional: use private key from Ganache here
      // accounts: ["0x..."]
    },
  }
};

export default config;
