#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# CodeDeploy AfterInstall Hook (v2)
# ============================================================================
# The deployment artifact is PREBUILT in CI (GitHub Actions runs npm ci,
# prisma generate and tsc, and ships dist/). On-instance work is limited to:
#   - Production dependency installation
#   - Prisma client generation (engineType "client": pure JS, cheap)
#   - Environment variable loading (SSM -> .env)
#   - Database migrations (prisma migrate deploy)
#
# Fallback: if dist/server.js is missing (manual zip without build), the
# script builds on-instance — viable only because user-data adds 2 GB swap.
# ============================================================================

LOG_FILE="/opt/miempresa/logs/after-install.log"
APP_DIR="/opt/miempresa/app"

mkdir -p /opt/miempresa/logs
exec >> "$LOG_FILE" 2>&1

echo "=========================================="
echo "CodeDeploy: AfterInstall Hook"
echo "=========================================="
echo "Started: $(date)"
echo ""

# ============================================================================
# Determine Environment
# ============================================================================

echo "[1/6] Determining environment..."

# Prefer the stage recorded at instance creation; fall back to the
# CodeDeploy deployment group name (miempresa-staging / miempresa-prod)
if [ -f /etc/miempresa-stage ]; then
    STAGE=$(cat /etc/miempresa-stage)
elif [[ "${DEPLOYMENT_GROUP_NAME:-}" == *"prod"* ]]; then
    STAGE="prod"
else
    STAGE="staging"
fi
export STAGE
export AWS_REGION="${AWS_REGION:-us-east-1}"

echo "  Stage: ${STAGE}"
echo "  Region: ${AWS_REGION}"
echo "  Deployment Group: ${DEPLOYMENT_GROUP_NAME:-n/a}"
echo ""

# ============================================================================
# Application Directory
# ============================================================================

echo "[2/6] Changing to application directory..."
cd "$APP_DIR"
echo "  ✓ Working directory: $(pwd)"
echo ""

# ============================================================================
# Install Production Dependencies
# ============================================================================

echo "[3/6] Installing production dependencies..."

if [ -f "package-lock.json" ]; then
    npm ci --omit=dev
else
    echo "  WARNING: package-lock.json not found, using npm install..."
    npm install --omit=dev
fi
echo "  ✓ Production dependencies installed"
echo ""

# ============================================================================
# Prisma Client + Build Artifacts
# ============================================================================

echo "[4/6] Preparing Prisma client and build artifacts..."

if [ ! -f "prisma/schema.prisma" ]; then
    echo "  ✗ Prisma schema not found: prisma/schema.prisma"
    exit 1
fi

# Generates JS client into src/generated/prisma (per schema output path)
npx prisma generate
echo "  ✓ Prisma client generated"

if [ ! -f "dist/server.js" ]; then
    echo "  dist/server.js missing — falling back to on-instance build..."
    npm install --include=dev
    npm run build
    npm prune --omit=dev
    echo "  ✓ On-instance build completed"
fi

# tsconfig rootDir=src -> compiled code at dist/ imports '../generated/prisma',
# which resolves to dist/generated/prisma. tsc does not copy the generated JS
# client, so place it there explicitly.
rm -rf dist/generated
cp -R src/generated dist/generated
echo "  ✓ Prisma client available at dist/generated"
echo ""

# ============================================================================
# Environment Variables + Database Migrations
# ============================================================================

echo "[5/6] Loading environment and running migrations..."

if [ ! -f "infrastructure/db/scripts/env.sh" ]; then
    echo "  ✗ env.sh script not found"
    exit 1
fi

bash infrastructure/db/scripts/env.sh
set -a
source .env
set +a
echo "  ✓ Environment loaded from SSM (stage: ${STAGE})"

npx prisma migrate deploy
echo "  ✓ Database migrations applied"
echo ""

# ============================================================================
# Verification + Permissions
# ============================================================================

echo "[6/6] Verifying artifacts and setting permissions..."

for CHECK in "dist/server.js" ".env"; do
    if [ ! -e "$CHECK" ]; then
        echo "  ✗ Missing: ${CHECK}"
        exit 1
    fi
done
if [ ! -d "dist/generated/prisma" ]; then
    echo "  ✗ Missing: dist/generated/prisma"
    exit 1
fi
echo "  ✓ All artifacts present"

chown -R ec2-user:ec2-user "$APP_DIR"
chmod 600 .env
echo "  ✓ Permissions set (app owned by ec2-user, .env 600)"
echo ""

echo "=========================================="
echo "AfterInstall completed successfully"
echo "=========================================="
echo "Completed: $(date)"
echo "  Stage: ${STAGE}"
echo "  node_modules: $(du -sh node_modules 2>/dev/null | cut -f1 || echo 'N/A')"
echo "  dist: $(du -sh dist 2>/dev/null | cut -f1 || echo 'N/A')"
echo ""

exit 0
