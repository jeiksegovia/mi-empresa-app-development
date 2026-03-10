#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Lightsail Instance Creation Script with CodeDeploy Integration
# ============================================================================
# This script orchestrates the creation of a Lightsail instance with:
#   - PostgreSQL 15 database
#   - CodeDeploy agent
#   - Node.js application environment
#   - STS credential auto-refresh
#
# Usage:
#   ./create-instance.sh --stage <dev|prod> [--region us-east-1] [--bundle micro_2_0]
#
# Prerequisites:
#   - AWS CLI v2 installed and configured
#   - IAM roles created (run deploy-infrastructure.sh first)
#   - SSM parameters configured (run deploy-infrastructure.sh first)
#   - Bootstrap IAM user credentials configured
# ============================================================================

# Default values
STAGE="dev"
REGION="us-east-1"
BUNDLE="micro_2_0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR}/../templates"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

usage() {
    cat <<EOF
Usage: $0 --stage <dev|prod> [OPTIONS]

Create a Lightsail instance with PostgreSQL and CodeDeploy integration.

Required Arguments:
  --stage STAGE          Environment stage (dev or prod)

Optional Arguments:
  --region REGION        AWS region (default: us-east-1)
  --bundle BUNDLE        Lightsail bundle ID (default: micro_2_0)
                         Options: micro_2_0, small_2_0, medium_2_0, large_2_0
  --help                 Show this help message

Examples:
  # Create dev instance with default settings
  $0 --stage dev

  # Create prod instance with larger bundle
  $0 --stage prod --bundle small_2_0

Lightsail Bundle Options:
  micro_2_0   - 1 GB RAM, 1 vCPU, 40 GB SSD (~\$5/month)  - Recommended for dev
  small_2_0   - 2 GB RAM, 1 vCPU, 60 GB SSD (~\$10/month) - Recommended for prod
  medium_2_0  - 4 GB RAM, 2 vCPU, 80 GB SSD (~\$20/month)
  large_2_0   - 8 GB RAM, 2 vCPU, 160 GB SSD (~\$40/month)
EOF
    exit 1
}

# ============================================================================
# Parse Command Line Arguments
# ============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)
            STAGE="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --bundle)
            BUNDLE="$2"
            shift 2
            ;;
        --help)
            usage
            ;;
        *)
            log_error "Unknown argument: $1"
            usage
            ;;
    esac
done

# Validate required arguments
if [ -z "$STAGE" ]; then
    log_error "Stage is required. Use --stage <dev|prod>"
    usage
fi

if [[ "$STAGE" != "dev" && "$STAGE" != "prod" ]]; then
    log_error "Stage must be 'dev' or 'prod'"
    exit 1
fi

# ============================================================================
# Configuration
# ============================================================================

INSTANCE_NAME="miempresa-db-${STAGE}-1"
STATIC_IP_NAME="miempresa-ip-${STAGE}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/CodeDeployInstanceRole"

log_info "Configuration:"
echo "  Instance Name: ${INSTANCE_NAME}"
echo "  Stage: ${STAGE}"
echo "  Region: ${REGION}"
echo "  Bundle: ${BUNDLE}"
echo "  AWS Account: ${AWS_ACCOUNT_ID}"
echo ""

# ============================================================================
# Prerequisite Checks
# ============================================================================

log_info "Checking prerequisites..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed. Please install AWS CLI v2."
    exit 1
fi

# Check if envsubst is installed
if ! command -v envsubst &> /dev/null; then
    log_error "envsubst is not installed. Please install gettext package."
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    log_error "jq is not installed. Please install jq."
    exit 1
fi

# Check if CodeDeployInstanceRole exists
log_info "Verifying IAM role: CodeDeployInstanceRole..."
if ! aws iam get-role --role-name CodeDeployInstanceRole &> /dev/null; then
    log_error "CodeDeployInstanceRole does not exist. Run deploy-infrastructure.sh first."
    exit 1
fi
log_info "✓ IAM role exists"

# Check if bootstrap credentials are configured
log_info "Verifying bootstrap credentials..."
if ! aws sts get-caller-identity --profile bootstrap &> /dev/null 2>&1; then
    log_warn "Bootstrap profile not configured. Attempting with default profile..."
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Configure bootstrap IAM user credentials."
        exit 1
    fi
fi
log_info "✓ AWS credentials configured"

# Check if instance already exists
log_info "Checking if instance already exists..."
if aws lightsail get-instance --instance-name "${INSTANCE_NAME}" --region "${REGION}" &> /dev/null; then
    log_error "Instance ${INSTANCE_NAME} already exists. Delete it first or use a different name."
    exit 1
fi
log_info "✓ Instance name is available"

echo ""

# ============================================================================
# Template Rendering
# ============================================================================

log_info "Rendering Lightsail instance template..."

# Read user data script
USER_DATA_SCRIPT="${TEMPLATE_DIR}/user-data-postgresql.sh"
if [ ! -f "$USER_DATA_SCRIPT" ]; then
    log_error "User data script not found: ${USER_DATA_SCRIPT}"
    exit 1
fi

# Read user data content and prepare for YAML
USER_DATA_CONTENT=$(cat "$USER_DATA_SCRIPT" | sed 's/^/  /')

# Export variables for envsubst
export INSTANCE_NAME
export REGION
export BUNDLE
export STAGE
export USER_DATA_CONTENT

# Render template
RENDERED_TEMPLATE="/tmp/lightsail-instance-${STAGE}-$(date +%s).yml"
envsubst < "${TEMPLATE_DIR}/lightsail-instance.yml" > "$RENDERED_TEMPLATE"

log_info "✓ Template rendered: ${RENDERED_TEMPLATE}"

# ============================================================================
# Instance Creation
# ============================================================================

log_info "Creating Lightsail instance: ${INSTANCE_NAME}..."
echo "  This may take a few minutes..."

aws lightsail create-instances \
    --cli-input-yaml "file://${RENDERED_TEMPLATE}" \
    --region "${REGION}"

log_info "✓ Instance creation initiated"

# ============================================================================
# Wait for Instance to be Running
# ============================================================================

log_info "Waiting for instance to reach 'running' state..."
MAX_WAIT=300  # 5 minutes
ELAPSED=0
SLEEP_INTERVAL=10

while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATE=$(aws lightsail get-instance \
        --instance-name "${INSTANCE_NAME}" \
        --region "${REGION}" \
        --query "instance.state.name" \
        --output text 2>/dev/null || echo "pending")

    if [ "$STATE" == "running" ]; then
        log_info "✓ Instance is running"
        break
    fi

    echo -n "."
    sleep $SLEEP_INTERVAL
    ELAPSED=$((ELAPSED + SLEEP_INTERVAL))
done

echo ""

if [ "$STATE" != "running" ]; then
    log_error "Timeout waiting for instance to start. Current state: ${STATE}"
    exit 1
fi

# ============================================================================
# Static IP Allocation and Attachment
# ============================================================================

log_info "Allocating static IP: ${STATIC_IP_NAME}..."

# Check if static IP already exists
if aws lightsail get-static-ip --static-ip-name "${STATIC_IP_NAME}" --region "${REGION}" &> /dev/null; then
    log_warn "Static IP ${STATIC_IP_NAME} already exists. Attempting to attach to instance..."
else
    aws lightsail allocate-static-ip \
        --static-ip-name "${STATIC_IP_NAME}" \
        --region "${REGION}"
    log_info "✓ Static IP allocated"
fi

# Wait a moment for the IP to be ready
sleep 5

# Attach static IP to instance
log_info "Attaching static IP to instance..."
aws lightsail attach-static-ip \
    --static-ip-name "${STATIC_IP_NAME}" \
    --instance-name "${INSTANCE_NAME}" \
    --region "${REGION}"

# Get the public IP address
PUBLIC_IP=$(aws lightsail get-static-ip \
    --static-ip-name "${STATIC_IP_NAME}" \
    --region "${REGION}" \
    --query "staticIp.ipAddress" \
    --output text)

log_info "✓ Static IP attached: ${PUBLIC_IP}"

# ============================================================================
# Configure Firewall Rules
# ============================================================================

log_info "Configuring firewall rules..."

# Open port 3001 for API access
aws lightsail put-instance-public-ports \
    --instance-name "${INSTANCE_NAME}" \
    --port-infos \
        "fromPort=22,toPort=22,protocol=tcp,cidrs=0.0.0.0/0" \
        "fromPort=3001,toPort=3001,protocol=tcp,cidrs=0.0.0.0/0" \
    --region "${REGION}"

log_info "✓ Firewall rules configured (ports 22, 3001)"

# ============================================================================
# Wait for CodeDeploy Agent to be Ready
# ============================================================================

log_info "Waiting for CodeDeploy agent to be ready..."
log_info "  This may take 5-10 minutes while the instance bootstraps..."

# Download SSH key if not already present
SSH_KEY="${HOME}/.ssh/miempresa-lightsail-key.pem"
if [ ! -f "$SSH_KEY" ]; then
    log_info "Downloading SSH key..."
    aws lightsail download-default-key-pair \
        --region "${REGION}" \
        --query "privateKeyBase64" \
        --output text | base64 --decode > "$SSH_KEY"
    chmod 400 "$SSH_KEY"
    log_info "✓ SSH key saved: ${SSH_KEY}"
fi

MAX_WAIT=600  # 10 minutes
ELAPSED=0
SLEEP_INTERVAL=20

while [ $ELAPSED -lt $MAX_WAIT ]; do
    # Try to SSH and check CodeDeploy agent status
    if ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" \
        "sudo systemctl is-active codedeploy-agent" &> /dev/null; then
        log_info "✓ CodeDeploy agent is active"
        break
    fi

    echo -n "."
    sleep $SLEEP_INTERVAL
    ELAPSED=$((ELAPSED + SLEEP_INTERVAL))
done

echo ""

if [ $ELAPSED -ge $MAX_WAIT ]; then
    log_warn "Timeout waiting for CodeDeploy agent. You may need to SSH and check manually."
    log_info "SSH command: ssh -i ${SSH_KEY} ec2-user@${PUBLIC_IP}"
fi

# ============================================================================
# Store Database Password in SSM
# ============================================================================

log_info "Storing database password in SSM Parameter Store..."

# Retrieve the password from the instance
DB_PASSWORD=$(ssh -i "$SSH_KEY" \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o LogLevel=ERROR \
    ec2-user@"${PUBLIC_IP}" \
    "sudo cat /tmp/db-password.txt 2>/dev/null || echo ''")

if [ -n "$DB_PASSWORD" ]; then
    aws ssm put-parameter \
        --name "/miempresa/${STAGE}/db/DB_PASSWORD" \
        --value "$DB_PASSWORD" \
        --type "SecureString" \
        --overwrite \
        --region "${REGION}" &> /dev/null

    log_info "✓ Database password stored in SSM"

    # Update DATABASE_URL parameter
    DB_URL="postgresql://miempresa:${DB_PASSWORD}@localhost:5432/miempresa_${STAGE}"
    aws ssm put-parameter \
        --name "/miempresa/${STAGE}/db/DATABASE_URL" \
        --value "$DB_URL" \
        --type "SecureString" \
        --overwrite \
        --region "${REGION}" &> /dev/null

    log_info "✓ DATABASE_URL updated in SSM"
else
    log_warn "Could not retrieve database password from instance"
fi

# ============================================================================
# CodeDeploy Registration
# ============================================================================

log_info "Registering instance with CodeDeploy..."

# Register on-premises instance
aws deploy register-on-premises-instance \
    --instance-name "${INSTANCE_NAME}" \
    --region "${REGION}"

log_info "✓ Instance registered with CodeDeploy"

# Tag instance for deployment group
aws deploy add-tags-to-on-premises-instances \
    --instance-names "${INSTANCE_NAME}" \
    --tags Key=Environment,Value="${STAGE}" Key=Application,Value=miempresa \
    --region "${REGION}"

log_info "✓ Instance tagged for deployment group"

# ============================================================================
# Setup Credential Refresh on Instance
# ============================================================================

log_info "Setting up credential refresh on instance..."

# Copy refresh-credentials.sh to instance
REFRESH_SCRIPT="${SCRIPT_DIR}/refresh-credentials.sh"
if [ -f "$REFRESH_SCRIPT" ]; then
    scp -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o LogLevel=ERROR \
        "$REFRESH_SCRIPT" \
        ec2-user@"${PUBLIC_IP}":/tmp/refresh-credentials.sh

    # Install and configure the script
    ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" <<REMOTE_COMMANDS
sudo mv /tmp/refresh-credentials.sh /opt/miempresa/scripts/
sudo chmod +x /opt/miempresa/scripts/refresh-credentials.sh

# Add to crontab (every 50 minutes)
(sudo crontab -l 2>/dev/null || true; echo "*/50 * * * * /opt/miempresa/scripts/refresh-credentials.sh") | sudo crontab -

# Run initial credential refresh
sudo /opt/miempresa/scripts/refresh-credentials.sh || echo "Initial refresh will be configured during deployment"
REMOTE_COMMANDS

    log_info "✓ Credential refresh configured"
else
    log_warn "refresh-credentials.sh not found. Will need to be configured manually."
fi

# ============================================================================
# Setup Database Backup on Instance
# ============================================================================

log_info "Setting up database backup on instance..."

# Copy backup-postgres-s3.sh to instance
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-postgres-s3.sh"
if [ -f "$BACKUP_SCRIPT" ]; then
    scp -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o LogLevel=ERROR \
        "$BACKUP_SCRIPT" \
        ec2-user@"${PUBLIC_IP}":/tmp/backup-postgres-s3.sh

    # Install and configure the script
    ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" <<REMOTE_COMMANDS
sudo mv /tmp/backup-postgres-s3.sh /opt/miempresa/scripts/
sudo chmod +x /opt/miempresa/scripts/backup-postgres-s3.sh

# Add to crontab (daily at 2 AM)
(sudo crontab -l 2>/dev/null || true; echo "0 2 * * * /opt/miempresa/scripts/backup-postgres-s3.sh") | sudo crontab -
REMOTE_COMMANDS

    log_info "✓ Database backup configured"
else
    log_warn "backup-postgres-s3.sh not found. Will need to be configured manually."
fi

# ============================================================================
# Output Summary
# ============================================================================

echo ""
echo "=========================================="
log_info "Instance creation completed successfully!"
echo "=========================================="
echo ""
echo "Instance Details:"
echo "  Name: ${INSTANCE_NAME}"
echo "  ID: $(aws lightsail get-instance --instance-name "${INSTANCE_NAME}" --region "${REGION}" --query "instance.name" --output text)"
echo "  Public IP: ${PUBLIC_IP}"
echo "  Region: ${REGION}"
echo "  Stage: ${STAGE}"
echo ""
echo "SSH Access:"
echo "  ssh -i ${SSH_KEY} ec2-user@${PUBLIC_IP}"
echo ""
echo "Or use the utility script:"
echo "  ${SCRIPT_DIR}/../utilities/ssh-to-instance.sh ${INSTANCE_NAME}"
echo ""
echo "Next Steps:"
echo "  1. Verify instance health:"
echo "     ssh -i ${SSH_KEY} ec2-user@${PUBLIC_IP} '/opt/miempresa/scripts/health-check.sh'"
echo ""
echo "  2. Test credential refresh:"
echo "     ssh -i ${SSH_KEY} ec2-user@${PUBLIC_IP} 'sudo /opt/miempresa/scripts/refresh-credentials.sh'"
echo ""
echo "  3. Create CodeDeploy application and deployment group:"
echo "     aws deploy create-application --application-name MiEmpresa"
echo "     aws deploy create-deployment-group \\"
echo "       --application-name MiEmpresa \\"
echo "       --deployment-group-name miempresa-${STAGE} \\"
echo "       --on-premises-instance-tag-filters Key=Environment,Value=${STAGE},Type=KEY_AND_VALUE"
echo ""
echo "  4. Deploy your application:"
echo "     See: infrastructure/db/README.md for deployment instructions"
echo ""
echo "=========================================="
