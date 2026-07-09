#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Create the Well-Known Dev Users on a Stage (admin@/empleado@miempresa.com)
# ============================================================================
# 1. Opens an SSH tunnel to the stage DB and runs create-users.ts (idempotent)
# 2. Sets SSM /miempresa/<stage>/qa/DEV_USERS_ENABLED=true so the QA suite
#    expects these credentials to WORK on this stage (elsewhere it asserts
#    they fail — security canary)
#
# ⚠ Weak known password on a public API — intended for STAGING only.
#
# Usage:
#   ./create-users-staging.sh --stage <staging|prod> [--profile disruptive] [--region us-east-1]
# ============================================================================

STAGE="staging"
REGION="us-east-1"
PROFILE=""
LOCAL_PORT=5433
PROJECT_NAME="miempresa"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # backend/prisma/test-db
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

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

cd "$BACKEND_DIR"
DATABASE_URL="postgresql://miempresa:${DB_PASSWORD}@localhost:${LOCAL_PORT}/${DB_NAME}" \
npx tsx prisma/test-db/create-users.ts

# Record the policy for this stage: dev users are ENABLED here.
# The QA suite reads this flag to decide whether admin@/password123
# must succeed (enabled) or must be rejected (security canary).
"${AWS[@]}" ssm put-parameter \
    --name "/${PROJECT_NAME}/${STAGE}/qa/DEV_USERS_ENABLED" \
    --value "true" --type String --overwrite \
    --region "$REGION" > /dev/null
echo "✓ SSM /${PROJECT_NAME}/${STAGE}/qa/DEV_USERS_ENABLED = true"

echo ""
echo "Dev users live on ${STAGE}:"
echo "  admin@miempresa.com    / password123  (ADMIN)"
echo "  empleado@miempresa.com / password123  (EMPLEADO)"
echo ""
echo "To revert: delete the users and set DEV_USERS_ENABLED=false"
