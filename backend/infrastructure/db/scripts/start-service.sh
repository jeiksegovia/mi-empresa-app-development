#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# CodeDeploy ApplicationStart Hook
# ============================================================================
# This script starts the application using PM2 process manager.
# It performs:
#   - PM2 process startup
#   - Process configuration save
#   - Systemd startup script setup
# ============================================================================

LOG_FILE="/opt/miempresa/logs/start-service.log"
APP_DIR="/opt/miempresa/app"

# Ensure log directory exists
mkdir -p /opt/miempresa/logs

# Redirect all output to log file
exec >> "$LOG_FILE" 2>&1

echo "=========================================="
echo "CodeDeploy: ApplicationStart Hook"
echo "=========================================="
echo "Started: $(date)"
echo ""

# ============================================================================
# Change to Application Directory
# ============================================================================

echo "[1/4] Changing to application directory..."

if [ ! -d "$APP_DIR" ]; then
    echo "  ✗ Application directory not found: ${APP_DIR}"
    exit 1
fi

cd "$APP_DIR"
echo "  ✓ Working directory: $(pwd)"
echo ""

# ============================================================================
# Verify Build Artifacts
# ============================================================================

echo "[2/4] Verifying build artifacts..."

if [ ! -f "dist/server.js" ]; then
    echo "  ✗ dist/server.js not found"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "  ✗ .env file not found"
    exit 1
fi

echo "  ✓ Build artifacts present"
echo ""

# ============================================================================
# Start PM2 Process
# ============================================================================

echo "[3/4] Starting PM2 process..."

# Source environment variables
set -a
source .env
set +a

# Stop any existing process (shouldn't exist, but just in case)
pm2 stop miempresa-api 2>/dev/null || true
pm2 delete miempresa-api 2>/dev/null || true

# Start the application
echo "  Starting miempresa-api..."

pm2 start dist/server.js \
    --name miempresa-api \
    --instances 1 \
    --max-memory-restart 500M \
    --log /opt/miempresa/logs/pm2.log \
    --time

# Wait a moment for process to initialize
sleep 3

# Check if process started successfully
if pm2 list | grep -q "miempresa-api.*online"; then
    echo "  ✓ PM2 process started successfully"
else
    echo "  ✗ PM2 process failed to start"
    pm2 logs miempresa-api --lines 50
    exit 1
fi

echo ""

# ============================================================================
# Configure PM2 Persistence
# ============================================================================

echo "[4/4] Configuring PM2 persistence..."

# Save PM2 process list
pm2 save
echo "  ✓ PM2 configuration saved"

# Setup PM2 to start on system boot
# Run as ec2-user to ensure proper ownership
sudo -u ec2-user pm2 startup systemd -u ec2-user --hp /home/ec2-user

echo "  ✓ PM2 startup script configured"
echo ""

# ============================================================================
# Display Process Status
# ============================================================================

echo "PM2 Process Status:"
pm2 list
echo ""

echo "Application Environment:"
echo "  NODE_ENV: ${NODE_ENV:-not set}"
echo "  PORT: ${PORT:-not set}"
echo "  Stage: ${STAGE:-not set}"
echo ""

# ============================================================================
# Completion
# ============================================================================

echo "=========================================="
echo "ApplicationStart completed successfully"
echo "=========================================="
echo "Completed: $(date)"
echo ""
echo "Application is now running!"
echo "  Process: miempresa-api"
echo "  Status: online"
echo "  Logs: /opt/miempresa/logs/pm2.log"
echo ""
echo "Commands:"
echo "  View logs: pm2 logs miempresa-api"
echo "  Restart: pm2 restart miempresa-api"
echo "  Stop: pm2 stop miempresa-api"
echo "  Status: pm2 status"
echo ""

exit 0
