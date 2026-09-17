#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# STS Credential Refresh Script (decision 01: per-env bootstrap key + role)
# ============================================================================
# This script automatically refreshes AWS temporary credentials by assuming
# the per-env SCOPED CodeDeployInstanceRole-${STAGE} using the per-env
# bootstrap IAM user (miempresa-bootstrap-${STAGE}).
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
# ASSUME-PATH ISOLATION (decision 01): the [bootstrap] section of
# /root/.aws/credentials holds the PER-ENV bootstrap access key
# (miempresa-bootstrap-${STAGE}) — NOT the legacy single miempresa-bootstrap
# key. The scoped role's trust policy accepts ONLY that per-env user, so a
# staging host that leaks its bootstrap key cannot sts:AssumeRole the prod
# role (and vice versa).
#
# AWS Best Practice: Use STS temporary credentials instead of long-term
# credentials on EC2/Lightsail instances for enhanced security.
# ============================================================================

LOG_FILE="/var/log/credential-refresh.log"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Redirect all output to log file
exec >> "$LOG_FILE" 2>&1

echo "=========================================="
echo "STS Credential Refresh (decision 01: per-env bootstrap)"
echo "=========================================="
echo "Started: $(date)"
echo ""

# ============================================================================
# Configuration
# ============================================================================

echo "Loading configuration..."

STAGE=$(cat /etc/miempresa-stage 2>/dev/null || echo "staging")

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

# DECISION 01: assume the PER-ENV SCOPED role, NOT the legacy wildcard.
ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/CodeDeployInstanceRole-${STAGE}"
# Stable session name — must match the --iam-session-arn used at registration
ROLE_SESSION_NAME="miempresa-backend-${STAGE}"

echo "  Stage:           ${STAGE}"
echo "  AWS Account ID:  ${AWS_ACCOUNT_ID}"
echo "  Role ARN:        ${ROLE_ARN}"
echo "  Session Name:    ${ROLE_SESSION_NAME}"
echo "  Region:          ${AWS_REGION}"
echo ""

# ============================================================================
# Assume Role with per-env Bootstrap Credentials
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
    echo "✗ ERROR: Failed to assume role ${ROLE_ARN}"
    echo "  If you see AccessDenied here, the per-env bootstrap user for ${STAGE}"
    echo "  does not exist yet, or its key was not pushed to /root/.aws/credentials"
    echo "  (decision 01). Re-run create-instance.sh / push the per-env key."
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

# CRITICAL: preserve the [bootstrap] section — it holds the per-env long-lived
# key THIS script needs on the NEXT run. Overwriting the file without it bricks
# the refresh cycle within the hour.
# DECISION 01: the [bootstrap] section holds the PER-ENV bootstrap key
# (miempresa-bootstrap-${STAGE}), not the legacy miempresa-bootstrap key.
BOOTSTRAP_KEY_ID=$(awk '/^\[bootstrap\]/{f=1;next}/^\[/{f=0}f&&/aws_access_key_id/{print $3}' /root/.aws/credentials 2>/dev/null)
BOOTSTRAP_SECRET=$(awk '/^\[bootstrap\]/{f=1;next}/^\[/{f=0}f&&/aws_secret_access_key/{print $3}' /root/.aws/credentials 2>/dev/null)

if [ -z "$BOOTSTRAP_KEY_ID" ] || [ -z "$BOOTSTRAP_SECRET" ]; then
    echo "✗ ERROR: [bootstrap] section not found in /root/.aws/credentials"
    echo "  Refusing to overwrite the credentials file (would brick future refreshes)."
    echo "  Re-run create-instance.sh to push the per-env bootstrap key for ${STAGE}."
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

# DECISION 01: iam_session_arn now points at the per-env SCOPED role, not the
# legacy wildcard. The CodeDeploy on-prem registration uses this exact ARN.
cat > /etc/codedeploy-agent/conf/codedeploy.onpremises.yml <<EOF
---
iam_session_arn: arn:aws:sts::${AWS_ACCOUNT_ID}:assumed-role/CodeDeployInstanceRole-${STAGE}/${ROLE_SESSION_NAME}
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

# === W8 stopgap (Option B): graceful pm2 reload after successful credential rotation. ===
# Prevents the AWS SDK in-process credential cache from going stale (root cause
# identified in W8: cache has no expiration field, so the SDK never re-reads the
# credentials file). After this reload, the new process starts with fresh creds.
#
# IMPORTANT: This block was appended to the ON-INSTANCE script on 2026-07-11 by
# W8 forensics. The repo copy at backend/infrastructure/db/scripts/refresh-credentials.sh
# MUST be synced to include this block before the next instance rebuild --
# tracked in W8 result.md §Stopgap-B and the W11/deploy wave checklist.

echo "Reloading miempresa-api to pick up fresh credentials..."

PM2_PID_BEFORE=$(sudo -u ec2-user bash -lc 'pm2 jlist 2>/dev/null' | python3 -c "
import json, sys
try:
    procs = json.load(sys.stdin)
    for p in procs:
        if p['name'] == 'miempresa-api':
            print(p.get('pid', '?'))
            break
except Exception:
    print('?')
" 2>/dev/null)
echo "  PID before reload: ${PM2_PID_BEFORE}"

sudo -u ec2-user bash -lc 'pm2 reload miempresa-api' > /tmp/pm2-reload.log 2>&1 || true

PM2_PID_AFTER=""
for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    PM2_PID_AFTER=$(sudo -u ec2-user bash -lc 'pm2 jlist 2>/dev/null' | python3 -c "
import json, sys
try:
    procs = json.load(sys.stdin)
    for p in procs:
        if p['name'] == 'miempresa-api':
            print(p.get('pid', '?'))
            break
except Exception:
    print('?')
" 2>/dev/null)
    if [ -n "${PM2_PID_AFTER}" ] && [ "${PM2_PID_AFTER}" != "${PM2_PID_BEFORE}" ] && [ "${PM2_PID_AFTER}" != "?" ]; then
        break
    fi
done

if [ -n "${PM2_PID_AFTER}" ] && [ "${PM2_PID_AFTER}" != "${PM2_PID_BEFORE}" ] && [ "${PM2_PID_AFTER}" != "?" ]; then
    echo "  [OK] miempresa-api reloaded (PID ${PM2_PID_BEFORE} -> ${PM2_PID_AFTER})"
else
    echo "  [WARN] pm2 reload did not produce a new PID within 10s"
    echo "  Last seen PID: ${PM2_PID_AFTER:-?}"
    echo "  See /tmp/pm2-reload.log for the pm2 reload output"
    echo "  SDK cache may be stale until next manual reload or successful cron cycle"
fi
echo ""

# === end W8 stopgap block ===

exit 0
