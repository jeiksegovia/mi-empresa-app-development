#!/bin/bash
set -e

# ============================================================================
# PostgreSQL SSH Tunnel for Local Development / Debugging
# ============================================================================
# Port 5432 is intentionally CLOSED in the Lightsail firewall. This script
# opens an SSH tunnel through the instance so psql / Prisma Studio / GUI
# clients can reach the database from your laptop.
#
# Works unchanged if the DB later moves to RDS: the tunnel target host is
# read from SSM (/miempresa/<stage>/db/DB_HOST), which would then point at
# the RDS endpoint reachable from the instance.
#
# Usage:
#   ./db-tunnel.sh --stage <staging|prod> [--port 5433] [--profile disruptive]
#
# Then in another terminal:
#   psql "postgresql://miempresa:<password>@localhost:5433/miempresa_<stage>"
# ============================================================================

STAGE=""
REGION="us-east-1"
PROFILE=""
LOCAL_PORT=5433

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)   STAGE="$2";      shift 2 ;;
        --region)  REGION="$2";     shift 2 ;;
        --profile) PROFILE="$2";    shift 2 ;;
        --port)    LOCAL_PORT="$2"; shift 2 ;;
        --help)
            grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -18
            exit 0 ;;
        *) echo "ERROR: Unknown argument: $1" >&2; exit 1 ;;
    esac
done

if [[ "$STAGE" != "staging" && "$STAGE" != "prod" ]]; then
    echo "Usage: $0 --stage <staging|prod> [--port 5433] [--profile PROFILE]" >&2
    exit 1
fi

AWS=(aws)
[ -n "$PROFILE" ] && AWS=(aws --profile "$PROFILE")

SSH_KEY="${HOME}/.ssh/miempresa-lightsail-key.pem"
if [ ! -f "$SSH_KEY" ]; then
    echo "SSH key not found: ${SSH_KEY} — run install-ssh-key.sh first" >&2
    exit 1
fi

get_param() {
    "${AWS[@]}" ssm get-parameter --name "$1" --with-decryption \
        --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo ""
}

echo "Resolving connection details for stage '${STAGE}'..."

PUBLIC_IP=$("${AWS[@]}" lightsail get-static-ip \
    --static-ip-name "miempresa-ip-${STAGE}" --region "$REGION" \
    --query "staticIp.ipAddress" --output text)

DB_HOST=$(get_param "/miempresa/${STAGE}/db/DB_HOST");     DB_HOST="${DB_HOST:-localhost}"
DB_PORT=$(get_param "/miempresa/${STAGE}/db/DB_PORT");     DB_PORT="${DB_PORT:-5432}"
DB_NAME=$(get_param "/miempresa/${STAGE}/db/DB_NAME");     DB_NAME="${DB_NAME:-miempresa_${STAGE}}"
DB_USER=$(get_param "/miempresa/${STAGE}/db/DB_USER");     DB_USER="${DB_USER:-miempresa}"
DB_PASSWORD=$(get_param "/miempresa/${STAGE}/db/DB_PASSWORD")

echo ""
echo "=========================================="
echo "Tunnel:  localhost:${LOCAL_PORT} -> ${DB_HOST}:${DB_PORT} (via ${PUBLIC_IP})"
echo "=========================================="
echo ""
echo "Connect with:"
echo "  psql \"postgresql://${DB_USER}:${DB_PASSWORD:-<password>}@localhost:${LOCAL_PORT}/${DB_NAME}\""
echo ""
echo "Or for Prisma Studio (from backend/):"
echo "  DATABASE_URL=\"postgresql://${DB_USER}:${DB_PASSWORD:-<password>}@localhost:${LOCAL_PORT}/${DB_NAME}\" npx prisma studio"
echo ""
echo "Press Ctrl+C to close the tunnel."
echo ""

exec ssh -i "$SSH_KEY" \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
    -N -L "${LOCAL_PORT}:${DB_HOST}:${DB_PORT}" \
    ec2-user@"${PUBLIC_IP}"
