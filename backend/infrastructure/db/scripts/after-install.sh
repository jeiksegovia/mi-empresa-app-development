#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# CodeDeploy AfterInstall Hook
# ============================================================================
# This script runs after the application files are copied.
# It performs:
#   - Dependency installation
#   - Prisma client generation
#   - Database migrations
#   - TypeScript build
#   - Environment variable loading
# ============================================================================

LOG_FILE="/opt/miempresa/logs/after-install.log"
APP_DIR="/opt/miempresa/app"

# Ensure log directory exists
mkdir -p /opt/miempresa/logs

# Redirect all output to log file
exec >> "$LOG_FILE" 2>&1

echo "=========================================="
echo "CodeDeploy: AfterInstall Hook"
echo "=========================================="
echo "Started: $(date)"
echo ""

# ============================================================================
# Determine Environment
# ============================================================================

echo "[0/6] Determining environment..."

# Extract stage from CodeDeploy deployment group name
# Expected format: miempresa-dev or miempresa-prod
DEPLOYMENT_GROUP_NAME="${DEPLOYMENT_GROUP_NAME:-dev}"

if [[ "$DEPLOYMENT_GROUP_NAME" == *"prod"* ]]; then
    export STAGE="prod"
elif [[ "$DEPLOYMENT_GROUP_NAME" == *"dev"* ]]; then
    export STAGE="dev"
else
    # Default to dev if can't determine
    export STAGE="dev"
fi

export AWS_REGION="${AWS_REGION:-us-east-1}"

echo "  Stage: ${STAGE}"
echo "  Region: ${AWS_REGION}"
echo "  Deployment Group: ${DEPLOYMENT_GROUP_NAME}"
echo ""

# ============================================================================
# Change to Application Directory
# ============================================================================

echo "[1/6] Changing to application directory..."

if [ ! -d "$APP_DIR" ]; then
    echo "  ✗ Application directory not found: ${APP_DIR}"
    exit 1
fi

cd "$APP_DIR"
echo "  ✓ Working directory: $(pwd)"
echo ""

# ============================================================================
# Install Dependencies
# ============================================================================

echo "[2/6] Installing dependencies..."

# Use npm ci for reproducible builds
if [ -f "package-lock.json" ]; then
    echo "  Running npm ci..."
    npm ci --production
    echo "  ✓ Production dependencies installed"
else
    echo "  WARNING: package-lock.json not found, using npm install..."
    npm install --production
    echo "  ✓ Dependencies installed"
fi

echo ""

# ============================================================================
# Generate Prisma Client
# ============================================================================

echo "[3/6] Generating Prisma client..."

if [ -f "prisma/schema.prisma" ]; then
    echo "  Running prisma generate..."
    npx prisma generate
    echo "  ✓ Prisma client generated"
else
    echo "  ✗ Prisma schema not found: prisma/schema.prisma"
    exit 1
fi

echo ""

# ============================================================================
# Build TypeScript Application
# ============================================================================

echo "[4/6] Building TypeScript application..."

# Install dev dependencies temporarily for build
echo "  Installing dev dependencies for build..."
npm install --only=dev

# Run build
if [ -f "tsconfig.json" ]; then
    echo "  Running npm run build..."
    npm run build
    echo "  ✓ TypeScript build completed"
else
    echo "  ✗ tsconfig.json not found"
    exit 1
fi

# Copy generated Prisma client to dist directory
if [ -d "src/generated" ]; then
    echo "  Copying Prisma client to dist..."
    mkdir -p dist/src
    cp -R src/generated dist/src/
    echo "  ✓ Prisma client copied to dist"
fi

# Remove dev dependencies after build
echo "  Removing dev dependencies..."
npm prune --production

echo ""

# ============================================================================
# Run Database Migrations
# ============================================================================

echo "[5/6] Running database migrations..."

# First, load environment variables to get DATABASE_URL
export STAGE
export AWS_REGION

# Run env.sh to generate .env file
if [ -f "infrastructure/db/scripts/env.sh" ]; then
    echo "  Loading environment variables..."
    bash infrastructure/db/scripts/env.sh
    echo "  ✓ Environment variables loaded"
else
    echo "  ✗ env.sh script not found"
    exit 1
fi

# Source .env file
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
    echo "  ✓ .env file sourced"
else
    echo "  ✗ .env file not found"
    exit 1
fi

# Run Prisma migrations
echo "  Running prisma migrate deploy..."
npx prisma migrate deploy

MIGRATION_STATUS=$?
if [ $MIGRATION_STATUS -eq 0 ]; then
    echo "  ✓ Database migrations applied successfully"
else
    echo "  ✗ Database migrations failed with status: ${MIGRATION_STATUS}"
    exit $MIGRATION_STATUS
fi

echo ""

# ============================================================================
# Post-Build Verification
# ============================================================================

echo "[6/6] Verifying build artifacts..."

# Check dist directory exists
if [ -d "dist" ]; then
    echo "  ✓ dist directory exists"
else
    echo "  ✗ dist directory not found"
    exit 1
fi

# Check server.js exists
if [ -f "dist/server.js" ]; then
    echo "  ✓ dist/server.js exists"
else
    echo "  ✗ dist/server.js not found"
    exit 1
fi

# Check Prisma client in dist
if [ -d "dist/src/generated" ]; then
    echo "  ✓ Prisma client in dist"
else
    echo "  ✗ Prisma client not found in dist"
    exit 1
fi

# Check .env file
if [ -f ".env" ]; then
    echo "  ✓ .env file present"
    chmod 600 .env
else
    echo "  ✗ .env file missing"
    exit 1
fi

echo ""

# ============================================================================
# Set Permissions
# ============================================================================

echo "Setting final permissions..."

chown -R ec2-user:ec2-user "$APP_DIR"
chmod -R 755 "$APP_DIR"
chmod 600 .env

echo "  ✓ Permissions set"
echo ""

# ============================================================================
# Completion
# ============================================================================

echo "=========================================="
echo "AfterInstall completed successfully"
echo "=========================================="
echo "Completed: $(date)"
echo ""
echo "Build summary:"
echo "  Application directory: ${APP_DIR}"
echo "  Stage: ${STAGE}"
echo "  Node modules: $(du -sh node_modules 2>/dev/null || echo 'N/A')"
echo "  Dist size: $(du -sh dist 2>/dev/null || echo 'N/A')"
echo ""

exit 0
