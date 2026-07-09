#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# STS Credential Refresh Script
# ============================================================================
# This script automatically refreshes AWS temporary credentials by assuming
# the CodeDeployInstanceRole using bootstrap IAM user credentials.
#
# Runs via CRON at :00 and :45 of every hour, so the 1-hour session is always
# renewed with at least 15 minutes of margin.
#
# Usage:
#   ./refresh-credentials.sh
#
# CRON schedule (installed by create-instance.sh):
#   */45 * * * * /opt/miempresa/scripts/refresh-credentials.sh
#
# IMPORTANT: the role session name is STABLE (miempresa-backend-<stage>).
# The CodeDeploy on-premises registration uses this exact assumed-role ARN;
# a changing session name would break every deployment.
#
# AWS Best Practice: Use STS temporary credentials instead of long-term
# credentials on EC2/Lightsail instances for enhanced security.
# ============================================================================

LOG_FILE="/var/log/credential-refresh.log"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Redirect all output to log file
exec >> "$LOG_FILE" 2>&1

echo "=========================================="
echo "STS Credential Refresh"
echo "=========================================="
echo "Started: $(date)"
echo ""

# ============================================================================
# Configuration
# ============================================================================

echo "Loading configuration..."

# Get AWS account ID from bootstrap credentials
AWS_ACCOUNT_ID=$(aws sts get-caller-identity \
    --profile bootstrap \
    --query Account \
    --output text 2>/dev/null || echo "")

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "✗ ERROR: Failed to get AWS account ID"
    echo "  Bootstrap credentials may not be configured properly"
    exit 1
fi

ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/CodeDeployInstanceRole"
# Stable session name — must match the --iam-session-arn used at registration
STAGE=$(cat /etc/miempresa-stage 2>/dev/null || echo "staging")
ROLE_SESSION_NAME="miempresa-backend-${STAGE}"

echo "  AWS Account ID: ${AWS_ACCOUNT_ID}"
echo "  Role ARN: ${ROLE_ARN}"
echo "  Session Name: ${ROLE_SESSION_NAME}"
echo "  Region: ${AWS_REGION}"
echo ""

# ============================================================================
# Assume Role with Bootstrap Credentials
# ============================================================================

echo "Assuming role..."

TEMP_CREDS=$(aws sts assume-role \
    --role-arn "${ROLE_ARN}" \
    --role-session-name "${ROLE_SESSION_NAME}" \
    --duration-seconds 3600 \
    --region "${AWS_REGION}" \
    --profile bootstrap \
    --output json 2>&1)

if [ $? -ne 0 ]; then
    echo "✗ ERROR: Failed to assume role"
    echo "$TEMP_CREDS"
    exit 1
fi

echo "  ✓ Role assumed successfully"
echo ""

# ============================================================================
# Extract Credentials
# ============================================================================

echo "Extracting credentials..."

ACCESS_KEY=$(echo "$TEMP_CREDS" | jq -r '.Credentials.AccessKeyId')
SECRET_KEY=$(echo "$TEMP_CREDS" | jq -r '.Credentials.SecretAccessKey')
SESSION_TOKEN=$(echo "$TEMP_CREDS" | jq -r '.Credentials.SessionToken')
EXPIRATION=$(echo "$TEMP_CREDS" | jq -r '.Credentials.Expiration')

if [ -z "$ACCESS_KEY" ] || [ "$ACCESS_KEY" == "null" ]; then
    echo "✗ ERROR: Failed to extract access key"
    exit 1
fi

echo "  Access Key ID: ${ACCESS_KEY:0:20}..."
echo "  Expiration: ${EXPIRATION}"
echo ""

# ============================================================================
# Update AWS Credentials File
# ============================================================================

echo "Updating credentials file..."

# Create AWS directory if it doesn't exist
mkdir -p /root/.aws
mkdir -p /home/ec2-user/.aws

# CRITICAL: preserve the [bootstrap] section — it holds the long-lived keys this
# script itself needs on the NEXT run. Overwriting the file without it bricks
# the refresh cycle within the hour.
BOOTSTRAP_KEY_ID=$(awk '/^\[bootstrap\]/{f=1;next}/^\[/{f=0}f&&/aws_access_key_id/{print $3}' /root/.aws/credentials 2>/dev/null)
BOOTSTRAP_SECRET=$(awk '/^\[bootstrap\]/{f=1;next}/^\[/{f=0}f&&/aws_secret_access_key/{print $3}' /root/.aws/credentials 2>/dev/null)

if [ -z "$BOOTSTRAP_KEY_ID" ] || [ -z "$BOOTSTRAP_SECRET" ]; then
    echo "✗ ERROR: [bootstrap] section not found in /root/.aws/credentials"
    echo "  Refusing to overwrite the credentials file (would brick future refreshes)."
    exit 1
fi

# Update root credentials (for CodeDeploy agent and system scripts)
cat > /root/.aws/credentials <<EOF
[default]
aws_access_key_id = ${ACCESS_KEY}
aws_secret_access_key = ${SECRET_KEY}
aws_session_token = ${SESSION_TOKEN}

[bootstrap]
aws_access_key_id = ${BOOTSTRAP_KEY_ID}
aws_secret_access_key = ${BOOTSTRAP_SECRET}
EOF

chmod 600 /root/.aws/credentials

echo "  ✓ /root/.aws/credentials updated"

# Update ec2-user credentials (for application scripts)
cat > /home/ec2-user/.aws/credentials <<EOF
[default]
aws_access_key_id = ${ACCESS_KEY}
aws_secret_access_key = ${SECRET_KEY}
aws_session_token = ${SESSION_TOKEN}
EOF

chown ec2-user:ec2-user /home/ec2-user/.aws/credentials
chmod 600 /home/ec2-user/.aws/credentials

echo "  ✓ /home/ec2-user/.aws/credentials updated"

# Also update config files
cat > /root/.aws/config <<EOF
[default]
region = ${AWS_REGION}
output = json
EOF

cat > /home/ec2-user/.aws/config <<EOF
[default]
region = ${AWS_REGION}
output = json
EOF

chown ec2-user:ec2-user /home/ec2-user/.aws/config
chmod 600 /home/ec2-user/.aws/config

echo "  ✓ Config files updated"
echo ""

# ============================================================================
# Update CodeDeploy Agent Configuration
# ============================================================================

echo "Updating CodeDeploy agent configuration..."

mkdir -p /etc/codedeploy-agent/conf

cat > /etc/codedeploy-agent/conf/codedeploy.onpremises.yml <<EOF
---
iam_session_arn: arn:aws:sts::${AWS_ACCOUNT_ID}:assumed-role/CodeDeployInstanceRole/${ROLE_SESSION_NAME}
aws_credentials_file: /root/.aws/credentials
region: ${AWS_REGION}
EOF

echo "  ✓ CodeDeploy configuration updated"
echo ""

# ============================================================================
# Restart CodeDeploy Agent
# ============================================================================

echo "Restarting CodeDeploy agent..."

# CRITICAL: CodeDeploy agent MUST be restarted after credential update
# This is an AWS requirement for the agent to pick up new credentials

systemctl restart codedeploy-agent

# Wait a moment for restart
sleep 3

# Verify agent is running
if systemctl is-active --quiet codedeploy-agent; then
    echo "  ✓ CodeDeploy agent restarted successfully"
else
    echo "  ✗ ERROR: CodeDeploy agent failed to restart"
    systemctl status codedeploy-agent
    exit 1
fi

echo ""

# ============================================================================
# Verify New Credentials
# ============================================================================

echo "Verifying new credentials..."

# Test credentials by making a simple AWS API call
CALLER_IDENTITY=$(aws sts get-caller-identity --output json 2>&1)

if [ $? -eq 0 ]; then
    ASSUMED_ROLE_ARN=$(echo "$CALLER_IDENTITY" | jq -r '.Arn')
    echo "  ✓ Credentials verified"
    echo "  Assumed Role ARN: ${ASSUMED_ROLE_ARN}"
else
    echo "  ✗ ERROR: Credential verification failed"
    echo "$CALLER_IDENTITY"
    exit 1
fi

echo ""

# ============================================================================
# Calculate Next Refresh Time
# ============================================================================

# Calculate next refresh time (cron fires at :00 and :45)
NEXT_REFRESH=$(date -d "+45 minutes" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -v+45M "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "in 45 minutes")

echo "Next refresh scheduled: ${NEXT_REFRESH}"
echo ""

# ============================================================================
# Completion
# ============================================================================

echo "=========================================="
echo "Credential refresh completed successfully"
echo "=========================================="
echo "Completed: $(date)"
echo ""
echo "Summary:"
echo "  New credentials valid until: ${EXPIRATION}"
echo "  Next refresh: ${NEXT_REFRESH}"
echo "  CodeDeploy agent: Running"
echo ""

exit 0
