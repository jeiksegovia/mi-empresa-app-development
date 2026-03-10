#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Deploy Infrastructure Using CloudFormation
# ============================================================================
# This script deploys all CloudFormation stacks for Mi Empresa backend.
#
# Usage:
#   ./deploy-infrastructure.sh [--environment dev|prod] [--region us-east-1]
#
# What this deploys:
#   1. IAM Stack - Roles, policies, bootstrap user
#   2. SSM Parameters Stack - Environment variables
#   3. CodeDeploy Stack - Application and deployment groups
#
# Prerequisites:
#   - AWS CLI v2 configured with appropriate permissions
#   - CloudFormation permissions
# ============================================================================

ENVIRONMENT="dev"
REGION="us-east-1"
PROJECT_NAME="miempresa"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFN_DIR="${SCRIPT_DIR}/../cloudformation"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# Parse Arguments
# ============================================================================
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|--stage)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --help)
            cat <<EOF
Usage: $0 [OPTIONS]

Deploy CloudFormation stacks for Mi Empresa backend infrastructure.

Options:
  --environment ENV    Environment name (dev or prod) [default: dev]
  --region REGION      AWS region [default: us-east-1]
  --help              Show this help message

Examples:
  # Deploy dev environment
  $0 --environment dev

  # Deploy prod environment
  $0 --environment prod --region us-east-1
EOF
            exit 0
            ;;
        *)
            log_error "Unknown argument: $1"
            exit 1
            ;;
    esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
    log_error "Environment must be 'dev' or 'prod'"
    exit 1
fi

log_info "Deployment Configuration"
echo "  Environment: ${ENVIRONMENT}"
echo "  Region: ${REGION}"
echo "  Project: ${PROJECT_NAME}"
echo ""

# ============================================================================
# Deploy IAM Stack
# ============================================================================
log_info "Deploying IAM Stack..."

IAM_STACK_NAME="${PROJECT_NAME}-iam"

aws cloudformation deploy \
    --template-file "${CFN_DIR}/iam-stack.yml" \
    --stack-name "${IAM_STACK_NAME}" \
    --parameter-overrides \
        ProjectName="${PROJECT_NAME}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "${REGION}" \
    --tags \
        Project="${PROJECT_NAME}" \
        Environment=global \
        ManagedBy=CloudFormation

if [ $? -eq 0 ]; then
    log_info "✓ IAM Stack deployed successfully"
else
    log_error "IAM Stack deployment failed"
    exit 1
fi

# Get outputs from IAM stack
ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name "${IAM_STACK_NAME}" \
    --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='CodeDeployInstanceRoleArn'].OutputValue" \
    --output text)

BOOTSTRAP_USER=$(aws cloudformation describe-stacks \
    --stack-name "${IAM_STACK_NAME}" \
    --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='BootstrapUserName'].OutputValue" \
    --output text)

log_info "  Role ARN: ${ROLE_ARN}"
log_info "  Bootstrap User: ${BOOTSTRAP_USER}"
echo ""

# ============================================================================
# Configure AWS CLI Bootstrap Profile
# ============================================================================
log_info "Configuring AWS CLI bootstrap profile..."

BOOTSTRAP_ACCESS_KEY=$(aws ssm get-parameter \
    --name "/${PROJECT_NAME}/bootstrap/access-key-id" \
    --region "${REGION}" \
    --query "Parameter.Value" \
    --output text)

BOOTSTRAP_SECRET_KEY=$(aws ssm get-parameter \
    --name "/${PROJECT_NAME}/bootstrap/secret-access-key" \
    --with-decryption \
    --region "${REGION}" \
    --query "Parameter.Value" \
    --output text)

aws configure set aws_access_key_id "${BOOTSTRAP_ACCESS_KEY}" --profile bootstrap
aws configure set aws_secret_access_key "${BOOTSTRAP_SECRET_KEY}" --profile bootstrap
aws configure set region "${REGION}" --profile bootstrap
aws configure set output json --profile bootstrap

log_info "✓ Bootstrap profile configured"
echo ""

# ============================================================================
# Deploy SSM Parameters Stack
# ============================================================================
log_info "Deploying SSM Parameters Stack for ${ENVIRONMENT}..."

SSM_STACK_NAME="${PROJECT_NAME}-ssm-${ENVIRONMENT}"

# Set environment-specific parameters
if [ "$ENVIRONMENT" == "dev" ]; then
    CORS_ORIGIN="http://localhost:3000"
    LOG_LEVEL="debug"
else
    CORS_ORIGIN="https://app.miempresa.com"
    LOG_LEVEL="info"
fi

aws cloudformation deploy \
    --template-file "${CFN_DIR}/ssm-parameters-stack.yml" \
    --stack-name "${SSM_STACK_NAME}" \
    --parameter-overrides \
        Environment="${ENVIRONMENT}" \
        ProjectName="${PROJECT_NAME}" \
        CorsOrigin="${CORS_ORIGIN}" \
        LogLevel="${LOG_LEVEL}" \
    --region "${REGION}" \
    --tags \
        Project="${PROJECT_NAME}" \
        Environment="${ENVIRONMENT}" \
        ManagedBy=CloudFormation

if [ $? -eq 0 ]; then
    log_info "✓ SSM Parameters Stack deployed successfully"
else
    log_error "SSM Parameters Stack deployment failed"
    exit 1
fi

echo ""

# ============================================================================
# Deploy CodeDeploy Stack (Once for all environments)
# ============================================================================
log_info "Deploying CodeDeploy Stack..."

CODEDEPLOY_STACK_NAME="${PROJECT_NAME}-codedeploy"

# Check if stack already exists
if aws cloudformation describe-stacks \
    --stack-name "${CODEDEPLOY_STACK_NAME}" \
    --region "${REGION}" &> /dev/null; then
    log_info "CodeDeploy stack already exists, skipping..."
else
    aws cloudformation deploy \
        --template-file "${CFN_DIR}/codedeploy-stack.yml" \
        --stack-name "${CODEDEPLOY_STACK_NAME}" \
        --parameter-overrides \
            ProjectName="${PROJECT_NAME}" \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "${REGION}" \
        --tags \
            Project="${PROJECT_NAME}" \
            Environment=global \
            ManagedBy=CloudFormation

    if [ $? -eq 0 ]; then
        log_info "✓ CodeDeploy Stack deployed successfully"
    else
        log_error "CodeDeploy Stack deployment failed"
        exit 1
    fi
fi

echo ""

# ============================================================================
# Display Deployment Summary
# ============================================================================
log_info "Deployment Summary"
echo ""
echo "Stacks Deployed:"
echo "  1. ${IAM_STACK_NAME}"
echo "  2. ${SSM_STACK_NAME}"
echo "  3. ${CODEDEPLOY_STACK_NAME}"
echo ""
echo "IAM Resources:"
echo "  Role: CodeDeployInstanceRole"
echo "  User: ${BOOTSTRAP_USER}"
echo "  Profile: bootstrap (configured in ~/.aws/credentials)"
echo ""
echo "SSM Parameters:"
echo "  Path: /${PROJECT_NAME}/${ENVIRONMENT}/*"
echo "  Count: ~20 parameters"
echo ""
echo "CodeDeploy Application:"
echo "  Name: ${PROJECT_NAME}-app"
echo "  Deployment Groups: ${PROJECT_NAME}-dev, ${PROJECT_NAME}-prod"
echo ""
echo "Next Steps:"
echo "  1. Create Lightsail instance:"
echo "     ./create-instance.sh --stage ${ENVIRONMENT}"
echo ""
echo "  2. Register instance with CodeDeploy:"
echo "     aws deploy register-on-premises-instance \\"
echo "       --instance-name ${PROJECT_NAME}-db-${ENVIRONMENT}-1"
echo ""
echo "  3. Deploy application"
echo ""
echo "=========================================="
