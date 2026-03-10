#!/bin/bash

# ============================================================================
# SSH to Lightsail Instance
# ============================================================================
# Convenient wrapper to SSH into a Lightsail instance.
#
# Usage:
#   ./ssh-to-instance.sh <instance-name> [region]
#
# Examples:
#   ./ssh-to-instance.sh miempresa-db-dev-1
#   ./ssh-to-instance.sh miempresa-db-prod-1 us-east-1
# ============================================================================

INSTANCE_NAME="${1}"
REGION="${2:-us-east-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "$INSTANCE_NAME" ]; then
    echo "Usage: $0 <instance-name> [region]"
    echo ""
    echo "Examples:"
    echo "  $0 miempresa-db-dev-1"
    echo "  $0 miempresa-db-prod-1 us-east-1"
    exit 1
fi

# Get instance IP
PUBLIC_IP=$("${SCRIPT_DIR}/get-instance-ip.sh" "$INSTANCE_NAME" "$REGION")

if [ -z "$PUBLIC_IP" ]; then
    echo "ERROR: Could not retrieve instance IP"
    exit 1
fi

echo "Connecting to ${INSTANCE_NAME} (${PUBLIC_IP})..."

# SSH key path
SSH_KEY="${HOME}/.ssh/miempresa-lightsail-key.pem"

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo ""
    echo "SSH key not found: ${SSH_KEY}"
    echo "Run install-ssh-key.sh first to download the key:"
    echo "  ${SCRIPT_DIR}/install-ssh-key.sh"
    exit 1
fi

# SSH to instance
ssh -i "$SSH_KEY" \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o LogLevel=ERROR \
    ec2-user@"${PUBLIC_IP}"
