const { spawn } = require("child_process");
const { exec } = require("child_process");
const net = require("net");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkPort(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function waitForNode(maxAttempts = 30) {
  log("⏳ Waiting for Hardhat node to be ready...", colors.yellow);

  for (let i = 0; i < maxAttempts; i++) {
    const isReady = await checkPort(8545);
    if (isReady) {
      log("✅ Hardhat node is ready!", colors.green);
      return true;
    }

    process.stdout.write(".");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  log("\n❌ Hardhat node failed to start within timeout", colors.red);
  return false;
}

async function deployContracts() {
  log("\n🚀 Deploying contracts...", colors.cyan);

  return new Promise((resolve, reject) => {
    const deploy = exec("npx hardhat run scripts/deploy-all.js --network localhost");

    deploy.stdout.on("data", (data) => {
      process.stdout.write(data);
    });

    deploy.stderr.on("data", (data) => {
      process.stderr.write(data);
    });

    deploy.on("close", (code) => {
      if (code === 0) {
        log("\n✅ Deployment completed successfully!", colors.green);
        resolve(true);
      } else {
        log(`\n❌ Deployment failed with code ${code}`, colors.red);
        reject(new Error(`Deployment failed with code ${code}`));
      }
    });
  });
}

async function main() {
  log("🎯 Starting Savings Wallet Development Environment", colors.bright + colors.blue);
  log("=" .repeat(50), colors.blue);

  // Check if node is already running
  const isRunning = await checkPort(8545);
  if (isRunning) {
    log("⚠️  Hardhat node is already running on port 8545", colors.yellow);
    log("   Skipping node startup, proceeding with deployment...", colors.yellow);

    try {
      await deployContracts();
      log("\n🎉 Development environment is ready!", colors.green);
      log("   You can now start your frontend: cd frontend && npm start", colors.cyan);
    } catch (error) {
      log(`\n❌ Failed to deploy contracts: ${error.message}`, colors.red);
      process.exit(1);
    }
    return;
  }

  // Start Hardhat node
  log("🔧 Starting Hardhat node...", colors.cyan);
  const nodeProcess = spawn("npx", ["hardhat", "node", "--hostname", "0.0.0.0"], {
    stdio: ["inherit", "pipe", "pipe"]
  });

  // Handle node output
  nodeProcess.stdout.on("data", (data) => {
    const output = data.toString();
    if (output.includes("Started HTTP and WebSocket JSON-RPC server")) {
      log("✅ Hardhat node server started!", colors.green);
    }
    // Show node output but keep it clean
    if (output.includes("Account") || output.includes("Private Key") || output.includes("WARNING")) {
      process.stdout.write(output);
    }
  });

  nodeProcess.stderr.on("data", (data) => {
    process.stderr.write(data);
  });

  // Handle node termination
  nodeProcess.on("close", (code) => {
    if (code !== 0) {
      log(`\n❌ Hardhat node exited with code ${code}`, colors.red);
      process.exit(code);
    }
  });

  // Handle process termination (Ctrl+C)
  process.on("SIGINT", () => {
    log("\n🛑 Shutting down development environment...", colors.yellow);
    nodeProcess.kill("SIGINT");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    nodeProcess.kill("SIGTERM");
    process.exit(0);
  });

  // Wait for node to be ready, then deploy
  try {
    const nodeReady = await waitForNode();
    if (!nodeReady) {
      log("❌ Failed to start Hardhat node", colors.red);
      nodeProcess.kill();
      process.exit(1);
    }

    await deployContracts();

    log("\n🎉 Development environment is ready!", colors.bright + colors.green);
    log("=" .repeat(50), colors.green);
    log("📝 Next steps:", colors.cyan);
    log("   1. Add USDT token to MetaMask (addresses shown above)", colors.cyan);
    log("   2. Start frontend: cd frontend && npm start", colors.cyan);
    log("   3. Press Ctrl+C to stop the development environment", colors.cyan);
    log("=" .repeat(50), colors.green);

    // Keep the process alive
    log("\n⚡ Development environment running... (Press Ctrl+C to stop)", colors.yellow);

  } catch (error) {
    log(`\n❌ Failed to deploy contracts: ${error.message}`, colors.red);
    nodeProcess.kill();
    process.exit(1);
  }
}

main().catch((error) => {
  log(`❌ Unexpected error: ${error.message}`, colors.red);
  process.exit(1);
});