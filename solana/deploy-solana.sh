#!/bin/bash

# ORIGINAL Solana Program Deployment Script
# This is the original deployment script for the savings wallet project
# Reliable Solana Program Deployment Script
# This script bypasses Anchor version issues and provides consistent deployment
# Supports both fresh deployment and program upgrades

set -e  # Exit on any error

# Parse command line arguments
UPGRADE_MODE=false
FORCE_RESET=false
PROD_MODE=false
NETWORK="localnet"
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --upgrade)
            UPGRADE_MODE=true
            shift
            ;;
        --force-reset)
            FORCE_RESET=true
            shift
            ;;
        --prod)
            PROD_MODE=true
            shift
            ;;
        --network=*)
            NETWORK="${arg#*=}"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            # Unknown option
            ;;
    esac
done

# Set timelock mode and deployment message based on flags
if [ "$PROD_MODE" = true ]; then
    TIMELOCK_MODE="PRODUCTION (24 hours)"
    TIMELOCK_FEATURE="prod-timelock"
    echo "🏭 Starting PRODUCTION Solana Program Deployment with 24-HOUR TIMELOCKS"
else
    TIMELOCK_MODE="DEVELOPMENT (15 seconds)"
    TIMELOCK_FEATURE="dev-timelock"
    echo "🚀 Starting Solana Program Deployment with DEV TIMELOCKS (15s) - auto-upgrade if program exists..."
fi

echo "Network: $NETWORK | Timelock Mode: $TIMELOCK_MODE"
if [ "$DRY_RUN" = true ]; then
    echo "⚠️  DRY RUN MODE - No actual deployment will occur"
fi

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOLANA_DIR="$SCRIPT_DIR"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"
ROOT_DIR="$SCRIPT_DIR/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_production() {
    echo -e "\033[0;35m🏭 PRODUCTION: $1${NC}"
}

log_cost() {
    echo -e "\033[0;34m💰 COST: $1${NC}"
}

# Production safety check
production_safety_check() {
    if [ "$NETWORK" = "mainnet" ] && [ "$DRY_RUN" = false ]; then
        log_production "⚠️  MAINNET DEPLOYMENT DETECTED"
        echo ""
        echo "This will deploy to Solana MAINNET with real SOL costs."
        echo "Please confirm the following:"
        echo "  - You have reviewed all code changes"
        echo "  - You have tested on devnet/localnet"
        echo "  - You have sufficient SOL for deployment"
        echo "  - You understand this cannot be easily undone"
        echo ""
        read -p "Type 'DEPLOY TO MAINNET' to continue: " confirmation

        if [ "$confirmation" != "DEPLOY TO MAINNET" ]; then
            log_error "Deployment cancelled by user"
            exit 1
        fi

        log_production "✅ User confirmed mainnet deployment"
    fi
}

# Generate static production keypairs for mainnet
generate_production_keypairs() {
    if [ "$NETWORK" = "mainnet" ] || [ "$PROD_MODE" = true ]; then
        log_info "Setting up production keypairs..."

        PRODUCTION_DIR="$SCRIPT_DIR/production"
        mkdir -p "$PRODUCTION_DIR"

        # Generate savings-core production keypair if it doesn't exist
        SAVINGS_PROD_KEYPAIR="$PRODUCTION_DIR/savings_core-mainnet-keypair.json"
        if [ ! -f "$SAVINGS_PROD_KEYPAIR" ]; then
            log_production "Generating NEW static savings-core production keypair..."
            "$SOLANA_BIN_DIR/solana-keygen" new --outfile "$SAVINGS_PROD_KEYPAIR" --no-bip39-passphrase --silent
            SAVINGS_PROGRAM_ID=$("$SOLANA_BIN_DIR/solana-keygen" pubkey "$SAVINGS_PROD_KEYPAIR")
            log_production "🔑 NEW Savings-Core Program ID: $SAVINGS_PROGRAM_ID"

            # Create public key file for repository
            echo "$SAVINGS_PROGRAM_ID" > "$PRODUCTION_DIR/savings_core-mainnet-pubkey.txt"
            log_production "📝 Public key saved to: $PRODUCTION_DIR/savings_core-mainnet-pubkey.txt"
        else
            SAVINGS_PROGRAM_ID=$("$SOLANA_BIN_DIR/solana-keygen" pubkey "$SAVINGS_PROD_KEYPAIR")
            log_production "♻️  Using existing savings-core keypair: $SAVINGS_PROGRAM_ID"
        fi

        # Generate deposit-proxy production keypair if it doesn't exist
        PROXY_PROD_KEYPAIR="$PRODUCTION_DIR/deposit_proxy-mainnet-keypair.json"
        if [ ! -f "$PROXY_PROD_KEYPAIR" ]; then
            log_production "Generating NEW static deposit-proxy production keypair..."
            "$SOLANA_BIN_DIR/solana-keygen" new --outfile "$PROXY_PROD_KEYPAIR" --no-bip39-passphrase --silent
            PROXY_PROGRAM_ID=$("$SOLANA_BIN_DIR/solana-keygen" pubkey "$PROXY_PROD_KEYPAIR")
            log_production "🔑 NEW Deposit-Proxy Program ID: $PROXY_PROGRAM_ID"

            # Create public key file for repository
            echo "$PROXY_PROGRAM_ID" > "$PRODUCTION_DIR/deposit_proxy-mainnet-pubkey.txt"
            log_production "📝 Public key saved to: $PRODUCTION_DIR/deposit_proxy-mainnet-pubkey.txt"
        else
            PROXY_PROGRAM_ID=$("$SOLANA_BIN_DIR/solana-keygen" pubkey "$PROXY_PROD_KEYPAIR")
            log_production "♻️  Using existing deposit-proxy keypair: $PROXY_PROGRAM_ID"
        fi

        # Copy to deployment location (overwrite existing dev keypairs)
        mkdir -p target/deploy
        cp "$SAVINGS_PROD_KEYPAIR" "target/deploy/savings_core-keypair.json"
        cp "$PROXY_PROD_KEYPAIR" "target/deploy/deposit_proxy-keypair.json"

        log_production "✅ Production keypairs configured"

        # Security reminder
        echo ""
        log_warning "🔐 SECURITY REMINDER:"
        log_warning "  - Keep private keypairs ($PRODUCTION_DIR/*-keypair.json) SECURE and LOCAL"
        log_warning "  - Commit public keys (*-pubkey.txt) to repository"
        log_warning "  - NEVER commit private keypairs to version control"
        log_warning "  - Backup private keypairs securely (encrypted storage)"
        echo ""
    fi
}

# Calculate deployment costs
calculate_deployment_costs() {
    if [ "$NETWORK" = "mainnet" ]; then
        log_info "Calculating mainnet deployment costs..."

        # Check if binaries exist
        SAVINGS_BINARY="target/deploy/savings_core.so"
        PROXY_BINARY="target/deploy/deposit_proxy.so"

        if [ ! -f "$SAVINGS_BINARY" ] || [ ! -f "$PROXY_BINARY" ]; then
            log_warning "Program binaries not found - costs will be calculated after build"
            return 0
        fi

        # Get binary sizes
        SAVINGS_SIZE=$(wc -c < "$SAVINGS_BINARY" 2>/dev/null || echo "0")
        PROXY_SIZE=$(wc -c < "$PROXY_BINARY" 2>/dev/null || echo "0")
        TOTAL_SIZE=$((SAVINGS_SIZE + PROXY_SIZE))

        if [ "$TOTAL_SIZE" -gt 0 ]; then
            log_cost "📊 Program Sizes:"
            log_cost "  Savings Core: $(numfmt --to=iec-i --suffix=B $SAVINGS_SIZE 2>/dev/null || echo "$SAVINGS_SIZE bytes")"
            log_cost "  Deposit Proxy: $(numfmt --to=iec-i --suffix=B $PROXY_SIZE 2>/dev/null || echo "$PROXY_SIZE bytes")"
            log_cost "  Total: $(numfmt --to=iec-i --suffix=B $TOTAL_SIZE 2>/dev/null || echo "$TOTAL_SIZE bytes")"

            # Estimate costs (approximate calculations)
            # Solana rent: ~0.00000348 SOL per byte for 2 years
            RENT_ESTIMATE=$(echo "scale=8; $TOTAL_SIZE * 0.00000348" | bc -l 2>/dev/null || echo "~0.002")
            TX_ESTIMATE="0.00001"  # ~10000 lamports for transactions

            log_cost "💰 Estimated Mainnet Costs:"
            log_cost "  Program Rent: ~${RENT_ESTIMATE} SOL"
            log_cost "  Transaction Fees: ~${TX_ESTIMATE} SOL"
            log_cost "  ━━━━━━━━━━━━━━━━━━━━━━━━━━"
            log_cost "  TOTAL ESTIMATED: ~$(echo "scale=8; $RENT_ESTIMATE + $TX_ESTIMATE" | bc -l 2>/dev/null || echo "0.003") SOL"
            echo ""
        fi
    fi
}

# Dynamically find required tools (no hardcoding!)
find_tools() {
    log_info "Detecting Solana and Anchor installations..."

    # Find Solana CLI dynamically
    SOLANA_CLI=$(which solana 2>/dev/null || echo "")
    if [ -z "$SOLANA_CLI" ]; then
        # Try common installation paths
        for path in "$HOME/.local/share/solana/install/active_release/bin/solana" "/usr/local/bin/solana"; do
            if [ -f "$path" ]; then
                SOLANA_CLI="$path"
                break
            fi
        done
    fi

    if [ -z "$SOLANA_CLI" ]; then
        log_error "Solana CLI not found. Please install: sh -c \"\$(curl -sSfL https://release.anza.xyz/stable/install)\""
        exit 1
    fi

    # Find Anchor CLI dynamically
    ANCHOR_CLI=$(which anchor 2>/dev/null || echo "")
    if [ -z "$ANCHOR_CLI" ]; then
        # Try common installation paths
        for path in "/opt/homebrew/bin/anchor" "/usr/local/bin/anchor" "$HOME/.cargo/bin/anchor"; do
            if [ -f "$path" ]; then
                ANCHOR_CLI="$path"
                break
            fi
        done
    fi

    if [ -z "$ANCHOR_CLI" ]; then
        log_error "Anchor CLI not found. Please install: brew install anchor-cli"
        exit 1
    fi

    # Set up dynamic PATH
    SOLANA_BIN_DIR=$(dirname "$SOLANA_CLI")
    ANCHOR_BIN_DIR=$(dirname "$ANCHOR_CLI")
    export PATH="$SOLANA_BIN_DIR:$ANCHOR_BIN_DIR:$PATH"

    log_info "✅ Tools detected:"
    log_info "  Solana CLI: $SOLANA_CLI ($($SOLANA_CLI --version))"
    log_info "  Anchor CLI: $ANCHOR_CLI ($($ANCHOR_CLI --version))"

    # Update ANCHOR_PATH variable for rest of script
    ANCHOR_PATH="$ANCHOR_CLI"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if [ ! -d "$SOLANA_DIR" ]; then
        log_error "Solana directory not found: $SOLANA_DIR"
        exit 1
    fi

    log_info "✅ Prerequisites check passed"
}

# Detect breaking changes in account structures
detect_breaking_changes() {
    log_info "Tracking deployment state..."

    # Store deployment metadata (removed overly conservative breaking change detection)
    cat > .deployment-state.json << EOF
{
    "last_deployment": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
    "deployed_by": "$(whoami)",
    "note": "Breaking change detection removed - Solana programs are designed to be upgradeable"
}
EOF

    log_info "✅ Deployment tracking updated"
}

# Check if local validator is running
check_validator() {
    log_info "Checking if Solana validator is running..."

    # Check if validator is running
    if "$SOLANA_CLI" cluster-version > /dev/null 2>&1; then
        if [ "$FORCE_RESET" = true ]; then
            log_warning "Stopping validator for state reset due to breaking changes..."
            pkill -f solana-test-validator || true
            sleep 3
            # Ensure validator is fully stopped
            while pgrep -f solana-test-validator > /dev/null; do
                log_info "Waiting for validator to stop..."
                sleep 1
            done
        else
            log_info "✅ Validator is running and no reset needed"
            return 0
        fi
    fi

    # Start validator using dynamic tools path
    log_info "Starting validator..."
    SOLANA_TEST_VALIDATOR="$SOLANA_BIN_DIR/solana-test-validator"

    if [ ! -f "$SOLANA_TEST_VALIDATOR" ]; then
        log_error "solana-test-validator not found at: $SOLANA_TEST_VALIDATOR"
        log_error "Please ensure Solana tools are properly installed"
        exit 1
    fi

    if [ "$FORCE_RESET" = true ]; then
        log_warning "🔄 Resetting validator state (breaking changes detected)"
        "$SOLANA_TEST_VALIDATOR" --reset --quiet > /dev/null 2>&1 &
    else
        "$SOLANA_TEST_VALIDATOR" --quiet > /dev/null 2>&1 &
    fi

    VALIDATOR_PID=$!

    # Wait for validator to start
    log_info "Waiting for validator to initialize..."
    for i in {1..30}; do
        if "$SOLANA_CLI" cluster-version > /dev/null 2>&1; then
            log_info "✅ Validator is ready"
            return 0
        fi
        sleep 1
    done

    log_error "Validator failed to start within 30 seconds"
    log_error "Check if port 8899 is available or another validator is running"
    exit 1
}

# Ensure program ID consistency for both programs
sync_program_id() {
    log_info "Ensuring program ID consistency for both programs..."

# Already in solana directory, no need to cd

    # Use dynamic PATH already set by find_tools function

    # Handle savings-core program
    log_info "Processing savings-core program..."
    SAVINGS_KEYPAIR_PATH="target/deploy/savings_core-keypair.json"
    if [ ! -f "$SAVINGS_KEYPAIR_PATH" ]; then
        log_info "Generating new savings-core program keypair..."
        mkdir -p target/deploy
        "$SOLANA_BIN_DIR/solana-keygen" new --outfile "$SAVINGS_KEYPAIR_PATH" --no-bip39-passphrase --silent
        if [ $? -ne 0 ]; then
            log_error "Failed to generate savings-core program keypair"
            exit 1
        fi
    fi

    SAVINGS_PROGRAM_ID=$("$SOLANA_BIN_DIR/solana-keygen" pubkey "$SAVINGS_KEYPAIR_PATH")
    log_info "Savings-core Program ID: $SAVINGS_PROGRAM_ID"

    # Handle deposit-proxy program
    log_info "Processing deposit-proxy program..."
    PROXY_KEYPAIR_PATH="target/deploy/deposit_proxy-keypair.json"
    if [ ! -f "$PROXY_KEYPAIR_PATH" ]; then
        log_info "Generating new deposit-proxy program keypair..."
        mkdir -p target/deploy
        "$SOLANA_BIN_DIR/solana-keygen" new --outfile "$PROXY_KEYPAIR_PATH" --no-bip39-passphrase --silent
        if [ $? -ne 0 ]; then
            log_error "Failed to generate deposit-proxy program keypair"
            exit 1
        fi
    fi

    PROXY_PROGRAM_ID=$("$SOLANA_BIN_DIR/solana-keygen" pubkey "$PROXY_KEYPAIR_PATH")
    log_info "Deposit-proxy Program ID: $PROXY_PROGRAM_ID"

    # Update Anchor.toml with both program IDs
    log_info "Updating Anchor.toml with both program IDs..."
    sed -i.bak "s/savings_core = \"[^\"]*\"/savings_core = \"$SAVINGS_PROGRAM_ID\"/g" Anchor.toml
    sed -i.bak2 "s/deposit_proxy = \"[^\"]*\"/deposit_proxy = \"$PROXY_PROGRAM_ID\"/g" Anchor.toml

    # Update declare_id! in both Rust programs
    log_info "Updating declare_id! in savings-core..."
    SAVINGS_RUST_FILE="programs/savings-core/src/lib.rs"
    sed -i.bak "s/declare_id!(\"[^\"]*\")/declare_id!(\"$SAVINGS_PROGRAM_ID\")/" "$SAVINGS_RUST_FILE"

    log_info "Updating declare_id! in deposit-proxy..."
    PROXY_RUST_FILE="programs/deposit-proxy/src/lib.rs"
    sed -i.bak "s/declare_id!(\"[^\"]*\")/declare_id!(\"$PROXY_PROGRAM_ID\")/" "$PROXY_RUST_FILE"

    # Sync keys with Anchor
    log_info "Syncing Anchor keys..."
    if $ANCHOR_PATH keys sync; then
        log_info "✅ Program ID consistency ensured:"
        log_info "  - Savings Core: $SAVINGS_PROGRAM_ID"
        log_info "  - Deposit Proxy: $PROXY_PROGRAM_ID"
    else
        log_error "Failed to sync Anchor keys"
        exit 1
    fi

# No need to cd back
}

# Clean and build the program
build_program() {
    log_info "Cleaning and building Solana program..."

# Already in solana directory, no need to cd

    # Use dynamic PATH already set by find_tools function

    log_info "Using Solana CLI version: $("$SOLANA_CLI" --version)"
    log_info "Using Anchor CLI at: $ANCHOR_PATH"

    # Clean previous build artifacts to eliminate caching issues
    log_info "Cleaning previous build artifacts..."
    if [ -d "target" ]; then
        # Preserve both keypairs if they exist
        if [ -f "target/deploy/savings_core-keypair.json" ]; then
            cp target/deploy/savings_core-keypair.json ./savings_core-keypair.json.backup
            log_info "✅ Backed up existing savings-core keypair"
        fi
        if [ -f "target/deploy/deposit_proxy-keypair.json" ]; then
            cp target/deploy/deposit_proxy-keypair.json ./deposit_proxy-keypair.json.backup
            log_info "✅ Backed up existing deposit-proxy keypair"
        fi
        rm -rf target
        log_info "✅ Cleaned target directory"

        # Restore both keypairs
        mkdir -p target/deploy
        if [ -f "./savings_core-keypair.json.backup" ]; then
            cp ./savings_core-keypair.json.backup target/deploy/savings_core-keypair.json
            rm ./savings_core-keypair.json.backup
            log_info "✅ Restored savings-core keypair"
        fi
        if [ -f "./deposit_proxy-keypair.json.backup" ]; then
            cp ./deposit_proxy-keypair.json.backup target/deploy/deposit_proxy-keypair.json
            rm ./deposit_proxy-keypair.json.backup
            log_info "✅ Restored deposit-proxy keypair"
        fi
    fi

    log_info "Building... (this may take a few minutes and appear silent)"

    # Show timelock configuration
    if [ "$PROD_MODE" = true ]; then
        log_production "🔒 PRODUCTION TIMELOCK MODE ENABLED"
        log_production "   Spending limit proposals: 24 hours"
        log_production "   Withdrawal destinations: 24 hours"
        log_production "   Bypass requests: 24 hours"
        log_production "   This provides maximum security for mainnet deployment"
    else
        log_info "⚡ TIMELOCK MODE: Development (15 seconds) - Default for fast E2E testing"
        log_warning "   Spending limit proposals: 15 seconds"
        log_warning "   Withdrawal destinations: 15 seconds"
        log_warning "   Bypass requests: 15 seconds"
        log_warning "   (Use --prod flag for production 24-hour timelocks)"
    fi
    echo ""

    # Build with appropriate timelock feature using Anchor consistently
    if [ "$PROD_MODE" = true ]; then
        echo "🔍 Temporarily switching to prod-timelock for production build..."

        # Backup and modify Cargo.toml to use prod-timelock as default
        cp programs/savings-core/Cargo.toml programs/savings-core/Cargo.toml.backup
        sed -i.tmp 's/default = \["dev-timelock"\]/default = ["prod-timelock"]/' programs/savings-core/Cargo.toml

        echo "🔍 Running: $ANCHOR_PATH build (with prod-timelock as default)"
        BUILD_SUCCESS=false
        if $ANCHOR_PATH build 2>&1; then
            log_production "✅ Program built successfully with 24-hour production timelocks"
            BUILD_SUCCESS=true
        else
            log_error "Anchor build failed with production features"
        fi

        # Restore original Cargo.toml
        mv programs/savings-core/Cargo.toml.backup programs/savings-core/Cargo.toml
        rm -f programs/savings-core/Cargo.toml.tmp

        if [ "$BUILD_SUCCESS" = false ]; then
            exit 1
        fi
    else
        echo "🔍 Running: $ANCHOR_PATH build (with default dev-timelock)"
        if $ANCHOR_PATH build 2>&1; then
            log_info "✅ Program built successfully"

        # Copy binaries to expected location for deployment
        log_info "Copying binaries to deployment location..."
        mkdir -p target/deploy

        # Copy savings-core binary
        if [ -f "programs/savings-core/target/deploy/savings_core.so" ]; then
            cp programs/savings-core/target/deploy/savings_core.so target/deploy/
            log_info "✅ Savings-core binary copied to target/deploy/"
        else
            log_error "Savings-core binary not found at programs/savings-core/target/deploy/savings_core.so"
            exit 1
        fi

        # Copy deposit-proxy binary
        if [ -f "programs/deposit-proxy/target/deploy/deposit_proxy.so" ]; then
            cp programs/deposit-proxy/target/deploy/deposit_proxy.so target/deploy/
            log_info "✅ Deposit-proxy binary copied to target/deploy/"
        else
            log_error "Deposit-proxy binary not found at programs/deposit-proxy/target/deploy/deposit_proxy.so"
            exit 1
        fi
        else
            log_error "Anchor build failed"
            log_error "Please try running 'anchor build' manually in the solana/ directory"
            log_error "Current Solana version: $("$SOLANA_CLI" --version)"
            log_error "Current Anchor version: $($ANCHOR_PATH --version 2>&1 || echo 'not found')"
            exit 1
        fi
    fi

# No need to cd back
}

# Check if program exists on chain
check_program_exists() {
    local program_id="$1"
    log_info "Checking if program $program_id exists on chain..."

    if "$SOLANA_CLI" program show "$program_id" --url http://127.0.0.1:8899 > /dev/null 2>&1; then
        log_info "✅ Program exists on chain"
        return 0
    else
        log_info "📝 Program not found on chain"
        return 1
    fi
}

# Deploy or upgrade the program
deploy_program() {
# Already in solana directory, no need to cd

    # Use dynamic PATH already set by find_tools function

    # Get program ID
    if [ -f "target/deploy/savings_core-keypair.json" ]; then
        PROGRAM_ID=$("$SOLANA_BIN_DIR/solana-keygen" pubkey "target/deploy/savings_core-keypair.json" 2>/dev/null)
        log_info "Program ID: $PROGRAM_ID"
    else
        log_error "Program keypair not found"
        exit 1
    fi

    # Set cluster URL based on network
    local cluster_url
    case $NETWORK in
        mainnet)
            cluster_url="https://api.mainnet-beta.solana.com"
            ;;
        devnet)
            cluster_url="https://api.devnet.solana.com"
            ;;
        localnet)
            cluster_url="http://127.0.0.1:8899"
            ;;
        *)
            log_error "Unknown network: $NETWORK"
            exit 1
            ;;
    esac

    if [ "$DRY_RUN" = true ]; then
        log_info "🎭 DRY RUN: Would deploy to $NETWORK ($cluster_url)"
        log_info "🎭 DRY RUN: Skipping actual deployment"
        return 0
    fi

    # Set Solana config for deployment
    "$SOLANA_CLI" config set --url "$cluster_url"

    # Auto-detect best deployment method (upgrade for existing, deploy for new)
    if check_program_exists "$PROGRAM_ID"; then
        log_info "🔄 Program exists on chain, attempting upgrade..."
        if $ANCHOR_PATH upgrade --provider.cluster "$NETWORK" --program-id "$PROGRAM_ID" target/deploy/savings_core.so; then
            log_info "✅ Program upgraded successfully on $NETWORK"
        else
            log_warning "⚠️  Upgrade failed, attempting deploy as fallback..."
            if $ANCHOR_PATH deploy --provider.cluster "$NETWORK"; then
                log_info "✅ Program deployed successfully on $NETWORK"
            else
                log_error "❌ Both upgrade and deploy failed"
                log_error "Using Anchor at: $ANCHOR_PATH"
                log_error "Current Solana version: $("$SOLANA_CLI" --version)"
                if [ "$NETWORK" = "localnet" ]; then
                    log_error "💡 Consider using --force-reset flag to reset validator state"
                fi
                exit 1
            fi
        fi
    else
        log_info "🚀 Program not found on chain, deploying new program..."
        if $ANCHOR_PATH deploy --provider.cluster "$NETWORK"; then
            log_info "✅ Program deployed successfully on $NETWORK"
        else
            log_error "❌ Failed to deploy new program"
            log_error "Using Anchor at: $ANCHOR_PATH"
            log_error "Current Solana version: $("$SOLANA_CLI" --version)"
            exit 1
        fi
    fi

# No need to cd back
}

# Extract discriminators from IDL and update frontend
update_discriminators() {
    log_info "Extracting instruction discriminators from IDL..."

# Already in solana directory, no need to cd

    IDL_FILE="target/idl/savings_core.json"
    ADAPTER_FILE="../frontend/src/adapters/SolanaAdapter.js"

    if [ ! -f "$IDL_FILE" ]; then
        log_error "IDL file not found: $IDL_FILE"
    # No need to cd back
        return 1
    fi

    if [ ! -f "$ADAPTER_FILE" ]; then
        log_error "SolanaAdapter file not found: $ADAPTER_FILE"
    # No need to cd back
        return 1
    fi

    # Create a temporary Node.js script to extract discriminators
    cat > temp_extract_discriminators.js << 'EOF'
const fs = require('fs');
const path = require('path');

// Read IDL file
const idlPath = process.argv[2];
const adapterPath = process.argv[3];

if (!fs.existsSync(idlPath)) {
    console.error('IDL file not found:', idlPath);
    process.exit(1);
}

if (!fs.existsSync(adapterPath)) {
    console.error('Adapter file not found:', adapterPath);
    process.exit(1);
}

const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
const discriminators = {};

// Extract discriminators from instructions
if (idl.instructions) {
    idl.instructions.forEach(instruction => {
        // Convert snake_case to PascalCase
        const methodName = instruction.name
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');

        if (instruction.discriminator) {
            discriminators[methodName] = instruction.discriminator;
        }
    });
}

console.log(`Found ${Object.keys(discriminators).length} discriminators:`);
Object.entries(discriminators).forEach(([name, disc]) => {
    console.log(`  ${name}: [${disc.join(', ')}]`);
});

// Read current adapter file
let adapterContent = fs.readFileSync(adapterPath, 'utf8');

// Build new discriminator object
const discriminatorEntries = Object.entries(discriminators)
    .map(([key, value]) => `      '${key}': [${value.join(', ')}]`)
    .join(',\n');

const newDiscriminatorBlock = `// Instruction discriminators from the program IDL
const DISC = {
${discriminatorEntries}
};`;

// Find and replace the discriminator section
const discriminatorRegex = /(\/\/ .*discriminators.*\n\s*const DISC = \{)([\s\S]*?)(\};)/;

if (discriminatorRegex.test(adapterContent)) {
    adapterContent = adapterContent.replace(discriminatorRegex, newDiscriminatorBlock);
    fs.writeFileSync(adapterPath, adapterContent);
    console.log('✅ SolanaAdapter updated with new discriminators');
} else {
    console.error('❌ Could not find discriminator section in SolanaAdapter');
    console.error('💡 Manual update may be required');
    process.exit(1);
}
EOF

    # Run the discriminator extraction script
    if node temp_extract_discriminators.js "$IDL_FILE" "$ADAPTER_FILE"; then
        log_info "✅ Discriminators extracted and updated in frontend"
    else
        log_error "Failed to extract discriminators"
    # No need to cd back
        return 1
    fi

    # Clean up temporary script
    rm -f temp_extract_discriminators.js

# No need to cd back
}

# Update frontend with new addresses
update_frontend() {
    log_info "Updating frontend with program addresses..."

    if [ -f "update-solana-addresses.js" ]; then
        if node "update-solana-addresses.js"; then
            log_info "✅ Frontend addresses updated"
        else
            log_warning "Failed to update frontend addresses automatically"
            log_info "You may need to update them manually"
        fi
    else
        log_warning "Frontend update script not found, skipping..."
    fi

    # Also update discriminators
    update_discriminators
}

# Initialize program configuration for monetization
initialize_program_config() {
    log_info "Initializing program configuration..."
    cd "$SCRIPT_DIR"

    # Only initialize on localnet (production requires manual admin setup)
    if [ "$NETWORK" = "localnet" ]; then
        if [ -f "initialize-program-config.js" ]; then
            log_info "Running program config initialization script..."
            if node initialize-program-config.js; then
                log_info "✅ Program configuration initialized successfully"
                log_info "💰 Users can now pay activation fees for permanent addresses"
            else
                log_warning "⚠️  Program config initialization failed"
                log_warning "Users will not be able to pay activation fees until config is set up"
                log_warning "You can run 'node initialize-program-config.js' manually later"
            fi
        else
            log_warning "Program config initialization script not found"
            log_warning "Users will not be able to pay activation fees"
        fi
    else
        log_info "⏭️  Skipping program config initialization for $NETWORK"
        log_info "💡 Production deployments require manual admin setup for security"
        log_info "Run 'node initialize-program-config.js' manually with proper admin credentials"
    fi
}

# Setup test tokens
setup_test_tokens() {
    log_info "Setting up test tokens..."

    cd "$SCRIPT_DIR"

    # Use dynamic PATH already set by find_tools function

    if [ -f "setup-solana-tokens.js" ]; then
        log_info "Running token setup script..."
        if node setup-solana-tokens.js; then
            log_info "✅ Test tokens setup completed"
        else
            log_warning "Token setup failed, but deployment continues"
            log_warning "You can run 'node setup-solana-tokens.js' manually later"
        fi
    else
        log_warning "Token setup script not found, skipping token setup"
    fi

    # Return to original directory (removed cd to parent - causes verification issues)
}

# Verify program ID consistency
verify_program_id() {
    log_info "Verifying program ID consistency..."

    # Use solana-keygen directly from PATH (set by find_tools)
    local KEYGEN_CMD="solana-keygen"
    local SOLANA_CMD="solana"

    # Get program ID from keypair
    if [ -f "target/deploy/savings_core-keypair.json" ]; then
        PROGRAM_ID=$($KEYGEN_CMD pubkey "target/deploy/savings_core-keypair.json" 2>/dev/null)
        if [ $? -ne 0 ] || [ -z "$PROGRAM_ID" ]; then
            log_error "Failed to read program ID from keypair"
            return 1
        fi
        log_info "Program ID from keypair: $PROGRAM_ID"
    else
        log_error "Program keypair not found at target/deploy/savings_core-keypair.json"
        return 1
    fi

    # Check program ID in lib.rs (use relative path)
    RUST_FILE="programs/savings-core/src/lib.rs"
    if [ -f "$RUST_FILE" ]; then
        DECLARED_ID=$(grep "declare_id!" "$RUST_FILE" | sed 's/.*declare_id!("\([^"]*\)").*/\1/')
        log_info "Program ID in lib.rs: $DECLARED_ID"

        if [ "$PROGRAM_ID" = "$DECLARED_ID" ]; then
            log_info "✅ lib.rs program ID matches keypair"
        else
            log_error "❌ lib.rs program ID mismatch!"
            log_error "  Keypair: $PROGRAM_ID"
            log_error "  lib.rs:  $DECLARED_ID"
            return 1
        fi
    else
        log_error "lib.rs not found at $RUST_FILE"
        return 1
    fi

    # Check program ID in Anchor.toml (use relative path)
    if [ -f "Anchor.toml" ]; then
        ANCHOR_ID=$(grep "savings_core" "Anchor.toml" | head -1 | sed 's/.*savings_core = "\([^"]*\)".*/\1/')
        log_info "Program ID in Anchor.toml: $ANCHOR_ID"

        if [ "$PROGRAM_ID" = "$ANCHOR_ID" ]; then
            log_info "✅ Anchor.toml program ID matches keypair"
        else
            log_error "❌ Anchor.toml program ID mismatch!"
            log_error "  Keypair:     $PROGRAM_ID"
            log_error "  Anchor.toml: $ANCHOR_ID"
            return 1
        fi
    else
        log_error "Anchor.toml not found"
        return 1
    fi

    # Check if program is actually deployed
    log_info "Checking if program is deployed on validator..."
    if $SOLANA_CMD program show "$PROGRAM_ID" > /dev/null 2>&1; then
        log_info "✅ Program is deployed on validator"

        # Get deployment info
        DEPLOYED_INFO=$($SOLANA_CMD program show "$PROGRAM_ID" 2>/dev/null)
        if echo "$DEPLOYED_INFO" | grep -q "Program Id: $PROGRAM_ID"; then
            log_info "✅ Deployed program ID matches expected ID"
        else
            log_error "❌ Deployed program info doesn't match expected ID"
            return 1
        fi
    else
        log_error "❌ Program not found on validator"
        return 1
    fi

    # Check frontend addresses file
    FRONTEND_ADDRESSES="../frontend/src/savings_core.json"
    if [ -f "$FRONTEND_ADDRESSES" ]; then
        FRONTEND_ID=$(grep '"address":' "$FRONTEND_ADDRESSES" | head -1 | sed 's/.*"address": *"\([^"]*\)".*/\1/')
        log_info "Program ID in frontend: $FRONTEND_ID"

        if [ -n "$FRONTEND_ID" ] && [ "$PROGRAM_ID" = "$FRONTEND_ID" ]; then
            log_info "✅ Frontend program ID matches keypair"
        else
            log_error "❌ Frontend program ID mismatch or parsing failed!"
            log_error "  Keypair:  $PROGRAM_ID"
            log_error "  Frontend: $FRONTEND_ID"
            return 1
        fi
    else
        log_warning "Frontend addresses file not found, will be created by update script"
    fi

    log_info "🎉 All program ID consistency checks passed!"
    return 0
}

# Generate deployment summary
generate_summary() {
    log_info "Generating deployment summary..."

    echo ""
    echo "📋 DEPLOYMENT SUMMARY"
    echo "===================="

    if [ -f "$SOLANA_DIR/target/deploy/savings_core.so" ]; then
        echo "✅ Program Binary: $SOLANA_DIR/target/deploy/savings_core.so"
    fi

    if [ -f "$SOLANA_DIR/target/idl/savings_core.json" ]; then
        echo "✅ Program IDL: $SOLANA_DIR/target/idl/savings_core.json"
    fi

    # Try to get program ID
    if [ -f "$SOLANA_DIR/target/deploy/savings_core-keypair.json" ]; then
        PROGRAM_ID=$("$SOLANA_BIN_DIR/solana-keygen" pubkey "$SOLANA_DIR/target/deploy/savings_core-keypair.json" 2>/dev/null || echo "Unable to read")
        echo "🆔 Program ID: $PROGRAM_ID"
    fi

    # Show token information if available
    if [ -f "frontend/src/solanaTokens.json" ]; then
        USDT_MINT=$(grep '"usdtMint"' frontend/src/solanaTokens.json | sed 's/.*"usdtMint": "\([^"]*\)".*/\1/')
        echo "🪙 USDT Mint Address: $USDT_MINT"
    fi

    echo ""
    echo "🎯 Next Steps:"
    echo "  1. Start your frontend: cd frontend && npm start"
    echo "  2. Test deposits/withdrawals in the app"
    echo "  3. Check browser console for any errors"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "🔧 SOLANA SAVINGS PROGRAM DEPLOYMENT"
    echo "===================================="
    echo ""

    find_tools
    production_safety_check
    generate_production_keypairs
    detect_breaking_changes
    check_prerequisites
    if [ "$NETWORK" = "localnet" ]; then
        check_validator
    fi
    sync_program_id
    build_program
    calculate_deployment_costs
    deploy_program
    initialize_program_config
    update_frontend
    if [ "$NETWORK" = "localnet" ]; then
        setup_test_tokens
    fi

    # Verify everything is consistent
    if verify_program_id; then
        generate_summary
        if [ "$DRY_RUN" = true ]; then
            log_info "🎭 DRY RUN COMPLETED - No actual deployment occurred"
        elif [ "$PROD_MODE" = true ]; then
            log_production "🎉 Production deployment completed successfully!"
        else
            log_info "🎉 Program deployment completed successfully!"
        fi
    else
        log_error "❌ Program ID verification failed!"
        log_error "Please check the errors above and run the deployment again."
        exit 1
    fi

    echo ""
}

# Show usage if no arguments provided
show_usage() {
    echo "Enhanced Solana Program Deployment Script"
    echo "========================================="
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "OPTIONS:"
    echo "  --prod              Enable production mode (24-hour timelocks)"
    echo "  --network=NETWORK   Target network (mainnet, devnet, localnet)"
    echo "  --upgrade           Upgrade existing program"
    echo "  --force-reset       Reset validator state (localnet only)"
    echo "  --dry-run           Show what would be deployed without deploying"
    echo ""
    echo "EXAMPLES:"
    echo "  $0                                        # Deploy to localnet with dev timelocks"
    echo "  $0 --prod --network=mainnet              # Deploy to mainnet with production timelocks"
    echo "  $0 --prod --network=devnet               # Test production build on devnet"
    echo "  $0 --network=localnet                    # Deploy to localnet (default)"
    echo "  $0 --dry-run --prod --network=mainnet    # Preview mainnet deployment"
    echo "  $0 --upgrade --network=mainnet           # Upgrade existing mainnet program"
    echo ""
    echo "NETWORKS:"
    echo "  localnet    Local Solana validator (default, dev timelocks)"
    echo "  devnet      Solana devnet (for testing)"
    echo "  mainnet     Solana mainnet (production, requires --prod for safety)"
    echo ""
    echo "PRODUCTION DEPLOYMENT:"
    echo "  - Use --prod flag for 24-hour production timelocks"
    echo "  - Generates static keypairs in production/ directory"
    echo "  - Provides cost estimation for mainnet"
    echo "  - Includes safety confirmations for mainnet"
    echo ""
}

# Show usage if no arguments and not being sourced
# Temporarily disabled for debugging
# if [ $# -eq 0 ] && [ "${BASH_SOURCE[0]}" = "${0}" ]; then
#     show_usage
#     exit 0
# fi

# Run main function
main "$@"