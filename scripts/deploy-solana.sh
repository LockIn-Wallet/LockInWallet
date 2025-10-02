#!/bin/bash

# Reliable Solana Program Deployment Script
# This script bypasses Anchor version issues and provides consistent deployment

set -e  # Exit on any error

echo "🚀 Starting Solana Program Deployment..."

# Configuration
ANCHOR_PATH="/opt/homebrew/bin/anchor"
SOLANA_DIR="./solana"
SCRIPTS_DIR="./scripts"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if [ ! -f "$ANCHOR_PATH" ]; then
        log_error "Anchor CLI not found at $ANCHOR_PATH"
        log_error "Please install anchor: brew install anchor-cli"
        exit 1
    fi

    if [ ! -d "$SOLANA_DIR" ]; then
        log_error "Solana directory not found: $SOLANA_DIR"
        exit 1
    fi

    log_info "✅ Prerequisites check passed"
}

# Check if local validator is running
check_validator() {
    log_info "Checking if Solana validator is running..."

    if ! solana cluster-version > /dev/null 2>&1; then
        log_warning "Local Solana validator not detected"
        log_info "Starting local validator..."

        # Start validator in background
        solana-test-validator --reset --quiet > /dev/null 2>&1 &
        VALIDATOR_PID=$!

        # Wait for validator to start
        log_info "Waiting for validator to initialize..."
        sleep 5

        # Check if it's running
        if ! solana cluster-version > /dev/null 2>&1; then
            log_error "Failed to start validator"
            exit 1
        fi

        log_info "✅ Local validator started successfully"
    else
        log_info "✅ Validator is already running"
    fi
}

# Build the program
build_program() {
    log_info "Building Solana program..."

    cd "$SOLANA_DIR"

    # Set up proper Solana environment with Agave CLI 2.1.15
    export PATH="/Users/andriy/.local/share/solana/install/active_release/bin:/opt/homebrew/bin:$PATH"

    log_info "Using Solana CLI version: $(solana --version)"
    log_info "Using Anchor CLI at: $ANCHOR_PATH"
    log_info "Building... (this may take a few minutes and appear silent)"

    # Use homebrew anchor directly
    if $ANCHOR_PATH build; then
        log_info "✅ Program built successfully"
    else
        log_error "Anchor build failed"
        log_error "Please try running 'anchor build' manually in the solana/ directory"
        log_error "Current Solana version: $(solana --version)"
        log_error "Current Anchor version: $($ANCHOR_PATH --version 2>&1 || echo 'not found')"
        exit 1
    fi

    cd ..
}

# Deploy the program
deploy_program() {
    log_info "Deploying program to local validator..."

    cd "$SOLANA_DIR"

    # Set up proper Solana environment with Agave CLI 2.1.15
    export PATH="/Users/andriy/.local/share/solana/install/active_release/bin:/opt/homebrew/bin:$PATH"

    # Deploy using homebrew anchor directly
    if $ANCHOR_PATH deploy --provider.cluster localnet; then
        log_info "✅ Program deployed successfully"
    else
        log_error "Failed to deploy program"
        log_error "Using Anchor at: $ANCHOR_PATH"
        log_error "Current Solana version: $(solana --version)"
        exit 1
    fi

    cd ..
}

# Update frontend with new addresses
update_frontend() {
    log_info "Updating frontend with program addresses..."

    if [ -f "$SCRIPTS_DIR/update-solana-addresses.js" ]; then
        if node "$SCRIPTS_DIR/update-solana-addresses.js"; then
            log_info "✅ Frontend addresses updated"
        else
            log_warning "Failed to update frontend addresses automatically"
            log_info "You may need to update them manually"
        fi
    else
        log_warning "Frontend update script not found, skipping..."
    fi
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
        PROGRAM_ID=$(solana-keygen pubkey "$SOLANA_DIR/target/deploy/savings_core-keypair.json" 2>/dev/null || echo "Unable to read")
        echo "🆔 Program ID: $PROGRAM_ID"
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

    check_prerequisites
    check_validator
    build_program
    deploy_program
    update_frontend
    generate_summary

    log_info "🎉 Deployment completed successfully!"
    echo ""
}

# Run main function
main "$@"