#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Provision the QA User on a Stage Database
# ============================================================================
# 1. Ensures /miempresa/<stage>/qa/{QA_USER_EMAIL, QA_USER_PASSWORD} exist in
#    SSM (password generated on first run, stored as SecureString)
# 2. Opens an SSH tunnel to the stage DB (port 5432 is closed publicly)
# 3. Runs prisma/seed-qa.ts through the tunnel (idempotent upsert, no wipes)
#
# Usage:
#   ./seed-qa-staging.sh --stage <staging|prod> [--profile disruptive] [--region us-east-1]
# ============================================================================

STAGE="staging"
REGION="us-east-1"
PROFILE=""
LOCAL_PORT=5433
PROJECT_NAME="miempresa"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"   # backend/ (script lives in prisma/test-db)

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)   STAGE="$2";   shift 2 ;;
        --region)  REGION="$2";  shift 2 ;;
        --profile) PROFILE="$2"; shift 2 ;;
        --help)    grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -14; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

AWS=(aws)
[ -n "$PROFILE" ] && AWS=(aws --profile "$PROFILE")

get_param() {
    "${AWS[@]}" ssm get-parameter --name "$1" --with-decryption \
        --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo ""
}

# ============================================================================
# 1. Ensure QA credentials exist in SSM
# ============================================================================

QA_EMAIL=$(get_param "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_EMAIL")
if [ -z "$QA_EMAIL" ]; then
    QA_EMAIL="qa@miempresa.com"
    "${AWS[@]}" ssm put-parameter --name "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_EMAIL" \
        --value "$QA_EMAIL" --type String --region "$REGION" > /dev/null
    echo "✓ Created SSM /${PROJECT_NAME}/${STAGE}/qa/QA_USER_EMAIL = ${QA_EMAIL}"
fi

QA_PASSWORD=$(get_param "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_PASSWORD")
if [ -z "$QA_PASSWORD" ]; then
    QA_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
    "${AWS[@]}" ssm put-parameter --name "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_PASSWORD" \
        --value "$QA_PASSWORD" --type SecureString --region "$REGION" > /dev/null
    echo "✓ Generated + stored SSM /${PROJECT_NAME}/${STAGE}/qa/QA_USER_PASSWORD"
fi

# ============================================================================
# 2. Tunnel + DB URL
# ============================================================================

DB_PASSWORD=$(get_param "/${PROJECT_NAME}/${STAGE}/db/DB_PASSWORD")
DB_NAME=$(get_param "/${PROJECT_NAME}/${STAGE}/db/DB_NAME"); DB_NAME="${DB_NAME:-miempresa_${STAGE}}"

PUBLIC_IP=$("${AWS[@]}" lightsail get-static-ip \
    --static-ip-name "${PROJECT_NAME}-ip-${STAGE}" --region "$REGION" \
    --query "staticIp.ipAddress" --output text)

SSH_KEY="${HOME}/.ssh/miempresa-lightsail-key.pem"
echo "Opening tunnel localhost:${LOCAL_PORT} -> ${STAGE} DB via ${PUBLIC_IP}..."
ssh -i "$SSH_KEY" \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
    -f -N -L "${LOCAL_PORT}:localhost:5432" ec2-user@"${PUBLIC_IP}"
TUNNEL_PID=$(pgrep -f "ssh.*${LOCAL_PORT}:localhost:5432" | head -1)
trap '[ -n "$TUNNEL_PID" ] && kill $TUNNEL_PID 2>/dev/null || true' EXIT
sleep 2

# ============================================================================
# 3. Run the QA seed through the tunnel
# ============================================================================

cd "$BACKEND_DIR"
DATABASE_URL="postgresql://miempresa:${DB_PASSWORD}@localhost:${LOCAL_PORT}/${DB_NAME}" \
QA_USER_EMAIL="$QA_EMAIL" \
QA_USER_PASSWORD="$QA_PASSWORD" \
npx tsx prisma/test-db/seed-qa.ts

echo ""
echo "QA user provisioned on ${STAGE}. Credentials live in SSM:"
echo "  /${PROJECT_NAME}/${STAGE}/qa/QA_USER_EMAIL"
echo "  /${PROJECT_NAME}/${STAGE}/qa/QA_USER_PASSWORD (SecureString)"
