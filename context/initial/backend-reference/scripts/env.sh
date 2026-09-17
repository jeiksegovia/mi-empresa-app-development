#!/bin/bash

# STACK, REGION, STAGE are expected in environment
# @todo: this file will be replaced with fetch-env-api.mjs

getSsmParam() {
  aws ssm get-parameter --name "$1" --with-decryption --query "Parameter.Value" --output text --region "$REGION" || true
}

# Map parameters per requirements
PARAM_DATABASE_URL="/foia/${STAGE}/api/DATABASE_URL"
PARAM_JWT_EXPIRES_IN="/foia/${STAGE}/api/JWT_EXPIRES_IN"
PARAM_FILE_UPLOAD_DIR="/foia/${STAGE}/api/FILE_UPLOAD_DIR"
PARAM_MAX_FILE_SIZE_MB="/foia/${STAGE}/api/MAX_FILE_SIZE_MB"
PARAM_ALLOWED_ORIGINS="/foia/${STAGE}/api/ALLOWED_ORIGINS"
PARAM_AWS_S3_BUCKET="/foia/${STAGE}/api/AWS_S3_BUCKET"
# JWT secret provided as literal per instruction
JWT_SECRET_LITERAL="change_me_in_prod"

# Hyperscience
PARAM_HS_HOST="/foia/${STAGE}/hyperscience/HS_HOST"
PARAM_HS_FLOW_DEFAULT="/foia/${STAGE}/hyperscience/HS_FLOW_DEFAULT"
PARAM_HS_INPUT_BUCKET="/foia/${STAGE}/hyperscience/HS_INPUT_BUCKET"
PARAM_HS_OUTPUT_BUCKET="/foia/${STAGE}/hyperscience/HS_OUTPUT_BUCKET"
PARAM_HS_API_TIMEOUT_MS="/foia/${STAGE}/hyperscience/HS_API_TIMEOUT_MS"
PARAM_REDACTION_MAX_FILE_MB="/foia/${STAGE}/hyperscience/REDACTION_MAX_FILE_MB"
# Services API
PARAM_HS_TOKEN="/foia/${STAGE}/services/HS_TOKEN"
PARAM_SERVICES_API_KEY="/foia/${STAGE}/services/SERVICES_API_KEY"
PARAM_SERVICES_ALLOWED_IPS="/foia/${STAGE}/services/SERVICES_ALLOWED_IPS"

# Generate .env
{
  echo "PORT=80"
  echo "NODE_ENV=${STAGE}"
  echo "DATABASE_URL=$(getSsmParam "$PARAM_DATABASE_URL")"
  echo "JWT_SECRET=${JWT_SECRET_LITERAL}"
  echo "JWT_EXPIRES_IN=$(getSsmParam "$PARAM_JWT_EXPIRES_IN")"
  echo "FILE_UPLOAD_DIR=$(getSsmParam "$PARAM_FILE_UPLOAD_DIR")"
  echo "MAX_FILE_SIZE_MB=$(getSsmParam "$PARAM_MAX_FILE_SIZE_MB")"
  echo "ALLOWED_ORIGINS=$(getSsmParam "$PARAM_ALLOWED_ORIGINS")"
  echo "AWS_REGION=${REGION}"
  echo "AWS_S3_BUCKET=$(getSsmParam "$PARAM_AWS_S3_BUCKET")"
  echo "HS_HOST=$(getSsmParam "$PARAM_HS_HOST")"
  echo "HS_FLOW_DEFAULT=$(getSsmParam "$PARAM_HS_FLOW_DEFAULT")"
  echo "HS_INPUT_BUCKET=$(getSsmParam "$PARAM_HS_INPUT_BUCKET")"
  echo "HS_OUTPUT_BUCKET=$(getSsmParam "$PARAM_HS_OUTPUT_BUCKET")"
  echo "HS_API_TIMEOUT_MS=$(getSsmParam "$PARAM_HS_API_TIMEOUT_MS")"
  echo "REDACTION_MAX_FILE_MB=$(getSsmParam "$PARAM_REDACTION_MAX_FILE_MB")"
  echo "HS_TOKEN=$(getSsmParam "$PARAM_HS_TOKEN")"
  echo "SERVICES_API_KEY=$(getSsmParam "$PARAM_SERVICES_API_KEY")"
  echo "SERVICES_ALLOWED_IPS=$(getSsmParam "$PARAM_SERVICES_ALLOWED_IPS")"
  
} > ./.env

# chmod 600 ./.env

echo "Generated .env with parameters from SSM and Secrets Manager"
