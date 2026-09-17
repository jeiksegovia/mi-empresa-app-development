#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Deploy Infrastructure Using CloudFormation (v2)
# ============================================================================
# Deploys the foundation stacks for the Mi Empresa backend:
#   1. miempresa-iam            - Roles, policies, bootstrap user (global)
#   2. miempresa-s3-<stage>     - Artifacts, backups, uploads buckets
#   3. miempresa-ssm-<stage>    - Environment variables + secrets
#   4. miempresa-codedeploy     - CodeDeploy application & groups (global)
#
# The edge stack (DNS + TLS via CloudFront/ACM) is deployed separately AFTER
# the Lightsail instance exists — it needs the static IP. See create-instance.sh.
#
# Usage:
#   ./deploy-infrastructure.sh --stage <staging|prod> [--region us-east-1] [--profile disruptive]
# ============================================================================

STAGE="staging"
REGION="us-east-1"
PROFILE=""
PROJECT_NAME="miempresa"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFN_DIR="${SCRIPT_DIR}/../cloudformation"

# ----------------------------------------------------------------------------
# DEV-only CORS allowlist for the uploads bucket.
#
# STAGE=dev ⇒ the bucket is used by LOCAL testing (see s3-stack.yml header).
# Every frontend origin that signs/uses presigned URLs against this bucket
# MUST appear here, otherwise the browser preflight (OPTIONS) returns
# CORS 403 and uploads fail silently in the UI.
#
# Origin sources:
#   * localhost variants — for `npm run dev` on the engineer's machine.
#   * WireGuard / LAN IPs — when developers run the frontend on a remote
#     machine (e.g. dev VM, Tailscale node) and still hit the dev bucket.
#   * The staging hostname is intentionally included: a localhost frontend
#     that proxies through a staging-domain reverse proxy (e.g. via the
#     CodeDeploy app) will see that origin in the browser. Keeping it
#     here avoids surprise 403s during local QA against staging.
#
# INVARIANT — keep this in sync with:
#   * frontend/app.config.ts        (NUXT_PUBLIC_API_BASE, allowedOrigins)
#   * backend/src/config/env.ts     (CORS_ORIGIN, allowedOrigins)
#   * any `.env` files referencing the API base URL
# If a new dev host shows up, add it HERE (and to the staging bucket's
# allowlist via the same mechanism) before merging the frontend change.
# ----------------------------------------------------------------------------
DEV_LOCAL_ORIGINS="https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102,http://100.85.193.33:3100,http://10.57.126.228:3100"

# ----------------------------------------------------------------------------
# Single source of truth for the public domains, mirroring the exact IsProd
# branching in cloudformation/edge-stack.yml and cloudformation/amplify-stack.yml
# (RootDomain default 'disruptiveexp.com' in both templates; prod gets NO
# suffix, staging gets '-stg'). Keep these two literals in sync with those
# templates if the domain scheme ever changes.
# ----------------------------------------------------------------------------
ROOT_DOMAIN="disruptiveexp.com"
STAGING_FRONTEND_URL="https://miempresa-stg.${ROOT_DOMAIN}"
PROD_FRONTEND_URL="https://miempresa.${ROOT_DOMAIN}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|--stage) STAGE="$2";   shift 2 ;;
        --region)              REGION="$2";  shift 2 ;;
        --profile)             PROFILE="$2"; shift 2 ;;
        --help)
            cat <<EOF
Usage: $0 --stage <staging|prod> [OPTIONS]

Options:
  --stage STAGE        Environment (staging or prod) [default: staging]
  --region REGION      AWS region [default: us-east-1]
  --profile PROFILE    AWS CLI profile (e.g. disruptive)
  --help               Show this help
EOF
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

log_info "Deployment Configuration"
echo "  Stage: ${STAGE}"
echo "  Region: ${REGION}"
echo "  Project: ${PROJECT_NAME}"
echo "  Profile: ${PROFILE:-default}"
echo ""

# ============================================================================
# Helper: fetch an SSM parameter value, empty string if missing
# ============================================================================
get_param() {
    "${AWS[@]}" ssm get-parameter --name "$1" --with-decryption \
        --region "${REGION}" --query "Parameter.Value" --output text 2>/dev/null || echo ""
}

# ============================================================================
# Helper: resolve the AWS-managed `alias/aws/ssm` KMS key to its key ARN.
# CFN cannot resolve KMS aliases at template render time, so we look it up
# once and pass the resolved ARN to the IAM stack via parameter override.
# Failure is non-fatal here — the operator will get an explicit error from
# cfn-lint/cfn when the IAM stack is deployed with an empty SSMKMSKeyArn.
# ============================================================================
resolve_ssm_kms_arn() {
    "${AWS[@]}" kms describe-key \
        --key-id alias/aws/ssm \
        --region "${REGION}" \
        --query 'KeyMetadata.Arn' \
        --output text 2>/dev/null || echo ""
}

# ============================================================================
# 1. IAM Stack (global, env-INDEPENDENT — decision 02)
# ============================================================================
# Decision 02: the iam-stack template statically declares BOTH staging and prod
# scoped identities (per-env roles, policies, bootstrap users, keys, SSM) PLUS
# the legacy wildcard role + legacy bootstrap user kept during the additive
# migration. There is NO `Environment` parameter on the IAM stack — a
# per-stage deploy of this script is a no-op for IAM after the first run.
# Both scoped identities coexist from day one; each INSTANCE migrates to its
# own identity at its own time (staging via #8, prod via #10).
# ============================================================================
log_info "Deploying IAM Stack (env-independent, decision 02)..."

IAM_STACK_NAME="${PROJECT_NAME}-iam"
SSM_KMS_ARN=$(resolve_ssm_kms_arn)
if [ -z "$SSM_KMS_ARN" ]; then
    log_error "Could not resolve KMS key ARN for alias/aws/ssm in ${REGION}."
    log_error "Run: aws kms describe-key --key-id alias/aws/ssm --region ${REGION}"
    exit 1
fi
log_info "  KMS key for SSM: ${SSM_KMS_ARN}"

"${AWS[@]}" cloudformation deploy \
    --template-file "${CFN_DIR}/iam-stack.yml" \
    --stack-name "${IAM_STACK_NAME}" \
    --parameter-overrides \
        ProjectName="${PROJECT_NAME}" \
        SSMKMSKeyArn="${SSM_KMS_ARN}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "${REGION}" \
    --no-fail-on-empty-changeset \
    --tags Project="${PROJECT_NAME}" Environment=global ManagedBy=CloudFormation

log_info "✓ IAM Stack deployed (BOTH staging + prod scoped identities now coexist)"

ROLE_ARN=$("${AWS[@]}" cloudformation describe-stacks \
    --stack-name "${IAM_STACK_NAME}" --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='CodeDeployInstanceRoleArn'].OutputValue" --output text)
SCOPED_ROLE_ARN=$("${AWS[@]}" cloudformation describe-stacks \
    --stack-name "${IAM_STACK_NAME}" --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='ScopedInstanceRoleArn${STAGE^}'].OutputValue" --output text)
SCOPED_BOOTSTRAP_ARN=$("${AWS[@]}" cloudformation describe-stacks \
    --stack-name "${IAM_STACK_NAME}" --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='ScopedBootstrapUserArn${STAGE^}'].OutputValue" --output text)
log_info "  Legacy Role ARN:                            ${ROLE_ARN}"
log_info "  Scoped Role ARN (${STAGE}):                 ${SCOPED_ROLE_ARN}"
log_info "  Scoped Bootstrap User ARN (${STAGE}):       ${SCOPED_BOOTSTRAP_ARN}"
echo ""

# ============================================================================
# 2. Configure local 'bootstrap' AWS profile (used by admins for debugging;
#    create-instance.sh pushes the same keys to the instance)
# ============================================================================
log_info "Configuring local AWS CLI bootstrap profile..."

BOOTSTRAP_ACCESS_KEY=$(get_param "/${PROJECT_NAME}/bootstrap/access-key-id")
BOOTSTRAP_SECRET_KEY=$(get_param "/${PROJECT_NAME}/bootstrap/secret-access-key")

if [ -n "$BOOTSTRAP_ACCESS_KEY" ] && [ -n "$BOOTSTRAP_SECRET_KEY" ]; then
    aws configure set aws_access_key_id "${BOOTSTRAP_ACCESS_KEY}" --profile bootstrap
    aws configure set aws_secret_access_key "${BOOTSTRAP_SECRET_KEY}" --profile bootstrap
    aws configure set region "${REGION}" --profile bootstrap
    aws configure set output json --profile bootstrap
    log_info "✓ Local 'bootstrap' profile configured"
else
    log_warn "Bootstrap credentials not found in SSM (unexpected after IAM stack deploy)"
fi
echo ""

# ============================================================================
# 3. S3 Stack (per stage)
# ============================================================================
log_info "Deploying S3 Stack for ${STAGE}..."

# Compose S3 parameter overrides. STAGE=dev gets DEV_LOCAL_ORIGINS (so every
# dev machine origin can PUT/GET against the dev bucket); staging keeps the
# template default (already the staging domain + localhost). prod gets an
# EXPLICIT override — the template default is staging's origin list, which
# would let the staging frontend's presigned uploads hit the prod bucket
# (wrong) and would NOT include the real prod frontend origin (broken CORS).
S3_PARAM_OVERRIDES=(
    ProjectName="${PROJECT_NAME}"
    Environment="${STAGE}"
)
if [ "${STAGE}" = "dev" ]; then
    # CFN CommaDelimitedList params are passed as ONE quoted "Key=Value"
    # string. The commas inside DEV_LOCAL_ORIGINS stay literal — CFN
    # splits the value at deploy time, not the shell.
    S3_PARAM_OVERRIDES+=("UploadsCorsAllowedOrigins=${DEV_LOCAL_ORIGINS}")
    log_info "  S3 uploads CORS (dev override): ${DEV_LOCAL_ORIGINS}"
elif [ "${STAGE}" = "prod" ]; then
    S3_PARAM_OVERRIDES+=("UploadsCorsAllowedOrigins=${PROD_FRONTEND_URL}")
    log_info "  S3 uploads CORS (prod override): ${PROD_FRONTEND_URL}"
fi

"${AWS[@]}" cloudformation deploy \
    --template-file "${CFN_DIR}/s3-stack.yml" \
    --stack-name "${PROJECT_NAME}-s3-${STAGE}" \
    --parameter-overrides "${S3_PARAM_OVERRIDES[@]}" \
    --region "${REGION}" \
    --no-fail-on-empty-changeset \
    --tags Project="${PROJECT_NAME}" Environment="${STAGE}" ManagedBy=CloudFormation

log_info "✓ S3 Stack deployed"
echo ""

# ============================================================================
# 4. SSM Parameters Stack (per stage)
#    Secrets: de-managed per fix-contract §B. JWT_SECRET, SESSION_SECRET,
#    ORIGIN_VERIFY_SECRET are NO LONGER created by this template. They are
#    owned via utilities/set-env.sh --secure as Type: SecureString, which
#    this CFN template cannot create. The 3 first-deploy dance (Retain +
#    remove) is documented in ssm-parameters-stack.yml header.
# ============================================================================
log_info "Deploying SSM Parameters Stack for ${STAGE}..."

SSM_STACK_NAME="${PROJECT_NAME}-ssm-${STAGE}"

if [ "$STAGE" == "staging" ]; then
    CORS_ORIGIN="http://localhost:3000"   # updated once the Amplify frontend URL exists (utilities/set-env.sh)
    LOG_LEVEL="debug"
elif [ "$STAGE" == "prod" ]; then
    # Known in advance (unlike staging) — matches amplify-stack.yml's IsProd
    # AppUrlParameter exactly, so CORS is correct from the first P1 run with
    # no post-hoc set-env.sh fixup needed.
    CORS_ORIGIN="${PROD_FRONTEND_URL}"
    LOG_LEVEL="info"
else
    log_error "Unhandled STAGE '${STAGE}' in CORS_ORIGIN/LOG_LEVEL branch"
    exit 1
fi

"${AWS[@]}" cloudformation deploy \
    --template-file "${CFN_DIR}/ssm-parameters-stack.yml" \
    --stack-name "${SSM_STACK_NAME}" \
    --parameter-overrides \
        Environment="${STAGE}" \
        ProjectName="${PROJECT_NAME}" \
        CorsOrigin="${CORS_ORIGIN}" \
        LogLevel="${LOG_LEVEL}" \
    --region "${REGION}" \
    --no-fail-on-empty-changeset \
    --tags Project="${PROJECT_NAME}" Environment="${STAGE}" ManagedBy=CloudFormation

log_info "✓ SSM Parameters Stack deployed (3 secrets de-managed)"
echo ""

# ============================================================================
# 5. CodeDeploy Stack (global)
# ============================================================================
log_info "Deploying CodeDeploy Stack..."

"${AWS[@]}" cloudformation deploy \
    --template-file "${CFN_DIR}/codedeploy-stack.yml" \
    --stack-name "${PROJECT_NAME}-codedeploy" \
    --parameter-overrides ProjectName="${PROJECT_NAME}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "${REGION}" \
    --no-fail-on-empty-changeset \
    --tags Project="${PROJECT_NAME}" Environment=global ManagedBy=CloudFormation

log_info "✓ CodeDeploy Stack deployed"
echo ""

# ============================================================================
# Summary
# ============================================================================
log_info "Deployment Summary"
echo ""
echo "Stacks Deployed:"
echo "  1. ${IAM_STACK_NAME}"
echo "  2. ${PROJECT_NAME}-s3-${STAGE}"
echo "  3. ${SSM_STACK_NAME}"
echo "  4. ${PROJECT_NAME}-codedeploy"
echo ""
echo "SSM Parameters: /${PROJECT_NAME}/${STAGE}/*"
echo "CodeDeploy: app '${PROJECT_NAME}-app', groups '${PROJECT_NAME}-staging' / '${PROJECT_NAME}-prod'"
echo ""
echo "Next Steps:"
echo "  1. Create the Lightsail instance:"
echo "     ./create-instance.sh --stage ${STAGE}${PROFILE:+ --profile ${PROFILE}}"
echo "  2. First deployment (runbook Phase 3), then edge stack (Phase 4)."
echo ""
echo "=========================================="
