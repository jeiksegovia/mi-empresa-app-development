#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# CodeDeploy ApplicationStop Hook
# ============================================================================
# This script gracefully stops the application.
# It is called before BeforeInstall during new deployments.
# ============================================================================

LOG_FILE="/opt/miempresa/logs/stop-service.log"

# Ensure log directory exists
mkdir -p /opt/miempresa/logs

# Redirect all output to log file
exec >> "$LOG_FILE" 2>&1

echo "=========================================="
echo "CodeDeploy: ApplicationStop Hook"
echo "=========================================="
echo "Started: $(date)"
echo ""

# ============================================================================
# Stop PM2 Process
# ============================================================================

echo "[1/1] Stopping PM2 process..."

if command -v pm2 &> /dev/null; then
    if pm2 list 2>/dev/null | grep -q "miempresa-api"; then
        echo "  Stopping miempresa-api process..."

        # Graceful stop
        pm2 stop miempresa-api

        echo "  Waiting for graceful shutdown..."
        sleep 5

        # Verify process stopped
        if pm2 list | grep -q "miempresa-api.*stopped"; then
            echo "  ✓ Process stopped gracefully"
        else
            echo "  ○ Process may still be shutting down"
        fi
    else
        echo "  ○ No PM2 process running (nothing to stop)"
    fi
else
    echo "  ○ PM2 not installed (nothing to stop)"
fi

echo ""

# ============================================================================
# Completion
# ============================================================================

echo "=========================================="
echo "ApplicationStop completed"
echo "=========================================="
echo "Completed: $(date)"
echo ""

# Exit 0 even if nothing was stopped (not an error)
exit 0
