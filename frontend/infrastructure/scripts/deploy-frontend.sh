#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Build & Publish the Frontend to Amplify (manual deploy, no Git)
# ============================================================================
# Steps:
#   1. Read the stage's API base URL from SSM  (/miempresa/<stage>/frontend/API_BASE)
#   2. nuxt generate with NUXT_PUBLIC_API_BASE baked into the static bundle
#   3. Zip the CONTENTS of .output/public (zipping the folder itself breaks
#      the site root — documented Amplify requirement)
#   4. Upload the zip to the frontend artifacts bucket (release history)
#   5. aws amplify start-deployment from S3; if the S3 path is rejected
#      (ACL edge cases), fall back to create-deployment + presigned upload
#   6. Poll the job until SUCCEED
#
# Usage:
#   ./deploy-frontend.sh --stage <staging|prod> [--region us-east-1] [--profile disruptive] [--skip-install]
# ============================================================================

STAGE="staging"
REGION="us-east-1"
PROFILE=""
SKIP_INSTALL=false
PROJECT_NAME="miempresa"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)        STAGE="$2";   shift 2 ;;
        --region)       REGION="$2";  shift 2 ;;
        --profile)      PROFILE="$2"; shift 2 ;;
        --skip-install) SKIP_INSTALL=true; shift ;;
        --help)
            echo "Usage: $0 --stage <staging|prod> [--region us-east-1] [--profile PROFILE] [--skip-install]"
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

# ============================================================================
# Resolve stack outputs + stage config
# ============================================================================

log_info "Resolving Amplify app for stage '${STAGE}'..."

APP_ID=$("${AWS[@]}" cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='AmplifyAppId'].OutputValue" --output text)

BUCKET=$("${AWS[@]}" cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='ArtifactsBucketName'].OutputValue" --output text)

APP_URL=$("${AWS[@]}" cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='AppUrl'].OutputValue" --output text)

if [ -z "$APP_ID" ] || [ "$APP_ID" == "None" ]; then
    log_error "Stack ${STACK_NAME} not found. Run deploy-infrastructure.sh first."
    exit 1
fi

API_BASE=$("${AWS[@]}" ssm get-parameter \
    --name "/${PROJECT_NAME}/${STAGE}/frontend/API_BASE" \
    --region "${REGION}" --query "Parameter.Value" --output text)

log_info "  App ID: ${APP_ID}"
log_info "  Branch: ${STAGE}"
log_info "  API base (baked into build): ${API_BASE}"
echo ""

# ============================================================================
# Build
# ============================================================================

cd "$FRONTEND_DIR"

if [ "$SKIP_INSTALL" = false ] && [ ! -d node_modules ]; then
    log_info "Installing dependencies (npm ci)..."
    npm ci
fi

log_info "Building static site (nuxt generate)..."
NUXT_PUBLIC_API_BASE="$API_BASE" npx nuxt generate

if [ ! -f .output/public/index.html ]; then
    log_error "Build output missing (.output/public/index.html)"
    exit 1
fi
log_info "✓ Build complete: $(du -sh .output/public | cut -f1)"
echo ""

# ============================================================================
# Package — zip the CONTENTS of .output/public, not the folder
# ============================================================================

RELEASE="$(date +%Y%m%d-%H%M%S)"
ZIP_PATH="/tmp/${PROJECT_NAME}-frontend-${STAGE}-${RELEASE}.zip"

log_info "Packaging ${ZIP_PATH}..."
(cd .output/public && zip -qr "$ZIP_PATH" .)
log_info "✓ Zip: $(du -sh "$ZIP_PATH" | cut -f1)"

# ============================================================================
# Upload to artifacts bucket (release history / audit trail)
# ============================================================================

S3_KEY="releases/${RELEASE}.zip"
log_info "Uploading to s3://${BUCKET}/${S3_KEY}..."
"${AWS[@]}" s3 cp "$ZIP_PATH" "s3://${BUCKET}/${S3_KEY}" --no-progress
echo ""

# ============================================================================
# Start deployment (S3 source, presigned-upload fallback)
# ============================================================================

log_info "Starting Amplify deployment..."

JOB_ID=$("${AWS[@]}" amplify start-deployment \
    --app-id "$APP_ID" \
    --branch-name "$STAGE" \
    --source-url "s3://${BUCKET}/${S3_KEY}" \
    --region "$REGION" \
    --query "jobSummary.jobId" --output text 2>/dev/null || echo "")

if [ -z "$JOB_ID" ]; then
    log_warn "S3-sourced deployment rejected — falling back to presigned upload..."
    CREATE_OUT=$("${AWS[@]}" amplify create-deployment \
        --app-id "$APP_ID" --branch-name "$STAGE" --region "$REGION" --output json)
    JOB_ID=$(echo "$CREATE_OUT" | jq -r '.jobId')
    UPLOAD_URL=$(echo "$CREATE_OUT" | jq -r '.zipUploadUrl')
    curl -sf -T "$ZIP_PATH" "$UPLOAD_URL"
    "${AWS[@]}" amplify start-deployment \
        --app-id "$APP_ID" --branch-name "$STAGE" --job-id "$JOB_ID" \
        --region "$REGION" > /dev/null
fi

log_info "  Job ID: ${JOB_ID}"

# ============================================================================
# Poll until SUCCEED
# ============================================================================

for i in $(seq 1 30); do
    STATUS=$("${AWS[@]}" amplify get-job \
        --app-id "$APP_ID" --branch-name "$STAGE" --job-id "$JOB_ID" \
        --region "$REGION" --query "job.summary.status" --output text)
    case "$STATUS" in
        SUCCEED)
            echo ""
            log_info "✓ Deployment SUCCEED"
            echo ""
            echo "  Custom domain:  ${APP_URL}"
            echo "  Default domain: https://${STAGE}.$("${AWS[@]}" amplify get-app --app-id "$APP_ID" --region "$REGION" --query "app.defaultDomain" --output text)"
            exit 0 ;;
        FAILED|CANCELLED)
            log_error "Deployment ${STATUS}"
            "${AWS[@]}" amplify get-job --app-id "$APP_ID" --branch-name "$STAGE" --job-id "$JOB_ID" \
                --region "$REGION" --query "job.steps" --output json
            exit 1 ;;
        *) echo -n "."; sleep 10 ;;
    esac
done

log_error "Timeout waiting for deployment job ${JOB_ID}"
exit 1
