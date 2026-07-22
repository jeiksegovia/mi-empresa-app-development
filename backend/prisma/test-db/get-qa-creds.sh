#!/bin/bash
set -e

# ============================================================================
# Print the Stage QA Login Credentials (fixes-jul17-2 §2)
# ============================================================================
# Deployed stages do NOT have the local dev users (admin@miempresa.com etc.
# from prisma/seed.ts) — by design, so no weak known password is live on a
# public API. Manual logins use the dedicated QA users stored in SSM.
#
# Usage:
#   ./get-qa-creds.sh [--stage staging] [--profile disruptive] [--region us-east-1]
#
# Outputs 3 profiles in order:
#   1. qa-admin       (ADMIN,        tipoEmpleado=null)
#   2. qa-gerontologa (EMPLEADO,     tipoEmpleado=GERONTOLOGA)
#   3. qa-contratos   (EMPLEADO,     tipoEmpleado=CONTRATOS)
# ============================================================================

STAGE="staging"
REGION="us-east-1"
PROFILE="disruptive"
PROJECT_NAME="miempresa"

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)   STAGE="$2";   shift 2 ;;
        --region)  REGION="$2";  shift 2 ;;
        --profile) PROFILE="$2"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

AWS=(aws --profile "$PROFILE")

# Reuse the same 3-profile config as seed-qa-staging.sh
PROFILES=(
  "qa-admin|ADMIN|null"
  "qa-gerontologa|EMPLEADO|GERONTOLOGA"
  "qa-contratos|EMPLEADO|CONTRATOS"
)

# Get the app URL once.
APP_URL=$("${AWS[@]}" ssm get-parameter --name "/${PROJECT_NAME}/${STAGE}/frontend/APP_URL" \
    --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")

echo "Stage:    ${STAGE}"
echo "Login at: ${APP_URL:-<frontend not deployed>}/login"
echo ""
echo "(Use the custom domain only — *.amplifyapp.com is cross-site and login will fail)"
echo ""

for entry in "${PROFILES[@]}"; do
    IFS='|' read -r SSM_NAME ROL TIPO <<< "$entry"
    EMAIL=$("${AWS[@]}" ssm get-parameter --name "/${PROJECT_NAME}/${STAGE}/qa/${SSM_NAME}/EMAIL" \
        --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "<missing>")
    PASSWORD=$("${AWS[@]}" ssm get-parameter --name "/${PROJECT_NAME}/${STAGE}/qa/${SSM_NAME}/PASSWORD" \
        --with-decryption --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "<missing>")
    echo "── ${SSM_NAME} (${ROL}, tipoEmpleado=${TIPO})"
    echo "   Email:    ${EMAIL}"
    echo "   Password: ${PASSWORD}"
    echo ""
done
