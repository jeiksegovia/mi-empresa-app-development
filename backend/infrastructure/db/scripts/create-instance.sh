#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Lightsail Instance Creation Script with CodeDeploy Integration (v2)
# ============================================================================
# Provisions a Lightsail instance running:
#   - PostgreSQL 15 (independent systemd service stack)
#   - Node.js 20 + PM2 (API service stack, deployed via CodeDeploy)
#   - CodeDeploy agent with STS credentials (stable session name)
#
# v2 fixes vs v1:
#   B1: default bundle micro_3_0 ($7) — micro_2_0 generation is retired
#   B2: bootstrap credentials are pushed TO the instance (SSM -> /root/.aws)
#   B3: on-prem registration uses --iam-session-arn with a STABLE session name
#   B4: user-data rendered with an explicit export header + jq JSON payload
#       (no envsubst-into-YAML, no broken indentation, STAGE always correct)
#
# Usage:
#   ./create-instance.sh --stage <staging|prod> [--region us-east-1]
#                        [--bundle micro_3_0] [--profile disruptive]
#
# Prerequisites: run deploy-infrastructure.sh first (IAM, S3, SSM, CodeDeploy stacks)
# ============================================================================

STAGE=""
REGION="us-east-1"
BUNDLE="micro_3_0"
PROFILE=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR}/../templates"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    cat <<EOF
Usage: $0 --stage <staging|prod> [OPTIONS]

Create a Lightsail instance with PostgreSQL and CodeDeploy integration.

Required:
  --stage STAGE          Environment stage (staging or prod)

Optional:
  --region REGION        AWS region (default: us-east-1)
  --bundle BUNDLE        Lightsail bundle ID (default: micro_3_0)
  --profile PROFILE      AWS CLI profile (default: environment default)
  --help                 Show this help

Current-generation Linux bundles (verified July 2026):
  nano_3_0    - 0.5 GB RAM, 2 vCPU, 20 GB SSD  (\$5/month)
  micro_3_0   - 1 GB RAM,   2 vCPU, 40 GB SSD  (\$7/month)  <- staging default
  small_3_0   - 2 GB RAM,   2 vCPU, 60 GB SSD  (\$12/month) <- prod recommended
  medium_3_0  - 4 GB RAM,   2 vCPU, 80 GB SSD  (\$24/month)
EOF
    exit 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)   STAGE="$2";   shift 2 ;;
        --region)  REGION="$2";  shift 2 ;;
        --bundle)  BUNDLE="$2";  shift 2 ;;
        --profile) PROFILE="$2"; shift 2 ;;
        --help)    usage ;;
        *) log_error "Unknown argument: $1"; usage ;;
    esac
done

if [[ "$STAGE" != "staging" && "$STAGE" != "prod" ]]; then
    log_error "Stage must be 'staging' or 'prod'"
    usage
fi

# All aws calls honor --profile when given
AWS=(aws)
[ -n "$PROFILE" ] && AWS=(aws --profile "$PROFILE")

# ============================================================================
# Configuration
# ============================================================================

PROJECT_NAME="miempresa"
INSTANCE_NAME="${PROJECT_NAME}-backend-${STAGE}"
STATIC_IP_NAME="${PROJECT_NAME}-ip-${STAGE}"
AWS_ACCOUNT_ID=$("${AWS[@]}" sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/CodeDeployInstanceRole"
# STABLE session name — must match refresh-credentials.sh and the on-prem registration
SESSION_NAME="${INSTANCE_NAME}"
IAM_SESSION_ARN="arn:aws:sts::${AWS_ACCOUNT_ID}:assumed-role/CodeDeployInstanceRole/${SESSION_NAME}"
SSH_KEY="${HOME}/.ssh/miempresa-lightsail-key.pem"
SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR)

log_info "Configuration:"
echo "  Instance Name: ${INSTANCE_NAME}"
echo "  Stage: ${STAGE}"
echo "  Region: ${REGION}"
echo "  Bundle: ${BUNDLE}"
echo "  AWS Account: ${AWS_ACCOUNT_ID}"
echo "  IAM Session ARN: ${IAM_SESSION_ARN}"
echo ""

# ============================================================================
# Prerequisite Checks
# ============================================================================

log_info "Checking prerequisites..."

for tool in aws jq ssh scp; do
    if ! command -v "$tool" &> /dev/null; then
        log_error "$tool is not installed."
        exit 1
    fi
done

log_info "Verifying IAM role: CodeDeployInstanceRole..."
if ! "${AWS[@]}" iam get-role --role-name CodeDeployInstanceRole &> /dev/null; then
    log_error "CodeDeployInstanceRole does not exist. Run deploy-infrastructure.sh first."
    exit 1
fi
log_info "✓ IAM role exists"

log_info "Verifying bootstrap credentials in SSM..."
BOOTSTRAP_ACCESS_KEY=$("${AWS[@]}" ssm get-parameter \
    --name "/${PROJECT_NAME}/bootstrap/access-key-id" \
    --region "${REGION}" --query "Parameter.Value" --output text 2>/dev/null || echo "")
BOOTSTRAP_SECRET_KEY=$("${AWS[@]}" ssm get-parameter \
    --name "/${PROJECT_NAME}/bootstrap/secret-access-key" \
    --with-decryption \
    --region "${REGION}" --query "Parameter.Value" --output text 2>/dev/null || echo "")

if [ -z "$BOOTSTRAP_ACCESS_KEY" ] || [ -z "$BOOTSTRAP_SECRET_KEY" ]; then
    log_error "Bootstrap credentials not found in SSM. Run deploy-infrastructure.sh first."
    exit 1
fi
log_info "✓ Bootstrap credentials available"

log_info "Checking if instance already exists..."
if "${AWS[@]}" lightsail get-instance --instance-name "${INSTANCE_NAME}" --region "${REGION}" &> /dev/null; then
    log_error "Instance ${INSTANCE_NAME} already exists. Delete it first or use a different name."
    exit 1
fi
log_info "✓ Instance name is available"
echo ""

# ============================================================================
# Render User Data (B4 fix: explicit export header, no envsubst)
# ============================================================================

log_info "Rendering user-data script..."

USER_DATA_TEMPLATE="${TEMPLATE_DIR}/user-data-postgresql.sh"
if [ ! -f "$USER_DATA_TEMPLATE" ]; then
    log_error "User data template not found: ${USER_DATA_TEMPLATE}"
    exit 1
fi

RENDERED_USER_DATA=$(mktemp /tmp/user-data-${STAGE}-XXXXXX.sh)
{
    echo "#!/bin/bash"
    echo "export STAGE=${STAGE}"
    echo "export AWS_REGION=${REGION}"
    tail -n +2 "$USER_DATA_TEMPLATE"   # skip template shebang
} > "$RENDERED_USER_DATA"

log_info "✓ User data rendered: ${RENDERED_USER_DATA}"

# ============================================================================
# Create Instance (jq-built JSON payload: safe escaping, valid syntax)
# ============================================================================

log_info "Creating Lightsail instance: ${INSTANCE_NAME}..."

PAYLOAD=$(jq -n \
    --arg name "$INSTANCE_NAME" \
    --arg az "${REGION}a" \
    --arg bundle "$BUNDLE" \
    --arg stage "$STAGE" \
    --rawfile userdata "$RENDERED_USER_DATA" \
    '{
        instanceNames: [$name],
        availabilityZone: $az,
        blueprintId: "amazon_linux_2023",
        bundleId: $bundle,
        userData: $userdata,
        ipAddressType: "ipv4",
        tags: [
            {key: "Environment", value: $stage},
            {key: "Application", value: "miempresa"},
            {key: "Project", value: "mi-empresa-app"},
            {key: "Component", value: "Backend"},
            {key: "ManagedBy", value: "Infrastructure-as-Code"}
        ]
    }')

"${AWS[@]}" lightsail create-instances \
    --cli-input-json "$PAYLOAD" \
    --region "${REGION}" > /dev/null

rm -f "$RENDERED_USER_DATA"
log_info "✓ Instance creation initiated"

# ============================================================================
# Wait for Running State
# ============================================================================

log_info "Waiting for instance to reach 'running' state..."
MAX_WAIT=300; ELAPSED=0; SLEEP_INTERVAL=10; STATE="pending"

while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATE=$("${AWS[@]}" lightsail get-instance \
        --instance-name "${INSTANCE_NAME}" --region "${REGION}" \
        --query "instance.state.name" --output text 2>/dev/null || echo "pending")
    [ "$STATE" == "running" ] && { log_info "✓ Instance is running"; break; }
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
# Static IP
# ============================================================================

log_info "Allocating static IP: ${STATIC_IP_NAME}..."
if "${AWS[@]}" lightsail get-static-ip --static-ip-name "${STATIC_IP_NAME}" --region "${REGION}" &> /dev/null; then
    log_warn "Static IP ${STATIC_IP_NAME} already exists. Attaching to instance..."
else
    "${AWS[@]}" lightsail allocate-static-ip --static-ip-name "${STATIC_IP_NAME}" --region "${REGION}" > /dev/null
    log_info "✓ Static IP allocated"
fi

sleep 5
"${AWS[@]}" lightsail attach-static-ip \
    --static-ip-name "${STATIC_IP_NAME}" \
    --instance-name "${INSTANCE_NAME}" \
    --region "${REGION}" > /dev/null

PUBLIC_IP=$("${AWS[@]}" lightsail get-static-ip \
    --static-ip-name "${STATIC_IP_NAME}" --region "${REGION}" \
    --query "staticIp.ipAddress" --output text)
log_info "✓ Static IP attached: ${PUBLIC_IP}"

# ============================================================================
# Firewall: 22 (SSH + DB tunnel), 3001 (CloudFront origin, plain HTTP).
# 5432 stays CLOSED — DB access only via SSH tunnel (utilities/db-tunnel.sh).
# ============================================================================

log_info "Configuring firewall rules..."
"${AWS[@]}" lightsail put-instance-public-ports \
    --instance-name "${INSTANCE_NAME}" \
    --port-infos \
        "fromPort=22,toPort=22,protocol=tcp,cidrs=0.0.0.0/0" \
        "fromPort=3001,toPort=3001,protocol=tcp,cidrs=0.0.0.0/0" \
    --region "${REGION}" > /dev/null
log_info "✓ Firewall rules configured (22, 3001; 5432 closed)"

# ============================================================================
# SSH Key
# ============================================================================

if [ ! -f "$SSH_KEY" ]; then
    log_info "Downloading SSH key..."
    # Despite the field name, privateKeyBase64 contains the PEM as PLAIN TEXT —
    # piping through `base64 --decode` corrupts the key.
    "${AWS[@]}" lightsail download-default-key-pair \
        --region "${REGION}" \
        --query "privateKeyBase64" --output text > "$SSH_KEY"
    chmod 400 "$SSH_KEY"
    log_info "✓ SSH key saved: ${SSH_KEY}"
fi

# ============================================================================
# Wait for Bootstrap (user-data) to Finish — poll CodeDeploy agent
# ============================================================================

log_info "Waiting for instance bootstrap (user-data) to complete..."
log_info "  This typically takes 5-10 minutes..."

# Poll for the user-data COMPLETION MARKER, not service status — the CodeDeploy
# agent comes up at bootstrap step 3, long before directories/cron exist (race).
MAX_WAIT=900; ELAPSED=0; SLEEP_INTERVAL=20
while [ $ELAPSED -lt $MAX_WAIT ]; do
    if ssh "${SSH_OPTS[@]}" -o ConnectTimeout=10 ec2-user@"${PUBLIC_IP}" \
        "sudo grep -q 'User-data script completed successfully' /var/log/user-data.log" &> /dev/null; then
        log_info "✓ user-data bootstrap completed"
        break
    fi
    echo -n "."
    sleep $SLEEP_INTERVAL
    ELAPSED=$((ELAPSED + SLEEP_INTERVAL))
done
echo ""

if [ $ELAPSED -ge $MAX_WAIT ]; then
    log_error "Timeout waiting for bootstrap. Inspect: ssh -i ${SSH_KEY} ec2-user@${PUBLIC_IP} 'sudo tail -50 /var/log/user-data.log'"
    exit 1
fi

# ============================================================================
# Install Bootstrap Credentials on Instance (B2 fix)
# The instance needs the bootstrap IAM user's keys to run sts:AssumeRole.
# ============================================================================

log_info "Installing bootstrap credentials on instance..."

ssh "${SSH_OPTS[@]}" ec2-user@"${PUBLIC_IP}" "sudo bash -s" <<REMOTE
mkdir -p /root/.aws
cat > /root/.aws/credentials <<CREDS
[bootstrap]
aws_access_key_id = ${BOOTSTRAP_ACCESS_KEY}
aws_secret_access_key = ${BOOTSTRAP_SECRET_KEY}
CREDS
chmod 600 /root/.aws/credentials
cat > /root/.aws/config <<CFG
[default]
region = ${REGION}
output = json
[profile bootstrap]
region = ${REGION}
output = json
CFG
chmod 600 /root/.aws/config
REMOTE

log_info "✓ Bootstrap credentials installed (/root/.aws, profile 'bootstrap')"

# ============================================================================
# Install Credential Refresh + Backup Scripts, Run Initial Refresh
# ============================================================================

log_info "Installing credential refresh and backup scripts..."

scp "${SSH_OPTS[@]}" \
    "${SCRIPT_DIR}/refresh-credentials.sh" \
    "${SCRIPT_DIR}/backup-postgres-s3.sh" \
    ec2-user@"${PUBLIC_IP}":/tmp/

ssh "${SSH_OPTS[@]}" ec2-user@"${PUBLIC_IP}" "sudo bash -s" <<'REMOTE'
mv /tmp/refresh-credentials.sh /tmp/backup-postgres-s3.sh /opt/miempresa/scripts/
chmod +x /opt/miempresa/scripts/refresh-credentials.sh /opt/miempresa/scripts/backup-postgres-s3.sh
chown root:root /opt/miempresa/scripts/refresh-credentials.sh /opt/miempresa/scripts/backup-postgres-s3.sh

# Cron: refresh every 45 min (fires :00/:45 — always under the 60-min STS expiry),
# backup daily at 2 AM. Idempotent (grep guards).
CRON_TMP=$(mktemp)
crontab -l 2>/dev/null > "$CRON_TMP" || true
grep -q "refresh-credentials.sh" "$CRON_TMP" || echo "*/45 * * * * /opt/miempresa/scripts/refresh-credentials.sh" >> "$CRON_TMP"
grep -q "backup-postgres-s3.sh" "$CRON_TMP" || echo "0 2 * * * /opt/miempresa/scripts/backup-postgres-s3.sh" >> "$CRON_TMP"
crontab "$CRON_TMP"
rm -f "$CRON_TMP"

# Initial refresh — must succeed now that bootstrap creds are in place
/opt/miempresa/scripts/refresh-credentials.sh
REMOTE

log_info "✓ Cron configured (*/45 refresh, 02:00 backup) and initial refresh succeeded"

# Verify assumed-role identity matches the stable session ARN
INSTANCE_ARN=$(ssh "${SSH_OPTS[@]}" ec2-user@"${PUBLIC_IP}" \
    "sudo aws sts get-caller-identity --query Arn --output text" 2>/dev/null || echo "")
if [ "$INSTANCE_ARN" == "$IAM_SESSION_ARN" ]; then
    log_info "✓ Instance identity matches stable session ARN"
else
    log_error "Instance identity mismatch: got '${INSTANCE_ARN}', expected '${IAM_SESSION_ARN}'"
    exit 1
fi

# ============================================================================
# Store Database Password in SSM
# ============================================================================

log_info "Storing database password in SSM Parameter Store..."

DB_PASSWORD=$(ssh "${SSH_OPTS[@]}" ec2-user@"${PUBLIC_IP}" \
    "sudo cat /opt/miempresa/.db-password 2>/dev/null || echo ''")

if [ -n "$DB_PASSWORD" ]; then
    # Recreate as SecureString (CloudFormation created String placeholders;
    # type changes require delete + put)
    for PARAM in "/${PROJECT_NAME}/${STAGE}/db/DB_PASSWORD" "/${PROJECT_NAME}/${STAGE}/db/DATABASE_URL"; do
        "${AWS[@]}" ssm delete-parameter --name "$PARAM" --region "${REGION}" &> /dev/null || true
    done

    "${AWS[@]}" ssm put-parameter \
        --name "/${PROJECT_NAME}/${STAGE}/db/DB_PASSWORD" \
        --value "$DB_PASSWORD" \
        --type "SecureString" \
        --region "${REGION}" > /dev/null

    DB_URL="postgresql://miempresa:${DB_PASSWORD}@localhost:5432/miempresa_${STAGE}"
    "${AWS[@]}" ssm put-parameter \
        --name "/${PROJECT_NAME}/${STAGE}/db/DATABASE_URL" \
        --value "$DB_URL" \
        --type "SecureString" \
        --region "${REGION}" > /dev/null

    # Remove the plaintext password file from the instance
    ssh "${SSH_OPTS[@]}" ec2-user@"${PUBLIC_IP}" "sudo rm -f /opt/miempresa/.db-password"
    log_info "✓ DB_PASSWORD and DATABASE_URL stored as SecureString; local copy removed"
else
    log_error "Could not retrieve database password from instance (/opt/miempresa/.db-password)"
    exit 1
fi

# ============================================================================
# CodeDeploy On-Premises Registration (B3 fix: stable --iam-session-arn)
# ============================================================================

log_info "Registering instance with CodeDeploy..."

# Re-register cleanly if a previous registration exists
if "${AWS[@]}" deploy get-on-premises-instance --instance-name "${INSTANCE_NAME}" --region "${REGION}" &> /dev/null; then
    log_warn "Instance already registered; deregistering first..."
    "${AWS[@]}" deploy deregister-on-premises-instance --instance-name "${INSTANCE_NAME}" --region "${REGION}"
    sleep 3
fi

"${AWS[@]}" deploy register-on-premises-instance \
    --instance-name "${INSTANCE_NAME}" \
    --iam-session-arn "${IAM_SESSION_ARN}" \
    --region "${REGION}"

"${AWS[@]}" deploy add-tags-to-on-premises-instances \
    --instance-names "${INSTANCE_NAME}" \
    --tags Key=Environment,Value="${STAGE}" Key=Application,Value=miempresa \
    --region "${REGION}"

log_info "✓ Instance registered and tagged (Environment=${STAGE}, Application=miempresa)"

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "=========================================="
log_info "Instance creation completed successfully!"
echo "=========================================="
echo ""
echo "Instance Details:"
echo "  Name: ${INSTANCE_NAME}"
echo "  Public IP: ${PUBLIC_IP}"
echo "  Region: ${REGION}"
echo "  Stage: ${STAGE}"
echo "  Bundle: ${BUNDLE}"
echo ""
echo "SSH Access:"
echo "  ssh -i ${SSH_KEY} ec2-user@${PUBLIC_IP}"
echo "  or: ${SCRIPT_DIR}/../utilities/ssh-to-instance.sh ${INSTANCE_NAME}"
echo ""
echo "Next Steps:"
echo "  1. Health check:  ssh -i ${SSH_KEY} ec2-user@${PUBLIC_IP} '/opt/miempresa/scripts/health-check.sh'"
echo "  2. First deployment (see runbook Phase 3), then:"
echo "  3. Edge stack (DNS + TLS):"
echo "     aws cloudformation deploy --template-file ../cloudformation/edge-stack.yml \\"
echo "       --stack-name miempresa-edge-${STAGE} \\"
echo "       --parameter-overrides Environment=${STAGE} StaticIp=${PUBLIC_IP} \\"
echo "         OriginVerifySecret=\$(aws ssm get-parameter --name /miempresa/${STAGE}/api/ORIGIN_VERIFY_SECRET --with-decryption --query Parameter.Value --output text) \\"
echo "       --region ${REGION}"
echo ""
echo "=========================================="
