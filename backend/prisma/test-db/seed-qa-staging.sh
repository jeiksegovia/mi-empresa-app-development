#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Provision QA Users on a Stage Database (fixes-jul17-2 §2)
# ============================================================================
# 1. Ensures the 3 QA SSM pairs exist (one pair per profile: EMAIL + PASSWORD):
#      /<project>/<stage>/qa/qa-admin/{EMAIL,PASSWORD}
#      /<project>/<stage>/qa/qa-gerontologa/{EMAIL,PASSWORD}
#      /<project>/<stage>/qa/qa-contratos/{EMAIL,PASSWORD}
#    Passwords are SecureString, generated on first run (never printed to logs).
#    Legacy /<project>/<stage>/qa/QA_USER_{EMAIL,PASSWORD} are kept as an alias
#    of the qa-admin pair (same values, written together) so older callers and
#    docs that reference the single-user layout keep working.
# 2. Opens an SSH tunnel to the stage DB (port 5432 is closed publicly).
# 3. Runs prisma/test-db/seed-qa.ts through the tunnel (idempotent upsert,
#    no wipes — never touches any other rows).
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

# Profile config: SSM prefix, default email, env-var key used at seed-qa.ts time.
PROFILES=(
  "qa-admin|qa-admin@miempresa.com|QA_ADMIN"
  "qa-gerontologa|qa-gerontologa@miempresa.com|QA_GERONTOLOGA"
  "qa-contratos|qa-contratos@miempresa.com|QA_CONTRATOS"
)

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)   STAGE="$2";   shift 2 ;;
        --region)  REGION="$2";  shift 2 ;;
        --profile) PROFILE="$2"; shift 2 ;;
        --help)    grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -18; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

AWS=(aws)
[ -n "$PROFILE" ] && AWS=(aws --profile "$PROFILE")

get_param() {
    "${AWS[@]}" ssm get-parameter --name "$1" --with-decryption \
        --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo ""
}

put_param() {
    # B35: --overwrite so re-runs (legacy alias + existing pairs) are idempotent
    "${AWS[@]}" ssm put-parameter --name "$1" --value "$2" --type "$3" \
        --region "$REGION" --overwrite > /dev/null
}

# ============================================================================
# 1. Ensure QA credentials exist in SSM (3 profiles + legacy alias)
# ============================================================================

# B34: bash 3.2-safe storage (plain vars; no associative arrays).
# Vars: EMAIL_<ENV_KEY>, PASSWORD_<ENV_KEY>
# Set via printf -v; read via ${!ref} indirect expansion (both bash 3.1+).
for entry in "${PROFILES[@]}"; do
    IFS='|' read -r SSM_NAME DEFAULT_EMAIL ENV_KEY <<< "$entry"
    EMAIL_NAME="/${PROJECT_NAME}/${STAGE}/qa/${SSM_NAME}/EMAIL"
    PASS_NAME="/${PROJECT_NAME}/${STAGE}/qa/${SSM_NAME}/PASSWORD"
    email_ref="EMAIL_${ENV_KEY}"
    pass_ref="PASSWORD_${ENV_KEY}"

    printf -v "$email_ref" '%s' "$(get_param "$EMAIL_NAME")"
    if [ -z "${!email_ref}" ]; then
        printf -v "$email_ref" '%s' "$DEFAULT_EMAIL"
        put_param "$EMAIL_NAME" "${!email_ref}" String
        echo "✓ Created SSM $EMAIL_NAME = ${!email_ref}"
    fi

    printf -v "$pass_ref" '%s' "$(get_param "$PASS_NAME")"
    if [ -z "${!pass_ref}" ]; then
        printf -v "$pass_ref" '%s' "$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
        put_param "$PASS_NAME" "${!pass_ref}" SecureString
        echo "✓ Generated + stored SSM $PASS_NAME (SecureString)"
    fi
done

# Legacy alias /qa/QA_USER_{EMAIL,PASSWORD} — mirror qa-admin values so old
# scripts that read the single-user layout still resolve to a valid login.
put_param "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_EMAIL" "${EMAIL_QA_ADMIN}" String
put_param "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_PASSWORD" "${PASSWORD_QA_ADMIN}" SecureString

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
# 3. Run the QA seed through the tunnel (3 profiles exported via env)
# ============================================================================

cd "$BACKEND_DIR"
DATABASE_URL="postgresql://miempresa:${DB_PASSWORD}@localhost:${LOCAL_PORT}/${DB_NAME}" \
QA_ADMIN_EMAIL="${EMAIL_QA_ADMIN}" \
QA_ADMIN_PASSWORD="${PASSWORD_QA_ADMIN}" \
QA_GERONTOLOGA_EMAIL="${EMAIL_QA_GERONTOLOGA}" \
QA_GERONTOLOGA_PASSWORD="${PASSWORD_QA_GERONTOLOGA}" \
QA_CONTRATOS_EMAIL="${EMAIL_QA_CONTRATOS}" \
QA_CONTRATOS_PASSWORD="${PASSWORD_QA_CONTRATOS}" \
npx tsx prisma/test-db/seed-qa.ts

echo ""
echo "3 QA users provisioned on ${STAGE}. Credentials live in SSM:"
echo "  /${PROJECT_NAME}/${STAGE}/qa/qa-admin/{EMAIL,PASSWORD}"
echo "  /${PROJECT_NAME}/${STAGE}/qa/qa-gerontologa/{EMAIL,PASSWORD}"
echo "  /${PROJECT_NAME}/${STAGE}/qa/qa-contratos/{EMAIL,PASSWORD}"
echo "Legacy alias (qa-admin values mirrored):"
echo "  /${PROJECT_NAME}/${STAGE}/qa/QA_USER_{EMAIL,PASSWORD}"
