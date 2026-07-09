#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Backend Tier QA Runner — Staging API smoke tests
# ============================================================================
# Fetches the stage URLs + QA credentials from SSM, then runs the Playwright
# staging spec against the deployed API (through CloudFront).
#
# Usage:
#   ./run-staging-qa.sh [--stage staging] [--profile disruptive] [--region us-east-1]
# ============================================================================

STAGE="staging"
REGION="us-east-1"
PROFILE=""
PROJECT_NAME="miempresa"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)   STAGE="$2";   shift 2 ;;
        --region)  REGION="$2";  shift 2 ;;
        --profile) PROFILE="$2"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

AWS=(aws)
[ -n "$PROFILE" ] && AWS=(aws --profile "$PROFILE")

get_param() {
    "${AWS[@]}" ssm get-parameter --name "$1" --with-decryption \
        --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo ""
}

API_BASE_FULL=$(get_param "/${PROJECT_NAME}/${STAGE}/frontend/API_BASE")   # includes /api/v1
export TEST_API_URL="${API_BASE_FULL%/api/v1}"
export TEST_FRONTEND_URL=$(get_param "/${PROJECT_NAME}/${STAGE}/frontend/APP_URL")
export QA_USER_EMAIL=$(get_param "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_EMAIL")
export QA_USER_PASSWORD=$(get_param "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_PASSWORD")
# Stage policy: are the well-known dev users deliberately enabled here?
export DEV_USERS_ENABLED=$(get_param "/${PROJECT_NAME}/${STAGE}/qa/DEV_USERS_ENABLED")

if [ -z "$QA_USER_PASSWORD" ]; then
    echo "ERROR: QA credentials missing in SSM — run prisma/test-db/seed-qa-staging.sh first" >&2
    exit 1
fi

echo "Backend QA against: ${TEST_API_URL} (stage: ${STAGE}, user: ${QA_USER_EMAIL})"
cd "$BACKEND_DIR"
npx playwright test tests/staging --reporter=list
