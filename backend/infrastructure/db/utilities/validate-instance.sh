#!/bin/bash
set -o pipefail

# ============================================================================
# Remote Instance Validation
# ============================================================================
# Downloads the Lightsail SSH key if needed (via install-ssh-key.sh), connects
# to the backend instance and validates the full service topology:
#   1. Packages     - node, npm, pm2, psql, aws cli, codedeploy agent
#   2. System       - swap, stage file, user-data completion
#   3. IAM/creds    - STS identity matches the stable session ARN, file perms,
#                     SSM read access, cron entries, /opt/miempresa ownership
#   4. DB stack     - postgresql active, database exists, tuning parameters
#                     sane for the instance's RAM
#   5. API stack    - pm2 process online + /api/v1/health 200
#                     (reported as PENDING before the first deployment)
#
# Usage:
#   ./validate-instance.sh --stage <staging|prod> [--profile disruptive] [--region us-east-1]
#
# Exit code: number of FAILED checks (0 = all good; PENDING does not fail).
# ============================================================================

STAGE=""
REGION="us-east-1"
PROFILE=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)   STAGE="$2";   shift 2 ;;
        --region)  REGION="$2";  shift 2 ;;
        --profile) PROFILE="$2"; shift 2 ;;
        --help)    grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -22; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

if [[ "$STAGE" != "staging" && "$STAGE" != "prod" ]]; then
    echo "Usage: $0 --stage <staging|prod> [--profile PROFILE]" >&2
    exit 1
fi

AWS=(aws)
[ -n "$PROFILE" ] && AWS=(aws --profile "$PROFILE")

# ============================================================================
# SSH key + instance IP
# ============================================================================

SSH_KEY="${HOME}/.ssh/miempresa-lightsail-key.pem"
if [ ! -f "$SSH_KEY" ]; then
    echo "SSH key missing — downloading via install-ssh-key.sh..."
    AWS_PROFILE="${PROFILE:-$AWS_PROFILE}" "${SCRIPT_DIR}/install-ssh-key.sh" "$REGION"
fi

PUBLIC_IP=$("${AWS[@]}" lightsail get-static-ip \
    --static-ip-name "miempresa-ip-${STAGE}" --region "$REGION" \
    --query "staticIp.ipAddress" --output text)

AWS_ACCOUNT_ID=$("${AWS[@]}" sts get-caller-identity --query Account --output text)
EXPECTED_ARN="arn:aws:sts::${AWS_ACCOUNT_ID}:assumed-role/CodeDeployInstanceRole/miempresa-backend-${STAGE}"

echo "=========================================="
echo "Validating miempresa-backend-${STAGE} @ ${PUBLIC_IP}"
echo "=========================================="

# ============================================================================
# Remote validation script (runs on the instance as ec2-user, sudo where needed)
# ============================================================================

ssh -i "$SSH_KEY" \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
    ec2-user@"${PUBLIC_IP}" \
    "EXPECTED_ARN='${EXPECTED_ARN}' STAGE='${STAGE}' bash -s" <<'REMOTE'
PASS=0; FAIL=0; PEND=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
pend() { echo "  ○ $1 (PENDING)"; PEND=$((PEND+1)); }

echo ""
echo "[1/5] Packages"
for tool in node npm pm2 psql aws; do
    if command -v $tool &>/dev/null; then
        ok "$tool: $($tool --version 2>/dev/null | head -1)"
    else
        bad "$tool not installed"
    fi
done
[ -f /opt/codedeploy-agent/bin/codedeploy-agent ] && ok "codedeploy-agent binary present" || bad "codedeploy-agent binary missing"

echo ""
echo "[2/5] System"
SWAP_KB=$(awk '/SwapTotal/{print $2}' /proc/meminfo)
[ "${SWAP_KB:-0}" -ge 1900000 ] && ok "swap: $((SWAP_KB/1024)) MB" || bad "swap missing or <2GB ($((${SWAP_KB:-0}/1024)) MB)"
[ "$(cat /etc/miempresa-stage 2>/dev/null)" == "$STAGE" ] && ok "/etc/miempresa-stage = $STAGE" || bad "/etc/miempresa-stage wrong or missing"
grep -q "user-data script completed successfully\|Completed at" /var/log/user-data.log 2>/dev/null \
    && ok "user-data completed (log: /var/log/user-data.log)" || bad "user-data completion marker not found"
sudo test -f /opt/miempresa/.db-password && bad "plaintext .db-password still on disk" || ok "no plaintext db password left on disk"

echo ""
echo "[3/5] IAM / Credentials / Permissions"
IDENTITY=$(sudo aws sts get-caller-identity --query Arn --output text 2>/dev/null)
[ "$IDENTITY" == "$EXPECTED_ARN" ] && ok "STS identity: $IDENTITY" || bad "STS identity '$IDENTITY' != expected '$EXPECTED_ARN'"
PERMS=$(sudo stat -c "%a" /root/.aws/credentials 2>/dev/null)
[ "$PERMS" == "600" ] && ok "/root/.aws/credentials perms 600" || bad "/root/.aws/credentials perms: ${PERMS:-missing}"
sudo grep -q aws_session_token /root/.aws/credentials 2>/dev/null && ok "temporary STS credentials in use" || bad "no session token (long-lived creds?)"
sudo grep -q "^\[bootstrap\]" /root/.aws/credentials 2>/dev/null && ok "bootstrap profile installed" || bad "bootstrap profile missing"
sudo aws ssm get-parameter --name "/miempresa/${STAGE}/api/PORT" --query Parameter.Value --output text &>/dev/null \
    && ok "SSM parameter read access" || bad "cannot read SSM parameters"
OWNER=$(stat -c "%U" /opt/miempresa 2>/dev/null)
[ "$OWNER" == "ec2-user" ] && ok "/opt/miempresa owned by ec2-user" || bad "/opt/miempresa owner: ${OWNER}"
CRON=$(sudo crontab -l 2>/dev/null)
echo "$CRON" | grep -q refresh-credentials && ok "cron: credential refresh (*/45)" || bad "cron: refresh-credentials missing"
echo "$CRON" | grep -q backup-postgres && ok "cron: daily backup (02:00)" || bad "cron: backup missing"
systemctl is-active --quiet codedeploy-agent && ok "codedeploy-agent service active" || bad "codedeploy-agent not active"

echo ""
echo "[4/5] Database stack (PostgreSQL 15)"
systemctl is-active --quiet postgresql && ok "postgresql service active" || bad "postgresql not active"
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='miempresa_${STAGE}'" 2>/dev/null)
[ "$DB_EXISTS" == "1" ] && ok "database miempresa_${STAGE} exists" || bad "database miempresa_${STAGE} missing"
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='miempresa'" 2>/dev/null)
[ "$USER_EXISTS" == "1" ] && ok "role miempresa exists" || bad "role miempresa missing"
show() { sudo -u postgres psql -tAc "SHOW $1" 2>/dev/null; }
SB=$(show shared_buffers); MC=$(show max_connections); ECS=$(show effective_cache_size); RPC=$(show random_page_cost)
if [ "$SB" == "256MB" ]; then ok "shared_buffers = $SB (tuned)"; else bad "shared_buffers = $SB (expected 256MB for 1GB instance)"; fi
if [ "$MC" == "50" ];   then ok "max_connections = $MC (tuned)"; else bad "max_connections = $MC (expected 50)"; fi
if [ "$ECS" == "512MB" ]; then ok "effective_cache_size = $ECS (tuned)"; else bad "effective_cache_size = $ECS (expected 512MB)"; fi
if [ "$RPC" == "1.1" ]; then ok "random_page_cost = $RPC (SSD)"; else bad "random_page_cost = $RPC (expected 1.1)"; fi
CONNS=$(sudo -u postgres psql -tAc "SELECT count(*) FROM pg_stat_activity" 2>/dev/null)
ok "active connections: ${CONNS:-?}/${MC}"

echo ""
echo "[5/5] Backend API stack (deployed via CodeDeploy)"
if pm2 list 2>/dev/null | grep -q "miempresa-api"; then
    pm2 list | grep -q "miempresa-api.*online" && ok "pm2 miempresa-api online" || bad "pm2 miempresa-api present but NOT online"
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/health 2>/dev/null)
    [ "$HTTP" == "200" ] && ok "health endpoint 200 (localhost:3001/api/v1/health)" || bad "health endpoint HTTP ${HTTP}"
    systemctl is-enabled --quiet pm2-ec2-user 2>/dev/null && ok "pm2-ec2-user boot persistence enabled" || bad "pm2-ec2-user unit not enabled (won't survive reboot)"
else
    pend "miempresa-api not deployed yet — normal before first CodeDeploy run"
fi

echo ""
echo "=========================================="
echo "Result: ${PASS} passed / ${FAIL} failed / ${PEND} pending"
echo "=========================================="
exit $FAIL
REMOTE
