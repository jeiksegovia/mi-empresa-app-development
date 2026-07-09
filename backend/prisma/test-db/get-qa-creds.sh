#!/bin/bash
set -e

# ============================================================================
# Print the Stage QA Login Credentials (for manual browser testing)
# ============================================================================
# Deployed stages do NOT have the local dev users (admin@miempresa.com etc.
# from prisma/seed.ts) — by design, so no weak known password is live on a
# public API. Manual logins use the dedicated QA user stored in SSM.
#
# Usage:
#   ./get-qa-creds.sh [--stage staging] [--profile disruptive] [--region us-east-1]
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

EMAIL=$("${AWS[@]}" ssm get-parameter --name "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_EMAIL" \
    --region "$REGION" --query "Parameter.Value" --output text)
PASSWORD=$("${AWS[@]}" ssm get-parameter --name "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_PASSWORD" \
    --with-decryption --region "$REGION" --query "Parameter.Value" --output text)
APP_URL=$("${AWS[@]}" ssm get-parameter --name "/${PROJECT_NAME}/${STAGE}/frontend/APP_URL" \
    --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")

echo "Stage:    ${STAGE}"
echo "Login at: ${APP_URL:-<frontend not deployed>}/login"
echo "Email:    ${EMAIL}"
echo "Password: ${PASSWORD}"
echo ""
echo "(Use the custom domain only — *.amplifyapp.com is cross-site and login will fail)"
