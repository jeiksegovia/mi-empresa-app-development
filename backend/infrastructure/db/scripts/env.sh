#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# Environment Variable Loader - Fetch from SSM Parameter Store
# ============================================================================
# This script fetches environment variables from AWS SSM Parameter Store
# and generates a .env file for the application runtime.
#
# Expected environment variables:
#   - STAGE: Environment stage (dev, prod)
#   - AWS_REGION: AWS region (default: us-east-1)
#
# Usage:
#   export STAGE=dev
#   export AWS_REGION=us-east-1
#   ./env.sh
#
# Output:
#   .env file in current directory
# ============================================================================

STAGE="${STAGE:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "[$(date)] Loading environment variables from SSM Parameter Store..."
echo "  Stage: ${STAGE}"
echo "  Region: ${AWS_REGION}"

# ============================================================================
# Helper Function to Get SSM Parameter
# ============================================================================

getSsmParam() {
    local param_name=$1
    local default_value=${2:-}

    local value=$(aws ssm get-parameter \
        --name "$param_name" \
        --with-decryption \
        --query "Parameter.Value" \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo "")

    if [ -z "$value" ]; then
        if [ -n "$default_value" ]; then
            echo "$default_value"
        else
            echo ""
        fi
    else
        echo "$value"
    fi
}

# ============================================================================
# Fetch Parameters from SSM
# ============================================================================

echo "  Fetching parameters..."

# Database parameters
DATABASE_URL=$(getSsmParam "/miempresa/${STAGE}/db/DATABASE_URL")
DB_HOST=$(getSsmParam "/miempresa/${STAGE}/db/DB_HOST" "localhost")
DB_PORT=$(getSsmParam "/miempresa/${STAGE}/db/DB_PORT" "5432")
DB_NAME=$(getSsmParam "/miempresa/${STAGE}/db/DB_NAME" "miempresa_${STAGE}")
DB_USER=$(getSsmParam "/miempresa/${STAGE}/db/DB_USER" "miempresa")

# JWT parameters
JWT_SECRET=$(getSsmParam "/miempresa/${STAGE}/api/JWT_SECRET")
JWT_EXPIRATION=$(getSsmParam "/miempresa/${STAGE}/api/JWT_EXPIRATION" "24h")
JWT_REFRESH_EXPIRATION=$(getSsmParam "/miempresa/${STAGE}/api/JWT_REFRESH_EXPIRATION" "7d")

# Session parameters
SESSION_SECRET=$(getSsmParam "/miempresa/${STAGE}/api/SESSION_SECRET")

# AWS service parameters
AWS_S3_BUCKET=$(getSsmParam "/miempresa/${STAGE}/api/AWS_S3_BUCKET" "miempresa-uploads-${STAGE}")
AWS_S3_BACKUP_BUCKET=$(getSsmParam "/miempresa/${STAGE}/api/AWS_S3_BACKUP_BUCKET" "miempresa-backups-${STAGE}")

# CORS parameters
CORS_ORIGIN=$(getSsmParam "/miempresa/${STAGE}/api/CORS_ORIGIN" "http://localhost:3000")

# Application configuration
NODE_ENV=$(getSsmParam "/miempresa/${STAGE}/api/NODE_ENV" "${STAGE}")
PORT=$(getSsmParam "/miempresa/${STAGE}/api/PORT" "3001")
API_VERSION=$(getSsmParam "/miempresa/${STAGE}/api/API_VERSION" "v1")

# File upload parameters
MAX_FILE_SIZE_MB=$(getSsmParam "/miempresa/${STAGE}/api/MAX_FILE_SIZE_MB" "100")
ALLOWED_FILE_TYPES=$(getSsmParam "/miempresa/${STAGE}/api/ALLOWED_FILE_TYPES" "image/jpeg,image/png,image/gif,application/pdf")

# Email configuration (optional)
SMTP_HOST=$(getSsmParam "/miempresa/${STAGE}/api/SMTP_HOST")
SMTP_PORT=$(getSsmParam "/miempresa/${STAGE}/api/SMTP_PORT")
SMTP_USER=$(getSsmParam "/miempresa/${STAGE}/api/SMTP_USER")
SMTP_PASSWORD=$(getSsmParam "/miempresa/${STAGE}/api/SMTP_PASSWORD")
SMTP_FROM=$(getSsmParam "/miempresa/${STAGE}/api/SMTP_FROM")

# Rate limiting
RATE_LIMIT_WINDOW_MS=$(getSsmParam "/miempresa/${STAGE}/api/RATE_LIMIT_WINDOW_MS" "900000")
RATE_LIMIT_MAX_REQUESTS=$(getSsmParam "/miempresa/${STAGE}/api/RATE_LIMIT_MAX_REQUESTS" "100")

# Logging
LOG_LEVEL=$(getSsmParam "/miempresa/${STAGE}/api/LOG_LEVEL" "info")
LOG_FORMAT=$(getSsmParam "/miempresa/${STAGE}/api/LOG_FORMAT" "json")

# ============================================================================
# Generate .env File
# ============================================================================

echo "  Generating .env file..."

cat > .env <<EOF
# ============================================================================
# Mi Empresa Application Environment Variables
# ============================================================================
# Auto-generated from SSM Parameter Store
# Generated: $(date)
# Stage: ${STAGE}
# Region: ${AWS_REGION}
# ============================================================================

# Node Environment
NODE_ENV=${NODE_ENV}
PORT=${PORT}

# Database Configuration
DATABASE_URL=${DATABASE_URL}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}

# JWT Authentication
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRATION=${JWT_EXPIRATION}
JWT_REFRESH_EXPIRATION=${JWT_REFRESH_EXPIRATION}

# Session Management
SESSION_SECRET=${SESSION_SECRET}

# AWS Services
AWS_REGION=${AWS_REGION}
AWS_S3_BUCKET=${AWS_S3_BUCKET}
AWS_S3_BACKUP_BUCKET=${AWS_S3_BACKUP_BUCKET}

# CORS Configuration
CORS_ORIGIN=${CORS_ORIGIN}

# API Configuration
API_VERSION=${API_VERSION}

# File Upload Configuration
MAX_FILE_SIZE_MB=${MAX_FILE_SIZE_MB}
ALLOWED_FILE_TYPES=${ALLOWED_FILE_TYPES}

# Email Configuration (optional)
EOF

# Only add email config if values exist
if [ -n "$SMTP_HOST" ]; then
    cat >> .env <<EOF
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASSWORD=${SMTP_PASSWORD}
SMTP_FROM=${SMTP_FROM}
EOF
fi

cat >> .env <<EOF

# Rate Limiting
RATE_LIMIT_WINDOW_MS=${RATE_LIMIT_WINDOW_MS}
RATE_LIMIT_MAX_REQUESTS=${RATE_LIMIT_MAX_REQUESTS}

# Logging
LOG_LEVEL=${LOG_LEVEL}
LOG_FORMAT=${LOG_FORMAT}

# ============================================================================
# End of Environment Configuration
# ============================================================================
EOF

# Set restrictive permissions on .env file
chmod 600 .env

echo "  ✓ .env file generated successfully"

# ============================================================================
# Validation
# ============================================================================

echo "  Validating required parameters..."

# Check for critical missing parameters
if [ -z "$DATABASE_URL" ]; then
    echo "  ✗ ERROR: DATABASE_URL is missing from SSM"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "  ✗ ERROR: JWT_SECRET is missing from SSM"
    exit 1
fi

if [ -z "$SESSION_SECRET" ]; then
    echo "  ✗ ERROR: SESSION_SECRET is missing from SSM"
    exit 1
fi

echo "  ✓ All required parameters present"

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "=========================================="
echo "Environment variables loaded successfully"
echo "=========================================="
echo "  Stage: ${STAGE}"
echo "  Output: .env"
echo "  Permissions: 600 (owner read/write only)"
echo ""
echo "Environment summary:"
echo "  Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "  API Port: ${PORT}"
echo "  CORS Origin: ${CORS_ORIGIN}"
echo "  S3 Bucket: ${AWS_S3_BUCKET}"
echo "  Log Level: ${LOG_LEVEL}"
echo ""
echo "=========================================="
