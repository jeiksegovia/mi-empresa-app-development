#!/bin/bash

# Script to create AWS Systems Manager Parameter Store parameters for FOIA API
# Usage: ./create-ssm-params.sh [environment] [aws-profile] [aws-region]
# Example: ./create-ssm-params.sh local default us-east-1
# Example: ./create-ssm-params.sh dev default us-east-1
# Example: ./create-ssm-params.sh stg default us-east-1
# Example: ./create-ssm-params.sh prod default us-east-1
# Example: ./create-ssm-params.sh whitelabelenv default us-east-1

set -e

# Configuration
ENVIRONMENT="${1:-stg}"
AWS_PROFILE="${2:-default}"
AWS_REGION="${3:-us-east-1}"

# Validate environment is provided
if [ -z "$ENVIRONMENT" ]; then
  echo "✗ Error: Environment is required"
  echo "Usage: ./create-ssm-params.sh [environment] [aws-profile] [aws-region]"
  echo "Supported environments: local, dev, stg, prod, or any custom string"
  exit 1
fi

echo "=========================================="
echo "Creating SSM Parameters"
echo "Environment: $ENVIRONMENT"
echo "AWS Profile: $AWS_PROFILE"
echo "AWS Region: $AWS_REGION"
echo "=========================================="

# Function to create or update SSM parameter
create_param() {
  local param_name=$1
  local param_value=$2
  local param_type="${3:-String}"
  
  echo "Creating parameter: $param_name"
  
  aws ssm put-parameter \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --name "$param_name" \
    --value "$param_value" \
    --type "$param_type" \
    --overwrite \
    --no-cli-pager \
    2>&1 | grep -v "^$" || true
    
  if [ $? -eq 0 ]; then
    echo "✓ Successfully created/updated: $param_name"
  else
    echo "✗ Failed to create: $param_name"
  fi
  echo ""
}

# Function to retrieve database password from parameter store
get_db_password() {
  local db_param_name=$1
  echo "Retrieving database password from: $db_param_name"
  
  DB_PASSWORD=$(aws ssm get-parameter \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --name "$db_param_name" \
    --with-decryption \
    --query "Parameter.Value" \
    --output text)
  
  if [ -z "$DB_PASSWORD" ]; then
    echo "✗ Failed to retrieve database password from $db_param_name"
    exit 1
  fi
  
  echo "✓ Successfully retrieved database password"
  echo ""
}

# Retrieve database password for the environment
if [ "$ENVIRONMENT" = "local" ]; then
  # Local development - no password retrieval needed
  echo "Note: Using local database configuration"
  DATABASE_URL="postgresql://postgres:postgres@localhost:15432/foia?schema=public"
  
  # Local-specific bucket names (can use dev buckets)
  HS_INPUT_BUCKET="foia-dev-public-requests"
  HS_OUTPUT_BUCKET="foia-dev-internal-data"
  
else
  # All remote environments (dev, stg, prod, custom) use the same logic
  get_db_password "/foia/${ENVIRONMENT}/rds/master_password"
  
  DB_USER="foia_admin"
  DB_HOST="foia-${ENVIRONMENT}-db.ccnaweyculay.us-east-1.rds.amazonaws.com"
  DB_PORT="5432"
  DB_NAME="foia_${ENVIRONMENT}_db"
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public&sslmode=prefer&uselibpqcompat=true"
  
  # Environment-specific bucket names
  HS_INPUT_BUCKET="foia-${ENVIRONMENT}-public-requests"
  HS_OUTPUT_BUCKET="foia-${ENVIRONMENT}-internal-data"
fi

# API Configuration Parameters
echo "Creating API configuration parameters..."
create_param "/foia/${ENVIRONMENT}/api/DATABASE_URL" "$DATABASE_URL" "SecureString"
create_param "/foia/${ENVIRONMENT}/api/JWT_SECRET" "change_me_in_prod" "SecureString"
create_param "/foia/${ENVIRONMENT}/api/JWT_EXPIRES_IN" "24h"
create_param "/foia/${ENVIRONMENT}/api/FILE_UPLOAD_DIR" "public/uploads"
create_param "/foia/${ENVIRONMENT}/api/MAX_FILE_SIZE_MB" "20"
create_param "/foia/${ENVIRONMENT}/api/ALLOWED_ORIGINS" "https://stg.d1menqz1x3blvj.amplifyapp.com,https://stg.d2w8r0ujokc9u8.amplifyapp.com,http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:5173"
create_param "/foia/${ENVIRONMENT}/api/AWS_S3_BUCKET" "$HS_OUTPUT_BUCKET"

# Hyperscience Configuration Parameters
echo "Creating Hyperscience parameters..."
create_param "/foia/${ENVIRONMENT}/hyperscience/HS_HOST" "https://hsaws01.anacomp.com"
create_param "/foia/${ENVIRONMENT}/hyperscience/HS_CLIENT_ID" "changeme"
create_param "/foia/${ENVIRONMENT}/hyperscience/HS_CLIENT_SECRET" "changeme" "SecureString"
create_param "/foia/${ENVIRONMENT}/hyperscience/HS_FLOW_DEFAULT" "ACME_FOIA_DEMO_FLOW"
create_param "/foia/${ENVIRONMENT}/hyperscience/HS_INPUT_BUCKET" "$HS_INPUT_BUCKET"
create_param "/foia/${ENVIRONMENT}/hyperscience/HS_OUTPUT_BUCKET" "$HS_OUTPUT_BUCKET"
create_param "/foia/${ENVIRONMENT}/hyperscience/HS_API_TIMEOUT_MS" "60000"
create_param "/foia/${ENVIRONMENT}/hyperscience/REDACTION_MAX_FILE_MB" "200"

# Services API Configuration Parameters
echo "Creating Services API parameters..."
create_param "/foia/${ENVIRONMENT}/services/HS_TOKEN" "46e3fd2d30623d6f510797a3dc282c02ac68c0a1" "SecureString"
create_param "/foia/${ENVIRONMENT}/services/SERVICES_API_KEY" "change_me_in_prod" "SecureString"
create_param "/foia/${ENVIRONMENT}/services/SERVICES_ALLOWED_IPS" " "

echo "=========================================="
echo "All parameters created successfully!"
echo "=========================================="
echo ""
echo "To verify, run:"
echo "aws ssm get-parameters-by-path --profile $AWS_PROFILE --region $AWS_REGION --path /foia/${ENVIRONMENT} --recursive"
