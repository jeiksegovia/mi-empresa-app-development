#!/bin/bash

# ============================================================================
# Check AWS Credentials Status
# ============================================================================
# Monitors AWS credential validity and expiration.
# Useful for verifying that credential refresh is working properly.
#
# Usage:
#   ./check-credentials.sh
#
# This script should be run on the Lightsail instance (not locally).
# ============================================================================

echo "=========================================="
echo "AWS Credentials Status Check"
echo "=========================================="
echo "Date: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Check Credentials File
# ============================================================================

echo "[1/4] Checking credentials file..."

CRED_FILE="/root/.aws/credentials"

if [ ! -f "$CRED_FILE" ]; then
    echo -e "${RED}✗ Credentials file not found: ${CRED_FILE}${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Credentials file exists${NC}"

    # Check permissions
    PERMS=$(stat -c "%a" "$CRED_FILE" 2>/dev/null || stat -f "%A" "$CRED_FILE" 2>/dev/null)
    if [ "$PERMS" == "600" ]; then
        echo -e "${GREEN}✓ Correct permissions (600)${NC}"
    else
        echo -e "${YELLOW}⚠ Permissions are ${PERMS} (should be 600)${NC}"
    fi

    # Check if session token exists
    if grep -q "aws_session_token" "$CRED_FILE"; then
        echo -e "${GREEN}✓ Session token present (temporary credentials)${NC}"
    else
        echo -e "${YELLOW}⚠ No session token found (may be using long-term credentials)${NC}"
    fi
fi

echo ""

# ============================================================================
# Test Credentials Validity
# ============================================================================

echo "[2/4] Testing credentials validity..."

CALLER_IDENTITY=$(aws sts get-caller-identity 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ Credentials are valid${NC}"
    echo ""
    echo "Caller Identity:"
    echo "$CALLER_IDENTITY" | jq '.'

    # Check if assumed role
    ARN=$(echo "$CALLER_IDENTITY" | jq -r '.Arn')
    if [[ "$ARN" == *":assumed-role/"* ]]; then
        echo -e "${GREEN}✓ Using assumed role (STS temporary credentials)${NC}"

        # Extract role name
        ROLE_NAME=$(echo "$ARN" | sed 's/.*:assumed-role\/\([^/]*\)\/.*/\1/')
        echo "  Role: ${ROLE_NAME}"

        # Extract session name
        SESSION_NAME=$(echo "$ARN" | sed 's/.*:assumed-role\/[^/]*\/\(.*\)/\1/')
        echo "  Session: ${SESSION_NAME}"
    else
        echo -e "${YELLOW}⚠ Not using assumed role${NC}"
    fi
else
    echo -e "${RED}✗ Credentials are INVALID or EXPIRED${NC}"
    echo ""
    echo "Error message:"
    echo "$CALLER_IDENTITY"
    echo ""
    echo "Action required: Run credential refresh script"
    echo "  sudo /opt/miempresa/scripts/refresh-credentials.sh"
    exit 1
fi

echo ""

# ============================================================================
# Check CodeDeploy Agent Status
# ============================================================================

echo "[3/4] Checking CodeDeploy agent..."

if systemctl is-active --quiet codedeploy-agent; then
    echo -e "${GREEN}✓ CodeDeploy agent is running${NC}"

    # Check agent logs for recent activity
    AGENT_LOG="/var/log/aws/codedeploy-agent/codedeploy-agent.log"
    if [ -f "$AGENT_LOG" ]; then
        LAST_ACTIVITY=$(tail -1 "$AGENT_LOG" 2>/dev/null || echo "No recent activity")
        echo "  Last activity: ${LAST_ACTIVITY:0:100}..."
    fi
else
    echo -e "${RED}✗ CodeDeploy agent is NOT running${NC}"
    echo ""
    echo "Status:"
    systemctl status codedeploy-agent --no-pager -l || true
    echo ""
    echo "Action required: Restart CodeDeploy agent"
    echo "  sudo systemctl restart codedeploy-agent"
    exit 1
fi

echo ""

# ============================================================================
# Check Credential Refresh CRON Job
# ============================================================================

echo "[4/4] Checking credential refresh CRON job..."

if sudo crontab -l 2>/dev/null | grep -q "refresh-credentials.sh"; then
    echo -e "${GREEN}✓ CRON job configured${NC}"

    # Show the cron schedule
    CRON_SCHEDULE=$(sudo crontab -l | grep "refresh-credentials.sh")
    echo "  Schedule: ${CRON_SCHEDULE}"

    # Check last refresh log
    REFRESH_LOG="/var/log/credential-refresh.log"
    if [ -f "$REFRESH_LOG" ]; then
        LAST_REFRESH=$(grep "Completed:" "$REFRESH_LOG" | tail -1)
        if [ -n "$LAST_REFRESH" ]; then
            echo "  Last refresh: ${LAST_REFRESH}"
        fi

        # Check for recent errors
        if tail -50 "$REFRESH_LOG" | grep -qi "error"; then
            echo -e "${YELLOW}⚠ Recent errors detected in refresh log${NC}"
            echo "  Check: tail -50 $REFRESH_LOG"
        fi
    else
        echo -e "${YELLOW}⚠ Refresh log not found (may not have run yet)${NC}"
    fi
else
    echo -e "${RED}✗ CRON job NOT configured${NC}"
    echo ""
    echo "Action required: Add CRON job"
    echo "  (sudo crontab -l 2>/dev/null; echo '*/45 * * * * /opt/miempresa/scripts/refresh-credentials.sh') | sudo crontab -"
    exit 1
fi

echo ""

# ============================================================================
# Test SSM Access
# ============================================================================

echo "Bonus: Testing SSM Parameter Store access..."

# Try to read a test parameter
TEST_PARAM=$(aws ssm get-parameter \
    --name "/miempresa/bootstrap/access-key-id" \
    --query "Parameter.Value" \
    --output text 2>&1 || echo "FAILED")

if [ "$TEST_PARAM" != "FAILED" ] && [ -n "$TEST_PARAM" ]; then
    echo -e "${GREEN}✓ SSM Parameter Store accessible${NC}"
else
    echo -e "${YELLOW}⚠ Cannot access SSM Parameter Store${NC}"
    echo "  This may be normal if IAM permissions are restricted"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================

echo "=========================================="
echo -e "${GREEN}Credentials check completed${NC}"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✓ Credentials file: Present"
echo "  ✓ Credentials validity: Valid"
echo "  ✓ CodeDeploy agent: Running"
echo "  ✓ CRON job: Configured"
echo ""
echo "Next credential refresh: Check CRON schedule above"
echo ""
echo "=========================================="

exit 0
