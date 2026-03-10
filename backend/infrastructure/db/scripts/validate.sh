#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# CodeDeploy ValidateService Hook
# ============================================================================
# This script validates that the application is running correctly.
# It performs health checks to ensure successful deployment.
# ============================================================================

LOG_FILE="/opt/miempresa/logs/validate.log"
APP_DIR="/opt/miempresa/app"

# Ensure log directory exists
mkdir -p /opt/miempresa/logs

# Redirect all output to log file
exec >> "$LOG_FILE" 2>&1

echo "=========================================="
echo "CodeDeploy: ValidateService Hook"
echo "=========================================="
echo "Started: $(date)"
echo ""

# ============================================================================
# Configuration
# ============================================================================

MAX_RETRIES=10
RETRY_DELAY=3
PORT=3001

echo "Configuration:"
echo "  Max retries: ${MAX_RETRIES}"
echo "  Retry delay: ${RETRY_DELAY}s"
echo "  API port: ${PORT}"
echo ""

# ============================================================================
# Check PM2 Process
# ============================================================================

echo "[1/2] Checking PM2 process..."

if ! command -v pm2 &> /dev/null; then
    echo "  ✗ PM2 not installed"
    exit 1
fi

if pm2 list | grep -q "miempresa-api.*online"; then
    echo "  ✓ PM2 process is online"
else
    echo "  ✗ PM2 process is not online"
    echo ""
    echo "PM2 Status:"
    pm2 list
    echo ""
    echo "PM2 Logs (last 20 lines):"
    pm2 logs miempresa-api --lines 20 --nostream
    exit 1
fi

echo ""

# ============================================================================
# Health Check API Endpoint
# ============================================================================

echo "[2/2] Checking health endpoint..."

HEALTH_URL="http://localhost:${PORT}/api/v1/health"

echo "  URL: ${HEALTH_URL}"
echo "  Waiting for application to be ready..."
echo ""

for i in $(seq 1 $MAX_RETRIES); do
    echo "  Attempt $i/${MAX_RETRIES}..."

    # Perform health check
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" == "200" ]; then
        # Get full response for logging
        RESPONSE=$(curl -s "$HEALTH_URL")

        echo "  ✓ Health check passed!"
        echo "  HTTP Status: ${HTTP_CODE}"
        echo "  Response: ${RESPONSE}"
        echo ""

        # ============================================================================
        # Additional Validation
        # ============================================================================

        echo "Additional validation:"

        # Check if response contains expected fields
        if echo "$RESPONSE" | grep -q "status"; then
            echo "  ✓ Response contains 'status' field"
        else
            echo "  ✗ Response missing 'status' field"
            exit 1
        fi

        # Verify database connectivity (if health endpoint includes it)
        if echo "$RESPONSE" | grep -q "database"; then
            if echo "$RESPONSE" | grep -q "\"database\":\"ok\"\|\"database\":\"healthy\""; then
                echo "  ✓ Database connectivity confirmed"
            else
                echo "  ⚠ Database may have issues (check response)"
            fi
        fi

        echo ""

        # ============================================================================
        # Success
        # ============================================================================

        echo "=========================================="
        echo "ValidateService completed successfully"
        echo "=========================================="
        echo "Completed: $(date)"
        echo ""
        echo "Deployment validated!"
        echo "  Health endpoint: ${HEALTH_URL}"
        echo "  HTTP Status: 200 OK"
        echo "  PM2 Process: online"
        echo ""

        exit 0
    else
        echo "  ✗ Health check failed (HTTP ${HTTP_CODE})"

        # On last retry, show detailed error information
        if [ $i -eq $MAX_RETRIES ]; then
            echo ""
            echo "  Max retries reached. Deployment validation failed."
            echo ""
            echo "Troubleshooting information:"
            echo ""
            echo "PM2 Status:"
            pm2 list
            echo ""
            echo "PM2 Logs (last 50 lines):"
            pm2 logs miempresa-api --lines 50 --nostream
            echo ""
            echo "Application Logs:"
            if [ -f "/opt/miempresa/logs/pm2.log" ]; then
                tail -50 /opt/miempresa/logs/pm2.log
            fi
            echo ""
            echo "Network Check:"
            netstat -tlnp | grep :${PORT} || echo "  Port ${PORT} not listening"
            echo ""
            exit 1
        fi

        # Wait before retry
        sleep $RETRY_DELAY
    fi
done

# Should not reach here, but just in case
echo "  ✗ Validation failed after ${MAX_RETRIES} retries"
exit 1
