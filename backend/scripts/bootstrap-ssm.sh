#!/bin/bash
# backend/scripts/bootstrap-ssm.sh
# One-time SSM parameter bootstrap before first deployment
# Usage: bash scripts/bootstrap-ssm.sh [stage] [region]

STAGE="${1:-dev}"
REGION="${2:-us-east-1}"

echo "=== Bootstrapping SSM parameters for stage: ${STAGE} ==="

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "Generated JWT secret (save this): ${JWT_SECRET}"

# JWT Secret
aws ssm put-parameter \
  --name "/${STAGE}/mi-empresa/JWT_SECRET" \
  --value "${JWT_SECRET}" \
  --type "SecureString" \
  --key-id "alias/aws/ssm" \
  --overwrite \
  --region "${REGION}"

echo "Set JWT_SECRET"

# CORS Origins
read -p "Enter CORS origins (comma-separated, e.g. https://mi-empresa.com): " CORS_ORIGINS
aws ssm put-parameter \
  --name "/${STAGE}/mi-empresa/CORS_ORIGIN" \
  --value "${CORS_ORIGINS:-http://localhost:3000}" \
  --type "String" \
  --overwrite \
  --region "${REGION}"

echo "Set CORS_ORIGIN"

echo ""
echo "=== IMPORTANT ==="
echo "DATABASE_URL will be set automatically by the CloudFormation stack"
echo "After stack deployment, you can also set it manually:"
echo ""
echo "  aws ssm put-parameter \\"
echo "    --name '/${STAGE}/mi-empresa/DATABASE_URL' \\"
echo "    --value 'postgresql://user:pass@proxy-endpoint:5432/miempresa' \\"
echo "    --type 'SecureString' \\"
echo "    --overwrite"
echo ""
echo "=== Bootstrap complete for ${STAGE} ==="
