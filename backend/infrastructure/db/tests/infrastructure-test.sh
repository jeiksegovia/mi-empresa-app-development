#!/bin/bash
set -e

# ============================================================================
# Infrastructure Testing Script
# ============================================================================
# Validates the complete infrastructure setup including:
#   - Lightsail instance and networking
#   - CodeDeploy integration
#   - IAM/Credentials configuration
#   - PostgreSQL database
#   - Application deployment
#   - S3/Backup functionality
#   - SSM parameters
#
# Usage:
#   ./infrastructure-test.sh --stage <dev|prod> [--verbose]
#
# Examples:
#   ./infrastructure-test.sh --stage staging
#   ./infrastructure-test.sh --stage prod --verbose
# ============================================================================

STAGE=""
VERBOSE=false
REGION="us-east-1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNED=0

# ============================================================================
# Parse Arguments
# ============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)
            STAGE="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Usage: $0 --stage <dev|prod> [--verbose] [--region us-east-1]"
            exit 1
            ;;
    esac
done

if [ -z "$STAGE" ]; then
    echo "ERROR: Stage is required"
    echo "Usage: $0 --stage <dev|prod> [--verbose]"
    exit 1
fi

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_failure() {
    echo -e "${RED}✗${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    TESTS_WARNED=$((TESTS_WARNED + 1))
}

verbose() {
    if [ "$VERBOSE" = true ]; then
        echo "  $1"
    fi
}

test_command() {
    local desc=$1
    local cmd=$2

    if $VERBOSE; then
        echo -e "${BLUE}Testing:${NC} $desc"
        verbose "Command: $cmd"
    fi

    if eval "$cmd" > /dev/null 2>&1; then
        log_success "$desc"
        return 0
    else
        log_failure "$desc"
        return 1
    fi
}

# ============================================================================
# Configuration
# ============================================================================

INSTANCE_NAME="miempresa-backend-${STAGE}"
STATIC_IP_NAME="miempresa-ip-${STAGE}"
S3_BUCKET="miempresa-backups-${STAGE}"

echo "=========================================="
echo "Infrastructure Testing Suite"
echo "=========================================="
echo "Stage: ${STAGE}"
echo "Region: ${REGION}"
echo "Instance: ${INSTANCE_NAME}"
echo "Date: $(date)"
echo ""

# ============================================================================
# Test 1: Lightsail Instance
# ============================================================================

echo "[1/8] Testing Lightsail Instance..."

# Check if instance exists
if aws lightsail get-instance --instance-name "$INSTANCE_NAME" --region "$REGION" &> /dev/null; then
    log_success "Instance exists: ${INSTANCE_NAME}"

    # Check instance state
    INSTANCE_STATE=$(aws lightsail get-instance \
        --instance-name "$INSTANCE_NAME" \
        --region "$REGION" \
        --query "instance.state.name" \
        --output text)

    if [ "$INSTANCE_STATE" == "running" ]; then
        log_success "Instance is running"
    else
        log_failure "Instance state is: ${INSTANCE_STATE}"
    fi

    # Check static IP
    if aws lightsail get-static-ip --static-ip-name "$STATIC_IP_NAME" --region "$REGION" &> /dev/null; then
        PUBLIC_IP=$(aws lightsail get-static-ip \
            --static-ip-name "$STATIC_IP_NAME" \
            --region "$REGION" \
            --query "staticIp.ipAddress" \
            --output text)

        log_success "Static IP allocated: ${PUBLIC_IP}"
        verbose "IP Address: $PUBLIC_IP"

        # Check if IP is attached
        ATTACHED_TO=$(aws lightsail get-static-ip \
            --static-ip-name "$STATIC_IP_NAME" \
            --region "$REGION" \
            --query "staticIp.attachedTo" \
            --output text)

        if [ "$ATTACHED_TO" == "$INSTANCE_NAME" ]; then
            log_success "Static IP attached to instance"
        else
            log_failure "Static IP not attached (attached to: ${ATTACHED_TO})"
        fi
    else
        log_failure "Static IP not found: ${STATIC_IP_NAME}"
    fi

    # Check firewall rules
    FIREWALL_RULES=$(aws lightsail get-instance-port-states \
        --instance-name "$INSTANCE_NAME" \
        --region "$REGION" \
        --query "portStates[?toPort==\`3001\`].state" \
        --output text)

    if [ "$FIREWALL_RULES" == "open" ]; then
        log_success "Firewall allows port 3001 (API)"
    else
        log_warning "Port 3001 may not be open (check firewall)"
    fi

else
    log_failure "Instance not found: ${INSTANCE_NAME}"
    PUBLIC_IP=""
fi

echo ""

# ============================================================================
# Test 2: SSH Connectivity
# ============================================================================

echo "[2/8] Testing SSH Connectivity..."

SSH_KEY="${HOME}/.ssh/miempresa-lightsail-key.pem"

if [ -f "$SSH_KEY" ]; then
    log_success "SSH key exists: ${SSH_KEY}"

    if [ -n "$PUBLIC_IP" ]; then
        if ssh -i "$SSH_KEY" \
            -o StrictHostKeyChecking=no \
            -o UserKnownHostsFile=/dev/null \
            -o ConnectTimeout=10 \
            -o LogLevel=ERROR \
            ec2-user@"${PUBLIC_IP}" "echo 'SSH test successful'" &> /dev/null; then
            log_success "SSH connectivity verified"
        else
            log_failure "Cannot SSH to instance"
        fi
    else
        log_warning "Cannot test SSH (no public IP)"
    fi
else
    log_warning "SSH key not found (run install-ssh-key.sh)"
fi

echo ""

# ============================================================================
# Test 3: CodeDeploy Integration
# ============================================================================

echo "[3/8] Testing CodeDeploy Integration..."

# Check if instance is registered
if aws deploy list-on-premises-instances \
    --region "$REGION" \
    --output text 2>/dev/null | grep -q "$INSTANCE_NAME"; then
    log_success "Instance registered with CodeDeploy"

    # Check instance tags
    TAGS=$(aws deploy get-on-premises-instance \
        --instance-name "$INSTANCE_NAME" \
        --region "$REGION" \
        --query "instanceInfo.tags" 2>/dev/null || echo "[]")

    if echo "$TAGS" | grep -q "Environment"; then
        log_success "Instance has proper tags"
        verbose "Tags: $TAGS"
    else
        log_warning "Instance tags may be missing"
    fi
else
    log_failure "Instance not registered with CodeDeploy"
fi

# Check CodeDeploy agent status (via SSH)
if [ -n "$PUBLIC_IP" ] && [ -f "$SSH_KEY" ]; then
    AGENT_STATUS=$(ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" \
        "sudo systemctl is-active codedeploy-agent" 2>/dev/null || echo "unknown")

    if [ "$AGENT_STATUS" == "active" ]; then
        log_success "CodeDeploy agent is running"
    else
        log_failure "CodeDeploy agent is not active (status: ${AGENT_STATUS})"
    fi
fi

echo ""

# ============================================================================
# Test 4: IAM/Credentials
# ============================================================================

echo "[4/8] Testing IAM/Credentials..."

# Check if CodeDeployInstanceRole exists
if aws iam get-role --role-name CodeDeployInstanceRole &> /dev/null; then
    log_success "CodeDeployInstanceRole exists"
else
    log_failure "CodeDeployInstanceRole not found"
fi

# Check if bootstrap user exists
if aws iam get-user --user-name miempresa-bootstrap &> /dev/null; then
    log_success "Bootstrap IAM user exists"
else
    log_failure "Bootstrap IAM user not found"
fi

# Check bootstrap credentials in SSM
if aws ssm get-parameter \
    --name "/miempresa/bootstrap/access-key-id" \
    --region "$REGION" &> /dev/null; then
    log_success "Bootstrap credentials in SSM"
else
    log_warning "Bootstrap credentials not in SSM"
fi

# Check credential refresh on instance (via SSH)
if [ -n "$PUBLIC_IP" ] && [ -f "$SSH_KEY" ]; then
    CRED_FILE_EXISTS=$(ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" \
        "[ -f /root/.aws/credentials ] && echo 'yes' || echo 'no'" 2>/dev/null || echo "unknown")

    if [ "$CRED_FILE_EXISTS" == "yes" ]; then
        log_success "AWS credentials file exists on instance"
    else
        log_warning "AWS credentials file not found on instance"
    fi

    # Check CRON job
    CRON_EXISTS=$(ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" \
        "sudo crontab -l 2>/dev/null | grep -q refresh-credentials && echo 'yes' || echo 'no'" 2>/dev/null || echo "unknown")

    if [ "$CRON_EXISTS" == "yes" ]; then
        log_success "Credential refresh CRON job configured"
    else
        log_warning "Credential refresh CRON job not found"
    fi
fi

echo ""

# ============================================================================
# Test 5: PostgreSQL Database
# ============================================================================

echo "[5/8] Testing PostgreSQL Database..."

if [ -n "$PUBLIC_IP" ] && [ -f "$SSH_KEY" ]; then
    # Check PostgreSQL service
    PG_STATUS=$(ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" \
        "sudo systemctl is-active postgresql" 2>/dev/null || echo "unknown")

    if [ "$PG_STATUS" == "active" ]; then
        log_success "PostgreSQL service is running"
    else
        log_failure "PostgreSQL service is not active (status: ${PG_STATUS})"
    fi

    # Check database exists
    DB_EXISTS=$(ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" \
        "sudo -u postgres psql -lqt 2>/dev/null | cut -d '|' -f 1 | grep -qw 'miempresa_${STAGE}' && echo 'yes' || echo 'no'" 2>/dev/null || echo "unknown")

    if [ "$DB_EXISTS" == "yes" ]; then
        log_success "Database exists: miempresa_${STAGE}"
    else
        log_warning "Database may not exist"
    fi
else
    log_warning "Cannot test PostgreSQL (no SSH access)"
fi

echo ""

# ============================================================================
# Test 6: Application Deployment
# ============================================================================

echo "[6/8] Testing Application Deployment..."

if [ -n "$PUBLIC_IP" ] && [ -f "$SSH_KEY" ]; then
    # Check PM2 process
    PM2_STATUS=$(ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" \
        "pm2 list 2>/dev/null | grep -q 'miempresa-api.*online' && echo 'online' || echo 'offline'" 2>/dev/null || echo "unknown")

    if [ "$PM2_STATUS" == "online" ]; then
        log_success "PM2 process is online"
    else
        log_warning "PM2 process not running (may not be deployed yet)"
    fi

    # Check health endpoint
    HEALTH_CHECK=$(curl -sf "http://${PUBLIC_IP}:3001/api/v1/health" 2>/dev/null || echo "")

    if echo "$HEALTH_CHECK" | grep -q "ok\|healthy\|status"; then
        log_success "Health endpoint responds"
        verbose "Response: ${HEALTH_CHECK:0:100}"
    else
        log_warning "Health endpoint not responding (may not be deployed yet)"
    fi

    # Check .env file
    ENV_EXISTS=$(ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" \
        "[ -f /opt/miempresa/app/.env ] && echo 'yes' || echo 'no'" 2>/dev/null || echo "unknown")

    if [ "$ENV_EXISTS" == "yes" ]; then
        log_success ".env file exists"
    else
        log_warning ".env file not found (may not be deployed yet)"
    fi
else
    log_warning "Cannot test application (no SSH access)"
fi

echo ""

# ============================================================================
# Test 7: S3/Backup Functionality
# ============================================================================

echo "[7/8] Testing S3/Backup Functionality..."

# Check if S3 bucket exists
if aws s3 ls "s3://${S3_BUCKET}" --region "$REGION" &> /dev/null; then
    log_success "S3 bucket exists: ${S3_BUCKET}"

    # Check if backup directory exists
    BACKUP_COUNT=$(aws s3 ls "s3://${S3_BUCKET}/daily/" --region "$REGION" 2>/dev/null | grep -c "\.sql\.gz$" || echo "0")

    if [ "$BACKUP_COUNT" -gt 0 ]; then
        log_success "Backups found in S3 (${BACKUP_COUNT} backups)"
    else
        log_warning "No backups in S3 yet (CRON may not have run)"
    fi
else
    log_warning "S3 bucket not found (will be created on first backup)"
fi

# Check backup script on instance
if [ -n "$PUBLIC_IP" ] && [ -f "$SSH_KEY" ]; then
    BACKUP_SCRIPT_EXISTS=$(ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" \
        "[ -x /opt/miempresa/scripts/backup-postgres-s3.sh ] && echo 'yes' || echo 'no'" 2>/dev/null || echo "unknown")

    if [ "$BACKUP_SCRIPT_EXISTS" == "yes" ]; then
        log_success "Backup script is executable"
    else
        log_warning "Backup script not found or not executable"
    fi

    # Check backup CRON job
    BACKUP_CRON=$(ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" \
        "sudo crontab -l 2>/dev/null | grep -q backup-postgres-s3 && echo 'yes' || echo 'no'" 2>/dev/null || echo "unknown")

    if [ "$BACKUP_CRON" == "yes" ]; then
        log_success "Backup CRON job configured"
    else
        log_warning "Backup CRON job not configured"
    fi
fi

echo ""

# ============================================================================
# Test 8: SSM Parameters
# ============================================================================

echo "[8/8] Testing SSM Parameters..."

# Check critical parameters
REQUIRED_PARAMS=(
    "/miempresa/${STAGE}/db/DATABASE_URL"
    "/miempresa/${STAGE}/api/JWT_SECRET"
    "/miempresa/${STAGE}/api/SESSION_SECRET"
    "/miempresa/${STAGE}/api/AWS_REGION"
    "/miempresa/${STAGE}/api/CORS_ORIGIN"
)

PARAMS_FOUND=0
PARAMS_MISSING=0

for param in "${REQUIRED_PARAMS[@]}"; do
    if aws ssm get-parameter --name "$param" --region "$REGION" &> /dev/null; then
        PARAMS_FOUND=$((PARAMS_FOUND + 1))
    else
        PARAMS_MISSING=$((PARAMS_MISSING + 1))
        if [ "$VERBOSE" = true ]; then
            log_failure "Parameter missing: $param"
        fi
    fi
done

if [ "$PARAMS_MISSING" -eq 0 ]; then
    log_success "All required SSM parameters exist (${PARAMS_FOUND}/${#REQUIRED_PARAMS[@]})"
else
    log_warning "Some SSM parameters missing (${PARAMS_FOUND}/${#REQUIRED_PARAMS[@]})"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""
echo -e "${GREEN}Passed:${NC}  ${TESTS_PASSED}"
echo -e "${YELLOW}Warnings:${NC} ${TESTS_WARNED}"
echo -e "${RED}Failed:${NC}  ${TESTS_FAILED}"
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_WARNED + TESTS_FAILED))
echo "Total tests: ${TOTAL_TESTS}"

if [ "$TESTS_FAILED" -gt 0 ]; then
    echo ""
    echo -e "${RED}Infrastructure validation FAILED${NC}"
    echo "Review failed tests above and fix issues"
    exit 1
elif [ "$TESTS_WARNED" -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Infrastructure validation completed with warnings${NC}"
    echo "Some components may not be fully configured yet"
    exit 0
else
    echo ""
    echo -e "${GREEN}Infrastructure validation PASSED${NC}"
    echo "All systems operational!"
    exit 0
fi
