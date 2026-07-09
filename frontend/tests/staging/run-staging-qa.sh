#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Frontend Tier QA Runner — Staging browser smoke tests
# ============================================================================
# Fetches the stage URL + QA credentials from SSM, then runs the Playwright
# staging spec in a real browser against the deployed Amplify site.
#
# Usage:
#   ./run-staging-qa.sh [--stage staging] [--profile disruptive] [--region us-east-1]
# ============================================================================

STAGE="staging"
REGION="us-east-1"
PROFILE=""
PROJECT_NAME="miempresa"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

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

export TEST_FRONTEND_URL=$(get_param "/${PROJECT_NAME}/${STAGE}/frontend/APP_URL")
export QA_USER_EMAIL=$(get_param "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_EMAIL")
export QA_USER_PASSWORD=$(get_param "/${PROJECT_NAME}/${STAGE}/qa/QA_USER_PASSWORD")

if [ -z "$QA_USER_PASSWORD" ] || [ -z "$TEST_FRONTEND_URL" ]; then
    echo "ERROR: SSM config missing — need /${PROJECT_NAME}/${STAGE}/frontend/APP_URL and qa/* params" >&2
    exit 1
fi

echo "Frontend QA against: ${TEST_FRONTEND_URL} (stage: ${STAGE}, user: ${QA_USER_EMAIL})"
cd "$FRONTEND_DIR"
npx playwright test tests/staging --reporter=list
