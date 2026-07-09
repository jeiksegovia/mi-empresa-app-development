#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Set Environment Variable in SSM Parameter Store
# ============================================================================
# Updates a single /miempresa/<stage>/... parameter and optionally reloads it
# on the running instance (regenerates .env and restarts the API).
#
# Usage:
#   ./set-env.sh --stage <staging|prod> KEY VALUE [--secure] [--restart] [--profile disruptive]
#
# Examples:
#   ./set-env.sh --stage staging CORS_ORIGIN https://app.example.com --restart
#   ./set-env.sh --stage staging SMTP_PASSWORD 's3cret' --secure --restart
#
# KEY is resolved to /miempresa/<stage>/api/KEY unless it starts with DB_ or
# is DATABASE_URL, in which case /miempresa/<stage>/db/KEY is used.
# ============================================================================

STAGE=""
REGION="us-east-1"
PROFILE=""
SECURE=false
RESTART=false
KEY=""
VALUE=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)   STAGE="$2";   shift 2 ;;
        --region)  REGION="$2";  shift 2 ;;
        --profile) PROFILE="$2"; shift 2 ;;
        --secure)  SECURE=true;  shift ;;
        --restart) RESTART=true; shift ;;
        --help)
            grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -20
            exit 0 ;;
        *)
            if [ -z "$KEY" ]; then KEY="$1"
            elif [ -z "$VALUE" ]; then VALUE="$1"
            else echo "ERROR: Unexpected argument: $1" >&2; exit 1
            fi
            shift ;;
    esac
done

if [[ "$STAGE" != "staging" && "$STAGE" != "prod" ]] || [ -z "$KEY" ] || [ -z "$VALUE" ]; then
    echo "Usage: $0 --stage <staging|prod> KEY VALUE [--secure] [--restart] [--profile PROFILE]" >&2
    exit 1
fi

AWS=(aws)
[ -n "$PROFILE" ] && AWS=(aws --profile "$PROFILE")

# db/* namespace for database keys, api/* for everything else
if [[ "$KEY" == DB_* || "$KEY" == "DATABASE_URL" ]]; then
    PARAM_NAME="/miempresa/${STAGE}/db/${KEY}"
else
    PARAM_NAME="/miempresa/${STAGE}/api/${KEY}"
fi

TYPE="String"
$SECURE && TYPE="SecureString"

echo "Updating ${PARAM_NAME} (type: ${TYPE})..."

# SecureString cannot overwrite a String parameter in place — recreate
if $SECURE; then
    CURRENT_TYPE=$("${AWS[@]}" ssm get-parameter --name "$PARAM_NAME" --region "$REGION" \
        --query "Parameter.Type" --output text 2>/dev/null || echo "")
    if [ -n "$CURRENT_TYPE" ] && [ "$CURRENT_TYPE" != "SecureString" ]; then
        "${AWS[@]}" ssm delete-parameter --name "$PARAM_NAME" --region "$REGION"
    fi
fi

"${AWS[@]}" ssm put-parameter \
    --name "$PARAM_NAME" \
    --value "$VALUE" \
    --type "$TYPE" \
    --overwrite \
    --region "$REGION" > /dev/null

echo "✓ Parameter updated"

if $RESTART; then
    INSTANCE_NAME="miempresa-backend-${STAGE}"
    echo "Reloading environment on ${INSTANCE_NAME}..."

    PUBLIC_IP=$("${AWS[@]}" lightsail get-static-ip \
        --static-ip-name "miempresa-ip-${STAGE}" --region "$REGION" \
        --query "staticIp.ipAddress" --output text)

    SSH_KEY="${HOME}/.ssh/miempresa-lightsail-key.pem"
    ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
        ec2-user@"${PUBLIC_IP}" \
        "cd /opt/miempresa/app && STAGE=${STAGE} AWS_REGION=${REGION} bash infrastructure/db/scripts/env.sh && pm2 restart miempresa-api"

    echo "✓ .env regenerated and miempresa-api restarted"
else
    echo "Note: the running instance still has the old value."
    echo "  Re-run with --restart, or manually: env.sh + pm2 restart miempresa-api"
fi
