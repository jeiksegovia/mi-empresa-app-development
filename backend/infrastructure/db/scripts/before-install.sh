#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# CodeDeploy BeforeInstall Hook
# ============================================================================
# This script runs before the application is installed.
# It prepares the environment for deployment by:
#   - Stopping existing application processes
#   - Cleaning deployment directory
#   - Creating fresh directory structure
#   - Verifying required tools are available
# ============================================================================

LOG_FILE="/opt/miempresa/logs/before-install.log"
APP_DIR="/opt/miempresa/app"

# Ensure log directory exists
mkdir -p /opt/miempresa/logs

# Redirect all output to log file
exec >> "$LOG_FILE" 2>&1

echo "=========================================="
echo "CodeDeploy: BeforeInstall Hook"
echo "=========================================="
echo "Started: $(date)"
echo ""

# ============================================================================
# Stop PM2 Processes
# ============================================================================

echo "[1/4] Stopping PM2 processes..."

if command -v pm2 &> /dev/null; then
    if sudo -u ec2-user pm2 list 2>/dev/null | grep -q "miempresa-api"; then
        echo "  Stopping miempresa-api process..."
        sudo -u ec2-user pm2 stop miempresa-api || true
        sudo -u ec2-user pm2 delete miempresa-api || true
        echo "  ✓ PM2 process stopped"
    else
        echo "  ○ No PM2 process running"
    fi
else
    echo "  ○ PM2 not installed (will be installed if needed)"
fi

echo ""

# ============================================================================
# Clean Deployment Directory
# ============================================================================

echo "[2/4] Cleaning deployment directory..."

if [ -d "$APP_DIR" ]; then
    echo "  Removing existing application files..."

    # Preserve important files/directories
    if [ -f "${APP_DIR}/.env" ]; then
        echo "  Backing up .env file..."
        cp "${APP_DIR}/.env" "/tmp/.env.backup"
    fi

    if [ -d "${APP_DIR}/node_modules" ]; then
        echo "  Removing node_modules..."
        rm -rf "${APP_DIR}/node_modules"
    fi

    if [ -d "${APP_DIR}/dist" ]; then
        echo "  Removing dist directory..."
        rm -rf "${APP_DIR}/dist"
    fi

    echo "  ✓ Deployment directory cleaned"
else
    echo "  Creating application directory..."
    mkdir -p "$APP_DIR"
    echo "  ✓ Application directory created"
fi

echo ""

# ============================================================================
# Verify Required Tools
# ============================================================================

echo "[3/4] Verifying required tools..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "  ✓ Node.js: ${NODE_VERSION}"
else
    echo "  ✗ Node.js not found"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "  ✓ npm: ${NPM_VERSION}"
else
    echo "  ✗ npm not found"
    exit 1
fi

# Check AWS CLI
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version)
    echo "  ✓ AWS CLI: ${AWS_VERSION}"
else
    echo "  ✗ AWS CLI not found"
    exit 1
fi

# Check PostgreSQL client
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version)
    echo "  ✓ PostgreSQL client: ${PSQL_VERSION}"
else
    echo "  ✗ PostgreSQL client not found"
    exit 1
fi

echo ""

# ============================================================================
# Prepare Environment
# ============================================================================

echo "[4/4] Preparing environment..."

# Set ownership
chown -R ec2-user:ec2-user "$APP_DIR"
echo "  ✓ Directory ownership set"

# Create required subdirectories
mkdir -p "${APP_DIR}/logs"
mkdir -p "${APP_DIR}/tmp"
chown -R ec2-user:ec2-user "${APP_DIR}/logs"
chown -R ec2-user:ec2-user "${APP_DIR}/tmp"
echo "  ✓ Subdirectories created"

echo ""

# ============================================================================
# Completion
# ============================================================================

echo "=========================================="
echo "BeforeInstall completed successfully"
echo "=========================================="
echo "Completed: $(date)"
echo ""

exit 0
