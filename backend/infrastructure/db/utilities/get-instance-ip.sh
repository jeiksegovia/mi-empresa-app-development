#!/bin/bash

# ============================================================================
# Get Lightsail Instance Public IP
# ============================================================================
# Retrieves the public IP address of a Lightsail instance by name.
#
# Usage:
#   ./get-instance-ip.sh <instance-name> [region]
#
# Examples:
#   ./get-instance-ip.sh miempresa-backend-staging
#   ./get-instance-ip.sh miempresa-backend-prod us-east-1
# ============================================================================

INSTANCE_NAME="${1}"
REGION="${2:-us-east-1}"

if [ -z "$INSTANCE_NAME" ]; then
    echo "Usage: $0 <instance-name> [region]" >&2
    echo "" >&2
    echo "Examples:" >&2
    echo "  $0 miempresa-backend-staging" >&2
    echo "  $0 miempresa-backend-prod us-east-1" >&2
    exit 1
fi

# Extract stage from instance name
if [[ "$INSTANCE_NAME" == *"staging"* ]]; then
    STAGE="staging"
elif [[ "$INSTANCE_NAME" == *"prod"* ]]; then
    STAGE="prod"
else
    echo "ERROR: Cannot determine stage from instance name" >&2
    exit 1
fi

STATIC_IP_NAME="miempresa-ip-${STAGE}"

# Get static IP address
PUBLIC_IP=$(aws lightsail get-static-ip \
    --static-ip-name "$STATIC_IP_NAME" \
    --query "staticIp.ipAddress" \
    --output text \
    --region "$REGION" 2>/dev/null)

if [ -z "$PUBLIC_IP" ] || [ "$PUBLIC_IP" == "None" ]; then
    echo "ERROR: Static IP not found for ${STATIC_IP_NAME}" >&2
    exit 1
fi

echo "$PUBLIC_IP"
