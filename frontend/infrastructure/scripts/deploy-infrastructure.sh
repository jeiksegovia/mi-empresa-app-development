#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Deploy Frontend Infrastructure (CloudFormation)
# ============================================================================
# Creates the per-stage Amplify hosting stack:
#   miempresa-frontend-<stage>: Amplify app (manual deploys) + branch +
#   custom-domain association + artifacts bucket + SSM config params
#
# Usage:
#   ./deploy-infrastructure.sh --stage <staging|prod> [--region us-east-1] [--profile disruptive]
#
# After this, publish builds with: ./deploy-frontend.sh --stage <stage>
# ============================================================================

STAGE="staging"
REGION="us-east-1"
PROFILE=""
PROJECT_NAME="miempresa"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFN_DIR="${SCRIPT_DIR}/../cloudformation"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)   STAGE="$2";   shift 2 ;;
        --region)  REGION="$2";  shift 2 ;;
        --profile) PROFILE="$2"; shift 2 ;;
        --help)
            echo "Usage: $0 --stage <staging|prod> [--region us-east-1] [--profile PROFILE]"
            exit 0 ;;
        *) log_error "Unknown argument: $1"; exit 1 ;;
    esac
done

if [[ "$STAGE" != "staging" && "$STAGE" != "prod" ]]; then
    log_error "Stage must be 'staging' or 'prod'"
    exit 1
fi

AWS=(aws)
[ -n "$PROFILE" ] && AWS=(aws --profile "$PROFILE")

STACK_NAME="${PROJECT_NAME}-frontend-${STAGE}"

log_info "Deploying ${STACK_NAME} (${REGION})..."

"${AWS[@]}" cloudformation deploy \
    --template-file "${CFN_DIR}/amplify-stack.yml" \
    --stack-name "${STACK_NAME}" \
    --parameter-overrides ProjectName="${PROJECT_NAME}" Environment="${STAGE}" \
    --region "${REGION}" \
    --no-fail-on-empty-changeset \
    --tags Project="${PROJECT_NAME}" Environment="${STAGE}" ManagedBy=CloudFormation Component=Frontend

log_info "✓ Stack deployed"
echo ""
log_info "Stack outputs:"
"${AWS[@]}" cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" --region "${REGION}" \
    --query "Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue}" --output table

echo ""
echo "Next steps:"
echo "  1. Publish a build:  ./deploy-frontend.sh --stage ${STAGE}${PROFILE:+ --profile ${PROFILE}}"
echo "  2. Domain cert issuance takes a few minutes; check:"
echo "     aws amplify get-domain-association --app-id <AppId> --domain-name disruptiveexp.com${PROFILE:+ --profile ${PROFILE}}"
