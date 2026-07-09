#!/bin/bash
set -o pipefail

# ============================================================================
# DB Tier QA — Stage Database Schema, Migrations & Seed Verification
# ============================================================================
# Runs ON the stage instance over SSH (no public DB port needed) and checks:
#   1. Migrations  - prisma migrate status is clean (all applied, none pending)
#   2. Schema      - expected core tables exist; total table count sane
#   3. Structure   - key columns on usuarios (login contract) present
#   4. QA seed     - the QA user exists and is active
#
# Usage:
#   ./db-staging-qa.sh --stage <staging|prod> [--profile disruptive] [--region us-east-1]
#
# Exit code: number of failed checks.
# ============================================================================

STAGE="staging"
REGION="us-east-1"
PROFILE=""
PROJECT_NAME="miempresa"

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)   STAGE="$2";   shift 2 ;;
        --region)  REGION="$2";  shift 2 ;;
        --profile) PROFILE="$2"; shift 2 ;;
        --help)    grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -15; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

AWS=(aws)
[ -n "$PROFILE" ] && AWS=(aws --profile "$PROFILE")

QA_EMAIL=$("${AWS[@]}" ssm get-parameter --name "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_EMAIL" \
    --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "qa@miempresa.com")

QA_PASSWORD=$("${AWS[@]}" ssm get-parameter --name "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_PASSWORD" \
    --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")

PUBLIC_IP=$("${AWS[@]}" lightsail get-static-ip \
    --static-ip-name "${PROJECT_NAME}-ip-${STAGE}" --region "$REGION" \
    --query "staticIp.ipAddress" --output text)

SSH_KEY="${HOME}/.ssh/miempresa-lightsail-key.pem"

echo "=========================================="
echo "DB QA — ${PROJECT_NAME}_${STAGE} @ ${PUBLIC_IP}"
echo "=========================================="

ssh -i "$SSH_KEY" \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
    ec2-user@"${PUBLIC_IP}" \
    "STAGE='${STAGE}' QA_EMAIL='${QA_EMAIL}' QA_PASSWORD='${QA_PASSWORD}' bash -s" <<'REMOTE'
PASS=0; FAIL=0
ok()  { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
DB="miempresa_${STAGE}"
q() { sudo -u postgres psql -d "$DB" -tAc "$1" 2>/dev/null; }

echo ""
echo "[1/4] Migrations (prisma migrate status)"
cd /opt/miempresa/app
MIG_OUT=$(set -a; source .env; set +a; npx prisma migrate status 2>/dev/null)
echo "$MIG_OUT" | grep -q "Database schema is up to date" \
    && ok "schema up to date: $(echo "$MIG_OUT" | grep -o '[0-9]* migrations found' | head -1)" \
    || bad "migrations not clean: $(echo "$MIG_OUT" | tail -2 | tr '\n' ' ')"
APPLIED=$(q "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL")
FAILED_MIG=$(q "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL")
[ "${FAILED_MIG:-1}" = "0" ] && ok "no stuck migrations (${APPLIED} applied)" || bad "${FAILED_MIG} unfinished migration(s)"

echo ""
echo "[2/4] Schema — core tables"
TABLES=$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
[ "${TABLES:-0}" -ge 25 ] && ok "table count: ${TABLES}" || bad "only ${TABLES} tables (expected >= 25)"
for t in usuarios empleados clientes sesiones instrumentos empresas; do
    EXISTS=$(q "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'")
    [ "$EXISTS" = "1" ] && ok "table ${t} exists" || bad "table ${t} MISSING"
done

echo ""
echo "[3/4] Structure — usuarios login contract"
for c in email password rol nombre apellido activo; do
    EXISTS=$(q "SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='${c}'")
    [ "$EXISTS" = "1" ] && ok "usuarios.${c}" || bad "usuarios.${c} MISSING"
done
UNIQ=$(q "SELECT 1 FROM pg_indexes WHERE tablename='usuarios' AND indexdef ILIKE '%UNIQUE%email%'")
[ "$UNIQ" = "1" ] && ok "usuarios.email unique index" || bad "usuarios.email unique index missing"

echo ""
echo "[4/5] QA seed"
QA=$(q "SELECT activo FROM usuarios WHERE email='${QA_EMAIL}'")
if [ "$QA" = "t" ]; then ok "QA user ${QA_EMAIL} exists and is active"
elif [ -n "$QA" ]; then bad "QA user ${QA_EMAIL} exists but is INACTIVE"
else bad "QA user ${QA_EMAIL} not found — run seed-qa-staging.sh"; fi

echo ""
echo "[5/5] Config drift — SSM QA password vs DB bcrypt hash"
# Catches the "login says Credenciales inválidas but everything looks fine" class:
# the SSM parameter and the DB hash rotated independently.
if [ -z "$QA_PASSWORD" ]; then
    bad "QA_USER_PASSWORD missing in SSM — run seed-qa-staging.sh"
else
    HASH=$(q "SELECT password FROM usuarios WHERE email='${QA_EMAIL}'")
    if [ -z "$HASH" ]; then
        bad "no password hash in DB for ${QA_EMAIL}"
    else
        MATCH=$(cd /opt/miempresa/app && QAPW="$QA_PASSWORD" node -e \
            "const b=require('bcryptjs');console.log(b.compareSync(process.env.QAPW, process.argv[1]))" "$HASH" 2>/dev/null)
        [ "$MATCH" = "true" ] && ok "SSM password verifies against DB hash (no drift)" \
            || bad "SSM password does NOT match DB hash — re-run seed-qa-staging.sh to resync"
    fi
fi

echo ""
echo "=========================================="
echo "DB QA result: ${PASS} passed / ${FAIL} failed"
echo "=========================================="
exit $FAIL
REMOTE
